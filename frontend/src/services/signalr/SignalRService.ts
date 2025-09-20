import {
	HubConnection,
	HubConnectionBuilder,
	LogLevel,
	HubConnectionState,
	type IHttpConnectionOptions,
} from "@microsoft/signalr";
import { SIGNALR_CONFIG, HUB_METHODS } from "../../config/signalr.config";
import {
	SensorType,
	type SensorReading,
	type SensorStatistics,
	type AnomalyAlert,
} from "../../types/sensor.types";
import type { ConnectionStatus } from "../../types/signalr.types";

export type SignalREventHandler<T = any> = (data: T) => void;

export class SignalRService {
	private static instance: SignalRService | null = null;
	private hubConnection: HubConnection | null = null;
	private connectionStatus: ConnectionStatus = "disconnected";
	private reconnectAttempts = 0;
	private reconnectTimer: NodeJS.Timeout | null = null;
	private eventHandlers: Map<string, Set<SignalREventHandler>> = new Map();

	private constructor() {}

	public static getInstance(): SignalRService {
		if (!SignalRService.instance) {
			SignalRService.instance = new SignalRService();
		}
		return SignalRService.instance;
	}

	public async initialize(): Promise<void> {
		if (this.hubConnection) {
			const state = this.hubConnection.state;
			if (
				state === HubConnectionState.Connected ||
				state === HubConnectionState.Connecting
			) {
				console.warn("SignalR connection already initialized or connecting");
				return;
			}
		}

		try {
			this.connectionStatus = "connecting";
			this.notifyStatusChange();

			const options: IHttpConnectionOptions = {
				withCredentials: false,
				transport: this.getTransportOptions(),
			};

			this.hubConnection = new HubConnectionBuilder()
				.withUrl(SIGNALR_CONFIG.hubUrl, options)
				.withAutomaticReconnect({
					nextRetryDelayInMilliseconds: (retryContext) => {
						if (
							retryContext.previousRetryCount >=
							SIGNALR_CONFIG.maxReconnectAttempts
						) {
							return null;
						}
						return Math.min(
							1000 * Math.pow(2, retryContext.previousRetryCount),
							30000
						);
					},
				})
				.configureLogging(
					SIGNALR_CONFIG.enableLogging ? LogLevel.Debug : LogLevel.Warning
				)
				.build();

			this.setupEventHandlers();
			await this.startConnection();
		} catch (error) {
			console.error("Failed to initialize SignalR connection:", error);
			this.connectionStatus = "disconnected";
			this.notifyStatusChange();
			throw error;
		}
	}

	private getTransportOptions(): number {
		let transport = 0;
		if (SIGNALR_CONFIG.transportType.webSockets) transport |= 1;
		if (SIGNALR_CONFIG.transportType.serverSentEvents) transport |= 2;
		if (SIGNALR_CONFIG.transportType.longPolling) transport |= 4;
		return transport || 1;
	}

	private setupEventHandlers(): void {
		if (!this.hubConnection) return;

		this.hubConnection.onclose((error) => {
			console.log("SignalR connection closed", error);
			this.connectionStatus = "disconnected";
			this.notifyStatusChange();
			this.attemptReconnection();
		});

		this.hubConnection.onreconnecting(() => {
			console.log("SignalR reconnecting...");
			this.connectionStatus = "reconnecting";
			this.notifyStatusChange();
		});

		this.hubConnection.onreconnected(() => {
			console.log("SignalR reconnected");
			this.connectionStatus = "connected";
			this.reconnectAttempts = 0;
			this.notifyStatusChange();
		});

		this.registerServerMethods();
	}

	private registerServerMethods(): void {
		if (!this.hubConnection) return;

		// Register backend hub methods
		// Handle batch sensor data from backend
		this.hubConnection.on(
			"ReceiveSensorData",
			(batch: any[]) => {
				console.log('Received sensor data batch:', batch.length, 'readings');
				// Process each reading in the batch
				if (batch && batch.length > 0) {
					batch.forEach(reading => {
						this.emit(HUB_METHODS.RECEIVE_SENSOR_READING, reading);
					});
				}
			}
		);

		// Handle statistics update from backend
		this.hubConnection.on(
			"ReceiveStatistics",
			(stats: any[]) => {
				console.log('Received statistics:', stats);
				// Transform statistics array to record format
				if (stats && stats.length > 0) {
					stats.forEach(stat => {
						this.emit(HUB_METHODS.RECEIVE_STATISTICS_UPDATE, stat);
					});
				}
			}
		);

		// Handle initial data when connecting
		this.hubConnection.on(
			"InitialData",
			(data: { readings: any[], stats: any[], totalReadings: number }) => {
				console.log('Received initial data:', data.totalReadings, 'total readings');
				// Process initial readings
				if (data.readings && data.readings.length > 0) {
					data.readings.forEach(reading => {
						this.emit(HUB_METHODS.RECEIVE_SENSOR_READING, reading);
					});
				}
				// Process initial statistics
				if (data.stats && data.stats.length > 0) {
					const statsRecord: Record<string, any> = {};
					data.stats.forEach(stat => {
						// Use sensorId as key
						statsRecord[stat.SensorId || stat.sensorId] = stat;
					});
					this.emit(HUB_METHODS.RECEIVE_INITIAL_STATISTICS, statsRecord);
				}
			}
		);

		// Handle recent readings response
		this.hubConnection.on(
			"RecentReadings",
			(readings: any[]) => {
				console.log('Received recent readings:', readings.length);
				if (readings && readings.length > 0) {
					readings.forEach(reading => {
						this.emit(HUB_METHODS.RECEIVE_SENSOR_READING, reading);
					});
				}
			}
		);

		// Handle sensor statistics response
		this.hubConnection.on(
			"SensorStatistics",
			(stats: any) => {
				console.log('Received sensor statistics:', stats);
				this.emit(HUB_METHODS.RECEIVE_STATISTICS_UPDATE, stats);
			}
		);
	}

