import React, { useEffect, useState } from 'react';
import { type SensorStatistics, type SensorReading, type AnomalyAlert, SensorType, SENSOR_CONFIG } from '../../types/sensor.types';
import { SignalRService } from '../../services/signalr/SignalRService';
import { SensorApiService } from '../../services/api/SensorApiService';
import ConnectionStatus from '../ConnectionStatus/ConnectionStatus';
import SensorSelector from '../SensorSelector/SensorSelector';
import StatisticsCard from '../StatisticsCard/StatisticsCard';
import RealtimeChart from '../RealtimeChart/RealtimeChart';
import AlertPanel from '../AlertPanel/AlertPanel';
import { Activity, AlertTriangle, BarChart3, Gauge } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [signalR] = useState(() => SignalRService.getInstance());
  const [apiService] = useState(() => SensorApiService.getInstance());
  const [isConnected, setIsConnected] = useState(false);
  const [selectedSensors, setSelectedSensors] = useState<Set<SensorType>>(
    new Set([SensorType.Temperature, SensorType.Humidity])
  );
  const [statistics, setStatistics] = useState<Record<string, SensorStatistics>>({});
  const [sensorReadings, setSensorReadings] = useState<Record<SensorType, SensorReading[]>>({
    [SensorType.Temperature]: [],
    [SensorType.Humidity]: [],
    [SensorType.CO2]: [],
    [SensorType.Occupancy]: [],
    [SensorType.PowerConsumption]: [],
  });
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Load initial data from REST API
  const loadInitialDataFromApi = async () => {
    try {
      // Load statistics
      const stats = await apiService.getStatisticsBySensorType();
      setStatistics(stats);
      console.log('Loaded initial statistics from API:', stats);

      // Load recent readings
      const readings = await apiService.getRecentReadingsBySensorType(50);
      setSensorReadings(prev => ({
        ...prev,
        ...readings
      }));
      console.log('Loaded initial readings from API');
    } catch (error) {
      console.error('Failed to load initial data from API:', error);
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    // Set up handlers first (they can be registered even before connection)
    setupSignalRHandlers();

    const connectToHub = async () => {
      try {
        // Check if already connected or connecting
        const state = signalR.getConnectionState();
        // HubConnectionState.Connected = 'Connected'
        if (state && (state as any) === 1) { // Already Connected
          console.log('SignalR already connected');
          setIsConnected(true);
          // Subscribe to default sensors for already connected state
          for (const sensor of selectedSensors) {
            try {
              await signalR.subscribeToSensorType(sensor);
            } catch (err) {
              console.warn(`Failed to subscribe to ${sensor}`);
            }
          }
          // Load initial data from REST API
          loadInitialDataFromApi();
          return;
        }
        // HubConnectionState.Connecting = 'Connecting'
        if (state && (state as any) === 0) { // Connecting
          console.log('SignalR is already connecting...');
          return;
        }

        console.log('Connecting to SignalR...');
        await signalR.connect();

        if (isSubscribed) {
          // Update connection state based on actual SignalR state
          const connected = signalR.isConnected();
          console.log('SignalR connection state after connect:', connected);
          setIsConnected(connected);

          if (connected) {
            setConnectionError(null);

            // Small delay to ensure connection is fully established
            await new Promise(resolve => setTimeout(resolve, 500));

            // Subscribe to default sensors
            console.log('Subscribing to default sensors:', Array.from(selectedSensors));
            for (const sensor of selectedSensors) {
              try {
                await signalR.subscribeToSensorType(sensor);
                console.log(`Successfully subscribed to ${sensor}`);
              } catch (err) {
                console.warn(`Failed to subscribe to ${sensor}:`, err);
              }
            }

            // Load initial data from REST API
            loadInitialDataFromApi();
          }
        }
      } catch (error) {
        console.error('Failed to connect to SignalR hub:', error);
        if (isSubscribed) {
          setConnectionError('Failed to connect to server');
          setIsConnected(false);
        }
      }
    };

    connectToHub();

    return () => {
      isSubscribed = false;
      signalR.disconnect();
    };
  }, []);

  const setupSignalRHandlers = () => {
    // Handle connection state changes
    signalR.onConnectionStateChanged((connected: boolean) => {
      console.log('Connection state changed:', connected);
      setIsConnected(connected);
    });

    // Handle new sensor readings
    signalR.onSensorReading((reading: any) => {
      console.log('Received sensor reading:', reading);

      // Map backend sensor type (numeric) to frontend enum
      const getSensorTypeFromBackend = (type: number): SensorType | null => {
        const typeMapping: Record<number, SensorType> = {
          1: SensorType.Temperature,
          2: SensorType.Humidity,
          3: SensorType.CO2,
          4: SensorType.Occupancy,
          5: SensorType.PowerConsumption
        };
        return typeMapping[type] || null;
      };

      // Get sensor type from backend Type field (numeric)
      const sensorType = getSensorTypeFromBackend(reading.Type || reading.type);
      if (!sensorType) {
        console.warn('Invalid sensor type:', reading.Type || reading.type);
        return;
      }

      // Transform backend format to frontend format
      const transformedReading: SensorReading = {
        id: `${reading.SensorId || reading.sensorId}_${reading.Timestamp || reading.timestamp}`,
        sensorId: String(reading.SensorId || reading.sensorId),
        value: reading.Value || reading.value,
        timestamp: new Date(reading.Timestamp || reading.timestamp).toISOString(),
        sensorType: sensorType
      };

      setSensorReadings(prev => {
        const updated = { ...prev };

        // Ensure the sensor type exists in the state
        if (!updated[transformedReading.sensorType]) {
          updated[transformedReading.sensorType] = [];
        }

        const sensorData = [...updated[transformedReading.sensorType], transformedReading];
        // Keep only last 50 readings for performance
        updated[transformedReading.sensorType] = sensorData.slice(-50);

        console.log(`Updated ${transformedReading.sensorType} data array length:`, updated[transformedReading.sensorType].length);
        return updated;
      });
    });

    // Handle statistics updates
    signalR.onStatisticsUpdate((stats: any) => {
      console.log('Received statistics update:', stats);

      // Determine sensor type from sensor ID pattern
      const getSensorTypeFromId = (sensorId: number): SensorType => {
        if (sensorId <= 10) return SensorType.Temperature;
        if (sensorId <= 20) return SensorType.Humidity;
        if (sensorId <= 30) return SensorType.CO2;
        if (sensorId <= 40) return SensorType.Occupancy;
        return SensorType.PowerConsumption;
      };

      const sensorId = stats.SensorId || stats.sensorId;
      const sensorType = getSensorTypeFromId(sensorId);

      // Transform backend format to frontend format
      const transformedStats: SensorStatistics = {
        current: stats.Current || stats.current,
        min: stats.Min || stats.min,
        max: stats.Max || stats.max,
        average: stats.Average || stats.average,
        count: stats.Count || stats.count,
        sensorType: sensorType,
        lastUpdated: new Date(stats.LastUpdate || stats.lastUpdate || Date.now()).toISOString()
      };

      setStatistics(prev => ({
        ...prev,
        [transformedStats.sensorType]: transformedStats
      }));
    });

    // Handle anomaly alerts
    signalR.onAnomalyAlert((alert: any) => {
      // Transform backend format to frontend format
      const transformedAlert: AnomalyAlert = {
        id: alert.Id || alert.id,
        sensorId: alert.SensorId || alert.sensorId,
        value: alert.Value || alert.value,
        threshold: alert.Threshold || alert.threshold,
        timestamp: alert.Timestamp || alert.timestamp,
        alertType: alert.AlertType || alert.alertType,
        message: alert.Message || alert.message,
        sensorType: alert.SensorType || alert.sensorType
      };

      // Only add alerts with valid sensorType
      if (transformedAlert && transformedAlert.sensorType) {
        setAlerts(prev => [transformedAlert, ...prev].slice(0, 50)); // Keep last 50 alerts
      }
    });

    // Handle initial statistics
    signalR.onInitialStatistics((stats: any) => {
      console.log('Received initial statistics:', stats);
      const transformedStats: Record<string, SensorStatistics> = {};

      // Determine sensor type from sensor ID pattern
      const getSensorTypeFromId = (sensorId: number): SensorType => {
        if (sensorId <= 10) return SensorType.Temperature;
        if (sensorId <= 20) return SensorType.Humidity;
        if (sensorId <= 30) return SensorType.CO2;
        if (sensorId <= 40) return SensorType.Occupancy;
        return SensorType.PowerConsumption;
      };

      Object.keys(stats).forEach(key => {
        const stat = stats[key];
        const sensorId = stat.SensorId || stat.sensorId || parseInt(key);
        const sensorType = getSensorTypeFromId(sensorId);

        // Group statistics by sensor type (aggregate multiple sensors of same type)
        if (!transformedStats[sensorType]) {
          transformedStats[sensorType] = {
            current: stat.Current || stat.current,
            min: stat.Min || stat.min,
            max: stat.Max || stat.max,
            average: stat.Average || stat.average,
            count: stat.Count || stat.count,
            sensorType: sensorType,
            lastUpdated: new Date(stat.LastUpdate || stat.lastUpdate || Date.now()).toISOString()
          };
        } else {
          // Aggregate values for sensors of the same type
          const existing = transformedStats[sensorType];
          transformedStats[sensorType] = {
            ...existing,
            current: (existing.current + (stat.Current || stat.current)) / 2,
            min: Math.min(existing.min, stat.Min || stat.min),
            max: Math.max(existing.max, stat.Max || stat.max),
            average: (existing.average + (stat.Average || stat.average)) / 2,
            count: existing.count + (stat.Count || stat.count)
          };
        }
      });

      setStatistics(transformedStats);
    });

    // Handle recent alerts
    signalR.onRecentAlerts((recentAlerts: any[]) => {
      // Transform and filter alerts
      const validAlerts = recentAlerts
        .map(alert => ({
          id: alert.Id || alert.id,
          sensorId: alert.SensorId || alert.sensorId,
          value: alert.Value || alert.value,
          threshold: alert.Threshold || alert.threshold,
          timestamp: alert.Timestamp || alert.timestamp,
          alertType: alert.AlertType || alert.alertType,
          message: alert.Message || alert.message,
          sensorType: alert.SensorType || alert.sensorType
        }))
        .filter(alert => alert && alert.sensorType);

      setAlerts(validAlerts);
    });

    // Handle historical data
    signalR.on('ReceiveHistoricalData', (historicalData: any[]) => {
      console.log('Received historical data:', historicalData.length, 'readings');
      if (historicalData.length > 0) {
        // Map backend sensor type (numeric) to frontend enum
        const getSensorTypeFromBackend = (type: number): SensorType | null => {
          const typeMapping: Record<number, SensorType> = {
            1: SensorType.Temperature,
            2: SensorType.Humidity,
            3: SensorType.CO2,
            4: SensorType.Occupancy,
            5: SensorType.PowerConsumption
          };
          return typeMapping[type] || null;
        };

        // Group readings by sensor type
        const groupedReadings: Record<SensorType, SensorReading[]> = {
          [SensorType.Temperature]: [],
          [SensorType.Humidity]: [],
          [SensorType.CO2]: [],
          [SensorType.Occupancy]: [],
          [SensorType.PowerConsumption]: [],
        };

        historicalData.forEach(reading => {
          const sensorType = getSensorTypeFromBackend(reading.Type || reading.type);
          if (sensorType) {
            const transformedReading: SensorReading = {
              id: `${reading.SensorId || reading.sensorId}_${reading.Timestamp || reading.timestamp}`,
              sensorId: String(reading.SensorId || reading.sensorId),
              value: reading.Value || reading.value,
              timestamp: new Date(reading.Timestamp || reading.timestamp).toISOString(),
              sensorType: sensorType
            };
            groupedReadings[sensorType].push(transformedReading);
          }
        });

        // Update state with grouped readings
        setSensorReadings(prev => {
          const updated = { ...prev };
          Object.entries(groupedReadings).forEach(([type, readings]) => {
            if (readings.length > 0) {
              updated[type as SensorType] = readings.slice(-50); // Keep last 50 readings
            }
          });
          return updated;
        });
      }
    });
  };

  const handleSensorToggle = async (sensorType: SensorType) => {
    const newSelected = new Set(selectedSensors);

    if (newSelected.has(sensorType)) {
      newSelected.delete(sensorType);
      // Check actual SignalR connection state
      if (signalR.isConnected()) {
        try {
          await signalR.unsubscribeFromSensorType(sensorType);
        } catch (error) {
          console.error(`Failed to unsubscribe from ${sensorType}:`, error);
        }
      }
    } else {
      newSelected.add(sensorType);
      // Check actual SignalR connection state
      if (signalR.isConnected()) {
        try {
          await signalR.subscribeToSensorType(sensorType);
          await signalR.getHistoricalData(sensorType, 50);
        } catch (error) {
          console.error(`Failed to subscribe to ${sensorType}:`, error);
        }
      }
    }

    setSelectedSensors(newSelected);
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-xl border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Activity className="h-8 w-8 text-blue-500" />
              <h1 className="text-2xl font-bold text-white">
                Smart Building Analytics
              </h1>
            </div>
            <ConnectionStatus
              isConnected={isConnected}
              error={connectionError}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sensor Selector */}
        <div className="mb-8">
          <SensorSelector
            selectedSensors={selectedSensors}
            onSensorToggle={handleSensorToggle}
          />
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {Object.values(SensorType).map(sensorType => (
            <StatisticsCard
              key={sensorType}
              sensorType={sensorType}
              statistics={statistics[sensorType]}
              isActive={selectedSensors.has(sensorType)}
            />
          ))}
        </div>

        {/* Charts and Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Charts Section */}
          <div className="lg:col-span-2 space-y-6">
            {Array.from(selectedSensors).map(sensorType => (
              <div key={sensorType} className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-gray-400" />
                    <h2 className="text-lg font-semibold text-white">
                      {SENSOR_CONFIG[sensorType].label} Monitoring
                    </h2>
                  </div>
                  <span className="text-2xl">{SENSOR_CONFIG[sensorType].icon}</span>
                </div>
                <RealtimeChart
                  sensorType={sensorType}
                  data={sensorReadings[sensorType]}
                  config={SENSOR_CONFIG[sensorType]}
                />
              </div>
            ))}

            {selectedSensors.size === 0 && (
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-12 border border-gray-700 text-center">
                <Gauge className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">
                  Select sensors to view real-time data
                </p>
              </div>
            )}
          </div>

          {/* Alerts Section */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <h2 className="text-lg font-semibold text-white">
                    Anomaly Alerts
                  </h2>
                </div>
                <span className="px-2 py-1 text-xs font-medium text-yellow-400 bg-yellow-400/10 rounded-full">
                  {alerts.length} Active
                </span>
              </div>
              <AlertPanel
                alerts={alerts}
                onClear={clearAlerts}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;