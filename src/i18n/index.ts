import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from '../locales/en/common.json';
import enEvaluation from '../locales/en/evaluation.json';
import bgCommon from '../locales/bg/common.json';
import bgEvaluation from '../locales/bg/evaluation.json';

const resources = {
  en: {
    common: enCommon,
    evaluation: enEvaluation,
  },
  bg: {
    common: bgCommon,
    evaluation: bgEvaluation,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    // Namespace configuration
    defaultNS: 'common',
    ns: ['common', 'evaluation'],

    // Interpolation options
    interpolation: {
      escapeValue: false, // React already does escaping
    },

    // React options
    react: {
      useSuspense: false,
    },
  });

export default i18n;
