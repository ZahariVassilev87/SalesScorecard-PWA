// Install prompt component for PWA installation
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface InstallPromptProps {
  onInstall?: () => void;
  onDismiss?: () => void;
}

const InstallPrompt: React.FC<InstallPromptProps> = ({ onInstall, onDismiss }) => {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const checkIfInstalled = () => {
      // Check if running in standalone mode
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
      
      // Check if running in fullscreen mode
      if (window.matchMedia('(display-mode: fullscreen)').matches) {
        setIsInstalled(true);
        return;
      }
      
      // Check if running in minimal-ui mode
      if (window.matchMedia('(display-mode: minimal-ui)').matches) {
        setIsInstalled(true);
        return;
      }
    };

    checkIfInstalled();

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show install prompt after a delay (not immediately)
      setTimeout(() => {
        if (!isInstalled) {
          setShowInstallPrompt(true);
        }
      }, 10000); // Show after 10 seconds
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      onInstall?.();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled, onInstall]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setIsInstalled(true);
        setShowInstallPrompt(false);
        onInstall?.();
      } else {
        console.log('User dismissed the install prompt');
        onDismiss?.();
      }
      
      // Clear the deferred prompt
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    onDismiss?.();
    
    // Don't show again for this session
    sessionStorage.setItem('installPromptDismissed', 'true');
  };

  // Don't show if already installed or dismissed in this session
  if (isInstalled || !showInstallPrompt || !deferredPrompt || sessionStorage.getItem('installPromptDismissed')) {
    return null;
  }

  return (
    <div className="install-prompt-overlay">
      <div className="install-prompt">
        <div className="install-prompt-header">
          <div className="install-icon">📱</div>
          <h3>Install Sales Scorecard</h3>
        </div>
        
        <div className="install-prompt-content">
          <p>Install this app on your device for a better experience:</p>
          <ul>
            <li>🚀 Faster loading and better performance</li>
            <li>📴 Works offline with automatic sync</li>
            <li>🔔 Push notifications for important updates</li>
            <li>📱 App-like experience on your home screen</li>
          </ul>
        </div>
        
        <div className="install-prompt-actions">
          <button 
            className="install-button"
            onClick={handleInstallClick}
          >
            Install App
          </button>
          <button 
            className="dismiss-button"
            onClick={handleDismiss}
          >
            Not Now
          </button>
        </div>
        
        <button 
          className="close-button"
          onClick={handleDismiss}
          aria-label="Close install prompt"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;



