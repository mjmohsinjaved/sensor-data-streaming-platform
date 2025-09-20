export enum SensorType {
  Temperature = 'Temperature',
  Humidity = 'Humidity',
  CO2 = 'CO2',
  Occupancy = 'Occupancy',
  PowerConsumption = 'PowerConsumption'
}

export enum AlertType {
  HVACFailure = 'HVACFailure',
  AbnormalEnergyUsage = 'AbnormalEnergyUsage',
  AirQualityIssue = 'AirQualityIssue',
  OccupancyAnomaly = 'OccupancyAnomaly'
}

export interface SensorReading {
  id: string;
  sensorId: string;
  value: number;
  timestamp: string;
  sensorType: SensorType;
}

export interface SensorStatistics {
  current: number;
  min: number;
  max: number;
  average: number;
  count: number;
  sensorType: SensorType;
  lastUpdated: string;
}

export interface AnomalyAlert {
  id: string;
  sensorId: string;
  value: number;
  threshold: number;
  timestamp: string;
  alertType: AlertType;
  message: string;
  sensorType: SensorType;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    tension: number;
    fill: boolean;
  }[];
}

export const SENSOR_CONFIG = {
  [SensorType.Temperature]: {
    label: 'Temperature',
    unit: '°C',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    icon: '🌡️',
    min: 18,
    max: 26
  },
  [SensorType.Humidity]: {
    label: 'Humidity',
    unit: '%',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    icon: '💧',
    min: 30,
    max: 70
  },
  [SensorType.CO2]: {
    label: 'CO2',
    unit: 'ppm',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    icon: '💨',
    min: 400,
    max: 1000
  },
  [SensorType.Occupancy]: {
    label: 'Occupancy',
    unit: 'people',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    icon: '👥',
    min: 0,
    max: 50
  },
  [SensorType.PowerConsumption]: {
    label: 'Power',
    unit: 'kW',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
    icon: '⚡',
    min: 10,
    max: 100
  }
};