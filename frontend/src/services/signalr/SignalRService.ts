import {
	HubConnection,
	HubConnectionBuilder,
	LogLevel,
	HubConnectionState,
	type IHttpConnectionOptions,
} from "@microsoft/signalr";
import { SIGNALR_CONFIG } from "../../config/signalr.config";
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

		// Register new aggregated events from backend
		// Handle aggregated statistics (sent every second)
		this.hubConnection.on(
			"ReceiveAggregatedStats",
			(data: any) => {
				console.log('Received aggregated stats:', data);
				this.emit('ReceiveAggregatedStats', data);
			}
		);

		// Handle performance statistics (sent every second)
		this.hubConnection.on(
			"ReceivePerformanceStats",
			(stats: any) => {
				console.log('Received performance stats:', stats);
				this.emit('ReceivePerformanceStats', stats);
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


	// New methods for our sensor dashboard
	public async connect(): Promise<void> {
		await this.initialize();
	}

	public onAggregatedStats(callback: (data: any) => void): void {
		this.on('ReceiveAggregatedStats', callback);
	}

	public onPerformanceStats(callback: (stats: any) => void): void {
		this.on('ReceivePerformanceStats', callback);
	}

	public onConnectionStateChanged(callback: (connected: boolean) => void): void {
		this.on("connectionStateChanged", callback);
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
}
