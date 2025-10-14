import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from '../locales/en/common.json';
import enEvaluation from '../locales/en/evaluation.json';
import enCoaching from '../locales/en/coaching.json';
import enSalesperson from '../locales/en/salesperson.json';
import bgCommon from '../locales/bg/common.json';
import bgEvaluation from '../locales/bg/evaluation.json';
import bgCoaching from '../locales/bg/coaching.json';
import bgSalesperson from '../locales/bg/salesperson.json';

const resources = {
  en: {
    common: enCommon,
    evaluation: enEvaluation,
    coaching: enCoaching,
    salesperson: enSalesperson,
  },
  bg: {
    common: bgCommon,
    evaluation: bgEvaluation,
    coaching: bgCoaching,
    salesperson: bgSalesperson,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false, // Disable debug even in development for cleaner mobile logs
    
    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    // Namespace configuration
    defaultNS: 'common',
    ns: ['common', 'evaluation', 'coaching', 'salesperson'],

    // Interpolation options
    interpolation: {
      escapeValue: false, // React already does escaping
    },

    // React options
    react: {
      useSuspense: false, // Critical for mobile - don't use Suspense
    },
  })
  .then(() => {
    console.log('✅ [i18n] Initialized successfully');
  })
  .catch((error) => {
    console.error('❌ [i18n] Initialization failed:', error);
  });

export default i18n;
