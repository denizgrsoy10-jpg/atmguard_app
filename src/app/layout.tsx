import "./globals.css";
import Tabs from "@/components/Tabs";
import { LanguageProvider } from "@/contexts/LanguageContext";

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
                <div>
                  <div className="text-2xl font-bold leading-6 bg-gradient-to-r from-[#8B1874] via-[#A61F8F] to-[#8B1874] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                    ATM Guard & Cash Flow
                  </div>
                  <div className="text-xs text-[#A7B8D8] leading-4 mt-0.5">
                    QNB Proactive Operations Platform
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
