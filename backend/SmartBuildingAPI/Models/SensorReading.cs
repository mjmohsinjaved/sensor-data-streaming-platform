using System;

namespace SmartBuildingAPI.Models
{
    // Compact struct - 24 bytes total (optimal for CPU cache)
    public readonly struct SensorReading
    {
        public long Timestamp { get; }    // 8 bytes - Unix milliseconds
        public ushort SensorId { get; }   // 2 bytes - numeric ID (supports 65k sensors)
        public SensorType Type { get; }   // 1 byte  - enum
        public byte Floor { get; }        // 1 byte  - floor number (1-255)
        public byte Zone { get; }         // 1 byte  - zone number (1-255)
        public float Value { get; }       // 4 bytes - sufficient precision
        public bool IsAnomaly { get; }    // 1 byte
        // Total: ~18 bytes, padded to 24

        public SensorReading(ushort sensorId, float value, SensorType type, byte floor, byte zone)
        {
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            SensorId = sensorId;
            Value = value;
            Type = type;
            Floor = floor;
            Zone = zone;
            IsAnomaly = DetectAnomaly(type, value);
        }

        // Overloaded constructor that accepts anomaly flag
        public SensorReading(ushort sensorId, float value, SensorType type, byte floor, byte zone, bool isAnomaly)
        {
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            SensorId = sensorId;
            Value = value;
            Type = type;
            Floor = floor;
            Zone = zone;
            IsAnomaly = isAnomaly;
        }

        private static bool DetectAnomaly(SensorType type, float value)
        {
            return type switch
            {
                SensorType.Temperature => value < -10 || value > 50,
                SensorType.Humidity => value < 0 || value > 100,
                SensorType.CO2 => value > 2000,
                SensorType.Occupancy => value < 0,
                SensorType.PowerConsumption => value < 0 || value > 10000,
                _ => false
            };
        }
    }

    public enum SensorType : byte
    {
        Temperature = 1,
        Humidity = 2,
        CO2 = 3,
        Occupancy = 4,
        PowerConsumption = 5
    }

    // Metadata stored separately to avoid duplication
    public class SensorMetadata
    {
        public ushort SensorId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
        public SensorType Type { get; set; }

        public static string GetUnit(SensorType type) => type switch
        {
            SensorType.Temperature => "°C",
            SensorType.Humidity => "%",
            SensorType.CO2 => "ppm",
            SensorType.Occupancy => "people",
            SensorType.PowerConsumption => "kW",
            _ => "units"
        };
    }

    public class SensorStatistics
    {
        public ushort SensorId { get; set; }
        public float Min { get; set; }
        public float Max { get; set; }
        public float Average { get; set; }
        public float Current { get; set; }
        public int Count { get; set; }
        public long LastUpdate { get; set; }
    }
}