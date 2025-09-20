# Smart Building Real-Time Sensor Analytics Platform

A real-time sensor monitoring and analytics dashboard built with React (frontend) and .NET Core (backend), featuring live data streaming via SignalR, anomaly detection, and interactive visualizations.

## Features

- **Real-Time Data Streaming**: Live sensor data updates via SignalR WebSockets with automatic reconnection
- **Multiple Sensor Types**: Temperature, Humidity, CO2, Occupancy, and Power Consumption monitoring
- **Anomaly Detection**: Automatic threshold-based anomaly detection with severity categorization
- **Interactive Dashboard**: Modern, responsive UI with real-time charts and statistics
- **High Performance**: Handles 1000+ readings/second with zero-heap allocations
- **Alert Management**: Real-time anomaly alerts with categorized severity levels
- **Subscription Model**: Selective sensor monitoring to optimize bandwidth
- **Data Aggregation**: Real-time statistics with incremental updates

## Tech Stack

### Backend

- .NET Core 8.0
- ASP.NET Core Web API
- SignalR for real-time communication
- In-memory data storage
- Swagger for API documentation

### Frontend

- React 19 with TypeScript
- Vite for build tooling
- Chart.js for data visualization
- SignalR Client for real-time updates
- Tailwind CSS for styling
- Lucide React for icons

## Prerequisites

- Node.js 18+ and npm
- .NET SDK 8.0+
- Git

## Installation & Setup

### Clone the Repository

```bash
git clone <repository-url>
cd sensor-data-streaming-platform
```

### Backend Setup

1. Navigate to the backend directory:

```bash
cd backend/SmartBuildingAPI
```

2. Restore dependencies:

```bash
dotnet restore
```

3. Run the backend:

```bash
dotnet run
```

The backend will start on http://localhost:5135

- Swagger UI: http://localhost:5135/swagger
- SignalR Hub: http://localhost:5135/sensorHub

### Frontend Setup

1. Open a new terminal and navigate to the frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

The frontend will start on http://localhost:5173

## Usage

1. **Start Both Services**: Ensure both backend (port 5135) and frontend (port 5173) are running

2. **Open the Dashboard**: Navigate to http://localhost:5173 in your browser

3. **Select Sensors**: Click on sensor cards to enable/disable monitoring for specific sensor types

4. **Monitor Data**:

   - View real-time charts updating with live sensor data
   - Monitor statistics cards showing current, min, max, and average values
   - Observe anomaly alerts in the alerts panel

5. **Interact with Features**:
   - Toggle sensor monitoring on/off
   - View historical data in charts
   - Clear alerts when reviewed
   - Monitor connection status

## Architecture

### Data Flow

1. Backend generates simulated sensor data at configurable rates (100-1000/sec)
2. Data is processed for anomaly detection and statistics calculation
3. SignalR broadcasts updates to connected clients via WebSocket/SSE
4. Frontend receives and visualizes data in real-time
5. Charts and statistics update dynamically without page refresh

### Technical Architecture

#### Backend Architecture

- **Data Storage**: Lock-free circular buffer with 100,000 data points capacity
- **Processing**: Batch processing every 100ms for optimal throughput
- **Communication**: Hub-based SignalR with WebSocket primary, SSE fallback
- **Optimization**: Zero-heap allocations per reading through efficient memory management
- **Statistics**: Incremental updates with caching for performance

#### Frontend Architecture

- **State Management**: Singleton SignalR service with EventEmitter pattern
- **Data Windowing**: Last 100 seconds displayed for optimal performance
- **Rendering**: Throttled chart updates at 10 FPS
- **Optimization**: React.memo and useCallback for component efficiency
- **Connection**: Automatic reconnection with exponential backoff

### Key Components

#### Backend Services

- **SensorDataGenerator**: Generates realistic sensor readings with configurable rates
- **AnomalyDetectionService**: Threshold-based anomaly detection with severity levels
- **StatisticsService**: Incremental statistics calculation with caching
- **SignalR Hub**: WebSocket connection management with subscription model
- **Data Management**: Lock-free circular buffer with automatic cleanup

#### Frontend Components

- **Dashboard**: Main container with optimized re-rendering
- **RealtimeChart**: Chart.js visualization with 10 FPS throttling
- **StatisticsCard**: Real-time metrics display (current, min, max, avg)
- **AlertPanel**: Categorized anomaly alerts with clear functionality
- **SensorSelector**: Toggle-based sensor subscription management
- **SignalR Service**: Singleton connection manager with event emitter

## API Endpoints

### REST API

- `GET /api/sensor/readings/recent` - Get recent sensor readings
- `GET /api/sensor/statistics` - Get current statistics
- `GET /api/sensor/alerts/recent` - Get recent alerts
- `POST /api/sensor/generation/rate` - Adjust generation rate

### SignalR Events

#### Client Events (Receive)

- `ReceiveSensorReading` - New sensor data batch (10-50 readings)
- `ReceiveStatisticsUpdate` - Aggregated statistics updates
- `ReceiveAnomalyAlert` - Anomaly notifications with severity

#### Server Methods (Send)

- `SubscribeToSensor` - Subscribe to specific sensor type
- `UnsubscribeFromSensor` - Unsubscribe from sensor type
- Connection management with automatic reconnection

## Performance

### Capabilities

- **Throughput**: 100-1000 readings per second
- **Latency**: Minimal latency with batch processing every 100ms
- **Data Capacity**: 100,000 data points in-memory circular buffer
- **Chart Performance**: Throttled to 10 FPS with last 100 seconds windowing
- **Network Optimization**: Message compression for WebSocket frames
- **Memory Management**: Zero-heap allocations per reading

### Optimizations

- Lock-free data structures using Interlocked operations
- Batched updates (10-50 readings) for network efficiency
- Removed point markers for dense data visualization (100+ points)
- Efficient data transformation layer in frontend

## Sensor Types and their Ranges

| Sensor Type | Min | Max  | Unit   |
| ----------- | --- | ---- | ------ |
| Temperature | 18  | 26   | °C     |
| Humidity    | 30  | 70   | %      |
| CO2         | 400 | 1000 | ppm    |
| Occupancy   | 0   | 50   | people |
| Power       | 10  | 100  | kW     |

## Development

### Running in Development Mode

Backend:

```bash
cd backend/SmartBuildingAPI
dotnet watch run
```

Frontend:

```bash
cd frontend
npm run dev
```

### Development Features

- Hot reload support for both frontend and backend
- Swagger UI for API exploration
- Real-time debugging via browser DevTools
- Configurable data generation rates for testing

### Building for Production

Backend:

```bash
cd backend/SmartBuildingAPI
dotnet publish -c Release
```

Frontend:

```bash
cd frontend
npm run build
```

## Scalability & Future Considerations

### Production Ready Enhancements

- **Persistence**: Add time-series database (InfluxDB/TimescaleDB)
- **Authentication**: Implement JWT-based auth with role management
- **Scalability**: Redis backplane for multi-server SignalR
- **Monitoring**: Enhanced ML-based anomaly detection
- **Deployment**: Docker containerization with Kubernetes orchestration

## License

MIT

## Project Documentation

For detailed insights into the development process, architectural decisions, and human-AI collaboration aspects of this project, see the [Project Development Report](./Project_development_report.md).
