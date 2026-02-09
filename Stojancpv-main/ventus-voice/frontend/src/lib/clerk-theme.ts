import type { Appearance } from '@clerk/types';

/**
 * Vora branded Clerk theme configuration
 * Supports both dark and light modes matching the Vora design system.
 *
 * Dark mode tokens:
 * - Primary/Accent: #99CDFF (Neon Blue)
 * - Background: #050505 (Near Black)
 * - Surface: #121212 (Dark Surface)
 * - Border: rgba(39, 39, 42, 0.5)
 * - Text Primary: #EDEDED
 * - Text Secondary: #A1A1AA
 *
 * Light mode tokens:
 * - Primary/Accent: #2563EB (Primary Blue)
 * - Background: #FFFFFF (White)
 * - Surface: #F4F4F5 (Light Surface)
 * - Border: #E4E4E7
 * - Text Primary: #09090B
 * - Text Secondary: #71717A
 */

/** Dark mode Clerk appearance (default — used by ClerkProvider and in-app components) */
export const voraClerkAppearance: Appearance = {
  variables: {
    // Primary brand color
    colorPrimary: '#99CDFF',
    colorPrimaryHover: '#b3daff',

    // Background colors
    colorBackground: '#050505',
    colorInputBackground: '#121212',
    colorInputText: '#FFFFFF',

    // Text colors
    colorText: '#FFFFFF',
    colorTextOnPrimaryBackground: '#050505',
    colorTextSecondary: '#A1A1AA',

    // Border & Danger
    colorDanger: '#ef4444',
    colorSuccess: '#22c55e',

    // Border radius (Portal design)
    borderRadius: '0.75rem',

    // Font family (matching Portal)
    fontFamily: 'Inter, system-ui, sans-serif',
  },

  elements: {
    // Root card container
    rootBox: {
      width: '100%',
    },

    // Main card - transparent (Portal handles container)
    card: {
      backgroundColor: 'transparent',
      boxShadow: 'none',
      border: 'none',
    },

    // Header section
    headerTitle: {
      color: '#FFFFFF',
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    headerSubtitle: {
      color: '#A1A1AA',
    },

    // Social buttons (monochromatic with hover glow)
    socialButtonsBlockButton: {
      backgroundColor: 'transparent',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      color: '#A1A1AA',
      borderRadius: '0.75rem',
      transition: 'all 0.2s ease',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.4)',
        color: '#FFFFFF',
      },
    },
    socialButtonsBlockButtonText: {
      color: '#A1A1AA',
      '&:hover': {
        color: '#FFFFFF',
      },
    },

    // Divider
    dividerLine: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    dividerText: {
      color: '#71717A',
      fontSize: '0.875rem',
    },

    // Form fields (glassmorphism with neon glow)
    formFieldLabel: {
      color: '#FFFFFF',
      fontWeight: 500,
    },
    formFieldInput: {
      backgroundColor: '#121212',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      color: '#FFFFFF',
      borderRadius: '0.75rem',
      padding: '0.875rem 1rem',
      fontSize: '1rem',
      transition: 'all 0.2s ease',
      '&:focus': {
        borderColor: '#99CDFF',
        boxShadow: '0 0 15px rgba(153, 205, 255, 0.3)',
        outline: 'none',
      },
      '&::placeholder': {
        color: '#71717A',
      },
    },
    formFieldInputShowPasswordButton: {
      color: '#A1A1AA',
      '&:hover': {
        color: '#99CDFF',
      },
    },

    // Primary button (Neon Blue CTA)
    formButtonPrimary: {
      backgroundColor: '#99CDFF',
      color: '#050505',
      fontWeight: 600,
      fontSize: '1rem',
      padding: '0.875rem 1.5rem',
      borderRadius: '0.75rem',
      transition: 'all 0.2s ease',
      '&:hover': {
        backgroundColor: '#b3daff',
        transform: 'scale(1.02)',
        boxShadow: '0 0 25px rgba(153, 205, 255, 0.5)',
      },
      '&:active': {
        transform: 'scale(0.98)',
      },
    },

    // Footer action links
    footerActionLink: {
      color: '#99CDFF',
      fontWeight: 500,
      '&:hover': {
        color: '#b3daff',
      },
    },
    footerActionText: {
      color: '#71717A',
    },

    // Identifier preview (email/phone display)
    identityPreview: {
      backgroundColor: '#121212',
      border: '1px solid rgba(39, 39, 42, 0.5)',
    },
    identityPreviewText: {
      color: '#EDEDED',
    },
    identityPreviewEditButton: {
      color: '#99CDFF',
      '&:hover': {
        color: '#b3daff',
      },
    },

    // User button (profile menu)
    userButtonBox: {
      '&:hover': {
        opacity: 0.9,
      },
    },
    userButtonTrigger: {
      '&:focus': {
        boxShadow: '0 0 0 2px rgba(153, 205, 255, 0.3)',
      },
    },
    userButtonPopoverCard: {
      backgroundColor: 'rgba(18, 18, 18, 0.95)',
      backdropFilter: 'blur(24px)',
      border: '1px solid rgba(39, 39, 42, 0.5)',
    },
    userButtonPopoverActionButton: {
      color: '#EDEDED',
      '&:hover': {
        backgroundColor: 'rgba(153, 205, 255, 0.1)',
      },
    },

    // Avatar
    avatarBox: {
      border: '2px solid rgba(153, 205, 255, 0.3)',
    },

    // OTP Input
    otpCodeFieldInput: {
      backgroundColor: '#121212',
      border: '1px solid rgba(39, 39, 42, 0.5)',
      color: '#EDEDED',
      '&:focus': {
        borderColor: '#99CDFF',
        boxShadow: '0 0 0 2px rgba(153, 205, 255, 0.2)',
      },
    },

    // Alert/Error messages
    alert: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      color: '#EDEDED',
    },
    alertText: {
      color: '#EDEDED',
    },

    // Internal/menu links
    navbarButton: {
      color: '#A1A1AA',
      '&:hover': {
        backgroundColor: 'rgba(153, 205, 255, 0.1)',
        color: '#99CDFF',
      },
    },

    // Modal backdrop
    modalBackdrop: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(4px)',
    },

    // Profile page elements
    profileSectionTitle: {
      color: '#EDEDED',
    },
    profileSectionTitleText: {
      color: '#EDEDED',
    },
    profileSectionContent: {
      color: '#A1A1AA',
    },

    // Badge styling
    badge: {
      backgroundColor: 'rgba(153, 205, 255, 0.1)',
      color: '#99CDFF',
      border: '1px solid rgba(153, 205, 255, 0.3)',
    },
  },

  layout: {
    // Social buttons layout
    socialButtonsPlacement: 'top',
    socialButtonsVariant: 'blockButton',

    // Hide optional fields for cleaner Portal UX
    showOptionalFields: false,

    // Enable smooth animations
    animations: true,
  },
};

