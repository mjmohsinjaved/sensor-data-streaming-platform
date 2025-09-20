using System;
using System.Linq;
using SmartBuildingAPI.Models;
using SmartBuildingAPI.Endpoints;

namespace SmartBuildingAPI.Services
{
    public class AggregationService : IAggregationService
    {
        private readonly ISensorDataStore _dataStore;

        public AggregationService(ISensorDataStore dataStore)
        {
            _dataStore = dataStore;
        }

        public object CalculateAggregatedStatistics()
        {
            // Get last 1 second of data (at 1000/sec = 1000 readings)
            var lastSecondReadings = _dataStore.GetRecent(1000);
            // Get previous 1 second for trend comparison
            var twoSecondsReadings = _dataStore.GetRecent(2000);

            if (lastSecondReadings.Length == 0)
            {
                return new
                {
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    message = "No data available",
                    aggregated = Array.Empty<object>()
                };
            }

            // Split for trend comparison: last 1 second vs previous 1 second
            var previousSecondReadings = twoSecondsReadings.Skip(1000).ToArray();

            // Group by sensor type
            var aggregatedStats = Enum.GetValues<SensorType>()
                .Select<SensorType, object>(sensorType =>
                {
                    // Get readings for this type from last second only
                    var typeReadings = lastSecondReadings.Where(r => GetSensorTypeFromId(r.SensorId) == sensorType).ToArray();
                    var previousTypeReadings = previousSecondReadings.Where(r => GetSensorTypeFromId(r.SensorId) == sensorType).ToArray();

                    if (typeReadings.Length == 0)
                    {
                        return new
                        {
                            type = sensorType.ToString(),
                            unit = SensorMetadata.GetUnit(sensorType),
                            average = 0f,
                            min = 0f,
                            max = 0f,
                            current = 0f,
                            trend = "no_data",
                            trendSymbol = "—",
                            anomalyCount = 0,
                            totalReadings = 0,
                            sensorCount = 0
                        };
                    }

                    // Calculate statistics
                    var values = typeReadings.Select(r => r.Value).ToArray();
                    var average = values.Average();
                    var min = values.Min();
                    var max = values.Max();
                    var current = typeReadings.First().Value; // Most recent

                    // Calculate trend (comparing last second vs previous second)
                    var trend = "stable";
                    var trendSymbol = "→";

                    if (typeReadings.Length > 0 && previousTypeReadings.Length > 0)
                    {
                        var currentAvg = typeReadings.Average(r => r.Value);
                        var previousAvg = previousTypeReadings.Average(r => r.Value);
                        var percentChange = ((currentAvg - previousAvg) / previousAvg) * 100;

                        if (percentChange > 2)
                        {
                            trend = "increasing";
                            trendSymbol = "↑";
                        }
                        else if (percentChange < -2)
                        {
                            trend = "decreasing";
                            trendSymbol = "↓";
                        }
                    }

                    // Count anomalies
                    var anomalyCount = typeReadings.Count(r => r.IsAnomaly);

                    // Count unique sensors
                    var sensorCount = typeReadings.Select(r => r.SensorId).Distinct().Count();

                    return new
                    {
                        type = sensorType.ToString(),
                        unit = SensorMetadata.GetUnit(sensorType),
                        average = Math.Round(average, 2),
                        min = Math.Round(min, 2),
                        max = Math.Round(max, 2),
                        current = Math.Round(current, 2),
                        trend = trend,
                        trendSymbol = trendSymbol,
                        anomalyCount = anomalyCount,
                        totalReadings = typeReadings.Length,
                        sensorCount = sensorCount
                    };
                })
                .Where(stat => ((dynamic)stat).totalReadings > 0) // Only include types with data
                .ToArray();

            return new
            {
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                timeWindow = new
                {
                    seconds = 1,
                    trendComparison = "Last 1s vs Previous 1s"
                },
                aggregated = aggregatedStats
            };
        }

        // Helper method to determine sensor type from ID
        // Pattern: IDs 1-10: Temperature, 11-20: Humidity, 21-30: CO2, 31-40: Occupancy, 41-50: Power
        private static SensorType GetSensorTypeFromId(ushort sensorId)
        {
            if (sensorId <= 10) return SensorType.Temperature;
            if (sensorId <= 20) return SensorType.Humidity;
            if (sensorId <= 30) return SensorType.CO2;
            if (sensorId <= 40) return SensorType.Occupancy;
            return SensorType.PowerConsumption;
        }
    }
}