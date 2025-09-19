export const SIGNALR_CONFIG = {
  hubUrl: import.meta.env.VITE_SIGNALR_HUB_URL || 'https://localhost:7001/sensorHub',
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  enableLogging: import.meta.env.DEV,
  transportType: {
    webSockets: true,
    serverSentEvents: true,
    longPolling: false
  }
} as const;

export const HUB_METHODS = {
  // Server -> Client methods
  RECEIVE_SENSOR_DATA: 'ReceiveSensorData',
  RECEIVE_ALERT: 'ReceiveAlert',
  RECEIVE_CONNECTION_UPDATE: 'ReceiveConnectionUpdate',
  RECEIVE_ERROR: 'ReceiveError',

  // Client -> Server methods
  SUBSCRIBE_TO_SENSOR: 'SubscribeToSensor',
  UNSUBSCRIBE_FROM_SENSOR: 'UnsubscribeFromSensor',
  GET_ACTIVE_SENSORS: 'GetActiveSensors',
  REQUEST_HISTORICAL_DATA: 'RequestHistoricalData'
} as const;