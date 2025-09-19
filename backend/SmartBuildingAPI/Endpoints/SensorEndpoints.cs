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
                return Results.Ok(new
                {
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    totalReadings = dataStore.GetTotalReadings(),
                    sensorCount = stats.Length,
                    statistics = stats
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
                return Results.Ok(new
                {
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    count = readings.Length,
                    readings = readings
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
                return Results.Ok(stats);
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

                return Results.Ok(new
                {
                    sensorId = sensorId,
                    value = stats.Current,
                    timestamp = stats.LastUpdate,
                    unit = SensorMetadata.GetUnit((SensorType)(sensorId % 5 + 1))
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
                var floorReadings = allReadings.Where(r => r.Floor == floor).ToArray();

                return Results.Ok(new
                {
                    floor = floor,
                    count = floorReadings.Length,
                    readings = floorReadings
                });
            })
            .WithName("GetFloorReadings")
            .WithSummary("Get recent readings for a specific floor");

            // Get readings by sensor type
            sensors.MapGet("/type/{type}", (ISensorDataStore dataStore, SensorType type) =>
            {
                var allReadings = dataStore.GetRecent(1000);
                var typeReadings = allReadings.Where(r => r.Type == type).ToArray();

                return Results.Ok(new
                {
                    type = type.ToString(),
                    count = typeReadings.Length,
                    unit = SensorMetadata.GetUnit(type),
                    readings = typeReadings
                });
            })
            .WithName("GetTypeReadings")
            .WithSummary("Get recent readings for a specific sensor type");

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
        }
    }
}