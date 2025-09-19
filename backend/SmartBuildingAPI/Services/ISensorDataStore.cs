using SmartBuildingAPI.Models;

namespace SmartBuildingAPI.Services
{
    public interface ISensorDataStore
    {
        void Add(SensorReading reading);
        SensorReading[] GetRecent(int count);
        SensorStatistics GetStatistics(ushort sensorId);
        SensorStatistics[] GetAllStatistics();
        int GetTotalReadings();
    }
}