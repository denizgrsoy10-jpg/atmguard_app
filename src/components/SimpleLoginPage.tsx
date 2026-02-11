'use client';

import { useState } from 'react';
import { useSimpleAuth } from '@/contexts/SimpleAuthContext';
import Image from 'next/image';

export default function SimpleLoginPage() {
  const { login } = useSimpleAuth();
  const [sicil, setSicil] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      const success = login(sicil, password);
      if (!success) {
        setError('Hatalı sicil veya şifre!');
        setIsLoading(false);
      }
    }, 500);
  };

  const handleDemoLogin = (demoSicil: string) => {
    setSicil(demoSicil);
    setPassword('Qnb2024!');
    setTimeout(() => {
      login(demoSicil, 'Qnb2024!');
    }, 100);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0B1B34] via-[#112544] to-[#1A2F52] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo ve Başlık */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Image
                src="/qnb-logo.png"
                alt="QNB Finansbank"
                width={80}
                height={80}
                className="rounded-2xl shadow-2xl"
              />
              {/* AI Stars - Bigger and More Prominent */}
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full animate-pulse shadow-lg shadow-yellow-400/50"></div>
              <div className="absolute -bottom-2 -left-2 w-3.5 h-3.5 bg-blue-400 rounded-full animate-pulse shadow-lg shadow-blue-400/50" style={{animationDelay: '0.5s'}}></div>
              <div className="absolute top-1/2 -right-3 w-3.5 h-3.5 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" style={{animationDelay: '1s'}}></div>
              <div className="absolute -top-2 -left-2 w-3.5 h-3.5 bg-purple-500 rounded-full animate-pulse shadow-lg shadow-purple-500/50" style={{animationDelay: '1.5s'}}></div>
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#2E86FF] via-[#10B981] to-[#F2B705] bg-clip-text text-transparent mb-2">
            ATMGuard & Cash Flow
          </h1>
          <p className="text-[#A7B8D8] text-sm">
            AI-Powered ATM Health & Cash Management System
          </p>
        </div>

        {/* Login Formu */}
        <div className="bg-[#112544] rounded-2xl p-8 ring-1 ring-[#2B416B] shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">Giriş Yap</h2>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Sicil */}
            <div>
              <label className="block text-sm font-medium text-[#A7B8D8] mb-2">
                Sicil Numarası
              </label>
              <input
                type="text"
                value={sicil}
                onChange={(e) => setSicil(e.target.value.toUpperCase())}
                placeholder="T20111"
                className="w-full px-4 py-3 bg-[#0B1B34] border border-[#2B416B] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2E86FF] transition"
                required
              />
            </div>

            {/* Şifre */}
            <div>
              <label className="block text-sm font-medium text-[#A7B8D8] mb-2">
                PC Açılış Şifresi
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-[#0B1B34] border border-[#2B416B] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2E86FF] transition"
                required
              />
            </div>

            {/* Hata Mesajı */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Giriş Butonu */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#2E86FF] to-[#10B981] hover:from-[#1F6FE0] hover:to-[#059669] text-white font-semibold py-3 rounded-xl transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          {/* Demo Hesaplar */}
          <div className="mt-6 pt-6 border-t border-[#2B416B]">
            <p className="text-xs text-[#A7B8D8] mb-3 text-center">Demo Hesaplar</p>
            <div className="grid grid-cols-2 gap-2">
              {['T20111', 'T20112', 'T20113', 'T20114'].map((demoSicil) => (
                <button
                  key={demoSicil}
                  onClick={() => handleDemoLogin(demoSicil)}
                  className="px-3 py-2 bg-[#0B1B34] hover:bg-[#2E86FF]/20 border border-[#2B416B] hover:border-[#2E86FF] rounded-lg text-xs text-white transition"
                >
                  {demoSicil}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">Şifre: Qnb2024!</p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#A7B8D8] mt-6">
          © 2026 QNB Finansbank - Tüm hakları saklıdır
        </p>
      </div>
    </div>
  );
}
