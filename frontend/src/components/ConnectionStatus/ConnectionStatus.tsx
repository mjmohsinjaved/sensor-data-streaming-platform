import React from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface ConnectionStatusProps {
  isConnected: boolean;
  error?: string | null;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnected, error }) => {
  return (
    <div className="flex items-center space-x-2">
      {error && (
        <div className="flex items-center space-x-1 text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      <div
        className={clsx(
          'flex items-center space-x-2 px-3 py-1 rounded-full transition-all',
          isConnected
            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
            : 'bg-red-500/10 text-red-400 border border-red-500/30'
        )}
      >
        {isConnected ? (
          <>
            <Wifi className="h-4 w-4" />
            <span className="text-sm font-medium">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">Disconnected</span>
          </>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;