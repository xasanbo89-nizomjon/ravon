import React, { useState } from 'react';
import { 
  X, 
  Receipt, 
  ShieldCheck, 
  Search, 
  Clock, 
  Package, 
  ChevronRight, 
  Phone, 
  Copy, 
  Check, 
  Printer, 
  Lock, 
  FileText,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { OrderRecord } from '../types';
import { formatUzbekSum } from '../utils/formatters';
import { formatCustomerReceiptText } from '../utils/telegram';

interface MyOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  myPersonalOrders: OrderRecord[];
  allOrders?: OrderRecord[]; // Used solely for ID + phone exact match verification
}

export const MyOrdersModal: React.FC<MyOrdersModalProps> = ({
  isOpen,
  onClose,
  myPersonalOrders,
  allOrders = [],
}) => {
  const [activeTab, setActiveTab] = useState<'my_checks' | 'verify'>('my_checks');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [searchOrderId, setSearchOrderId] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResult, setSearchResult] = useState<OrderRecord | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleVerifySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    setSearchResult(null);

    const cleanInputId = searchOrderId.trim().toUpperCase().replace('#', '');
    const cleanInputPhone = searchPhone.replace(/\D/g, '');

    if (!cleanInputId) {
      setSearchError('Iltimos, chek yoki buyurtma raqamini kiriting (masalan: RAV-849201)');
      return;
    }

    if (cleanInputPhone.length < 7) {
      setSearchError('Xavfsizlik yuzasidan buyurtma berilgan telefon raqamingizni ham kiriting.');
      return;
    }

    // Combine personal orders and system orders for strict verification (must match BOTH id and phone)
    const combined = [...myPersonalOrders, ...allOrders];
    const match = combined.find((o) => {
      const oId = o.id.toUpperCase().replace('#', '');
      const oCleanPhone = o.customer.phone.replace(/\D/g, '');
      const idMatches = oId.includes(cleanInputId) || cleanInputId.includes(oId);
      const phoneMatches = oCleanPhone.endsWith(cleanInputPhone) || cleanInputPhone.endsWith(oCleanPhone);
      return idMatches && phoneMatches;
    });

    if (match) {
      setSearchResult(match);
    } else {
      setSearchError("Buyurtma topilmadi yoki kiritilgan telefon raqami mos kelmadi. Shaxsiy ma'lumotlar xavfsizligi sababli begona buyurtmalarni ko'rish taqiqlangan.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-[#0f1118] border border-zinc-700 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-red-950/80 via-zinc-950 to-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-racing font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                <span>Maxfiy & Himoyalangan</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-racing font-bold text-white tracking-wide">
                Mening Shaxsiy Cheklarim
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/50 px-5 pt-3 gap-2 shrink-0">
          <button
            onClick={() => { setActiveTab('my_checks'); setSelectedOrder(null); }}
            className={`pb-3 px-4 text-xs font-racing font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-2 ${
              activeTab === 'my_checks'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Mening Cheklarim ({myPersonalOrders.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('verify'); setSelectedOrder(null); }}
            className={`pb-3 px-4 text-xs font-racing font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-2 ${
              activeTab === 'verify'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Chekni Tekshirish</span>
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          
          {/* Privacy Notice Banner */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-3.5 text-xs text-zinc-300 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">Xaridorlar daxlsizligi: </span>
              Boshqa mijozlarning buyurtmalari hech kimga ko'rsatilmaydi. Bu yerda faqat o'zingizning qurilmangizdan rasmiylashtirilgan cheklar saqlanadi.
            </div>
          </div>

          {/* TAB 1: MY PERSONAL CHECKS */}
          {activeTab === 'my_checks' && (
            <div>
              {myPersonalOrders.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                    <Receipt className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-racing font-bold text-white">
                    Sizda hali saqlangan cheklar yo'q
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Katalogdan kerakli detalni tanlab buyurtma bersangiz, rasmiy xarid chekingiz darhol shu yerda paydo bo'ladi.
                  </p>
                </div>
              ) : selectedOrder ? (
                /* Detail Check View */
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
                  >
                    ← Cheklar ro'yxatiga qaytish
                  </button>

                  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4 text-xs">
                    <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
                      <div>
                        <div className="font-racing font-bold text-white text-base">
                          RAVON AUTO TUNING
                        </div>
                        <div className="text-zinc-400 text-[11px]">
                          Namangan viloyati, Uychi tumani • +998 (95) 463-37-36
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-racing font-black text-red-400 text-sm">
                          #{selectedOrder.id}
                        </div>
                        <div className="text-zinc-400 text-[10px]">
                          {new Date(selectedOrder.createdAt).toLocaleString('uz-UZ')}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-zinc-900/60 p-3 rounded-xl">
                      <div>
                        <span className="text-zinc-400 block text-[10px]">Xaridor:</span>
                        <span className="font-semibold text-white">{selectedOrder.customer.fullName}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[10px]">Telefon:</span>
                        <span className="font-semibold text-white">{selectedOrder.customer.phone}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-zinc-400 block text-[10px]">Yetkazish manzili:</span>
                        <span className="font-medium text-zinc-200">
                          {selectedOrder.customer.region}, {selectedOrder.customer.cityAddress}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] uppercase font-bold text-zinc-400">
                        Xarid qilingan detallar ({selectedOrder.items.length})
                      </div>
                      <div className="space-y-1.5 divide-y divide-zinc-900">
                        {selectedOrder.items.map((it, idx) => (
                          <div key={idx} className="pt-1.5 flex justify-between items-center text-[11px]">
                            <div>
                              <div className="font-medium text-white">{it.product.name}</div>
                              <div className="text-zinc-400 text-[10px]">{it.quantity} dona x {formatUzbekSum(it.product.price)}</div>
                            </div>
                            <div className="font-racing font-bold text-zinc-200">
                              {formatUzbekSum(it.product.price * it.quantity)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-800 flex justify-between items-center">
                      <div>
                        <span className="text-zinc-400 text-[10px] block">Holati:</span>
                        <span className="px-2 py-0.5 rounded-full bg-green-950 text-green-400 border border-green-800 text-[10px] font-bold">
                          {selectedOrder.status}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-400 text-[10px] block">Jami summa:</span>
                        <span className="font-racing font-black text-red-400 text-lg">
                          {formatUzbekSum(selectedOrder.totalAmount)}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleCopy(
                          selectedOrder.id,
                          formatCustomerReceiptText(selectedOrder.id, selectedOrder.customer, selectedOrder.items, selectedOrder.totalAmount)
                        )}
                        className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-racing text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
                      >
                        {copiedId === selectedOrder.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-green-400" />
                            <span className="text-green-400">Nusxalandi</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Chekdan nusxa</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => window.print()}
                        className="py-2 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-racing text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Chop etish</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Orders List */
                <div className="space-y-2.5">
                  {myPersonalOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="p-4 rounded-2xl bg-zinc-950/80 hover:bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 transition cursor-pointer flex items-center justify-between group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-racing font-bold text-sm text-red-400">
                            #{order.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-950 text-green-400 border border-green-800/60">
                            {order.status}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-300">
                          {order.items.length} xil detal ({order.items.map(i => i.product.name).join(', ').slice(0, 40)}...)
                        </div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(order.createdAt).toLocaleString('uz-UZ')}</span>
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-3">
                        <div>
                          <div className="text-[10px] text-zinc-400">Summa</div>
                          <div className="font-racing font-bold text-white text-sm">
                            {formatUzbekSum(order.totalAmount)}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-red-400 transition group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VERIFY BY ID & PHONE */}
          {activeTab === 'verify' && (
            <div className="space-y-4">
              <form onSubmit={handleVerifySearch} className="space-y-3 bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800">
                <div className="text-xs font-semibold text-white">
                  Buyurtmangiz holatini va elektron chekini tekshirish
                </div>
                <p className="text-[11px] text-zinc-400">
                  Xavfsizlik qoidasi: boshqa xaridorlar ma'lumotlarini ko'rish mumkin emas. Tizim faqat buyurtma raqami va telefon raqami to'liq bir-biriga mos kelgandagina chekni chiqaradi.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-zinc-300 mb-1">Buyurtma / Chek ID</label>
                    <input
                      type="text"
                      placeholder="Masalan: RAV-849201"
                      value={searchOrderId}
                      onChange={(e) => setSearchOrderId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-300 mb-1">Buyurtma berilgan telefon</label>
                    <input
                      type="text"
                      placeholder="+998 90 123-45-67"
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                {searchError && (
                  <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-xs text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{searchError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-650 via-red-600 to-amber-600 hover:from-red-600 hover:to-amber-500 text-white font-racing text-xs font-bold uppercase tracking-wider transition"
                >
                  Chekni qidirish va ochish
                </button>
              </form>

              {/* Search Result */}
              {searchResult && (
                <div className="bg-zinc-950 border border-green-800/60 rounded-2xl p-5 space-y-3 text-xs">
                  <div className="flex items-center gap-2 text-green-400 text-xs font-bold pb-2 border-b border-zinc-800">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Sizning buyurtmangiz tasdiqlandi: #{searchResult.id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-zinc-400">Xaridor:</span>
                      <div className="font-semibold text-white">{searchResult.customer.fullName}</div>
                    </div>
                    <div>
                      <span className="text-zinc-400">Holati:</span>
                      <div>
                        <span className="px-2 py-0.5 rounded-full bg-green-950 text-green-400 border border-green-800 text-[10px] font-bold">
                          {searchResult.status}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-zinc-400">Detallar:</span>
                      <div className="text-zinc-200">
                        {searchResult.items.map(i => `${i.product.name} (${i.quantity} dona)`).join(', ')}
                      </div>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-zinc-800 flex justify-between items-center">
                      <span className="font-bold text-white">Jami summa:</span>
                      <span className="font-racing font-bold text-red-400 text-sm">
                        {formatUzbekSum(searchResult.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-green-400" />
            <span>Faqat shaxsiy cheklar ko'rinadi</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-racing text-xs font-bold uppercase transition"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
