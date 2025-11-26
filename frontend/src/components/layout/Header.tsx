import React, { useState, useRef, useEffect } from 'react';
import { FileText, User, Settings, LogOut, Shield, Mail, FolderTree, Users, Sun, Moon, CheckSquare, ListChecks, Workflow, Tag, Lock, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useNavigate, useLocation } from 'react-router-dom';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { modules } = useSettings();
  const { workspaces, currentWorkspace, setCurrentWorkspace, loading: workspacesLoading } = useWorkspace();
  const [showMenu, setShowMenu] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setShowWorkspaceMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Load dark mode preference from localStorage
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);


  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', String(newMode));
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">MarkD</h1>
          </button>

          {/* Workspace Selector */}
          <div className="relative" ref={workspaceMenuRef}>
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              disabled={workspacesLoading}
            >
              <div className="flex flex-col items-start">
                <span className="text-xs text-gray-500 dark:text-gray-400">Workspace</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {workspacesLoading ? 'Loading...' : workspaces.find(w => w.id === currentWorkspace)?.name || 'Select Workspace'}
                </span>
              </div>
              <ChevronDown size={14} className={`text-gray-500 transition-transform ${showWorkspaceMenu ? 'rotate-180' : ''}`} />
            </button>

            {showWorkspaceMenu && (
              <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      setCurrentWorkspace(ws.id);
                      setShowWorkspaceMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      currentWorkspace === ws.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span>{ws.name}</span>
                    {currentWorkspace === ws.id && <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Navigation Menu */}
          <nav className="flex items-center gap-1">
            {modules.documents && (
              <button
                onClick={() => navigate('/')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  location.pathname === '/' 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <FileText size={16} />
                Documents
              </button>
            )}
            
            {modules.tasks && (
              <button
                onClick={() => navigate('/tasks')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  location.pathname === '/tasks' 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <CheckSquare size={16} />
                Tasks
              </button>
            )}
            
            {modules.passwords && (
              <button
                onClick={() => navigate('/vault')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  location.pathname === '/vault' 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Lock size={16} />
                Passwords
              </button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={isDarkMode ? 'Mode clair' : 'Mode sombre'}
          >
            {isDarkMode ? (
              <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            )}
          </button>

          {/* User Menu */}
          <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <span className="font-medium text-gray-700 dark:text-gray-200">{user?.username}</span>
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.username}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                {user?.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 text-xs font-medium rounded">
                    <Shield className="w-3 h-3" />
                    Admin
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  navigate('/profile');
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                Profile
              </button>

              <button
                onClick={() => {
                  navigate('/settings');
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>

              {user?.role === 'admin' && (
                <>
                  <button
                    onClick={() => {
                      navigate('/admin');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    Admin Panel
                  </button>
                  <button
                    onClick={() => {
                      navigate('/admin/workspaces');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <FolderTree className="w-4 h-4" />
                    Workspaces
                  </button>
                  <button
                    onClick={() => {
                      navigate('/admin/groups');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    Groups
                  </button>
                  <button
                    onClick={() => {
                      navigate('/admin/tags');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Tag className="w-4 h-4" />
                    Tags
                  </button>
                  <button
                    onClick={() => {
                      navigate('/admin/task-types');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <ListChecks className="w-4 h-4" />
                    Task types
                  </button>
                  <button
                    onClick={() => {
                      navigate('/admin/workflows');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Workflow className="w-4 h-4" />
                    Workflows
                  </button>
                  <button
                    onClick={() => {
                      navigate('/admin/email-test');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Test Email
                  </button>
                </>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
