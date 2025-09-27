import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const currentLanguage = i18n.language;

  return (
    <div className="language-switcher">
      <button
        className={`language-button ${currentLanguage === 'en' ? 'active' : ''}`}
        onClick={() => changeLanguage('en')}
        title={t('language.english')}
      >
        🇺🇸 EN
      </button>
      <button
        className={`language-button ${currentLanguage === 'bg' ? 'active' : ''}`}
        onClick={() => changeLanguage('bg')}
        title={t('language.bulgarian')}
      >
        🇧🇬 BG
      </button>
    </div>
  );
};

export default LanguageSwitcher;
