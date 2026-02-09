import React, { useState } from 'react';
import { useTheme, ThemeType } from '../contexts/ThemeContext';
import { Button } from './Button';
import { Sparkles, Waves, Flame } from 'lucide-react';
import logo from '../../assets/logo.jpg';

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const { theme, setTheme } = useTheme();

  const themes: Array<{
    id: ThemeType;
    name: string;
    description: string;
    icon: React.ReactNode;
    previewBg: string;
    previewAccent: string;
  }> = [
      {
        id: 'neural-dark',
        name: 'Neural Dark',
        description: 'Deep dark with electric blue',
        icon: <Sparkles className="w-5 h-5" />,
        previewBg: '#0a0a0f',
        previewAccent: '#3b82f6',
      },
      {
        id: 'aqua-circuit',
        name: 'Aqua Circuit',
        description: 'Cool aqua and teal tones',
        icon: <Waves className="w-5 h-5" />,
        previewBg: '#f8fafb',
        previewAccent: '#06b6d4',
      },
      {
        id: 'ember-flux',
        name: 'Ember Flux',
        description: 'Warm orange-red energy',
        icon: <Flame className="w-5 h-5" />,
        previewBg: '#0f0f0f',
        previewAccent: '#f97316',
      },
    ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
        backgroundSize: '32px 32px',
      }} />

      <div className="w-full max-w-md relative z-10">
        {/* Logo and app name */}
        <div className="text-center mb-8">

          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl mb-4 overflow-hidden shadow-lg hover:shadow-primary/20 transition-all duration-300">
            <img src={logo} alt="RishFlow Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl mb-2 text-foreground">RishFlow</h1>
          <p className="text-muted-foreground">AI-powered file organization</p>
        </div>

        {/* Enter Button */}
        <div className="flex justify-center mb-8">
          <Button
            onClick={onLogin}
            className="w-full max-w-sm h-14 text-lg font-medium shadow-xl hover:shadow-primary/20 hover:scale-105 transition-all duration-300"
            size="lg"
          >
            Enter RishFlow
          </Button>
        </div>

        {/* Theme Preview Selector */}
        <div className="bg-card border border-border rounded-2xl shadow-lg p-6">
          <h3 className="text-sm font-medium mb-4 text-foreground">Choose Your Theme</h3>
          <div className="space-y-3">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${theme === t.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30 bg-card'
                  }`}
              >
                <div className="flex items-start gap-4">
                  {/* Theme Preview */}
                  <div className="flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden shadow-sm border border-border/50">
                    <div className="h-full" style={{ backgroundColor: t.previewBg }}>
                      <div className="h-1/3 flex items-center px-2 gap-1">
                        <div className="w-1 h-1 rounded-full" style={{ backgroundColor: t.previewAccent }} />
                        <div className="w-1 h-1 rounded-full" style={{ backgroundColor: t.previewAccent, opacity: 0.5 }} />
                      </div>
                      <div className="px-2 space-y-1">
                        <div className="h-1.5 rounded-full" style={{ backgroundColor: t.previewAccent, width: '70%' }} />
                        <div className="h-1.5 rounded-full" style={{ backgroundColor: t.previewAccent, opacity: 0.3, width: '50%' }} />
                        <div className="h-1.5 rounded-full" style={{ backgroundColor: t.previewAccent, opacity: 0.3, width: '60%' }} />
                      </div>
                    </div>
                  </div>

                  {/* Theme Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div style={{ color: t.previewAccent }}>
                        {t.icon}
                      </div>
                      <h4 className="font-medium text-foreground">{t.name}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>

                  {/* Selected indicator */}
                  {theme === t.id && (
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
