import React, { createContext, useContext, useEffect, useState } from 'react';
import { pythonAPI, type SystemInfo } from '@/api/pywebview';

export interface Profile {
  firstName: string;
  lastName: string;
  workspace: string;
  focusTypes: string[];
  createdAt: string;
  /** The computer the profile was created from (auto-detected). */
  device?: SystemInfo;
}

/** This computer's details from the backend; falls back to what the browser can tell. Never rejects. */
export async function detectSystem(): Promise<SystemInfo> {
  if (pythonAPI.available) {
    try {
      return await pythonAPI.getSystemInfo();
    } catch {
      /* fall back below */
    }
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    name: 'My Computer',
    user: '',
    device_type: 'Computer',
    model: '',
    cpu: '',
    cores: nav.hardwareConcurrency || 0,
    ram_gb: nav.deviceMemory || 0,
    gpu: '',
    os: nav.platform || '',
    arch: '',
    disk_total_gb: 0,
    disk_free_gb: 0,
    tier: '',
  };
}

/** A profile named after the computer, as created on first launch. */
export function profileFromSystem(info: SystemInfo): Profile {
  return {
    firstName: info.name,
    lastName: '',
    workspace: info.model || `${info.name}'s Workspace`,
    focusTypes: [],
    createdAt: new Date().toISOString(),
    device: info,
  };
}

const STATE_KEY = 'user_profile';
const LOCAL_KEY = 'rishflow-profile';

function readLocal(): Profile | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function writeLocal(profile: Profile | null) {
  try {
    if (profile) localStorage.setItem(LOCAL_KEY, JSON.stringify(profile));
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* storage unavailable */
  }
}

interface ProfileContextType {
  profile: Profile | null;
  /** True once the saved profile (if any) has been read from disk. */
  ready: boolean;
  saveProfile: (profile: Profile) => void;
  clearProfile: () => void;
  displayName: string;
  initials: string;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => readLocal());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    pythonAPI
      .initialize()
      .then(() => (pythonAPI.available ? pythonAPI.loadState(STATE_KEY) : null))
      .then((res) => {
        const saved = res?.value;
        if (saved && typeof saved === 'object' && 'firstName' in saved) {
          setProfile(saved as Profile);
          writeLocal(saved as Profile);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const saveProfile = (next: Profile) => {
    setProfile(next);
    writeLocal(next);
    if (pythonAPI.available) pythonAPI.saveState(STATE_KEY, next).catch(() => {});
  };

  const clearProfile = () => {
    setProfile(null);
    writeLocal(null);
    if (pythonAPI.available) pythonAPI.saveState(STATE_KEY, null).catch(() => {});
  };

  const displayName = profile?.firstName?.trim() || 'Explorer';
  // "Ada Lovelace" -> AL; a computer name like "RISHEE-LAPTOP" -> RL, "RISHEE" -> RI
  const words = [profile?.firstName, profile?.lastName].join(' ').split(/[\s\-_.]+/).filter(Boolean);
  const initials =
    (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 2)).toUpperCase() || 'RF';

  return (
    <ProfileContext.Provider value={{ profile, ready, saveProfile, clearProfile, displayName, initials }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
