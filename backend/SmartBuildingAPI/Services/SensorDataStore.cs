using System;
using System.Linq;
using System.Threading;
using SmartBuildingAPI.Models;

namespace SmartBuildingAPI.Services
{
    public class SensorDataStore : ISensorDataStore
    {
        private const int BufferSize = 100_000;
        private readonly SensorReading[] _buffer = new SensorReading[BufferSize];
        private long _writeIndex = -1;

        public void Add(SensorReading reading)
        {
            // Atomic increment and modulo for circular buffer
            var index = Interlocked.Increment(ref _writeIndex) % BufferSize;

            // Direct assignment - struct is small enough to be atomic on 64-bit systems
            _buffer[index] = reading;
        }

        public SensorReading[] GetRecent(int count)
        {
            // Validate input
            if (count <= 0) return Array.Empty<SensorReading>();
            if (count > BufferSize) count = BufferSize;

            // Capture current write position
            var currentIndex = Volatile.Read(ref _writeIndex);

            // Handle case where buffer hasn't filled yet
            var totalWritten = currentIndex + 1;
            if (totalWritten < count)
            {
                count = (int)Math.Min(totalWritten, BufferSize);
            }

            if (count == 0) return Array.Empty<SensorReading>();

            var result = new SensorReading[count];

            // Read backwards from current position
            for (int i = 0; i < count; i++)
            {
                // Calculate position in circular buffer
                var readIndex = (currentIndex - i) % BufferSize;
                if (readIndex < 0) readIndex += BufferSize;

                // Direct read - small struct
                result[i] = _buffer[readIndex];
            }

            return result;
        }

        public SensorStatistics GetStatistics(ushort sensorId)
        {
            // Capture current state
            var currentIndex = Volatile.Read(ref _writeIndex);
            var totalWritten = Math.Min(currentIndex + 1, BufferSize);

            if (totalWritten == 0)
            {
                return new SensorStatistics { SensorId = sensorId };
            }

            float min = float.MaxValue;
            float max = float.MinValue;
            float sum = 0;
            float lastValue = 0;
            long lastTimestamp = 0;
            int count = 0;

            // Scan buffer for matching sensor readings
            for (int i = 0; i < totalWritten; i++)
            {
                var reading = _buffer[i];

                if (reading.SensorId == sensorId)
                {
                    var value = reading.Value;

                    if (value < min) min = value;
                    if (value > max) max = value;
                    sum += value;
                    count++;

                    // Track the most recent reading
                    if (reading.Timestamp > lastTimestamp)
                    {
                        lastTimestamp = reading.Timestamp;
                        lastValue = value;
                    }
                }
            }

            if (count == 0)
            {
                return new SensorStatistics { SensorId = sensorId };
            }

            return new SensorStatistics
            {
                SensorId = sensorId,
                Min = min,
                Max = max,
                Average = sum / count,
                Current = lastValue,
                Count = count,
                LastUpdate = lastTimestamp
            };
        }

        public SensorStatistics[] GetAllStatistics()
        {
            // Capture current state
            var currentIndex = Volatile.Read(ref _writeIndex);
            var totalWritten = Math.Min(currentIndex + 1, BufferSize);

            if (totalWritten == 0)
            {
                return Array.Empty<SensorStatistics>();
            }

            // Use dictionary for efficient grouping
            var statsDict = new System.Collections.Generic.Dictionary<ushort, (float min, float max, float sum, float last, long lastTime, int count)>();

            // Single pass through buffer
            for (int i = 0; i < totalWritten; i++)
            {
                var reading = _buffer[i];
                var sensorId = reading.SensorId;
                var value = reading.Value;

                if (statsDict.TryGetValue(sensorId, out var stats))
                {
                    stats.min = Math.Min(stats.min, value);
                    stats.max = Math.Max(stats.max, value);
                    stats.sum += value;
                    stats.count++;

                    if (reading.Timestamp > stats.lastTime)
                    {
                        stats.lastTime = reading.Timestamp;
                        stats.last = value;
                    }

                    statsDict[sensorId] = stats;
                }
                else
                {
                    statsDict[sensorId] = (value, value, value, value, reading.Timestamp, 1);
                }
            }

            // Convert to array
            return statsDict.Select(kvp => new SensorStatistics
            {
                SensorId = kvp.Key,
                Min = kvp.Value.min,
                Max = kvp.Value.max,
                Average = kvp.Value.sum / kvp.Value.count,
                Current = kvp.Value.last,
                Count = kvp.Value.count,
                LastUpdate = kvp.Value.lastTime
            }).ToArray();
        }

        public int GetTotalReadings()
        {
            var currentIndex = Volatile.Read(ref _writeIndex);
            return (int)Math.Min(currentIndex + 1, BufferSize);
        }

        public void Reset()
        {
            // Reset the write index
            Interlocked.Exchange(ref _writeIndex, -1);

            // Clear the buffer (optional, but helps with debugging)
            Array.Clear(_buffer, 0, _buffer.Length);
        }
    }
}