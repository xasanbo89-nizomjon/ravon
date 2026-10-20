import React from 'react';
import { ShoppingBag, Search, Sparkles, Phone, MapPin, Gauge, Menu, X, Shield, Lock, Clock, Navigation, MessageCircle, ChevronRight, ExternalLink, Receipt, Scale, Ticket } from 'lucide-react';
import { formatUzbekSum } from '../utils/formatters';
import { SiteSettings, AnnouncementBanner, AppliedPromo } from '../types';
import { isTelegramWebApp, triggerHaptic } from '../utils/telegramWebApp';

interface NavbarProps {
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  onScrollToAi: () => void;
  onScrollToCatalog: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  siteSettings: SiteSettings;
  announcementBanner: AnnouncementBanner;
  onOpenAdminLogin: () => void;
  onOpenMyOrders?: () => void;
  myOrdersCount?: number;
  onOpenCompare?: () => void;
  compareCount?: number;
  onOpenPromo?: () => void;
  appliedPromo?: AppliedPromo | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  cartCount,
  cartTotal,
  onOpenCart,
  onScrollToAi,
  onScrollToCatalog,
  searchQuery,
  setSearchQuery,
  siteSettings,
  announcementBanner,
  onOpenAdminLogin,
  onOpenMyOrders,
  myOrdersCount = 0,
  onOpenCompare,
  compareCount = 0,
  onOpenPromo,
  appliedPromo = null,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const isTg = isTelegramWebApp();

  // Telefon raqamiga 2 soniya (Long Press) bosib turganda maxfiy admin panelni ochish
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isLongPressedRef = React.useRef(false);

  const triggerSecretAdmin = () => {
    triggerHaptic('heavy');

    const isAlreadyAuthorized = () => {
      try {
        return sessionStorage.getItem('ravon_admin_authorized') === 'true' ||
               sessionStorage.getItem('ravon_admin_logged') === 'true';
      } catch (e) {
        return false;
      }
    };

    if (isAlreadyAuthorized()) {
      window.dispatchEvent(new CustomEvent('open-ravon-admin', { detail: { code: '0606' } }));
      if (typeof (window as any).__openRavonAdminPanel === 'function') {
        (window as any).__openRavonAdminPanel();
      }
      return;
    }

    // Parol so'rovchi chiroyli React Modal oynasini ochish (brauzer prompt umuman ishlatilmaydi)
    window.dispatchEvent(new CustomEvent('open-ravon-pin-modal'));
    if (typeof (window as any).__openSecretPinModal === 'function') {
      (window as any).__openSecretPinModal();
    }
  };

  // Ketma-ket 3 marta tez bosishni (Triple Click / Tap) tekshiruvchi
  const clickCountRef = React.useRef(0);
  const lastClickTimeRef = React.useRef(0);

