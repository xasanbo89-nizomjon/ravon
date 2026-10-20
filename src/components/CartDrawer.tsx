import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Tag, ShieldCheck, Truck, CheckCircle2, Ticket } from 'lucide-react';
import { CartItem, PromoCode, AppliedPromo } from '../types';
import { formatUzbekSum } from '../utils/formatters';
import { triggerHaptic } from '../utils/telegramWebApp';

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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[#0c0e14] border-l border-zinc-800 h-full flex flex-col justify-between shadow-2xl relative animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-racing text-lg font-bold text-white tracking-wide">
                Savatchangiz
              </h2>
              <span className="text-xs text-zinc-400">
                {items.length} xil mahsulot tanlandi
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={onClearCart}
                className="text-xs text-zinc-500 hover:text-red-400 transition"
              >
                Tozalash
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Free Delivery Bar */}
        {items.length > 0 && (
          <div className="px-5 py-3 bg-red-950/20 border-b border-red-900/30">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-zinc-300 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-red-500" />
                {subtotal >= freeDeliveryThreshold ? (
                  <strong className="text-green-400">Bepul yetkazib berish faollashdi!</strong>
                ) : (
                  <span>
                    Yana <strong className="text-red-400">{formatUzbekSum(freeDeliveryThreshold - subtotal)}</strong>lik xarid qilsangiz, yetkazish tekin!
                  </span>
                )}
              </span>
              <span className="text-zinc-400 font-bold">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
                <ShoppingBag className="w-10 h-10" />
              </div>
              <div>
                <h3 className="font-racing text-lg font-bold text-white mb-1">
                  Savatchangiz bo‘sh
                </h3>
                <p className="text-xs text-zinc-400 max-w-xs">
                  Katalogdan o‘zingizga kerakli ehtiyot qism yoki tyuning detalini tanlang yoki AI orqali rasm yuklang!
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-racing text-xs font-bold uppercase tracking-wider transition"
              >
                Katalogni ko‘rish
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div 
                key={item.product.id}
                className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3.5 flex gap-3 items-center"
              >
                <img 
                  src={item.product.image} 
                  alt={item.product.name}
                  className="w-18 h-18 rounded-xl object-cover shrink-0 border border-zinc-700 bg-black" 
                />

                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase font-bold text-red-400 truncate">
                    Bozorda: "{item.product.bazaarName}"
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                    {item.product.name}
                  </h4>
                  <div className="text-xs font-racing font-bold text-zinc-300 mt-1">
                    {formatUzbekSum(item.product.price)}
                  </div>

                  {/* Quantity & Remove */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/80">
                    <div className="flex items-center border border-zinc-700 rounded-lg bg-zinc-950 overflow-hidden">
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 px-2 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2.5 text-xs font-racing font-bold text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 px-2 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-racing font-black text-red-400">
                        {formatUzbekSum(item.product.price * item.quantity)}
                      </span>
                      <button
                        onClick={() => onRemoveItem(item.product.id)}
                        className="text-zinc-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer & Checkout */}
        {items.length > 0 && (
          <div className="p-5 border-t border-zinc-800 bg-zinc-950 space-y-4">
            {/* Active Promo Code Badge or Promo code input form */}
            {appliedPromo ? (
              <div className="p-3 rounded-xl bg-gradient-to-r from-green-950/40 via-zinc-900 to-green-950/20 border border-green-800/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-7 h-7 rounded-lg bg-green-600/20 border border-green-500/40 flex items-center justify-center text-green-400 shrink-0">
                    <Ticket className="w-3.5 h-3.5" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className="font-racing font-bold text-xs text-white tracking-wider">
                        {appliedPromo.code}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-green-500 text-black text-[9px] font-black uppercase">
                        Faol
                      </span>
                    </div>
                    <div className="text-[10px] text-green-300 truncate">
                      {appliedPromo.discountType === 'percent'
                        ? `${appliedPromo.discountValue}% chegirma`
                        : `${formatUzbekSum(appliedPromo.discountValue)} chegirma`}
                    </div>
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
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-300 border border-zinc-700 transition text-xs"
                    title="Promokodni bekor qilish"
                  >
                    ✕
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleApplyPromo} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={promoCodeInput}
                    onChange={(e) => {
                      setPromoCodeInput(e.target.value.toUpperCase());
                      setPromoError('');
                    }}
                    placeholder="Promokod (masalan: RAVON10)"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 pl-8 text-xs font-racing font-bold text-zinc-200 uppercase placeholder:normal-case placeholder:font-sans placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                  <Tag className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-red-600 text-xs font-bold text-zinc-200 hover:text-white border border-zinc-700 transition"
                >
                  Qo‘llash
                </button>
              </form>
            )}

            {promoSuccess && (
              <div className="text-[11px] text-green-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{promoSuccess}</span>
              </div>
            )}
            {promoError && (
              <div className="text-[11px] text-red-400 font-medium">
                {promoError}
              </div>
            )}

            {/* Price Breakdown */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Mahsulotlar summasi:</span>
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
              <div className="flex justify-between text-sm pt-2 border-t border-zinc-800">
                <span className="font-bold text-white uppercase font-racing">Jami summa:</span>
                <span className="text-lg font-racing font-black text-red-500">
                  {formatUzbekSum(finalTotal)}
                </span>
              </div>
            </div>

            {/* Proceed to checkout CTA */}
            <button
              onClick={onProceedToCheckout}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-racing font-bold text-sm uppercase tracking-wider shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <span>Buyurtma berish</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>Xarid 100% himoyalangan va sifat kafolatiga ega</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
