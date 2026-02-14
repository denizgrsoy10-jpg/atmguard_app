'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// User roles with hierarchical permissions
export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer';

export interface User {
  id: string;
  name: string;
  sicil: string; // Sicil numarası (T20111 gibi)
  role: UserRole;
  region?: string; // Regional access control
  permissions: {
    canEditConfig: boolean;
    canEscalate: boolean;
    canExport: boolean;
    canViewAllRegions: boolean;
    canManageUsers: boolean;
    canApproveRoutes: boolean;
  };
  avatar?: string;
  lastLogin?: Date;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (sicil: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: keyof User['permissions']) => boolean;
  canAccessRegion: (region: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users database (production: replace with real API)
// Password: PC login password (AD password)
// SECURITY: Passwords now read from environment variables
const MOCK_USERS: Record<string, { password: string; user: User }> = {
  'T20111': {
    password: process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD || 'CHANGE_ME',
    user: {
      id: 'USR001',
      name: 'Deniz Gürsoy',
      sicil: 'T20111',
      role: 'admin',
      permissions: {
        canEditConfig: true,
        canEscalate: true,
        canExport: true,
        canViewAllRegions: true,
        canManageUsers: true,
        canApproveRoutes: true,
      },
      avatar: '👨‍💼',
      lastLogin: new Date(),
    },
  },
  'T20112': {
    password: process.env.NEXT_PUBLIC_DEMO_MANAGER_PASSWORD || 'CHANGE_ME',
    user: {
      id: 'USR002',
      name: 'Ayşe Demir',
      sicil: 'T20112',
      role: 'manager',
      region: 'Marmara',
      permissions: {
        canEditConfig: true,
        canEscalate: true,
        canExport: true,
        canViewAllRegions: false,
        canManageUsers: false,
        canApproveRoutes: true,
      },
      avatar: '👩‍💼',
      lastLogin: new Date(),
    },
  },
  'T20113': {
    password: process.env.NEXT_PUBLIC_DEMO_OPERATOR_PASSWORD || 'CHANGE_ME',
    user: {
      id: 'USR003',
      name: 'Mehmet Kaya',
      sicil: 'T20113',
      role: 'operator',
      region: 'İç Anadolu',
      permissions: {
        canEditConfig: false,
        canEscalate: false,
        canExport: true,
        canViewAllRegions: false,
        canManageUsers: false,
        canApproveRoutes: false,
      },
      avatar: '👨‍🔧',
      lastLogin: new Date(),
    },
  },
  'T20114': {
    password: process.env.NEXT_PUBLIC_DEMO_VIEWER_PASSWORD || 'CHANGE_ME',
    user: {
      id: 'USR004',
      name: 'Fatma Şahin',
      sicil: 'T20114',
      role: 'viewer',
      permissions: {
        canEditConfig: false,
        canEscalate: false,
        canExport: false,
        canViewAllRegions: false,
        canManageUsers: false,
        canApproveRoutes: false,
      },
      avatar: '👩',
      lastLogin: new Date(),
    },
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check for stored session on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('atmguard_user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Failed to load stored user:', error);
      localStorage.removeItem('atmguard_user');
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const login = async (sicil: string, password: string) => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const userRecord = MOCK_USERS[sicil.toUpperCase()];
    
    if (!userRecord || userRecord.password !== password) {
      throw new Error('Invalid sicil or password');
    }

    const userData = {
      ...userRecord.user,
      lastLogin: new Date(),
    };

    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('atmguard_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('atmguard_user');
  };

  const hasPermission = (permission: keyof User['permissions']): boolean => {
    if (!user) return false;
    return user.permissions[permission] === true;
  };

  const canAccessRegion = (region: string): boolean => {
    if (!user) return false;
    if (user.permissions.canViewAllRegions) return true;
    if (!user.region) return false;
    return user.region === region;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        logout,
        hasPermission,
        canAccessRegion,
      }}
    >
      {isInitialized ? children : (
        <div className="min-h-screen bg-[#0B1B34] flex items-center justify-center">
          <div className="text-white text-xl">Loading...</div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Role-based access control helper
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 4,
  manager: 3,
  operator: 2,
  viewer: 1,
};

export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
