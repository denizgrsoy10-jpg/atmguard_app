"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Tabs() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();

  const tabs = [
    { href: "/overview", label: t.nav.overview },
    { href: "/trend-health", label: t.nav.trendHealth },
    { href: "/cashflow-ops", label: t.nav.cashflow },
    { href: "/command-center", label: t.nav.commandCenter },
    { href: "/budget-performance", label: "💰 Bütçe & Tasarruf" },
  ];

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-2 bg-[#112544] rounded-2xl p-1 ring-1 ring-[#2B416B]">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                "px-3 py-2 rounded-xl text-sm transition " +
                (active
                  ? "bg-[#2E86FF] text-white"
                  : "bg-transparent text-white/80 hover:bg-white/10")
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Language Switcher */}
      <div className="flex gap-1 bg-[#112544] rounded-xl p-1 ring-1 ring-[#2B416B]">
        <button
          onClick={() => setLanguage("tr")}
          className={
            "px-2 py-1 rounded-lg text-xs font-semibold transition " +
            (language === "tr"
              ? "bg-[#2E86FF] text-white"
              : "bg-transparent text-white/60 hover:text-white/80")
          }
        >
          TR
        </button>
        <button
          onClick={() => setLanguage("en")}
          className={
            "px-2 py-1 rounded-lg text-xs font-semibold transition " +
            (language === "en"
              ? "bg-[#2E86FF] text-white"
              : "bg-transparent text-white/60 hover:text-white/80")
          }
        >
          EN
        </button>
      </div>
    </div>
  );
}
