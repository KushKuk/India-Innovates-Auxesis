import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'hi';

const translations = {
  en: {
    // Language selection
    langSelectTitle: 'Choose Your Language',
    langSelectSubtitle: 'कृपया अपनी भाषा चुनें',
    langEnglish: 'English',
    langHindi: 'हिन्दी (Hindi)',
    langProceed: 'Proceed',

    // Header
    headerTitle: 'Secure Voter Verification',
    headerSubtitle: 'Election Commission of India — Polling Booth System',
    online: 'Online',
    offline: 'Offline',

    // Status bar
    currentStage: 'Current Stage',
    votingComplete: '✓ Voting Complete',
    tokenGenerated: 'Token Generated',
    manualVerification: 'Manual Verification',
    mode: 'Mode',
    primary: 'Primary',
    manual: 'Manual',

    // Stages
    stage1Title: 'Identity Verification',
    stage1Desc: 'Scan QR code on your ID card',
    stage2Title: 'Biometric Verification',
    stage2Desc: 'Place finger on scanner or look into facial reader',
    stage3Title: 'Stage 3: Voter ID Verification',
    stage3Desc: 'Enter or scan the voter\'s EPIC number',

    // Aadhaar / ID verification
    selectIdType: 'Select ID Type',
    scanIdCard: 'Scan ID Card',
    scanLabel: 'Scan',
    scanning: 'Scanning...',
    pointCamera: 'Scanning... Point camera at the',
    enterIdManually: 'Enter ID manually',
    scanIdInstead: 'Scan ID instead',
    verify: 'Verify',
    verifying: 'Verifying...',
    verifiedSuccess: 'verified successfully. Proceeding...',
    verificationFailed: 'verification failed. Record not found.',
    positionId: 'Position the ID card in front of the camera to scan and verify',
    stop: 'Stop',
    cameraDenied: 'Camera permission denied. Please allow camera access and try again.',
    noCamera: 'No camera found on this device.',
    cameraError: 'Could not start camera. Try entering ID manually.',
    scanned: 'Scanned',

    // ID types
    aadhaarCard: 'Aadhaar Card',
    panCard: 'PAN Card',
    drivingLicense: 'Driving License',
    passport: 'Passport',
    mgnregaCard: 'MGNREGA Card',
    smartCard: 'Smart Card',
    healthInsurance: 'Health Insurance Smart Card',
    serviceId: 'Service Identity Card',
    pensionDoc: 'Pension Document',
    passbook: 'Passbook',
    officialId: 'Official Identity Card',
    transgenderCertificate: 'Transgender Certificate',

    // Biometric
    fingerprint: 'Fingerprint',
    facialScan: 'Facial Scan',
    scanningHoldStill: 'Scanning... Please hold still',
    pressScanBegin: 'Press scan to begin',
    capture: 'capture',
    biometricFailed: '✗ Biometric scan failed. Please try again or switch mode.',
    biometricSuccess: '✓ Biometric verified successfully',
    retryScan: 'Retry Scan',
    verifyBiometric: 'Verify Biometric',
    biometricUnavailable: '👉 Biometric unavailable? Switch to Manual Verification',
    currentPhase: 'In Progress',
    pending: 'Pending',
    proceedingFacial: 'Proceeding to Facial Scan...',
    allBiometricsSuccess: '✓ Both fingerprint and facial scan verified successfully. Proceeding to Voter ID verification...',

    // Attempt limits
    idAttemptsExhausted: '⚠ Maximum ID verification attempts reached (3/3). Please proceed to the Manual Verification desk.',
    fingerprintAttemptsExhausted: '⚠ Maximum fingerprint scan attempts reached (5/5). Please proceed to the Manual Verification desk.',
    facialAttemptsExhausted: '⚠ Maximum facial scan attempts reached (5/5). Please proceed to the Manual Verification desk.',
    attemptsRemaining: 'attempts remaining',
    proceedToManualDesk: 'Proceed to Manual Verification Desk',
    number: 'Number',

    // Voter ID
    voterIdLabel: 'Voter ID (EPIC Number)',
    uploadVoterId: 'Upload Voter ID Image',
    voterIdNotFound: '✗ Voter ID not found in electoral roll.',
    voterIdMatched: '✓ Voter ID matched. All verifications complete!',
    verifyVoterId: 'Verify Voter ID',
    switchManual: '👉 Switch to Manual Verification',

    // Token
    manuallyVerifiedToken: 'Manually Verified Token',
    oneTimeToken: 'One-Time Voting Token',
    manualTokenDesc: 'Verified via manual process with supervisor approval',
    allStagesPassed: 'All 3 stages passed successfully',
    tokenExpiresIn: 'Token expires in',
    expired: 'EXPIRED',
    proceedToVote: 'Proceed to Vote (Simulated)',
    tokenExpiredReset: 'Token Expired — Reset Required',

    // Manual verification
    manualVerifTitle: 'Manual Verification',
    manualVerifDesc: 'Fallback verification when Aadhaar/biometric is unavailable',
    voterIdRequired: 'Voter ID (Required)',
    secondaryId: 'Secondary ID',
    selectSecondary: 'Select secondary identification',
    officerVerification: 'Officer Verification',
    photoMatched: 'Photo matched with voter',
    detailsVerified: 'Personal details verified',
    otpVerification: 'OTP Verification',
    sendOtp: 'Send OTP',
    enterOtp: 'Enter OTP',
    sendOtpFirst: 'Send OTP first',
    verified: '✓ Verified',
    mockOtpSent: 'Mock OTP sent to registered mobile. Enter any 4+ digits.',
    manualApproved: '✓ Manual verification approved. Generating token...',
    cancel: 'Cancel',
    approving: 'Approving...',
    supervisorApproval: '🛡 Supervisor Approval',

    // Voted
    voteRecorded: 'Vote Recorded Successfully',
    voterMarked: 'The voter has been marked as voted. Token has been consumed.',
    resetNextVoter: 'Reset for Next Voter',

    // Progress stepper
    aadhaar: 'Aadhaar',
    biometric: 'Biometric',
    voterId: 'Voter ID',

    // Quick actions
    quickActions: 'Quick Actions',
    switchManualVerif: 'Switch to Manual Verification',

    // System info
    systemInfo: 'System Info',
    boothId: 'Booth ID',
    constituency: 'Constituency',
    officer: 'Officer',
    status: 'Status',

    // Audit
    auditLog: 'Audit Log',
    entries: 'entries',
    noActions: 'No actions recorded yet',

    // Stage labels for dashboard
    identityVerification: 'Identity Verification',
    biometricVerification: 'Biometric Verification',
    voterIdVerification: 'Voter ID Verification',
  },
  hi: {
    langSelectTitle: 'अपनी भाषा चुनें',
    langSelectSubtitle: 'Choose Your Language',
    langEnglish: 'English (अंग्रेज़ी)',
    langHindi: 'हिन्दी',
    langProceed: 'आगे बढ़ें',

    headerTitle: 'सुरक्षित मतदाता सत्यापन',
    headerSubtitle: 'भारत निर्वाचन आयोग — मतदान केंद्र प्रणाली',
    online: 'ऑनलाइन',
    offline: 'ऑफ़लाइन',

    currentStage: 'वर्तमान चरण',
    votingComplete: '✓ मतदान पूर्ण',
    tokenGenerated: 'टोकन जारी',
    manualVerification: 'मैनुअल सत्यापन',
    mode: 'मोड',
    primary: 'प्राथमिक',
    manual: 'मैनुअल',

    // Stages
    stage1Title: 'पहचान सत्यापन',
    stage1Desc: 'अपने आईडी कार्ड पर QR कोड स्कैन करें',
    stage2Title: 'बायोमेट्रिक सत्यापन',
    stage2Desc: 'स्कैनर पर उंगली रखें या फेशियल रीडर में देखें',
    stage3Title: 'चरण 3: मतदाता पहचान पत्र सत्यापन',
    stage3Desc: 'मतदाता का EPIC नंबर दर्ज करें या स्कैन करें',

    selectIdType: 'आईडी प्रकार चुनें',
    scanIdCard: 'आईडी कार्ड स्कैन करें',
    scanLabel: 'स्कैन',
    scanning: 'स्कैन हो रहा है...',
    pointCamera: 'स्कैन हो रहा है... कैमरा रखें',
    enterIdManually: 'मैन्युअल रूप से आईडी दर्ज करें',
    scanIdInstead: 'इसके बजाय स्कैन करें',
    verify: 'सत्यापित करें',
    verifying: 'सत्यापन हो रहा है...',
    verifiedSuccess: 'सफलतापूर्वक सत्यापित। आगे बढ़ रहे हैं...',
    verificationFailed: 'सत्यापन विफल। रिकॉर्ड नहीं मिला।',
    positionId: 'स्कैन और सत्यापन के लिए कैमरे के सामने आईडी कार्ड रखें',
    stop: 'रोकें',
    cameraDenied: 'कैमरा अनुमति अस्वीकृत। कृपया कैमरा एक्सेस की अनुमति दें।',
    noCamera: 'इस डिवाइस पर कोई कैमरा नहीं मिला।',
    cameraError: 'कैमरा शुरू नहीं हो सका। मैन्युअल रूप से आईडी दर्ज करें।',
    scanned: 'स्कैन किया गया',

    aadhaarCard: 'आधार कार्ड',
    panCard: 'पैन कार्ड',
    drivingLicense: 'ड्राइविंग लाइसेंस',
    passport: 'पासपोर्ट',
    mgnregaCard: 'मनरेगा कार्ड',
    smartCard: 'स्मार्ट कार्ड',
    healthInsurance: 'स्वास्थ्य बीमा स्मार्ट कार्ड',
    serviceId: 'सेवा पहचान पत्र',
    pensionDoc: 'पेंशन दस्तावेज़',
    passbook: 'पासबुक',
    officialId: 'आधिकारिक पहचान पत्र',
    transgenderCertificate: 'ट्रांसजेंडर प्रमाणपत्र',

    fingerprint: 'उंगलियों के निशान',
    facialScan: 'फेशियल स्कैन',
    scanningHoldStill: 'स्कैन हो रहा है... कृपया स्थिर रहें',
    pressScanBegin: 'स्कैन शुरू करने के लिए दबाएं',
    capture: 'कैप्चर',
    biometricFailed: '✗ बायोमेट्रिक स्कैन विफल। पुनः प्रयास करें।',
    biometricSuccess: '✓ बायोमेट्रिक सफलतापूर्वक सत्यापित',
    retryScan: 'पुनः स्कैन करें',
    verifyBiometric: 'बायोमेट्रिक सत्यापित करें',
    biometricUnavailable: '👉 बायोमेट्रिक उपलब्ध नहीं? मैनुअल सत्यापन पर जाएं',
    currentPhase: 'प्रगति में',
    pending: 'लंबित',
    proceedingFacial: 'फेशियल स्कैन पर आगे बढ़ रहे हैं...',
    allBiometricsSuccess: '✓ फिंगरप्रिंट और फेशियल स्कैन दोनों सफलतापूर्वक सत्यापित। मतदाता पहचान पत्र सत्यापन पर आगे बढ़ रहे हैं...',

    // Attempt limits
    idAttemptsExhausted: '⚠ अधिकतम पहचान सत्यापन प्रयास पूर्ण (3/3)। कृपया मैनुअल सत्यापन डेस्क पर जाएं।',
    fingerprintAttemptsExhausted: '⚠ अधिकतम फिंगरप्रिंट स्कैन प्रयास पूर्ण (5/5)। कृपया मैनुअल सत्यापन डेस्क पर जाएं।',
    facialAttemptsExhausted: '⚠ अधिकतम फेशियल स्कैन प्रयास पूर्ण (5/5)। कृपया मैनुअल सत्यापन डेस्क पर जाएं।',
    attemptsRemaining: 'प्रयास शेष',
    proceedToManualDesk: 'मैनुअल सत्यापन डेस्क पर जाएं',
    number: 'नंबर',

    voterIdLabel: 'मतदाता पहचान पत्र (EPIC नंबर)',
    uploadVoterId: 'मतदाता पहचान पत्र की छवि अपलोड करें',
    voterIdNotFound: '✗ मतदाता पहचान पत्र निर्वाचक नामावली में नहीं मिला।',
    voterIdMatched: '✓ मतदाता पहचान पत्र मिला। सभी सत्यापन पूर्ण!',
    verifyVoterId: 'मतदाता पहचान पत्र सत्यापित करें',
    switchManual: '👉 मैनुअल सत्यापन पर जाएं',

    manuallyVerifiedToken: 'मैन्युअल रूप से सत्यापित टोकन',
    oneTimeToken: 'एक बार का मतदान टोकन',
    manualTokenDesc: 'पर्यवेक्षक अनुमोदन के साथ मैनुअल प्रक्रिया द्वारा सत्यापित',
    allStagesPassed: 'सभी 3 चरण सफलतापूर्वक पूर्ण',
    tokenExpiresIn: 'टोकन की समय सीमा',
    expired: 'समय समाप्त',
    proceedToVote: 'मतदान के लिए आगे बढ़ें (सिम्युलेटेड)',
    tokenExpiredReset: 'टोकन समाप्त — रीसेट आवश्यक',

    manualVerifTitle: 'मैनुअल सत्यापन',
    manualVerifDesc: 'जब आधार/बायोमेट्रिक उपलब्ध न हो तो वैकल्पिक सत्यापन',
    voterIdRequired: 'मतदाता पहचान पत्र (आवश्यक)',
    secondaryId: 'द्वितीयक आईडी',
    selectSecondary: 'द्वितीयक पहचान चुनें',
    officerVerification: 'अधिकारी सत्यापन',
    photoMatched: 'मतदाता से फोटो मिलान हुआ',
    detailsVerified: 'व्यक्तिगत विवरण सत्यापित',
    otpVerification: 'OTP सत्यापन',
    sendOtp: 'OTP भेजें',
    enterOtp: 'OTP दर्ज करें',
    sendOtpFirst: 'पहले OTP भेजें',
    verified: '✓ सत्यापित',
    mockOtpSent: 'पंजीकृत मोबाइल पर OTP भेजा गया। कोई भी 4+ अंक दर्ज करें।',
    manualApproved: '✓ मैनुअल सत्यापन स्वीकृत। टोकन बन रहा है...',
    cancel: 'रद्द करें',
    approving: 'स्वीकृति हो रही है...',
    supervisorApproval: '🛡 पर्यवेक्षक अनुमोदन',

    voteRecorded: 'मतदान सफलतापूर्वक दर्ज',
    voterMarked: 'मतदाता को मतदान किया हुआ चिह्नित किया गया है। टोकन उपयोग हो चुका है।',
    resetNextVoter: 'अगले मतदाता के लिए रीसेट करें',

    aadhaar: 'आधार',
    biometric: 'बायोमेट्रिक',
    voterId: 'मतदाता पहचान पत्र',

    quickActions: 'त्वरित कार्य',
    switchManualVerif: 'मैनुअल सत्यापन पर जाएं',

    systemInfo: 'प्रणाली जानकारी',
    boothId: 'बूथ आईडी',
    constituency: 'निर्वाचन क्षेत्र',
    officer: 'अधिकारी',
    status: 'स्थिति',

    auditLog: 'ऑडिट लॉग',
    entries: 'प्रविष्टियाँ',
    noActions: 'अभी तक कोई कार्य दर्ज नहीं',

    identityVerification: 'पहचान सत्यापन',
    biometricVerification: 'बायोमेट्रिक सत्यापन',
    voterIdVerification: 'मतदाता पहचान पत्र सत्यापन',
  },
} as const;

type TranslationKey = keyof typeof translations.en;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>('en');
  const t = (key: TranslationKey) => translations[lang][key] || translations.en[key] || key;
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}