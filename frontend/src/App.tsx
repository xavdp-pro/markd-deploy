import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AdminPage from './pages/AdminPage';
import EmailTestPage from './pages/EmailTestPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import WorkspacesAdmin from './pages/WorkspacesAdmin';
import GroupsAdmin from './pages/GroupsAdmin';
import VaultPage from './pages/VaultPage';
import TasksPage from './pages/TasksPage';
import TaskTypesAdmin from './pages/TaskTypesAdmin';
import WorkflowsAdmin from './pages/WorkflowsAdmin';
import DocumentsApp from './DocumentsApp';
import Header from './components/layout/Header';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppContent() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div className="h-screen flex flex-col">
                <Header />
                <div className="flex-1 overflow-hidden">
                  <DocumentsApp />
                </div>
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/email-test"
          element={
            <ProtectedRoute>
              <EmailTestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/workspaces"
          element={
            <ProtectedRoute>
              <div className="h-screen flex flex-col">
                <Header />
                <div className="flex-1 overflow-auto">
                  <WorkspacesAdmin />
                </div>
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/groups"
          element={
            <ProtectedRoute>
              <div className="h-screen flex flex-col">
                <Header />
                <div className="flex-1 overflow-auto">
                  <GroupsAdmin />
                </div>
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vault"
          element={
            <ProtectedRoute>
              <VaultPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <TasksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/task-types"
          element={
            <ProtectedRoute>
              <TaskTypesAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/workflows"
          element={
            <ProtectedRoute>
              <WorkflowsAdmin />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Détecter le mode sombre initial
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Observer les changements de classe sur <html>
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  return (
    <AuthProvider>
      <AppContent />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: isDarkMode ? '#1f2937' : '#fff',
            color: isDarkMode ? '#f3f4f6' : '#363636',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: isDarkMode 
              ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
              : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: isDarkMode ? '1px solid #374151' : 'none',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: isDarkMode ? '#1f2937' : '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: isDarkMode ? '#1f2937' : '#fff',
            },
          },
        }}
      />
    </AuthProvider>
  );
}

export default App;
