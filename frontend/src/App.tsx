import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { LanguageSelectionProvider } from "@/contexts/LanguageSelectionContext";
import { VoterProvider } from "@/contexts/VoterContext";
import DigitalVerifyPage from "./pages/DigitalVerifyPage";
import ManualVerifyPage from "./pages/ManualVerifyPage";
import TokenCheckPage from "./pages/TokenCheckPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <LanguageProvider>
        <LanguageSelectionProvider>
          <VoterProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/verify" replace />} />
                <Route path="/verify" element={<DigitalVerifyPage />} />
                <Route path="/manual" element={<ManualVerifyPage />} />
                <Route path="/token-check" element={<TokenCheckPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </VoterProvider>
        </LanguageSelectionProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
