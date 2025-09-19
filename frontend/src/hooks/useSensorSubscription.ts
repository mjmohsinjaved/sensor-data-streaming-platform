import { useEffect, useState, useCallback } from "react";
import { useSignalR } from "../contexts/SignalRContext";
import type { SensorData } from "@/types/signalr.types";

interface UseSensorSubscriptionOptions {
	autoSubscribe?: boolean;
	onDataReceived?: (data: SensorData) => void;
	onError?: (error: Error) => void;
}

export const useSensorSubscription = (
	sensorId: string | null,
	options: UseSensorSubscriptionOptions = {}
) => {
	const { autoSubscribe = true, onDataReceived, onError } = options;

	const {
		connectionState,
		sensorData,
		subscribedSensors,
		subscribeToSensor,
		unsubscribeFromSensor,
	} = useSignalR();

	const [isSubscribed, setIsSubscribed] = useState(false);
	const [isSubscribing, setIsSubscribing] = useState(false);
	const [subscriptionError, setSubscriptionError] = useState<string | null>(
		null
	);
	const [latestData, setLatestData] = useState<SensorData | null>(null);

	const subscribe = useCallback(async () => {
		if (!sensorId || !connectionState.isConnected || isSubscribed) return;

		setIsSubscribing(true);
		setSubscriptionError(null);

		try {
			await subscribeToSensor(sensorId);
			setIsSubscribed(true);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to subscribe";
			setSubscriptionError(errorMessage);
			onError?.(new Error(errorMessage));
		} finally {
			setIsSubscribing(false);
		}
	}, [
		sensorId,
		connectionState.isConnected,
		isSubscribed,
		subscribeToSensor,
		onError,
	]);

	const unsubscribe = useCallback(async () => {
		if (!sensorId || !isSubscribed) return;

		try {
			await unsubscribeFromSensor(sensorId);
			setIsSubscribed(false);
			setLatestData(null);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to unsubscribe";
			setSubscriptionError(errorMessage);
			onError?.(new Error(errorMessage));
		}
	}, [sensorId, isSubscribed, unsubscribeFromSensor, onError]);

	useEffect(() => {
		if (sensorId && subscribedSensors.has(sensorId)) {
			setIsSubscribed(true);
		} else {
			setIsSubscribed(false);
		}
	}, [sensorId, subscribedSensors]);

	useEffect(() => {
		if (
			sensorId &&
			connectionState.isConnected &&
			autoSubscribe &&
			!isSubscribed
		) {
			subscribe();
		}

		return () => {
			if (sensorId && isSubscribed && autoSubscribe) {
				unsubscribe();
			}
		};
	}, [sensorId, connectionState.isConnected, autoSubscribe]);

	useEffect(() => {
		if (sensorId && isSubscribed) {
			const data = sensorData.get(sensorId);
			if (data) {
				setLatestData(data);
				onDataReceived?.(data);
			}
		}
	}, [sensorId, isSubscribed, sensorData, onDataReceived]);

	return {
		isSubscribed,
		isSubscribing,
		subscriptionError,
		latestData,
		subscribe,
		unsubscribe,
	};
};
