import React from 'react';
import { Device, DeviceTemplate } from '../types';

interface DeviceRendererProps {
  device: Device;
  template: DeviceTemplate | undefined;
  isSelected: boolean;
  isDragging?: boolean;
  onClick: (deviceId: string) => void;
  onPortClick?: (deviceId: string, portName: string) => void;
  onPortHover?: (deviceId: string, portName: string | null) => void;
  onPortDragStart?: (deviceId: string, portName: string, event: React.MouseEvent) => void;
  onDragStart?: (deviceId: string, event: React.MouseEvent) => void;
  onDrag?: (deviceId: string, x: number, y: number) => void;
  onDragEnd?: (deviceId: string, x: number, y: number) => void;
}

const DeviceRenderer: React.FC<DeviceRendererProps> = ({
  device,
  template,
  isSelected,
  isDragging = false,
  onClick,
  onPortClick,
  onPortHover,
  onPortDragStart,
  onDragStart,
  onDrag,
  onDragEnd,
}) => {
  const [isDraggingLocal, setIsDraggingLocal] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const svgElementRef = React.useRef<SVGSVGElement | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    e.stopPropagation();
    
    // Get the SVG element and store it for use during drag
    const svgElement = (e.currentTarget as SVGRectElement).ownerSVGElement;
    if (!svgElement) return;
    svgElementRef.current = svgElement;
    
    // Get the point in SVG coordinate system
    const svgPoint = svgElement.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    const ctm = svgElement.getScreenCTM();
    if (!ctm) return;
    
    const svgPointTransformed = svgPoint.matrixTransform(ctm.inverse());
    const mouseX = svgPointTransformed.x;
    const mouseY = svgPointTransformed.y;
    
    // Calculate offset from mouse click position to device top-left corner
    // This offset will be maintained during dragging
    const offsetX = mouseX - device.position_x;
    const offsetY = mouseY - device.position_y;
    
    setDragOffset({ x: offsetX, y: offsetY });
    setIsDraggingLocal(true);
    
    if (onDragStart) {
      onDragStart(device.id, e);
    }
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isDraggingLocal || !svgElementRef.current) return;
    
    const svgElement = svgElementRef.current;
    
    // Get the point in SVG coordinate system
    const svgPoint = svgElement.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    const ctm = svgElement.getScreenCTM();
    if (!ctm) return;
    
    const svgPointTransformed = svgPoint.matrixTransform(ctm.inverse());
    const mouseX = svgPointTransformed.x;
    const mouseY = svgPointTransformed.y;
    
    // Calculate device position by subtracting the offset
    const x = mouseX - dragOffset.x;
    const y = mouseY - dragOffset.y;
    
    if (onDrag) {
      onDrag(device.id, Math.max(0, x), Math.max(0, y));
    }
  }, [isDraggingLocal, dragOffset, device.id, onDrag]);

  const handleMouseUp = React.useCallback((e: MouseEvent) => {
    if (!isDraggingLocal || !svgElementRef.current) return;
    
    setIsDraggingLocal(false);
    const svgElement = svgElementRef.current;
    
    if (!onDragEnd) return;
    
    // Get the point in SVG coordinate system
    const svgPoint = svgElement.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    const ctm = svgElement.getScreenCTM();
    if (!ctm) return;
    
    const svgPointTransformed = svgPoint.matrixTransform(ctm.inverse());
    const mouseX = svgPointTransformed.x;
    const mouseY = svgPointTransformed.y;
    
    // Calculate device position by subtracting the offset
    const x = mouseX - dragOffset.x;
    const y = mouseY - dragOffset.y;
    
    onDragEnd(device.id, Math.max(0, x), Math.max(0, y));
    svgElementRef.current = null;
  }, [isDraggingLocal, dragOffset, device.id, onDragEnd]);

  React.useEffect(() => {
    if (isDraggingLocal) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingLocal, handleMouseMove, handleMouseUp]);
  const width = template?.default_size?.width || 100;
  const height = template?.default_size?.height || 80;
  const portSize = 6;
  const portSpacing = 32;

  // Calculate port positions based on template
  const getPortPosition = (port: { name: string; type: string; position: string }, index: number, samePositionCount: number) => {
    const { position } = port;
    const offset = (index - (samePositionCount - 1) / 2) * portSpacing;
    
    switch (position) {
      case 'left':
        return { x: -2, y: height / 2 + offset };
      case 'right':
        return { x: width + 2, y: height / 2 + offset };
      case 'top':
        return { x: width / 2 + offset, y: -2 };
      case 'bottom':
        return { x: width / 2 + offset, y: height + 2 };
      default:
        return { x: width / 2, y: height / 2 };
    }
  };

  // Group ports by position
  const portsByPosition: Record<string, typeof template.default_ports> = {};
  template?.default_ports?.forEach(port => {
    if (!portsByPosition[port.position]) {
      portsByPosition[port.position] = [];
    }
    portsByPosition[port.position].push(port);
  });

  // Render port
  const renderPort = (port: { name: string; type: string; position: string }, index: number, samePositionCount: number) => {
    const pos = getPortPosition(port, index, samePositionCount);
    const portX = device.position_x + pos.x;
    const portY = device.position_y + pos.y;
    
    const portColor = port.type === 'WAN' ? '#ef4444' : '#3b82f6';
    
    return (
      <g key={port.name} data-port={port.name} pointerEvents="all">
        {/* Invisible larger circle for easier clicking */}
        <circle
          cx={portX}
          cy={portY}
          r={portSize + 5}
          fill="transparent"
          stroke="none"
          className="cursor-crosshair"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('Port clicked:', device.id, port.name);
            onPortClick?.(device.id, port.name);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (onPortDragStart) {
              onPortDragStart(device.id, port.name, e);
            }
          }}
          onMouseEnter={() => onPortHover?.(device.id, port.name)}
          onMouseLeave={() => onPortHover?.(device.id, null)}
        />
        {/* Visible port circle */}
        <circle
          cx={portX}
          cy={portY}
          r={portSize}
          fill={portColor}
          stroke="#ffffff"
          strokeWidth="1.5"
          className="pointer-events-none"
        />
        {/* Port label with background for better visibility */}
        <g pointerEvents="none">
          {/* Background rectangle for text */}
          <rect
            x={portX - (port.name.length * 3.5)}
            y={portY - portSize - 18}
            width={port.name.length * 7}
            height={12}
            fill="rgba(0, 0, 0, 0.7)"
            rx="2"
          />
          <text
            x={portX}
            y={portY - portSize - 9}
            textAnchor="middle"
            className="fill-white pointer-events-none font-semibold"
            style={{ fontSize: '10px', letterSpacing: '0.3px' }}
          >
            {port.name}
          </text>
        </g>
      </g>
    );
  };

  const actualIsDragging = isDragging || isDraggingLocal;

  return (
    <g
      className={actualIsDragging ? 'opacity-50' : ''}
      onClick={(e) => {
        // Don't trigger device click if clicking on a port
        const target = e.target as SVGElement;
        if (!isDraggingLocal && target.tagName !== 'circle' && !target.closest('g[data-port]')) {
          onClick(device.id);
        }
      }}
    >
      {/* Device body */}
      <rect
        x={device.position_x}
        y={device.position_y}
        width={width}
        height={height}
        fill={isSelected ? '#dbeafe' : '#ffffff'}
        stroke={isSelected ? '#3b82f6' : '#e5e7eb'}
        strokeWidth={isSelected ? 3 : 2}
        rx="5"
        className="cursor-move dark:fill-gray-800 dark:stroke-gray-700"
        onMouseDown={(e) => {
          // Only handle drag if not clicking on a port
          const target = e.target as SVGElement;
          if (target.tagName !== 'circle' && !target.closest('g[data-port]')) {
            handleMouseDown(e);
          }
        }}
      />

      {/* Device icon (from template SVG or default) */}
      {template?.icon_svg ? (
        <g transform={`translate(${device.position_x}, ${device.position_y})`}>
          <g dangerouslySetInnerHTML={{ __html: template.icon_svg }} />
        </g>
      ) : (
        <rect
          x={device.position_x + 10}
          y={device.position_y + 10}
          width={width - 20}
          height={height - 40}
          fill="#f3f4f6"
          rx="3"
          className="dark:fill-gray-700"
        />
      )}

      {/* Device name with background for better visibility */}
      <g pointerEvents="none">
        {/* Background for device name */}
        <rect
          x={device.position_x + width / 2 - (device.name.length * 3.5)}
          y={device.position_y + height - 28}
          width={device.name.length * 7}
          height={14}
          fill="rgba(0, 0, 0, 0.75)"
          rx="3"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="0.5"
        />
        <text
          x={device.position_x + width / 2}
          y={device.position_y + height - 19}
          textAnchor="middle"
          className="fill-white pointer-events-none font-semibold"
          style={{ fontSize: '12px', letterSpacing: '0.3px' }}
        >
          {device.name}
        </text>
      </g>

      {/* Device IP address (if available) */}
      {device.ip_address && (
        <g pointerEvents="none">
          <rect
            x={device.position_x + width / 2 - (device.ip_address.length * 2.5)}
            y={device.position_y + height - 12}
            width={device.ip_address.length * 5}
            height={10}
            fill="rgba(0, 0, 0, 0.6)"
            rx="2"
          />
          <text
            x={device.position_x + width / 2}
            y={device.position_y + height - 5}
            textAnchor="middle"
            className="fill-gray-200 pointer-events-none"
            style={{ fontSize: '9px' }}
          >
            {device.ip_address}
          </text>
        </g>
      )}

      {/* Ports */}
      {template?.default_ports && Object.entries(portsByPosition).map(([position, ports]) =>
        ports.map((port, index) => renderPort(port, index, ports.length))
      )}
    </g>
  );
};

export default DeviceRenderer;

