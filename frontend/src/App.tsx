import './App.css';
import { SignalRProvider } from './contexts/SignalRContext';
import { SensorDashboard } from './components/SensorDashboard';

function App() {
  return (
    <SignalRProvider autoConnect={false}>
      <div className="App">
        <SensorDashboard />
      </div>
    </SignalRProvider>
  );
}

export default App;
