import React from 'react';
import { Connection, Device, DeviceTemplate } from '../types';

interface ConnectionRendererProps {
  connection: Connection;
  fromDevice: Device | undefined;
  toDevice: Device | undefined;
  fromTemplate: DeviceTemplate | undefined;
  toTemplate: DeviceTemplate | undefined;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: (connectionId: string) => void;
  onHover?: (connectionId: string | null) => void;
}

const ConnectionRenderer: React.FC<ConnectionRendererProps> = ({
  connection,
  fromDevice,
  toDevice,
  fromTemplate,
  toTemplate,
  isSelected = false,
  isHovered = false,
  onClick,
  onHover,
}) => {
  if (!fromDevice || !toDevice) return null;

  // Find port positions
  const getPortPosition = (
    device: Device,
    template: DeviceTemplate | undefined,
    portName: string
  ): { x: number; y: number } | null => {
    if (!template) {
      // Default position (center of device)
      const width = 100;
      const height = 80;
      return {
        x: device.position_x + width / 2,
        y: device.position_y + height / 2,
      };
    }

    const port = template.default_ports?.find(p => p.name === portName);
    if (!port) return null;

    const width = template.default_size?.width || 100;
    const height = template.default_size?.height || 80;
    const portSize = 6;
    const portSpacing = 32;

    // Count ports at same position to calculate offset
    const samePositionPorts = template.default_ports?.filter(p => p.position === port.position) || [];
    const index = samePositionPorts.findIndex(p => p.name === portName);
    const offset = (index - (samePositionPorts.length - 1) / 2) * portSpacing;

    let x = 0;
    let y = 0;

    switch (port.position) {
      case 'left':
        x = -2;
        y = height / 2 + offset;
        break;
      case 'right':
        x = width + 2;
        y = height / 2 + offset;
        break;
      case 'top':
        x = width / 2 + offset;
        y = -2;
        break;
      case 'bottom':
        x = width / 2 + offset;
        y = height + 2;
        break;
    }

    return {
      x: device.position_x + x,
      y: device.position_y + y,
    };
  };

  const fromPos = getPortPosition(fromDevice, fromTemplate, connection.from_port);
  const toPos = getPortPosition(toDevice, toTemplate, connection.to_port);

  if (!fromPos || !toPos) return null;

  // Calculate control points for bezier curve (to avoid overlapping)
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const curvature = Math.min(distance * 0.3, 50);

  // Determine curve direction based on connection direction
  const controlPoint1 = {
    x: fromPos.x + (dx > 0 ? curvature : -curvature),
    y: fromPos.y,
  };
  const controlPoint2 = {
    x: toPos.x - (dx > 0 ? curvature : -curvature),
    y: toPos.y,
  };

  // Connection color based on type and state
  let strokeColor = '#3b82f6'; // Default blue
  if (connection.connection_type === 'WAN') {
    strokeColor = '#ef4444'; // Red for WAN
  } else if (isSelected) {
    strokeColor = '#10b981'; // Green when selected
  } else if (isHovered) {
    strokeColor = '#f59e0b'; // Orange when hovered
  }

  const strokeWidth = isSelected ? 3 : isHovered ? 2.5 : 2;

  return (
    <g
      onClick={() => onClick?.(connection.id)}
      onMouseEnter={() => onHover?.(connection.id)}
      onMouseLeave={() => onHover?.(null)}
      className="cursor-pointer"
    >
      {/* Bezier curve path */}
      <path
        d={`M ${fromPos.x} ${fromPos.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${toPos.x} ${toPos.y}`}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        markerEnd="url(#arrowhead)"
        opacity={isHovered ? 0.8 : 1}
      />

      {/* Connection label (if VLAN or bandwidth specified) */}
      {(connection.vlan_id || connection.bandwidth) && (
        <g>
          {/* Background for text */}
          <rect
            x={(fromPos.x + toPos.x) / 2 - 30}
            y={(fromPos.y + toPos.y) / 2 - 8}
            width={60}
            height={16}
            fill="#ffffff"
            stroke={strokeColor}
            strokeWidth="1"
            rx="3"
            className="dark:fill-gray-800 dark:stroke-gray-600"
          />
          <text
            x={(fromPos.x + toPos.x) / 2}
            y={(fromPos.y + toPos.y) / 2 + 4}
            textAnchor="middle"
            className="text-xs fill-gray-700 dark:fill-gray-300 pointer-events-none"
            style={{ fontSize: '10px' }}
          >
            {connection.vlan_id ? `VLAN ${connection.vlan_id}` : ''}
            {connection.vlan_id && connection.bandwidth ? ' / ' : ''}
            {connection.bandwidth || ''}
          </text>
        </g>
      )}
    </g>
  );
};

export default ConnectionRenderer;

