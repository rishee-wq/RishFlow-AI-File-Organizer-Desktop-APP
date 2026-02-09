import React from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  FolderTree,
  Activity,
  Undo2,
  Settings
} from 'lucide-react';
import logo from '../../assets/logo.jpg';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'organize', label: 'Organize Files', icon: FolderOpen },
    { id: 'categories', label: 'Categories', icon: FolderTree },
    { id: 'activity', label: 'Activity Logs', icon: Activity },
    { id: 'undo', label: 'Undo Actions', icon: Undo2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">


          <div className="w-10 h-10 rounded-xl bg-sidebar-primary/10 border border-sidebar-primary/20 flex items-center justify-center overflow-hidden">
            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="font-semibold text-sidebar-foreground">RishFlow</h2>
            <p className="text-xs text-sidebar-foreground/60">AI Organizer</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
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

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="bg-sidebar-accent rounded-lg p-3">
          <p className="text-xs text-sidebar-accent-foreground font-medium mb-1">
            Storage Used
          </p>
          <div className="w-full h-1.5 bg-sidebar-border rounded-full overflow-hidden mb-2">
            <div className="h-full bg-sidebar-primary rounded-full" style={{ width: '67%' }} />
          </div>
          <p className="text-xs text-sidebar-accent-foreground/70">
            6.7 GB of 10 GB
          </p>
        </div>
      </div>
    </aside>
  );
}
