# Real-Time Sensor Analytics Dashboard - Proof of Concept

## 📋 Project Overview

Build a proof-of-concept real-time analytics dashboard that processes streaming sensor data.

**Timeline:** 3 days | **Estimated Effort:** 8 hours

## 🎯 Core Requirements

### Backend (.NET Core API)

- [ ] Simulate sensor readings (start with 100/sec, scale to 1000/sec)
- [ ] Handle data points in memory (basic collection, no complex retention)
- [ ] Create SignalR hub for real-time streaming
- [ ] Basic anomaly detection (simple threshold-based)

### Frontend (React)

- [ ] Real-time dashboard with live updates
- [ ] Simple chart visualization (Chart.js)
- [ ] Basic statistics display (current/min/max/avg)
- [ ] Alert notifications for anomalies

### Performance Goals

- [ ] Process readings without obvious lag
- [ ] Smooth UI updates
- [ ] Basic data sampling for visualization

## 📁 Simple Project Structure

```
sensor-dashboard/
├── backend/               # .NET Core API
│   ├── Controllers/
│   ├── Services/
│   ├── Models/
│   └── Hubs/            # SignalR
└── frontend/            # React app
    └── src/
        ├── components/
        └── services/
```

## 🚀 Implementation Steps

### Step 1: Backend Setup (2 hours)

- [ ] Create .NET Core API project
- [ ] Add sensor data model (ID, value, timestamp, sensor type)
- [ ] Implement basic data generator service
- [ ] Set up SignalR hub for streaming
- [ ] Add simple anomaly detection (threshold-based)

### Step 2: Frontend Setup (2 hours)

- [ ] Create React app
- [ ] Install Chart.js and SignalR client
- [ ] Set up SignalR connection
- [ ] Create basic dashboard component
- [ ] Add real-time chart and statistics

### Step 3: Integration & Testing (2 hours)

- [ ] Connect frontend to backend
- [ ] Test real-time data flow
- [ ] Implement basic performance optimizations
- [ ] Add simple error handling

## 🎯 Success Criteria

### Core Functionality

- [ ] Real-time data streaming works
- [ ] Charts update without freezing
- [ ] Anomaly alerts trigger correctly
- [ ] Basic statistics calculate properly

### Technical Requirements

- [ ] Backend generates sensor data
- [ ] SignalR connection stable
- [ ] Frontend renders smoothly
- [ ] Simple performance acceptable

## 🚀 Quick Start Commands

```bash
# Backend
dotnet new webapi -n SensorAPI
cd SensorAPI
dotnet add package Microsoft.AspNetCore.SignalR

# Frontend
npx create-react-app sensor-dashboard
cd sensor-dashboard
npm install @microsoft/signalr chart.js react-chartjs-2
```

---

**Focus:** Get a working proof-of-concept quickly. Avoid over-engineering.
