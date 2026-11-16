import React, { useState } from 'react';
import { Home, ShoppingBag, Sparkles, Search, PhoneCall } from 'lucide-react';
import { triggerHaptic } from '../utils/telegramWebApp';

interface MobileBottomBarProps {
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  onScrollToHome?: () => void;
  onScrollToAi: () => void;
  onScrollToCatalog: () => void;
  onScrollToContact?: () => void;
  primaryPhone: string;
  compareCount?: number;
  onOpenCompare?: () => void;
  isCartOpen?: boolean;
  isHidden?: boolean;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  cartCount,
  onOpenCart,
  onScrollToHome,
  onScrollToAi,
  onScrollToCatalog,
  onScrollToContact,
  primaryPhone,
  isCartOpen = false,
  isHidden = false,
}) => {
  const [activeNav, setActiveNav] = useState<'home' | 'catalog' | 'cart' | 'ai' | 'contact'>('home');

  const handleHomeClick = () => {
    triggerHaptic('light');
    setActiveNav('home');
    if (onScrollToHome) {
      onScrollToHome();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCatalogClick = () => {
    triggerHaptic('light');
    setActiveNav('catalog');
    onScrollToCatalog();
    setTimeout(() => {
      const searchInput = document.getElementById('catalog-search-input') as HTMLInputElement | null;
      if (searchInput && window.innerWidth >= 640) {
        searchInput.focus();
      }
    }, 350);
  };

  const handleCartClick = () => {
    triggerHaptic('medium');
    setActiveNav('cart');
    onOpenCart();
  };

  const handleAiClick = () => {
    triggerHaptic('light');
    setActiveNav('ai');
    onScrollToAi();
  };

  const handleContactClick = () => {
    triggerHaptic('light');
    setActiveNav('contact');
    if (onScrollToContact) {
      onScrollToContact();
    } else {
      const footerEl = document.getElementById('aloqa');
      if (footerEl) {
        footerEl.scrollIntoView({ behavior: 'smooth' });
      } else if (primaryPhone) {
        window.location.href = `tel:+${primaryPhone.replace(/\D/g, '')}`;
      }
    }
  };

  return (
    <nav
      aria-label="Pastki mobil menyu"
      className={`${
        isCartOpen || isHidden ? 'hidden' : 'lg:hidden'
      } fixed bottom-0 left-0 right-0 z-40 bg-[#090b10]/98 border-t border-zinc-800/95 shadow-[0_-6px_20px_rgba(0,0,0,0.75)] px-1.5 pt-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))]`}
    >
      <div className="max-w-md mx-auto grid grid-cols-5 items-center gap-0.5">
        {/* 1. Bosh sahifa */}
        <button
          type="button"
          onClick={handleHomeClick}
          className={`min-h-[46px] flex flex-col items-center justify-center rounded-xl py-1 px-1 transition-transform active:scale-95 ${
            activeNav === 'home' ? 'text-red-500' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5 tracking-tight truncate max-w-full">
            Bosh sahifa
          </span>
        </button>

        {/* 2. Katalog / Qidiruv */}
        <button
          type="button"
          onClick={handleCatalogClick}
          className={`min-h-[46px] flex flex-col items-center justify-center rounded-xl py-1 px-1 transition-transform active:scale-95 ${
            activeNav === 'catalog' ? 'text-red-500' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5 tracking-tight truncate max-w-full">
            Katalog
          </span>
        </button>

        {/* 3. Savat (ichidagi soni bilan) */}
        <button
          type="button"
          onClick={handleCartClick}
          className="min-h-[46px] flex flex-col items-center justify-center rounded-xl py-1 px-1 transition-transform active:scale-95 relative"
        >
          <div
            className={`relative flex items-center justify-center w-9 h-7 rounded-xl transition-colors ${
              cartCount > 0
                ? 'bg-red-600 text-white shadow-md shadow-red-900/50'
                : activeNav === 'cart'
                ? 'text-red-500'
                : 'text-zinc-300'
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-red-600 border border-red-600 text-[10px] font-black flex items-center justify-center shadow">
                {cartCount}
              </span>
            )}
          </div>
          <span
            className={`text-[10px] font-bold mt-0.5 tracking-tight truncate max-w-full ${
              cartCount > 0 || activeNav === 'cart' ? 'text-red-400' : 'text-zinc-400'
            }`}
          >
            {cartCount > 0 ? `Savat (${cartCount})` : 'Savat'}
          </span>
        </button>

        {/* 4. AI Yordamchi */}
        <button
          type="button"
          onClick={handleAiClick}
          className={`min-h-[46px] flex flex-col items-center justify-center rounded-xl py-1 px-1 transition-transform active:scale-95 ${
            activeNav === 'ai' ? 'text-red-500' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sparkles className="w-5 h-5 text-red-500" />
          <span className="text-[10px] font-bold mt-0.5 tracking-tight text-red-400 truncate max-w-full">
            AI Yordamchi
          </span>
        </button>

        {/* 5. Aloqa */}
        <button
          type="button"
          onClick={handleContactClick}
          className={`min-h-[46px] flex flex-col items-center justify-center rounded-xl py-1 px-1 transition-transform active:scale-95 ${
            activeNav === 'contact' ? 'text-red-500' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <PhoneCall className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5 tracking-tight truncate max-w-full">
            Aloqa
          </span>
        </button>
      </div>
    </nav>
  );
};

