/**
 * Telegram WebApp & Mini App utilities
 * Enables seamless integration when opened inside Telegram WebApp
 */

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        isExpanded?: boolean;
        viewportHeight?: number;
        viewportStableHeight?: number;
        headerColor?: string;
        backgroundColor?: string;
        colorScheme?: 'light' | 'dark';
        themeParams?: Record<string, string>;
        initData?: string;
        initDataUnsafe?: {
          user?: {
            id?: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
          query_id?: string;
        };
        platform?: string;
        MainButton?: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
        };
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  const tg = window.Telegram?.WebApp;
  return Boolean(
    tg && (
      (tg.initData && tg.initData.length > 0) ||
      (tg.platform && tg.platform !== 'unknown') ||
      window.location.search.includes('tgWebAppPlatform') ||
      window.location.hash.includes('tgWebAppData')
    )
  );
}

export function initTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor('#08090d');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#08090d');
      return true;
    }
  } catch (e) {
    console.debug('Telegram WebApp init ignored', e);
  }
  return false;
}

export function triggerHaptic(style: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') {
  try {
    const haptic = window.Telegram?.WebApp?.HapticFeedback;
    if (haptic) {
      if (style === 'success' || style === 'error' || style === 'warning') {
        haptic.notificationOccurred(style);
      } else {
        haptic.impactOccurred(style);
      }
    }
  } catch {
    // Ignore if not in Telegram
  }
}

export interface TelegramUserInfo {
  id?: number;
  firstName?: string;
  lastName?: string;
  username?: string;
}

export function getTelegramUser(): TelegramUserInfo | null {
  if (typeof window === 'undefined') return null;
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (!user || (!user.first_name && !user.id)) return null;
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
  };
}
