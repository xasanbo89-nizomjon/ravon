import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ShieldCheck, MapPin, Phone, User, Truck, CreditCard, Clock, Copy, Check, Send } from 'lucide-react';
import { CartItem, OrderForm, SiteSettings, AppliedPromo } from '../types';
import { formatUzbekSum, formatPhoneNumber } from '../utils/formatters';
import { isTelegramWebApp, getTelegramUser, triggerHaptic } from '../utils/telegramWebApp';
import { safeFetchJson, cleanFriendlyErrorMessage } from '../utils/apiClient';
import { sendTelegramNotification, formatOrderTelegramMessage } from '../utils/telegram';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  totalAmount: number;
  onOrderSuccess: (orderId: string, orderData: OrderForm) => void;
  siteSettings: SiteSettings;
  appliedPromo?: AppliedPromo | null;
}

const REGIONS = [
  'Toshkent shahri',
  'Toshkent viloyati',
  'Samarqand viloyati',
  'Farg‘ona viloyati',
  'Andijon viloyati',
  'Namangan viloyati',
  'Buxoro viloyati',
  'Qashqadaryo viloyati',
  'Surxondaryo viloyati',
  'Xorazm viloyati',
  'Navoiy viloyati',
  'Jizzax viloyati',
  'Sirdaryo viloyati',
  'Qoraqalpog‘iston Respublikasi',
];

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  totalAmount,
  onOrderSuccess,
  siteSettings,
  appliedPromo = null,
}) => {
  const [copiedCard, setCopiedCard] = useState(false);
  const [form, setForm] = useState<OrderForm>({
    fullName: '',
    phone: '+998 ',
    region: 'Toshkent shahri',
    cityAddress: '',
    deliveryMethod: 'courier',
    paymentMethod: 'click',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill customer info if opened inside Telegram WebApp
  useEffect(() => {
    if (isOpen) {
      const tgUser = getTelegramUser();
      if (tgUser) {
        setForm(prev => {
          const names = [tgUser.firstName, tgUser.lastName].filter(Boolean).join(' ');
          return {
            ...prev,
            fullName: prev.fullName.trim() && prev.fullName !== 'Mijoz' ? prev.fullName : (names || prev.fullName),
            telegramUserId: tgUser.id,
            telegramUsername: tgUser.username,
          };
        });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setForm(prev => ({ ...prev, phone: formatPhoneNumber(raw) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.fullName.trim()) {
      setError('Iltimos, ism va familiyangizni kiriting.');
      return;
    }

    const cleanPhone = form.phone.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      setError('Iltimos, to‘g‘ri telefon raqam kiriting (masalan: +998 90 123-45-67).');
      return;
    }

    if (!form.cityAddress.trim()) {
      setError('Iltimos, aniq manzil yoki mo‘ljalni kiriting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const generatedOrderId = 'RAV-' + Date.now().toString().slice(-6);
      let finalOrderId = generatedOrderId;

      const response = await safeFetchJson<{ success: boolean; orderId?: string; error?: string }>('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: form,
          items,
          totalAmount,
          adminChatId: siteSettings.telegramAdminChatId,
          promoCodeUsed: appliedPromo?.code,
          discountAmount: appliedPromo?.discountAmount,
        }),
      });

      if (response.ok && response.data?.success) {
        finalOrderId = response.data.orderId || generatedOrderId;
      } else {
        // Fallback: If server returned HTML (e.g. Vercel static deployment) or server is unavailable,
        // send order directly via client-side Telegram notification
        console.warn('Backend /api/orders returned error or HTML, using fallback Telegram notification:', response.error);
        if (siteSettings.telegramBotToken && siteSettings.telegramAdminChatId) {
          const orderMsg = formatOrderTelegramMessage(finalOrderId, form, items, totalAmount);
          await sendTelegramNotification(
            siteSettings.telegramBotToken,
            siteSettings.telegramAdminChatId,
            orderMsg
          );
        }
      }

      onOrderSuccess(finalOrderId, form);
      triggerHaptic('success');
    } catch (err: any) {
      console.error(err);
      setError(cleanFriendlyErrorMessage(err?.message || "Buyurtmani rasmiylashtirishda xatolik yuz berdi."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md overflow-hidden sm:overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl bg-[#0f1118] sm:border sm:border-zinc-700 sm:rounded-3xl rounded-none shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Sticky on mobile */}
        <div className="sticky top-0 z-20 p-5 sm:p-6 bg-gradient-to-r from-red-950/80 via-zinc-950 to-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div>
            <div className="text-[11px] font-racing font-bold text-red-400 uppercase tracking-widest">
              Rasmiylashtirish
            </div>
            <h2 className="text-xl sm:text-2xl font-racing font-bold text-white tracking-wide">
              Buyurtma berish
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition active:scale-95"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Telegram Mini App indicator banner */}
        {(isTelegramWebApp() || form.telegramUserId) && (
          <div className="mx-5 sm:mx-8 mt-4 p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 flex items-center justify-between gap-3 text-xs text-blue-200">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="font-medium">Telegram Mini App orqali buyurtma:</span>
            </div>
            <span className="font-mono text-blue-300 font-bold bg-blue-900/40 px-2 py-0.5 rounded border border-blue-700/50">
              {form.telegramUsername ? `@${form.telegramUsername}` : form.fullName || 'Telegram foydalanuvchisi'}
            </span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 pb-20 sm:pb-8">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs">
              {error}
            </div>
          )}

          {/* Customer info */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-red-500" />
              <span>Qabul qiluvchi ma'lumotlari:</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                  Ism va Familiya *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Masalan: Sardor Rahimov"
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-2.5 pl-10 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                  <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                  Telefon raqam *
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={handlePhoneChange}
                    placeholder="+998 (90) 123-45-67"
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-2.5 pl-10 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 font-medium"
                  />
                  <Phone className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </div>

          {/* Delivery & Address */}
          <div className="space-y-4 pt-2 border-t border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-red-500" />
              <span>Yetkazib berish manzili:</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                  Viloyat / Hudud *
                </label>
                <select
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-zinc-100 focus:outline-none focus:border-red-500"
                >
                  {REGIONS.map((r, i) => (
                    <option key={i} value={r} className="bg-zinc-900">
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                  Aniq manzil, tuman yoki mo‘ljal *
                </label>
                <input
                  type="text"
                  required
                  value={form.cityAddress}
                  onChange={(e) => setForm({ ...form, cityAddress: e.target.value })}
                  placeholder="Masalan: Chilonzor 9-mavze, 14-uy"
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* Delivery Method Selector */}
            <div>
              <label className="block text-xs text-zinc-300 font-medium mb-2">
                Yetkazib berish turi:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'courier', title: 'Kuryer orqali', desc: 'Eshikkacha tezkor', icon: Truck },
                  { id: 'post', title: 'BTS / Fargo', desc: 'Pochta bo‘limiga', icon: Clock },
                  { id: 'pickup', title: 'Olib ketish', desc: 'Sergeli bozoridan', icon: MapPin },
                ].map((item) => {
                  const isSel = form.deliveryMethod === item.id;
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setForm({ ...form, deliveryMethod: item.id as any })}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-2.5 ${
                        isSel
                          ? 'border-red-500 bg-red-950/30 text-white'
                          : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSel ? 'text-red-500' : 'text-zinc-500'}`} />
                      <div>
                        <div className="text-xs font-bold">{item.title}</div>
                        <div className="text-[10px] text-zinc-500">{item.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-4 pt-2 border-t border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-red-500" />
              <span>To‘lov usuli:</span>
            </h3>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'click', title: 'Click Up', badge: 'Online' },
                { id: 'payme', title: 'Payme', badge: 'Online' },
                { id: 'cash', title: 'Naqd pul', badge: 'Qabul qilganda' },
              ].map((pay) => {
                const isSel = form.paymentMethod === pay.id;
                return (
                  <div
                    key={pay.id}
                    onClick={() => setForm({ ...form, paymentMethod: pay.id as any })}
                    className={`p-3 rounded-xl border text-center cursor-pointer transition ${
                      isSel
                        ? 'border-red-500 bg-red-950/40 text-white shadow-md'
                        : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    <div className="text-xs font-bold">{pay.title}</div>
                    <div className="text-[10px] text-zinc-500">{pay.badge}</div>
                  </div>
                );
              })}
            </div>

            {/* Card info if Click or Payme */}
            {form.paymentMethod !== 'cash' && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-zinc-900 to-red-950/40 border border-red-900/50 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">To‘lov uchun karta raqami ({siteSettings.paymentCardBank}):</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(siteSettings.paymentCardNumber.replace(/\s+/g, ''));
                      setCopiedCard(true);
                      setTimeout(() => setCopiedCard(false), 2000);
                    }}
                    className="flex items-center gap-1 text-[11px] text-red-400 hover:text-white font-bold bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700"
                  >
                    {copiedCard ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCard ? 'Nusxalandi' : 'Nusxa olish'}</span>
                  </button>
                </div>
                <div className="font-mono text-sm sm:text-base font-bold text-white tracking-wider">
                  {siteSettings.paymentCardNumber}
                </div>
                <div className="text-[11px] text-zinc-400">
                  Karta egasi: <strong className="text-zinc-200">{siteSettings.paymentCardHolder}</strong>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                Mashina modeli va yili yoki usta uchun izoh (ixtiyoriy):
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Masalan: 2022 Cobalt avtomat, qora rang"
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* Order Summary & CTA */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span>Buyurtma qilinayotgan tovarlar:</span>
              <span className="font-bold text-white">{items.length} ta xil</span>
            </div>
            {appliedPromo && (
              <div className="flex justify-between items-center text-xs text-green-400 font-medium">
                <span>Promokod ({appliedPromo.code}):</span>
                <span>-{formatUzbekSum(appliedPromo.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-base pt-2 border-t border-zinc-850">
              <span className="font-racing font-bold text-white uppercase">To‘lov summasi:</span>
              <span className="text-xl font-racing font-black text-red-500">
                {formatUzbekSum(totalAmount)}
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 rounded-xl font-racing text-base font-bold uppercase tracking-wider text-white shadow-xl transition flex items-center justify-center gap-2 ${
                isSubmitting
                  ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-red-600 via-red-500 to-red-700 hover:from-red-500 hover:to-red-600 shadow-red-900/50 glow-red active:scale-98'
              }`}
            >
              {isSubmitting ? (
                <span>Buyurtma yuborilmoqda...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-white" />
                  <span>Buyurtmani tasdiqlash</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
              <span>Operatorimiz 5-10 daqiqada siz bilan bog‘lanadi</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
