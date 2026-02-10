import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingWizard } from '../components/Onboarding/OnboardingWizard';
import { getItem, setItem } from '@/lib/safeLocalStorage';

const ONBOARDING_COMPLETE_KEY = 'vora_onboarding_complete';

export function OnboardingPage() {
  const navigate = useNavigate();
  const [showWizard, setShowWizard] = useState(true);

  useEffect(() => {
    // Check if onboarding was already completed with safe localStorage access
    const isComplete = getItem<string>(ONBOARDING_COMPLETE_KEY, { fallback: 'false' });
    if (isComplete === 'true') {
      // User can still access the page, but show a message
      setShowWizard(true);
    }
  }, []);

  const handleComplete = () => {
    setItem(ONBOARDING_COMPLETE_KEY, 'true');
    navigate('/');
  };

  const handleSkip = () => {
    setItem(ONBOARDING_COMPLETE_KEY, 'true');
    navigate('/');
  };

  return (
    <div className="py-8">
      <OnboardingWizard onComplete={handleComplete} onSkip={handleSkip} />
    </div>
  );
}

export default OnboardingPage;
