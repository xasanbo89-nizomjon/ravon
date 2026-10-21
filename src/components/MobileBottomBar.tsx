import React from 'react';
import { ShoppingBag, Sparkles, LayoutGrid, Scale } from 'lucide-react';
import { formatUzbekSum } from '../utils/formatters';
import { triggerHaptic } from '../utils/telegramWebApp';

interface MobileBottomBarProps {
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  onScrollToAi: () => void;
  onScrollToCatalog: () => void;
  primaryPhone: string;
  compareCount?: number;
  onOpenCompare?: () => void;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  cartCount,
  cartTotal,
  onOpenCart,
  onScrollToAi,
  onScrollToCatalog,
  compareCount = 0,
  onOpenCompare,
}) => {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090b10]/95 backdrop-blur-xl border-t border-zinc-800/90 shadow-[0_-10px_25px_rgba(0,0,0,0.8)] px-3.5 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* AI Camera Search Quick Button */}
          <button
            onClick={() => {
              triggerHaptic('light');
              onScrollToAi();
            }}
            className="shrink-0 flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl text-zinc-400 hover:text-red-400 active:scale-95 transition"
            aria-label="AI Qidiruv"
          >
            <Sparkles className="w-5 h-5 text-red-500 animate-pulse" />
            <span className="text-[10px] font-bold mt-1 tracking-tight text-red-400 whitespace-nowrap">AI Kamera</span>
          </button>

          {/* Catalog Quick Button */}
          <button
            onClick={() => {
              triggerHaptic('light');
              onScrollToCatalog();
            }}
            className="shrink-0 flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl text-zinc-400 hover:text-white active:scale-95 transition"
            aria-label="Katalog"
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-1 tracking-tight text-zinc-300 whitespace-nowrap">Katalog</span>
          </button>

          {/* Compare Quick Button */}
          {onOpenCompare && (
            <button
              onClick={() => {
                triggerHaptic('light');
                onOpenCompare();
              }}
              className="shrink-0 flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl text-zinc-400 hover:text-white active:scale-95 transition relative"
              aria-label="Taqqoslash"
            >
              <div className="relative">
                <Scale className={`w-5 h-5 ${compareCount > 0 ? 'text-red-500' : 'text-zinc-400'}`} />
                {compareCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center shadow">
                    {compareCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-semibold mt-1 tracking-tight whitespace-nowrap ${compareCount > 0 ? 'text-red-400 font-bold' : 'text-zinc-300'}`}>
                Taqqoslash
              </span>
            </button>
          )}
        </div>

        {/* Compact Non-Stretching Right-Aligned Cart Button on Mobile */}
        <button
          onClick={() => {
            triggerHaptic('medium');
            onOpenCart();
          }}
          className="ml-auto shrink-0 w-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-red-650 via-red-600 to-red-700 text-white font-racing font-bold shadow-lg shadow-red-900/50 active:scale-95 transition group"
          aria-label="Savatcha"
        >
          <div className="relative flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-red-600 text-[10px] font-black flex items-center justify-center shadow-md">
                {cartCount}
              </span>
            )}
          </div>
          <div className="flex flex-col text-left whitespace-nowrap">
            <span className="text-[10px] uppercase tracking-wider text-red-100 font-sans font-bold leading-none">
              {cartCount > 0 ? `${cartCount} ta tovar` : 'Savatcha'}
            </span>
            <span className="text-xs font-racing font-black tracking-wide leading-tight">
              {cartTotal > 0 ? formatUzbekSum(cartTotal) : "0 so'm"}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};
