import React from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import { SensorType, SENSOR_CONFIG } from '../../types/sensor.types';

interface SensorSelectorProps {
  selectedSensors: Set<SensorType>;
  onSensorToggle: (sensorType: SensorType) => void;
}

const SensorSelector: React.FC<SensorSelectorProps> = ({ selectedSensors, onSensorToggle }) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-6 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-4">
        Select Sensors to Monitor
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.values(SensorType).map((sensorType) => {
          const config = SENSOR_CONFIG[sensorType];
          const isSelected = selectedSensors.has(sensorType);

          return (
            <button
              key={sensorType}
              onClick={() => onSensorToggle(sensorType)}
              className={clsx(
                'relative p-4 rounded-lg border transition-all duration-200',
                'hover:shadow-lg hover:scale-105 active:scale-95',
                isSelected
                  ? 'border-blue-500 bg-blue-500/10 shadow-lg'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              )}
            >
              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                </div>
              )}

              {/* Sensor Icon */}
              <div className="text-3xl mb-2">{config.icon}</div>

              {/* Sensor Label */}
              <div className="text-sm font-medium text-gray-300">
                {config.label}
              </div>

              {/* Sensor Range */}
              <div className="text-xs text-gray-500 mt-1">
                {config.min} - {config.max} {config.unit}
              </div>

              {/* Status Dot */}
              <div className="mt-2 flex justify-center">
                <div
                  className={clsx(
                    'h-2 w-2 rounded-full',
                    isSelected
                      ? 'bg-green-500 animate-pulse'
                      : 'bg-gray-600'
                  )}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SensorSelector;