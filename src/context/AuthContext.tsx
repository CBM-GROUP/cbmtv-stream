'use client';

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { getUserProfile } from '@/services/accounts';
import apiClient, { unauthorizedEvent } from '@/services/api';
import { progressTokenBelongsToUser } from '@/lib/homepage-progress';

interface User {
  id: number;
  name: string;
  email: string;
  image?: string | null;
  phone?: string | null;
  location?: string | null;
  country?: string | null;
}
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const currentUser = useRef<User | null>(null);
  const currentRefresh = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      const operation = ++generation.current;
      const refresh = localStorage.getItem('refresh_token');
      currentUser.current = null;
      currentRefresh.current = refresh;
      setUser(null);
      setLoading(true);
      try {
        if (localStorage.getItem('access_token')) {
          const response = await getUserProfile();
          if (!active || operation !== generation.current || localStorage.getItem('refresh_token') !== refresh) return;
          if (progressTokenBelongsToUser(localStorage.getItem('access_token'), response.data.id)) {
            currentUser.current = response.data;
            setUser(response.data);
          }
        }
      } catch {
        // Generic API refresh retains credentials after a transient outage.
        if (active && operation === generation.current) { currentUser.current = null; setUser(null); }
      } finally {
        if (active && operation === generation.current) setLoading(false);
      }
    };
    const onUnauthorized = () => {
      generation.current += 1;
      currentUser.current = null;
      currentRefresh.current = null;
      setUser(null);
      setLoading(false);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== localStorage) return;
      if (event.key !== null && event.key !== 'access_token' && event.key !== 'refresh_token') return;
      // Same-session token renewal must not remount the playing video.
      if (currentUser.current && currentRefresh.current === localStorage.getItem('refresh_token') && progressTokenBelongsToUser(localStorage.getItem('access_token'), currentUser.current.id)) return;
      void restore();
    };
    document.addEventListener(unauthorizedEvent.type, onUnauthorized);
    window.addEventListener('storage', onStorage);
    void restore();
    return () => {
      active = false;
      generation.current += 1;
      document.removeEventListener(unauthorizedEvent.type, onUnauthorized);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const login = (userData: User, accessToken: string, refreshToken: string) => {
    if (!progressTokenBelongsToUser(accessToken, userData.id) || !progressTokenBelongsToUser(refreshToken, userData.id)) throw new Error('Sign-in returned an invalid session. Please try again.');
    generation.current += 1;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    delete apiClient.defaults.headers.common.Authorization;
    currentRefresh.current = refreshToken;
    currentUser.current = userData;
    setUser(userData);
    setLoading(false);
  };
  const logout = () => {
    generation.current += 1;
    currentUser.current = null;
    currentRefresh.current = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete apiClient.defaults.headers.common.Authorization;
    setUser(null);
    setLoading(false);
  };
  const updateUser = (updatedUserData: Partial<User>) => {
    setUser((current) => {
      if (!current) return null;
      const updated = { ...current, ...updatedUserData, id: current.id };
      currentUser.current = updated;
      return updated;
    });
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
