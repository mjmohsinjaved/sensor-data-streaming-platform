export const SIGNALR_CONFIG = {
	hubUrl:
		import.meta.env.VITE_SIGNALR_HUB_URL || "http://localhost:5135/sensorHub",
	reconnectInterval: 5000,
	maxReconnectAttempts: 10,
	enableLogging: import.meta.env.DEV,
	transportType: {
		webSockets: true,
		serverSentEvents: true,
		longPolling: false,
	},
} as const;

export const HUB_METHODS = {
	// Server -> Client methods
	RECEIVE_SENSOR_READING: "ReceiveSensorReading",
	RECEIVE_STATISTICS_UPDATE: "ReceiveStatisticsUpdate",
	RECEIVE_ANOMALY_ALERT: "ReceiveAnomalyAlert",
	RECEIVE_INITIAL_STATISTICS: "ReceiveInitialStatistics",
	RECEIVE_RECENT_ALERTS: "ReceiveRecentAlerts",
	RECEIVE_HISTORICAL_DATA: "ReceiveHistoricalData",

	// Client -> Server methods
	SUBSCRIBE_TO_SENSOR: "SubscribeToSensor",
	UNSUBSCRIBE_FROM_SENSOR: "UnsubscribeFromSensor",
	GET_ACTIVE_SENSORS: "GetActiveSensors",
	SUBSCRIBE_TO_SENSOR_TYPE: "SubscribeToSensorType",
	UNSUBSCRIBE_FROM_SENSOR_TYPE: "UnsubscribeFromSensorType",
	GET_HISTORICAL_DATA: "GetHistoricalData",
	GET_STATISTICS: "GetStatistics",
	GET_RECENT_ALERTS: "GetRecentAlerts",
	REQUEST_HISTORICAL_DATA: "RequestHistoricalData",
} as const;
