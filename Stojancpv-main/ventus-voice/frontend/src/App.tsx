import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { SignedIn, SignedOut, RedirectToSignIn, useAuth } from "@clerk/clerk-react";
import { Loader2 } from "lucide-react";
import { PageLayout } from "./components/layout";
import { ThemeProvider } from "./components/ThemeProvider";
import { ViewModeProvider } from "./providers/ViewModeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CommandPalette } from "./components/CommandPalette";
import { SegmentationModal } from "./components/Onboarding";
import { useUserSegment } from "./hooks/useUserSegment";
import { initializePostHog } from "./lib/posthog";
import { initializeApiClient } from "./lib/api-client";
import { useAnalytics } from "./hooks/useAnalytics";
import { API_BASE_URL } from "./services/config";
import { allowE2EAuthBypass } from "./lib/e2e-auth-bypass";
import { CommandPaletteProvider } from "./hooks/useCommandPalette";
import { TutorialSystem } from "./components/tutorial/TutorialSystem";
import { ChatWidget } from "./components/support/ChatWidget";
import { voiceCallService } from "./services/voice-call.service";

// Lazy load all page components
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const BrandAnalyzerPage = lazy(() => import("./pages/BrandAnalyzerPage"));
const BrandListPage = lazy(() => import("./pages/BrandListPage"));
const BrandDetailPage = lazy(() => import("./pages/BrandDetailPage"));
const MonitoringDashboard = lazy(() => import("./pages/MonitoringDashboard"));
const CredentialsPage = lazy(() => import("./pages/CredentialsPage"));
const AgentsPage = lazy(() => import("./pages/AgentsPage"));
const AgentCreationHub = lazy(() => import("./pages/AgentCreationHub"));
const AgentCreationPage = lazy(() => import("./pages/AgentCreationPage"));
const UrlCreationWizard = lazy(() => import("./pages/UrlCreationWizard"));
const InterviewBot = lazy(() => import("./pages/InterviewBot"));
const OrbPreview = lazy(() => import("./pages/OrbPreview"));
const ElevenLabsOrbPreview = lazy(() => import("./pages/ElevenLabsOrbPreview"));
const ForgeOverlayPreview = lazy(() => import("./pages/ForgeOverlayPreview"));
const CostAnalyticsDashboard = lazy(() => import("./pages/CostAnalyticsDashboard"));
const UsageMetricsDashboard = lazy(() => import("./pages/UsageMetricsDashboard"));
const ProviderManagementDashboard = lazy(() => import("./pages/ProviderManagementDashboard"));
const AgentPerformanceDashboard = lazy(() => import("./pages/AgentPerformanceDashboard"));
const DocumentationPage = lazy(() => import("./pages/DocumentationPage"));
const DeploymentTutorialsPage = lazy(() => import("./pages/DeploymentTutorialsPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const KnowledgeBasePage = lazy(() => import("./pages/KnowledgeBasePage"));
const CustomFunctionsPage = lazy(() => import("./pages/CustomFunctionsPage"));
const AnalyticsHubPage = lazy(() => import("./pages/AnalyticsHubPage"));
const SessionAnalyticsPage = lazy(() => import("./pages/SessionAnalyticsPage"));
const SessionDetailPage = lazy(() => import("./pages/SessionDetailPage"));
const VoicesPage = lazy(() => import("./pages/VoicesPage"));
const CRMIntegrationPage = lazy(() => import("./pages/CRMIntegrationPage"));
const IntegrationsHubPage = lazy(() => import("./pages/IntegrationsHubPage"));
const MessagingIntegrationPage = lazy(() => import("./pages/MessagingIntegrationPage"));
const CalendarIntegrationPage = lazy(() => import("./pages/CalendarIntegrationPage"));
const ApiKeysPage = lazy(() => import("./pages/ApiKeysPage"));
const AgentDetailPage = lazy(() => import("./pages/AgentDetailPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));
const PhoneNumbersPage = lazy(() => import("./pages/PhoneNumbersPage"));
const AuthPortal = lazy(() => import("./pages/AuthPortal").then(m => ({ default: m.AuthPortal })));
const AgentTestPage = lazy(() => import("./pages/AgentTestPage"));
const CommandCenterPage = lazy(() => import("./pages/CommandCenterPage"));
const FlowStudioPage = lazy(() => import("./pages/FlowStudioPage"));
const BuilderCreateRedirect = lazy(() => import("./pages/BuilderCreateRedirect"));
const MCPMarketplacePage = lazy(() => import("./pages/MCPMarketplacePage"));
const PoliciesPage = lazy(() => import("./pages/PoliciesPage"));
const EmbedSnippetsPage = lazy(() => import("./pages/EmbedSnippetsPage"));

// Loading component
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

// Protected Route wrapper - handles auth redirect
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (allowE2EAuthBypass) {
    return <>{children}</>;
  }
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

// Layout wrapper for protected routes - includes PageLayout with Sidebar/TopBar
function ProtectedLayoutWrapper() {
  return (
    <ProtectedRoute>
      <PageLayout>
        <Outlet />
      </PageLayout>
    </ProtectedRoute>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { segment, isLoading: segmentLoading } = useUserSegment();
  const [showSegmentationModal, setShowSegmentationModal] = useState(false);
  const { trackPageView } = useAnalytics();

  // Initialize PostHog on mount
  useEffect(() => {
    initializePostHog();
  }, []);

  // Dev-only API connectivity check to catch misconfigured base URLs early.
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3000);

    fetch(new URL("/health", API_BASE_URL).toString(), { signal: controller.signal })
      .then(res => {
        if (!res.ok) {
          console.warn(`API health check failed (${res.status})`, { apiBaseUrl: API_BASE_URL });
        }
      })
      .catch(error => {
        console.warn("API health check failed", { apiBaseUrl: API_BASE_URL, error });
      })
      .finally(() => window.clearTimeout(timeoutId));
  }, []);

  // Initialize API Client and Voice Call Service with Clerk authentication
  useEffect(() => {
    if (allowE2EAuthBypass) {
      // In E2E bypass mode we avoid calling Clerk for tokens entirely.
      // Tests rely on Playwright route mocks and don't need Authorization headers.
      initializeApiClient(async () => null);
      voiceCallService.setAuthTokenGetter(async () => null);
      return;
    }

    initializeApiClient(getToken);
    voiceCallService.setAuthTokenGetter(getToken);
  }, [getToken]);

  // Track page views
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search, trackPageView]);

  // Check for onboarding flow
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const isOnboarding = params.get("onboarding") === "true";

    if (isOnboarding && !segment && !segmentLoading) {
      setShowSegmentationModal(true);
    } else if (isOnboarding && segment && !segmentLoading) {
      navigate("/agents/create", { replace: true });
    }
  }, [location.search, segment, segmentLoading, navigate]);

  const handleCloseSegmentationModal = () => {
    setShowSegmentationModal(false);
    if (location.search.includes("onboarding=true")) {
      navigate(location.pathname, { replace: true });
    }
  };

  return (
    <ThemeProvider defaultTheme="system">
      <CommandPaletteProvider>
        <ViewModeProvider>
          <ErrorBoundary fullPage>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* ===== PUBLIC ROUTES (No Sidebar) ===== */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/orb-preview" element={<OrbPreview />} />
                <Route path="/orb-elevenlabs" element={<ElevenLabsOrbPreview />} />
                <Route path="/forge-overlay-preview" element={<ForgeOverlayPreview />} />
                <Route path="/policies/:policyType" element={<PoliciesPage />} />
                <Route path="/policies" element={<Navigate to="/policies/privacy" replace />} />
                <Route path="/sign-in" element={<AuthPortal mode="sign-in" />} />
                <Route path="/sign-up" element={<AuthPortal mode="sign-up" />} />
                <Route
                  path="/sign-in/sso-callback"
                  element={<Navigate to="/dashboard" replace />}
                />

                {/* ===== PROTECTED ROUTES (With Sidebar via ProtectedLayoutWrapper) ===== */}
                <Route element={<ProtectedLayoutWrapper />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/brands" element={<BrandListPage />} />
                  <Route path="/brands/analyze" element={<BrandAnalyzerPage />} />
                  <Route path="/brands/:id" element={<BrandDetailPage />} />
                  <Route path="/credentials" element={<CredentialsPage />} />
                  <Route path="/monitoring" element={<MonitoringDashboard />} />
                  <Route path="/agents" element={<AgentsPage />} />
                  <Route path="/agents/create" element={<AgentCreationHub />} />
                  <Route path="/agents/create/url" element={<UrlCreationWizard />} />
                  <Route path="/agents/create/interview" element={<InterviewBot />} />
                  <Route
                    path="/forge"
                    element={<Navigate to="/agents/create/interview" replace />}
                  />
                  <Route path="/agents/wizard" element={<AgentCreationPage />} />
                  <Route path="/agents/:agentId/test" element={<AgentTestPage />} />
                  <Route path="/agents/create/builder" element={<BuilderCreateRedirect />} />
                  <Route path="/agents/:agentId/builder" element={<CommandCenterPage />} />
                  <Route
                    path="/agents/:agentId/flow-studio"
                    element={
                      <Suspense
                        fallback={
                          <div className="h-screen bg-[hsl(var(--void))] flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--primary))]" />
                          </div>
                        }
                      >
                        <FlowStudioPage />
                      </Suspense>
                    }
                  />
                  <Route path="/agents/:agentId" element={<AgentDetailPage />} />
                  <Route path="/deploy/embed" element={<EmbedSnippetsPage />} />
                  <Route
                    path="/function-schemas"
                    element={<Navigate to="/custom-functions" replace />}
                  />
                  <Route
                    path="/cost-analytics"
                    element={<Navigate to="/analytics?tab=costs" replace />}
                  />
                  <Route
                    path="/usage-metrics"
                    element={<Navigate to="/analytics?tab=usage" replace />}
                  />
                  <Route path="/providers" element={<ProviderManagementDashboard />} />
                  <Route
                    path="/agent-performance"
                    element={<Navigate to="/analytics?tab=performance" replace />}
                  />
                  <Route path="/docs" element={<DocumentationPage />} />
                  <Route path="/docs/deployment-tutorials" element={<DeploymentTutorialsPage />} />
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
                  <Route path="/custom-functions" element={<CustomFunctionsPage />} />
                  <Route path="/analytics" element={<AnalyticsHubPage />} />
                  <Route
                    path="/sessions"
                    element={<Navigate to="/analytics?tab=activity" replace />}
                  />
                  <Route path="/sessions/:sessionId" element={<SessionDetailPage />} />
                  <Route path="/voices" element={<VoicesPage />} />
                  <Route path="/integrations" element={<IntegrationsHubPage />} />
                  <Route path="/integrations/crm" element={<CRMIntegrationPage />} />
                  <Route path="/integrations/messaging" element={<MessagingIntegrationPage />} />
                  <Route path="/integrations/calendar" element={<CalendarIntegrationPage />} />
                  <Route path="/integrations/marketplace" element={<MCPMarketplacePage />} />
                  <Route path="/crm" element={<Navigate to="/integrations/crm" replace />} />
                  <Route path="/api-keys" element={<ApiKeysPage />} />
                  <Route path="/phone-numbers" element={<PhoneNumbersPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/subscription" element={<SubscriptionPage />} />
                </Route>
              </Routes>
            </Suspense>
            <Toaster
              position="bottom-right"
              theme="dark"
              toastOptions={{
                style: {
                  background: "hsl(var(--surface))",
                  color: "hsl(var(--text-high))",
                  border: "1px solid hsl(var(--border))",
                },
                className: "backdrop-blur-xl",
              }}
            />
            <ErrorBoundary fallback={null}>
              <CommandPalette />
            </ErrorBoundary>
            <SegmentationModal
              open={showSegmentationModal}
              onClose={handleCloseSegmentationModal}
            />
            <TutorialSystem />
            {/* Support Chat Widget - appears on all authenticated pages (P0J-09) */}
            <SignedIn>
              <ChatWidget />
            </SignedIn>
          </ErrorBoundary>
        </ViewModeProvider>
      </CommandPaletteProvider>
    </ThemeProvider>
  );
}

export default App;
