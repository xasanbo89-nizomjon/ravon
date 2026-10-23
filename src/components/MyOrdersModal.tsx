import React, { useState, useMemo } from 'react';
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
  CheckCircle2,
  Truck,
  XCircle,
  CreditCard,
  MapPin,
  Tag,
  ArrowLeft,
} from 'lucide-react';
import { OrderRecord, OrderStatus } from '../types';
import { formatUzbekSum } from '../utils/formatters';
import { formatCustomerReceiptText } from '../utils/telegram';

interface MyOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  myPersonalOrders: OrderRecord[];
  allOrders?: OrderRecord[]; // Used for live status sync & ID + phone verification
}

const getStatusConfig = (status: OrderStatus | string) => {
  switch (status) {
    case 'Bajarildi':
      return {
        label: 'Bajarildi',
        subtitle: 'Buyurtma muvaffaqiyatli topshirildi',
        step: 3,
        badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-700/70',
        barColor: 'bg-emerald-500',
        icon: CheckCircle2,
        iconColor: 'text-emerald-400',
      };
    case 'Yetkazilmoqda':
      return {
        label: 'Yetkazilmoqda',
        subtitle: 'Buyurtma yo‘lda — kuryer yoki pochtaga topshirilgan',
        step: 2,
        badgeClass: 'bg-blue-950/90 text-blue-300 border-blue-700/70',
        barColor: 'bg-blue-500',
        icon: Truck,
        iconColor: 'text-blue-400',
      };
    case 'Bekor qilindi':
      return {
        label: 'Bekor qilindi',
        subtitle: 'Buyurtma bekor qilingan',
        step: 0,
        badgeClass: 'bg-red-950/90 text-red-300 border-red-800/70',
        barColor: 'bg-red-500',
        icon: XCircle,
        iconColor: 'text-red-400',
      };
    case 'Yangi':
    default:
      return {
        label: 'Yangi',
        subtitle: 'Buyurtma qabul qilindi va tayyorlanmoqda',
        step: 1,
        badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-700/70',
        barColor: 'bg-amber-500',
        icon: Clock,
        iconColor: 'text-amber-400',
      };
  }
};

const getDeliveryMethodLabel = (method?: string) => {
  if (method === 'courier') return 'Kuryer orqali (eshikkacha)';
  if (method === 'post') return 'BTS / Fargo pochta punkti';
  return 'Do‘kondan olib ketish (Namangan, Uychi)';
};

const getPaymentMethodLabel = (method?: string) => {
  if (method === 'click') return 'Click Up (Online)';
  if (method === 'payme') return 'Payme (Online)';
  return 'Naqd pul (Qabul qilinganda)';
};

