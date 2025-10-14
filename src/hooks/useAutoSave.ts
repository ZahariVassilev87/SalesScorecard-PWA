import { useEffect, useRef } from 'react';

interface AutoSaveOptions {
  key: string;
  data: any;
  interval?: number;
  onSave?: (data: any) => void;
}

export const useAutoSave = ({ key, data, interval = 5000, onSave }: AutoSaveOptions) => {
  const lastSavedRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Skip if data hasn't changed
    const currentDataString = JSON.stringify(data);
    if (currentDataString === lastSavedRef.current) {
      return;
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`autosave_${key}`, currentDataString);
        lastSavedRef.current = currentDataString;
        console.log(`💾 [AutoSave] Saved ${key}:`, data);
        
        if (onSave) {
          onSave(data);
        }
      } catch (error) {
        console.error(`❌ [AutoSave] Failed to save ${key}:`, error);
      }
    }, interval);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, key, interval, onSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Function to restore saved data
  const restoreData = () => {
    try {
      const savedData = localStorage.getItem(`autosave_${key}`);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        console.log(`🔄 [AutoSave] Restored ${key}:`, parsedData);
        return parsedData;
      }
    } catch (error) {
      console.error(`❌ [AutoSave] Failed to restore ${key}:`, error);
    }
    return null;
  };

  // Function to clear saved data
  const clearSavedData = () => {
    try {
      localStorage.removeItem(`autosave_${key}`);
      lastSavedRef.current = '';
      console.log(`🗑️ [AutoSave] Cleared ${key}`);
    } catch (error) {
      console.error(`❌ [AutoSave] Failed to clear ${key}:`, error);
    }
  };

  return { restoreData, clearSavedData };
};