/** Light mode Clerk appearance */
const voraClerkAppearanceLight: Appearance = {
  variables: {
    colorPrimary: '#2563EB',
    colorPrimaryHover: '#1d4ed8',
    colorBackground: '#FFFFFF',
    colorInputBackground: '#F4F4F5',
    colorInputText: '#09090B',
    colorText: '#09090B',
    colorTextOnPrimaryBackground: '#FFFFFF',
    colorTextSecondary: '#71717A',
    colorDanger: '#dc2626',
    colorSuccess: '#16a34a',
    borderRadius: '0.75rem',
    fontFamily: 'Inter, system-ui, sans-serif',
  },

  elements: {
    rootBox: {
      width: '100%',
    },
    card: {
      backgroundColor: 'transparent',
      boxShadow: 'none',
      border: 'none',
    },
    headerTitle: {
      color: '#09090B',
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    headerSubtitle: {
      color: '#71717A',
    },
    socialButtonsBlockButton: {
      backgroundColor: 'transparent',
      border: '1px solid #E4E4E7',
      color: '#71717A',
      borderRadius: '0.75rem',
      transition: 'all 0.2s ease',
      '&:hover': {
        backgroundColor: '#F4F4F5',
        borderColor: '#D4D4D8',
        color: '#09090B',
      },
    },
    socialButtonsBlockButtonText: {
      color: '#71717A',
      '&:hover': {
        color: '#09090B',
      },
    },
    dividerLine: {
      backgroundColor: '#E4E4E7',
    },
    dividerText: {
      color: '#A1A1AA',
      fontSize: '0.875rem',
    },
    formFieldLabel: {
      color: '#09090B',
      fontWeight: 500,
    },
    formFieldInput: {
      backgroundColor: '#F4F4F5',
      border: '1px solid #E4E4E7',
      color: '#09090B',
      borderRadius: '0.75rem',
      padding: '0.875rem 1rem',
      fontSize: '1rem',
      transition: 'all 0.2s ease',
      '&:focus': {
        borderColor: '#2563EB',
        boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.15)',
        outline: 'none',
      },
      '&::placeholder': {
        color: '#A1A1AA',
      },
    },
    formFieldInputShowPasswordButton: {
      color: '#71717A',
      '&:hover': {
        color: '#2563EB',
      },
    },
    formButtonPrimary: {
      backgroundColor: '#2563EB',
      color: '#FFFFFF',
      fontWeight: 600,
      fontSize: '1rem',
      padding: '0.875rem 1.5rem',
      borderRadius: '0.75rem',
      transition: 'all 0.2s ease',
      '&:hover': {
        backgroundColor: '#1d4ed8',
        transform: 'scale(1.02)',
        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
      },
      '&:active': {
        transform: 'scale(0.98)',
      },
    },
    footerActionLink: {
      color: '#2563EB',
      fontWeight: 500,
      '&:hover': {
        color: '#1d4ed8',
      },
    },
    footerActionText: {
      color: '#A1A1AA',
    },
    identityPreview: {
      backgroundColor: '#F4F4F5',
      border: '1px solid #E4E4E7',
    },
    identityPreviewText: {
      color: '#09090B',
    },
    identityPreviewEditButton: {
      color: '#2563EB',
      '&:hover': {
        color: '#1d4ed8',
      },
    },
    userButtonBox: {
      '&:hover': {
        opacity: 0.9,
      },
    },
    userButtonTrigger: {
      '&:focus': {
        boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.2)',
      },
    },
    userButtonPopoverCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(24px)',
      border: '1px solid #E4E4E7',
    },
    userButtonPopoverActionButton: {
      color: '#09090B',
      '&:hover': {
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
      },
    },
    avatarBox: {
      border: '2px solid rgba(37, 99, 235, 0.3)',
    },
    otpCodeFieldInput: {
      backgroundColor: '#F4F4F5',
      border: '1px solid #E4E4E7',
      color: '#09090B',
      '&:focus': {
        borderColor: '#2563EB',
        boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.15)',
      },
    },
    alert: {
      backgroundColor: 'rgba(220, 38, 38, 0.05)',
      border: '1px solid rgba(220, 38, 38, 0.2)',
      color: '#09090B',
    },
    alertText: {
      color: '#09090B',
    },
    navbarButton: {
      color: '#71717A',
      '&:hover': {
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        color: '#2563EB',
      },
    },
    modalBackdrop: {
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(4px)',
    },
    profileSectionTitle: {
      color: '#09090B',
    },
    profileSectionTitleText: {
      color: '#09090B',
    },
    profileSectionContent: {
      color: '#71717A',
    },
    badge: {
      backgroundColor: 'rgba(37, 99, 235, 0.08)',
      color: '#2563EB',
      border: '1px solid rgba(37, 99, 235, 0.2)',
    },
  },

  layout: {
    socialButtonsPlacement: 'top',
    socialButtonsVariant: 'blockButton',
    showOptionalFields: false,
    animations: true,
  },
};

