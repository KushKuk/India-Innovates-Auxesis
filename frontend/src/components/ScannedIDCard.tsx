import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  voter: {
    id: string;
    name: string;
    documentType: string;
    documentNumber?: string;
  };
  compact?: boolean;
}

export function ScannedIDCard({ voter, compact = false }: Props) {
  const { t } = useLanguage();
  
  if (compact) {
    return (
      <div className="p-4 bg-green-50/50 border border-green-200 rounded-xl flex items-center justify-between animate-in fade-in duration-500">
        <div className="flex items-center gap-4">
          <div className="px-2 py-1 bg-green-100 rounded-md font-bold text-[10px] uppercase tracking-wider border border-green-200 text-green-700">
            {voter.documentType}
          </div>
          <div>
            <h3 className="text-sm font-bold text-green-900 leading-tight">
              {voter.name}
            </h3>
            <p className="text-xs font-mono text-green-700/70 mt-0.5">
              {voter.documentNumber || voter.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-100/50 text-green-700 rounded-full text-[10px] font-bold border border-green-200">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          {t('verifiedSuccess').split('.')[0]}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-green-50 border-2 border-green-200 rounded-xl space-y-4 animate-in zoom-in slide-in-from-top-4 duration-300 shadow-sm">
      <div className="flex items-center justify-center gap-2 text-green-700">
        <div className="px-3 py-1 bg-green-100 rounded-md font-bold text-xs uppercase tracking-wider border border-green-200">
          {voter.documentType}
        </div>
        <div className="text-lg font-mono font-bold tracking-tight">
          {voter.documentNumber || voter.id}
        </div>
      </div>
      
      <div className="text-center">
        <h3 className="text-2xl font-extrabold text-green-900 tracking-tight">
          {voter.name}
        </h3>
        <p className="text-green-600 font-medium mt-1 flex items-center justify-center gap-2 text-sm">
          <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          {t('identityVerification')} {t('verifiedSuccess').split('.')[0]}
        </p>
      </div>
    </div>
  );
}
