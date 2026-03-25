import { useState, useCallback, useEffect } from 'react';
import { ShieldCheck, Search, CheckCircle2, XCircle, AlertTriangle, Clock, RotateCcw, Volume2, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SharedHeader } from '@/components/SharedHeader';
import { TerminalNav } from '@/components/TerminalNav';
import { AuditLog } from '@/components/AuditLog';
import { LanguageSelection } from '@/components/LanguageSelection';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLanguageSelection } from '@/contexts/LanguageSelectionContext';
import { useVoterDB } from '@/contexts/VoterContext';
import { getTokenStatus, approveVoting, verifyToken } from '@/lib/api';
import { cn } from '@/lib/utils';

const ID_TYPE_KEYS = [
  { value: 'voter_id', labelKey: 'voterId' },
  { value: 'aadhaar', labelKey: 'aadhaarCard' },
  { value: 'pan', labelKey: 'panCard' },
  { value: 'driving_license', labelKey: 'drivingLicense' },
  { value: 'passport', labelKey: 'passport' },
  { value: 'mgnrega', labelKey: 'mgnregaCard' },
  { value: 'smart_card', labelKey: 'smartCard' },
  { value: 'health_insurance', labelKey: 'healthInsurance' },
  { value: 'service_id', labelKey: 'serviceId' },
  { value: 'pension', labelKey: 'pensionDoc' },
  { value: 'passbook', labelKey: 'passbook' },
  { value: 'transgender_certificate', labelKey: 'transgenderCertificate' },
] as const;

type IdType = typeof ID_TYPE_KEYS[number]['value'];

