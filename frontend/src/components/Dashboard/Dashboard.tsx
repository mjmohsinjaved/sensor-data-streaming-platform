import React, { useEffect, useState, useRef } from 'react';
import {
  type AggregatedSensorData,
  type AggregatedStats,
  type PerformanceStats,
  type AnomalyAlert,
  AlertType,
  SensorType,
  SENSOR_CONFIG
} from '../../types/sensor.types';
import { SignalRService } from '../../services/signalr/SignalRService';
import ConnectionStatus from '../ConnectionStatus/ConnectionStatus';
import SensorSelector from '../SensorSelector/SensorSelector';
import StatisticsCard from '../StatisticsCard/StatisticsCard';
import RealtimeChart from '../RealtimeChart/RealtimeChart';
import AlertPanel from '../AlertPanel/AlertPanel';
import { Activity, AlertTriangle, BarChart3, Gauge } from 'lucide-react';

const ROLLING_WINDOW_SIZE = 100; // Keep 100 seconds of data

interface ChartDataPoint {
  timestamp: number;
  value: number;
  min: number;
  max: number;
  average: number;
  anomalyCount?: number;
}

const Dashboard: React.FC = () => {
  const [signalR] = useState(() => SignalRService.getInstance());
  const [isConnected, setIsConnected] = useState(false);
  const [selectedSensors, setSelectedSensors] = useState<Set<SensorType>>(
    new Set([SensorType.Temperature, SensorType.Humidity])
  );

  // Store aggregated statistics by sensor type
  const [aggregatedStats, setAggregatedStats] = useState<Record<string, AggregatedSensorData>>({});

  // Anomaly tracking
  const [totalAnomalies, setTotalAnomalies] = useState(0);

  // Store rolling window of chart data for each sensor type
  const chartDataRef = useRef<Record<string, ChartDataPoint[]>>({
    [SensorType.Temperature]: [],
    [SensorType.Humidity]: [],
    [SensorType.CO2]: [],
    [SensorType.Occupancy]: [],
    [SensorType.PowerConsumption]: [],
  });
  const [chartData, setChartData] = useState<Record<string, ChartDataPoint[]>>(chartDataRef.current);

  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);

  // Track last anomaly counts to detect new anomalies
  const lastAnomalyCountsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let isSubscribed = true;

    // Set up handlers first
    setupSignalRHandlers();

    const connectToHub = async () => {
      try {
        const state = signalR.getConnectionState();
        if (state && (state as any) === 1) { // Already Connected
          console.log('SignalR already connected');
          setIsConnected(true);
          return;
        }
        if (state && (state as any) === 0) { // Connecting
          console.log('SignalR is already connecting...');
          return;
        }

        console.log('Connecting to SignalR...');
        await signalR.connect();

        if (isSubscribed) {
          const connected = signalR.isConnected();
          console.log('SignalR connection state after connect:', connected);
          setIsConnected(connected);

          if (connected) {
            setConnectionError(null);
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

    // Handle aggregated statistics (received every second)
    signalR.onAggregatedStats((data: AggregatedStats) => {
      console.log('Received aggregated stats:', data);

      if (data && data.aggregated) {
        // Update current statistics
        const statsMap: Record<string, AggregatedSensorData> = {};
        let currentTotalAnomalies = 0;

        data.aggregated.forEach(stat => {
          statsMap[stat.type] = stat;
          currentTotalAnomalies += stat.anomalyCount;
        });

        setAggregatedStats(statsMap);
        setTotalAnomalies(currentTotalAnomalies);

        // Generate alerts for new anomalies
        const newAlerts: AnomalyAlert[] = [];
        data.aggregated.forEach(stat => {
          const lastCount = lastAnomalyCountsRef.current[stat.type] || 0;
          const currentCount = stat.anomalyCount;

          // If anomaly count increased, create an alert
          if (currentCount > lastCount) {
            const alertType = getAlertTypeForSensor(stat.type);
            const threshold = getThresholdForSensor(stat.type);

            const alert: AnomalyAlert = {
              id: `${stat.type}-${data.timestamp}`,
              sensorId: `aggregate-${stat.type}`,
              value: stat.current,
              threshold: threshold.max || threshold.min || 0,
              timestamp: new Date(data.timestamp).toISOString(),
              alertType: alertType,
              message: `${currentCount - lastCount} new anomal${currentCount - lastCount === 1 ? 'y' : 'ies'} detected: ${stat.type} sensors ${threshold.message}`,
              sensorType: stat.type as SensorType
            };
            newAlerts.push(alert);
          }

          // Update last count
          lastAnomalyCountsRef.current[stat.type] = currentCount;
        });

        // Add new alerts to the list (keep last 50)
        if (newAlerts.length > 0) {
          setAlerts(prev => [...newAlerts, ...prev].slice(0, 50));
        }

        // Update rolling window for charts
        const timestamp = data.timestamp;
        const newChartData = { ...chartDataRef.current };

        data.aggregated.forEach(stat => {
          const sensorType = stat.type as SensorType;
          if (sensorType in newChartData) {
            const dataPoint: ChartDataPoint = {
              timestamp,
              value: stat.current,
              min: stat.min,
              max: stat.max,
              average: stat.average,
              anomalyCount: stat.anomalyCount // Add anomaly count to chart data
            };

            // Add new data point
            newChartData[sensorType] = [...(newChartData[sensorType] || []), dataPoint];

            // Keep only last 100 points (rolling window)
            if (newChartData[sensorType].length > ROLLING_WINDOW_SIZE) {
              newChartData[sensorType] = newChartData[sensorType].slice(-ROLLING_WINDOW_SIZE);
            }
          }
        });

        chartDataRef.current = newChartData;
        setChartData(newChartData);
      }
    });

    // Handle performance statistics
    signalR.onPerformanceStats((stats: PerformanceStats) => {
      console.log('Received performance stats:', stats);
      setPerformanceStats(stats);
    });

    // Handle anomaly alerts if they exist
    signalR.on('ReceiveAnomalyAlert', (alert: AnomalyAlert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 50)); // Keep last 50 alerts
    });
  };

  const handleSensorToggle = async (sensorType: SensorType) => {
    const newSelected = new Set(selectedSensors);

    if (newSelected.has(sensorType)) {
      newSelected.delete(sensorType);
    } else {
      newSelected.add(sensorType);
    }

    setSelectedSensors(newSelected);
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  // Helper function to determine alert type based on sensor
  const getAlertTypeForSensor = (sensorType: string): AlertType => {
    switch (sensorType) {
      case SensorType.Temperature:
      case SensorType.Humidity:
        return AlertType.HVACFailure;
      case SensorType.CO2:
        return AlertType.AirQualityIssue;
      case SensorType.Occupancy:
        return AlertType.OccupancyAnomaly;
      case SensorType.PowerConsumption:
        return AlertType.AbnormalEnergyUsage;
      default:
        return AlertType.AirQualityIssue;
    }
  };

  // Helper function to get thresholds for each sensor type
  const getThresholdForSensor = (sensorType: string): { min?: number, max?: number, message: string } => {
    switch (sensorType) {
      case SensorType.Temperature:
        return { min: 19, max: 25, message: 'outside 19-25°C range' };
      case SensorType.Humidity:
        return { min: 35, max: 65, message: 'outside 35-65% range' };
      case SensorType.CO2:
        return { max: 800, message: 'exceeded 800ppm' };
      case SensorType.Occupancy:
        return { max: 45, message: 'exceeded 45 people' };
      case SensorType.PowerConsumption:
        return { max: 80, message: 'exceeded 80kW' };
      default:
        return { message: 'threshold exceeded' };
    }
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
            <div className="flex items-center space-x-4">
              {/* Anomaly Indicator */}
              {totalAnomalies > 0 && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-lg animate-pulse">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium text-yellow-500">
                    {totalAnomalies} Anomal{totalAnomalies === 1 ? 'y' : 'ies'}
                  </span>
                </div>
              )}

              {/* Performance Stats */}
              {performanceStats && (
                <div className="text-sm text-gray-400">
                  <span className="text-green-400">{performanceStats.connectedClients}</span> clients |
                  <span className="text-blue-400"> {performanceStats.messagesPerSecond}</span> msg/s
                </div>
              )}

              <ConnectionStatus
                isConnected={isConnected}
                error={connectionError}
              />
            </div>
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
          {Object.values(SensorType).map(sensorType => {
            const stats = aggregatedStats[sensorType];
            return (
              <StatisticsCard
                key={sensorType}
                sensorType={sensorType}
                statistics={stats ? {
                  current: stats.current,
                  min: stats.min,
                  max: stats.max,
                  average: stats.average,
                  count: stats.totalReadings,
                  sensorType: sensorType,
                  lastUpdated: new Date().toISOString()
                } : undefined}
                isActive={selectedSensors.has(sensorType)}
                additionalInfo={stats ? {
                  trend: stats.trendSymbol,
                  anomalyCount: stats.anomalyCount,
                  sensorCount: stats.sensorCount
                } : undefined}
              />
            );
          })}
        </div>

        {/* Charts and Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Charts Section */}
          <div className="lg:col-span-2 space-y-6">
            {Array.from(selectedSensors).map(sensorType => {
              const data = chartData[sensorType] || [];
              const config = SENSOR_CONFIG[sensorType];

              return (
                <div key={sensorType} className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="h-5 w-5 text-gray-400" />
                      <h2 className="text-lg font-semibold text-white">
                        {config.label} Monitoring
                      </h2>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{config.icon}</span>
                      {aggregatedStats[sensorType] && (
                        <span className="text-sm text-gray-400">
                          {aggregatedStats[sensorType].sensorCount} sensors
                        </span>
                      )}
                    </div>
                  </div>
                  <RealtimeChart
                    sensorType={sensorType}
                    data={data}
                    config={config}
                    isAggregated={true}
                  />
                </div>
              );
            })}

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