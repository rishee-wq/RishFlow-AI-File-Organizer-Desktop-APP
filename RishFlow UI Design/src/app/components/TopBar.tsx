import React from 'react';
import { Search, Sparkles, Waves, Flame, User, Menu } from 'lucide-react';
import { useTheme, ThemeType } from '../contexts/ThemeContext';

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { theme, setTheme } = useTheme();

  const themes: Array<{ id: ThemeType; icon: React.ReactNode; label: string }> = [
    { id: 'neural-dark', icon: <Sparkles className="w-4 h-4" />, label: 'Neural Dark' },
    { id: 'aqua-circuit', icon: <Waves className="w-4 h-4" />, label: 'Aqua Circuit' },
    { id: 'ember-flux', icon: <Flame className="w-4 h-4" />, label: 'Ember Flux' },
  ];

  return (
    <div className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
      {/* Mobile Menu Button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden w-9 h-9 rounded-lg hover:bg-accent flex items-center justify-center transition-colors mr-2"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search files, folders, or actions..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-input-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all text-sm md:text-base"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 md:gap-3 ml-2 md:ml-0">
        {/* Theme Switcher */}
        <div className="hidden md:flex items-center gap-1 bg-secondary rounded-lg p-1">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`p-2 rounded-md transition-all ${
                theme === t.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Profile */}
        <button className="w-9 h-9 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center hover:border-primary/40 transition-colors">
          <User className="w-4 h-4 text-primary" />
        </button>
      </div>
    </div>
  );
}