/**
 * Platform Policies Pages
 *
 * Renders Privacy Policy, Terms of Service, Cookie Policy, DPA, and AUP.
 * Each policy has a table of contents, last-updated date, and clean readable layout.
 * Supports both light and dark themes via CSS variables.
 *
 * NOTE: These are AI-generated templates requiring legal review before production.
 *
 * Routes:
 * - /policies/privacy
 * - /policies/terms
 * - /policies/cookies
 * - /policies/dpa
 * - /policies/aup
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import { Shield, FileText, Cookie, Scale, AlertTriangle, ChevronLeft, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/button';

// ============================================================================
// TYPES
// ============================================================================

interface PolicySection {
  id: string;
  title: string;
  content: string;
}

interface PolicyData {
  title: string;
  icon: React.ReactNode;
  lastUpdated: string;
  sections: PolicySection[];
}

// ============================================================================
// POLICY CONTENT
// ============================================================================

const POLICIES: Record<string, PolicyData> = {
  privacy: {
    title: 'Privacy Policy',
    icon: <Shield className="h-6 w-6" />,
    lastUpdated: '2026-02-01',
    sections: [
      {
        id: 'overview',
        title: '1. Overview',
        content: `Vora Voice AI ("Vora", "we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our voice AI platform, including our website, APIs, and related services (collectively, the "Platform").`,
      },
      {
        id: 'data-collected',
        title: '2. Information We Collect',
        content: `**Account Information**: Name, email address, organization name, and billing information provided during registration.\n\n**Voice Data**: Audio recordings processed through our voice AI agents. Voice data is processed in real-time and may be temporarily stored for quality assurance.\n\n**Transcripts**: Text transcriptions of voice conversations between users and AI agents.\n\n**Memory Storage**: Customer memories extracted from conversations (preferences, personal information, intents) stored to personalize future interactions.\n\n**Usage Data**: Platform usage metrics, session durations, API call logs, feature usage, and performance data.\n\n**Technical Data**: IP addresses, browser type, device information, and cookies for platform functionality.`,
      },
      {
        id: 'voice-data',
        title: '3. Voice Data Processing',
        content: `Voice data is processed using third-party providers including Google (Gemini), Deepgram, ElevenLabs, and Cartesia for speech-to-text, language processing, and text-to-speech.\n\nVoice recordings are:\n- Processed in real-time with minimal latency\n- Not stored permanently unless explicitly enabled by the user\n- Encrypted in transit using TLS 1.3\n- Subject to provider-specific data processing agreements\n\nYou may disable voice recording storage at any time through your agent configuration settings.`,
      },
      {
        id: 'transcript-memory',
        title: '4. Transcripts and Memory',
        content: `Conversation transcripts are stored to provide conversation history and enable memory features.\n\n**Customer Memory System**: Our platform extracts facts, preferences, and context from conversations to personalize future interactions. Memories include:\n- Customer preferences and personal information\n- Conversation summaries and action items\n- Sentiment analysis and interaction history\n\nMemories are scored using a Recency-Importance-Frequency (RIF) algorithm and automatically pruned when no longer relevant. You can delete customer memories at any time through the Memory tab in your agent configuration.`,
      },
      {
        id: 'third-party',
        title: '5. Third-Party Sharing',
        content: `We share data with third-party service providers only as necessary to operate the Platform:\n\n- **AI/ML Providers**: Google (Gemini), OpenAI, Anthropic, Groq, Mistral for language processing\n- **Voice Providers**: Deepgram, ElevenLabs, Cartesia, AssemblyAI for speech processing\n- **Infrastructure**: Fly.io (hosting), Vercel (frontend), Supabase (database), Upstash (caching)\n- **Authentication**: Clerk for user authentication and session management\n- **Billing**: Paddle for subscription and payment processing\n- **Analytics**: PostHog for product analytics, Sentry for error tracking\n\nWe do not sell your personal data to third parties.`,
      },
      {
        id: 'data-retention',
        title: '6. Data Retention',
        content: `- **Account data**: Retained for the duration of your account, deleted within 30 days of account closure\n- **Voice recordings**: Deleted after processing unless recording is explicitly enabled (configurable retention: 30-365 days)\n- **Transcripts**: Retained per your configured retention policy (default: 90 days)\n- **Customer memories**: Retained until RIF score falls below threshold or manually deleted\n- **Usage logs**: Retained for 12 months for operational purposes\n- **Billing records**: Retained as required by applicable tax and accounting laws`,
      },
      {
        id: 'rights',
        title: '7. Your Rights',
        content: `Depending on your jurisdiction, you may have the right to:\n- **Access**: Request a copy of your personal data\n- **Rectification**: Correct inaccurate personal data\n- **Erasure**: Request deletion of your personal data\n- **Portability**: Receive your data in a portable format\n- **Restriction**: Restrict processing of your data\n- **Objection**: Object to processing based on legitimate interests\n\nTo exercise these rights, contact us at privacy@vora.ai.`,
      },
      {
        id: 'security',
        title: '8. Security',
        content: `We implement industry-standard security measures including:\n- TLS 1.3 encryption for data in transit\n- AES-256-GCM encryption for stored credentials and sensitive data\n- HMAC-SHA256 signed webhook verification\n- Role-based access control (RBAC)\n- Regular security audits and vulnerability assessments\n- SOC 2 Type II compliance (in progress)`,
      },
      {
        id: 'contact',
        title: '9. Contact Us',
        content: `For privacy inquiries, contact our Data Protection Officer at:\n\n**Email**: privacy@vora.ai\n**Address**: Vora AI, [Address TBD]`,
      },
    ],
  },

  terms: {
    title: 'Terms of Service',
    icon: <FileText className="h-6 w-6" />,
    lastUpdated: '2026-02-01',
    sections: [
      {
        id: 'acceptance',
        title: '1. Acceptance of Terms',
        content: `By accessing or using the Vora Voice AI platform ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Platform.\n\nThese Terms constitute a legally binding agreement between you ("User", "you") and Vora AI ("Vora", "we", "us").`,
      },
      {
        id: 'service-description',
        title: '2. Service Description',
        content: `Vora provides a voice AI platform that enables users to create, configure, deploy, and manage AI-powered voice agents. The Platform includes:\n- Agent creation and configuration tools\n- Voice AI processing (speech-to-text, language models, text-to-speech)\n- Knowledge base management\n- Analytics and monitoring\n- API access for integration\n- Deployment infrastructure`,
      },
      {
        id: 'accounts',
        title: '3. User Accounts',
        content: `You must create an account to use the Platform. You are responsible for:\n- Providing accurate registration information\n- Maintaining the security of your account credentials\n- All activities that occur under your account\n- Notifying us immediately of any unauthorized access\n\nWe reserve the right to suspend or terminate accounts that violate these Terms.`,
      },
      {
        id: 'service-levels',
        title: '4. Service Levels',
        content: `**Uptime Target**: We target 99.9% uptime for the Platform, excluding scheduled maintenance windows.\n\n**Scheduled Maintenance**: We will provide at least 24 hours notice for planned maintenance that may cause service interruption.\n\n**Support**: Support is available via email at support@vora.ai. Response times vary by subscription tier:\n- Free tier: Best effort\n- Starter: 48-hour response\n- Pro: 24-hour response\n- Enterprise: 4-hour response with dedicated support`,
      },
      {
        id: 'usage-limits',
        title: '5. Usage and Limits',
        content: `Usage is subject to your subscription plan limits including:\n- Voice minutes per month\n- Number of agents\n- API rate limits\n- Knowledge base storage\n- Concurrent sessions\n\nExceeding plan limits may result in service throttling or additional charges as specified in your plan details.`,
      },
      {
        id: 'intellectual-property',
        title: '6. Intellectual Property',
        content: `**Your Content**: You retain ownership of all content you create on the Platform, including agent configurations, knowledge bases, and custom functions.\n\n**Our Platform**: Vora retains all rights to the Platform, including its software, design, documentation, and trademarks.\n\n**AI-Generated Output**: Output generated by AI agents is provided "as-is". You are responsible for reviewing and validating AI-generated content before using it in production.`,
      },
      {
        id: 'liability',
        title: '7. Limitation of Liability',
        content: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, VORA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES.\n\nOUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID TO VORA IN THE 12 MONTHS PRECEDING THE CLAIM.\n\nAI agent responses are generated automatically and may contain errors. Vora is not liable for actions taken based on AI-generated content.`,
      },
      {
        id: 'termination',
        title: '8. Termination',
        content: `Either party may terminate this agreement at any time.\n\n**By You**: You may cancel your subscription and delete your account at any time through the Settings page.\n\n**By Us**: We may suspend or terminate your account for:\n- Violation of these Terms or the Acceptable Use Policy\n- Non-payment of fees\n- Activity that poses a security risk\n\nUpon termination, we will retain your data for 30 days to allow for export, after which it will be permanently deleted.`,
      },
      {
        id: 'governing-law',
        title: '9. Governing Law',
        content: `These Terms shall be governed by and construed in accordance with applicable laws. Any disputes arising from these Terms shall be resolved through binding arbitration, except where prohibited by law.`,
      },
    ],
  },

  cookies: {
    title: 'Cookie Policy',
    icon: <Cookie className="h-6 w-6" />,
    lastUpdated: '2026-02-01',
    sections: [
      {
        id: 'what-are-cookies',
        title: '1. What Are Cookies',
        content: `Cookies are small text files stored on your device when you visit a website. They help the website remember your preferences and improve your experience.`,
      },
      {
        id: 'cookies-we-use',
        title: '2. Cookies We Use',
        content: `**Essential Cookies** (Required)\n- Authentication session cookies (Clerk)\n- CSRF protection tokens\n- Theme and language preferences\n- Security cookies\n\n**Analytics Cookies** (Optional)\n- PostHog analytics for product improvement\n- Session replay for UX research (anonymized)\n- Feature usage tracking\n\n**Performance Cookies** (Optional)\n- Sentry error tracking\n- Performance monitoring data\n- CDN optimization cookies (Vercel)`,
      },
      {
        id: 'third-party-cookies',
        title: '3. Third-Party Cookies',
        content: `Our Platform may set cookies from the following third-party services:\n\n- **Clerk** (clerk.com): Authentication and session management\n- **PostHog** (posthog.com): Product analytics\n- **Sentry** (sentry.io): Error monitoring\n- **Vercel** (vercel.com): Performance and hosting\n- **Paddle** (paddle.com): Payment processing (only on billing pages)\n\nEach third-party service has its own cookie and privacy policy.`,
      },
      {
        id: 'managing-cookies',
        title: '4. Managing Cookies',
        content: `You can manage cookies through:\n- **Browser settings**: Most browsers allow you to block or delete cookies\n- **Platform settings**: Toggle optional analytics cookies in Settings > Privacy\n- **Do Not Track**: We respect the DNT browser signal for analytics cookies\n\nNote: Blocking essential cookies may prevent the Platform from functioning correctly.`,
      },
      {
        id: 'cookie-retention',
        title: '5. Cookie Retention',
        content: `- Essential cookies: Session-based or up to 30 days\n- Analytics cookies: Up to 12 months\n- Performance cookies: Up to 6 months\n- Preference cookies: Up to 12 months`,
      },
    ],
  },

  dpa: {
    title: 'Data Processing Agreement',
    icon: <Scale className="h-6 w-6" />,
    lastUpdated: '2026-02-01',
    sections: [
      {
        id: 'scope',
        title: '1. Scope and Purpose',
        content: `This Data Processing Agreement ("DPA") supplements the Terms of Service and applies when Vora processes personal data on behalf of the Customer (the "Data Controller") as a Data Processor under GDPR Article 28.\n\nThis DPA covers all personal data processed through the Vora Voice AI Platform in connection with the services provided under the Terms of Service.`,
      },
      {
        id: 'definitions',
        title: '2. Definitions',
        content: `**Personal Data**: Any information relating to an identified or identifiable natural person.\n\n**Processing**: Any operation performed on personal data, including collection, recording, organization, structuring, storage, adaptation, retrieval, consultation, use, disclosure, dissemination, erasure, or destruction.\n\n**Data Controller**: The Customer who determines the purposes and means of processing personal data.\n\n**Data Processor**: Vora, which processes personal data on behalf of the Data Controller.\n\n**Sub-processor**: A third party engaged by Vora to process personal data on behalf of the Data Controller.`,
      },
      {
        id: 'obligations',
        title: '3. Processor Obligations (GDPR Article 28)',
        content: `Vora shall:\n\n- Process personal data only on documented instructions from the Data Controller\n- Ensure persons authorized to process personal data have committed to confidentiality\n- Implement appropriate technical and organizational security measures\n- Assist the Data Controller with data subject access requests\n- Delete or return all personal data upon termination of services\n- Make available all information necessary to demonstrate compliance\n- Allow and contribute to audits conducted by the Data Controller\n- Immediately inform the Data Controller if an instruction infringes GDPR`,
      },
      {
        id: 'sub-processors',
        title: '4. Sub-processors',
        content: `Vora engages the following categories of sub-processors:\n\n**AI/ML Processing**: Google (Gemini), OpenAI, Anthropic, Groq, Mistral\n**Speech Processing**: Deepgram, ElevenLabs, Cartesia, AssemblyAI\n**Infrastructure**: Fly.io (compute), Supabase (database), Upstash (cache)\n**Authentication**: Clerk\n**Billing**: Paddle\n\nVora will notify the Data Controller of any intended changes to sub-processors, providing an opportunity to object. Each sub-processor is bound by data processing obligations no less protective than those in this DPA.`,
      },
      {
        id: 'security',
        title: '5. Security Measures',
        content: `Vora implements the following technical and organizational measures:\n\n**Encryption**: TLS 1.3 in transit, AES-256-GCM at rest for sensitive data\n**Access Control**: Role-based access control, principle of least privilege\n**Monitoring**: Real-time security monitoring, audit logging\n**Incident Response**: 72-hour breach notification to Data Controller\n**Data Minimization**: Processing limited to what is necessary for service provision\n**Pseudonymization**: Customer identifiers are pseudonymized where feasible`,
      },
      {
        id: 'data-transfers',
        title: '6. International Data Transfers',
        content: `Personal data may be transferred to countries outside the EEA. Where such transfers occur, Vora ensures appropriate safeguards are in place, including:\n\n- Standard Contractual Clauses (SCCs) approved by the European Commission\n- Adequacy decisions where applicable\n- Binding Corporate Rules where relevant\n\nDetails of specific transfer mechanisms for each sub-processor are available upon request.`,
      },
      {
        id: 'breach-notification',
        title: '7. Data Breach Notification',
        content: `In the event of a personal data breach, Vora will:\n\n- Notify the Data Controller without undue delay and within 72 hours of becoming aware\n- Provide details of the breach including nature, categories of data, approximate number of records affected\n- Describe measures taken or proposed to address the breach\n- Cooperate with the Data Controller's notification obligations to supervisory authorities and data subjects`,
      },
      {
        id: 'duration',
        title: '8. Duration and Termination',
        content: `This DPA remains in effect for the duration of the service agreement. Upon termination:\n\n- Vora will delete all personal data within 30 days, unless retention is required by law\n- Data Controller may request data export before deletion\n- Vora will provide written confirmation of deletion upon request`,
      },
    ],
  },

  aup: {
    title: 'Acceptable Use Policy',
    icon: <AlertTriangle className="h-6 w-6" />,
    lastUpdated: '2026-02-01',
    sections: [
      {
        id: 'purpose',
        title: '1. Purpose',
        content: `This Acceptable Use Policy ("AUP") defines prohibited uses of the Vora Voice AI Platform. All users must comply with this AUP in addition to the Terms of Service.`,
      },
      {
        id: 'prohibited-content',
        title: '2. Prohibited Content',
        content: `You may not use the Platform to create, distribute, or facilitate:\n\n- Content that is illegal, harmful, threatening, abusive, or harassing\n- Content that impersonates real individuals without consent\n- Content designed to deceive or defraud\n- Content that violates intellectual property rights\n- Sexually explicit or exploitative content\n- Content promoting violence, discrimination, or hatred\n- Spam or unsolicited communications`,
      },
      {
        id: 'prohibited-uses',
        title: '3. Prohibited Uses',
        content: `You may not use the Platform for:\n\n**Deception**: Creating voice agents that impersonate real people, government officials, or emergency services without clear disclosure\n\n**Surveillance**: Mass monitoring, wiretapping, or covert recording of conversations without appropriate consent\n\n**Harassment**: Automated calling campaigns intended to harass, intimidate, or threaten\n\n**Fraud**: Phishing, social engineering, or any form of financial fraud\n\n**Circumvention**: Attempting to bypass security controls, rate limits, or usage restrictions\n\n**Reverse Engineering**: Decompiling, disassembling, or reverse engineering the Platform\n\n**Resale Without Authorization**: Reselling Platform access without a valid reseller agreement`,
      },
      {
        id: 'voice-specific',
        title: '4. Voice-Specific Requirements',
        content: `When deploying voice AI agents, you must:\n\n- **Disclose AI Nature**: Clearly inform callers they are speaking with an AI agent at the start of each interaction\n- **Obtain Consent**: Comply with all applicable call recording and consent laws (two-party consent where required)\n- **Provide Opt-Out**: Allow callers to request transfer to a human agent or end the call at any time\n- **Respect Do-Not-Call**: Comply with Do-Not-Call registries and regulations in all jurisdictions where agents operate\n- **Emergency Calls**: Never use AI agents to handle genuine emergency situations — always transfer to human operators`,
      },
      {
        id: 'compliance',
        title: '5. Compliance',
        content: `You are responsible for ensuring your use of the Platform complies with:\n\n- All applicable local, state, national, and international laws\n- Industry-specific regulations (HIPAA, PCI-DSS, FINRA, etc.)\n- Telecommunications regulations including TCPA, Ofcom, and equivalent\n- Data protection regulations including GDPR, CCPA, and equivalent\n\nVora may require evidence of compliance for regulated industries.`,
      },
      {
        id: 'enforcement',
        title: '6. Enforcement',
        content: `Violations of this AUP may result in:\n\n- **Warning**: Written notice for minor or first-time violations\n- **Suspension**: Temporary suspension of service for repeated or serious violations\n- **Termination**: Permanent termination of account for severe or willful violations\n- **Reporting**: Reporting to law enforcement for illegal activities\n\nVora reserves the right to take immediate action without prior notice for violations that pose an imminent risk to users, the Platform, or third parties.`,
      },
      {
        id: 'reporting',
        title: '7. Reporting Violations',
        content: `If you become aware of a violation of this AUP, please report it to:\n\n**Email**: abuse@vora.ai\n\nAll reports are investigated and handled confidentially.`,
      },
    ],
  },
};

// ============================================================================
// POLICY NAV
// ============================================================================

const POLICY_NAV = [
  { key: 'privacy', label: 'Privacy Policy', icon: Shield },
  { key: 'terms', label: 'Terms of Service', icon: FileText },
  { key: 'cookies', label: 'Cookie Policy', icon: Cookie },
  { key: 'dpa', label: 'Data Processing Agreement', icon: Scale },
  { key: 'aup', label: 'Acceptable Use Policy', icon: AlertTriangle },
] as const;

// ============================================================================
// COMPONENT
// ============================================================================

export default function PoliciesPage() {
  const { policyType } = useParams<{ policyType: string }>();
  const navigate = useNavigate();

  // Default to privacy if no policy type specified
  const currentPolicy = policyType && POLICIES[policyType] ? policyType : 'privacy';
  const policy = POLICIES[currentPolicy];

  if (!policy) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Policy not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="mb-6 text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back
      </Button>

      {/* Policy Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-border pb-4">
        {POLICY_NAV.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            to={`/policies/${key}`}
            className={`
              inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${currentPolicy === key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }
            `}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        ))}
      </div>

      {/* Policy Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-primary">{policy.icon}</div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{policy.title}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Last updated: {new Date(policy.lastUpdated).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium border border-amber-500/20">
          <AlertTriangle className="h-3.5 w-3.5" />
          AI-generated template — requires legal review before production use
        </div>
      </div>

      <div className="flex gap-8">
        {/* Table of Contents (Desktop) */}
        <nav className="hidden lg:block w-56 flex-shrink-0 sticky top-24 self-start">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Table of Contents
          </p>
          <ul className="space-y-1">
            {policy.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1 truncate"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Policy Content */}
        <article className="flex-1 min-w-0">
          <div className="space-y-8">
            {policy.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-xl font-semibold text-foreground mb-3 border-b border-border pb-2">
                  {section.title}
                </h2>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {section.content.split('\n').map((line, i) => {
                    // Bold text support (simple **text** pattern)
                    const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
                    return (
                      <span key={i}>
                        {boldParts.map((part, j) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return (
                              <strong key={j} className="font-semibold text-foreground">
                                {part.slice(2, -2)}
                              </strong>
                            );
                          }
                          return <span key={j}>{part}</span>;
                        })}
                        {i < section.content.split('\n').length - 1 && '\n'}
                      </span>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-xs text-muted-foreground">
              For questions about this {policy.title.toLowerCase()}, contact us at{' '}
              <a href="mailto:legal@vora.ai" className="text-primary hover:underline">
                legal@vora.ai
              </a>
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {POLICY_NAV.filter(p => p.key !== currentPolicy).map(({ key, label }) => (
                <Link
                  key={key}
                  to={`/policies/${key}`}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  {label}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
