import type { ChartOptions, TooltipItem } from 'chart.js';
import type { SensorReading, SensorType } from '../types/sensor.types';
import { SENSOR_CONFIG } from '../types/sensor.types';
import { formatTimestamp, formatSensorValueWithUnit } from './dataFormatters';

/**
 * Transform sensor readings to chart data format
 */
export const transformToChartData = (
  readings: SensorReading[],
  sensorType: SensorType,
  maxDataPoints: number = 50
) => {
  const config = SENSOR_CONFIG[sensorType];
  const limitedReadings = readings.slice(-maxDataPoints);

  return {
    labels: limitedReadings.map(r => formatTimestamp(r.timestamp, 'HH:mm:ss')),
    datasets: [{
      label: `${config.label} (${config.unit})`,
      data: limitedReadings.map(r => r.value),
      borderColor: config.color,
      backgroundColor: config.bgColor,
      tension: 0.4,
      fill: true,
      pointRadius: limitedReadings.length > 30 ? 0 : 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    }]
  };
};

/**
 * Get optimized chart options for real-time data
 */
export const getRealtimeChartOptions = (sensorType: SensorType): ChartOptions<'line'> => {
  const config = SENSOR_CONFIG[sensorType];

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 200,
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#f3f4f6',
        bodyColor: '#f3f4f6',
        borderColor: config.color,
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context: TooltipItem<'line'>) => {
            return formatSensorValueWithUnit(context.parsed.y, sensorType);
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false,
        },
        ticks: {
          color: '#9ca3af',
          maxRotation: 0,
          autoSkipPadding: 20,
        },
      },
      y: {
        display: true,
        min: config.min * 0.9,
        max: config.max * 1.1,
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
        },
        ticks: {
          color: '#9ca3af',
          callback: (value: any) => `${value} ${config.unit}`,
        },
      },
    },
  };
};

/**
 * Apply data windowing to limit the number of data points
 */
export const applyDataWindow = <T>(
  data: T[],
  windowSize: number,
  samplingRate: number = 1
): T[] => {
  if (data.length <= windowSize) {
    return data;
  }

  // If we have too much data, sample it
  if (samplingRate > 1) {
    const sampled: T[] = [];
    for (let i = data.length - 1; i >= 0; i -= samplingRate) {
      sampled.unshift(data[i]);
      if (sampled.length >= windowSize) break;
    }
    return sampled;
  }

  // Otherwise just take the most recent data points
  return data.slice(-windowSize);
};

/**
 * Calculate moving average for smoothing data
 */
export const calculateMovingAverage = (
  data: number[],
  windowSize: number = 5
): number[] => {
  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = data.slice(start, i + 1);
    const average = window.reduce((sum, val) => sum + val, 0) / window.length;
    result.push(average);
  }

  return result;
};

/**
 * Detect trend in data points
 */
export const detectTrend = (data: number[], threshold: number = 0.01): 'increasing' | 'decreasing' | 'stable' => {
  if (data.length < 2) return 'stable';

  const recentData = data.slice(-10); // Look at last 10 points
  const firstHalf = recentData.slice(0, Math.floor(recentData.length / 2));
  const secondHalf = recentData.slice(Math.floor(recentData.length / 2));

  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

  const percentChange = (secondAvg - firstAvg) / firstAvg;

  if (Math.abs(percentChange) < threshold) {
    return 'stable';
  }
  return percentChange > 0 ? 'increasing' : 'decreasing';
};

/**
 * Generate gradient for chart background
 */
export const createChartGradient = (
  ctx: CanvasRenderingContext2D,
  color: string,
  height: number
): CanvasGradient => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, color.replace('0.1', '0.3'));
  gradient.addColorStop(0.5, color.replace('0.1', '0.2'));
  gradient.addColorStop(1, color.replace('0.1', '0.05'));
  return gradient;
};