  const handleSecretClick = () => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 650) {
      clickCountRef.current++;
    } else {
      clickCountRef.current = 1;
    }
    lastClickTimeRef.current = now;

    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      triggerSecretAdmin();
    }
  };

  const handlePhoneTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    isLongPressedRef.current = false;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    touchStartPos.current = { x: clientX, y: clientY };

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressedRef.current = true;
      triggerSecretAdmin();
    }, 2000);
  };

  const handlePhoneTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!longPressTimerRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    if (
      Math.abs(clientX - touchStartPos.current.x) > 15 ||
      Math.abs(clientY - touchStartPos.current.y) > 15
    ) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePhoneTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressedRef.current) {
      e.preventDefault();
      isLongPressedRef.current = false;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#08090d]/90 backdrop-blur-md border-b border-zinc-800/80">
      
      {/* 1. Dynamic Announcement & Promo Banner (if enabled) */}
      {announcementBanner.enabled && (
        <div className="bg-gradient-to-r from-red-650 via-red-600 to-amber-600 text-white text-xs py-1.5 px-4 font-racing font-semibold shadow-inner">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 truncate">
              {announcementBanner.badgeText && (
                <span className="px-2 py-0.5 rounded-full bg-black/40 text-[10px] uppercase font-bold tracking-wider shrink-0">
                  {announcementBanner.badgeText}
                </span>
              )}
              <span className="truncate">{announcementBanner.text}</span>
            </div>

            {announcementBanner.linkText && (
              <a 
                href={announcementBanner.linkUrl || '#katalog'}
                className="text-white hover:text-amber-200 underline text-[11px] font-bold shrink-0 transition"
              >
                {announcementBanner.linkText} →
              </a>
            )}
          </div>
        </div>
      )}

      {/* 2. Top Info & Contacts Bar (Hidden in Telegram WebApp for native compactness) */}
      {!isTg && (
        <div className="bg-gradient-to-r from-red-950 via-zinc-950 to-red-950 border-b border-red-900/30 text-xs py-1.5 px-4 text-zinc-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-red-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                O‘zbekiston bo‘ylab tezkor yetkazib berish
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-zinc-400">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                {siteSettings.addressBazaar}, {siteSettings.addressDetails}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <a 
                href={`tel:${siteSettings.phonePrimary.replace(/\D/g, '')}`} 
                onClick={handleSecretClick}
                className="flex items-center gap-1.5 text-zinc-200 hover:text-red-400 transition select-none cursor-pointer"
                data-phone-admin="true"
                data-phone-primary="true"
                title={siteSettings.phonePrimary}
                onTouchStart={handlePhoneTouchStart}
                onTouchMove={handlePhoneTouchMove}
                onTouchEnd={handlePhoneTouchEnd}
                onTouchCancel={handlePhoneTouchEnd}
                onMouseDown={handlePhoneTouchStart}
                onMouseMove={handlePhoneTouchMove}
                onMouseUp={handlePhoneTouchEnd}
              >
                <Phone className="w-3 h-3 text-red-500" />
                <span className="font-semibold">{siteSettings.phonePrimary}</span>
              </a>
              <span className="hidden sm:inline text-zinc-600">|</span>
              <span className="hidden sm:inline text-zinc-400">{siteSettings.workingHours}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand Logo - Secret Admin Trigger on Triple Click or 2s Long Press */}
        <div 
          onClick={(e) => {
            onScrollToCatalog();
            handleSecretClick();
          }}
          onTouchStart={handlePhoneTouchStart}
          onTouchMove={handlePhoneTouchMove}
          onTouchEnd={handlePhoneTouchEnd}
          onTouchCancel={handlePhoneTouchEnd}
          onMouseDown={handlePhoneTouchStart}
          onMouseMove={handlePhoneTouchMove}
          onMouseUp={handlePhoneTouchEnd}
          data-logo-admin="true"
          className="flex items-center gap-3 cursor-pointer group select-none"
          title="RAVON AUTO"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center border border-red-500/50 shadow-lg shadow-red-900/30 group-hover:scale-105 transition-transform">
            <Gauge className="w-6 h-6 text-white group-hover:rotate-12 transition-transform duration-300" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-racing text-2xl font-black italic tracking-wider text-white">
                {siteSettings.brandLogoWord1}
              </span>
              <span className="font-racing text-2xl font-black italic tracking-wider text-red-500">
                {siteSettings.brandLogoWord2}
              </span>
            </div>
            <div className="text-[10px] uppercase font-bold tracking-[0.25em] text-zinc-400 -mt-1">
              Tuning & Ehtiyot Qismlar
            </div>
          </div>
        </div>

        {/* Center Search on Desktop */}
        <div className="hidden lg:flex items-center gap-6">
          <div className="relative w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zapchast, mashina nomi (Gentra, Optra...)"
              className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-xl px-4 py-2 pl-10 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
            />
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          <nav className="flex items-center gap-1 font-medium text-sm">
            <button
              onClick={onScrollToCatalog}
              className="px-3.5 py-2 text-zinc-300 hover:text-white hover:bg-zinc-850 rounded-lg transition"
            >
              Katalog
            </button>
            <button
              onClick={onScrollToAi}
              className="px-3.5 py-2 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition flex items-center gap-1.5 font-semibold"
            >
              <Sparkles className="w-4 h-4 animate-pulse text-red-500" />
              AI Rasm Qidiruv
            </button>
          </nav>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-3">
          {/* Quick AI Search Button for Mobile */}
          <button
            onClick={onScrollToAi}
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800/60 text-red-400 text-xs font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            <span>AI Qidiruv</span>
          </button>

          {/* Cheklarim (Personal Receipts & Orders) Button */}
          {onOpenMyOrders && (
            <button
              onClick={() => {
                triggerHaptic('light');
                onOpenMyOrders();
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-750 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white transition group relative"
              title="Shaxsiy buyurtmalarim va elektron cheklarim"
            >
              <Receipt className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="font-semibold">Cheklarim</span>
              {myOrdersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-black flex items-center justify-center">
                  {myOrdersCount}
                </span>
              )}
            </button>
          )}

          {/* Taqqoslash (Compare) Button */}
          {onOpenCompare && (
            <button
              onClick={() => {
                triggerHaptic('light');
                onOpenCompare();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-750 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white transition group relative"
              title="Avtomobil qismlarini taqqoslash"
            >
              <Scale className={`w-4 h-4 ${compareCount > 0 ? 'text-red-500' : 'text-zinc-400'} group-hover:scale-110 transition-transform`} />
              <span className="hidden sm:inline font-semibold">Taqqoslash</span>
              {compareCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center shadow">
                  {compareCount}
                </span>
              )}
            </button>
          )}

          {/* Promokod Faollashtirish Button */}
          {onOpenPromo && (
            <button
              onClick={() => {
                triggerHaptic('light');
                onOpenPromo();
              }}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition group relative ${
                appliedPromo
                  ? 'bg-green-950/60 border-green-700/80 text-green-300 hover:text-white'
                  : 'bg-zinc-900/90 hover:bg-zinc-800 border-zinc-750 hover:border-zinc-700 text-zinc-300 hover:text-white'
              }`}
              title="Promokodni kiritish va chegirma olish"
            >
              <Ticket className={`w-4 h-4 ${appliedPromo ? 'text-green-400' : 'text-red-400'} group-hover:scale-110 transition-transform`} />
              <span>{appliedPromo ? `${appliedPromo.code}` : "Promokod"}</span>
              {appliedPromo && (
                <span className="px-1.5 py-0.2 rounded bg-green-500 text-black text-[9px] font-black uppercase">
                  {appliedPromo.discountType === 'percent' ? `-${appliedPromo.discountValue}%` : 'Faol'}
                </span>
              )}
            </button>
          )}

          {/* Cart Button */}
          <button
            onClick={onOpenCart}
            className="relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-medium shadow-lg shadow-red-600/25 active:scale-95 transition-all"
            aria-label="Savat"
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-white text-red-600 text-xs font-black flex items-center justify-center shadow-md animate-bounce">
                  {cartCount}
                </span>
              )}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-[11px] leading-none text-red-100 font-semibold uppercase tracking-wider">
                Savat
              </span>
              <span className="text-xs font-bold leading-tight">
                {cartTotal > 0 ? formatUzbekSum(cartTotal) : "0 so'm"}
              </span>
            </div>
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation (Prompt 4 requirement: Menyuni bosganda chiqadigan yon menyu Drawer) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 right-0 w-[85%] max-w-sm bg-[#0c0e14] border-l border-zinc-800 p-5 flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-right duration-300 overflow-y-auto">
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center border border-red-500/50 shadow-md">
                    <Gauge className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1 font-racing text-lg font-black italic tracking-wider">
                      <span className="text-white">{siteSettings.brandLogoWord1}</span>
                      <span className="text-red-500">{siteSettings.brandLogoWord2}</span>
                    </div>
                    <div className="text-[9px] uppercase font-bold tracking-[0.2em] text-zinc-400 -mt-1">
                      Mobil Menyu
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
                  aria-label="Yopish"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search in Drawer */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Zapchast, mashina nomi..."
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-2.5 pl-10 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500"
                />
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Primary Navigation Cards */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-1">
                  Bo‘limlar
                </div>

                <button
                  onClick={() => {
                    triggerHaptic('light');
                    onScrollToAi();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-red-950/80 via-zinc-900 to-zinc-900 border border-red-800/60 hover:border-red-600 flex items-center justify-between group transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                      <Sparkles className="w-5 h-5 text-red-500 animate-pulse" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-red-400 transition">
                        AI Rasm orqali Qidiruv
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Kameradan rasmga olib topish
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-red-400 group-hover:translate-x-0.5 transition" />
                </button>

                <button
                  onClick={() => {
                    triggerHaptic('light');
                    onScrollToCatalog();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between group transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300">
                      <Gauge className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-zinc-200 transition">
                        Barcha Zapchastlar
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Katalog va tyuning detallar
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:translate-x-0.5 transition" />
                </button>

                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setMobileMenuOpen(false);
                    onOpenCart();
                  }}
                  className="w-full p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between group transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
                      <ShoppingBag className="w-5 h-5" />
                      {cartCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">
                          {cartCount}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-zinc-200 transition">
                        Savatcha
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {cartTotal > 0 ? formatUzbekSum(cartTotal) : "Hozircha bo‘sh"}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:translate-x-0.5 transition" />
                </button>

                {onOpenMyOrders && (
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setMobileMenuOpen(false);
                      onOpenMyOrders();
                    }}
                    className="w-full p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between group transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 rounded-xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                        <Receipt className="w-5 h-5" />
                        {myOrdersCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-black flex items-center justify-center">
                            {myOrdersCount}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white group-hover:text-zinc-200 transition">
                          Mening Cheklarim
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {myOrdersCount > 0 ? `${myOrdersCount} ta shaxsiy chek` : "Shaxsiy xaridlarim"}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:translate-x-0.5 transition" />
                  </button>
                )}
                {onOpenCompare && (
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setMobileMenuOpen(false);
                      onOpenCompare();
                    }}
                    className="w-full p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between group transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
                        <Scale className="w-5 h-5" />
                        {compareCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">
                            {compareCount}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white group-hover:text-zinc-200 transition">
                          Taqqoslash
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {compareCount > 0 ? `${compareCount} ta detal solishtirilmoqda` : "Qismlarni yonma-yon solishtirish"}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:translate-x-0.5 transition" />
                  </button>
                )}

                {onOpenPromo && (
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setMobileMenuOpen(false);
                      onOpenPromo();
                    }}
                    className="w-full p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between group transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center border ${
                        appliedPromo
                          ? 'bg-green-600/20 border-green-500/40 text-green-400'
                          : 'bg-red-600/20 border-red-500/40 text-red-400'
                      }`}>
                        <Ticket className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white group-hover:text-zinc-200 transition">
                          Promokod faollashtirish
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {appliedPromo
                            ? `Faol chegirma: ${appliedPromo.code} (${appliedPromo.discountType === 'percent' ? `-${appliedPromo.discountValue}%` : 'Naqd'})`
                            : "Chegirma kodini kiritish va tejang"}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:translate-x-0.5 transition" />
                  </button>
                )}
              </div>

              {/* Contact and Location Info */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-1">
                  Bog‘lanish & Manzil
                </div>

                <a
                  href={`tel:${siteSettings.phonePrimary.replace(/\D/g, '')}`}
                  onClick={handleSecretClick}
                  className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-3 text-zinc-200 hover:text-white transition select-none cursor-pointer"
                  data-phone-admin="true"
                  data-phone-primary="true"
                  onTouchStart={handlePhoneTouchStart}
                  onTouchMove={handlePhoneTouchMove}
                  onTouchEnd={handlePhoneTouchEnd}
                  onTouchCancel={handlePhoneTouchEnd}
                  onMouseDown={handlePhoneTouchStart}
                  onMouseMove={handlePhoneTouchMove}
                  onMouseUp={handlePhoneTouchEnd}
                >
                  <div className="w-8 h-8 rounded-lg bg-green-950/60 border border-green-800/50 flex items-center justify-center text-green-400 shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{siteSettings.phonePrimary}</div>
                    <div className="text-[10px] text-zinc-400">Qo‘ng‘iroq qilish</div>
                  </div>
                </a>

                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-start gap-3 text-zinc-300">
                  <div className="w-8 h-8 rounded-lg bg-red-950/60 border border-red-800/50 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 text-xs">
                    <div className="font-semibold text-white">{siteSettings.addressBazaar}</div>
                    <div className="text-zinc-400 text-[11px]">{siteSettings.addressDetails}</div>
                    {siteSettings.mapLocationUrl && (
                      <a 
                        href={siteSettings.mapLocationUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:underline mt-1 font-medium"
                      >
                        <Navigation className="w-3 h-3" />
                        Xaritada ko‘rish
                      </a>
                    )}
                  </div>
                </div>

                <div className="px-1 text-[11px] text-zinc-400 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>{siteSettings.workingHours}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
