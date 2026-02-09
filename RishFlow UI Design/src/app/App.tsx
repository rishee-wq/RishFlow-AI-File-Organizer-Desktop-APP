import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { DataProvider } from './contexts/DataContext';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { MobileSidebar } from './components/MobileSidebar';
import { TopBar } from './components/TopBar';
import { Dashboard } from './components/Dashboard';
import { FileOrganizer } from './components/FileOrganizer';
import { CategoriesView } from './components/CategoriesView';
import { ActivityLog } from './components/ActivityLog';
import { Settings } from './components/Settings';
import { FilePreviewPanel } from './components/FilePreviewPanel';
import { pythonAPI } from '@/api/pywebview';
import { SplashScreen } from './components/SplashScreen';
import { AnimatePresence, motion } from 'motion/react';

type View = 'dashboard' | 'organize' | 'categories' | 'activity' | 'undo' | 'settings';

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: string;
  category: string;
  confidence: number;
  tags: string[];
  icon: React.ComponentType<any>;
  color: string;
}

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavigate = (view: string) => {
    setCurrentView(view as View);
    setSelectedFile(null);
  };

  const handlePreviewFile = (file: FileItem) => {
    setSelectedFile(file);
  };

  const handleClosePreview = () => {
    setSelectedFile(null);
  };

  const handleApprove = () => {
    console.log('File approved');
    setSelectedFile(null);
  };

  const handleChange = () => {
    console.log('Change requested');
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar currentView={currentView} onNavigate={handleNavigate} />
      </div>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <MobileSidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          {currentView === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
          {currentView === 'organize' && <FileOrganizer onPreviewFile={handlePreviewFile} />}
          {currentView === 'categories' && <CategoriesView />}
          {currentView === 'activity' && <ActivityLog />}
          {currentView === 'undo' && <ActivityLog />}
          {currentView === 'settings' && <Settings />}
        </main>
      </div>

      {/* File Preview Panel */}
      {selectedFile && (
        <FilePreviewPanel
          file={selectedFile}
          onClose={handleClosePreview}
          onApprove={handleApprove}
          onChange={handleChange}
        />
      )}
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Show login screen
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Initialize Python API when app loads
    pythonAPI.initialize().catch((err: any) => {
      console.warn('Failed to initialize Python API:', err);
    });
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (!isLoggedIn) {
    return (
      <ThemeProvider>
        <LoginScreen onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <DataProvider>
        <AnimatePresence mode="wait">
          {showSplash ? (
            <SplashScreen key="splash" onComplete={handleSplashComplete} />
          ) : (
            <motion.div
              key="app"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="h-full w-full"
            >
              <AppContent />
            </motion.div>
          )}
        </AnimatePresence>
      </DataProvider>
    </ThemeProvider>
  );
}