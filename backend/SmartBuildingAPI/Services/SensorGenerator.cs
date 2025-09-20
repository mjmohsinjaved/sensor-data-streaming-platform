using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SmartBuildingAPI.Hubs;
using SmartBuildingAPI.Models;

namespace SmartBuildingAPI.Services
{
    public class SensorGenerator : BackgroundService
    {
        private readonly ISensorDataStore _dataStore;
        private readonly IHubContext<SensorHub> _hubContext;
        private readonly ILogger<SensorGenerator> _logger;
        private readonly IPerformanceMonitor _perfMonitor;
        private readonly IAggregationService _aggregationService;

        // Sensor configuration: 50 sensors total (10 of each type)
        private readonly SensorConfig[] _sensors = new SensorConfig[50];
        private readonly Random _random = new Random();

        // Timing control
        private const int ReadingsPerSecond = 1000;
        private const double IntervalMs = 1000.0 / ReadingsPerSecond; // 1ms per reading
        private const double TicksPerMs = TimeSpan.TicksPerMillisecond;

        public SensorGenerator(ISensorDataStore dataStore, IHubContext<SensorHub> hubContext,
            ILogger<SensorGenerator> logger, IPerformanceMonitor perfMonitor, IAggregationService aggregationService)
        {
            _dataStore = dataStore;
            _hubContext = hubContext;
            _logger = logger;
            _perfMonitor = perfMonitor;
            _aggregationService = aggregationService;
            InitializeSensors();
        }

