import React from 'react';
import { Scale, ArrowLeftRight, X, Sparkles } from 'lucide-react';
import { Product } from '../types';
import { triggerHaptic } from '../utils/telegramWebApp';

interface CompareFloatingBarProps {
  compareItems: Product[];
  onOpenCompare: () => void;
  onClearCompare: () => void;
}

export const CompareFloatingBar: React.FC<CompareFloatingBarProps> = ({
  compareItems,
  onOpenCompare,
  onClearCompare,
}) => {
  if (compareItems.length === 0) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[calc(100%-2rem)] animate-in fade-in slide-in-from-bottom duration-300">
      <div className="bg-[#12141f]/95 backdrop-blur-xl border-2 border-red-500/70 rounded-2xl p-2.5 sm:p-3 shadow-2xl shadow-black/80 flex items-center justify-between gap-3 glow-red">
        
        {/* Left Thumbnails & Counter */}
        <div 
          onClick={() => {
            triggerHaptic('light');
            onOpenCompare();
          }}
          className="flex items-center gap-2.5 cursor-pointer min-w-0"
        >
          <div className="flex -space-x-2 shrink-0">
            {compareItems.map((item, idx) => (
              <img
                key={item.id}
                src={item.image}
                alt={item.name}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border-2 border-zinc-900 bg-black shadow-md"
                style={{ zIndex: 10 - idx }}
              />
            ))}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-racing font-bold text-xs sm:text-sm text-white">
                Taqqoslash ({compareItems.length} ta)
              </span>
              {compareItems.length >= 2 && (
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
              )}
            </div>
            <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate">
              {compareItems.length === 1 
                ? "Yana bitta detal qo‘shing" 
                : compareItems.map(c => c.bazaarName).join(' vs ')}
            </div>
          </div>
        </div>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onOpenCompare();
            }}
            className="py-2 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-red-650 via-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-racing font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-red-900/40 active:scale-95 transition"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Solishtirish</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic('light');
              onClearCompare();
            }}
            className="p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
            title="Taqqoslashni tozalash"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
