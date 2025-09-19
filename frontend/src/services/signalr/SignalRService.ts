import {
	HubConnection,
	HubConnectionBuilder,
	LogLevel,
	type IHttpConnectionOptions,
} from "@microsoft/signalr";
import { SIGNALR_CONFIG, HUB_METHODS } from "../../config/signalr.config";
import type {
	Alert,
	ConnectionStatus,
	SensorData,
} from "@/types/signalr.types";

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
			console.warn("SignalR connection already initialized");
			return;
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

		this.hubConnection.on(
			HUB_METHODS.RECEIVE_SENSOR_DATA,
			(data: SensorData) => {
				this.emit(HUB_METHODS.RECEIVE_SENSOR_DATA, data);
			}
		);

		this.hubConnection.on(HUB_METHODS.RECEIVE_ALERT, (alert: Alert) => {
			this.emit(HUB_METHODS.RECEIVE_ALERT, alert);
		});

		this.hubConnection.on(
			HUB_METHODS.RECEIVE_CONNECTION_UPDATE,
			(update: any) => {
				this.emit(HUB_METHODS.RECEIVE_CONNECTION_UPDATE, update);
			}
		);

		this.hubConnection.on(HUB_METHODS.RECEIVE_ERROR, (error: any) => {
			console.error("Received error from server:", error);
			this.emit(HUB_METHODS.RECEIVE_ERROR, error);
		});
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
	}

	public isConnected(): boolean {
		return this.connectionStatus === "connected";
	}

	public getConnectionStatus(): ConnectionStatus {
		return this.connectionStatus;
	}

	public getConnection(): HubConnection | null {
		return this.hubConnection;
	}
}
