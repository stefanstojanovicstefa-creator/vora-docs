/**
 * URL Creation Wizard
 *
 * Multi-step wizard for creating voice agents from website URLs.
 * Flow: URL Input → Scraping → Preview → Agent Creation → Success
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import {
  Globe,
  ArrowLeft,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  X,
  Zap,
  Settings2,
  Languages,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { SUPPORTED_LANGUAGES, getLanguageByCode } from "@/data/supported-languages";

// Type definitions for MCP suggestions
interface MCPSuggestion {
  id: string;
  name: string;
  reason: string;
}

interface ToolDefinition {
  name: string;
  description: string;
}

interface RecommendedIntegrations {
  industry: string;
  region: string;
  primary_mcps: MCPSuggestion[];
  optional_mcps: MCPSuggestion[];
  auto_tools: ToolDefinition[];
  workflow_pack?: {
    name: string;
    description: string;
  };
}

// Type definitions for scraped content
interface ScrapedContent {
  brandName: string;
  tone: string;
  description: string;
  offerings: string[];
  faq: Array<{ question: string; answer: string }>;
  contactInfo?: {
    email?: string;
    phone?: string;
  };
  recommendedIntegrations?: RecommendedIntegrations;
}

// Wizard states
type WizardStep = "input" | "scraping" | "preview" | "creating" | "success" | "error";

type BrandAnalysisStatus =
  | "PENDING"
  | "SCRAPING"
  | "ANALYZING"
  | "COMPLETED"
  | "COMPLETED_PARTIAL"
  | "FAILED";

type AudienceAnalysis = {
  demographics: string;
  pain_points: string[];
  goals: string[];
};

type CompetitorAnalysis = {
  competitors: string[];
  differentiators: string[];
};

type DomainVocabulary = {
  jargon: string[];
  acronyms: Array<{ term: string; definition: string }>;
};

type UseCaseScenario = {
  title: string;
  description: string;
  example_dialogue: string;
};

type BrandAnalysisResult = {
  id: string;
  websiteUrl: string;
  status: BrandAnalysisStatus;
  brandBook?: Record<string, unknown> | null;
  systemPrompt?: Record<string, unknown> | null;
  knowledgeBase?: Record<string, unknown> | null;
  recommendedIntegrations?: RecommendedIntegrations | null;
  detectedLanguage?: string | null; // ISO 639-1 code
  audienceAnalysis?: AudienceAnalysis | null;
  competitorAnalysis?: CompetitorAnalysis | null;
  vocabulary?: DomainVocabulary | null;
  useCaseScenarios?: UseCaseScenario[] | null;
  pagesScraped?: number | null;
  analysisCost?: number | null;
  tokensUsed?: number | null;
  errorMessage?: string | null;
};

type AnalyzeBrandResponse = {
  brandId: string;
  status?: BrandAnalysisStatus;
  cached?: boolean;
  message?: string;
  estimatedTime?: number;
};

type GetBrandResponse = {
  success: true;
  data: BrandAnalysisResult;
};

export default function UrlCreationWizard() {
  const { t } = useTranslation(["agent", "common"]);
  const navigate = useNavigate();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();

  // State management
  const [url, setUrl] = useState("");
  const [currentStep, setCurrentStep] = useState<WizardStep>("input");
  const [scrapingProgress, setScrapingProgress] = useState(0);
  const [scrapedContent, setScrapedContent] = useState<ScrapedContent | null>(null);
  const [brandAnalysis, setBrandAnalysis] = useState<BrandAnalysisResult | null>(null);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Collapsible states for preview cards
  const [openSections, setOpenSections] = useState({
    tone: true,
    offerings: false,
    faq: false,
    contact: false,
    integrations: true,
  });

  // Enabled MCPs state (populated from analysis)
  const [enabledMcps, setEnabledMcps] = useState<Set<string>>(new Set());

  // Language state (pre-filled from brand analysis, user-overridable)
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");

  // AbortController for cancelling ongoing requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount - abort any ongoing requests to prevent memory leaks
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Cancel handler for user-initiated cancellation
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setCurrentStep("input");
    setScrapingProgress(0);
    setError(null);
  }, []);

  // Validate URL
  const isValidUrl = (urlString: string): boolean => {
    try {
      const url = new URL(urlString);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const getStatusProgress = (status: BrandAnalysisStatus): number => {
    switch (status) {
      case "PENDING":
        return 10;
      case "SCRAPING":
        return 35;
      case "ANALYZING":
        return 70;
      case "COMPLETED_PARTIAL":
        return 95;
      case "COMPLETED":
        return 100;
      case "FAILED":
        return 100;
      default:
        return 10;
    }
  };

  const toScrapedContent = (
    analysis: BrandAnalysisResult,
    fallbackUrl: string,
    translate: TFunction
  ): ScrapedContent => {
    const hostname = (() => {
      try {
        return new URL(fallbackUrl).hostname;
      } catch {
        return translate("agent:urlWizard.defaults.websiteFallback");
      }
    })();

    const knowledgeBase = analysis.knowledgeBase ?? {};
    const companyInfo = knowledgeBase.companyInfo ?? {};
    const products: Array<{ name?: string; description?: string }> = knowledgeBase.products ?? [];
    const services: Array<{ name?: string; description?: string }> = knowledgeBase.services ?? [];
    const faqs: Array<{ question?: string; answer?: string }> = knowledgeBase.faqs ?? [];
    const contact = knowledgeBase.contact ?? {};

    const systemPrompt = analysis.systemPrompt ?? {};
    const communicationStyle = systemPrompt.communicationStyle;

    const tone =
      typeof communicationStyle === "object" && communicationStyle?.tone
        ? String(communicationStyle.tone)
        : typeof communicationStyle === "string"
          ? communicationStyle
          : (() => {
              const brandVoice = analysis.brandBook?.brandVoice;
              const tones: string[] = brandVoice?.tone ?? [];
              return tones.length
                ? tones.join(", ")
                : translate("agent:urlWizard.defaults.toneFallback");
            })();

    const offerings = [
      ...products.map(p => {
        const name = p?.name?.trim();
        const description = p?.description?.trim();
        if (!name && !description) return null;
        if (name && description) return `${name} — ${description}`;
        return name ?? description ?? null;
      }),
      ...services.map(s => {
        const name = s?.name?.trim();
        const description = s?.description?.trim();
        if (!name && !description) return null;
        if (name && description) return `${name} — ${description}`;
        return name ?? description ?? null;
      }),
    ].filter(Boolean) as string[];

    // Extract recommended integrations if present
    const recommendedIntegrations = analysis.recommendedIntegrations ?? undefined;

    return {
      brandName: companyInfo.name || hostname,
      tone,
      description:
        companyInfo.description ||
        analysis.brandBook?.positioning?.uniqueValueProposition ||
        translate("agent:urlWizard.defaults.descriptionFallback"),
      offerings: offerings.slice(0, 12),
      faq: faqs
        .filter(f => f?.question && f?.answer)
        .slice(0, 12)
        .map(f => ({ question: String(f.question), answer: String(f.answer) })),
      contactInfo: {
        email: contact.email,
        phone: contact.phone,
      },
      recommendedIntegrations,
    };
  };

  const buildAgentPrompt = (
    analysis: BrandAnalysisResult,
    websiteUrl: string,
    selectedMcps: Set<string>,
    language?: string
  ): string => {
    const content = toScrapedContent(analysis, websiteUrl, t);

    const offerings = content.offerings.length
      ? `\n\nOfferings:\n- ${content.offerings.join("\n- ")}`
      : "";
    const faqs = content.faq.length
      ? `\n\nFAQs:\n- ${content.faq
          .slice(0, 8)
          .map(f => `${f.question}\n  ${f.answer}`)
          .join("\n- ")}`
      : "";

    // Build integrations section
    let integrationsSection = "";
    if (content.recommendedIntegrations && selectedMcps.size > 0) {
      const allMcps = [
        ...content.recommendedIntegrations.primary_mcps,
        ...content.recommendedIntegrations.optional_mcps,
      ];
      const enabledMcpNames = allMcps.filter(m => selectedMcps.has(m.id)).map(m => m.name);

      if (enabledMcpNames.length > 0) {
        integrationsSection = `\n\nEnabled Integrations:\n- ${enabledMcpNames.join("\n- ")}`;
      }

      // Add tools section
      if (content.recommendedIntegrations.auto_tools.length > 0) {
        const toolsList = content.recommendedIntegrations.auto_tools
          .map(t => `${t.name}: ${t.description}`)
          .join("\n- ");
        integrationsSection += `\n\nAvailable Tools:\n- ${toolsList}`;
      }
    }

    // Build enriched analysis sections
    let audienceSection = "";
    if (analysis.audienceAnalysis) {
      const aa = analysis.audienceAnalysis;
      audienceSection = `\n\nTarget Audience: ${aa.demographics}`;
      if (aa.pain_points?.length) {
        audienceSection += `\nCustomer Pain Points:\n- ${aa.pain_points.join("\n- ")}`;
      }
      if (aa.goals?.length) {
        audienceSection += `\nCustomer Goals:\n- ${aa.goals.join("\n- ")}`;
      }
    }

    let competitorSection = "";
    if (analysis.competitorAnalysis) {
      const ca = analysis.competitorAnalysis;
      if (ca.differentiators?.length) {
        competitorSection = `\n\nKey Differentiators:\n- ${ca.differentiators.join("\n- ")}`;
      }
    }

    let vocabularySection = "";
    if (analysis.vocabulary) {
      const v = analysis.vocabulary;
      const terms: string[] = [];
      if (v.jargon?.length) {
        terms.push(...v.jargon);
      }
      if (v.acronyms?.length) {
        terms.push(...v.acronyms.map(a => `${a.term} (${a.definition})`));
      }
      if (terms.length) {
        vocabularySection = `\n\nDomain Vocabulary:\n- ${terms.join("\n- ")}`;
      }
    }

    let scenariosSection = "";
    if (analysis.useCaseScenarios?.length) {
      const scenarios = analysis.useCaseScenarios.slice(0, 5);
      scenariosSection = `\n\nKey Conversation Scenarios:\n${scenarios
        .map((s, i) => `${i + 1}. ${s.title}: ${s.description}`)
        .join("\n")}`;
    }

    // Resolve language name for prompt
    const langInfo = language ? getLanguageByCode(language) : null;
    const languageLine = langInfo
      ? `Language: ${langInfo.name} (${language})`
      : language
        ? `Language: ${language}`
        : "Language: English (en)";

    return [
      `Create a voice agent for ${content.brandName}.`,
      `Website: ${websiteUrl}`,
      "",
      `Industry: ${content.recommendedIntegrations?.industry || "general"}`,
      languageLine,
      `Tone: ${content.tone}`,
      "",
      `Company description: ${content.description}`,
      audienceSection,
      competitorSection,
      offerings,
      vocabularySection,
      faqs,
      scenariosSection,
      integrationsSection,
      "",
      "Requirements:",
      "- Be helpful and accurate; if unsure, ask clarifying questions.",
      "- Keep answers concise by default.",
      "- Use domain-specific vocabulary and terminology naturally in conversations.",
      "- Address customer pain points proactively when relevant.",
      "- If the user asks about pricing/policies, reference the knowledge base content above; if missing, say you do not know and offer to connect them with support.",
      "- Use the available tools to complete tasks like booking, scheduling, or looking up information.",
    ]
      .filter(Boolean)
      .join("\n");
  };

  // Handle URL analysis and scraping
  const handleAnalyze = async () => {
    if (!url.trim() || !isValidUrl(url)) {
      setError(t("agent:urlWizard.errors.invalidUrl"));
      return;
    }

    // Ensure Clerk auth is ready before making API calls
    if (!isAuthLoaded) {
      setError(t("common:errors.authLoading", "Authentication is still loading. Please wait."));
      return;
    }

    if (!isSignedIn) {
      setError(t("common:errors.notSignedIn", "Please sign in to continue."));
      return;
    }

    // Create new AbortController for this analysis session
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setError(null);
    setCurrentStep("scraping");
    setScrapingProgress(0);

    try {
      const websiteUrl = url.trim();

      // Check if cancelled before starting
      if (signal.aborted) {
        return;
      }

      // Start brand analysis (async on backend).
      // Production can experience cold starts; give the API more room to respond.
      const started = await apiClient.post<AnalyzeBrandResponse>(
        "/api/brands/analyze",
        { websiteUrl },
        { timeout: 120000, retries: 1, signal }
      );

      const brandId = started.brandId;
      const startedStatus = started.status ?? "PENDING";
      setScrapingProgress(getStatusProgress(startedStatus));

      const timeoutAt = Date.now() + 5 * 60 * 1000; // 5 minutes (matches backend 4-min timeout + buffer)
      let lastStatus: BrandAnalysisStatus = startedStatus;
      let consecutivePollTimeouts = 0;

      // Poll for completion.
      while (Date.now() < timeoutAt) {
        // Check if user cancelled
        if (signal.aborted) {
          return;
        }

        let res: GetBrandResponse;
        try {
          res = await apiClient.get<GetBrandResponse>(`/api/brands/${brandId}`, {
            timeout: 15000,
            retries: 0,
            signal,
          });
          consecutivePollTimeouts = 0;
        } catch (pollErr) {
          // If cancelled, exit gracefully
          if (signal.aborted) {
            return;
          }
          // Treat transient timeouts as recoverable during long-running background jobs.
          if (
            pollErr instanceof ApiClientError &&
            pollErr.status === 0 &&
            (pollErr.code === "AbortError" || pollErr.message.toLowerCase().includes("timed out"))
          ) {
            consecutivePollTimeouts += 1;
            if (consecutivePollTimeouts >= 4) {
              throw new Error(t("agent:urlWizard.errors.analysisTimeout"));
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          throw pollErr;
        }

        const data = res.data;
        setBrandAnalysis(data);

        if (data.status !== lastStatus) {
          lastStatus = data.status;
        }

        setScrapingProgress(getStatusProgress(data.status));

        if (data.status === "FAILED") {
          throw new Error(data.errorMessage || t("agent:urlWizard.errors.analysisFailed"));
        }

        if (data.status === "COMPLETED" || data.status === "COMPLETED_PARTIAL") {
          const content = toScrapedContent(data, websiteUrl, t);
          setScrapedContent(content);
          setScrapingProgress(100);

          // Initialize enabled MCPs from primary recommendations
          if (content.recommendedIntegrations?.primary_mcps) {
            const primaryMcpIds = content.recommendedIntegrations.primary_mcps.map(m => m.id);
            setEnabledMcps(new Set(primaryMcpIds));
          }

          // Pre-configure language from auto-detection
          if (data.detectedLanguage) {
            setSelectedLanguage(data.detectedLanguage);
          }

          setCurrentStep("preview");
          return;
        }

        // Wait before next poll.
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      throw new Error(t("agent:urlWizard.errors.analysisTimeout"));
    } catch (err) {
      // If user cancelled, don't show error
      if (signal.aborted) {
        return;
      }
      const errMessage = err instanceof Error ? err.message.toLowerCase() : "";

      // IMPORTANT: Only treat as auth error if it's an actual HTTP 401/403 from the Vora API.
      // Backend analysis errors (e.g., "401 No cookie auth credentials found" from scraper
      // trying to access a protected website) should NOT be treated as user auth errors.
      const isApiAuthError =
        err instanceof ApiClientError && (err.status === 401 || err.status === 403);

      // Special case: third-party cookie issues are browser-related auth problems
      const isThirdPartyCookieError =
        errMessage.includes("third-party cookies") || errMessage.includes("browser privacy");

      if (isApiAuthError) {
        // Actual auth error from our API
        setError(
          t(
            "common:errors.sessionExpired",
            "Your session has expired. Please refresh the page and sign in again."
          )
        );
      } else if (isThirdPartyCookieError) {
        // Browser cookie issue - show specific message
        setError(err instanceof Error ? err.message : t("common:errors.sessionExpired"));
      } else if (err instanceof ApiClientError) {
        if (
          err.status === 0 &&
          (err.code === "AbortError" || err.message.toLowerCase().includes("timed out"))
        ) {
          setError(t("agent:urlWizard.errors.analysisTimeout"));
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : t("agent:urlWizard.errors.analysisFailed"));
      }
      setCurrentStep("error");
    }
  };

  // Handle agent creation
  const handleCreateAgent = async () => {
    if (!scrapedContent || !brandAnalysis) return;

    // Ensure Clerk auth is ready before making API calls
    if (!isAuthLoaded || !isSignedIn) {
      setError(t("common:errors.notSignedIn", "Please sign in to continue."));
      return;
    }

    // Create new AbortController for agent creation
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setCurrentStep("creating");

    try {
      const prompt = buildAgentPrompt(brandAnalysis, url.trim(), enabledMcps, selectedLanguage);

      // Build the request payload with enabled integrations
      const payload: { prompt: string; enabledMcps?: string[]; tools?: ToolDefinition[]; brandId?: string } = {
        prompt,
      };

      // Include brandId for KB creation from brand analysis
      if (brandAnalysis?.id) {
        payload.brandId = brandAnalysis.id;
      }

      // Include enabled MCPs if any
      if (enabledMcps.size > 0) {
        payload.enabledMcps = Array.from(enabledMcps);
      }

      // Include auto-generated tools if integrations are present
      if (scrapedContent?.recommendedIntegrations?.auto_tools) {
        payload.tools = scrapedContent.recommendedIntegrations.auto_tools;
      }

      // Step 1: Start async agent creation (returns immediately with jobId)
      const startResponse = await apiClient.post<{
        success: true;
        jobId?: string;
        agent?: { id: string };
      }>("/api/agents/create", payload, { timeout: 30000, retries: 0, signal });

      // Handle sync response (demo mode or old backend)
      if (startResponse.agent?.id) {
        setCreatedAgentId(startResponse.agent.id);
        setCurrentStep("success");
        setTimeout(() => navigate(`/agents/${startResponse.agent!.id}`), 2000);
        return;
      }

      // Step 2: Poll for completion with async job
      if (!startResponse.jobId) {
        throw new Error("No job ID returned from server");
      }

      const jobId = startResponse.jobId;
      const POLL_INTERVAL_MS = 1000;
      const MAX_POLL_INTERVAL_MS = 3000;
      const MAX_POLL_TIME_MS = 120000;
      const startTime = Date.now();
      let pollInterval = POLL_INTERVAL_MS;

      while (Date.now() - startTime < MAX_POLL_TIME_MS) {
        if (signal.aborted) throw new Error("Cancelled");

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        pollInterval = Math.min(pollInterval * 1.2, MAX_POLL_INTERVAL_MS);

        const statusResponse = await apiClient.get<{
          status: string;
          progress?: number;
          agent?: { id: string };
          error?: { message: string };
        }>(`/api/agents/create-status/${jobId}`, { signal });

        // Update progress message
        if (statusResponse.progress) {
          // Could update UI with progress here
        }

        if (statusResponse.status === "completed" && statusResponse.agent) {
          setCreatedAgentId(statusResponse.agent.id);
          setCurrentStep("success");
          setTimeout(() => navigate(`/agents/${statusResponse.agent!.id}`), 2000);
          return;
        }

        if (statusResponse.status === "failed") {
          throw new Error(statusResponse.error?.message || "Agent creation failed");
        }
      }

      throw new Error("Agent creation timed out. Please try again.");
    } catch (err) {
      // If user cancelled, don't show error
      if (signal.aborted) {
        return;
      }

      const errMessage = err instanceof Error ? err.message.toLowerCase() : "";

      // Check for specific error codes from AgentCompilationError
      if (err instanceof ApiClientError && err.code) {
        const errorCode = err.code;
        switch (errorCode) {
          case "API_TIMEOUT":
            setError(
              t("agent:urlWizard.errors.timeout", "Agent creation timed out. Please try again.")
            );
            break;
          case "INVALID_JSON":
            setError(
              t(
                "agent:urlWizard.errors.invalidJson",
                "AI returned invalid data. Retrying may help."
              )
            );
            break;
          case "VALIDATION_FAILED":
            setError(
              t(
                "agent:urlWizard.errors.validationFailed",
                "Agent configuration is invalid. Please adjust your prompt."
              )
            );
            break;
          case "API_ERROR":
          default:
            setError(err.message || t("agent:urlWizard.errors.createFailed"));
        }
      } else {
        const isAuthError =
          errMessage.includes("session") ||
          errMessage.includes("sign in") ||
          errMessage.includes("expired") ||
          errMessage.includes("not authenticated") ||
          errMessage.includes("cookie auth") ||
          errMessage.includes("authentication failed") ||
          errMessage.includes("third-party cookies");

        if (isAuthError) {
          // Auth error - use the original error message if it contains helpful info about cookies
          const originalMessage = err instanceof Error ? err.message : "";
          if (
            originalMessage.includes("third-party cookies") ||
            originalMessage.includes("browser privacy")
          ) {
            setError(originalMessage);
          } else {
            setError(
              t(
                "common:errors.sessionExpired",
                "Your session has expired. Please refresh the page and sign in again."
              )
            );
          }
        } else if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : t("agent:urlWizard.errors.createFailed"));
        }
      }
      setCurrentStep("error");
    }
  };

  // Toggle collapsible sections
  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Toggle MCP enabled state
  const toggleMcp = (mcpId: string) => {
    setEnabledMcps(prev => {
      const next = new Set(prev);
      if (next.has(mcpId)) {
        next.delete(mcpId);
      } else {
        next.add(mcpId);
      }
      return next;
    });
  };

  // Format industry name for display
  const formatIndustry = (industry: string): string => {
    return industry.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  // Render input step
  const renderInputStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-4 rounded-xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] mb-4">
          <Globe className="h-12 w-12" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-[hsl(var(--text-high))]">
          {t("agent:urlWizard.title")}
        </h1>
        <p className="text-[hsl(var(--text-muted))]">{t("agent:urlWizard.subtitle")}</p>
      </div>

      {/* URL Input Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("agent:urlWizard.urlCard.title")}</CardTitle>
          <CardDescription>{t("agent:urlWizard.urlCard.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="url"
            placeholder={t("agent:urlWizard.urlCard.placeholder")}
            value={url}
            onChange={e => {
              setUrl(e.target.value);
              setError(null);
            }}
            error={!!error}
            onKeyDown={e => e.key === "Enter" && handleAnalyze()}
          />

          {error && (
            <Alert className="bg-[hsl(var(--error))]/10 border-[hsl(var(--error))]/50">
              <AlertCircle className="h-4 w-4 text-[hsl(var(--error))]" />
              <AlertDescription className="text-[hsl(var(--error))]">{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={!url.trim() || !isAuthLoaded}
            className="w-full"
            size="lg"
          >
            {!isAuthLoaded ? (
              <Loader2 className="h-4 w-4 me-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 me-2" />
            )}
            {!isAuthLoaded
              ? t("common:loading", "Loading...")
              : t("agent:urlWizard.actions.analyze")}
          </Button>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert className="bg-[hsl(var(--info))]/10 border-[hsl(var(--info))]/50">
        <Sparkles className="h-4 w-4 text-[hsl(var(--info))]" />
        <AlertDescription className="text-[hsl(var(--text-muted))]">
          {t("agent:urlWizard.info")}
        </AlertDescription>
      </Alert>

      {/* Features List */}
      <div className="space-y-3 pt-4">
        <h3 className="text-sm font-medium text-[hsl(var(--text-high))]">
          {t("agent:urlWizard.features.title")}
        </h3>
        <ul className="space-y-2 text-sm text-[hsl(var(--text-muted))]">
          <li className="flex items-start gap-2">
            <span className="text-[hsl(var(--primary))] mt-0.5">✓</span>
            <span>{t("agent:urlWizard.features.items.offerings")}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[hsl(var(--primary))] mt-0.5">✓</span>
            <span>{t("agent:urlWizard.features.items.pricing")}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[hsl(var(--primary))] mt-0.5">✓</span>
            <span>{t("agent:urlWizard.features.items.contact")}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[hsl(var(--primary))] mt-0.5">✓</span>
            <span>{t("agent:urlWizard.features.items.tone")}</span>
          </li>
        </ul>
      </div>
    </motion.div>
  );

  // Render scraping progress step
  const renderScrapingStep = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader className="text-center">
          <div className="inline-flex p-4 rounded-xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] mb-4 mx-auto">
            <Loader2 className="h-12 w-12 animate-spin" />
          </div>
          <CardTitle>{t("agent:urlWizard.scraping.title")}</CardTitle>
          <CardDescription>
            {t("agent:urlWizard.scraping.description", { hostname: new URL(url).hostname })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={scrapingProgress} />
          <p className="text-sm text-center text-[hsl(var(--text-muted))]">
            {t("agent:urlWizard.scraping.progress", { percent: scrapingProgress })}
          </p>
          {/* Cancel button for long-running operations */}
          <Button variant="outline" onClick={handleCancel} className="w-full">
            <X className="h-4 w-4 me-2" />
            {t("common:actions.cancel", "Cancel")}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );

  // Render preview step
  const renderPreviewStep = () => {
    if (!scrapedContent) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 rounded-xl bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] mb-4">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[hsl(var(--text-high))]">
            {scrapedContent.brandName}
          </h1>
          <p className="text-[hsl(var(--text-muted))]">{t("agent:urlWizard.preview.subtitle")}</p>
        </div>

        {/* Partial analysis info banner */}
        {brandAnalysis?.status === "COMPLETED_PARTIAL" && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
            We analyzed {brandAnalysis.pagesScraped || "some"} pages. Some pages were unavailable,
            but your agent is ready.
          </div>
        )}

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle>{t("agent:urlWizard.preview.sections.description")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[hsl(var(--text-muted))]">{scrapedContent.description}</p>
          </CardContent>
        </Card>

        {/* Detected Language */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-[hsl(var(--primary))]" />
              <CardTitle>{t("agent:urlWizard.preview.sections.language", "Agent Language")}</CardTitle>
              {brandAnalysis?.detectedLanguage && (
                <Badge variant="secondary" className="text-xs">
                  {t("agent:urlWizard.preview.labels.autoDetected", "Auto-detected")}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[hsl(var(--text-muted))]">
              {t(
                "agent:urlWizard.preview.labels.languageHint",
                "This language will be used for the agent's STT, TTS, and response language. You can change it below."
              )}
            </p>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("agent:urlWizard.preview.labels.selectLanguage", "Select language")} />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map(lang => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name} ({lang.nativeName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Tone - Collapsible */}
        <Collapsible open={openSections.tone} onOpenChange={() => toggleSection("tone")}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-start">
                  {t("agent:urlWizard.preview.sections.tone")}
                </CardTitle>
                {openSections.tone ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <p className="text-[hsl(var(--text-muted))]">{scrapedContent.tone}</p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Recommended Integrations - Collapsible */}
        {scrapedContent.recommendedIntegrations && (
          <Collapsible
            open={openSections.integrations}
            onOpenChange={() => toggleSection("integrations")}
          >
            <Card className="border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-[hsl(var(--primary))]" />
                    <CardTitle className="text-start">
                      {t(
                        "agent:urlWizard.preview.sections.integrations",
                        "Recommended Integrations"
                      )}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {formatIndustry(scrapedContent.recommendedIntegrations.industry)}
                    </Badge>
                  </div>
                  {openSections.integrations ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {/* Workflow Pack Banner */}
                  {scrapedContent.recommendedIntegrations.workflow_pack && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Settings2 className="h-4 w-4 text-[hsl(var(--primary))]" />
                        <span className="font-medium text-[hsl(var(--text-high))]">
                          {scrapedContent.recommendedIntegrations.workflow_pack.name}
                        </span>
                      </div>
                      <p className="text-sm text-[hsl(var(--text-muted))]">
                        {scrapedContent.recommendedIntegrations.workflow_pack.description}
                      </p>
                    </div>
                  )}

                  {/* Primary MCPs */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-[hsl(var(--text-high))]">
                      {t("agent:urlWizard.preview.labels.autoEnabled", "Auto-Enabled")}
                    </h4>
                    <div className="space-y-2">
                      {scrapedContent.recommendedIntegrations.primary_mcps.map(mcp => (
                        <div
                          key={mcp.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--surface-secondary))]"
                        >
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={enabledMcps.has(mcp.id)}
                              onCheckedChange={() => toggleMcp(mcp.id)}
                            />
                            <div>
                              <span className="font-medium text-[hsl(var(--text-high))]">
                                {mcp.name}
                              </span>
                              <p className="text-xs text-[hsl(var(--text-muted))]">{mcp.reason}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Optional MCPs */}
                  {scrapedContent.recommendedIntegrations.optional_mcps.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-[hsl(var(--text-muted))]">
                        {t("agent:urlWizard.preview.labels.optional", "Optional")}
                      </h4>
                      <div className="space-y-2">
                        {scrapedContent.recommendedIntegrations.optional_mcps.map(mcp => (
                          <div
                            key={mcp.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--surface-secondary))]/50"
                          >
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={enabledMcps.has(mcp.id)}
                                onCheckedChange={() => toggleMcp(mcp.id)}
                              />
                              <div>
                                <span className="font-medium text-[hsl(var(--text-high))]">
                                  {mcp.name}
                                </span>
                                <p className="text-xs text-[hsl(var(--text-muted))]">
                                  {mcp.reason}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Auto-Generated Tools */}
                  {scrapedContent.recommendedIntegrations.auto_tools.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-[hsl(var(--text-high))]">
                        {t("agent:urlWizard.preview.labels.autoTools", "Pre-Generated Tools")}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {scrapedContent.recommendedIntegrations.auto_tools.map(tool => (
                          <div
                            key={tool.name}
                            className="p-2 rounded-md bg-[hsl(var(--surface-secondary))]/30 border border-[hsl(var(--border))]"
                          >
                            <code className="text-xs font-mono text-[hsl(var(--primary))]">
                              {tool.name}
                            </code>
                            <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
                              {tool.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Offerings - Collapsible */}
        <Collapsible open={openSections.offerings} onOpenChange={() => toggleSection("offerings")}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-start">
                  {t("agent:urlWizard.preview.sections.offerings")}
                </CardTitle>
                {openSections.offerings ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <ul className="space-y-2">
                  {scrapedContent.offerings.map((offering, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[hsl(var(--text-muted))]">
                      <span className="text-[hsl(var(--primary))] mt-0.5">•</span>
                      <span>{offering}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* FAQ - Collapsible */}
        <Collapsible open={openSections.faq} onOpenChange={() => toggleSection("faq")}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-start">
                  {t("agent:urlWizard.preview.sections.faq")}
                </CardTitle>
                {openSections.faq ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {scrapedContent.faq.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="font-medium text-[hsl(var(--text-high))]">{item.question}</p>
                    <p className="text-sm text-[hsl(var(--text-muted))]">{item.answer}</p>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Contact Info - Collapsible (if available) */}
        {scrapedContent.contactInfo && (
          <Collapsible open={openSections.contact} onOpenChange={() => toggleSection("contact")}>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-start">
                    {t("agent:urlWizard.preview.sections.contact")}
                  </CardTitle>
                  {openSections.contact ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2">
                  {scrapedContent.contactInfo.email && (
                    <p className="text-[hsl(var(--text-muted))]">
                      {t("agent:urlWizard.preview.labels.email")}:{" "}
                      {scrapedContent.contactInfo.email}
                    </p>
                  )}
                  {scrapedContent.contactInfo.phone && (
                    <p className="text-[hsl(var(--text-muted))]">
                      {t("agent:urlWizard.preview.labels.phone")}:{" "}
                      {scrapedContent.contactInfo.phone}
                    </p>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Create Agent Button */}
        <Button onClick={handleCreateAgent} className="w-full" size="lg">
          <Sparkles className="h-4 w-4 me-2" />
          {t("agent:actions.createAgent")}
        </Button>
      </motion.div>
    );
  };

  // Render creating step
  const renderCreatingStep = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader className="text-center">
          <div className="inline-flex p-4 rounded-xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] mb-4 mx-auto">
            <Loader2 className="h-12 w-12 animate-spin" />
          </div>
          <CardTitle>{t("agent:urlWizard.creating.title")}</CardTitle>
          <CardDescription>{t("agent:urlWizard.creating.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Cancel button for agent creation */}
          <Button variant="outline" onClick={handleCancel} className="w-full">
            <X className="h-4 w-4 me-2" />
            {t("common:actions.cancel", "Cancel")}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );

  // Render success step
  const renderSuccessStep = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader className="text-center">
          <div className="inline-flex p-4 rounded-xl bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] mb-4 mx-auto">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <CardTitle>{t("agent:urlWizard.success.title")}</CardTitle>
          <CardDescription>{t("agent:urlWizard.success.description")}</CardDescription>
        </CardHeader>
      </Card>
    </motion.div>
  );

  // Render error step
  const renderErrorStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader className="text-center">
          <div className="inline-flex p-4 rounded-xl bg-[hsl(var(--error))]/10 text-[hsl(var(--error))] mb-4 mx-auto">
            <AlertCircle className="h-12 w-12" />
          </div>
          <CardTitle>{t("agent:urlWizard.error.title")}</CardTitle>
          <CardDescription>{error || t("agent:urlWizard.error.unknown")}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={() => setCurrentStep("input")} variant="outline" className="flex-1">
            <ArrowLeft className="h-4 w-4 me-2" />
            {t("common:actions.back")}
          </Button>
          <Button onClick={handleAnalyze} className="flex-1">
            {t("common:actions.tryAgain")}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Back Button - only show on input and preview steps */}
      {(currentStep === "input" || currentStep === "preview") && (
        <Button
          variant="ghost"
          onClick={() =>
            currentStep === "preview" ? setCurrentStep("input") : navigate("/agents/create")
          }
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 me-2" />
          {t("common:actions.back")}
        </Button>
      )}

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {currentStep === "input" && renderInputStep()}
        {currentStep === "scraping" && renderScrapingStep()}
        {currentStep === "preview" && renderPreviewStep()}
        {currentStep === "creating" && renderCreatingStep()}
        {currentStep === "success" && renderSuccessStep()}
        {currentStep === "error" && renderErrorStep()}
      </AnimatePresence>
    </div>
  );
}
