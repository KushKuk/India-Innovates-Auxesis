import { createContext, useContext, useState, ReactNode } from 'react';

interface LanguageSelectionContextType {
  isLanguageSelected: boolean;
  setLanguageSelected: (selected: boolean) => void;
}

const LanguageSelectionContext = createContext<LanguageSelectionContextType | null>(null);

export function LanguageSelectionProvider({ children }: { children: ReactNode }) {
  const [isLanguageSelected, setLanguageSelected] = useState(false);

  return (
    <LanguageSelectionContext.Provider value={{ isLanguageSelected, setLanguageSelected }}>
      {children}
    </LanguageSelectionContext.Provider>
  );
}

export function useLanguageSelection() {
  const ctx = useContext(LanguageSelectionContext);
  if (!ctx) throw new Error('useLanguageSelection must be used within LanguageSelectionProvider');
  return ctx;
}
