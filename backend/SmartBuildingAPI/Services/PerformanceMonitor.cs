using System;
using System.Threading;

namespace SmartBuildingAPI.Services
{
    public interface IPerformanceMonitor
    {
        void RecordReading();
        PerformanceStats GetStats();
        void Reset();
    }

    public class PerformanceMonitor : IPerformanceMonitor
    {
        private long _totalReadings;
        private long _readingsLastSecond;
        private long _lastResetTicks;
        private DateTime _startTime;

        // Ring buffer for per-second history (last 60 seconds)
        private readonly int[] _readingsPerSecond = new int[60];
        private int _currentSecondIndex;
        private DateTime _currentSecondStart;

        public PerformanceMonitor()
        {
            Reset();
        }

        public void RecordReading()
        {
            Interlocked.Increment(ref _totalReadings);
            Interlocked.Increment(ref _readingsLastSecond);

            // Check if we've moved to a new second
            var now = DateTime.UtcNow;
            if ((now - _currentSecondStart).TotalSeconds >= 1)
            {
                // Store last second's count and move to next
                var lastCount = Interlocked.Exchange(ref _readingsLastSecond, 0);
                _currentSecondIndex = (_currentSecondIndex + 1) % 60;
                _readingsPerSecond[_currentSecondIndex] = (int)lastCount;
                _currentSecondStart = now;
            }
        }

        public PerformanceStats GetStats()
        {
            var now = DateTime.UtcNow;
            var runtime = now - _startTime;
            var total = Interlocked.Read(ref _totalReadings);

            // Calculate average over last 10 seconds
            var recentSum = 0;
            var recentCount = Math.Min(10, (int)runtime.TotalSeconds);
            for (int i = 0; i < recentCount; i++)
            {
                var index = (_currentSecondIndex - i + 60) % 60;
                recentSum += _readingsPerSecond[index];
            }

            return new PerformanceStats
            {
                TotalReadings = total,
                RuntimeSeconds = runtime.TotalSeconds,
                AverageReadingsPerSecond = total / Math.Max(1, runtime.TotalSeconds),
                LastSecondReadings = _readingsPerSecond[_currentSecondIndex],
                Last10SecondsAverage = recentCount > 0 ? recentSum / (double)recentCount : 0,
                ReadingsHistory = _readingsPerSecond.ToArray(),
                StartTime = _startTime
            };
        }

        public void Reset()
        {
            _totalReadings = 0;
            _readingsLastSecond = 0;
            _lastResetTicks = DateTime.UtcNow.Ticks;
            _startTime = DateTime.UtcNow;
            _currentSecondStart = DateTime.UtcNow;
            _currentSecondIndex = 0;
            Array.Clear(_readingsPerSecond, 0, _readingsPerSecond.Length);
        }
    }

    public class PerformanceStats
    {
        public long TotalReadings { get; set; }
        public double RuntimeSeconds { get; set; }
        public double AverageReadingsPerSecond { get; set; }
        public int LastSecondReadings { get; set; }
        public double Last10SecondsAverage { get; set; }
        public int[] ReadingsHistory { get; set; } = Array.Empty<int>();
        public DateTime StartTime { get; set; }
    }
}