import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Tag, ShieldCheck, Truck, CheckCircle2, Ticket } from 'lucide-react';
import { CartItem, PromoCode, AppliedPromo } from '../types';
import { formatUzbekSum } from '../utils/formatters';
import { triggerHaptic } from '../utils/telegramWebApp';
import { ProductImagePlaceholder, hasRealProductImage } from './ProductImagePlaceholder';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onProceedToCheckout: () => void;
  discountPercent?: number;
  setDiscountPercent?: (pct: number) => void;
  promoCodes?: PromoCode[];
  appliedPromo?: AppliedPromo | null;
  onApplyPromo?: (promo: AppliedPromo) => void;
  onRemovePromo?: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
  discountPercent = 0,
  setDiscountPercent,
  promoCodes = [],
  appliedPromo = null,
  onApplyPromo,
  onRemovePromo,
}) => {
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  // Dynamic discount calculation based on applied promo or legacy discountPercent
  const calculatedDiscount = appliedPromo 
    ? (appliedPromo.discountType === 'percent'
        ? Math.round((subtotal * appliedPromo.discountValue) / 100)
        : Math.min(appliedPromo.discountValue, subtotal))
    : Math.round((subtotal * discountPercent) / 100);

  const finalTotal = Math.max(0, subtotal - calculatedDiscount);
  const freeDeliveryThreshold = 1000000;
  const progressPercent = Math.min(100, Math.round((subtotal / freeDeliveryThreshold) * 100));

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError('');
    setPromoSuccess('');

    const rawCode = promoCodeInput.trim().toUpperCase();
    if (!rawCode) {
      setPromoError("Iltimos, promokodni kiriting.");
      return;
    }

    // Check against promoCodes
    const matched = promoCodes.find((p) => p.code.trim().toUpperCase() === rawCode);

    if (matched) {
      if (!matched.isActive) {
        setPromoError(`"${matched.code}" promokodi hozirda to‘xtatilgan.`);
        triggerHaptic('error');
        return;
      }
      if (matched.minOrderAmount && matched.minOrderAmount > 0 && subtotal < matched.minOrderAmount) {
        setPromoError(`"${matched.code}" kamida ${formatUzbekSum(matched.minOrderAmount)} qiymatdagi xaridlar uchun.`);
        triggerHaptic('error');
        return;
      }

      const discAmount = matched.discountType === 'percent'
        ? Math.round((subtotal * matched.discountValue) / 100)
        : Math.min(matched.discountValue, subtotal);

      const newPromo: AppliedPromo = {
        code: matched.code,
        discountType: matched.discountType,
        discountValue: matched.discountValue,
        discountAmount: discAmount,
        description: matched.description,
      };

      if (onApplyPromo) onApplyPromo(newPromo);
      if (setDiscountPercent && matched.discountType === 'percent') {
        setDiscountPercent(matched.discountValue);
      }

      triggerHaptic('success');
      const discountLabel = matched.discountType === 'percent'
        ? `${matched.discountValue}%`
        : formatUzbekSum(matched.discountValue);
      setPromoSuccess(`"${matched.code}" promokodi muvaffaqiyatli qo‘llandi (${discountLabel} chegirma)!`);
      setPromoCodeInput('');
      return;
    }

    // Fallback check for RAVON10
    if (rawCode === 'RAVON10') {
      const newPromo: AppliedPromo = {
        code: 'RAVON10',
        discountType: 'percent',
        discountValue: 10,
        discountAmount: Math.round((subtotal * 10) / 100),
        description: '10% doimiy chegirma',
      };
      if (onApplyPromo) onApplyPromo(newPromo);
      if (setDiscountPercent) setDiscountPercent(10);
      triggerHaptic('success');
      setPromoSuccess("10% chegirma ('RAVON10') muvaffaqiyatli qo‘llanildi!");
      setPromoCodeInput('');
    } else {
      triggerHaptic('error');
      setPromoError(`Noto‘g‘ri promokod. 'RAVON10' kodini sinab ko‘ring.`);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-stretch justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div 
        className="w-full max-w-md bg-[#0c0e14] border-t sm:border-t-0 sm:border-l border-zinc-800 max-h-[92vh] sm:max-h-none h-[92vh] sm:h-full rounded-t-2xl sm:rounded-none flex flex-col justify-between shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ultra-Compact Mobile Header */}
        <div className="px-3 py-1.5 sm:px-4 sm:py-3 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/90 flex-shrink-0 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 flex-shrink-0 shrink-0">
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="flex items-baseline gap-2 sm:block min-w-0">
              <h2 className="font-racing text-xs sm:text-base font-bold text-white tracking-wide leading-tight truncate">
                Savatchangiz
              </h2>
              <span className="text-[10px] sm:text-[11px] text-zinc-400 leading-tight flex-shrink-0 shrink-0">
                ({items.length} xil mahsulot)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 shrink-0">
            {items.length > 0 && (
              <button
                type="button"
                onClick={onClearCart}
                className="min-h-[28px] px-2 text-[11px] text-zinc-400 hover:text-red-400 transition active:scale-95 cursor-pointer flex-shrink-0 shrink-0"
              >
                Tozalash
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition active:scale-95 cursor-pointer flex-shrink-0 shrink-0"
              aria-label="Yopish"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Ultra-Compact Free Delivery Banner */}
        {items.length > 0 && (
          <div className="px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs bg-red-950/20 border-b border-red-900/30 flex-shrink-0 shrink-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-zinc-300 flex items-center gap-1 truncate">
                <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500 flex-shrink-0 shrink-0" />
                {subtotal >= freeDeliveryThreshold ? (
                  <strong className="text-green-400 truncate">Bepul yetkazib berish faollashdi!</strong>
                ) : (
                  <span className="truncate">
                    Yana <strong className="text-red-400">{formatUzbekSum(freeDeliveryThreshold - subtotal)}</strong> xarid qilsangiz, yetkazish tekin!
                  </span>
                )}
              </span>
              <span className="text-zinc-400 font-bold text-[10px] flex-shrink-0 shrink-0">{progressPercent}%</span>
            </div>
            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Items List (flex-1 overflow-y-auto, items never shrink) */}
        <div className="flex-1 overflow-y-auto min-h-[190px] p-2.5 sm:p-4 flex flex-col gap-2.5">
          {items.length === 0 ? (
            <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 flex-shrink-0 shrink-0">
                <ShoppingBag className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <div>
                <h3 className="font-racing text-base sm:text-lg font-bold text-white mb-1">
                  Savatchangiz bo‘sh
                </h3>
                <p className="text-xs text-zinc-400 max-w-xs">
                  Katalogdan o‘zingizga kerakli ehtiyot qism yoki tyuning detalini tanlang yoki AI orqali rasm yuklang!
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-racing text-xs font-bold uppercase tracking-wider transition cursor-pointer flex-shrink-0 shrink-0"
              >
                Katalogni ko‘rish
              </button>
              <a
                href="https://t.me/ravonavto_bot"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold hover:underline transition flex-shrink-0 shrink-0"
              >
                Telegram Bot orqali buyurtma: @ravonavto_bot ↗
              </a>
            </div>
          ) : (
            items.map((item) => {
              const availableStock =
                item.product.inStock === false
                  ? 0
                  : typeof item.product.stock === 'number'
                  ? Math.max(0, Math.floor(item.product.stock))
                  : 10;
              return (
                <div 
                  key={item.product.id}
                  className="bg-zinc-900/95 border border-zinc-800 rounded-2xl p-2.5 sm:p-3 flex gap-3 items-start flex-shrink-0 shrink-0 shadow-sm"
                >
                  {hasRealProductImage(item.product.image) ? (
                    <img 
                      src={item.product.image} 
                      alt={item.product.name}
                      width={64}
                      height={64}
                      loading="lazy"
                      decoding="async"
                      className="w-16 h-16 min-w-[64px] min-h-[64px] max-w-[64px] max-h-[64px] rounded-xl object-cover flex-shrink-0 shrink-0 border border-zinc-700 bg-black" 
                    />
                  ) : (
                    <ProductImagePlaceholder
                      name={item.product.name}
                      category={item.product.category}
                      variant="thumb"
                      className="w-16 h-16 min-w-[64px] min-h-[64px] max-w-[64px] max-h-[64px] rounded-xl flex-shrink-0 shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex-shrink-0 shrink-0">
                      <div className="text-[10px] uppercase font-bold text-red-400 truncate leading-tight">
                        Bozorda: "{item.product.bazaarName}"
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug mt-0.5 flex-shrink-0 shrink-0">
                        {item.product.name}
                      </h4>
                      <div className="flex items-center justify-between gap-2 mt-1 flex-shrink-0 shrink-0">
                        <span className="text-xs font-racing font-bold text-zinc-200 flex-shrink-0 shrink-0">
                          {formatUzbekSum(item.product.price)}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-400 flex-shrink-0 shrink-0">
                          Omborda: {availableStock} dona
                        </span>
                      </div>
                    </div>

                    {/* Quantity (- 1 +) & Remove Controls (strictly flex-shrink-0) */}
                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-zinc-800/80 flex-shrink-0 shrink-0">
                      <div className="flex items-center border border-zinc-700 rounded-xl bg-zinc-950 overflow-hidden flex-shrink-0 shrink-0">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                          className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center text-zinc-200 hover:text-white hover:bg-zinc-800 active:bg-red-600/30 transition cursor-pointer flex-shrink-0 shrink-0"
                          aria-label="Kamaytirish"
                        >
                          <Minus className="w-3.5 h-3.5 flex-shrink-0 shrink-0" />
                        </button>
                        <span className="min-w-[28px] text-center px-1.5 text-xs sm:text-sm font-racing font-bold text-white select-none flex-shrink-0 shrink-0">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={item.quantity >= availableStock}
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                          className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center text-zinc-200 hover:text-white hover:bg-zinc-800 active:bg-red-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex-shrink-0 shrink-0"
                          aria-label="Ko'paytirish"
                        >
                          <Plus className="w-3.5 h-3.5 flex-shrink-0 shrink-0" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 shrink-0">
                        <span className="text-xs sm:text-sm font-racing font-black text-red-400 flex-shrink-0 shrink-0">
                          {formatUzbekSum(item.product.price * item.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.product.id)}
                          className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-xl bg-zinc-950 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-800/60 transition active:scale-95 cursor-pointer flex-shrink-0 shrink-0"
                          aria-label="O'chirish"
                        >
                          <Trash2 className="w-4 h-4 flex-shrink-0 shrink-0" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Bottom Footer (Promokod + Jami Summa + Buyurtma Berish) */}
        {items.length > 0 && (
          <div className="sticky bottom-0 z-20 flex-shrink-0 shrink-0 px-3 py-2 sm:p-4 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md space-y-1.5 sm:space-y-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
            {/* Active Promo Code Badge or Promo code input form */}
            {appliedPromo ? (
              <div className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-green-950/40 via-zinc-900 to-green-950/20 border border-green-800/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <div className="w-5 h-5 rounded-md bg-green-600/20 border border-green-500/40 flex items-center justify-center text-green-400 flex-shrink-0 shrink-0">
                    <Ticket className="w-3 h-3" />
                  </div>
                  <div className="overflow-hidden flex items-center gap-1.5">
                    <span className="font-racing font-bold text-xs text-white tracking-wider">
                      {appliedPromo.code}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-green-500 text-black text-[9px] font-black uppercase">
                      Faol
                    </span>
                    <span className="text-[10px] text-green-300 truncate">
                      ({appliedPromo.discountType === 'percent'
                        ? `-${appliedPromo.discountValue}%`
                        : `-${formatUzbekSum(appliedPromo.discountValue)}`})
                    </span>
                  </div>
                </div>

                {onRemovePromo && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      onRemovePromo();
                      setPromoSuccess('');
                      setPromoError('');
                    }}
                    className="px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-300 border border-zinc-700 transition text-xs cursor-pointer flex-shrink-0 shrink-0"
                    title="Promokodni bekor qilish"
                  >
                    ✕
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleApplyPromo} className="flex gap-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={promoCodeInput}
                    onChange={(e) => {
                      setPromoCodeInput(e.target.value.toUpperCase());
                      setPromoError('');
                    }}
                    placeholder="Promokod (masalan: RAVON10)"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 pl-7 text-xs font-racing font-bold text-zinc-200 uppercase placeholder:normal-case placeholder:font-sans placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                  <Tag className="w-3 h-3 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-red-600 text-xs font-bold text-zinc-200 hover:text-white border border-zinc-700 transition cursor-pointer flex-shrink-0 shrink-0"
                >
                  Qo‘llash
                </button>
              </form>
            )}

            {promoSuccess && (
              <div className="text-[10px] text-green-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 flex-shrink-0 shrink-0" />
                <span className="truncate">{promoSuccess}</span>
              </div>
            )}
            {promoError && (
              <div className="text-[10px] text-red-400 font-medium truncate">
                {promoError}
              </div>
            )}

            {/* Compact Price Breakdown & Total */}
            <div className="space-y-0.5 text-[11px] sm:text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Mahsulotlar ({items.reduce((s, i) => s + i.quantity, 0)} dona):</span>
                <span className="font-semibold text-zinc-200">{formatUzbekSum(subtotal)}</span>
              </div>
              {calculatedDiscount > 0 && (
                <div className="flex justify-between text-green-400 font-medium">
                  <span>
                    Chegirma {appliedPromo ? `(${appliedPromo.code})` : `(${discountPercent}%)`}:
                  </span>
                  <span>-{formatUzbekSum(calculatedDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-400">
                <span>Yetkazib berish:</span>
                <span className="text-zinc-200">
                  {subtotal >= freeDeliveryThreshold ? (
                    <strong className="text-green-400 font-semibold">Bepul</strong>
                  ) : (
                    "Kuryer hisobi bo'yicha"
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                <span className="text-xs sm:text-sm font-bold text-white uppercase font-racing">
                  Jami summa:
                </span>
                <span className="text-sm sm:text-lg font-racing font-black text-red-500">
                  {formatUzbekSum(finalTotal)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onProceedToCheckout}
              className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-racing font-bold text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
            >
              <span>Buyurtma berish</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="hidden sm:flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-zinc-400" />
                100% sifat kafolati
              </span>
              <a
                href="https://t.me/ravonavto_bot"
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 font-semibold hover:underline"
              >
                @ravonavto_bot ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
