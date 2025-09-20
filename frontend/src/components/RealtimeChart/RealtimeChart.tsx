import React, { useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js';
import { format } from 'date-fns';
import { SensorType } from '../../types/sensor.types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartDataPoint {
  timestamp: number;
  value: number;
  min: number;
  max: number;
  average: number;
}

interface RealtimeChartProps {
  sensorType: SensorType;
  data: ChartDataPoint[];
  config: {
    label: string;
    unit: string;
    color: string;
    bgColor: string;
    min: number;
    max: number;
  };
  isAggregated?: boolean;
}

const RealtimeChart: React.FC<RealtimeChartProps> = ({
  sensorType,
  data,
  config,
  isAggregated = false
}) => {
  const chartRef = useRef<ChartJS<'line'>>(null);

  // Debug logging
  useEffect(() => {
    console.log(`Chart for ${sensorType} - Data points:`, data.length);
    if (data.length > 0) {
      console.log(`Latest value for ${sensorType}:`, data[data.length - 1]);
    }
  }, [data, sensorType]);

  // Prepare chart data for aggregated data
  const chartData = {
    labels: data.length > 0
      ? data.map(d => format(new Date(d.timestamp), 'HH:mm:ss'))
      : [],
    datasets: isAggregated ? [
      {
        label: `Current ${config.label} (${config.unit})`,
        data: data.map(d => d.value),
        borderColor: config.color,
        backgroundColor: 'transparent',
        tension: 0.4,
        fill: false,
        pointRadius: data.length > 50 ? 0 : 2,
        pointHoverRadius: 4,
        borderWidth: 2,
      },
      {
        label: `Average ${config.label} (${config.unit})`,
        data: data.map(d => d.average),
        borderColor: `${config.color}88`,
        backgroundColor: 'transparent',
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 3,
        borderWidth: 1,
        borderDash: [5, 5],
      },
      {
        label: `Min/Max Range`,
        data: data.map(d => d.max),
        borderColor: 'transparent',
        backgroundColor: `${config.bgColor}`,
        tension: 0.4,
        fill: '+1',
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 0,
      },
      {
        label: `Min`,
        data: data.map(d => d.min),
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 0,
      },
    ] : [
      {
        label: `${config.label} (${config.unit})`,
        data: data.map(d => d.value),
        borderColor: config.color,
        backgroundColor: config.bgColor,
        tension: 0.4,
        fill: true,
        pointRadius: data.length > 30 ? 0 : 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 200,
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: isAggregated,
        position: 'top',
        labels: {
          color: '#9ca3af',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 15,
          filter: (item) => {
            // Only show Current and Average in legend
            return item.text.includes('Current') || item.text.includes('Average');
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#f3f4f6',
        bodyColor: '#f3f4f6',
        borderColor: config.color,
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          title: (context) => {
            const timestamp = data[context[0].dataIndex]?.timestamp;
            return timestamp ? format(new Date(timestamp), 'HH:mm:ss') : '';
          },
          label: (context) => {
            if (isAggregated) {
              const point = data[context.dataIndex];
              if (!point) return '';

              if (context.datasetIndex === 0) {
                return `Current: ${point.value.toFixed(2)} ${config.unit}`;
              } else if (context.datasetIndex === 1) {
                return `Average: ${point.average.toFixed(2)} ${config.unit}`;
              } else if (context.datasetIndex === 2) {
                return `Range: ${point.min.toFixed(2)} - ${point.max.toFixed(2)} ${config.unit}`;
              }
              return '';
            } else {
              return `${config.label}: ${context.parsed.y.toFixed(2)} ${config.unit}`;
            }
          },
        },
        filter: (item) => {
          // Only show relevant tooltips
          return item.datasetIndex < 3;
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
          maxTicksLimit: 10,
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
          callback: (value) => `${value} ${config.unit}`,
        },
      },
    },
  };

  // Update chart when data changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update('none');
    }
  }, [data, chartData]);

  // Show loading state if no data
  if (data.length === 0) {
    return (
      <div className="h-64 w-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="mb-2 text-sm">Waiting for aggregated data...</div>
          <div className="text-xs text-gray-600">
            Data will appear once sensor readings are received
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
};

export default RealtimeChart;