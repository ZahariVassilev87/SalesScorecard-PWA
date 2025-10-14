import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentLanguage = i18n.language;

  const getCurrentLanguageDisplay = () => {
    return currentLanguage === 'en' ? '🇺🇸 EN' : '🇧🇬 BG';
  };

  return (
    <div className="language-switcher" ref={dropdownRef}>
      <button
        className="language-dropdown-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title={t('language.switch')}
      >
        {getCurrentLanguageDisplay()}
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      
      {isOpen && (
        <div className="language-dropdown">
          <button
            className={`language-option ${currentLanguage === 'en' ? 'active' : ''}`}
            onClick={() => changeLanguage('en')}
            title={t('language.english')}
          >
            🇺🇸 English
          </button>
          <button
            className={`language-option ${currentLanguage === 'bg' ? 'active' : ''}`}
            onClick={() => changeLanguage('bg')}
            title={t('language.bulgarian')}
          >
            🇧🇬 Български
          </button>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
