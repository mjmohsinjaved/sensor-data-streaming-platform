import React, { useState, useEffect } from 'react';
import { useSignalRConnection, useSensorSubscription, useAlerts } from '../../hooks';
import { useSignalR } from '../../contexts/SignalRContext';
import './SensorDashboard.css';

export const SensorDashboard: React.FC = () => {
  const [selectedSensorId, setSelectedSensorId] = useState<string>('sensor-001');
  const [availableSensors, setAvailableSensors] = useState<string[]>([]);

  const {
    isConnected,
    isConnecting,
    connectionError,
    connectionStatus,
    connect,
    disconnect
  } = useSignalRConnection({
    onConnected: () => console.log('Connected to SignalR hub'),
    onDisconnected: () => console.log('Disconnected from SignalR hub'),
    onReconnecting: () => console.log('Reconnecting to SignalR hub')
  });

  const { getActiveSensors, requestHistoricalData } = useSignalR();

  const {
    isSubscribed,
    isSubscribing,
    latestData,
    subscriptionError,
    subscribe,
    unsubscribe
  } = useSensorSubscription(selectedSensorId, {
    autoSubscribe: true,
    onDataReceived: (data) => console.log('Received sensor data:', data),
    onError: (error) => console.error('Subscription error:', error)
  });

  const {
    alerts,
    unacknowledgedCount,
    alertsBySeverity,
    acknowledgeAlert,
    clearAlerts
  } = useAlerts({
    filterUnacknowledged: false,
    limit: 10
  });

  useEffect(() => {
    if (isConnected) {
      loadActiveSensors();
    }
  }, [isConnected]);

  const loadActiveSensors = async () => {
    try {
      const sensors = await getActiveSensors();
      setAvailableSensors(sensors);
      if (sensors.length > 0 && !selectedSensorId) {
        setSelectedSensorId(sensors[0]);
      }
    } catch (error) {
      console.error('Failed to load active sensors:', error);
    }
  };

  const handleRequestHistoricalData = async () => {
    if (!selectedSensorId) return;

    const endTime = new Date();
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - 24);

    try {
      await requestHistoricalData(selectedSensorId, startTime, endTime);
      console.log('Historical data requested');
    } catch (error) {
      console.error('Failed to request historical data:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return '#4CAF50';
      case 'connecting': return '#FFC107';
      case 'reconnecting': return '#FF9800';
      case 'disconnected': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#F44336';
      case 'error': return '#FF5722';
      case 'warning': return '#FFC107';
      case 'info': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  return (
    <div className="sensor-dashboard">
      <div className="dashboard-header">
        <h1>Sensor Data Streaming Dashboard</h1>
        <div className="connection-status">
          <span
            className="status-indicator"
            style={{ backgroundColor: getStatusColor(connectionStatus) }}
          />
          <span>Status: {connectionStatus}</span>
          {connectionError && (
            <span className="error-message">Error: {connectionError}</span>
          )}
        </div>
      </div>

      <div className="dashboard-controls">
        <button
          onClick={isConnected ? disconnect : connect}
          disabled={isConnecting}
          className={`btn ${isConnected ? 'btn-danger' : 'btn-primary'}`}
        >
          {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
        </button>

        <button
          onClick={loadActiveSensors}
          disabled={!isConnected}
          className="btn btn-secondary"
        >
          Refresh Sensors
        </button>

        <button
          onClick={clearAlerts}
          disabled={alerts.length === 0}
          className="btn btn-warning"
        >
          Clear Alerts ({unacknowledgedCount} unread)
        </button>
      </div>

      <div className="dashboard-content">
        <div className="sensor-section">
          <h2>Sensor Subscription</h2>
          <div className="sensor-controls">
            <select
              value={selectedSensorId || ''}
              onChange={(e) => setSelectedSensorId(e.target.value)}
              disabled={!isConnected}
              className="sensor-select"
            >
              <option value="">Select a sensor</option>
              {availableSensors.map(sensorId => (
                <option key={sensorId} value={sensorId}>
                  {sensorId}
                </option>
              ))}
            </select>

            <button
              onClick={isSubscribed ? unsubscribe : subscribe}
              disabled={!selectedSensorId || !isConnected || isSubscribing}
              className={`btn ${isSubscribed ? 'btn-danger' : 'btn-success'}`}
            >
              {isSubscribing ? 'Processing...' : isSubscribed ? 'Unsubscribe' : 'Subscribe'}
            </button>

            <button
              onClick={handleRequestHistoricalData}
              disabled={!selectedSensorId || !isConnected}
              className="btn btn-info"
            >
              Get Last 24h Data
            </button>
          </div>

          {subscriptionError && (
            <div className="error-box">
              Subscription Error: {subscriptionError}
            </div>
          )}

          {latestData && (
            <div className="sensor-data-display">
              <h3>Latest Sensor Data</h3>
              <div className="data-grid">
                <div className="data-item">
                  <label>Sensor ID:</label>
                  <span>{latestData.sensorId}</span>
                </div>
                <div className="data-item">
                  <label>Name:</label>
                  <span>{latestData.sensorName}</span>
                </div>
                <div className="data-item">
                  <label>Type:</label>
                  <span>{latestData.type}</span>
                </div>
                <div className="data-item">
                  <label>Value:</label>
                  <span className="value-highlight">
                    {latestData.value} {latestData.unit}
                  </span>
                </div>
                <div className="data-item">
                  <label>Status:</label>
                  <span className={`status-badge status-${latestData.status}`}>
                    {latestData.status}
                  </span>
                </div>
                <div className="data-item">
                  <label>Location:</label>
                  <span>{latestData.location || 'N/A'}</span>
                </div>
                <div className="data-item">
                  <label>Timestamp:</label>
                  <span>{new Date(latestData.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="alerts-section">
          <h2>System Alerts</h2>
          <div className="alerts-summary">
            <span className="alert-stat">
              Critical: <strong>{alertsBySeverity.critical}</strong>
            </span>
            <span className="alert-stat">
              Error: <strong>{alertsBySeverity.error}</strong>
            </span>
            <span className="alert-stat">
              Warning: <strong>{alertsBySeverity.warning}</strong>
            </span>
            <span className="alert-stat">
              Info: <strong>{alertsBySeverity.info}</strong>
            </span>
          </div>

          <div className="alerts-list">
            {alerts.length === 0 ? (
              <div className="no-alerts">No alerts to display</div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`alert-item ${alert.acknowledged ? 'acknowledged' : ''}`}
                >
                  <div
                    className="alert-severity"
                    style={{ backgroundColor: getSeverityColor(alert.severity) }}
                  >
                    {alert.severity.toUpperCase()}
                  </div>
                  <div className="alert-content">
                    <div className="alert-message">{alert.message}</div>
                    <div className="alert-meta">
                      <span>Sensor: {alert.sensorId}</span>
                      <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="btn btn-sm"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};