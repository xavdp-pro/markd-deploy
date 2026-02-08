import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Workspace } from '../types';
import { useAuth } from './AuthContext';

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: string;
  workspaceName: string;
  userPermission: string;
  loading: boolean;
  setCurrentWorkspace: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<string>('demo');
  const [workspaceName, setWorkspaceName] = useState<string>('Documents');
  const [userPermission, setUserPermission] = useState<string>('read');
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const result = await api.getWorkspaces();
      if (result.success && result.workspaces) {
        setWorkspaces(result.workspaces);
        
        // If current workspace is not in list, select first one
        const currentExists = result.workspaces.find((w: Workspace) => w.id === currentWorkspace);
        if (!currentExists && result.workspaces.length > 0) {
          setCurrentWorkspace(result.workspaces[0].id);
        } else if (currentExists) {
          // Update name and permission from fresh data
          setWorkspaceName(currentExists.name);
          setUserPermission(currentExists.user_permission ?? 'read');
        }
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentWorkspace]);

  // Initial load
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Update derived state when currentWorkspace changes
  useEffect(() => {
    if (workspaces.length > 0) {
      const ws = workspaces.find(w => w.id === currentWorkspace);
      if (ws) {
        setWorkspaceName(ws.name);
        setUserPermission(ws.user_permission ?? 'read');
        // Persist choice
        localStorage.setItem('last_workspace', currentWorkspace);
      }
    }
  }, [currentWorkspace, workspaces]);

  // Load persisted workspace on mount
  useEffect(() => {
    const saved = localStorage.getItem('last_workspace');
    if (saved) {
      setCurrentWorkspace(saved);
    }
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        workspaceName,
        userPermission,
        loading,
        setCurrentWorkspace,
        refreshWorkspaces: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
