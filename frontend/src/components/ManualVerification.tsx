import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  UserCheck,
  Camera,
  CreditCard,
  FileText,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useVoterDB } from '@/contexts/VoterContext';
import { searchVoters, markVoterAsVoted } from '@/lib/voterDatabase';
import { Voter } from '@/types/verification';
import { searchVotersFromBackend, markVoterAsVotedInBackend, updateVoterStatusInBackend, manualVerify } from '@/lib/api';
import { auditLogger } from '@/lib/auditLogger';

interface Props {
  onComplete: (token: string, voterId: string, voterName: string) => void;
  onCancel: () => void;
  onAudit?: (action: string, status: 'info' | 'success' | 'error' | 'warning', details?: string) => void;
}

const VERIFICATION_REASONS = [
  { value: 'aadhaar_not_available', label: 'Aadhaar not available' },
  { value: 'scan_failed', label: 'Scan failed' },
  { value: 'biometric_mismatch', label: 'Biometric mismatch' },
  { value: 'other', label: 'Other' },
];

const ID_TYPES = [
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
  { value: 'transgender_certificate', labelKey: 'transgenderCertificate' },
];

export function ManualVerification({ onComplete, onCancel, onAudit }: Props) {
  const { t } = useLanguage();
  const { addVoter } = useVoterDB();

  const audit = useCallback(
    (action: string, status: 'info' | 'success' | 'error' | 'warning', details?: string) => {
      if (onAudit) {
        onAudit(action, status, details);
      } else {
        auditLogger[status](action, details);
      }
    },
    [onAudit]
  );

  // State for current step
  const [currentStep, setCurrentStep] = useState(1);
  const [auditInitialized, setAuditInitialized] = useState(false);

  // Step 1: Voter Search
  const [searchName, setSearchName] = useState('');
  const [searchDob, setSearchDob] = useState('');
  const [useAge, setUseAge] = useState(false);
  const [searchResults, setSearchResults] = useState<Voter[]>([]);
  const [searchError, setSearchError] = useState('');

  // Step 2: Select Voter
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null);

  // Step 3: Photo Matching
  const [photoMatched, setPhotoMatched] = useState(false);
  const [photoMismatch, setPhotoMismatch] = useState(false);

  // Step 4: ID Verification
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idVerified, setIdVerified] = useState(false);

  // Step 5: Demographic Verification
  const [detailsVerified, setDetailsVerified] = useState(false);

  // Step 6: Reason
  const [reason, setReason] = useState('');

  // Step 7: Officer info
  const [officerId, setOfficerId] = useState('EO001'); // Default officer ID

  // Step 8-9: Completion state
  const [supervisorApproved, setSupervisorApproved] = useState(false);
  const [alreadyVotedCheck, setAlreadyVotedCheck] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Initialize audit logging (only once)
  useEffect(() => {
    if (!auditInitialized) {
      audit('Manual verification started', 'info');
      setAuditInitialized(true);
    }
  }, []);

  // Step 1: Search Voter
  const handleSearchVoter = async () => {
    setSearchError('');
    setAlreadyVotedCheck(false);
    setSupervisorApproved(false);
    setToken(null);
    setSelectedVoter(null);

    if (!searchName.trim()) {
      setSearchError('Please enter voter name');
      return;
    }

    if (!searchDob.trim()) {
      setSearchError(useAge ? 'Please enter age' : 'Please enter date of birth');
      return;
    }

    try {
      setProcessing(true);
      console.log('🔍 Starting search...');
      const results = await searchVotersFromBackend(searchName, searchDob, useAge);
      console.log('📊 Search results:', results);

      if (!results || results.length === 0) {
        console.log('❌ No results found');
        audit('Voter search performed', 'error', `No match found for ${searchName}`);
        setSearchError('Voter not found in electoral roll – Not eligible to vote');
        setSearchResults([]);
      } else {
        console.log(`✅ Found ${results.length} voter(s), advancing to step 2`);
        audit('Voter search performed', 'success', `Found ${results.length} match(es)`);
        setSearchResults(results as Voter[]);
        setSearchError(''); // Explicitly clear error before advancing
        setCurrentStep(2); // Advance to voter selection
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      audit('Voter search performed', 'error', `Error searching: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSearchError('Error searching voters. Please check your connection and try again.');
      console.error('Search error:', error);
    } finally {
      setProcessing(false);
    }
  };

  // Step 2: Select Voter
  const handleSelectVoter = (voter: Voter) => {
    setSelectedVoter(voter);
    audit('Voter selected', 'success', voter.id);
    setCurrentStep(3); // Skip to Step 3 (Photo matching)
  };

  // Handlers for verification steps
  const handlePhotoMatch = (checked: boolean) => {
    setPhotoMatched(checked);
    if (checked) {
      setPhotoMismatch(false);
      audit('Photo match confirmed', 'success');
    }
  };

  const handlePhotoMismatch = (checked: boolean) => {
    setPhotoMismatch(checked);
    if (checked) {
      setPhotoMatched(false);
    }
  };

  const handleDenyVerification = () => {
    audit('Manual verification denied - Photo mismatch', 'error', selectedVoter?.id);
    setCurrentStep(-1);
  };

  const handleIdVerified = (checked: boolean) => {
    setIdVerified(checked);
    if (checked) {
      // Find matching document number from voter record
      let matchedNumber = 'MANUAL';
      if (selectedVoter?.documents) {
        // Map common frontend idTypes to backend documentType names
        const typeMap: Record<string, string> = {
          'aadhaar': 'Aadhaar Card',
          'pan': 'PAN Card',
          'voter_id': 'Voter ID',
          'driving_license': 'Driving License',
          'passport': 'Passport',
        };
        const targetName = typeMap[idType] || idType;
        const doc = selectedVoter.documents.find(d => 
          d.documentType.name.toLowerCase() === targetName.toLowerCase()
        );
        if (doc) matchedNumber = doc.documentNumber;
      }
      setIdNumber(matchedNumber);
      audit('ID verified', 'success', `${idType}: ${matchedNumber}`);
    }
  };

  const handleDetailsVerified = (checked: boolean) => {
    setDetailsVerified(checked);
    if (checked) {
      audit('Demographic details verified', 'success');
    }
  };

  const handleNextStep = () => {
    if (currentStep === 2 && searchResults.length > 0) {
      setCurrentStep(3);
    } else if (currentStep === 3 && photoMatched) {
      setCurrentStep(4);
    } else if (currentStep === 4 && idVerified) {
      setCurrentStep(5);
    } else if (currentStep === 5 && detailsVerified) {
      setCurrentStep(6);
    } else if (currentStep === 6 && reason) {
      setCurrentStep(7);
    } else if (currentStep === 7) {
      setCurrentStep(8);
    }
  };

  const handleSupervisorApproval = async () => {
    if (!selectedVoter) return;

    // Step 8: Check if already voted
    if (selectedVoter.hasVoted) {
      audit('Already voted check failed', 'error', selectedVoter.id);
      setAlreadyVotedCheck(true);
      return;
    }

    audit('Supervisor approved manual verification', 'success');
    setSupervisorApproved(true);
    setProcessing(true);

    // Step 9: Generate token and update voter status
    try {
      const response = await manualVerify({
        voterId: selectedVoter.id,
        idType: idType || 'manual',
        idNumber: idNumber || 'MANUAL',
        reason: reason,
        officerId: officerId
      });
      
      const newToken = response.code;
      setToken(newToken);
      audit('Token generated', 'success', newToken);
      setProcessing(false);

      // Add to global VoterContext for Token Verification screen
      addVoter({
        id: selectedVoter.id,
        tokenId: response.id,
        voterId: selectedVoter.voterId || selectedVoter.id,
        name: selectedVoter.name,
        idType: idType || 'manual',
        idNumber: idNumber || 'MANUAL',
        token: newToken,
        tokenGeneratedAt: new Date(),
        tokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
        verificationMode: 'manual',
        votingStatus: 'TOKEN_ACTIVE',
        hasVoted: false
      });

      // Complete after showing success
      setTimeout(() => {
        onComplete(newToken, selectedVoter.voterId || selectedVoter.id, selectedVoter.name);
      }, 1500);
    } catch (error) {
      audit('Token generation failed', 'error', error instanceof Error ? error.message : 'Unknown error');
      console.error('Error marking voter as voted:', error);
      setProcessing(false);
    }
  };

  const handleGoBack = () => {
    if (currentStep > 1) {
      if (currentStep === 2) {
        setAlreadyVotedCheck(false);
        setSupervisorApproved(false);
        setToken(null);
        setSelectedVoter(null);
      }
      setCurrentStep(currentStep - 1);
    } else {
      onCancel();
    }
  };

  // ===== RENDER STEPS =====

  // Step -1: Verification Terminated
  if (currentStep === -1) {
    return (
      <Card className="fade-in border-destructive/30 shadow-lg">
        <CardContent className="pt-8 pb-8">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-2 border-4 border-destructive/20">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-destructive">Verification Terminated</h2>
            <div className="p-4 bg-muted rounded-lg max-w-sm mx-auto">
              <p className="font-medium">Identity Mismatch</p>
              <p className="text-sm text-muted-foreground mt-1">Verification has been denied because the photo on record does not match the person.</p>
            </div>
            <Button 
              onClick={() => {
                setCurrentStep(1);
                setSearchName('');
                setSearchDob('');
                setSearchResults([]);
              }} 
              variant="default"
              className="mt-4"
            >
              Start Over
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 1: Voter Search
  if (currentStep === 1) {
    return (
      <Card className="fade-in border-primary/30 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Search className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Search Voter</CardTitle>
              <CardDescription>Find the voter in the electoral roll</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Voter Name</label>
            <Input
              placeholder="Full name (e.g., Rajesh Kumar Singh)"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="h-11"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox id="useAge" checked={useAge} onCheckedChange={(v) => setUseAge(!!v)} />
              <label htmlFor="useAge" className="text-sm cursor-pointer">
                Search by age instead of date of birth
              </label>
            </div>
            <Input
              placeholder={useAge ? 'Age (e.g., 35)' : 'Date of birth (YYYY-MM-DD)'}
              value={searchDob}
              onChange={(e) => setSearchDob(e.target.value)}
              className="h-11"
            />
          </div>

          {searchError && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2 border border-destructive/20">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {searchError}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button variant="default" onClick={handleSearchVoter} className="flex-1">
              Search Voter
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 2: Select Voter
  if (currentStep === 2) {
    return (
      <Card className="fade-in border-primary/30 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Select Voter</CardTitle>
              <CardDescription>
                Found {searchResults.length} match{searchResults.length !== 1 ? 'es' : ''}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {searchResults.map((voter) => (
            <button
              key={voter.id}
              onClick={() => handleSelectVoter(voter)}
              className="w-full p-3 rounded-lg border border-border hover:bg-muted transition-colors text-left"
            >
              <div className="flex items-start gap-3">
                <img
                  src={voter.photoUrl}
                  alt={voter.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{voter.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {useAge ? `Age: ${voter.age}` : `DOB: ${voter.dob}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{voter.address}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleGoBack} className="flex-1">
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedVoter) {
    return (
      <Card className="fade-in border-destructive/30 shadow-lg">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="font-semibold">No Voter Selected</p>
            <p className="text-sm text-muted-foreground">Please search and select a voter</p>
            <Button onClick={() => setCurrentStep(1)} variant="default">
              Start Over
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 3: Photo Matching
  if (currentStep === 3) {
    return (
      <Card className="fade-in border-primary/30 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Camera className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Photo Matching</CardTitle>
              <CardDescription>Verify photo matches the voter</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex justify-center">
            <img
              src={selectedVoter.photoUrl}
              alt={selectedVoter.name}
              className="w-32 h-32 rounded-full object-cover border-4 border-primary"
            />
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">{selectedVoter.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{selectedVoter.address}</p>
          </div>

          <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm font-semibold">Verification Checklist</p>
            <div className="flex items-center gap-3">
              <Checkbox
                id="photoMatch"
                checked={photoMatched}
                onCheckedChange={handlePhotoMatch}
              />
              <label htmlFor="photoMatch" className="text-sm cursor-pointer">
                Photo matches the person
              </label>
            </div>
            
            <div className="flex items-center gap-3 mt-2">
              <Checkbox
                id="photoMismatch"
                checked={photoMismatch}
                onCheckedChange={handlePhotoMismatch}
              />
              <label htmlFor="photoMismatch" className="text-sm cursor-pointer text-destructive">
                Photo DOES NOT match the person
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGoBack} className="flex-1">
              Back
            </Button>
            {photoMismatch ? (
              <Button
                variant="destructive"
                onClick={handleDenyVerification}
                className="flex-1"
              >
                Deny Verification
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={handleNextStep}
                disabled={!photoMatched}
                className="flex-1"
              >
                Next
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 4: Secondary ID Verification
  if (currentStep === 4) {
    return (
      <Card className="fade-in border-primary/30 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Secondary ID Verification</CardTitle>
              <CardDescription>Confirm at least one valid ID</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">ID Type</label>
            <Select value={idType} onValueChange={setIdType}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select ID type" />
              </SelectTrigger>
              <SelectContent>
                {ID_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {t(type.labelKey as any)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm font-semibold">Verification Checklist</p>
            <div className="flex items-center gap-3">
              <Checkbox
                id="idVerified"
                checked={idVerified}
                onCheckedChange={handleIdVerified}
                disabled={!idType}
              />
              <label htmlFor="idVerified" className="text-sm cursor-pointer">
                Valid ID verified
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGoBack} className="flex-1">
              Back
            </Button>
            <Button
              variant="default"
              onClick={handleNextStep}
              disabled={!idVerified}
              className="flex-1"
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 5: Demographic Verification
  if (currentStep === 5) {
    return (
      <Card className="fade-in border-primary/30 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Demographic Verification</CardTitle>
              <CardDescription>Confirm voter details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-semibold">{selectedVoter.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Age</p>
              <p className="font-semibold">{selectedVoter.age} years</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date of Birth</p>
              <p className="font-semibold">{selectedVoter.dob}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="font-semibold">{selectedVoter.address}</p>
            </div>
          </div>

          <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm font-semibold">Verification Checklist</p>
            <div className="flex items-center gap-3">
              <Checkbox
                id="detailsVerified"
                checked={detailsVerified}
                onCheckedChange={handleDetailsVerified}
              />
              <label htmlFor="detailsVerified" className="text-sm cursor-pointer">
                Details verified
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGoBack} className="flex-1">
              Back
            </Button>
            <Button
              variant="default"
              onClick={handleNextStep}
              disabled={!detailsVerified}
              className="flex-1"
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 6: Reason for Manual Verification
  if (currentStep === 6) {
    return (
      <Card className="fade-in border-primary/30 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Reason for Manual Verification</CardTitle>
              <CardDescription>Why is manual verification required?</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select reason" />
            </SelectTrigger>
            <SelectContent>
              {VERIFICATION_REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGoBack} className="flex-1">
              Back
            </Button>
            <Button
              variant="default"
              onClick={handleNextStep}
              disabled={!reason}
              className="flex-1"
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 7: Officer + Supervisor Control
  if (currentStep === 7) {
    return (
      <Card className="fade-in border-primary/30 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Officer Authorization</CardTitle>
              <CardDescription>Officer and supervisor approval required</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Officer ID</p>
              <p className="font-semibold">{officerId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Voter</p>
              <p className="font-semibold">{selectedVoter.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reason</p>
              <p className="font-semibold">
                {VERIFICATION_REASONS.find((r) => r.value === reason)?.label}
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
            Supervisor approval is required to proceed with token generation
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGoBack} className="flex-1">
              Back
            </Button>
            <Button variant="default" onClick={handleNextStep} className="flex-1">
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 8-9: Final Approval and Token Generation
  if (supervisorApproved && token) {
    return (
      <Card className="fade-in border-success/30 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <CardTitle className="text-lg text-success">Verification Complete</CardTitle>
              <CardDescription>Voter verified and token generated</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3 p-4 bg-success/10 rounded-lg border border-success/20">
            <div>
              <p className="text-xs text-success/70">Voter Name</p>
              <p className="font-semibold text-success">{selectedVoter.name}</p>
            </div>
            <div>
              <p className="text-xs text-success/70">Verification Type</p>
              <p className="font-semibold text-success">Manually Verified</p>
            </div>
            <div>
              <p className="text-xs text-success/70">Voting Token</p>
              <p className="font-mono font-bold text-lg text-success">{token}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alreadyVotedCheck) {
    return (
      <Card className="fade-in border-destructive/30 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <X className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg text-destructive">Already Voted</CardTitle>
              <CardDescription>This voter has already cast their vote</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
            This voter has already cast their vote and cannot vote again.
          </div>
          <Button onClick={() => { 
            setAlreadyVotedCheck(false);
            setSupervisorApproved(false);
            setToken(null);
            setSelectedVoter(null);
            setCurrentStep(1); 
          }} variant="outline" className="w-full">
            Search Another Voter
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Final Approval Step
  return (
    <Card className="fade-in border-warning/30 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-warning" />
          </div>
          <div>
            <CardTitle className="text-lg">Supervisor Approval Required</CardTitle>
            <CardDescription>Review and approve manual verification</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Voter Name</p>
              <p className="font-semibold text-sm">{selectedVoter.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Officer ID</p>
              <p className="font-semibold text-sm">{officerId}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reason</p>
            <p className="font-semibold text-sm">
              {VERIFICATION_REASONS.find((r) => r.value === reason)?.label}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
          <p className="text-xs font-semibold text-warning mb-2">Verification Steps Completed:</p>
          <ul className="text-xs text-warning space-y-1">
            <li>✓ Voter found in electoral roll</li>
            <li>✓ Photo matched</li>
            <li>✓ ID verified</li>
            <li>✓ Demographics confirmed</li>
          </ul>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGoBack} className="flex-1">
            Back
          </Button>
          <Button
            variant="default"
            onClick={handleSupervisorApproval}
            disabled={processing}
            className="flex-1"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                Approving...
              </span>
            ) : (
              'Approve & Generate Token'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
