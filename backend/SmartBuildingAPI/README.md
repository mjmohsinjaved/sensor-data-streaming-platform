# Smart Building Sensor API

Real-time sensor monitoring API for smart building management system.

## Features

- ✅ Real-time sensor data streaming via SignalR
- ✅ Processes 1000 sensor readings per second
- ✅ In-memory circular buffer for 100,000 data points
- ✅ Automatic anomaly detection for HVAC, energy, and air quality
- ✅ RESTful API endpoints for statistics and monitoring
- ✅ Swagger UI for API documentation

## Quick Start

### Prerequisites
- .NET 8.0 SDK or later
- Visual Studio 2022 or VS Code

### Running the API

1. **Using Visual Studio:**
   - Open `SmartBuildingAPI.csproj`
   - Press F5 or click the Run button
   - API will start on `http://localhost:5135`

2. **Using Command Line:**
   ```bash
   dotnet run
   ```

3. **Access Points:**
   - API Documentation: http://localhost:5135/swagger
   - Root Endpoint: http://localhost:5135/
   - SignalR Hub: ws://localhost:5135/sensorHub

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API information and status |
| `/api/sensors/stats` | GET | Statistics for all sensors |
| `/api/sensors/recent?count=10` | GET | Get recent sensor readings |
| `/api/sensors/{id}/current` | GET | Current value for specific sensor |
| `/api/sensors/performance` | GET | Real-time performance metrics |
| `/api/sensors/health` | GET | System health check |

## Architecture

- **SensorDataStore**: Lock-free circular buffer with atomic operations
- **SensorGenerator**: Background service generating realistic sensor data
- **SignalR Hub**: Real-time WebSocket communication
- **Performance Monitor**: Tracks throughput and efficiency

## Sensor Types

1. **Temperature** (18-26°C)
2. **Humidity** (30-70%)
3. **CO2** (400-1000 ppm)
4. **Occupancy** (0-50 people)
5. **Power Consumption** (0-100 kW)

## Performance

- Target: 1000 readings/second
- Memory: Fixed 100,000 point buffer
- Efficiency: 100% with high-precision timing
- Zero heap allocations per reading

## CORS Configuration

Frontend applications are allowed from:
- http://localhost:5173 (Vite default)
- http://localhost:3000 (React default)
- http://localhost:5135 (API itself)