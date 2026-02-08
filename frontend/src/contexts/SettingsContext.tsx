import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface ModuleSettings {
  documents: boolean;
  tasks: boolean;
  passwords: boolean;
  files: boolean;
  schemas: boolean;
}

interface SettingsContextType {
  modules: ModuleSettings;
  isLoading: boolean;
  updateModules: (settings: ModuleSettings) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: ModuleSettings = {
  documents: true,
  tasks: true,
  passwords: true,
  files: true,
  schemas: true,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modules, setModules] = useState<ModuleSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const settings = await api.getModuleSettings();
      setModules(settings);
    } catch (error) {
      console.error('Failed to fetch module settings:', error);
      // Fallback to defaults is already set
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateModules = async (newSettings: ModuleSettings) => {
    try {
      await api.updateModuleSettings(newSettings);
      setModules(newSettings);
    } catch (error) {
      console.error('Failed to update module settings:', error);
      throw error;
    }
  };

  return (
    <SettingsContext.Provider value={{ modules, isLoading, updateModules, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
