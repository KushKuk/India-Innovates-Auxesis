import { useState, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ManualVerification } from '@/components/ManualVerification';
import { SharedHeader } from '@/components/SharedHeader';
import { TerminalNav } from '@/components/TerminalNav';
import { AuditLog } from '@/components/AuditLog';
import { LanguageSelection } from '@/components/LanguageSelection';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLanguageSelection } from '@/contexts/LanguageSelectionContext';
import { useVoterDB } from '@/contexts/VoterContext';

export default function ManualVerifyPage() {
  const { t } = useLanguage();
  const { isLanguageSelected, setLanguageSelected } = useLanguageSelection();
  const { addVoter, addAuditEntry, auditLog } = useVoterDB();
  const [darkMode, setDarkMode] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [tokenGenerated, setTokenGenerated] = useState(false);
  const [generatedToken, setGeneratedToken] = useState('');
  const [currentVoterId, setCurrentVoterId] = useState('');
  const [currentVoterName, setCurrentVoterName] = useState('');

  const terminalAudit = auditLog.filter(e => e.terminal === 'manual');

  const handleManualComplete = useCallback((token: string, voterId: string, voterName: string) => {
    setGeneratedToken(token);
    setTokenGenerated(true);
    setCurrentVoterId(voterId);
    setCurrentVoterName(voterName);

    // No need to call addVoter here as ManualVerification already does it
    addAuditEntry({ terminal: 'manual', action: 'Manual verification approved & token generated', status: 'success', details: `Token: ${token}`, voterId });
  }, [addAuditEntry]);

  const handleReset = useCallback(() => {
    setTokenGenerated(false);
    setGeneratedToken('');
    setCurrentVoterId('');
    setLanguageSelected(false);
    addAuditEntry({ terminal: 'manual', action: 'Session reset', status: 'info' });
  }, [setLanguageSelected, addAuditEntry]);

  const toggleDark = () => { setDarkMode(d => !d); document.documentElement.classList.toggle('dark'); };
  const toggleOnline = () => setIsOnline(o => !o);

  if (!isLanguageSelected) {
    return <LanguageSelection onSelect={() => setLanguageSelected(true)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader darkMode={darkMode} toggleDark={toggleDark} isOnline={isOnline} toggleOnline={toggleOnline} />
      <TerminalNav />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between bg-card border border-border rounded-lg p-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('currentStage')}</p>
                <p className="text-sm font-semibold text-foreground">
                  {tokenGenerated ? t('tokenGenerated') : t('manualVerification')}
                </p>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-warning/10 text-warning">
                Supervisor Terminal
              </span>
            </div>

            {tokenGenerated ? (
              <div className="text-center py-12 fade-in bg-card border border-border rounded-lg">
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">✅</span>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">{t('manuallyVerifiedToken')}</h2>
                <div className="inline-block px-8 py-4 bg-muted rounded-xl border-2 border-dashed border-warning/30 my-4">
                  <p className="text-4xl font-mono font-bold tracking-[0.3em] text-warning">{generatedToken}</p>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Voter Name: <span className="font-semibold text-foreground">{currentVoterName}</span>
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  Voter ID: <span className="font-mono text-foreground">{currentVoterId}</span>
                </p>
                <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-warning/10 text-warning text-xs font-medium rounded-full mb-6">
                  {t('manualVerification')}
                </div>
                <p className="text-muted-foreground mb-6">{t('manualTokenDesc')}</p>
                <Button variant="booth" onClick={handleReset} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> {t('resetNextVoter')}
                </Button>
              </div>
            ) : (
              <ManualVerification onComplete={handleManualComplete} onCancel={() => {}} />
            )}
          </div>

          <div className="space-y-4">
            <AuditLog entries={terminalAudit.map(e => ({ ...e, status: e.status }))} />
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t('quickActions')}</h3>
              <Button variant="booth-destructive" className="w-full gap-2" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" /> {t('resetNextVoter')}
              </Button>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{t('systemInfo')}</h3>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>{t('boothId')}</span><span className="font-mono">BH-2024-0147</span></div>
                <div className="flex justify-between"><span>{t('constituency')}</span><span>New Delhi - 01</span></div>
                <div className="flex justify-between"><span>Terminal</span><span className="font-mono text-warning">Manual Verification</span></div>
                <div className="flex justify-between"><span>{t('status')}</span>
                  <span className={isOnline ? 'text-success' : 'text-destructive'}>{isOnline ? t('online') : t('offline')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
