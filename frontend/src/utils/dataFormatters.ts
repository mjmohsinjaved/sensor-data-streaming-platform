import { format, parseISO } from 'date-fns';
import type { SensorReading, SensorStatistics, AnomalyAlert, SensorType } from '../types/sensor.types';
import { SENSOR_CONFIG } from '../types/sensor.types';

/**
 * Format a numeric value with appropriate decimal places based on sensor type
 */
export const formatSensorValue = (value: number, sensorType: SensorType): string => {
  const config = SENSOR_CONFIG[sensorType];

  switch (sensorType) {
    case 'Temperature':
    case 'Humidity':
    case 'PowerConsumption':
      return value.toFixed(1);
    case 'CO2':
    case 'Occupancy':
      return value.toFixed(0);
    default:
      return value.toFixed(2);
  }
};

/**
 * Format a sensor value with its unit
 */
export const formatSensorValueWithUnit = (value: number, sensorType: SensorType): string => {
  const config = SENSOR_CONFIG[sensorType];
  const formattedValue = formatSensorValue(value, sensorType);
  return `${formattedValue} ${config.unit}`;
};

/**
 * Format timestamp for display
 */
export const formatTimestamp = (timestamp: string, formatString: string = 'HH:mm:ss'): string => {
  try {
    const date = typeof timestamp === 'string' ? parseISO(timestamp) : new Date(timestamp);
    return format(date, formatString);
  } catch {
    return timestamp;
  }
};

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export const formatRelativeTime = (timestamp: string): string => {
  const date = typeof timestamp === 'string' ? parseISO(timestamp) : new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m ago`;
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h ago`;
  } else {
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  }
};

/**
 * Get sensor status based on current value and thresholds
 */
export const getSensorStatus = (value: number, sensorType: SensorType): 'normal' | 'warning' | 'critical' => {
  const config = SENSOR_CONFIG[sensorType];
  const range = config.max - config.min;
  const position = ((value - config.min) / range) * 100;

  if (value < config.min || value > config.max) {
    return 'critical';
  } else if (position < 20 || position > 80) {
    return 'warning';
  }
  return 'normal';
};

/**
 * Calculate percentage within sensor range
 */
export const calculateRangePercentage = (value: number, sensorType: SensorType): number => {
  const config = SENSOR_CONFIG[sensorType];
  const percentage = ((value - config.min) / (config.max - config.min)) * 100;
  return Math.min(100, Math.max(0, percentage));
};

/**
 * Format large numbers with abbreviations (e.g., 1.2k, 3.4M)
 */
export const formatLargeNumber = (num: number): string => {
  if (num < 1000) return num.toString();
  if (num < 1000000) return `${(num / 1000).toFixed(1)}k`;
  if (num < 1000000000) return `${(num / 1000000).toFixed(1)}M`;
  return `${(num / 1000000000).toFixed(1)}B`;
};

/**
 * Get trend direction based on current and average values
 */
export const getTrendDirection = (current: number, average: number, threshold: number = 0.1): 'up' | 'down' | 'stable' => {
  const diff = current - average;
  const percentDiff = Math.abs(diff / average);

  if (percentDiff < threshold) {
    return 'stable';
  }
  return diff > 0 ? 'up' : 'down';
};