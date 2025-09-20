import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';
import { SensorType, SENSOR_CONFIG, type SensorStatistics } from '../../types/sensor.types';

interface StatisticsCardProps {
  sensorType: SensorType;
  statistics?: SensorStatistics;
  isActive: boolean;
  additionalInfo?: {
    trend: '→' | '↑' | '↓';
    anomalyCount: number;
    sensorCount: number;
  };
}

const StatisticsCard: React.FC<StatisticsCardProps> = ({ sensorType, statistics, isActive, additionalInfo }) => {
  const config = SENSOR_CONFIG[sensorType];
  const current = statistics?.current ?? 0;
  const min = statistics?.min ?? config.min;
  const max = statistics?.max ?? config.max;
  const average = statistics?.average ?? 0;

  const getTrendIcon = () => {
    // Use server-provided trend if available
    if (additionalInfo?.trend) {
      switch (additionalInfo.trend) {
        case '↑':
          return <TrendingUp className="h-4 w-4 text-green-400" />;
        case '↓':
          return <TrendingDown className="h-4 w-4 text-blue-400" />;
        default:
          return <Minus className="h-4 w-4 text-gray-400" />;
      }
    }

    if (!statistics || statistics.count < 2) return <Minus className="h-4 w-4 text-gray-500" />;

    const diff = current - average;
    const threshold = (max - min) * 0.1;

    if (Math.abs(diff) < threshold) {
      return <Minus className="h-4 w-4 text-gray-400" />;
    } else if (diff > 0) {
      return <TrendingUp className="h-4 w-4 text-green-400" />;
    } else {
      return <TrendingDown className="h-4 w-4 text-blue-400" />;
    }
  };

  const getStatusColor = () => {
    if (!statistics) return 'bg-gray-600';

    const range = config.max - config.min;
    const position = ((current - config.min) / range) * 100;

    if (position < 20 || position > 80) return 'bg-red-500';
    if (position < 30 || position > 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div
      className={clsx(
        'relative rounded-xl p-4 border transition-all duration-300',
        isActive
          ? 'bg-gray-800/50 backdrop-blur-xl border-gray-700 shadow-xl'
          : 'bg-gray-800/30 border-gray-800 opacity-60'
      )}
    >
      {/* Status Indicator */}
      <div className={clsx(
        'absolute top-2 right-2 h-2 w-2 rounded-full animate-pulse',
        isActive ? getStatusColor() : 'bg-gray-600'
      )} />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-xl">{config.icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-gray-300">
              {config.label}
            </h3>
            {additionalInfo && (
              <div className="text-xs text-gray-500">
                {additionalInfo.sensorCount} sensors
              </div>
            )}
          </div>
        </div>
        {getTrendIcon()}
      </div>

      {/* Current Value */}
      <div className="mb-3">
        <div className="text-2xl font-bold text-white">
          {current.toFixed(1)}
          <span className="text-sm font-normal text-gray-400 ml-1">
            {config.unit}
          </span>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-gray-500">Min</div>
          <div className="text-gray-300 font-medium">
            {min.toFixed(1)}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Avg</div>
          <div className="text-gray-300 font-medium">
            {average.toFixed(1)}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Max</div>
          <div className="text-gray-300 font-medium">
            {max.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Anomaly Count if available */}
      {additionalInfo && additionalInfo.anomalyCount > 0 && (
        <div className="mt-2 text-xs">
          <span className="text-yellow-400 font-medium">
            {additionalInfo.anomalyCount} anomalies detected
          </span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mt-3">
        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full transition-all duration-500',
              isActive ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-gray-600'
            )}
            style={{
              width: `${Math.min(100, Math.max(0, ((current - config.min) / (config.max - config.min)) * 100))}%`
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default StatisticsCard;