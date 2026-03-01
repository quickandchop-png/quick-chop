import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Language, getSavedLanguage, saveLanguage, translate } from '../lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: async () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>('en');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSavedLanguage().then((l) => {
      setLang(l);
      setLoaded(true);
    });
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLang(lang);
    await saveLanguage(lang);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    return translate(language, key, params);
  }, [language]);

  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
