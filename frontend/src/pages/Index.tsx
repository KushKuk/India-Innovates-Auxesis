import { LanguageProvider } from '@/contexts/LanguageContext';
import { VerificationDashboard } from '@/components/VerificationDashboard';

const Index = () => {
  return (
    <LanguageProvider>
      <VerificationDashboard />
    </LanguageProvider>
  );
};

export default Index;
