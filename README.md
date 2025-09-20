## Project Overview

This is a real-time sensor data streaming platform for smart building management, consisting of:

- **Backend**: .NET 8.0 API with SignalR for real-time WebSocket communication
- **Frontend**: React 19 + TypeScript application with Vite, TailwindCSS, and Chart.js

## Common Commands

### Frontend Development

```bash
# Navigate to frontend directory first
cd frontend

# Install dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Run ESLint
npm run lint

# TypeScript type checking (part of build)
npm run build
```

### Backend Development

```bash
# Navigate to backend API directory
cd backend/SmartBuildingAPI

# Run the API (starts on http://localhost:5135)
dotnet run

# Build the project
dotnet build

# Clean build artifacts
dotnet clean

# Restore NuGet packages
dotnet restore
```

### Full Stack Development

To run both frontend and backend:

1. Start backend first: `cd backend/SmartBuildingAPI && dotnet run`
2. In new terminal, start frontend: `cd frontend && npm run dev`

## Architecture

### Real-Time Data Flow

1. **Backend SensorGenerator** service generates 1000 sensor readings/second
2. Data flows through **SensorDataStore** (lock-free circular buffer)
3. **SignalR Hub** broadcasts to connected clients via WebSocket
4. **Frontend SignalRService** receives and processes real-time updates
5. React components update via context providers and state management

### Key Backend Components

- **Program.cs**: Entry point, configures SignalR hub at `/sensorHub`, CORS, and API endpoints
- **SensorHub.cs**: SignalR hub handling real-time client connections and subscriptions
- **SensorDataStore**: High-performance circular buffer for 100,000 data points
- **SensorGenerator**: Background service simulating sensor data
- **AggregationService**: Calculates statistics and detects anomalies

### Key Frontend Components

- **SignalRContext.tsx**: Manages WebSocket connection state and lifecycle
- **SignalRService**: Singleton service handling hub connection and event subscriptions
- **Dashboard.tsx**: Main component orchestrating real-time data display
- **RealtimeChart.tsx**: Live updating Chart.js visualizations

### SignalR Communication

- Hub URL: `ws://localhost:5135/sensorHub`
- Key events:
  - `SensorReading`: Individual sensor updates
  - `AggregatedStats`: Periodic aggregated statistics
  - `AnomalyDetected`: Real-time anomaly alerts
  - `PerformanceUpdate`: System performance metrics

## Important Configuration

### Backend API Endpoints

- Swagger UI: http://localhost:5135/swagger
- Stats: `/api/sensors/stats`
- Aggregated: `/api/sensors/aggregated`
- Recent readings: `/api/sensors/recent?count=100`
- Performance: `/api/sensors/performance`

### CORS Configuration

Backend allows connections from:

- http://localhost:5173 (Vite dev server)
- http://localhost:3000
- http://localhost:5135

### Sensor Types

The system simulates 5 sensor types:

1. Temperature (18-26°C)
2. Humidity (30-70%)
3. CO2 (400-1000 ppm)
4. Occupancy (0-50 people)
5. Power Consumption (0-100 kW)

## Performance Targets

- 1000 sensor readings per second
- 100,000 point circular buffer
- Zero heap allocations per reading
- Real-time anomaly detection
- Sub-second latency for WebSocket updates
