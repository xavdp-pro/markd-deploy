import React, { useState, useEffect } from 'react';
import { CustomDeviceTemplate, DeviceTemplate } from '../types';
import { api } from '../services/api';
import { X, Plus, Trash2, Save } from 'lucide-react';

interface CustomTemplateEditorProps {
  template?: CustomDeviceTemplate | DeviceTemplate | null;
  workspaceId: string;
  onClose: () => void;
  onSave: () => void;
}

const CustomTemplateEditor: React.FC<CustomTemplateEditorProps> = ({
  template,
  workspaceId,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [description, setDescription] = useState('');
  const [ports, setPorts] = useState<Array<{ name: string; type: 'WAN' | 'LAN'; position: 'left' | 'right' | 'top' | 'bottom' }>>([]);
  const [width, setWidth] = useState(100);
  const [height, setHeight] = useState(80);
  const [iconSvg, setIconSvg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDeviceType(template.device_type);
      setDescription(template.description || '');
      setPorts(template.default_ports || []);
      setWidth(template.default_size?.width || 100);
      setHeight(template.default_size?.height || 80);
      setIconSvg(template.icon_svg || '');
    }
  }, [template]);

  const addPort = () => {
    setPorts([...ports, { name: `Port${ports.length + 1}`, type: 'LAN', position: 'right' }]);
  };

  const removePort = (index: number) => {
    setPorts(ports.filter((_, i) => i !== index));
  };

  const updatePort = (index: number, field: string, value: any) => {
    const updated = [...ports];
    updated[index] = { ...updated[index], [field]: value };
    setPorts(updated);
  };

  const handleSave = async () => {
    if (!name || !deviceType || ports.length === 0) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setSaving(true);
    try {
      const data = {
        device_type: deviceType,
        name,
        description,
        default_ports: ports,
        icon_svg: iconSvg || undefined,
        default_size: { width, height },
      };

      if (template && 'id' in template) {
        // Update existing
        await api.updateCustomTemplate(template.id, workspaceId, data);
      } else {
        // Create new
        await api.createCustomTemplate(workspaceId, data);
      }
      
      onSave();
      onClose();
    } catch (error: any) {
      alert('Erreur: ' + (error.message || 'Impossible de sauvegarder le template'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {template && 'id' in template ? 'Modifier le template' : 'Créer un template personnalisé'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nom du template *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Ex: Mikrotik RB931"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type d'appareil (ID) *
                </label>
                <input
                  type="text"
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Ex: mikrotik_rb931"
                  disabled={!!(template && 'id' in template)}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Identifiant unique (ne peut pas être modifié)
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                rows={2}
                placeholder="Description du template"
              />
            </div>

            {/* Size */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Largeur (px)
                </label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value) || 100)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  min="50"
                  max="300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hauteur (px)
                </label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value) || 80)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  min="50"
                  max="300"
                />
              </div>
            </div>

            {/* Ports */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ports *
                </label>
                <button
                  onClick={addPort}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <Plus size={14} />
                  Ajouter un port
                </button>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {ports.map((port, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <input
                      type="text"
                      value={port.name}
                      onChange={(e) => updatePort(index, 'name', e.target.value)}
                      placeholder="Nom du port"
                      className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                    />
                    <select
                      value={port.type}
                      onChange={(e) => updatePort(index, 'type', e.target.value)}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                    >
                      <option value="WAN">WAN</option>
                      <option value="LAN">LAN</option>
                    </select>
                    <select
                      value={port.position}
                      onChange={(e) => updatePort(index, 'position', e.target.value)}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                    >
                      <option value="left">Gauche</option>
                      <option value="right">Droite</option>
                      <option value="top">Haut</option>
                      <option value="bottom">Bas</option>
                    </select>
                    <button
                      onClick={() => removePort(index)}
                      className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {ports.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    Aucun port défini. Cliquez sur "Ajouter un port" pour commencer.
                  </p>
                )}
              </div>
            </div>

            {/* Icon SVG (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Icône SVG (optionnel)
              </label>
              <textarea
                value={iconSvg}
                onChange={(e) => setIconSvg(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs"
                rows={4}
                placeholder='<rect x="10" y="10" width="80" height="60" rx="5" fill="#1e3a8a"/>'
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Code SVG pour l'icône de l'appareil (sans balise &lt;svg&gt;)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name || !deviceType || ports.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={16} />
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomTemplateEditor;