        private void InitializeSensors()
        {
            // Initialize sensors to match the ID mapping pattern:
            // IDs 1-10: Temperature
            // IDs 11-20: Humidity
            // IDs 21-30: CO2
            // IDs 31-40: Occupancy
            // IDs 41-50: Power

            int arrayIndex = 0;

            // Temperature sensors (IDs 1-10) - 2 per floor across 5 floors
            for (ushort id = 1; id <= 10; id++)
            {
                byte floor = (byte)((id - 1) / 2 + 1); // Maps: 1,2->floor1, 3,4->floor2, etc.
                byte zone = (byte)((id - 1) % 2 + 1); // Alternates: 1->zone1, 2->zone2, 3->zone1, etc.

                _sensors[arrayIndex++] = new SensorConfig
                {
                    Id = id,
                    Type = SensorType.Temperature,
                    Floor = floor,
                    Zone = zone,
                    CurrentValue = 22f + (_random.NextSingle() * 2f - 1f),
                    MinValue = 18f,
                    MaxValue = 26f,
                    ChangeRate = 0.1f
                };
            }

            // Humidity sensors (IDs 11-20)
            for (ushort id = 11; id <= 20; id++)
            {
                byte floor = (byte)((id - 11) / 2 + 1);
                byte zone = (byte)((id - 11) % 2 + 1);

                _sensors[arrayIndex++] = new SensorConfig
                {
                    Id = id,
                    Type = SensorType.Humidity,
                    Floor = floor,
                    Zone = zone,
                    CurrentValue = 50f + (_random.NextSingle() * 10f - 5f),
                    MinValue = 30f,
                    MaxValue = 70f,
                    ChangeRate = 0.5f
                };
            }

            // CO2 sensors (IDs 21-30)
            for (ushort id = 21; id <= 30; id++)
            {
                byte floor = (byte)((id - 21) / 2 + 1);
                byte zone = (byte)((id - 21) % 2 + 1);

                _sensors[arrayIndex++] = new SensorConfig
                {
                    Id = id,
                    Type = SensorType.CO2,
                    Floor = floor,
                    Zone = zone,
                    CurrentValue = 600f + (_random.NextSingle() * 100f),
                    MinValue = 400f,
                    MaxValue = 1000f,
                    ChangeRate = 5f
                };
            }

            // Occupancy sensors (IDs 31-40)
            for (ushort id = 31; id <= 40; id++)
            {
                byte floor = (byte)((id - 31) / 2 + 1);
                byte zone = (byte)((id - 31) % 2 + 1);

                _sensors[arrayIndex++] = new SensorConfig
                {
                    Id = id,
                    Type = SensorType.Occupancy,
                    Floor = floor,
                    Zone = zone,
                    CurrentValue = GetOccupancyForTime(),
                    MinValue = 0f,
                    MaxValue = 50f,
                    ChangeRate = 2f
                };
            }

            // Power consumption sensors (IDs 41-50)
            for (ushort id = 41; id <= 50; id++)
            {
                byte floor = (byte)((id - 41) / 2 + 1);
                byte zone = (byte)((id - 41) % 2 + 1);

                _sensors[arrayIndex++] = new SensorConfig
                {
                    Id = id,
                    Type = SensorType.PowerConsumption,
                    Floor = floor,
                    Zone = zone,
                    CurrentValue = 30f + (_random.NextSingle() * 20f),
                    MinValue = 0f,
                    MaxValue = 100f,
                    ChangeRate = 1f
                };
            }
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Sensor Generator started - targeting {Rate} readings/second", ReadingsPerSecond);

            // Allow app to start before beginning tight loop
            await Task.Delay(100, stoppingToken);

            // Use high-precision timer
            var stopwatch = Stopwatch.StartNew();
            var nextReadingTime = stopwatch.ElapsedTicks;
            var ticksPerReading = (long)(TicksPerMs * IntervalMs);

            // Timer for aggregated statistics broadcast (every 1 second)
            var lastAggregationBroadcast = stopwatch.ElapsedMilliseconds;
            const int AggregationIntervalMs = 1000;

            int sensorIndex = 0;

            while (!stoppingToken.IsCancellationRequested)
            {
                // Generate reading from next sensor
                var sensor = _sensors[sensorIndex];
                var reading = GenerateReading(sensor);

                // Store in data store
                _dataStore.Add(reading);
                _perfMonitor.RecordReading();

                // Check if it's time to broadcast aggregated statistics (every 1 second)
                var currentTime = stopwatch.ElapsedMilliseconds;
                if (currentTime - lastAggregationBroadcast >= AggregationIntervalMs)
                {
                    lastAggregationBroadcast = currentTime;

                    // Fire and forget - broadcast aggregated statistics
                    _ = Task.Run(() => BroadcastAggregatedStatsAsync(), stoppingToken);
                }

                // Move to next sensor (round-robin)
                sensorIndex = (sensorIndex + 1) % _sensors.Length;

                // Calculate next reading time
                nextReadingTime += ticksPerReading;

                // Spin-wait for precise timing
                while (stopwatch.ElapsedTicks < nextReadingTime)
                {
                    // For very short waits, just spin
                    if (nextReadingTime - stopwatch.ElapsedTicks < TicksPerMs)
                    {
                        Thread.SpinWait(1);
                    }
                    else
                    {
                        // For longer waits, yield to other threads
                        Thread.Yield();
                    }
                }
            }
        }

        private SensorReading GenerateReading(SensorConfig sensor)
        {
            // Update sensor value with realistic drift
            UpdateSensorValue(sensor);

            // Detect anomalies based on sensor type and thresholds
            bool isAnomaly = DetectAnomaly(sensor);

            // Create reading with anomaly flag
            return new SensorReading(
                sensor.Id,
                sensor.CurrentValue,
                sensor.Type,
                sensor.Floor,
                sensor.Zone,
                isAnomaly
            );
        }

        private bool DetectAnomaly(SensorConfig sensor)
        {
            // Define anomaly thresholds for each sensor type
            return sensor.Type switch
            {
                SensorType.Temperature => sensor.CurrentValue < 19f || sensor.CurrentValue > 25f,
                SensorType.Humidity => sensor.CurrentValue < 35f || sensor.CurrentValue > 65f,
                SensorType.CO2 => sensor.CurrentValue > 800f,
                SensorType.Occupancy => sensor.CurrentValue > 45f,
                SensorType.PowerConsumption => sensor.CurrentValue > 80f,
                _ => false
            };
        }

