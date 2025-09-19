
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { SignalRService } from '../services/signalr/SignalRService';
import type { ConnectionState, SensorData, Alert, ConnectionStatus } from '@/types/signalr.types';
import { HUB_METHODS } from '../config/signalr.config';

interface SignalRContextType {
  connectionState: ConnectionState;
  connectionStatus: ConnectionStatus;
  sensorData: Map<string, SensorData>;
  alerts: Alert[];
  subscribedSensors: Set<string>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  subscribeToSensor: (sensorId: string) => Promise<void>;
  unsubscribeFromSensor: (sensorId: string) => Promise<void>;
  getActiveSensors: () => Promise<string[]>;
  requestHistoricalData: (sensorId: string, startTime: Date, endTime: Date) => Promise<void>;
  clearAlerts: () => void;
  acknowledgeAlert: (alertId: string) => void;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

interface SignalRProviderProps {
  children: React.ReactNode;
  autoConnect?: boolean;
}

export const SignalRProvider: React.FC<SignalRProviderProps> = ({
  children,
  autoConnect = true
}) => {
  const signalRService = useRef(SignalRService.getInstance());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempt: 0
  });
  const [sensorData, setSensorData] = useState<Map<string, SensorData>>(new Map());
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [subscribedSensors, setSubscribedSensors] = useState<Set<string>>(new Set());

  const updateConnectionState = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    setConnectionState(prev => ({
      ...prev,
      isConnected: status === 'connected',
      isConnecting: status === 'connecting' || status === 'reconnecting',
      error: status === 'disconnected' ? prev.error : null
    }));
  }, []);

  useEffect(() => {
    const service = signalRService.current;

    const handleConnectionStatusChanged = (status: ConnectionStatus) => {
      updateConnectionState(status);
    };

    const handleSensorData = (data: SensorData) => {
      setSensorData(prev => {
        const updated = new Map(prev);
        updated.set(data.sensorId, data);
        return updated;
      });
    };

    const handleAlert = (alert: Alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 100));
    };

    const handleConnectionUpdate = (update: any) => {
      console.log('Connection update:', update);
    };

    const handleError = (error: any) => {
      setConnectionState(prev => ({
        ...prev,
        error: error.message || 'An error occurred'
      }));
    };

    service.on('connectionStatusChanged', handleConnectionStatusChanged);
    service.on(HUB_METHODS.RECEIVE_SENSOR_DATA, handleSensorData);
    service.on(HUB_METHODS.RECEIVE_ALERT, handleAlert);
    service.on(HUB_METHODS.RECEIVE_CONNECTION_UPDATE, handleConnectionUpdate);
    service.on(HUB_METHODS.RECEIVE_ERROR, handleError);

    if (autoConnect) {
      connect();
    }

    return () => {
      service.off('connectionStatusChanged', handleConnectionStatusChanged);
      service.off(HUB_METHODS.RECEIVE_SENSOR_DATA, handleSensorData);
      service.off(HUB_METHODS.RECEIVE_ALERT, handleAlert);
      service.off(HUB_METHODS.RECEIVE_CONNECTION_UPDATE, handleConnectionUpdate);
      service.off(HUB_METHODS.RECEIVE_ERROR, handleError);

      if (autoConnect) {
        service.disconnect();
      }
    };
  }, [autoConnect, updateConnectionState]);

  const connect = useCallback(async () => {
    try {
      setConnectionState(prev => ({
        ...prev,
        isConnecting: true,
        error: null
      }));
      await signalRService.current.initialize();
    } catch (error) {
      setConnectionState(prev => ({
        ...prev,
        isConnecting: false,
        isConnected: false,
        error: error instanceof Error ? error.message : 'Failed to connect'
      }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await signalRService.current.disconnect();
      setSensorData(new Map());
      setSubscribedSensors(new Set());
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }, []);

  const subscribeToSensor = useCallback(async (sensorId: string) => {
    try {
      await signalRService.current.subscribeToSensor(sensorId);
      setSubscribedSensors(prev => new Set(prev).add(sensorId));
    } catch (error) {
      console.error(`Failed to subscribe to sensor ${sensorId}:`, error);
      throw error;
    }
  }, []);

  const unsubscribeFromSensor = useCallback(async (sensorId: string) => {
    try {
      await signalRService.current.unsubscribeFromSensor(sensorId);
      setSubscribedSensors(prev => {
        const updated = new Set(prev);
        updated.delete(sensorId);
        return updated;
      });
      setSensorData(prev => {
        const updated = new Map(prev);
        updated.delete(sensorId);
        return updated;
      });
    } catch (error) {
      console.error(`Failed to unsubscribe from sensor ${sensorId}:`, error);
      throw error;
    }
  }, []);

  const getActiveSensors = useCallback(async () => {
    try {
      return await signalRService.current.getActiveSensors();
    } catch (error) {
      console.error('Failed to get active sensors:', error);
      throw error;
    }
  }, []);

  const requestHistoricalData = useCallback(async (
    sensorId: string,
    startTime: Date,
    endTime: Date
  ) => {
    try {
      await signalRService.current.requestHistoricalData(sensorId, startTime, endTime);
    } catch (error) {
      console.error('Failed to request historical data:', error);
      throw error;
    }
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
  }, []);

  const contextValue: SignalRContextType = {
    connectionState,
    connectionStatus,
    sensorData,
    alerts,
    subscribedSensors,
    connect,
    disconnect,
    subscribeToSensor,
    unsubscribeFromSensor,
    getActiveSensors,
    requestHistoricalData,
    clearAlerts,
    acknowledgeAlert
  };

  return (
    <SignalRContext.Provider value={contextValue}>
      {children}
    </SignalRContext.Provider>
  );
};

export const useSignalR = (): SignalRContextType => {
  const context = useContext(SignalRContext);
  if (!context) {
    throw new Error('useSignalR must be used within a SignalRProvider');
  }
  return context;
};