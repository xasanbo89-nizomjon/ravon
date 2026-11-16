import React, { useState } from 'react';
import { 
  X, 
  Tag, 
  Ticket, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Copy, 
  Check, 
  ArrowRight,
  TrendingDown,
  ShoppingBag,
  Percent,
  Coins
} from 'lucide-react';
import { PromoCode, AppliedPromo } from '../types';
import { formatUzbekSum } from '../utils/formatters';
import { triggerHaptic } from '../utils/telegramWebApp';

interface PromoCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  promoCodes: PromoCode[];
  appliedPromo: AppliedPromo | null;
  onApplyPromo: (promo: AppliedPromo) => void;
  onRemovePromo: () => void;
  cartSubtotal: number;
  onOpenCart: () => void;
}

export const PromoCodeModal: React.FC<PromoCodeModalProps> = ({
  isOpen,
  onClose,
  promoCodes,
  appliedPromo,
  onApplyPromo,
  onRemovePromo,
  cartSubtotal,
  onOpenCart,
}) => {
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  // Active public promo codes for fast 1-click apply
  const activePromoCodes = promoCodes.filter((p) => p.isActive);

  const calculateDiscount = (promo: PromoCode, subtotal: number): number => {
    if (promo.discountType === 'percent') {
      const discount = Math.round((subtotal * promo.discountValue) / 100);
      if (promo.maxDiscountAmount && promo.maxDiscountAmount > 0) {
        return Math.min(discount, promo.maxDiscountAmount);
      }
      return discount;
    } else {
      // Fixed discount
      return Math.min(promo.discountValue, subtotal > 0 ? subtotal : promo.discountValue);
    }
  };

  const handleValidateAndApply = (codeToApply?: string) => {
    const rawCode = (codeToApply || inputCode).trim().toUpperCase();
    setError(null);
    setSuccess(null);

    if (!rawCode) {
      setError("Iltimos, promokodni kiriting.");
      triggerHaptic('error');
      return;
    }

    // Check in database
    const matched = promoCodes.find(
      (p) => p.code.trim().toUpperCase() === rawCode
    );

    if (!matched) {
      setError(`"${rawCode}" promokodi topilmadi. Iltimos, kod to‘g‘riligini tekshiring.`);
      triggerHaptic('error');
      return;
    }

    if (!matched.isActive) {
      setError(`"${matched.code}" promokodining amal qilish muddati tugagan yoki administrator tomonidan to‘xtatilgan.`);
      triggerHaptic('error');
      return;
    }

    // Expiration date check
    if (matched.expiresAt) {
      const exp = new Date(matched.expiresAt).getTime();
      if (Date.now() > exp) {
        setError(`"${matched.code}" promokodining muddati o‘tib ketgan.`);
        triggerHaptic('error');
        return;
      }
    }

    // Max uses check
    if (matched.maxUses && matched.maxUses > 0 && matched.usageCount >= matched.maxUses) {
      setError(`"${matched.code}" promokodidan foydalanish chegarasi (limiti) tugagan.`);
      triggerHaptic('error');
      return;
    }

    // Minimum order amount check
    if (matched.minOrderAmount && matched.minOrderAmount > 0 && cartSubtotal > 0 && cartSubtotal < matched.minOrderAmount) {
      setError(`"${matched.code}" promokodi kamida ${formatUzbekSum(matched.minOrderAmount)} qiymatidagi buyurtmalar uchun amal qiladi. Hozirgi savat: ${formatUzbekSum(cartSubtotal)}.`);
      triggerHaptic('error');
      return;
    }

    // Successful match
    const discountAmount = calculateDiscount(matched, cartSubtotal);

    const newApplied: AppliedPromo = {
      code: matched.code,
      discountType: matched.discountType,
      discountValue: matched.discountValue,
      discountAmount,
      description: matched.description,
    };

    onApplyPromo(newApplied);
    triggerHaptic('success');
    
    const discountText = matched.discountType === 'percent' 
      ? `${matched.discountValue}%` 
      : formatUzbekSum(matched.discountValue);
    
    setSuccess(`Tabriklaymiz! "${matched.code}" promokodi muvaffaqiyatli faollashtirildi (${discountText} chegirma).`);
    setInputCode('');
  };

  const handleCopy = (code: string) => {
    try {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      triggerHaptic('light');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div 
        className="relative w-full max-w-lg bg-[#0f1118] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with decorative banner */}
        <div className="relative p-6 bg-gradient-to-br from-red-950/70 via-zinc-900 to-black border-b border-zinc-800">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-zinc-900/80 hover:bg-red-600 text-zinc-400 hover:text-white border border-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shadow-lg shadow-red-950/50">
              <Ticket className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-racing text-xl font-bold text-white tracking-wide">
                  Promokod Faollashtirish
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-red-950 border border-red-700/60 text-[10px] text-red-400 font-mono font-bold">
                  AKSIYA
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Maxsus chegirma kodingizni kiriting va xarid summasidan tejang!
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Active Applied Promo Status (if any) */}
          {appliedPromo && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-green-950/40 via-zinc-900 to-green-950/30 border border-green-800/60 relative overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-600/20 border border-green-500/50 flex items-center justify-center text-green-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-racing font-bold text-base text-white tracking-wider">
                        {appliedPromo.code}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-green-500 text-black text-[10px] font-black uppercase">
                        Faol Chegirma
                      </span>
                    </div>
                    <p className="text-xs text-green-300/90 mt-0.5">
                      {appliedPromo.discountType === 'percent'
                        ? `${appliedPromo.discountValue}% chegirma taqdim etildi`
                        : `${formatUzbekSum(appliedPromo.discountValue)} naqd chegirma`}
                    </p>
                    {appliedPromo.description && (
                      <p className="text-[11px] text-zinc-400 mt-1 italic">
                        "{appliedPromo.description}"
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onRemovePromo();
                    setSuccess(null);
                    setError(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-red-900/60 text-zinc-300 hover:text-red-300 text-xs font-semibold border border-zinc-700 hover:border-red-700 transition"
                >
                  Bekor qilish
                </button>
              </div>

              {cartSubtotal > 0 && (
                <div className="mt-3 pt-3 border-t border-green-900/40 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Joriy tejalgan mablag‘:</span>
                  <span className="font-racing font-bold text-green-400 text-sm">
                    -{formatUzbekSum(appliedPromo.discountAmount)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Promo code input form */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
              Promokod kodini kiriting
            </label>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleValidateAndApply();
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="Masalan: RAVON10 yoki TYUNING15"
                  className="w-full bg-zinc-900/90 border border-zinc-700 rounded-xl px-4 py-3 pl-10 text-sm font-racing font-bold text-white uppercase placeholder:normal-case placeholder:font-sans placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition tracking-wider"
                  autoFocus
                />
                <Tag className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                {inputCode && (
                  <button
                    type="button"
                    onClick={() => setInputCode('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white p-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-racing font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-900/50 active:scale-95 transition shrink-0"
              >
                Faollashtirish
              </button>
            </form>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-800/80 text-red-200 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 rounded-xl bg-green-950/70 border border-green-800/80 text-green-200 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <span className="font-medium">{success}</span>
              </div>
            )}
          </div>

          {/* Available Active Promo Codes Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Mavjud ommabop promokodlar
              </span>
              <span className="text-[11px] text-zinc-500">
                {activePromoCodes.length} ta faol
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {activePromoCodes.map((promo) => {
                const isCurrent = appliedPromo?.code === promo.code;
                return (
                  <div
                    key={promo.id}
                    className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-green-950/30 border-green-700/80 shadow-md shadow-green-950/40'
                        : 'bg-zinc-900/80 hover:bg-zinc-850 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        promo.discountType === 'percent'
                          ? 'bg-red-600/20 border-red-500/40 text-red-400'
                          : 'bg-amber-600/20 border-amber-500/40 text-amber-400'
                      }`}>
                        {promo.discountType === 'percent' ? (
                          <Percent className="w-4 h-4" />
                        ) : (
                          <Coins className="w-4 h-4" />
                        )}
                      </div>

                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="font-racing font-bold text-sm text-white tracking-wider">
                            {promo.code}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-red-950 border border-red-800 text-red-400 text-[10px] font-bold">
                            {promo.discountType === 'percent'
                              ? `-${promo.discountValue}%`
                              : `-${formatUzbekSum(promo.discountValue)}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate">
                          {promo.description || (promo.minOrderAmount ? `Minimal: ${formatUzbekSum(promo.minOrderAmount)}` : "Barcha xaridlar uchun")}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(promo.code)}
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white border border-zinc-700 transition"
                        title="Kodni nusxalash"
                      >
                        {copiedCode === promo.code ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {isCurrent ? (
                        <span className="px-2.5 py-1.5 rounded-xl bg-green-600/20 border border-green-500/40 text-green-400 text-xs font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Faol
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleValidateAndApply(promo.code)}
                          className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-red-600 text-zinc-200 hover:text-white text-xs font-bold border border-zinc-700 hover:border-red-500 transition active:scale-95"
                        >
                          Qo‘llash
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Cart Action */}
          {cartSubtotal > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCart();
                }}
                className="w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-bold flex items-center justify-between transition group"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-red-400" />
                  <span>Savatchani ko‘rish</span>
                </div>
                <div className="flex items-center gap-1 text-red-400 group-hover:translate-x-0.5 transition-transform">
                  <span>{formatUzbekSum(cartSubtotal)}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
