import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Toaster } from 'sonner';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ProfileProvider, useProfile } from './contexts/ProfileContext';
import { DataProvider } from './contexts/DataContext';
import { AppActionsContext } from './contexts/AppActionsContext';
import { SplashScreen } from './components/SplashScreen';
import { Onboarding } from './components/Onboarding';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Dashboard } from './components/Dashboard';
import { FileOrganizer } from './components/FileOrganizer';
import { CategoriesView } from './components/CategoriesView';
import { AISearch } from './components/AISearch';
import { ActivityLog } from './components/ActivityLog';
import { Settings } from './components/Settings';
import { FilePreviewPanel } from './components/FilePreviewPanel';
import { ConfirmProvider } from './components/Modal';
import { AmbientBackground } from './components/fx/AmbientBackground';
import type { FileItem } from './components/FileGrid';
import type { View } from './lib/nav';

export default function App() {
  return (
    <ThemeProvider>
      <ProfileProvider>
        <ErrorBoundary>
          <Root />
        </ErrorBoundary>
        <ThemedToaster />
      </ProfileProvider>
    </ThemeProvider>
  );
}

/** A render error shouldn't leave the window blank — offer a way back. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('RishFlow UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Something went wrong</p>
        <h1 className="text-3xl font-medium tracking-tight">The current hit a rock.</h1>
        <p className="max-w-md text-sm text-muted-foreground">{this.state.error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Reload RishFlow
        </button>
      </div>
    );
  }
}

type Stage = 'splash' | 'welcome' | 'app';

function Root() {
  const { ready } = useProfile();
  const [stage, setStage] = useState<Stage>('splash');
  const [splashDone, setSplashDone] = useState(false);
  const [returnTo, setReturnTo] = useState<Stage>('welcome');

  // Leave the splash only once it has finished *and* the saved profile is known
  useEffect(() => {
    if (stage === 'splash' && splashDone && ready) setStage(returnTo);
  }, [stage, splashDone, ready, returnTo]);

  const actions = {
    replayIntro: () => {
      setReturnTo('app');
      setSplashDone(false);
      setStage('splash');
    },
    leaveToWelcome: () => setStage('welcome'),
  };

  return (
    <AppActionsContext.Provider value={actions}>
      <AnimatePresence mode="wait">
        {stage === 'splash' && <SplashScreen key="splash" onComplete={() => setSplashDone(true)} />}

        {stage === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.985, filter: 'blur(8px)', transition: { duration: 0.5 } }}
            transition={{ duration: 0.6 }}
          >
            <Onboarding onEnter={() => setStage('app')} />
          </motion.div>
        )}

        {stage === 'app' && (
          <motion.div key="app" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
            <DataProvider>
              <ConfirmProvider>
                <AppShell />
              </ConfirmProvider>
            </DataProvider>
          </motion.div>
        )}
      </AnimatePresence>
    </AppActionsContext.Provider>
  );
}

function AppShell() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);

  const handleNavigate = (view: string) => {
    setCurrentView(view as View);
    setSelectedFile(null);
    setIsMobileMenuOpen(false);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  return (
    <div className="relative flex h-screen overflow-hidden bg-background text-foreground">
      <AmbientBackground />

      {/* Desktop sidebar */}
      <motion.div
        className="relative z-20 hidden shrink-0 p-3 pr-0 lg:block"
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      >
        <Sidebar currentView={currentView} onNavigate={handleNavigate} />
      </motion.div>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopBar
          currentView={currentView}
          onNavigate={handleNavigate}
          onPreviewFile={setSelectedFile}
          isMobileMenuOpen={isMobileMenuOpen}
          onToggleMobileMenu={() => setIsMobileMenuOpen((v) => !v)}
        />

        <main ref={scrollRef} className="relative flex-1 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-2 sm:px-6 lg:px-8"
            >
              {currentView === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
              {currentView === 'organize' && <FileOrganizer onPreviewFile={setSelectedFile} />}
              {currentView === 'categories' && <CategoriesView onPreviewFile={setSelectedFile} />}
              {currentView === 'search' && <AISearch />}
              {currentView === 'activity' && <ActivityLog />}
              {currentView === 'undo' && <ActivityLog mode="undo" />}
              {currentView === 'settings' && <Settings onNavigate={handleNavigate} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {selectedFile && (
          <FilePreviewPanel
            key={selectedFile.id}
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
            onApprove={() => setSelectedFile(null)}
            onChange={() => setSelectedFile(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme === 'glacier' ? 'light' : 'dark'}
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--surface-strong)',
          border: '1px solid var(--border-strong)',
          color: 'var(--foreground)',
          backdropFilter: 'blur(18px)',
          borderRadius: '16px',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        },
      }}
    />
  );
}
