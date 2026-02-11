"use client";

import "./globals.css";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { SimpleAuthProvider, useSimpleAuth } from "@/contexts/SimpleAuthContext";
import SimpleLoginPage from "@/components/SimpleLoginPage";
import Tabs from "@/components/Tabs";
import Image from "next/image";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, userSicil, logout } = useSimpleAuth();

  if (!isAuthenticated) {
    return <SimpleLoginPage />;
  }

  return (
    <LanguageProvider>
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-[#112544] border-b border-[#2B416B] sticky top-0 z-40">
          <div className="max-w-[1800px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Image
                    src="/qnb-logo.png"
                    alt="QNB Finansbank"
                    width={60}
                    height={60}
                    className="rounded-xl"
                  />
                  {/* AI Stars Animation */}
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                  <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
                  <div className="absolute top-1/2 -right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
                  <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '1.5s'}}></div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-[#2E86FF] via-[#10B981] to-[#F2B705] bg-clip-text text-transparent">
                    ATMGuard & Cash Flow
                  </h1>
                  <div className="text-xs text-[#A7B8D8]">
                    AI-Powered ATM Health & Cash Management System
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Tabs />
                <div className="flex items-center gap-3">
                  <div className="text-sm text-[#A7B8D8]">
                    👤 {userSicil}
                  </div>
                  <button
                    onClick={logout}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm font-semibold transition"
                    title="Çıkış Yap"
                  >
                    Çıkış
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          <div className="max-w-[1800px] mx-auto px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </LanguageProvider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen w-full bg-[#0B1B34] text-white">
        <SimpleAuthProvider>
          <LayoutContent>{children}</LayoutContent>
        </SimpleAuthProvider>
      </body>
    </html>
  );
}
