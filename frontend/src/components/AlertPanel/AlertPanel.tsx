import React from 'react';
import { AlertTriangle, AlertCircle, XCircle, Trash2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { type AnomalyAlert, AlertType, SENSOR_CONFIG } from '../../types/sensor.types';

interface AlertPanelProps {
  alerts: AnomalyAlert[];
  onClear: () => void;
}

const AlertPanel: React.FC<AlertPanelProps> = ({ alerts, onClear }) => {
  const getAlertIcon = (alertType: AlertType) => {
    switch (alertType) {
      case AlertType.HVACFailure:
      case AlertType.AbnormalEnergyUsage:
        return <XCircle className="h-4 w-4 text-red-400" />;
      case AlertType.AirQualityIssue:
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case AlertType.OccupancyAnomaly:
        return <AlertCircle className="h-4 w-4 text-orange-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-blue-400" />;
    }
  };

  const getAlertColor = (alertType: AlertType) => {
    switch (alertType) {
      case AlertType.HVACFailure:
      case AlertType.AbnormalEnergyUsage:
        return 'border-red-500/30 bg-red-500/5';
      case AlertType.AirQualityIssue:
        return 'border-yellow-500/30 bg-yellow-500/5';
      case AlertType.OccupancyAnomaly:
        return 'border-orange-500/30 bg-orange-500/5';
      default:
        return 'border-blue-500/30 bg-blue-500/5';
    }
  };

  const formatAlertType = (alertType: AlertType) => {
    switch (alertType) {
      case AlertType.HVACFailure:
        return 'HVAC Failure';
      case AlertType.AbnormalEnergyUsage:
        return 'Energy Anomaly';
      case AlertType.AirQualityIssue:
        return 'Air Quality';
      case AlertType.OccupancyAnomaly:
        return 'Occupancy';
      default:
        return alertType;
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <AlertCircle className="h-12 w-12 mb-3 text-gray-700" />
        <p className="text-sm">No active alerts</p>
        <p className="text-xs mt-1">System operating normally</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Clear All Button */}
      {alerts.length > 0 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={onClear}
            className="flex items-center space-x-1 text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            <span>Clear All</span>
          </button>
        </div>
      )}

      {/* Alert List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {alerts.map((alert) => {
          // Skip rendering if sensorType is undefined or config is not found
          if (!alert.sensorType || !SENSOR_CONFIG[alert.sensorType]) {
            return null;
          }

          const config = SENSOR_CONFIG[alert.sensorType];

          return (
            <div
              key={alert.id}
              className={clsx(
                'p-3 rounded-lg border transition-all duration-300 hover:shadow-lg',
                getAlertColor(alert.alertType)
              )}
            >
              {/* Alert Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getAlertIcon(alert.alertType)}
                  <span className="text-xs font-semibold text-gray-300">
                    {formatAlertType(alert.alertType)}
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">
                    {format(new Date(alert.timestamp), 'HH:mm:ss')}
                  </span>
                </div>
              </div>

              {/* Alert Details */}
              <div className="space-y-1">
                <p className="text-sm text-gray-300">
                  {alert.message}
                </p>
                <div className="flex items-center space-x-3 text-xs text-gray-500">
                  <span className="flex items-center space-x-1">
                    <span>{config.icon}</span>
                    <span>{config.label}</span>
                  </span>
                  <span>•</span>
                  <span>
                    Value: {alert.value.toFixed(1)} {config.unit}
                  </span>
                  <span>•</span>
                  <span>
                    Threshold: {alert.threshold.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert Count Summary */}
      {alerts.length > 5 && (
        <div className="pt-2 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            Showing {Math.min(50, alerts.length)} of {alerts.length} alerts
          </p>
        </div>
      )}
    </div>
  );
};

export default AlertPanel;