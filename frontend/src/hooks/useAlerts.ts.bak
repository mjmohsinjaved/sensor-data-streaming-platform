import { useMemo, useCallback } from "react";
import { useSignalR } from "../contexts/SignalRContext";
import type { Alert } from "@/types/signalr.types";

interface UseAlertsOptions {
	filterBySensor?: string;
	filterBySeverity?: Alert["severity"][];
	filterUnacknowledged?: boolean;
	limit?: number;
}

export const useAlerts = (options: UseAlertsOptions = {}) => {
	const {
		filterBySensor,
		filterBySeverity,
		filterUnacknowledged = false,
		limit,
	} = options;

	const { alerts, acknowledgeAlert, clearAlerts } = useSignalR();

	const filteredAlerts = useMemo(() => {
		let filtered = [...alerts];

		if (filterBySensor) {
			filtered = filtered.filter((alert) => alert.sensorId === filterBySensor);
		}

		if (filterBySeverity && filterBySeverity.length > 0) {
			filtered = filtered.filter((alert) =>
				filterBySeverity.includes(alert.severity)
			);
		}

		if (filterUnacknowledged) {
			filtered = filtered.filter((alert) => !alert.acknowledged);
		}

		if (limit && limit > 0) {
			filtered = filtered.slice(0, limit);
		}

		return filtered;
	}, [alerts, filterBySensor, filterBySeverity, filterUnacknowledged, limit]);

	const unacknowledgedCount = useMemo(() => {
		return alerts.filter((alert) => !alert.acknowledged).length;
	}, [alerts]);

	const alertsBySeverity = useMemo(() => {
		const grouped: Record<Alert["severity"], number> = {
			info: 0,
			warning: 0,
			error: 0,
			critical: 0,
		};

		alerts.forEach((alert) => {
			grouped[alert.severity]++;
		});

		return grouped;
	}, [alerts]);

	const acknowledgeMultiple = useCallback(
		(alertIds: string[]) => {
			alertIds.forEach((id) => acknowledgeAlert(id));
		},
		[acknowledgeAlert]
	);

	const acknowledgeAll = useCallback(() => {
		const unacknowledgedIds = alerts
			.filter((alert) => !alert.acknowledged)
			.map((alert) => alert.id);
		acknowledgeMultiple(unacknowledgedIds);
	}, [alerts, acknowledgeMultiple]);

	return {
		alerts: filteredAlerts,
		totalAlerts: alerts.length,
		unacknowledgedCount,
		alertsBySeverity,
		acknowledgeAlert,
		acknowledgeMultiple,
		acknowledgeAll,
		clearAlerts,
	};
};
