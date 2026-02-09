import React from 'react';
import {
  X,
  LayoutDashboard,
  FolderOpen,
  FolderTree,
  Activity,
  Undo2,
  Settings
} from 'lucide-react';
import logo from '../../assets/logo.jpg';

interface MobileSidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onClose: () => void;
}

export function MobileSidebar({ currentView, onNavigate, onClose }: MobileSidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'organize', label: 'Organize Files', icon: FolderOpen },
    { id: 'categories', label: 'Categories', icon: FolderTree },
    { id: 'activity', label: 'Activity Logs', icon: Activity },
    { id: 'undo', label: 'Undo Actions', icon: Undo2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavigate = (view: string) => {
    onNavigate(view);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 w-64 bg-sidebar border-r border-sidebar-border h-screen z-50 lg:hidden animate-in slide-in-from-left duration-300">
        {/* Header */}
        <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary/10 border border-sidebar-primary/20 flex items-center justify-center overflow-hidden">
              <img src={logo} alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="font-semibold text-sidebar-foreground">RishFlow</h2>
              <p className="text-xs text-sidebar-foreground/60">AI Organizer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-sidebar-accent flex items-center justify-center"
          >
            <X className="w-5 h-5 text-sidebar-foreground" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