        private void UpdateSensorValue(SensorConfig sensor)
        {
            // IMPORTANT: Clamp BEFORE any changes to ensure we start from valid range
            sensor.CurrentValue = Math.Clamp(sensor.CurrentValue, sensor.MinValue, sensor.MaxValue);

            // Add random walk with boundaries
            var change = (_random.NextSingle() - 0.5f) * 2f * sensor.ChangeRate;
            sensor.CurrentValue += change;

            // Apply sensor-specific logic
            switch (sensor.Type)
            {
                case SensorType.Occupancy:
                    // Occupancy changes based on time of day
                    var targetOccupancy = GetOccupancyForTime();
                    sensor.CurrentValue += (targetOccupancy - sensor.CurrentValue) * 0.1f;
                    sensor.CurrentValue = Math.Max(0, (int)sensor.CurrentValue); // Round to integer
                    break;

                case SensorType.PowerConsumption:
                    // Power correlates with occupancy on same floor
                    var occupancySensor = GetOccupancySensor(sensor.Floor, sensor.Zone);
                    if (occupancySensor != null)
                    {
                        var basePower = 10f + occupancySensor.CurrentValue * 1.5f;
                        sensor.CurrentValue += (basePower - sensor.CurrentValue) * 0.2f;
                    }
                    break;

                case SensorType.CO2:
                    // CO2 also correlates with occupancy
                    var occSensor = GetOccupancySensor(sensor.Floor, sensor.Zone);
                    if (occSensor != null)
                    {
                        var baseCO2 = 400f + occSensor.CurrentValue * 12f;
                        sensor.CurrentValue += (baseCO2 - sensor.CurrentValue) * 0.1f;
                    }
                    break;
            }

            // ALWAYS clamp to min/max after any changes
            sensor.CurrentValue = Math.Clamp(sensor.CurrentValue, sensor.MinValue, sensor.MaxValue);
        }

        private float GetOccupancyForTime()
        {
            var hour = DateTime.Now.Hour;
            return hour switch
            {
                >= 9 and <= 11 => 30f + _random.NextSingle() * 15f,  // Morning
                >= 12 and <= 13 => 15f + _random.NextSingle() * 10f, // Lunch
                >= 14 and <= 17 => 35f + _random.NextSingle() * 10f, // Afternoon
                >= 8 and <= 18 => 20f + _random.NextSingle() * 10f,  // Work hours
                _ => _random.NextSingle() * 5f                        // After hours
            };
        }

        private SensorConfig? GetOccupancySensor(byte floor, byte zone)
        {
            return Array.Find(_sensors, s =>
                s.Type == SensorType.Occupancy &&
                s.Floor == floor &&
                s.Zone == zone);
        }

        private async Task BroadcastAggregatedStatsAsync()
        {
            try
            {
                // Calculate aggregated statistics using the service
                var aggregatedStats = _aggregationService.CalculateAggregatedStatistics();

                // Send aggregated statistics to all connected clients
                await _hubContext.Clients.All.SendAsync("ReceiveAggregatedStats", aggregatedStats);

                // Also send performance metrics
                var perfStats = _perfMonitor.GetStats();
                await _hubContext.Clients.All.SendAsync("ReceivePerformanceStats", new
                {
                    actualReadingsPerSecond = perfStats.Last10SecondsAverage,
                    targetReadingsPerSecond = 1000,
                    efficiency = (perfStats.Last10SecondsAverage / 1000.0) * 100,
                    totalReadings = perfStats.TotalReadings,
                    runtimeSeconds = perfStats.RuntimeSeconds
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error broadcasting aggregated statistics");
            }
        }

        private class SensorConfig
        {
            public ushort Id { get; set; }
            public SensorType Type { get; set; }
            public byte Floor { get; set; }
            public byte Zone { get; set; }
            public float CurrentValue { get; set; }
            public float MinValue { get; set; }
            public float MaxValue { get; set; }
            public float ChangeRate { get; set; }
        }
    }
}