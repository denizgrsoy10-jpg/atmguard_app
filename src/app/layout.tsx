"use client";

import "./globals.css";
import Tabs from "@/components/Tabs";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Image from "next/image";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen w-full bg-[#0B1B34] text-white">
        <LanguageProvider>
          <div className="max-w-[1600px] mx-auto px-6 py-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#8B1874] to-[#5D1049] ring-2 ring-[#8B1874]/50 flex items-center justify-center font-bold text-2xl shadow-lg">
                  Q
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold leading-7 bg-gradient-to-r from-[#8B1874] via-[#A61F8F] to-[#8B1874] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                      ATM Guard & Cash Flow
                    </span>
                    <span className="text-xs text-[#A7B8D8] leading-4">
                      QNB Proactive Operations Platform
                    </span>
                  </div>
                  <div className="relative">
                    <style jsx>{`
                      @keyframes float {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-10px); }
                      }
                      .float-animation {
                        animation: float 3s ease-in-out infinite;
                      }
                    `}</style>
                    <span className="float-animation">
                      <Image src="/atm-mascot.png" alt="ATM Maskot" width={50} height={50} className="drop-shadow-2xl" />
                    </span>
                    <span className="absolute -top-2 -right-2">
                      <span className="text-xl animate-pulse">✨</span>
                      <span className="absolute inset-0 text-xl animate-ping opacity-50">✨</span>
                    </span>
                  </div>
                </div>
              </div>

              <Tabs />
            </div>

            {children}
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
