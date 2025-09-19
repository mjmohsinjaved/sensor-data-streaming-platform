export interface SensorData {
	sensorId: string;
	sensorName: string;
	type: "temperature" | "humidity" | "pressure" | "vibration" | "flow";
	value: number;
	unit: string;
	timestamp: string;
	location?: string;
	status: "normal" | "warning" | "critical";
}

export interface Alert {
	id: string;
	sensorId: string;
	message: string;
	severity: "info" | "warning" | "error" | "critical";
	timestamp: string;
	acknowledged: boolean;
}

export interface ConnectionState {
	isConnected: boolean;
	isConnecting: boolean;
	error: string | null;
	reconnectAttempt: number;
}

export interface HistoricalDataRequest {
	sensorId: string;
	startTime: string;
	endTime: string;
	aggregationType?: "raw" | "minute" | "hour" | "day";
}

export type ConnectionStatus =
	| "disconnected"
	| "connecting"
	| "connected"
	| "reconnecting";
