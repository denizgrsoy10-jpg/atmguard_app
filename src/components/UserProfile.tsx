'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function UserProfile() {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  if (!user) return null;

  const getRoleBadgeColor = () => {
    switch (user.role) {
      case 'admin': return 'bg-purple-500';
      case 'manager': return 'bg-blue-500';
      case 'operator': return 'bg-green-500';
      case 'viewer': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getRoleLabel = () => {
    switch (user.role) {
      case 'admin': return 'Administrator';
      case 'manager': return 'Manager';
      case 'operator': return 'Operator';
      case 'viewer': return 'Viewer';
      default: return user.role;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-3 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/20"
      >
        <div className="text-2xl">{user.avatar || '👤'}</div>
        <div className="text-left">
          <div className="text-sm font-semibold text-white">{user.name}</div>
          <div className="text-xs text-gray-300">{getRoleLabel()}</div>
        </div>
        <svg
          className={`w-4 h-4 text-white transition-transform ${showMenu ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-200 z-20 overflow-hidden">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{user.avatar || '👤'}</div>
                <div>
                  <div className="text-white font-bold">{user.name}</div>
                  <div className="text-blue-100 text-sm">Sicil: {user.sicil}</div>
                </div>
              </div>
            </div>

            {/* User Info */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Role</span>
                <span className={`text-xs px-3 py-1 ${getRoleBadgeColor()} text-white rounded-full font-semibold`}>
                  {getRoleLabel()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sicil No</span>
                <span className="text-sm font-mono font-bold text-gray-900">{user.sicil}</span>
              </div>

              {user.region && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Region</span>
                  <span className="text-sm font-semibold text-gray-900">{user.region}</span>
                </div>
              )}

              {user.lastLogin && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Login</span>
                  <span className="text-xs text-gray-900">
                    {new Date(user.lastLogin).toLocaleString('tr-TR')}
                  </span>
                </div>
              )}
            </div>

            {/* Permissions */}
            <div className="px-4 pb-4">
              <div className="text-xs font-semibold text-gray-600 mb-2">Permissions</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(user.permissions).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className={`text-xs ${value ? 'text-green-600' : 'text-gray-400'}`}>
                      {value ? '✓' : '✗'}
                    </span>
                    <span className="text-xs text-gray-700">
                      {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 p-2">
              <button
                onClick={() => {
                  logout();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
