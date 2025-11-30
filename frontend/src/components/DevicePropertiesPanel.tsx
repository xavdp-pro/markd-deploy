import React, { useState, useEffect } from 'react';
import { Device, DeviceTemplate } from '../types';
import { api } from '../services/api';
import { X, Save, Trash2, Copy, Edit2 } from 'lucide-react';

interface DevicePropertiesPanelProps {
  device: Device | null;
  template: DeviceTemplate | undefined;
  schemaId: string;
  onClose: () => void;
  onUpdate: (device: Device) => void;
  onDelete: (deviceId: string) => void;
}

const DevicePropertiesPanel: React.FC<DevicePropertiesPanelProps> = ({
  device,
  template,
  schemaId,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    model: '',
    ip_address: '',
    mac_address: '',
    position_x: 0,
    position_y: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (device) {
      setFormData({
        name: device.name || '',
        model: device.model || '',
        ip_address: device.ip_address || '',
        mac_address: device.mac_address || '',
        position_x: device.position_x || 0,
        position_y: device.position_y || 0,
      });
      setIsEditing(false);
    }
  }, [device]);

  const handleSave = async () => {
    if (!device) return;

    setIsSaving(true);
    try {
      const result = await api.updateDevice(schemaId, device.id, {
        name: formData.name,
        model: formData.model,
        ip_address: formData.ip_address,
        mac_address: formData.mac_address,
        position_x: formData.position_x,
        position_y: formData.position_y,
      });

      if (result.success && result.device) {
        onUpdate(result.device);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error updating device:', error);
      alert('Erreur lors de la mise à jour de l\'appareil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!device) return;

    if (confirm(`Êtes-vous sûr de vouloir supprimer l'appareil "${device.name}" ?`)) {
      try {
        await api.deleteDevice(schemaId, device.id);
        onDelete(device.id);
        onClose();
      } catch (error) {
        console.error('Error deleting device:', error);
        alert('Erreur lors de la suppression de l\'appareil');
      }
    }
  };

  const handleDuplicate = async () => {
    if (!device || !template) return;

    try {
      const result = await api.createDevice(schemaId, {
        device_type: device.device_type,
        name: `${device.name} (copie)`,
        model: device.model,
        ip_address: '',
        mac_address: '',
        position_x: device.position_x + 20,
        position_y: device.position_y + 20,
      });

      if (result.success && result.device) {
        onUpdate(result.device);
      }
    } catch (error) {
      console.error('Error duplicating device:', error);
      alert('Erreur lors de la duplication de l\'appareil');
    }
  };

  if (!device) {
    return (
      <div className="w-80 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4">
        <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
          Sélectionnez un appareil pour voir ses propriétés
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
          Propriétés de l'appareil
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <X size={20} className="text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Device Type Info */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Type d'appareil</div>
          <div className="font-medium text-sm text-gray-900 dark:text-white">
            {template?.name || device.device_type}
          </div>
          {template?.description && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {template.description}
            </div>
          )}
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nom *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={!isEditing}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Modèle
            </label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              disabled={!isEditing}
              placeholder="Ex: RB750Gr3"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Adresse IP
            </label>
            <input
              type="text"
              value={formData.ip_address}
              onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
              disabled={!isEditing}
              placeholder="Ex: 192.168.1.1"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Adresse MAC
            </label>
            <input
              type="text"
              value={formData.mac_address}
              onChange={(e) => setFormData({ ...formData, mac_address: e.target.value })}
              disabled={!isEditing}
              placeholder="Ex: 00:11:22:33:44:55"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Position */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Position X
              </label>
              <input
                type="number"
                value={formData.position_x}
                onChange={(e) => setFormData({ ...formData, position_x: parseInt(e.target.value) || 0 })}
                disabled={!isEditing}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Position Y
              </label>
              <input
                type="number"
                value={formData.position_y}
                onChange={(e) => setFormData({ ...formData, position_y: parseInt(e.target.value) || 0 })}
                disabled={!isEditing}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Ports Info */}
          {template?.default_ports && template.default_ports.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ports ({template.default_ports.length})
              </label>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
                {template.default_ports.map((port, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 dark:text-gray-300">{port.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      port.type === 'WAN'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    }`}>
                      {port.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {!isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Edit2 size={16} />
              Modifier
            </button>
            <button
              onClick={handleDuplicate}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              title="Dupliquer"
            >
              <Copy size={16} />
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg transition-colors"
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !formData.name.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Save size={16} />
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                // Reset form data
                if (device) {
                  setFormData({
                    name: device.name || '',
                    model: device.model || '',
                    ip_address: device.ip_address || '',
                    mac_address: device.mac_address || '',
                    position_x: device.position_x || 0,
                    position_y: device.position_y || 0,
                  });
                }
              }}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DevicePropertiesPanel;

