'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  userSicil: string | null;
  login: (sicil: string, password: string) => boolean;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo hesaplar
const DEMO_USERS: Record<string, string> = {
  'T20111': 'Qnb2024!',
  'T20112': 'Qnb2024!',
  'T20113': 'Qnb2024!',
  'T20114': 'Qnb2024!',
};

export function SimpleAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userSicil, setUserSicil] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage on mount
    const savedSicil = localStorage.getItem('userSicil');
    if (savedSicil) {
      setIsAuthenticated(true);
      setUserSicil(savedSicil);
    }
    setIsLoading(false);
  }, []);

  const login = (sicil: string, password: string): boolean => {
    const upperSicil = sicil.toUpperCase();
    if (DEMO_USERS[upperSicil] === password) {
      setIsAuthenticated(true);
      setUserSicil(upperSicil);
      localStorage.setItem('userSicil', upperSicil);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserSicil(null);
    localStorage.removeItem('userSicil');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#0B1B34] flex items-center justify-center">
        <div className="text-white text-xl">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, userSicil, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSimpleAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useSimpleAuth must be used within SimpleAuthProvider');
  }
  return context;
}