	private async startConnection(): Promise<void> {
		if (!this.hubConnection) return;

		try {
			await this.hubConnection.start();
			this.connectionStatus = "connected";
			this.reconnectAttempts = 0;
			this.notifyStatusChange();
			console.log("SignalR connected successfully");
		} catch (error) {
			console.error("Failed to start SignalR connection:", error);
			throw error;
		}
	}

	private attemptReconnection(): void {
		if (this.reconnectAttempts >= SIGNALR_CONFIG.maxReconnectAttempts) {
			console.error("Max reconnection attempts reached");
			return;
		}

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
		}

		this.reconnectTimer = setTimeout(async () => {
			this.reconnectAttempts++;
			console.log(
				`Reconnection attempt ${this.reconnectAttempts}/${SIGNALR_CONFIG.maxReconnectAttempts}`
			);

			try {
				await this.startConnection();
			} catch (error) {
				console.error("Reconnection failed:", error);
				this.attemptReconnection();
			}
		}, SIGNALR_CONFIG.reconnectInterval);
	}

	public async disconnect(): Promise<void> {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		if (this.hubConnection) {
			try {
				await this.hubConnection.stop();
				this.hubConnection = null;
				this.connectionStatus = "disconnected";
				this.notifyStatusChange();
				console.log("SignalR disconnected");
			} catch (error) {
				console.error("Error disconnecting SignalR:", error);
			}
		}
	}

	public async subscribeToSensor(sensorId: string): Promise<void> {
		if (!this.isConnected()) {
			throw new Error("SignalR is not connected");
		}

		try {
			await this.hubConnection!.invoke(
				HUB_METHODS.SUBSCRIBE_TO_SENSOR,
				sensorId
			);
			console.log(`Subscribed to sensor: ${sensorId}`);
		} catch (error) {
			console.error(`Failed to subscribe to sensor ${sensorId}:`, error);
			throw error;
		}
	}

	public async unsubscribeFromSensor(sensorId: string): Promise<void> {
		if (!this.isConnected()) {
			throw new Error("SignalR is not connected");
		}

		try {
			await this.hubConnection!.invoke(
				HUB_METHODS.UNSUBSCRIBE_FROM_SENSOR,
				sensorId
			);
			console.log(`Unsubscribed from sensor: ${sensorId}`);
		} catch (error) {
			console.error(`Failed to unsubscribe from sensor ${sensorId}:`, error);
			throw error;
		}
	}

	public async getActiveSensors(): Promise<string[]> {
		if (!this.isConnected()) {
			throw new Error("SignalR is not connected");
		}

		try {
			const sensors = await this.hubConnection!.invoke<string[]>(
				HUB_METHODS.GET_ACTIVE_SENSORS
			);
			return sensors;
		} catch (error) {
			console.error("Failed to get active sensors:", error);
			throw error;
		}
	}

	// New methods for our sensor dashboard
	public async connect(): Promise<void> {
		await this.initialize();
	}

	public onSensorReading(callback: (reading: SensorReading) => void): void {
		this.on(HUB_METHODS.RECEIVE_SENSOR_READING, callback);
	}

	public onStatisticsUpdate(callback: (stats: SensorStatistics) => void): void {
		this.on(HUB_METHODS.RECEIVE_STATISTICS_UPDATE, callback);
	}

	public onAnomalyAlert(callback: (alert: AnomalyAlert) => void): void {
		this.on(HUB_METHODS.RECEIVE_ANOMALY_ALERT, callback);
	}

	public onInitialStatistics(
		callback: (stats: Record<string, SensorStatistics>) => void
	): void {
		this.on(HUB_METHODS.RECEIVE_INITIAL_STATISTICS, callback);
	}

	public onRecentAlerts(callback: (alerts: AnomalyAlert[]) => void): void {
		this.on(HUB_METHODS.RECEIVE_RECENT_ALERTS, callback);
	}

	public onConnectionStateChanged(callback: (connected: boolean) => void): void {
		this.on("connectionStateChanged", callback);
	}

	public async subscribeToSensorType(sensorType: SensorType): Promise<void> {
		// Wait a moment for connection to stabilize if just connected
		if (this.hubConnection?.state === HubConnectionState.Connecting) {
			await new Promise(resolve => setTimeout(resolve, 500));
		}

		if (!this.isConnected() || !this.hubConnection) {
			console.warn("SignalR is not connected, skipping subscription");
			return;
		}

		try {
			// Convert string enum to numeric value for backend
			const sensorTypeValue = this.getSensorTypeValue(sensorType);
			await this.hubConnection.invoke(
				"SubscribeToSensorType",
				sensorTypeValue
			);
			console.log(`Subscribed to sensor type: ${sensorType} (${sensorTypeValue})`);
		} catch (error) {
			console.error(`Failed to subscribe to sensor type ${sensorType}:`, error);
			throw error;
		}
	}

	public async unsubscribeFromSensorType(
		sensorType: SensorType
	): Promise<void> {
		if (!this.isConnected()) {
			throw new Error("SignalR is not connected");
		}

		try {
			// Convert string enum to numeric value for backend
			const sensorTypeValue = this.getSensorTypeValue(sensorType);
			await this.hubConnection!.invoke(
				"UnsubscribeFromSensorType",
				sensorTypeValue
			);
			console.log(`Unsubscribed from sensor type: ${sensorType} (${sensorTypeValue})`);
		} catch (error) {
			console.error(
				`Failed to unsubscribe from sensor type ${sensorType}:`,
				error
			);
			throw error;
		}
	}

	public async getHistoricalData(
		sensorType: SensorType,
		count: number = 100
	): Promise<void> {
		if (!this.isConnected()) {
			throw new Error("SignalR is not connected");
		}

		try {
			// Use GetRecentReadings method from backend
			await this.hubConnection!.invoke(
				"GetRecentReadings",
				count
			);
		} catch (error) {
			console.error("Failed to get historical data:", error);
			throw error;
		}
	}

	public async getStatistics(_sensorType?: SensorType): Promise<void> {
		if (!this.isConnected()) {
			throw new Error("SignalR is not connected");
		}

		try {
			// Backend expects sensorId, not type - for now, get all stats
			await this.hubConnection!.invoke("GetRecentReadings", 100);
		} catch (error) {
			console.error("Failed to get statistics:", error);
			throw error;
		}
	}

	public async getRecentAlerts(count: number = 50): Promise<void> {
		if (!this.isConnected()) {
			throw new Error("SignalR is not connected");
		}

		try {
			await this.hubConnection!.invoke(HUB_METHODS.GET_RECENT_ALERTS, count);
		} catch (error) {
			console.error("Failed to get recent alerts:", error);
			throw error;
		}
	}

	public async requestHistoricalData(
		sensorId: string,
		startTime: Date,
		endTime: Date
	): Promise<void> {
		if (!this.isConnected()) {
			throw new Error("SignalR is not connected");
		}

		try {
			await this.hubConnection!.invoke(HUB_METHODS.REQUEST_HISTORICAL_DATA, {
				sensorId,
				startTime: startTime.toISOString(),
				endTime: endTime.toISOString(),
			});
		} catch (error) {
			console.error("Failed to request historical data:", error);
			throw error;
		}
	}

	public on<T = any>(event: string, handler: SignalREventHandler<T>): void {
		if (!this.eventHandlers.has(event)) {
			this.eventHandlers.set(event, new Set());
		}
		this.eventHandlers.get(event)!.add(handler);
	}

	public off<T = any>(event: string, handler: SignalREventHandler<T>): void {
		const handlers = this.eventHandlers.get(event);
		if (handlers) {
			handlers.delete(handler);
			if (handlers.size === 0) {
				this.eventHandlers.delete(event);
			}
		}
	}

	private emit(event: string, data: any): void {
		const handlers = this.eventHandlers.get(event);
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(data);
				} catch (error) {
					console.error(`Error in event handler for ${event}:`, error);
				}
			});
		}
	}

	private notifyStatusChange(): void {
		this.emit("connectionStatusChanged", this.connectionStatus);
		this.emit("connectionStateChanged", this.isConnected());
	}

	public isConnected(): boolean {
		return this.hubConnection?.state === HubConnectionState.Connected;
	}

	public getConnectionState(): HubConnectionState | null {
		return this.hubConnection?.state ?? null;
	}

	public getConnectionStatus(): ConnectionStatus {
		return this.connectionStatus;
	}

	public getConnection(): HubConnection | null {
		return this.hubConnection;
	}

	// Helper method to convert SensorType string enum to backend numeric value
	private getSensorTypeValue(sensorType: SensorType): number {
		const mapping: Record<SensorType, number> = {
			[SensorType.Temperature]: 1,
			[SensorType.Humidity]: 2,
			[SensorType.CO2]: 3,
			[SensorType.Occupancy]: 4,
			[SensorType.PowerConsumption]: 5
		};
		return mapping[sensorType];
	}
}
