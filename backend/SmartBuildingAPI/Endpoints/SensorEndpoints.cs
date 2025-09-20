using Microsoft.AspNetCore.Mvc;
using SmartBuildingAPI.Models;
using SmartBuildingAPI.Services;

namespace SmartBuildingAPI.Endpoints
{
    public static class SensorEndpoints
    {
        public static void MapSensorEndpoints(this WebApplication app)
        {
            var sensors = app.MapGroup("/api/sensors")
                .WithTags("Sensors");

            // Get current statistics for all sensors
            sensors.MapGet("/stats", (ISensorDataStore dataStore) =>
            {
                var stats = dataStore.GetAllStatistics();

                // Enhance statistics with type and unit information
                var enhancedStats = stats.Select(s =>
                {
                    // Determine sensor type based on ID pattern:
                    // IDs 1-10: Temperature, 11-20: Humidity, 21-30: CO2, 31-40: Occupancy, 41-50: Power
                    var sensorType = GetSensorTypeFromId(s.SensorId);

                    return new
                    {
                        sensorId = s.SensorId,
                        type = sensorType.ToString(),
                        unit = SensorMetadata.GetUnit(sensorType),
                        min = s.Min,
                        max = s.Max,
                        average = s.Average,
                        current = s.Current,
                        count = s.Count,
                        lastUpdate = s.LastUpdate
                    };
                }).ToArray();

                return Results.Ok(new
                {
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    totalReadings = dataStore.GetTotalReadings(),
                    sensorCount = stats.Length,
                    statistics = enhancedStats
                });
            })
            .WithName("GetAllStatistics")
            .WithSummary("Get statistics for all sensors");

            // Get recent readings
            sensors.MapGet("/recent", (ISensorDataStore dataStore, [FromQuery] int count = 100) =>
            {
                if (count <= 0 || count > 1000)
                {
                    return Results.BadRequest("Count must be between 1 and 1000");
                }

                var readings = dataStore.GetRecent(count);

                // Transform readings to include string type names and units
                var enhancedReadings = readings.Select(r =>
                {
                    var sensorType = GetSensorTypeFromId(r.SensorId);
                    return new
                    {
                        timestamp = r.Timestamp,
                        sensorId = r.SensorId,
                        type = sensorType.ToString(),
                        unit = SensorMetadata.GetUnit(sensorType),
                        floor = r.Floor,
                        zone = r.Zone,
                        value = r.Value,
                        isAnomaly = r.IsAnomaly
                    };
                }).ToArray();

                return Results.Ok(new
                {
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    count = enhancedReadings.Length,
                    readings = enhancedReadings
                });
            })
            .WithName("GetRecentReadings")
            .WithSummary("Get recent sensor readings");

            // Get statistics for specific sensor
            sensors.MapGet("/{sensorId}/stats", (ISensorDataStore dataStore, ushort sensorId) =>
            {
                var stats = dataStore.GetStatistics(sensorId);
                if (stats.Count == 0)
                {
                    return Results.NotFound($"No data found for sensor {sensorId}");
                }

                var sensorType = GetSensorTypeFromId(sensorId);

                return Results.Ok(new
                {
                    sensorId = stats.SensorId,
                    type = sensorType.ToString(),
                    unit = SensorMetadata.GetUnit(sensorType),
                    min = stats.Min,
                    max = stats.Max,
                    average = stats.Average,
                    current = stats.Current,
                    count = stats.Count,
                    lastUpdate = stats.LastUpdate
                });
            })
            .WithName("GetSensorStatistics")
            .WithSummary("Get statistics for a specific sensor");

            // Get current value for specific sensor
            sensors.MapGet("/{sensorId}/current", (ISensorDataStore dataStore, ushort sensorId) =>
            {
                var stats = dataStore.GetStatistics(sensorId);
                if (stats.Count == 0)
                {
                    return Results.NotFound($"No data found for sensor {sensorId}");
                }

                var sensorType = GetSensorTypeFromId(sensorId);

                return Results.Ok(new
                {
                    sensorId = sensorId,
                    type = sensorType.ToString(),
                    value = stats.Current,
                    timestamp = stats.LastUpdate,
                    unit = SensorMetadata.GetUnit(sensorType)
                });
            })
            .WithName("GetCurrentValue")
            .WithSummary("Get current value for a specific sensor");

            // Get readings by floor
            sensors.MapGet("/floor/{floor}", (ISensorDataStore dataStore, byte floor) =>
            {
                if (floor < 1 || floor > 5)
                {
                    return Results.BadRequest("Floor must be between 1 and 5");
                }

                var allReadings = dataStore.GetRecent(1000);
                var floorReadings = allReadings.Where(r => r.Floor == floor)
                    .Select(r =>
                    {
                        var sensorType = GetSensorTypeFromId(r.SensorId);
                        return new
                        {
                            timestamp = r.Timestamp,
                            sensorId = r.SensorId,
                            type = sensorType.ToString(),
                            unit = SensorMetadata.GetUnit(sensorType),
                            floor = r.Floor,
                            zone = r.Zone,
                            value = r.Value,
                            isAnomaly = r.IsAnomaly
                        };
                    }).ToArray();

                return Results.Ok(new
                {
                    floor = floor,
                    count = floorReadings.Length,
                    readings = floorReadings
                });
            })
            .WithName("GetFloorReadings")
            .WithSummary("Get recent readings for a specific floor");

            // Get aggregated statistics by sensor type with trends
            sensors.MapGet("/aggregated", (IAggregationService aggregationService) =>
            {
                var result = aggregationService.CalculateAggregatedStatistics();
                return Results.Ok(result);
            })
            .WithName("GetAggregatedStatistics")
            .WithSummary("Get aggregated statistics by sensor type with trend analysis");

            // Get available sensor types
            sensors.MapGet("/types", () =>
            {
                var types = Enum.GetNames(typeof(SensorType))
                    .Select(name =>
                    {
                        var type = Enum.Parse<SensorType>(name);
                        return new
                        {
                            name = name,
                            unit = SensorMetadata.GetUnit(type)
                        };
                    });

                return Results.Ok(new
                {
                    types = types,
                    count = Enum.GetNames(typeof(SensorType)).Length
                });
            })
            .WithName("GetSensorTypes")
            .WithSummary("Get list of available sensor types");

            // Get readings by sensor type (string name only)
            sensors.MapGet("/type/{typeName}", (ISensorDataStore dataStore, string typeName) =>
            {
                // Explicitly reject numeric values
                if (int.TryParse(typeName, out _))
                {
                    var validTypes = Enum.GetNames(typeof(SensorType));
                    return Results.BadRequest(new
                    {
                        error = $"Numeric sensor type not allowed: '{typeName}'",
                        validTypes = validTypes,
                        message = "Use sensor type names (e.g., 'Temperature'), not numeric values"
                    });
                }

                // Only accept string type names
                if (!Enum.TryParse<SensorType>(typeName, true, out var type))
                {
                    var validTypes = Enum.GetNames(typeof(SensorType));
                    return Results.BadRequest(new
                    {
                        error = $"Invalid sensor type: '{typeName}'",
                        validTypes = validTypes,
                        message = "Use one of the valid sensor type names (case-insensitive)"
                    });
                }

                var allReadings = dataStore.GetRecent(1000);
                var typeReadings = allReadings.Where(r => r.Type == type)
                    .Select(r => new
                    {
                        timestamp = r.Timestamp,
                        sensorId = r.SensorId,
                        type = type.ToString(),
                        unit = SensorMetadata.GetUnit(type),
                        floor = r.Floor,
                        zone = r.Zone,
                        value = r.Value,
                        isAnomaly = r.IsAnomaly
                    }).ToArray();

                return Results.Ok(new
                {
                    type = type.ToString(),
                    count = typeReadings.Length,
                    unit = SensorMetadata.GetUnit(type),
                    readings = typeReadings
                });
            })
            .WithName("GetTypeReadings")
            .WithSummary("Get recent readings for a specific sensor type (use type name, not numeric value)");

            // Health check endpoint
            sensors.MapGet("/health", (ISensorDataStore dataStore) =>
            {
                var totalReadings = dataStore.GetTotalReadings();
                var stats = dataStore.GetAllStatistics();

                return Results.Ok(new
                {
                    status = "healthy",
                    totalReadings = totalReadings,
                    activeSensors = stats.Length,
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                });
            })
            .WithName("HealthCheck")
            .WithSummary("Check system health");

            // Performance monitoring endpoint
            sensors.MapGet("/performance", (IPerformanceMonitor perfMonitor) =>
            {
                var stats = perfMonitor.GetStats();
                return Results.Ok(new
                {
                    actualReadingsPerSecond = stats.Last10SecondsAverage,
                    targetReadingsPerSecond = 1000,
                    efficiency = (stats.Last10SecondsAverage / 1000.0) * 100,
                    totalReadings = stats.TotalReadings,
                    runtimeSeconds = stats.RuntimeSeconds,
                    averageOverall = stats.AverageReadingsPerSecond,
                    lastSecond = stats.LastSecondReadings,
                    last60Seconds = stats.ReadingsHistory,
                    startTime = stats.StartTime,
                    timestamp = DateTimeOffset.UtcNow
                });
            })
            .WithName("PerformanceStats")
            .WithSummary("Get performance statistics");

            // Reset performance counter
            sensors.MapPost("/performance/reset", (IPerformanceMonitor perfMonitor) =>
            {
                perfMonitor.Reset();
                return Results.Ok(new { message = "Performance counters reset" });
            })
            .WithName("ResetPerformance")
            .WithSummary("Reset performance counters");

            // Diagnostic endpoint to check sensor mappings
            sensors.MapGet("/diagnostic", (ISensorDataStore dataStore) =>
            {
                var recent = dataStore.GetRecent(50);
                var samplesByType = recent
                    .GroupBy(r => GetSensorTypeFromId(r.SensorId))
                    .Select(g => new
                    {
                        Type = g.Key.ToString(),
                        SensorIds = g.Select(r => r.SensorId).Distinct().OrderBy(id => id).ToArray(),
                        SampleValues = g.Take(5).Select(r => new { r.SensorId, r.Value }).ToArray()
                    })
                    .ToArray();

                return Results.Ok(new
                {
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    totalReadings = dataStore.GetTotalReadings(),
                    sensorTypeMapping = new
                    {
                        temperature = "IDs 1-10",
                        humidity = "IDs 11-20",
                        co2 = "IDs 21-30",
                        occupancy = "IDs 31-40",
                        power = "IDs 41-50"
                    },
                    actualDataByType = samplesByType
                });
            })
            .WithName("DiagnosticInfo")
            .WithSummary("Diagnostic information for debugging sensor data");

            // Reset data store (for testing/debugging)
            sensors.MapPost("/reset", (ISensorDataStore dataStore, IPerformanceMonitor perfMonitor, ILogger<Program> logger) =>
            {
                logger.LogWarning("Resetting data store and performance counters");
                dataStore.Reset();
                perfMonitor.Reset();

                // Verify reset worked
                var totalAfterReset = dataStore.GetTotalReadings();

                return Results.Ok(new
                {
                    message = "Data store and performance counters have been reset",
                    totalReadingsAfterReset = totalAfterReset,
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    warning = "This is a debugging endpoint - remove in production"
                });
            })
            .WithName("ResetDataStore")
            .WithSummary("Reset all sensor data (debugging only)");
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