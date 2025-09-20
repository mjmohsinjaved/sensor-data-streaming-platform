import { SensorType, type SensorReading, type SensorStatistics } from '../../types/sensor.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export interface ApiSensorReading {
  timestamp: number;
  sensorId: number;
  type: string;
  unit: string;
  floor: number;
  zone: number;
  value: number;
  isAnomaly: boolean;
}

export interface ApiSensorStatistics {
  sensorId: number;
  type: string;
  unit: string;
  min: number;
  max: number;
  average: number;
  current: number;
  count: number;
  lastUpdate: number;
}

export interface ApiStatsResponse {
  timestamp: number;
  totalReadings: number;
  sensorCount: number;
  statistics: ApiSensorStatistics[];
}

export interface ApiRecentResponse {
  timestamp: number;
  count: number;
  readings: ApiSensorReading[];
}

export interface ApiHealthResponse {
  status: string;
  totalReadings: number;
  activeSensors: number;
  timestamp: number;
}

export interface ApiPerformanceResponse {
  actualReadingsPerSecond: number;
  targetReadingsPerSecond: number;
  efficiency: number;
  totalReadings: number;
  runtimeSeconds: number;
  averageOverall: number;
  lastSecond: number;
  last60Seconds: number[];
  startTime: string;
  timestamp: string;
}

export class SensorApiService {
  private static instance: SensorApiService | null = null;

  private constructor() {}

  public static getInstance(): SensorApiService {
    if (!SensorApiService.instance) {
      SensorApiService.instance = new SensorApiService();
    }
    return SensorApiService.instance;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  // Get statistics for all sensors
  public async getAllStatistics(): Promise<ApiStatsResponse> {
    return this.fetchJson<ApiStatsResponse>(`${API_BASE_URL}/api/sensors/stats`);
  }

  // Get recent sensor readings
  public async getRecentReadings(count: number = 100): Promise<ApiRecentResponse> {
    return this.fetchJson<ApiRecentResponse>(`${API_BASE_URL}/api/sensors/recent?count=${count}`);
  }

  // Get statistics for a specific sensor
  public async getSensorStatistics(sensorId: number): Promise<ApiSensorStatistics> {
    return this.fetchJson<ApiSensorStatistics>(`${API_BASE_URL}/api/sensors/${sensorId}/stats`);
  }

  // Get current value for a specific sensor
  public async getCurrentValue(sensorId: number): Promise<{
    sensorId: number;
    type: string;
    value: number;
    timestamp: number;
    unit: string;
  }> {
    return this.fetchJson(`${API_BASE_URL}/api/sensors/${sensorId}/current`);
  }

  // Get readings by floor
  public async getFloorReadings(floor: number): Promise<{
    floor: number;
    count: number;
    readings: ApiSensorReading[];
  }> {
    return this.fetchJson(`${API_BASE_URL}/api/sensors/floor/${floor}`);
  }

  // Get available sensor types
  public async getSensorTypes(): Promise<{
    types: Array<{ name: string; unit: string }>;
    count: number;
  }> {
    return this.fetchJson(`${API_BASE_URL}/api/sensors/types`);
  }

  // Get readings by sensor type
  public async getTypeReadings(typeName: string): Promise<{
    type: string;
    count: number;
    unit: string;
    readings: ApiSensorReading[];
  }> {
    return this.fetchJson(`${API_BASE_URL}/api/sensors/type/${typeName}`);
  }

  // Health check
  public async getHealth(): Promise<ApiHealthResponse> {
    return this.fetchJson<ApiHealthResponse>(`${API_BASE_URL}/api/sensors/health`);
  }

  // Performance monitoring
  public async getPerformance(): Promise<ApiPerformanceResponse> {
    return this.fetchJson<ApiPerformanceResponse>(`${API_BASE_URL}/api/sensors/performance`);
  }

  // Reset performance counters
  public async resetPerformance(): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/sensors/performance/reset`, {
      method: 'POST'
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  // Transform API reading to frontend format
  public transformApiReading(apiReading: ApiSensorReading): SensorReading {
    const sensorTypeMap: Record<string, SensorType> = {
      'Temperature': SensorType.Temperature,
      'Humidity': SensorType.Humidity,
      'CO2': SensorType.CO2,
      'Occupancy': SensorType.Occupancy,
      'PowerConsumption': SensorType.PowerConsumption
    };

    return {
      id: `${apiReading.sensorId}_${apiReading.timestamp}`,
      sensorId: String(apiReading.sensorId),
      value: apiReading.value,
      timestamp: new Date(apiReading.timestamp).toISOString(),
      sensorType: sensorTypeMap[apiReading.type] || SensorType.Temperature
    };
  }

  // Transform API statistics to frontend format
  public transformApiStatistics(apiStats: ApiSensorStatistics): SensorStatistics {
    const sensorTypeMap: Record<string, SensorType> = {
      'Temperature': SensorType.Temperature,
      'Humidity': SensorType.Humidity,
      'CO2': SensorType.CO2,
      'Occupancy': SensorType.Occupancy,
      'PowerConsumption': SensorType.PowerConsumption
    };

    return {
      current: apiStats.current,
      min: apiStats.min,
      max: apiStats.max,
      average: apiStats.average,
      count: apiStats.count,
      sensorType: sensorTypeMap[apiStats.type] || SensorType.Temperature,
      lastUpdated: new Date(apiStats.lastUpdate).toISOString()
    };
  }

  // Get aggregated statistics by sensor type
  public async getStatisticsBySensorType(): Promise<Record<SensorType, SensorStatistics>> {
    const response = await this.getAllStatistics();
    const aggregated: Record<string, SensorStatistics> = {};

    // Group and aggregate statistics by sensor type
    response.statistics.forEach(stat => {
      const sensorType = this.transformApiStatistics(stat).sensorType;

      if (!aggregated[sensorType]) {
        aggregated[sensorType] = this.transformApiStatistics(stat);
      } else {
        // Aggregate multiple sensors of the same type
        const existing = aggregated[sensorType];
        aggregated[sensorType] = {
          ...existing,
          current: (existing.current + stat.current) / 2,
          min: Math.min(existing.min, stat.min),
          max: Math.max(existing.max, stat.max),
          average: (existing.average + stat.average) / 2,
          count: existing.count + stat.count
        };
      }
    });

    return aggregated as Record<SensorType, SensorStatistics>;
  }

  // Get recent readings grouped by sensor type
  public async getRecentReadingsBySensorType(count: number = 100): Promise<Record<SensorType, SensorReading[]>> {
    const response = await this.getRecentReadings(count);
    const grouped: Record<SensorType, SensorReading[]> = {
      [SensorType.Temperature]: [],
      [SensorType.Humidity]: [],
      [SensorType.CO2]: [],
      [SensorType.Occupancy]: [],
      [SensorType.PowerConsumption]: []
    };

    response.readings.forEach(reading => {
      const transformed = this.transformApiReading(reading);
      grouped[transformed.sensorType].push(transformed);
    });

    return grouped;
  }
}