/**
 * Get the Clerk appearance for the given theme.
 * Use this in components that support theme switching (e.g., AuthPortal).
 */
export function getVoraClerkAppearance(theme: 'light' | 'dark'): Appearance {
  return theme === 'light' ? voraClerkAppearanceLight : voraClerkAppearance;
}

/**
 * Clerk localization configuration
 * Maps i18n locale codes to Clerk locale objects
 *
 * Available Clerk localizations (full locale codes):
 * ar-SA, de-DE, es-ES, fr-FR, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, tr-TR, zh-CN, id-ID, vi-VN
 */
export const getClerkLocalization = async (locale: string): Promise<Record<string, unknown> | undefined> => {
  // Map our short locale codes to Clerk's full locale codes
  const localeMap: Record<string, string> = {
    en: 'en-US',
    de: 'de-DE',
    fr: 'fr-FR',
    es: 'es-ES',
    pt: 'pt-BR',
    it: 'it-IT',
    ru: 'ru-RU',
    zh: 'zh-CN',
    ja: 'ja-JP',
    ar: 'ar-SA',
    tr: 'tr-TR',
    id: 'id-ID',
    vi: 'vi-VN',
    // Serbian and Hindi don't have Clerk support - fallback to English
    sr: 'en-US',
    hi: 'en-US',
  };

  const clerkLocale = localeMap[locale] || 'en-US';

  // English is default, no need to load
  if (clerkLocale === 'en-US') {
    return undefined;
  }

  try {
    // Dynamic import using the full locale code
    // @vite-ignore - dynamic import is intentional for code splitting locales
    const module = await import(/* @vite-ignore */ `@clerk/localizations/${clerkLocale}`);
    return module.default;
  } catch (error) {
    console.warn(`Clerk localization not found for ${clerkLocale}, falling back to English`);
    return undefined;
  }
};
