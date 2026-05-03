import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { StaffRoute } from "@/components/auth/StaffRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Toaster } from "@/components/ui/toaster";
import { UpgradeModal } from "@/components/modals/UpgradeModal";

// Create a single QueryClient instance for the app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});
import { LandingPage } from "@/pages/LandingPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { TermsPage } from "@/pages/TermsPage";
import { DataCompliancePage } from "@/pages/DataCompliancePage";
import { CookiePolicyPage } from "@/pages/CookiePolicyPage";
import { AcceptableUsePage } from "@/pages/AcceptableUsePage";
import { SecurityPage } from "@/pages/SecurityPage";
import { FAQPage } from "@/pages/FAQPage";
import { PricingPage } from "@/pages/PricingPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
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
import ChatflowBuilder from "@/pages/ChatflowBuilder";
import ChatflowDetailPage from "@/pages/chatflows/detail";
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
import LeadsDashboard from "@/pages/leads/index";
import LeadDetailPage from "@/pages/leads/detail";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { BillingsPage } from "@/pages/BillingsPage";
import { MarketplacePage } from "@/pages/MarketplacePage";
import { ReferralsPage } from "@/pages/ReferralsPage";
import { DocumentationPage } from "@/pages/DocumentationPage";
import { ProfilePage } from "@/pages/ProfilePage";
import Credentials from "@/pages/Credentials";
import { AboutPage } from "@/pages/AboutPage";
import { HelpPage } from "@/pages/HelpPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PublicChatPage } from "@/pages/chat/PublicChatPage";
import {
  AdminDashboard,
  AdminOrganizations,
  AdminOrgDetail,
  AdminUsers,
  AdminUserDetail,
  AdminAnalytics,
  AdminTemplates,
} from "@/pages/admin";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <AppProvider>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/data-compliance" element={<DataCompliancePage />} />
              <Route path="/cookies" element={<CookiePolicyPage />} />
              <Route path="/acceptable-use" element={<AcceptableUsePage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/faqs" element={<FAQPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              {/* `/signup` is the canonical auth route — SigninPage handles
                  both signin and signup (email/password + wallet). `/signin`
                  and `/login` are aliases kept for backward-compatible links
                  (referral share URLs, old emails, marketing). */}
              <Route path="/signup" element={<SigninPage />} />
              <Route path="/signin" element={<SigninPage />} />
              <Route path="/login" element={<SigninPage />} />
              <Route path="/password-reset" element={<PasswordResetPage />} />
              <Route path="/auth/test" element={<AuthTestPage />} />

              {/* Public hosted chat page (SecretVM deployment) */}
              {/* URL format: /chat/{workspace_slug}/{bot_slug} */}
              <Route path="/chat/:workspaceSlug/:botSlug" element={<PublicChatPage />} />

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
                path="/studio/:chatflowId"
                element={
                  <ProtectedRoute>
                    <ChatflowDetailPage />
                  </ProtectedRoute>
                }
              />
              {/* Chatflow Builder Routes */}
              <Route
                path="/chatflows/builder"
                element={
                  <ProtectedRoute>
                    <ChatflowBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chatflows/builder/:draftId"
                element={
                  <ProtectedRoute>
                    <ChatflowBuilder />
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
                    <LeadsDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leads/:leadId"
                element={
                  <ProtectedRoute>
                    <LeadDetailPage />
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
                path="/settings/credentials"
                element={
                  <ProtectedRoute>
                    <Credentials />
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

              {/* Admin Routes - Staff Only */}
              <Route
                path="/admin"
                element={
                  <StaffRoute>
                    <AdminLayout />
                  </StaffRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="organizations" element={<AdminOrganizations />} />
                <Route path="organizations/:orgId" element={<AdminOrgDetail />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:userId" element={<AdminUserDetail />} />
                <Route path="templates" element={<AdminTemplates />} />
                <Route path="analytics" element={<AdminAnalytics />} />
              </Route>

              {/* 404 Catch-all Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            <Toaster />
            <UpgradeModal />
            </AppProvider>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
