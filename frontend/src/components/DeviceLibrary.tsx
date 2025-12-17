import React, { useState } from 'react';
import { DeviceTemplate } from '../types';
import { Network, Search, ChevronDown, ChevronRight, Plus, Edit, ChevronLeft } from 'lucide-react';

interface DeviceLibraryProps {
  templates: DeviceTemplate[];
  workspaceId?: string;
  onDeviceSelect: (template: DeviceTemplate) => void;
  onDeviceDragStart?: (template: DeviceTemplate, event: React.DragEvent) => void;
  onEditTemplate?: (template: DeviceTemplate) => void;
  onCreateTemplate?: () => void;
}

interface Category {
  name: string;
  icon: React.ReactNode;
  deviceTypes: string[];
}

const DeviceLibrary: React.FC<DeviceLibraryProps> = ({
  templates,
  workspaceId,
  onDeviceSelect,
  onDeviceDragStart,
  onEditTemplate,
  onCreateTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Load collapsed state from sessionStorage
  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem('markd_device_library_collapsed');
      if (saved !== null) {
        setIsCollapsed(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading collapsed state:', e);
    }
  }, []);

  // Save collapsed state to sessionStorage
  React.useEffect(() => {
    try {
      sessionStorage.setItem('markd_device_library_collapsed', JSON.stringify(isCollapsed));
    } catch (e) {
      console.error('Error saving collapsed state:', e);
    }
  }, [isCollapsed]);
  
  // Debug: log templates when they change
  React.useEffect(() => {
    console.log('DeviceLibrary: templates loaded', templates.length, templates.map(t => t.device_type));
  }, [templates]);
  
  const getCategoryKey = (categoryName: string) => {
    return categoryName.toLowerCase().replace(/\s+/g, '_').replace(/&/g, '').replace(/é/g, 'e');
  };

  // Load expanded categories from sessionStorage
  const loadExpandedCategories = (): Record<string, boolean> => {
    try {
      const saved = sessionStorage.getItem('markd_device_library_expanded');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading expanded categories:', e);
    }
    // Default: all expanded
    return {
      routers: true,
      switches: true,
      endpoints: true,
      serveurs_securite: true,
    };
  };

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(loadExpandedCategories);

  // Save to sessionStorage when expandedCategories changes
  React.useEffect(() => {
    try {
      sessionStorage.setItem('markd_device_library_expanded', JSON.stringify(expandedCategories));
    } catch (e) {
      console.error('Error saving expanded categories:', e);
    }
  }, [expandedCategories]);

  // Categorize devices
  const categories: Category[] = [
    {
      name: 'Routers',
      icon: <Network size={16} className="text-blue-600 dark:text-blue-400" />,
      deviceTypes: ['mikrotik_routeros', 'tplink_omada', 'router_generic', 'box_internet'],
    },
    {
      name: 'Switches',
      icon: <Network size={16} className="text-green-600 dark:text-green-400" />,
      deviceTypes: ['switch_24', 'switch_48'],
    },
    {
      name: 'Endpoints',
      icon: <Network size={16} className="text-purple-600 dark:text-purple-400" />,
      deviceTypes: ['computer', 'phone_ip', 'ap_wifi'],
    },
    {
      name: 'Serveurs & Sécurité',
      icon: <Network size={16} className="text-red-600 dark:text-red-400" />,
      deviceTypes: ['server', 'firewall'],
    },
  ];

  const toggleCategory = (categoryName: string) => {
    const key = getCategoryKey(categoryName);
    setExpandedCategories(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.device_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryTemplates = (category: Category) => {
    return filteredTemplates.filter(t => category.deviceTypes.includes(t.device_type));
  };

  const handleDragStart = (template: DeviceTemplate, event: React.DragEvent) => {
    if (onDeviceDragStart) {
      onDeviceDragStart(template, event);
    } else {
      // Default drag behavior
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/json', JSON.stringify(template));
    }
  };

  return (
    <div className={`${isCollapsed ? 'w-12' : 'w-64'} h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out`}>
      {/* Header */}
      <div className={`border-b border-gray-200 dark:border-gray-700 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {isCollapsed ? (
          <div className="flex items-center justify-center">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Afficher la bibliothèque"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                Bibliothèque d'appareils
              </h3>
              <div className="flex items-center gap-2">
                {onCreateTemplate && (
                  <button
                    onClick={onCreateTemplate}
                    className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 rounded transition-colors"
                    title="Créer un template personnalisé"
                  >
                    <Plus size={18} />
                  </button>
                )}
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Replier la bibliothèque"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}
      </div>

      {/* Categories and Devices */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-2">
        {templates.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            Chargement des templates...
          </div>
        )}
        {categories.map(category => {
          const categoryTemplates = getCategoryTemplates(category);
          if (categoryTemplates.length === 0 && searchQuery) return null;

          const categoryKey = getCategoryKey(category.name);
          const isExpanded = expandedCategories[categoryKey] ?? true;

          return (
            <div key={category.name} className="mb-2">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.name)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
                {category.icon}
                <span>{category.name}</span>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                  ({categoryTemplates.length})
                </span>
              </button>

              {/* Category Devices */}
              {isExpanded && (
                <div className="ml-6 space-y-1">
                  {categoryTemplates.map(template => (
                    <div
                      key={template.device_type}
                      draggable
                      onDragStart={(e) => handleDragStart(template, e)}
                      onClick={() => onDeviceSelect(template)}
                      className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-move transition-colors group relative"
                    >
                      <div className="flex items-start gap-2">
                        {/* Device icon preview */}
                        <div className="flex-shrink-0 w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                          <Network
                            size={20}
                            className="text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                              {template.name}
                            </div>
                            {template.is_custom && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                                Perso
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                            {template.description}
                          </div>
                          {/* Port count */}
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {template.default_ports?.length || 0} port{template.default_ports?.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        {/* Edit/Delete buttons for custom templates */}
                        {template.is_custom && onEditTemplate && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditTemplate(template);
                              }}
                              className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 rounded"
                              title="Modifier le template"
                            >
                              <Edit size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* No results */}
        {searchQuery && filteredTemplates.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            Aucun appareil trouvé
          </div>
        )}
        </div>
      )}
    </div>
  );
};

export default DeviceLibrary;

