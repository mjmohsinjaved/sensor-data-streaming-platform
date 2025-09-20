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
import { type SensorReading, SensorType } from '../../types/sensor.types';

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

interface RealtimeChartProps {
  sensorType: SensorType;
  data: SensorReading[];
  config: {
    label: string;
    unit: string;
    color: string;
    bgColor: string;
    min: number;
    max: number;
  };
}

const RealtimeChart: React.FC<RealtimeChartProps> = ({ sensorType, data, config }) => {
  const chartRef = useRef<ChartJS<'line'>>(null);

  // Debug logging
  useEffect(() => {
    console.log(`Chart for ${sensorType} - Data points:`, data.length);
    if (data.length > 0) {
      console.log(`Latest value for ${sensorType}:`, data[data.length - 1]);
    }
  }, [data, sensorType]);

  // Prepare chart data - show empty chart if no data
  const chartData = {
    labels: data.length > 0
      ? data.map(d => format(new Date(d.timestamp), 'HH:mm:ss'))
      : [],
    datasets: [
      {
        label: `${config.label} (${config.unit})`,
        data: data.length > 0
          ? data.map(d => d.value)
          : [],
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
          label: (context) => {
            return `${config.label}: ${context.parsed.y.toFixed(2)} ${config.unit}`;
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
          callback: (value) => `${value} ${config.unit}`,
        },
      },
    },
  };

  // Update chart when data changes
  useEffect(() => {
    if (chartRef.current) {
      // Use 'none' mode for smooth updates without animation
      chartRef.current.update('none');
    }
  }, [data, chartData]);

  // Show loading state if no data
  if (data.length === 0) {
    return (
      <div className="h-64 w-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="mb-2 text-sm">Waiting for data...</div>
          <div className="text-xs text-gray-600">Data will appear once sensor readings are received</div>
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