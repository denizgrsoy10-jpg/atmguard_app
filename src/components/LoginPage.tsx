'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [sicil, setSicil] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(sicil, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  // SECURITY: Demo accounts - passwords read from .env.local
  const demoAccounts = [
    { sicil: 'T20111', password: process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD || '', name: 'Deniz Gürsoy', role: 'Admin', desc: 'Full access' },
    { sicil: 'T20112', password: process.env.NEXT_PUBLIC_DEMO_MANAGER_PASSWORD || '', name: 'Ayşe Demir', role: 'Manager', desc: 'Regional management' },
    { sicil: 'T20113', password: process.env.NEXT_PUBLIC_DEMO_OPERATOR_PASSWORD || '', name: 'Mehmet Kaya', role: 'Operator', desc: 'Operations only' },
    { sicil: 'T20114', password: process.env.NEXT_PUBLIC_DEMO_VIEWER_PASSWORD || '', name: 'Fatma Şahin', role: 'Viewer', desc: 'Read-only' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏦</div>
          <h1 className="text-4xl font-bold text-white mb-2">ATM Guard</h1>
          <p className="text-blue-300">Intelligent ATM Health Monitoring</p>
        </div>

        {/* Login Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Sicil Numarası
              </label>
              <input
                type="text"
                value={sicil}
                onChange={(e) => setSicil(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                placeholder="T20111"
                required
                maxLength={10}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                PC Açılış Şifresi
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Windows şifrenizi girin"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {/* Demo Accounts */}
          <div className="mt-8 pt-6 border-t border-white/20">Test Hesapları:</p>
            <div className="space-y-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.sicil}
                  onClick={() => {
                    setSicil(account.sicil);
                    setPassword(account.password);
                  }}
                  className="w-full text-left px-3 py-2 bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-white">{account.name}</div>
                      <div className="text-xs text-gray-400">Sicil: {account.sicil} • {account.roleunt.role}</div>
                      <div className="text-xs text-gray-400">{account.email}</div>
                    </div>
                    <div className="text-xs text-blue-300">{account.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-sm text-gray-400">
          © 2026 ATM Guard. Enterprise ATM Analytics Platform.
        </div>
      </div>
    </div>
  );
}
