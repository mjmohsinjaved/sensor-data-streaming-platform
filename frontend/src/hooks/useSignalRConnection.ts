import { useEffect, useState } from "react";
import { useSignalR } from "../contexts/SignalRContext";
import type { ConnectionStatus } from "@/types/signalr.types";

interface UseSignalRConnectionOptions {
	autoReconnect?: boolean;
	onConnected?: () => void;
	onDisconnected?: () => void;
	onReconnecting?: () => void;
}

export const useSignalRConnection = (
	options: UseSignalRConnectionOptions = {}
) => {
	const {
		autoReconnect = true,
		onConnected,
		onDisconnected,
		onReconnecting,
	} = options;

	const { connectionStatus, connectionState, connect, disconnect } =
		useSignalR();
	const [previousStatus, setPreviousStatus] =
		useState<ConnectionStatus>(connectionStatus);

	useEffect(() => {
		if (connectionStatus !== previousStatus) {
			setPreviousStatus(connectionStatus);

			switch (connectionStatus) {
				case "connected":
					onConnected?.();
					break;
				case "disconnected":
					onDisconnected?.();
					if (autoReconnect && !connectionState.isConnecting) {
						connect();
					}
					break;
				case "reconnecting":
					onReconnecting?.();
					break;
			}
		}
	}, [
		connectionStatus,
		previousStatus,
		connectionState.isConnecting,
		autoReconnect,
		connect,
		onConnected,
		onDisconnected,
		onReconnecting,
	]);

	return {
		isConnected: connectionState.isConnected,
		isConnecting: connectionState.isConnecting,
		connectionError: connectionState.error,
		connectionStatus,
		connect,
		disconnect,
	};
};
