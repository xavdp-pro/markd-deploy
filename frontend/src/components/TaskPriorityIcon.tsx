import React from 'react';
import { AlertCircle, AlertTriangle, Circle } from 'lucide-react';

interface TaskPriorityIconProps {
  priority: 'low' | 'medium' | 'high';
  size?: number;
  showLabel?: boolean;
  className?: string;
}

const TaskPriorityIcon: React.FC<TaskPriorityIconProps> = ({
  priority,
  size = 16,
  showLabel = false,
  className = '',
}) => {
  const config = {
    high: {
      icon: AlertCircle,
      color: 'text-red-500',
      label: 'Haute',
    },
    medium: {
      icon: AlertTriangle,
      color: 'text-orange-500',
      label: 'Moyenne',
    },
    low: {
      icon: Circle,
      color: 'text-gray-400',
      label: 'Basse',
    },
  };

  const { icon: Icon, color, label } = config[priority];

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Icon size={size} className={color} />
      {showLabel && <span className={`text-sm ${color}`}>{label}</span>}
    </div>
  );
};

export default TaskPriorityIcon;

