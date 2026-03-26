import { useState, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressStepper } from '@/components/ProgressStepper';
import { AadhaarVerification } from '@/components/AadhaarVerification';
import { BiometricVerification } from '@/components/BiometricVerification';
import { SharedHeader } from '@/components/SharedHeader';
import { TerminalNav } from '@/components/TerminalNav';
import { AuditLog } from '@/components/AuditLog';
import { LanguageSelection } from '@/components/LanguageSelection';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLanguageSelection } from '@/contexts/LanguageSelectionContext';
import { useVoterDB } from '@/contexts/VoterContext';
import type { StageStatus } from '@/types/verification';

const generateToken = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export default function DigitalVerifyPage() {
  const { t, lang } = useLanguage();
  const { isLanguageSelected, setLanguageSelected } = useLanguageSelection();
  const { addVoter, addAuditEntry, auditLog } = useVoterDB();
  const [darkMode, setDarkMode] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [currentStage, setCurrentStage] = useState(0);
  const [stages, setStages] = useState<Record<string, StageStatus>>({ identity: 'active', biometric: 'pending' });
  const [tokenGenerated, setTokenGenerated] = useState(false);
  const [generatedToken, setGeneratedToken] = useState('');
  const [currentVoterId, setCurrentVoterId] = useState('');

  const terminalAudit = auditLog.filter(e => e.terminal === 'digital');

  const updateStage = useCallback((stage: string, status: StageStatus) => {
    setStages(prev => ({ ...prev, [stage]: status }));
  }, []);

  const handleIdSuccess = useCallback((voterId: string) => {
    updateStage('identity', 'success');
    updateStage('biometric', 'active');
    setCurrentStage(1);
    setCurrentVoterId(voterId);
    addAuditEntry({ terminal: 'digital', action: 'ID verified', status: 'success', details: `Identity confirmed (Voter: ${voterId})` });
  }, [updateStage, addAuditEntry]);

  const handleIdFail = useCallback(() => {
    updateStage('identity', 'failed');
    addAuditEntry({ terminal: 'digital', action: 'ID verification failed', status: 'error' });
  }, [updateStage, addAuditEntry]);

  const handleBiometricSuccess = useCallback(() => {
    updateStage('biometric', 'success');
    const token = generateToken();
    setGeneratedToken(token);
    setTokenGenerated(true);
    setCurrentStage(2);

    const voterId = currentVoterId || 'VOT001'; 
    setCurrentVoterId(voterId);
    
    addVoter({
      name: voterId === 'VOT001' ? 'Kushaagra Goel' : voterId === 'VOT002' ? 'Pranav Shukla' : 'Digital Voter',
      voterId,
      idType: 'aadhaar',
      idNumber: '****',
      token,
      tokenGeneratedAt: new Date(),
      tokenExpiresAt: new Date(Date.now() + 3 * 60 * 1000),
      verificationMode: 'digital',
      votingStatus: 'TOKEN_ACTIVE',
      hasVoted: false,
    });
    addAuditEntry({ terminal: 'digital', action: 'Biometric verified & token generated', status: 'success', details: `Token: ${token}`, voterId });
  }, [updateStage, addVoter, addAuditEntry]);

  const handleBiometricFail = useCallback(() => {
    updateStage('biometric', 'failed');
    addAuditEntry({ terminal: 'digital', action: 'Biometric verification failed', status: 'error' });
  }, [updateStage, addAuditEntry]);

  const handleReset = useCallback(() => {
    setCurrentStage(0);
    setStages({ identity: 'active', biometric: 'pending' });
    setTokenGenerated(false);
    setGeneratedToken('');
    setCurrentVoterId('');
    setLanguageSelected(false);
    addAuditEntry({ terminal: 'digital', action: 'Session reset', status: 'info' });
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
                  {tokenGenerated ? t('tokenGenerated') : [t('aadhaarVerification'), t('biometricVerification')][currentStage]}
                </p>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {lang === 'hi' ? 'डिजिटल टर्मिनल' : 'Digital Terminal'}
              </span>
            </div>

            {!tokenGenerated && (
              <div className="bg-card border border-border rounded-lg p-4">
                <ProgressStepper stages={stages} currentStage={currentStage} />
              </div>
            )}

            {tokenGenerated ? (
              <div className="text-center py-12 fade-in bg-card border border-border rounded-lg">
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">✅</span>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">{t('tokenGenerated')}</h2>
                <div className="inline-block px-8 py-4 bg-muted rounded-xl border-2 border-dashed border-primary/30 my-4">
                  <p className="text-4xl font-mono font-bold tracking-[0.3em] text-primary">{generatedToken}</p>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {lang === 'hi' ? 'मतदाता आईडी' : 'Voter ID'}: <span className="font-mono">{currentVoterId}</span>
                </p>
                <p className="text-muted-foreground mb-6">
                  {lang === 'hi' ? 'मतदाता अब टोकन सत्यापन डेस्क पर जा सकता है' : 'Voter may now proceed to the Token Verification desk'}
                </p>
                <Button variant="booth" onClick={handleReset} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> {t('resetNextVoter')}
                </Button>
              </div>
            ) : (
              <>
                {currentStage === 0 && (
                  <AadhaarVerification onSuccess={handleIdSuccess} onFail={handleIdFail} onSwitchManual={() => {}} />
                )}
                {currentStage === 1 && (
                  <BiometricVerification voterId={currentVoterId} onSuccess={handleBiometricSuccess} onFail={handleBiometricFail} onSwitchManual={() => {}} />
                )}
              </>
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
                <div className="flex justify-between"><span>Terminal</span><span className="font-mono text-primary">{lang === 'hi' ? 'डिजिटल सत्यापन' : 'Digital Verification'}</span></div>
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
