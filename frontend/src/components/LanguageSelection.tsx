import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { ECILogo } from "@/components/ECILogo";


interface Props {
  onSelect: () => void;
}

export function LanguageSelection({ onSelect }: Props) {
  const { lang, setLang } = useLanguage();

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden">
      {/* Background Logo Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <img 
          src="/OneVote.png" 
          alt="" 
          className="w-[120%] h-[120%] object-contain opacity-[0.08] scale-110"
        />
      </div>

      <div className="relative z-10 w-full max-w-md text-center space-y-8">
        <div className="space-y-4">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto">
            <ECILogo size={64} /> 
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">OneVote</h1>
            <p className="text-lg text-muted-foreground mt-1">कृपया अपनी भाषा चुनें</p>
          </div>
          <p className="text-sm text-muted-foreground">
            OneVote — Secured Polling Booth System
          </p>
          <p className="text-sm text-muted-foreground">
            वनवोट — सुरक्षित मतदान केंद्र प्रणाली
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setLang('en')}
            className={`w-full p-5 rounded-xl border-2 text-left transition-all duration-200 ${
              lang === 'en'
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">EN</span>
              <div>
                <p className="text-lg font-semibold text-foreground">English</p>
                <p className="text-sm text-muted-foreground">Continue in English</p>
              </div>
              {lang === 'en' && (
                <div className="ml-auto w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-sm">✓</span>
                </div>
              )}
            </div>
          </button>

          <button
            onClick={() => setLang('hi')}
            className={`w-full p-5 rounded-xl border-2 text-left transition-all duration-200 ${
              lang === 'hi'
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">हि</span>
              <div>
                <p className="text-lg font-semibold text-foreground">हिन्दी</p>
                <p className="text-sm text-muted-foreground">हिन्दी में जारी रखें</p>
              </div>
              {lang === 'hi' && (
                <div className="ml-auto w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-sm">✓</span>
                </div>
              )}
            </div>
          </button>
        </div>

        <Button variant="booth" className="w-full h-14 text-lg" onClick={onSelect}>
          {lang === 'hi' ? 'आगे बढ़ें' : 'Proceed'}
        </Button>
      </div>
    </div>
  );
}
