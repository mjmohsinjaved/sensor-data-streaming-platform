export const SIGNALR_CONFIG = {
	hubUrl:
		import.meta.env.VITE_SIGNALR_HUB_URL || "http://localhost:5135/sensorHub",
	reconnectInterval: 5135,
	maxReconnectAttempts: 10,
	enableLogging: import.meta.env.DEV,
	transportType: {
		webSockets: true,
		serverSentEvents: true,
		longPolling: false,
	},
} as const;

export const HUB_METHODS = {
	// Server -> Client methods (New aggregated events)
	RECEIVE_AGGREGATED_STATS: "ReceiveAggregatedStats",
	RECEIVE_PERFORMANCE_STATS: "ReceivePerformanceStats",
	RECEIVE_ANOMALY_ALERT: "ReceiveAnomalyAlert",
} as const;
