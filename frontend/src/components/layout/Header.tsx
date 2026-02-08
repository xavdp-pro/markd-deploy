import React, { useState, useRef, useEffect } from 'react';
import { FileText, User, Settings, LogOut, Shield, Mail, FolderTree, Users, Sun, Moon, CheckSquare, Tag, Lock, ChevronDown, Folder, Network, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useUnsavedChanges } from '../../contexts/UnsavedChangesContext';
import { useNavigate, useLocation } from 'react-router-dom';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { modules } = useSettings();
  const { workspaces, currentWorkspace, setCurrentWorkspace, loading: workspacesLoading } = useWorkspace();
  const [showMenu, setShowMenu] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const workspaceInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { guardAction } = useUnsavedChanges();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setShowWorkspaceMenu(false);
        setWorkspaceSearch('');
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
    guardAction(() => {
      logout();
      navigate('/login');
    });
  };

  // Guarded navigation helper
  const guardedNavigate = (path: string) => {
    if (location.pathname === path) return;
    guardAction(() => navigate(path));
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <button
            onClick={() => guardedNavigate('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">MarkD</h1>
          </button>

          {/* Workspace Selector - Select2 style */}
          <div className="relative" ref={workspaceMenuRef}>
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors min-w-[200px] cursor-pointer ${
                showWorkspaceMenu
                  ? 'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              onClick={() => {
                if (!showWorkspaceMenu) {
                  setShowWorkspaceMenu(true);
                  setWorkspaceSearch('');
                  setHighlightedIndex(0);
                  setTimeout(() => workspaceInputRef.current?.focus(), 0);
                }
              }}
            >
              {showWorkspaceMenu && (
                <Search size={14} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              )}
              {showWorkspaceMenu ? (
                <input
                  ref={workspaceInputRef}
                  type="text"
                  value={workspaceSearch}
                  onChange={(e) => {
                    setWorkspaceSearch(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={(e) => {
                    const filtered = workspaces.filter(w =>
                      w.name.toLowerCase().includes(workspaceSearch.toLowerCase())
                    );
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHighlightedIndex(i => Math.min(i + 1, filtered.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlightedIndex(i => Math.max(i - 1, 0));
                    } else if (e.key === 'Enter' && filtered.length > 0) {
                      e.preventDefault();
                      const targetWs = filtered[highlightedIndex];
                      if (targetWs.id !== currentWorkspace) {
                        guardAction(() => {
                          setCurrentWorkspace(targetWs.id);
                          setShowWorkspaceMenu(false);
                          setWorkspaceSearch('');
                        });
                      } else {
                        setShowWorkspaceMenu(false);
                        setWorkspaceSearch('');
                      }
                    } else if (e.key === 'Escape') {
                      setShowWorkspaceMenu(false);
                      setWorkspaceSearch('');
                    }
                  }}
                  placeholder="Search workspace..."
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none min-w-0"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="flex-1 flex flex-col items-start min-w-0">
                  <span className="text-[10px] leading-tight text-gray-400 dark:text-gray-500">Workspace</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate w-full">
                    {workspacesLoading ? 'Loading...' : workspaces.find(w => w.id === currentWorkspace)?.name || 'Select...'}
                  </span>
                </div>
              )}
              
              <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${showWorkspaceMenu ? 'rotate-180' : ''}`} />
            </div>

            {showWorkspaceMenu && (
              <div className="absolute left-0 mt-1 w-full min-w-[240px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 max-h-[300px] overflow-y-auto">
                {workspaces
                  .filter(ws => ws.name.toLowerCase().includes(workspaceSearch.toLowerCase()))
                  .map((ws, index) => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        if (ws.id === currentWorkspace) {
                          setShowWorkspaceMenu(false);
                          setWorkspaceSearch('');
                          return;
                        }
                        guardAction(() => {
                          setCurrentWorkspace(ws.id);
                          setShowWorkspaceMenu(false);
                          setWorkspaceSearch('');
                        });
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                        highlightedIndex === index
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : ''
                      } ${
                        currentWorkspace === ws.id
                          ? 'text-blue-700 dark:text-blue-300 font-medium'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="truncate">{ws.name}</span>
                      {currentWorkspace === ws.id && <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 flex-shrink-0 ml-2" />}
                    </button>
                  ))}
                {workspaces.filter(ws => ws.name.toLowerCase().includes(workspaceSearch.toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500 text-center">No workspace found</div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Menu */}
          <nav className="flex items-center gap-1">
            {modules.documents && (
              <button
                onClick={() => guardedNavigate('/')}
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
            
            {modules.passwords && (
              <button
                onClick={() => guardedNavigate('/passwords')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  location.pathname === '/passwords' 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Lock size={16} />
                Passwords
              </button>
            )}
            
            {modules.files && (
              <button
                onClick={() => guardedNavigate('/files')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  location.pathname === '/files' 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Folder size={16} />
                Files
              </button>
            )}
            
            {modules.tasks && (
              <button
                onClick={() => guardedNavigate('/tasks')}
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
            
            {modules.schemas && (
              <button
                onClick={() => guardedNavigate('/schemas')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  location.pathname === '/schemas' 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Network size={16} />
                Schemas
              </button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={isDarkMode ? 'Light mode' : 'Dark mode'}
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

              {/* ── Account Section ── */}
              <div className="px-3 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Account</p>
              </div>
              <button
                onClick={() => {
                  guardAction(() => { navigate('/profile'); setShowMenu(false); });
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                Profile
              </button>
              <button
                onClick={() => {
                  guardAction(() => { navigate('/settings'); setShowMenu(false); });
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={() => {
                  guardAction(() => { navigate('/mcp-config'); setShowMenu(false); });
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Network className="w-4 h-4" />
                MCP Configuration
              </button>

              {/* ── Administration Section (admin only) ── */}
              {user?.role === 'admin' && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                    <div className="px-3 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Administration</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      guardAction(() => { navigate('/admin'); setShowMenu(false); });
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    Users
                  </button>
                  <button
                    onClick={() => {
                      guardAction(() => { navigate('/admin/groups'); setShowMenu(false); });
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    Groups
                  </button>
                  <button
                    onClick={() => {
                      guardAction(() => { navigate('/admin/workspaces'); setShowMenu(false); });
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <FolderTree className="w-4 h-4" />
                    Workspaces
                  </button>
                  <button
                    onClick={() => {
                      guardAction(() => { navigate('/admin/tags'); setShowMenu(false); });
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Tag className="w-4 h-4" />
                    Tags
                  </button>
                  <button
                    onClick={() => {
                      guardAction(() => { navigate('/admin/mcp'); setShowMenu(false); });
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Network className="w-4 h-4" />
                    MCP Servers
                  </button>
                  <button
                    onClick={() => {
                      guardAction(() => { navigate('/admin/email-test'); setShowMenu(false); });
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Email Test
                  </button>
                </>
              )}

              {/* ── Logout ── */}
              <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
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
