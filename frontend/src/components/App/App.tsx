import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Toaster } from "@/components/ui/toaster";
import { LandingPage } from "@/pages/LandingPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { FAQPage } from "@/pages/FAQPage";
import { PricingPage } from "@/pages/PricingPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { NewLoginPage } from "@/pages/NewLoginPage";
import { NewSignupPage } from "@/pages/NewSignupPage";
import { PasswordResetPage } from "@/pages/PasswordResetPage";
import { AuthTestPage } from "@/pages/AuthTestPage";
import { SigninPage } from "@/pages/SigninPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { OrganizationsPage } from "@/pages/OrganizationsPage";
import { InvitationAcceptPage } from "@/pages/InvitationAcceptPage";
import { ChatbotsPage } from "@/pages/ChatbotsPage";
import CreateChatbotPage from "@/pages/chatbots/create";
import ChatbotDetailPage from "@/pages/chatbots/detail";
import ChatbotEditPage from "@/pages/chatbots/edit";
import { StudioPage } from "@/pages/StudioPage";
import KnowledgeBasesPage from "@/pages/knowledge-bases/index";
import CreateKnowledgeBasePage from "@/pages/knowledge-bases/create";
import KBDetailPage from "@/pages/knowledge-bases/detail";
import KBProcessingPage from "@/pages/knowledge-bases/processing";
import KBEditPage from "@/pages/knowledge-bases/edit";
import KBRechunkPage from "@/pages/knowledge-bases/rechunk";
import KBDocumentsPage from "@/pages/knowledge-bases/documents";
import KBDocumentViewPage from "@/pages/knowledge-bases/document-view";
import KBDocumentEditPage from "@/pages/knowledge-bases/document-edit";
import KBAnalyticsPage from "@/pages/knowledge-bases/analytics";
import KBPipelineMonitorPage from "@/pages/knowledge-bases/pipeline-monitor";
import { ActivitiesPage } from "@/pages/ActivitiesPage";
import { LeadsPage } from "@/pages/LeadsPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { BillingsPage } from "@/pages/BillingsPage";
import { MarketplacePage } from "@/pages/MarketplacePage";
import { ReferralsPage } from "@/pages/ReferralsPage";
import { DocumentationPage } from "@/pages/DocumentationPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { AboutPage } from "@/pages/AboutPage";
import { HelpPage } from "@/pages/HelpPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <Router
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/faqs" element={<FAQPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/signin" element={<SigninPage />} />
              <Route path="/login" element={<SigninPage />} />
              <Route path="/signup" element={<NewSignupPage />} />
              <Route path="/password-reset" element={<PasswordResetPage />} />
              <Route path="/auth/test" element={<AuthTestPage />} />

              {/* Legacy auth routes for backward compatibility */}
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/signup" element={<SignupPage />} />
              <Route path="/invitations/accept" element={<InvitationAcceptPage />} />

              {/* Protected Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations"
                element={
                  <ProtectedRoute>
                    <OrganizationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chatbots"
                element={
                  <ProtectedRoute>
                    <ChatbotsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chatbots/create"
                element={
                  <ProtectedRoute>
                    <CreateChatbotPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chatbots/:chatbotId"
                element={
                  <ProtectedRoute>
                    <ChatbotDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chatbots/:chatbotId/edit"
                element={
                  <ProtectedRoute>
                    <ChatbotEditPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/studio"
                element={
                  <ProtectedRoute>
                    <StudioPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/knowledge-bases"
                element={
                  <ProtectedRoute>
                    <KnowledgeBasesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/knowledge-bases/create"
                element={
                  <ProtectedRoute>
                    <CreateKnowledgeBasePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/knowledge-bases/:kbId"
                element={
                  <ProtectedRoute>
                    <KBDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/knowledge-bases/:kbId/processing"
                element={
                  <ProtectedRoute>
                    <KBProcessingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/knowledge-bases/:kbId/edit"
                element={
                  <ProtectedRoute>
                    <KBEditPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/knowledge-bases/:kbId/rechunk"
                element={
                  <ProtectedRoute>
                    <KBRechunkPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/knowledge-bases/:kbId/documents"
                element={
                  <ProtectedRoute>
                    <KBDocumentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/knowledge-bases/:kbId/documents/:docId"
                element={
                  <ProtectedRoute>
                    <KBDocumentViewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/knowledge-bases/:kbId/documents/:docId/edit"
                element={
                  <ProtectedRoute>
                    <KBDocumentEditPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/knowledge-bases/:kbId/analytics"
                element={
                  <ProtectedRoute>
                    <KBAnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/knowledge-bases/:kbId/pipeline-monitor"
                element={
                  <ProtectedRoute>
                    <KBPipelineMonitorPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/activities"
                element={
                  <ProtectedRoute>
                    <ActivitiesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leads"
                element={
                  <ProtectedRoute>
                    <LeadsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <AnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/billings"
                element={
                  <ProtectedRoute>
                    <BillingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketplace"
                element={
                  <ProtectedRoute>
                    <MarketplacePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/referrals"
                element={
                  <ProtectedRoute>
                    <ReferralsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documentation"
                element={
                  <ProtectedRoute>
                    <DocumentationPage />
                  </ProtectedRoute>
                }
              />

              {/* 404 Catch-all Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Router>
          <Toaster />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
