import { useLanguage } from "@/contexts/LanguageContext";
import { tr } from "@/translations/tr";
import { en } from "@/translations/en";

export function useTranslation() {
  const { language } = useLanguage();
  const t = language === "tr" ? tr : en;
  
  return { t, language };
}
