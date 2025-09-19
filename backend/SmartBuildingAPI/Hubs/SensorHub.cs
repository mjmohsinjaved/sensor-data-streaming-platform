using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using SmartBuildingAPI.Models;
using SmartBuildingAPI.Services;

namespace SmartBuildingAPI.Hubs
{
    public class SensorHub : Hub
    {
        private readonly ISensorDataStore _dataStore;
        private readonly ILogger<SensorHub> _logger;

        public SensorHub(ISensorDataStore dataStore, ILogger<SensorHub> logger)
        {
            _dataStore = dataStore;
            _logger = logger;
        }

        public override async Task OnConnectedAsync()
        {
            _logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);

            // Send initial data to newly connected client
            var recentReadings = _dataStore.GetRecent(100);
            var statistics = _dataStore.GetAllStatistics();

            await Clients.Caller.SendAsync("InitialData", new
            {
                readings = recentReadings,
                stats = statistics,
                totalReadings = _dataStore.GetTotalReadings()
            });

            await base.OnConnectedAsync();
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            _logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);
            return base.OnDisconnectedAsync(exception);
        }

        // Client can request recent readings
        public async Task GetRecentReadings(int count)
        {
            var readings = _dataStore.GetRecent(count);
            await Clients.Caller.SendAsync("RecentReadings", readings);
        }

        // Client can request statistics for specific sensor
        public async Task GetSensorStatistics(ushort sensorId)
        {
            var stats = _dataStore.GetStatistics(sensorId);
            await Clients.Caller.SendAsync("SensorStatistics", stats);
        }

        // Subscribe to specific floor updates
        public async Task SubscribeToFloor(byte floor)
        {
            var groupName = $"floor-{floor}";
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            _logger.LogDebug("Client {ConnectionId} subscribed to floor {Floor}", Context.ConnectionId, floor);
        }

        // Unsubscribe from floor updates
        public async Task UnsubscribeFromFloor(byte floor)
        {
            var groupName = $"floor-{floor}";
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
            _logger.LogDebug("Client {ConnectionId} unsubscribed from floor {Floor}", Context.ConnectionId, floor);
        }

        // Subscribe to specific sensor type
        public async Task SubscribeToSensorType(SensorType sensorType)
        {
            var groupName = $"type-{sensorType}";
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            _logger.LogDebug("Client {ConnectionId} subscribed to sensor type {Type}", Context.ConnectionId, sensorType);
        }

        // Unsubscribe from sensor type
        public async Task UnsubscribeFromSensorType(SensorType sensorType)
        {
            var groupName = $"type-{sensorType}";
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
            _logger.LogDebug("Client {ConnectionId} unsubscribed from sensor type {Type}", Context.ConnectionId, sensorType);
        }
    }
}