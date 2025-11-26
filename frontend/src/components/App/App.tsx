import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Toaster } from "@/components/ui/toaster";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { OrganizationsPage } from "@/pages/OrganizationsPage";
import { InvitationAcceptPage } from "@/pages/InvitationAcceptPage";
import { ChatbotsPage } from "@/pages/ChatbotsPage";
import { StudioPage } from "@/pages/StudioPage";
import KnowledgeBasesPage from "@/pages/knowledge-bases/index";
import CreateKnowledgeBasePage from "@/pages/knowledge-bases/create";
import KBProcessingPage from "@/pages/knowledge-bases/processing";
import { ActivitiesPage } from "@/pages/ActivitiesPage";
import { LeadsPage } from "@/pages/LeadsPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { BillingsPage } from "@/pages/BillingsPage";
import { MarketplacePage } from "@/pages/MarketplacePage";
import { ReferralsPage } from "@/pages/ReferralsPage";
import { DocumentationPage } from "@/pages/DocumentationPage";
import { ProfilePage } from "@/pages/ProfilePage";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
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
                path="/knowledge-bases/:kbId/processing"
                element={
                  <ProtectedRoute>
                    <KBProcessingPage />
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
            </Routes>
          </Router>
          <Toaster />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
