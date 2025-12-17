import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SchemaDetail, Device, Connection, DeviceTemplate } from '../types';
import { api } from '../services/api';
import { ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import DeviceRenderer from './DeviceRenderer';
import ConnectionRenderer from './ConnectionRenderer';
import DeviceLibrary from './DeviceLibrary';

interface SchemaCanvasProps {
  schema: SchemaDetail;
  devices: Device[];
  connections: Connection[];
  onDevicesChange: (devices: Device[]) => void;
  onConnectionsChange: (connections: Connection[]) => void;
  onDeviceSelect?: (device: Device | null) => void;
  onTemplatesLoaded?: (templates: DeviceTemplate[]) => void;
  workspaceId?: string;
  onEditTemplate?: (template: DeviceTemplate) => void;
  onCreateTemplate?: () => void;
  refreshTemplatesTrigger?: number;
}

const SchemaCanvas: React.FC<SchemaCanvasProps> = ({
  schema,
  devices,
  connections,
  onDevicesChange,
  onConnectionsChange,
  onDeviceSelect,
  onTemplatesLoaded,
  workspaceId = 'demo',
  onEditTemplate,
  onCreateTemplate,
  refreshTemplatesTrigger,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  const [hoveredPort, setHoveredPort] = useState<{ deviceId: string; portName: string } | null>(null);
  const [templates, setTemplates] = useState<DeviceTemplate[]>([]);
  const [connectionMode, setConnectionMode] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{ deviceId: string; portName: string } | null>(null);
  const [draggingConnection, setDraggingConnection] = useState<{ deviceId: string; portName: string; startX: number; startY: number; endX: number; endY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Load device templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const result = await api.getDeviceTemplates(workspaceId);
        if (result.success) {
          setTemplates(result.templates);
          if (onTemplatesLoaded) {
            onTemplatesLoaded(result.templates);
          }
        }
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    };
    loadTemplates();
  }, [workspaceId, refreshTemplatesTrigger, onTemplatesLoaded]);

  const handleDeviceClick = (deviceId: string) => {
    if (connectionMode && connectionStart) {
      // Complete connection
      const device = devices.find(d => d.id === deviceId);
      const template = templates.find(t => t.device_type === device?.device_type);
      const port = hoveredPort?.deviceId === deviceId ? hoveredPort.portName : template?.default_ports?.[0]?.name;
      
      if (port && connectionStart.deviceId !== deviceId) {
        handleCreateConnection(connectionStart.deviceId, connectionStart.portName, deviceId, port);
      }
      setConnectionMode(false);
      setConnectionStart(null);
    } else {
      const newSelected = deviceId === selectedDevice ? null : deviceId;
      setSelectedDevice(newSelected);
      setSelectedConnection(null);
      
      // Notify parent component
      if (onDeviceSelect) {
        const device = devices.find(d => d.id === newSelected);
        onDeviceSelect(device || null);
      }
    }
  };

  const handlePortClick = (deviceId: string, portName: string) => {
    console.log('Port clicked:', deviceId, portName, 'connectionMode:', connectionMode, 'connectionStart:', connectionStart);
    if (connectionMode) {
      if (connectionStart) {
        // Complete connection
        if (connectionStart.deviceId !== deviceId) {
          handleCreateConnection(connectionStart.deviceId, connectionStart.portName, deviceId, portName);
        } else {
          // Same device, cancel and restart
          setConnectionStart({ deviceId, portName });
        }
        setConnectionMode(false);
        setConnectionStart(null);
      } else {
        // Start connection
        setConnectionStart({ deviceId, portName });
      }
    } else {
      // If not in connection mode, activate it and start connection
      setConnectionMode(true);
      setConnectionStart({ deviceId, portName });
    }
  };

  // Helper function to get port position
  const getPortPosition = (device: Device, template: DeviceTemplate | undefined, portName: string): { x: number; y: number } | null => {
    if (!template) return null;
    const port = template.default_ports?.find(p => p.name === portName);
    if (!port) return null;
    
    const width = template.default_size?.width || 100;
    const height = template.default_size?.height || 80;
    const portSpacing = 32;
    
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

  const handleCreateConnection = async (fromDeviceId: string, fromPort: string, toDeviceId: string, toPort: string) => {
    try {
      const result = await api.createConnection(schema.id, {
        from_device_id: fromDeviceId,
        from_port: fromPort,
        to_device_id: toDeviceId,
        to_port: toPort,
        connection_type: 'ethernet',
      });
      if (result.success && result.connection) {
        onConnectionsChange([...connections, result.connection]);
      }
    } catch (error) {
      console.error('Error creating connection:', error);
    }
  };

  const [draggingDeviceId, setDraggingDeviceId] = useState<string | null>(null);
  const [tempPosition, setTempPosition] = useState<Record<string, { x: number; y: number }>>({});

  const handleDeviceDragStart = useCallback((deviceId: string) => {
    setDraggingDeviceId(deviceId);
  }, []);

  const handleDeviceDrag = useCallback((deviceId: string, newX: number, newY: number) => {
    // Update temporary position for smooth dragging
    setTempPosition(prev => ({
      ...prev,
      [deviceId]: { x: Math.max(0, newX), y: Math.max(0, newY) }
    }));
  }, []);

  const handleDeviceDragEnd = useCallback(async (deviceId: string, newX: number, newY: number) => {
    setDraggingDeviceId(null);
    const finalX = Math.max(0, newX);
    const finalY = Math.max(0, newY);
    
    const device = devices.find(d => d.id === deviceId);
    const roundedX = Math.round(finalX);
    const roundedY = Math.round(finalY);
    if (device && (device.position_x !== roundedX || device.position_y !== roundedY)) {
      try {
        await api.updateDevice(schema.id, deviceId, { position_x: roundedX, position_y: roundedY });
        onDevicesChange(devices.map(d => d.id === deviceId ? { ...d, position_x: roundedX, position_y: roundedY } : d));
        setTempPosition(prev => {
          const next = { ...prev };
          delete next[deviceId];
          return next;
        });
      } catch (error) {
        console.error('Error updating device position:', error);
        // Revert to original position on error
        setTempPosition(prev => {
          const next = { ...prev };
          delete next[deviceId];
          return next;
        });
      }
    }
  }, [devices, schema.id, onDevicesChange]);

  const handleTemplateDragStart = (template: DeviceTemplate, event: React.DragEvent) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify(template));
  };

  const handleCanvasDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    if (!svgRef.current) return;

    const templateJson = event.dataTransfer.getData('application/json');
    if (!templateJson) return;

    try {
      const template: DeviceTemplate = JSON.parse(templateJson);
      if (!svgRef.current) return;
      
      // Get the point in SVG coordinate system accounting for zoom and pan
      const svgPoint = svgRef.current.createSVGPoint();
      svgPoint.x = event.clientX;
      svgPoint.y = event.clientY;
      const ctm = svgRef.current.getScreenCTM();
      if (!ctm) return;
      
      const svgPointTransformed = svgPoint.matrixTransform(ctm.inverse());
      const x = svgPointTransformed.x;
      const y = svgPointTransformed.y;

      const result = await api.createDevice(schema.id, {
        device_type: template.device_type,
        name: template.name,
        position_x: Math.round(Math.max(0, x - (template.default_size?.width || 100) / 2)),
        position_y: Math.round(Math.max(0, y - (template.default_size?.height || 80) / 2)),
      });

      if (result.success && result.device) {
        onDevicesChange([...devices, result.device]);
      }
    } catch (error) {
      console.error('Error creating device:', error);
    }
  };

  const handleDeviceSelect = async (template: DeviceTemplate) => {
    // Add device at center of canvas
    const centerX = 400;
    const centerY = 300;
    
    try {
      const result = await api.createDevice(schema.id, {
        device_type: template.device_type,
        name: template.name,
        position_x: Math.round(centerX - (template.default_size?.width || 100) / 2),
        position_y: Math.round(centerY - (template.default_size?.height || 80) / 2),
      });

      if (result.success && result.device) {
        onDevicesChange([...devices, result.device]);
      }
    } catch (error) {
      console.error('Error creating device:', error);
    }
  };

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      {/* Device Library Sidebar */}
      <DeviceLibrary
        templates={templates}
        onDeviceSelect={handleDeviceSelect}
        onDeviceDragStart={handleTemplateDragStart}
        onEditTemplate={onEditTemplate}
        onCreateTemplate={onCreateTemplate}
      />

      {/* Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{
            cursor: connectionMode ? 'crosshair' : draggingDeviceId ? 'grabbing' : 'default',
            transformOrigin: '0 0',
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          }}
          onDrop={handleCanvasDrop}
          onDragOver={(e) => e.preventDefault()}
          onWheel={(e) => {
            // Zoom with Shift + wheel
            if (e.shiftKey) {
              e.preventDefault();
              const delta = e.deltaY > 0 ? -0.1 : 0.1;
              setZoom(prev => Math.max(0.5, Math.min(2, prev + delta)));
            }
          }}
          onMouseMove={(e) => {
            // Update dragging connection line
            if (draggingConnection && svgRef.current) {
              const svgPoint = svgRef.current.createSVGPoint();
              svgPoint.x = e.clientX;
              svgPoint.y = e.clientY;
              const ctm = svgRef.current.getScreenCTM();
              if (ctm) {
                const svgPointTransformed = svgPoint.matrixTransform(ctm.inverse());
                setDraggingConnection(prev => prev ? { ...prev, endX: svgPointTransformed.x, endY: svgPointTransformed.y } : null);
              }
            }
          }}
          onMouseUp={(e) => {
            // Complete connection on mouse up over a port
            if (draggingConnection && hoveredPort) {
              if (hoveredPort.deviceId !== draggingConnection.deviceId) {
                handleCreateConnection(draggingConnection.deviceId, draggingConnection.portName, hoveredPort.deviceId, hoveredPort.portName);
              }
              setDraggingConnection(null);
              setConnectionMode(false);
              setConnectionStart(null);
            } else if (draggingConnection) {
              // Cancel if not over a port
              setDraggingConnection(null);
              setConnectionMode(false);
              setConnectionStart(null);
            }
          }}
        >
          {/* Grid background */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5" className="dark:stroke-gray-700" />
            </pattern>
            {/* Arrow marker for connections */}
            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
              <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
            </marker>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Temporary connection line while dragging */}
          {draggingConnection && (
            <line
              x1={draggingConnection.startX}
              y1={draggingConnection.startY}
              x2={draggingConnection.endX}
              y2={draggingConnection.endY}
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="5,5"
              markerEnd="url(#arrowhead)"
              className="pointer-events-none"
            />
          )}

          {/* Connections - render first so they appear behind devices */}
          {connections.map(conn => {
            // Use temporary positions if devices are being dragged
            const fromDeviceOriginal = devices.find(d => d.id === conn.from_device_id);
            const toDeviceOriginal = devices.find(d => d.id === conn.to_device_id);
            
            const fromDevice = fromDeviceOriginal && tempPosition[fromDeviceOriginal.id]
              ? { ...fromDeviceOriginal, position_x: tempPosition[fromDeviceOriginal.id].x, position_y: tempPosition[fromDeviceOriginal.id].y }
              : fromDeviceOriginal;
            
            const toDevice = toDeviceOriginal && tempPosition[toDeviceOriginal.id]
              ? { ...toDeviceOriginal, position_x: tempPosition[toDeviceOriginal.id].x, position_y: tempPosition[toDeviceOriginal.id].y }
              : toDeviceOriginal;
            
            const fromTemplate = templates.find(t => t.device_type === fromDevice?.device_type);
            const toTemplate = templates.find(t => t.device_type === toDevice?.device_type);

            return (
              <ConnectionRenderer
                key={conn.id}
                connection={conn}
                fromDevice={fromDevice}
                toDevice={toDevice}
                fromTemplate={fromTemplate}
                toTemplate={toTemplate}
                isSelected={selectedConnection === conn.id}
                isHovered={hoveredConnection === conn.id}
                onClick={setSelectedConnection}
                onHover={setHoveredConnection}
              />
            );
          })}

          {/* Devices */}
          {devices.map(device => {
            const template = templates.find(t => t.device_type === device.device_type);
            const isSelected = selectedDevice === device.id;
            const isDraggingDevice = draggingDeviceId === device.id;
            
            // Use temporary position if device is being dragged
            const displayDevice = tempPosition[device.id] 
              ? { ...device, position_x: tempPosition[device.id].x, position_y: tempPosition[device.id].y }
              : device;

            return (
              <DeviceRenderer
                key={device.id}
                device={displayDevice}
                template={template}
                isSelected={isSelected}
                isDragging={isDraggingDevice}
                onClick={handleDeviceClick}
                onPortClick={handlePortClick}
                onPortHover={(deviceId, portName) => setHoveredPort(portName ? { deviceId, portName } : null)}
                onPortDragStart={(deviceId, portName, e) => {
                  // Start dragging connection from port
                  const svgElement = e.currentTarget.ownerSVGElement;
                  if (!svgElement) return;
                  const svgPoint = svgElement.createSVGPoint();
                  svgPoint.x = e.clientX;
                  svgPoint.y = e.clientY;
                  const ctm = svgElement.getScreenCTM();
                  if (!ctm) return;
                  const svgPointTransformed = svgPoint.matrixTransform(ctm.inverse());
                  
                  const device = devices.find(d => d.id === deviceId);
                  const template = templates.find(t => t.device_type === device?.device_type);
                  if (!device || !template) return;
                  
                  const pos = getPortPosition(device, template, portName);
                  if (!pos) return;
                  
                  setConnectionMode(true);
                  setConnectionStart({ deviceId, portName });
                  setDraggingConnection({ deviceId, portName, startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
                }}
                onDragStart={handleDeviceDragStart}
                onDrag={handleDeviceDrag}
                onDragEnd={handleDeviceDragEnd}
              />
            );
          })}
        </svg>

        {/* Toolbar */}
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 flex flex-col gap-2">
          <button
            onClick={() => setZoom(prev => Math.min(prev + 0.1, 2))}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={16} className="text-gray-600 dark:text-gray-300" />
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.5))}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={16} className="text-gray-600 dark:text-gray-300" />
          </button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Reset view"
          >
            <RotateCcw size={16} className="text-gray-600 dark:text-gray-300" />
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          <button
            onClick={() => {
              setConnectionMode(!connectionMode);
              setConnectionStart(null);
            }}
            className={`p-2 rounded transition-colors ${
              connectionMode
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
            title="Connection mode"
          >
            <Move size={16} />
          </button>
        </div>

        {/* Connection mode indicator */}
        {connectionMode && (
          <div className="absolute top-4 left-4 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
            {connectionStart
              ? 'Cliquez sur un port de destination'
              : 'Cliquez sur un port source'}
            <button
              onClick={() => {
                setConnectionMode(false);
                setConnectionStart(null);
              }}
              className="ml-2 text-blue-500 hover:text-blue-700 dark:hover:text-blue-200"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchemaCanvas;

