import React, { useState } from 'react';
import { 
  CheckCircle2, 
  MessageSquare, 
  Printer, 
  Copy, 
  Check, 
  ShieldCheck, 
  Lock, 
  Download, 
  Clock, 
  MapPin, 
  Phone, 
  CreditCard, 
  Truck, 
  X,
  Sparkles
} from 'lucide-react';
import { OrderForm, CartItem } from '../types';
import { formatUzbekSum } from '../utils/formatters';
import { formatCustomerReceiptText } from '../utils/telegram';

interface OrderSuccessModalProps {
  orderId: string;
  orderData: OrderForm | null;
  items?: CartItem[];
  totalAmount: number;
  orderDate?: string;
  onClose: () => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  orderId,
  orderData,
  items = [],
  totalAmount,
  orderDate,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const cleanId = orderId.replace(/\D/g, '') || orderId;
  const formattedDate = orderDate 
    ? new Date(orderDate).toLocaleString('uz-UZ') 
    : new Date().toLocaleString('uz-UZ');

  const handleCopyReceipt = () => {
    if (!orderData) return;
    const text = formatCustomerReceiptText(orderId, orderData, items, totalAmount);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const deliveryLabel = 
    orderData?.deliveryMethod === 'courier' ? '🚗 Kuryer orqali (eshikkacha)' :
    orderData?.deliveryMethod === 'post' ? '📦 BTS / Fargo pochta punkti' :
    '🏢 Namangan viloyati, Uychi tumanidan olib ketish';

  const paymentLabel = 
    orderData?.paymentMethod === 'click' ? '💳 Click Up (Online)' :
    orderData?.paymentMethod === 'payme' ? '💳 Payme (Online)' :
    '💵 Naqd pul (Qabul qilinganda)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-[#0d0f15] border border-zinc-700/80 rounded-3xl shadow-2xl p-5 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
          title="Yopish"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Success Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/15 border border-green-500/40 text-green-400 shadow-lg shadow-green-500/10 mb-1">
            <CheckCircle2 className="w-8 h-8 animate-bounce" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-950/80 text-green-400 border border-green-800/60 text-[11px] font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Buyurtmangiz muvaffaqiyatli qabul qilindi</span>
          </div>
          <h2 className="text-2xl font-racing font-bold text-white tracking-wide">
            Sizning Rasmiy Xarid Chekingiz
          </h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Menejerimiz buyurtmani tasdiqlash uchun tez orada siz bilan bog'lanadi. Ushbu chek shaxsiy xaridingiz hujjati hisoblanadi.
          </p>
        </div>

        {/* Printable Official Receipt (Chek) Box */}
        <div 
          id="printable-receipt"
          className="bg-zinc-950 border-2 border-zinc-800/90 rounded-2xl p-4 sm:p-5 text-xs text-zinc-300 space-y-4 shadow-inner relative overflow-hidden"
        >
          {/* Watermark Logo */}
          <div className="absolute right-2 -bottom-6 text-zinc-900/60 font-racing font-black text-7xl select-none pointer-events-none tracking-widest uppercase">
            RAVON
          </div>

          {/* Receipt Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-racing font-bold text-sm sm:text-base text-red-500 tracking-wider">
                  RAVON AUTO TUNING
                </span>
                <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-zinc-800 text-zinc-300 uppercase tracking-wider">
                  NAMANGAN • UYCHI
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Namangan viloyati, Uychi tumani • +998 (95) 463-37-36
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-[10px] text-zinc-400 uppercase font-medium">Elektron Chek №</div>
              <div className="font-racing font-black text-base text-red-400 tracking-wider">
                #RAV-{cleanId}
              </div>
            </div>
          </div>

          {/* Receipt Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 py-1 text-[11px] bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/60">
            <div>
              <span className="text-zinc-400 block text-[10px]">Xaridor (F.I.Sh):</span>
              <span className="font-semibold text-white">{orderData?.fullName || 'Hurmatli mijoz'}</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">Telefon raqami:</span>
              <span className="font-semibold text-white font-mono">{orderData?.phone || '-'}</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">Yetkazish manzili:</span>
              <span className="font-medium text-zinc-200">
                {orderData?.region}, {orderData?.cityAddress}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">Sana va vaqt:</span>
              <span className="font-medium text-zinc-200">{formattedDate}</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">Yetkazish usuli:</span>
              <span className="font-medium text-zinc-200">{deliveryLabel}</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px]">To'lov usuli:</span>
              <span className="font-medium text-zinc-200">{paymentLabel}</span>
            </div>
          </div>

          {/* Purchased Items Table */}
          {items && items.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex justify-between px-1">
                <span>Xarid qilingan detallar ({items.length} dona)</span>
                <span>Summasi</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 divide-y divide-zinc-900">
                {items.map((it, idx) => (
                  <div key={idx} className="pt-1.5 flex items-center justify-between text-[11px]">
                    <div className="pr-2">
                      <div className="font-medium text-white">
                        {it.product.name}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {it.product.bazaarName ? `"${it.product.bazaarName}" • ` : ''}
                        {it.quantity} x {formatUzbekSum(it.product.price)}
                      </div>
                    </div>
                    <div className="font-racing font-bold text-zinc-200 shrink-0">
                      {formatUzbekSum(it.product.price * it.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total & Status */}
          <div className="pt-3 border-t-2 border-dashed border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-zinc-400 uppercase font-semibold">Buyurtma holati:</div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Qabul qilindi (Kutilmoqda)
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-zinc-400 uppercase font-semibold">Jami to'lov summasi:</div>
              <div className="font-racing font-black text-xl text-red-400">
                {formatUzbekSum(totalAmount)}
              </div>
            </div>
          </div>

          {/* Privacy & Confidentiality Guarantee Box */}
          <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-xl p-2.5 text-[11px] text-emerald-300 flex items-start gap-2">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-emerald-200">Shaxsiy xavfsizlik kafolati: </span>
              Ushbu chek faqat sizning shaxsiy xaridingiz uchun rasmiylashtirildi. 
              Boshqa hech qanday xaridor sizning buyurtmangiz va ma'lumotlaringizni ko'ra olmaydi.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <button
            onClick={handleCopyReceipt}
            className="w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-racing text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-green-400">Nusxalandi!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-zinc-400" />
                <span>Chekdan nusxa</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            className="w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-racing text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <Printer className="w-4 h-4 text-zinc-400" />
            <span>Chop etish (PDF)</span>
          </button>

          <a
            href="tel:+998954633736"
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-racing text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <Phone className="w-4 h-4" />
            <span>Adminga qo‘ng‘iroq</span>
          </a>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-red-650 via-red-600 to-amber-600 hover:from-red-600 hover:to-amber-500 text-white font-racing text-xs font-bold uppercase tracking-wider shadow-lg shadow-red-600/20 transition active:scale-95"
        >
          Do'konga qaytish
        </button>
      </div>
    </div>
  );
};