export const MyOrdersModal: React.FC<MyOrdersModalProps> = ({
  isOpen,
  onClose,
  myPersonalOrders,
  allOrders = [],
}) => {
  const [activeTab, setActiveTab] = useState<'my_checks' | 'verify'>('my_checks');
  const [statusFilter, setStatusFilter] = useState<'Hammasi' | OrderStatus>('Hammasi');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [searchOrderId, setSearchOrderId] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResult, setSearchResult] = useState<OrderRecord | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Merge personal orders with live status updates from allOrders (CRM)
  const syncedPersonalOrders = useMemo(() => {
    return myPersonalOrders.map((personalOrder) => {
      const liveMatch = allOrders.find(
        (o) =>
          o.id.trim().toUpperCase().replace('#', '') ===
          personalOrder.id.trim().toUpperCase().replace('#', '')
      );
      if (liveMatch && liveMatch.status !== personalOrder.status) {
        return { ...personalOrder, status: liveMatch.status };
      }
      return personalOrder;
    });
  }, [myPersonalOrders, allOrders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'Hammasi') return syncedPersonalOrders;
    return syncedPersonalOrders.filter((o) => o.status === statusFilter);
  }, [syncedPersonalOrders, statusFilter]);

  const orderSummary = useMemo(() => {
    const totalCount = syncedPersonalOrders.length;
    const newCount = syncedPersonalOrders.filter(
      (o) => o.status === 'Yangi' || o.status === 'Yetkazilmoqda'
    ).length;
    const completedCount = syncedPersonalOrders.filter(
      (o) => o.status === 'Bajarildi'
    ).length;
    const totalSpent = syncedPersonalOrders
      .filter((o) => o.status !== 'Bekor qilindi')
      .reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);
    return { totalCount, newCount, completedCount, totalSpent };
  }, [syncedPersonalOrders]);

  // Keep selectedOrder synced with latest status
  const activeSelectedOrder = useMemo(() => {
    if (!selectedOrder) return null;
    return (
      syncedPersonalOrders.find((o) => o.id === selectedOrder.id) || selectedOrder
    );
  }, [selectedOrder, syncedPersonalOrders]);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
      setSearchError(
        'Iltimos, chek yoki buyurtma raqamini kiriting (masalan: RAV-849201)'
      );
      return;
    }

    if (cleanInputPhone.length < 7) {
      setSearchError(
        'Xavfsizlik yuzasidan buyurtma berilgan telefon raqamingizni ham kiriting.'
      );
      return;
    }

    // Combine synced personal orders and system orders for strict verification
    const combined = [...allOrders, ...syncedPersonalOrders];
    const match = combined.find((o) => {
      const oId = o.id.toUpperCase().replace('#', '');
      const oCleanPhone = o.customer.phone.replace(/\D/g, '');
      const idMatches =
        oId.includes(cleanInputId) || cleanInputId.includes(oId);
      const phoneMatches =
        oCleanPhone.endsWith(cleanInputPhone) ||
        cleanInputPhone.endsWith(oCleanPhone);
      return idMatches && phoneMatches;
    });

    if (match) {
      setSearchResult(match);
    } else {
      setSearchError(
        "Buyurtma topilmadi yoki kiritilgan telefon raqami mos kelmadi. Shaxsiy ma'lumotlar xavfsizligi sababli begona buyurtmalarni ko'rish taqiqlangan."
      );
    }
  };

  const renderOrderStatusStepper = (status: OrderStatus | string) => {
    const cfg = getStatusConfig(status);
    if (status === 'Bekor qilindi') {
      return (
        <div className="bg-red-950/30 border border-red-900/60 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-red-300">
            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-semibold">Buyurtma bekor qilingan</span>
          </div>
          <span className="text-[11px] text-red-400">SAVOLLAR UCHUN: +998 (95) 463-37-36</span>
        </div>
      );
    }

    const steps = [
      { key: 1, title: 'Yangi', desc: 'Qabul qilindi' },
      { key: 2, title: 'Yetkazilmoqda', desc: 'Yo‘lda' },
      { key: 3, title: 'Bajarildi', desc: 'Topshirildi' },
    ];

    return (
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400 font-medium">Buyurtma holati jarayoni:</span>
          <span className={`font-semibold ${cfg.iconColor}`}>{cfg.subtitle}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {steps.map((st) => {
            const isCompleted = cfg.step >= st.key;
            const isCurrent = cfg.step === st.key;
            return (
              <div
                key={st.key}
                className={`rounded-lg p-2 border transition ${
                  isCompleted
                    ? st.key === 3
                      ? 'bg-emerald-950/50 border-emerald-700/70 text-emerald-200'
                      : st.key === 2
                      ? 'bg-blue-950/50 border-blue-700/70 text-blue-200'
                      : 'bg-amber-950/50 border-amber-700/70 text-amber-200'
                    : 'bg-zinc-950/60 border-zinc-800/70 text-zinc-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-racing font-bold tracking-wide">
                    {st.key}. {st.title}
                  </span>
                  {isCompleted && (
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${
                        st.key === 3
                          ? 'text-emerald-400'
                          : st.key === 2
                          ? 'text-blue-400'
                          : 'text-amber-400'
                      }`}
                    />
                  )}
                </div>
                <div className="text-[10px] opacity-80">{st.desc}</div>
                {isCurrent && (
                  <div className="mt-1.5 h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div className={`h-full w-full ${cfg.barColor}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderOrderItemsList = (order: OrderRecord, compact = false) => {
    const rawSubtotal = order.items.reduce(
      (sum, it) => sum + (Number(it.product.price) || 0) * (Number(it.quantity) || 1),
      0
    );

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
          <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-red-400" />
            <span>Buyurtmadagi mahsulotlar ({order.items.length} turdagi detal)</span>
          </span>
          <span className="tabular-nums">Narxi va miqdori</span>
        </div>

        <div className="divide-y divide-zinc-800/80 border border-zinc-800/90 rounded-xl bg-zinc-900/40 overflow-hidden">
          {order.items.map((it, idx) => {
            const lineTotal = (Number(it.product.price) || 0) * (Number(it.quantity) || 1);
            return (
              <div
                key={`${order.id}-item-${idx}`}
                className="p-3 flex items-center justify-between gap-3 hover:bg-zinc-900/70 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {it.product.image ? (
                      <img
                        src={it.product.image}
                        alt={it.product.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-5 h-5 text-zinc-600" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-zinc-400">
                      <span className="text-amber-300/90 font-medium">
                        {it.product.brand || 'GM Genuine (Original)'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{it.product.category}</span>
                    </div>
                    <div className="font-semibold text-white text-xs sm:text-sm truncate">
                      {it.product.name}
                    </div>
                    {it.product.bazaarName && (
                      <div className="text-[11px] text-red-400 font-medium truncate">
                        Bozor nomi: &ldquo;{it.product.bazaarName}&rdquo;
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-0.5 tabular-nums">
                  <div className="font-racing font-bold text-sm text-white">
                    {formatUzbekSum(lineTotal)}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {it.quantity} dona × {formatUzbekSum(it.product.price)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Financial Breakdown */}
        {!compact && (order.discountAmount || rawSubtotal !== order.totalAmount) && (
          <div className="bg-zinc-900/40 border border-zinc-800/70 rounded-xl p-3 space-y-1.5 text-xs tabular-nums">
            <div className="flex justify-between text-zinc-400">
              <span>Mahsulotlar dastlabki summasi:</span>
              <span>{formatUzbekSum(rawSubtotal)}</span>
            </div>
            {order.discountAmount && order.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  <span>
                    Promokod chegirmasi{' '}
                    {order.promoCodeUsed ? `(${order.promoCodeUsed})` : ''}:
                  </span>
                </span>
                <span>-{formatUzbekSum(order.discountAmount)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl bg-[#0d0f17] border border-zinc-700/90 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-red-950/80 via-zinc-950 to-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-red-400 flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                <span>Shaxsiy xaridlar tarixi va holati</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-racing font-bold text-white tracking-wide">
                Mening Buyurtmalarim va Cheklarim
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
            title="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/70 px-5 pt-3 gap-2 shrink-0">
          <button
            onClick={() => {
              setActiveTab('my_checks');
              setSelectedOrder(null);
            }}
            className={`pb-3 px-4 text-xs font-racing font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'my_checks'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Mening Buyurtmalarim ({syncedPersonalOrders.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('verify');
              setSelectedOrder(null);
            }}
            className={`pb-3 px-4 text-xs font-racing font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'verify'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>ID va Raqam orqali Tekshirish</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: MY PERSONAL ORDERS & CHECKS */}
          {activeTab === 'my_checks' && (
            <div className="space-y-5">
              {syncedPersonalOrders.length === 0 ? (
                <div className="text-center py-14 px-4 space-y-3 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                    <Receipt className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-racing font-bold text-white">
                    Sizda hali buyurtmalar va cheklar yo‘q
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Katalogdan kerakli avto-detalni tanlab buyurtma bersangiz, mahsulotlar ro‘yxati, narxi va buyurtma holati shu yerda aks etadi.
                  </p>
                </div>
              ) : activeSelectedOrder ? (
                /* EXPANDED SINGLE ORDER RECEIPT VIEW */
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 hover:text-white flex items-center gap-1.5 font-semibold transition"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-red-400" />
                      <span>Barcha buyurtmalar ro‘yxatiga qaytish</span>
                    </button>

                    <span
                      className={`px-3 py-1 rounded-xl border text-xs font-racing font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                        getStatusConfig(activeSelectedOrder.status).badgeClass
                      }`}
                    >
                      {React.createElement(
                        getStatusConfig(activeSelectedOrder.status).icon,
                        { className: 'w-3.5 h-3.5' }
                      )}
                      <span>
                        Holati: {getStatusConfig(activeSelectedOrder.status).label}
                      </span>
                    </span>
                  </div>

                  {/* Official Detailed Receipt Box */}
                  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-5 text-xs">
                    {/* Top Store & Order ID Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800 gap-3">
                      <div>
                        <div className="font-racing font-bold text-white text-base sm:text-lg tracking-wide">
                          RAVON AUTO TUNING — RASMIY CHEK
                        </div>
                        <div className="text-zinc-400 text-[11px] mt-0.5">
                          Namangan viloyati, Uychi tumani · Tel: +998 (95) 463-37-36
                        </div>
                      </div>
                      <div className="sm:text-right tabular-nums">
                        <div className="text-[10px] text-zinc-400 uppercase">
                          Buyurtma raqami
                        </div>
                        <div className="font-racing font-black text-red-400 text-base">
                          #{activeSelectedOrder.id}
                        </div>
                        <div className="text-zinc-400 text-[11px]">
                          {new Date(activeSelectedOrder.createdAt).toLocaleString(
                            'uz-UZ'
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Visual Order Status Stepper */}
                    {renderOrderStatusStepper(activeSelectedOrder.status)}

                    {/* Customer & Delivery Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/50 border border-zinc-800/80 p-4 rounded-xl text-xs">
                      <div>
                        <span className="text-zinc-400 block text-[10px]">
                          Xaridor (F.I.Sh):
                        </span>
                        <span className="font-semibold text-white">
                          {activeSelectedOrder.customer.fullName}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[10px]">
                          Telefon raqami:
                        </span>
                        <span className="font-semibold text-white tabular-nums">
                          {activeSelectedOrder.customer.phone}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[10px]">
                          Yetkazish manzili:
                        </span>
                        <span className="font-medium text-zinc-200">
                          {activeSelectedOrder.customer.region},{' '}
                          {activeSelectedOrder.customer.cityAddress}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[10px]">
                          Yetkazish va to‘lov turi:
                        </span>
                        <span className="font-medium text-zinc-200">
                          {getDeliveryMethodLabel(
                            activeSelectedOrder.customer.deliveryMethod
                          )}{' '}
                          ·{' '}
                          {getPaymentMethodLabel(
                            activeSelectedOrder.customer.paymentMethod
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Full Itemized Products List */}
                    {renderOrderItemsList(activeSelectedOrder, false)}

                    {/* Grand Total Footer */}
                    <div className="pt-4 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-zinc-400 text-[11px] block">
                          Buyurtma joriy holati:
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-lg border text-xs font-bold ${
                              getStatusConfig(activeSelectedOrder.status).badgeClass
                            }`}
                          >
                            {getStatusConfig(activeSelectedOrder.status).label}
                          </span>
                          <span className="text-zinc-400 text-[11px]">
                            ({getStatusConfig(activeSelectedOrder.status).subtitle})
                          </span>
                        </div>
                      </div>
                      <div className="sm:text-right tabular-nums">
                        <span className="text-zinc-400 text-[11px] block">
                          Jami yakuniy to‘lov summasi:
                        </span>
                        <span className="font-racing font-black text-red-400 text-xl sm:text-2xl">
                          {formatUzbekSum(activeSelectedOrder.totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                      <button
                        onClick={(e) =>
                          handleCopy(
                            activeSelectedOrder.id,
                            formatCustomerReceiptText(
                              activeSelectedOrder.id,
                              activeSelectedOrder.customer,
                              activeSelectedOrder.items,
                              activeSelectedOrder.totalAmount
                            ),
                            e
                          )
                        }
                        className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-racing text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
                      >
                        {copiedId === activeSelectedOrder.id ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400">Nusxalandi</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Chekdan nusxa</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => window.print()}
                        className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-racing text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Chop etish</span>
                      </button>

                      <a
                        href="tel:+998954633736"
                        className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-racing text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
                      >
                        <Phone className="w-4 h-4" />
                        <span>Adminga qo‘ng‘iroq</span>
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                /* ORDERS LIST VIEW WITH DETAILED PRODUCT BREAKDOWN & STATUS */
                <div className="space-y-4">
                  {/* Top Summary Metrics Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 tabular-nums">
                    <div className="bg-zinc-950/90 border border-zinc-800/90 rounded-2xl p-3">
                      <div className="text-[11px] text-zinc-400">Jami buyurtmalar</div>
                      <div className="font-racing font-bold text-lg text-white mt-0.5">
                        {orderSummary.totalCount} ta
                      </div>
                    </div>
                    <div className="bg-zinc-950/90 border border-zinc-800/90 rounded-2xl p-3">
                      <div className="text-[11px] text-amber-400/90">Yangi / Jarayonda</div>
                      <div className="font-racing font-bold text-lg text-amber-300 mt-0.5">
                        {orderSummary.newCount} ta
                      </div>
                    </div>
                    <div className="bg-zinc-950/90 border border-zinc-800/90 rounded-2xl p-3">
                      <div className="text-[11px] text-emerald-400/90">Bajarildi</div>
                      <div className="font-racing font-bold text-lg text-emerald-300 mt-0.5">
                        {orderSummary.completedCount} ta
                      </div>
                    </div>
                    <div className="bg-zinc-950/90 border border-zinc-800/90 rounded-2xl p-3">
                      <div className="text-[11px] text-zinc-400">Umumiy xarid</div>
                      <div className="font-racing font-bold text-sm sm:text-base text-red-400 mt-0.5 truncate">
                        {formatUzbekSum(orderSummary.totalSpent)}
                      </div>
                    </div>
                  </div>

                  {/* Interactive Status Filter Controls */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {(
                      [
                        'Hammasi',
                        'Yangi',
                        'Yetkazilmoqda',
                        'Bajarildi',
                        'Bekor qilindi',
                      ] as const
                    ).map((st) => {
                      const isActive = statusFilter === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatusFilter(st)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-racing font-bold tracking-wide transition whitespace-nowrap shrink-0 ${
                            isActive
                              ? 'bg-red-600 text-white'
                              : 'bg-zinc-900/90 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                          }`}
                        >
                          {st === 'Hammasi' ? 'Barcha buyurtmalar' : st}
                        </button>
                      );
                    })}
                  </div>

                  {/* Detailed Order Cards */}
                  {filteredOrders.length === 0 ? (
                    <div className="text-center py-10 bg-zinc-950/50 border border-zinc-800/80 rounded-2xl text-xs text-zinc-400">
                      &ldquo;{statusFilter}&rdquo; holatidagi buyurtmalar topilmadi.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredOrders.map((order) => {
                        const statusCfg = getStatusConfig(order.status);
                        const StatusIcon = statusCfg.icon;
                        const totalQuantity = order.items.reduce(
                          (acc, it) => acc + (Number(it.quantity) || 1),
                          0
                        );

                        return (
                          <div
                            key={order.id}
                            className="rounded-2xl bg-zinc-950/90 border border-zinc-800/90 hover:border-zinc-700 transition overflow-hidden space-y-4 p-4 sm:p-5"
                          >
                            {/* Order Card Top Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-zinc-800/90">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className="font-racing font-black text-base text-red-400 tabular-nums">
                                    #{order.id}
                                  </span>
                                  <span aria-hidden="true" className="text-zinc-600">
                                    ·
                                  </span>
                                  <span className="text-xs text-zinc-400 flex items-center gap-1 tabular-nums">
                                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                                    {new Date(order.createdAt).toLocaleString(
                                      'uz-UZ'
                                    )}
                                  </span>
                                </div>
                                <div className="text-xs text-zinc-300 flex items-center gap-2 flex-wrap">
                                  <span>{order.customer.fullName}</span>
                                  <span aria-hidden="true" className="text-zinc-600">
                                    ·
                                  </span>
                                  <span className="text-zinc-400">
                                    {order.customer.region},{' '}
                                    {order.customer.cityAddress}
                                  </span>
                                </div>
                              </div>

                              {/* Prominent Status Badge (Yangi / Yetkazilmoqda / Bajarildi) */}
                              <div className="flex items-center gap-2 self-start sm:self-center">
                                <div
                                  className={`px-3 py-1.5 rounded-xl border text-xs font-racing font-bold uppercase tracking-wider flex items-center gap-1.5 ${statusCfg.badgeClass}`}
                                >
                                  <StatusIcon className="w-4 h-4 shrink-0" />
                                  <span>{statusCfg.label}</span>
                                </div>
                              </div>
                            </div>

                            {/* Visual Stepper showing Yangi -> Yetkazilmoqda -> Bajarildi */}
                            {renderOrderStatusStepper(order.status)}

                            {/* Full Itemized Products List with Thumbnail, Brand, Quantity & Price */}
                            {renderOrderItemsList(order, true)}

                            {/* Order Footer: Total Price, Delivery Info & Quick Actions */}
                            <div className="pt-3.5 border-t border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="text-[11px] text-zinc-400 flex items-center gap-2 flex-wrap">
                                  <span>
                                    Jami: <strong className="text-zinc-200">{order.items.length} xil detal ({totalQuantity} dona)</strong>
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    {getPaymentMethodLabel(
                                      order.customer.paymentMethod
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-baseline gap-2 tabular-nums">
                                  <span className="text-xs text-zinc-400">
                                    Umumiy to‘lov summasi:
                                  </span>
                                  <span className="font-racing font-black text-lg sm:text-xl text-red-400">
                                    {formatUzbekSum(order.totalAmount)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleCopy(
                                      order.id,
                                      formatCustomerReceiptText(
                                        order.id,
                                        order.customer,
                                        order.items,
                                        order.totalAmount
                                      ),
                                      e
                                    )
                                  }
                                  className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
                                >
                                  {copiedId === order.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      <span className="text-emerald-400">
                                        Nusxalandi
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Nusxa olish</span>
                                    </>
                                  )}
                                </button>

                                <a
                                  href="tel:+998954633736"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 py-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-800/70 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                  <span>Qo‘ng‘iroq</span>
                                </a>

                                <button
                                  type="button"
                                  onClick={() => setSelectedOrder(order)}
                                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-racing text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition whitespace-nowrap"
                                >
                                  <span>To‘liq chek</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VERIFY BY ID & PHONE */}
          {activeTab === 'verify' && (
            <div className="space-y-4">
              <form
                onSubmit={handleVerifySearch}
                className="space-y-3 bg-zinc-950/80 p-4 sm:p-5 rounded-2xl border border-zinc-800"
              >
                <div className="text-xs font-semibold text-white">
                  Buyurtmangiz holatini va elektron chekini tekshirish
                </div>
                <p className="text-[11px] text-zinc-400">
                  Xavfsizlik qoidasi: boshqa xaridorlar ma’lumotlarini ko‘rish mumkin emas. Tizim faqat buyurtma raqami va telefon raqami bir-biriga mos kelgandagina chekni chiqaradi.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-zinc-300 mb-1">
                      Buyurtma / Chek ID
                    </label>
                    <input
                      type="text"
                      placeholder="Masalan: RAV-849201"
                      value={searchOrderId}
                      onChange={(e) => setSearchOrderId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-300 mb-1">
                      Buyurtma berilgan telefon
                    </label>
                    <input
                      type="text"
                      placeholder="+998 90 123-45-67"
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
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
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-racing text-xs font-bold uppercase tracking-wider transition"
                >
                  Buyurtmani qidirish va ochish
                </button>
              </form>

              {/* Search Result */}
              {searchResult && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4 text-xs animate-in fade-in duration-150">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Buyurtma tasdiqlandi: #{searchResult.id}</span>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-xl border text-xs font-racing font-bold uppercase tracking-wider self-start sm:self-auto ${
                        getStatusConfig(searchResult.status).badgeClass
                      }`}
                    >
                      Holati: {getStatusConfig(searchResult.status).label}
                    </span>
                  </div>

                  {renderOrderStatusStepper(searchResult.status)}

                  {renderOrderItemsList(searchResult, false)}

                  <div className="pt-3 border-t border-zinc-800 flex items-center justify-between tabular-nums">
                    <span className="font-bold text-zinc-300">Jami to‘lov summasi:</span>
                    <span className="font-racing font-black text-red-400 text-lg">
                      {formatUzbekSum(searchResult.totalAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Shaxsiy xaridlar maxfiyligi himoyalangan</span>
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
