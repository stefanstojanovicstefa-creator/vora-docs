import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Bot,
  TestTube,
  Rocket,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  Check,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
  actionLabel?: string;
  actionPath?: string;
}

interface OnboardingWizardProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const navigate = useNavigate();

  const steps: OnboardingStep[] = [
    {
      id: 0,
      title: 'Welcome to Vora Voice',
      description: 'Build powerful voice AI agents in minutes',
      icon: Sparkles,
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Vora Voice is a complete platform for creating, deploying, and managing
            voice AI agents. With our intuitive interface and powerful backend,
            you can build sophisticated voice assistants without complex coding.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <FeatureCard
              icon={Bot}
              title="Create Agents"
              description="Design voice agents with custom personalities and capabilities"
            />
            <FeatureCard
              icon={TestTube}
              title="Test & Iterate"
              description="Test your agents in real-time and refine their behavior"
            />
            <FeatureCard
              icon={Rocket}
              title="Deploy Anywhere"
              description="Deploy to web, phone, or embed in your applications"
            />
            <FeatureCard
              icon={BarChart3}
              title="Monitor & Optimize"
              description="Track performance and optimize costs in real-time"
            />
          </div>
        </div>
      ),
    },
    {
      id: 1,
      title: 'Create Your First Agent',
      description: 'Set up your voice agent with a custom personality',
      icon: Bot,
      actionLabel: 'Go to Agent Builder',
      actionPath: '/agents/create',
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Start by creating your first voice agent. You'll define:
          </p>
          <ul className="space-y-3">
            <StepItem
              number={1}
              title="Agent Name & Description"
              description="Give your agent an identity"
            />
            <StepItem
              number={2}
              title="System Prompt"
              description="Define how your agent should behave and respond"
            />
            <StepItem
              number={3}
              title="Voice Selection"
              description="Choose from multiple TTS providers and voices"
            />
            <StepItem
              number={4}
              title="Provider Configuration"
              description="Select LLM, STT, and TTS providers"
            />
          </ul>
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Pro Tip</p>
            <p className="text-sm text-muted-foreground">
              Use the Brand Analyzer to automatically generate agent prompts
              that match your brand's voice and tone.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      title: 'Test Your Agent',
      description: 'Have a conversation with your agent to test its behavior',
      icon: TestTube,
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Before deploying, test your agent to ensure it behaves as expected:
          </p>
          <div className="space-y-3">
            <TestingStep
              title="Voice Testing"
              description="Speak to your agent and verify voice quality and response accuracy"
            />
            <TestingStep
              title="Scenario Testing"
              description="Test various conversation scenarios your agent might encounter"
            />
            <TestingStep
              title="Error Handling"
              description="Verify how your agent handles unexpected inputs or errors"
            />
            <TestingStep
              title="Latency Check"
              description="Monitor response times to ensure a smooth user experience"
            />
          </div>
          <div className="bg-amber-500/10 border border-amber-200 p-4 rounded-lg">
            <p className="text-sm font-medium text-amber-700 mb-1">Testing Best Practices</p>
            <p className="text-sm text-amber-600">
              Test with different accents, speaking speeds, and background noise
              to ensure robust performance.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      title: 'Deploy Your Agent',
      description: 'Make your agent available to users',
      icon: Rocket,
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Deploy your agent using one of these methods:
          </p>
          <div className="grid gap-3">
            <DeploymentOption
              title="Web Widget"
              description="Embed a voice button on your website"
              badge="Popular"
            />
            <DeploymentOption
              title="Phone Number"
              description="Connect to a phone number via Twilio or other providers"
              badge="Enterprise"
            />
            <DeploymentOption
              title="API Integration"
              description="Integrate directly using our REST API"
              badge="Developer"
            />
            <DeploymentOption
              title="LiveKit Room"
              description="Join a LiveKit room for real-time voice communication"
              badge="Advanced"
            />
          </div>
        </div>
      ),
    },
    {
      id: 4,
      title: 'Monitor Performance',
      description: 'Track usage, costs, and optimize your agents',
      icon: BarChart3,
      actionLabel: 'View Analytics',
      actionPath: '/agent-performance',
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Use our comprehensive analytics to monitor and optimize:
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <AnalyticsCard
              title="Agent Performance"
              description="Success rates, response times, error analysis"
              path="/agent-performance"
            />
            <AnalyticsCard
              title="Cost Analytics"
              description="Track costs by provider, agent, and conversation"
              path="/cost-analytics"
            />
            <AnalyticsCard
              title="Usage Metrics"
              description="Session volumes, token usage, audio duration"
              path="/usage-metrics"
            />
            <AnalyticsCard
              title="Provider Health"
              description="Monitor provider status and latency"
              path="/providers"
            />
          </div>
          <div className="bg-green-500/10 border border-green-200 p-4 rounded-lg">
            <p className="text-sm font-medium text-green-700 mb-1">You're all set!</p>
            <p className="text-sm text-green-600">
              You now have everything you need to create, deploy, and monitor
              powerful voice AI agents with Vora Voice.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }
    if (isLastStep) {
      onComplete?.();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAction = () => {
    if (currentStepData.actionPath) {
      navigate(currentStepData.actionPath);
    }
  };

  const StepIcon = currentStepData.icon;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </span>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip Tutorial
          </Button>
        </div>
        <Progress value={progress} className="h-2" />

        {/* Step Indicators */}
        <div className="flex justify-between mt-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = completedSteps.includes(index);
            const isCurrent = index === currentStep;

            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(index)}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  isCurrent
                    ? 'text-primary'
                    : isCompleted
                    ? 'text-green-500'
                    : 'text-muted-foreground'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-muted'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span className="text-xs hidden md:block">{step.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <StepIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>{currentStepData.title}</CardTitle>
              <CardDescription>{currentStepData.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentStepData.content}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex gap-2">
          {currentStepData.actionLabel && (
            <Button variant="outline" onClick={handleAction}>
              {currentStepData.actionLabel}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          <Button onClick={handleNext}>
            {isLastStep ? 'Complete' : 'Next'}
            {!isLastStep && <ChevronRight className="h-4 w-4 ml-2" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <div className="p-2 rounded-md bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function StepItem({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
        {number}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}

function TestingStep({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border">
      <TestTube className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function DeploymentOption({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Badge variant="secondary">{badge}</Badge>
    </div>
  );
}

function AnalyticsCard({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(path)}
      className="text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
    >
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

export default OnboardingWizard;
