
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getUserProfile } from '@/services/accounts';
import { unauthorizedEvent } from '@/services/api';

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

  useEffect(() => {
    let active = true;
    const restore = async () => {
      if (localStorage.getItem('access_token')) {
        try {
          const response = await getUserProfile();
          if (active) setUser(response.data);
        } catch {
          if (active) setUser(null);
        }
      }
      if (active) setLoading(false);
    };
    void restore();
    const onUnauthorized = () => setUser(null);
    document.addEventListener(unauthorizedEvent.type, onUnauthorized);
    return () => { active = false; document.removeEventListener(unauthorizedEvent.type, onUnauthorized); };
  }, []);

  const login = (userData: User, accessToken: string, refreshToken: string) => {
    setUser(userData);
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    setLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setLoading(false);
  };

  const updateUser = (updatedUserData: Partial<User>) => {
    setUser((currentUser) => {
      if (currentUser) {
        return { ...currentUser, ...updatedUserData };
      }
      return null;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
