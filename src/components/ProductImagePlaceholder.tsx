import React from 'react';
import { Camera, Car, Sparkles } from 'lucide-react';

/**
 * Legacy default fallback URL that was previously assigned to CSV-imported items without a photo.
 */
export const LEGACY_CSV_PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=600&q=70';

/**
 * Determines whether a product has a real uploaded/linked photo
 * vs. being empty or using a temporary placeholder after Excel/CSV import.
 */
export function hasRealProductImage(image?: string | null): boolean {
  if (!image || typeof image !== 'string') return false;
  const trimmed = image.trim();
  if (!trimmed) return false;
  if (trimmed === 'placeholder' || trimmed === '[Yuklangan rasm (Base64)]') return false;
  if (trimmed === LEGACY_CSV_PLACEHOLDER_IMAGE) return false;
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/')
  );
}

interface ProductImagePlaceholderProps {
  name: string;
  category?: string;
  sku?: string;
  brand?: string;
  variant?: 'card' | 'modal' | 'thumb';
  className?: string;
}

/**
 * Branded "Ravon Auto Tuning" Black & Red Temporary Card ("Tez kunda rasm joylanadi")
 * displayed when a product imported via Excel/CSV does not yet have a photo.
 */
export const ProductImagePlaceholder: React.FC<ProductImagePlaceholderProps> = ({
  name,
  category = 'Ehtiyot qism',
  sku,
  brand,
  variant = 'card',
  className = '',
}) => {
  if (variant === 'thumb') {
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-[#140709] via-[#0b0d13] to-[#1a080b] border border-red-900/50 flex flex-col items-center justify-center text-center p-1 select-none ${className}`}
      >
        <div className="w-4 h-4 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 mb-0.5">
          <Camera className="w-2.5 h-2.5" />
        </div>
        <span className="font-racing text-[7px] font-bold uppercase tracking-wider text-red-400 leading-tight line-clamp-1">
          Tez kunda
        </span>
      </div>
    );
  }

  const isModal = variant === 'modal';

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#16070a] via-[#0b0c12] to-[#1d080c] flex flex-col items-center justify-between p-3 sm:p-5 text-center select-none ${className}`}
    >
      {/* Subtle Racing Carbon / Diagonal Red Glow Accents */}
      <div className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full bg-red-600/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-red-700/15 blur-2xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'radial-gradient(circle at 2px 2px, rgba(239,68,68,0.35) 1px, transparent 0)',
          backgroundSize: '14px 14px',
        }}
      />
      {/* Top Racing Stripe */}
      <div className="pointer-events-none absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-80" />

      {/* Top Brand Header */}
      <div className="relative z-10 w-full flex items-center justify-center gap-1.5 pt-1">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-950/80 border border-red-700/50 text-[9px] sm:text-[10px] font-racing font-bold uppercase tracking-widest text-red-300 shadow-sm">
          <Car className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-500 shrink-0" />
          <span>RAVON AUTO TUNING</span>
        </span>
      </div>

      {/* Center Product Info (Category + Product Name + SKU) */}
      <div className="relative z-10 my-auto px-1 sm:px-2 flex flex-col items-center justify-center space-y-1.5 max-w-full">
        <div className="flex flex-wrap items-center justify-center gap-1">
          {category && (
            <span className="px-2 py-0.5 rounded bg-zinc-900/90 border border-zinc-700/80 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-400 truncate max-w-[140px] sm:max-w-[200px]">
              {category}
            </span>
          )}
          {sku && (
            <span className="px-1.5 py-0.5 rounded bg-black/80 border border-zinc-800 text-[9px] sm:text-[10px] font-mono text-zinc-300 truncate max-w-[120px]">
              {sku}
            </span>
          )}
        </div>

        <h4
          className={`font-racing font-bold text-white leading-snug line-clamp-2 sm:line-clamp-3 break-words ${
            isModal ? 'text-sm sm:text-lg max-w-md' : 'text-[11px] sm:text-sm max-w-[220px]'
          }`}
        >
          {name}
        </h4>

        {brand && isModal && (
          <span className="text-[10px] sm:text-xs text-zinc-400 font-medium">{brand}</span>
        )}
      </div>

      {/* Bottom "Tez kunda rasm joylanadi" Badge */}
      <div className="relative z-10 w-full flex items-center justify-center pb-5 sm:pb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-red-600/25 via-red-900/40 to-red-600/25 border border-red-500/50 text-red-200 shadow-lg shadow-red-950/60">
          <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-400 shrink-0 animate-pulse" />
          <span className="font-racing text-[9px] sm:text-[11px] font-bold uppercase tracking-wider">
            Tez kunda rasm joylanadi
          </span>
          <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0 hidden sm:inline" />
        </div>
      </div>
    </div>
  );
};
