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

        // Sensor configuration: 50 sensors total (10 of each type)
        private readonly SensorConfig[] _sensors = new SensorConfig[50];
        private readonly Random _random = new Random();

        // Timing control
        private const int ReadingsPerSecond = 1000;
        private const double IntervalMs = 1000.0 / ReadingsPerSecond; // 1ms per reading
        private const double TicksPerMs = TimeSpan.TicksPerMillisecond;

        // Batching for SignalR
        private const int BatchSize = 50; // Send 50 readings at once (20Hz update rate to clients)
        private readonly System.Collections.Generic.List<SensorReading> _broadcastBatch = new(BatchSize);

        public SensorGenerator(ISensorDataStore dataStore, IHubContext<SensorHub> hubContext,
            ILogger<SensorGenerator> logger, IPerformanceMonitor perfMonitor)
        {
            _dataStore = dataStore;
            _hubContext = hubContext;
            _logger = logger;
            _perfMonitor = perfMonitor;
            InitializeSensors();
        }

        private void InitializeSensors()
        {
            int sensorId = 0;

            // Distribute sensors across 5 floors
            for (byte floor = 1; floor <= 5; floor++)
            {
                // 2 temperature sensors per floor
                for (int i = 0; i < 2; i++)
                {
                    _sensors[sensorId++] = new SensorConfig
                    {
                        Id = (ushort)sensorId,
                        Type = SensorType.Temperature,
                        Floor = floor,
                        Zone = (byte)((i % 2) + 1),
                        CurrentValue = 22f + (_random.NextSingle() * 2f - 1f),
                        MinValue = 18f,
                        MaxValue = 26f,
                        ChangeRate = 0.1f
                    };
                }

                // 2 humidity sensors per floor
                for (int i = 0; i < 2; i++)
                {
                    _sensors[sensorId++] = new SensorConfig
                    {
                        Id = (ushort)sensorId,
                        Type = SensorType.Humidity,
                        Floor = floor,
                        Zone = (byte)((i % 2) + 1),
                        CurrentValue = 50f + (_random.NextSingle() * 10f - 5f),
                        MinValue = 30f,
                        MaxValue = 70f,
                        ChangeRate = 0.5f
                    };
                }

                // 2 CO2 sensors per floor
                for (int i = 0; i < 2; i++)
                {
                    _sensors[sensorId++] = new SensorConfig
                    {
                        Id = (ushort)sensorId,
                        Type = SensorType.CO2,
                        Floor = floor,
                        Zone = (byte)((i % 2) + 1),
                        CurrentValue = 600f + (_random.NextSingle() * 100f),
                        MinValue = 400f,
                        MaxValue = 1000f,
                        ChangeRate = 5f
                    };
                }

                // 2 occupancy sensors per floor
                for (int i = 0; i < 2; i++)
                {
                    _sensors[sensorId++] = new SensorConfig
                    {
                        Id = (ushort)sensorId,
                        Type = SensorType.Occupancy,
                        Floor = floor,
                        Zone = (byte)((i % 2) + 1),
                        CurrentValue = GetOccupancyForTime(),
                        MinValue = 0f,
                        MaxValue = 50f,
                        ChangeRate = 2f
                    };
                }

                // 2 power consumption sensors per floor
                for (int i = 0; i < 2; i++)
                {
                    _sensors[sensorId++] = new SensorConfig
                    {
                        Id = (ushort)sensorId,
                        Type = SensorType.PowerConsumption,
                        Floor = floor,
                        Zone = (byte)((i % 2) + 1),
                        CurrentValue = 30f + (_random.NextSingle() * 20f),
                        MinValue = 0f,
                        MaxValue = 100f,
                        ChangeRate = 1f
                    };
                }
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

            int sensorIndex = 0;
            int batchCount = 0;

            while (!stoppingToken.IsCancellationRequested)
            {
                // Generate reading from next sensor
                var sensor = _sensors[sensorIndex];
                var reading = GenerateReading(sensor);

                // Store in data store
                _dataStore.Add(reading);
                _perfMonitor.RecordReading();

                // Add to broadcast batch
                _broadcastBatch.Add(reading);
                batchCount++;

                // Fire-and-forget broadcast when batch is full
                if (batchCount >= BatchSize)
                {
                    var batchToSend = _broadcastBatch.ToArray();
                    _broadcastBatch.Clear();
                    batchCount = 0;

                    // Fire and forget - don't await
                    _ = Task.Run(() => BroadcastBatchAsync(batchToSend), stoppingToken);
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

            // Create reading
            return new SensorReading(
                sensor.Id,
                sensor.CurrentValue,
                sensor.Type,
                sensor.Floor,
                sensor.Zone
            );
        }

        private void UpdateSensorValue(SensorConfig sensor)
        {
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

            // Clamp to min/max
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

        private async Task BroadcastBatchAsync(SensorReading[] batch)
        {
            try
            {
                // Send batch to all connected clients
                await _hubContext.Clients.All.SendAsync("ReceiveSensorData", batch);

                // Also send current statistics (less frequently)
                if (DateTime.UtcNow.Millisecond % 500 < 50) // Every ~500ms
                {
                    var stats = _dataStore.GetAllStatistics();
                    await _hubContext.Clients.All.SendAsync("ReceiveStatistics", stats);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error broadcasting sensor data");
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