import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { SignalRService } from '../services/signalr/SignalRService';
import type { ConnectionState, ConnectionStatus } from '../types/signalr.types';

interface SignalRContextType {
  connectionState: ConnectionState;
  connectionStatus: ConnectionStatus;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
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

    service.on('connectionStatusChanged', handleConnectionStatusChanged);

    if (autoConnect) {
      connect();
    }

    return () => {
      service.off('connectionStatusChanged', handleConnectionStatusChanged);

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
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }, []);

  const contextValue: SignalRContextType = {
    connectionState,
    connectionStatus,
    connect,
    disconnect
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