export default function TokenCheckPage() {
    // Reset handler for clearing state
    const handleReset = useCallback(() => {
      setSearchId('');
      setFoundToken(null);
      setSearchResult('idle');
      setTokenApproved(false);
      setVoteConfirmed(false);
      setRemainingSeconds(null);
      setError('');
      setLanguageSelected(false);
    }, [setLanguageSelected]);

    // Helper for voting in progress
    const votingInProgress = tokenApproved && !voteConfirmed;
  const { t, lang } = useLanguage();
  const { isLanguageSelected, setLanguageSelected } = useLanguageSelection();
  const { addAuditEntry, auditLog } = useVoterDB();
  const [darkMode, setDarkMode] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [searchId, setSearchId] = useState('');
  const [selectedIdType, setSelectedIdType] = useState<IdType>('voter_id');
  const [foundToken, setFoundToken] = useState<any>(null);
  const [searchResult, setSearchResult] = useState<'idle' | 'found' | 'not_found'>('idle');
  const [tokenApproved, setTokenApproved] = useState(false);
  const [voteConfirmed, setVoteConfirmed] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const terminalAudit = auditLog.filter(e => e.terminal === 'tvo');

  // Poll token status in real-time when token is approved
  useEffect(() => {
    if (!tokenApproved || !foundToken || voteConfirmed) {
      setRemainingSeconds(null);
      return;
    }
    let lastRemaining = null;
    const interval = setInterval(async () => {
      try {
        const status = await getTokenStatus(foundToken.id);
        if (typeof status.remainingTime === 'number') {
          setRemainingSeconds(status.remainingTime);
          // Only log expiration once
          if (status.remainingTime <= 0 && lastRemaining && lastRemaining > 0) {
            addAuditEntry({
              terminal: 'tvo',
              action: 'Token expired',
              status: 'warning',
              details: `3-minute voting window expired for voter ${foundToken.voter?.id}`,
              voterId: foundToken.voter?.id,
            });
            setTokenApproved(false);
            setFoundToken(null);
            setSearchResult('idle');
          }
          lastRemaining = status.remainingTime;
        } else if (status.status === 'EXPIRED') {
          setRemainingSeconds(0);
          addAuditEntry({
            terminal: 'tvo',
            action: 'Token expired',
            status: 'warning',
            details: `Token expired before voting could be confirmed`,
            voterId: foundToken.voter?.id,
          });
          setTokenApproved(false);
          setFoundToken(null);
          setSearchResult('idle');
        }
      } catch (err) {
        console.error('Error polling token status:', err);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [tokenApproved, foundToken, voteConfirmed, addAuditEntry]);

  const selectedIdLabel = selectedIdType === 'voter_id' ? (lang === 'hi' ? 'मतदाता आईडी' : 'Voter ID') : t(ID_TYPE_KEYS.find(x => x.value === selectedIdType)!.labelKey as any);

  const handleSearch = useCallback(async () => {
    if (searchId.trim().length < 3) return;
    setIsLoading(true);
    setError('');

    try {
      // For now, search by voter ID
      // TODO: Integrate with backend token lookup API
      addAuditEntry({
        terminal: 'tvo',
        action: 'Token lookup initiated',
        status: 'info',
        details: `Searching for token: ${searchId}`,
      });
      setSearchResult('not_found');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      addAuditEntry({
        terminal: 'tvo',
        action: 'Token lookup failed',
        status: 'error',
        details: error,
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchId, selectedIdType, addAuditEntry, error]);

  const handleApproveToken = useCallback(async () => {
    if (!foundToken) return;
    setIsLoading(true);
    setError('');

    try {
      const result = await verifyToken(foundToken.id);
      console.log('✅ Token verified:', result);

      setTokenApproved(true);
      setRemainingSeconds(180); // 3 minutes = 180 seconds
      addAuditEntry({
        terminal: 'tvo',
        action: 'Token verified and approved',
        status: 'success',
        details: `3-minute voting window started for voter ${foundToken.voter?.name}`,
        voterId: foundToken.voter?.id,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to approve token';
      setError(errMsg);
      addAuditEntry({
        terminal: 'tvo',
        action: 'Token approval failed',
        status: 'error',
        details: errMsg,
        voterId: foundToken.voter?.id,
      });
    } finally {
      setIsLoading(false);
    }
  }, [foundToken, addAuditEntry]);

  const handleConfirmVote = useCallback(async () => {
    if (!foundToken) return;
    setIsLoading(true);
    setError('');

    try {
      const result = await approveVoting(foundToken.id);
      console.log('✅ Vote confirmed:', result);

      setVoteConfirmed(true);
      setTokenApproved(false);
      addAuditEntry({
        terminal: 'tvo',
        action: 'Vote confirmed',
        status: 'success',
        details: `EVM signal received - voter ${foundToken.voter?.name} has voted`,
        voterId: foundToken.voter?.id,
      });

      // Play beep sound
      try {
        const ctx = new AudioContext();
            {/* Timer and status display after TVO approval */}
            {tokenApproved && remainingSeconds !== null && !voteConfirmed ? (
              <Card className="fade-in border-warning/30 shadow-lg">
                <CardContent className="py-12 text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
                    <Clock className="w-10 h-10 text-warning animate-pulse" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">
                    {lang === 'hi' ? 'मतदान प्रगति में...' : 'Voting In Progress...'}
                  </h2>
                  <p className="text-muted-foreground">
                    Voter: <span className="font-mono font-bold">{foundToken?.voterId || foundToken?.voter?.voterId}</span>
                  </p>
                  <div className="flex flex-col items-center gap-2 pt-4">
                    <span className="text-sm text-muted-foreground font-medium">
                      {lang === 'hi' ? 'समय शेष:' : 'Time Left:'}
                    </span>
                    <span className={cn('font-mono font-bold text-2xl', remainingSeconds <= 30 ? 'text-destructive' : 'text-foreground')}>
                      {remainingSeconds > 0 ? `${Math.floor(remainingSeconds / 60)}:${(remainingSeconds % 60).toString().padStart(2, '0')}` : (lang === 'hi' ? 'समाप्त' : 'Expired')}
                    </span>
                  </div>
                  {remainingSeconds === 0 && (
                    <div className="mt-4 text-destructive font-semibold">
                      {lang === 'hi' ? 'टोकन समाप्त हो गया' : 'Token Expired'}
                    </div>
                  )}
                  <Button variant="booth-outline" onClick={handleReset} className="mt-6">
                    {lang === 'hi' ? 'रीसेट करें' : 'Reset'}
                  </Button>
                </CardContent>
              </Card>
            ) : voteConfirmed ? (
              <div className="text-center py-12 fade-in bg-card border border-border rounded-lg">
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {lang === 'hi' ? 'मतदान सफलतापूर्वक दर्ज' : 'Vote Recorded Successfully'}
                </h2>
                <p className="text-muted-foreground mb-2">Voter: <span className="font-mono">{foundToken?.voterId || foundToken?.voter?.voterId}</span></p>
                <div className="flex items-center justify-center gap-2 text-success mb-6">
                  <Volume2 className="w-5 h-5" />
                  <span className="text-sm font-medium">{lang === 'hi' ? 'EVM बीप प्राप्त' : 'EVM Beep Confirmed'}</span>
                </div>
                <Button variant="booth" onClick={handleReset} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> {lang === 'hi' ? 'अगले मतदाता' : 'Next Voter'}
                </Button>
              </div>
            ) : (
              <Card className="fade-in border-primary/20 shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {lang === 'hi' ? 'टोकन सत्यापन' : 'Token Verification'}
                      </CardTitle>
                      <CardDescription>
                        {lang === 'hi' ? 'मतदाता आईडी से सक्रिय टोकन खोजें' : 'Search active token by Voter ID'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('selectIdType')}</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between h-11 text-base font-medium">
                          <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" />{selectedIdLabel}</span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {ID_TYPE_KEYS.map((id) => (
                          <DropdownMenuItem key={id.value} onClick={() => setSelectedIdType(id.value as IdType)}>
                            {t(id.labelKey as any)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Input
                    value={searchId}
                    onChange={e => setSearchId(e.target.value)}
                    placeholder={lang === 'hi' ? 'आईडी नंबर दर्ज करें' : 'Enter ID number'}
                    className="w-full h-11 text-base font-mono"
                    onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                  />
                  <Button variant="booth" className="w-full gap-2" onClick={handleSearch} disabled={isLoading}>
                    <Search className="w-4 h-4" /> {lang === 'hi' ? 'खोजें' : 'Search'}
                  </Button>
                  {error && <div className="text-xs text-destructive font-medium mt-2">{error}</div>}
                </CardContent>
              </Card>
            )}
            {/* Status and TVO Terminal label, always shown below the Card */}
            <div className="mt-4">
              <p className="text-sm font-semibold text-foreground">
                {voteConfirmed ? (lang === 'hi' ? 'मतदान पूर्ण' : 'Vote Confirmed') 
                  : votingInProgress ? (lang === 'hi' ? 'मतदान प्रगति में' : 'Voting In Progress') 
                  : (lang === 'hi' ? 'मतदाता खोजें' : 'Search Voter')}
              </p>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                TVO Terminal
              </span>
            </div>

            {voteConfirmed ? (
              <div className="text-center py-12 fade-in bg-card border border-border rounded-lg">
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {lang === 'hi' ? 'मतदान सफलतापूर्वक दर्ज' : 'Vote Recorded Successfully'}
                </h2>
                <p className="text-muted-foreground mb-2">Voter: <span className="font-mono">{foundToken?.voterId || foundToken?.voter?.voterId}</span></p>
                <div className="flex items-center justify-center gap-2 text-success mb-6">
                  <Volume2 className="w-5 h-5" />
                  <span className="text-sm font-medium">{lang === 'hi' ? 'EVM बीप प्राप्त' : 'EVM Beep Confirmed'}</span>
                </div>
                <Button variant="booth" onClick={handleReset} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> {lang === 'hi' ? 'अगले मतदाता' : 'Next Voter'}
                </Button>
              </div>
            ) : votingInProgress ? (
              <Card className="fade-in border-warning/30 shadow-lg">
                <CardContent className="py-12 text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
                    <Clock className="w-10 h-10 text-warning animate-pulse" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">
                    {lang === 'hi' ? 'मतदान प्रगति में...' : 'Voting In Progress...'}
                  </h2>
                  <p className="text-muted-foreground">
                    Voter: <span className="font-mono font-bold">{foundToken?.voterId || foundToken?.voter?.voterId}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {lang === 'hi' ? 'EVM सिग्नल की प्रतीक्षा...' : 'Waiting for EVM signal...'}
                  </p>
                  <div className="flex gap-3 justify-center pt-4">
                    <Button variant="booth-success" onClick={handleConfirmVote} className="gap-2">
                      <Volume2 className="w-5 h-5" />
                      {lang === 'hi' ? 'EVM बीप प्राप्त — पुष्टि करें' : 'EVM Beep Received — Confirm Vote'}
                    </Button>
                    <Button variant="booth-outline" onClick={handleReset}>
                      {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="fade-in border-primary/20 shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {lang === 'hi' ? 'टोकन सत्यापन' : 'Token Verification'}
                      </CardTitle>
                      <CardDescription>
                        {lang === 'hi' ? 'मतदाता आईडी से सक्रिय टोकन खोजें' : 'Search active token by Voter ID'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('selectIdType')}</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between h-11 text-base font-medium">
                          <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" />{selectedIdLabel}</span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-64 overflow-y-auto">
                        {ID_TYPE_KEYS.map((type) => (
                          <DropdownMenuItem key={type.value} onClick={() => setSelectedIdType(type.value)}
                            className={`cursor-pointer ${selectedIdType === type.value ? 'bg-primary/10 text-primary font-medium' : ''}`}>
                            {t(type.labelKey as any)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {lang === 'hi' ? (selectedIdType === 'voter_id' ? 'मतदाता आईडी दर्ज करें' : selectedIdLabel + ' दर्ज करें') : (selectedIdType === 'voter_id' ? 'Enter Voter ID' : `Enter ${selectedIdLabel}`)}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder={selectedIdType === 'voter_id' ? "e.g., VTRXXXXXX" : "Enter ID number"}
                        value={searchId}
                        onChange={(e) => { setSearchId(e.target.value.toUpperCase()); setSearchResult('idle'); }}
                        className="font-mono h-12 text-lg uppercase"
                      />
                      <Button variant="booth" onClick={handleSearch} disabled={searchId.trim().length < 3} className="shrink-0 gap-2">
                        <Search className="w-5 h-5" />
                        {lang === 'hi' ? 'खोजें' : 'Search'}
                      </Button>
                    </div>
                  </div>

                  {searchResult === 'not_found' && (
                    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 fade-in">
                      <div className="flex items-center gap-3">
                        <XCircle className="w-6 h-6 text-destructive shrink-0" />
                        <div>
                          <p className="font-semibold text-destructive">{lang === 'hi' ? 'कोई सक्रिय टोकन नहीं मिला' : 'No Active Token Found'}</p>
                          <p className="text-sm text-muted-foreground">{lang === 'hi' ? 'इस आईडी के लिए कोई सक्रिय टोकन नहीं है' : 'No active token exists for this voter ID'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {searchResult === 'found' && foundToken && (
                    <div className="space-y-4 fade-in">
                      <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                        <div className="flex items-center gap-3 mb-3">
                          <CheckCircle2 className="w-6 h-6 text-success shrink-0" />
                          <p className="font-semibold text-success">{lang === 'hi' ? 'सक्रिय टोकन मिला!' : 'Active Token Found!'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">{lang === 'hi' ? 'मतदाता आईडी' : 'Voter ID'}</span>
                            <p className="font-mono font-bold">{foundToken.voterId || foundToken.voter?.voterId}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{lang === 'hi' ? 'टोकन' : 'Token'}</span>
                            <p className="font-mono font-bold text-primary">{foundToken.token || foundToken.code}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{lang === 'hi' ? 'सत्यापन प्रकार' : 'Verification'}</span>
                            <p className="font-medium">{foundToken.verificationMode === 'digital' ? '🖥️ Digital' : '📝 Manual'}</p>
                          </div>
                        </div>
                      </div>

                      <Button variant="booth-success" className="w-full gap-2" onClick={handleApproveToken}>
                        <ShieldCheck className="w-5 h-5" />
                        {lang === 'hi' ? 'EVM क्षेत्र में प्रवेश स्वीकृत करें' : 'Approve Entry to EVM Area'}
                      </Button>
                    </div>
                  )}

                  {/* Active tokens list removed - 'voters' is not defined in this file */}
                </CardContent>
              </Card>
            )}

          <div className="space-y-4">
            <AuditLog entries={terminalAudit.map(e => ({ ...e, status: e.status }))} />
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t('quickActions')}</h3>
              <Button variant="booth-destructive" className="w-full gap-2" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" /> {lang === 'hi' ? 'रीसेट करें' : 'Reset'}
              </Button>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{t('systemInfo')}</h3>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>{t('boothId')}</span><span className="font-mono">BH-2024-0147</span></div>
                <div className="flex justify-between"><span>{t('constituency')}</span><span>New Delhi - 01</span></div>
                <div className="flex justify-between"><span>Terminal</span><span className="font-mono text-accent">Token Verification</span></div>
                <div className="flex justify-between"><span>{t('status')}</span>
                  <span className={isOnline ? 'text-success' : 'text-destructive'}>{isOnline ? t('online') : t('offline')}</span>
                </div>
              </div>
            </div>
          </div>
      </main>
    </div>
  );
}
