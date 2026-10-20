import React, { useState } from 'react';
import { 
  X, 
  Scale, 
  Trash2, 
  ShoppingBag, 
  Eye, 
  Check, 
  Car, 
  Tag, 
  Star, 
  Plus, 
  Search, 
  Sparkles, 
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  Equal,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Product } from '../types';
import { formatUzbekSum } from '../utils/formatters';
import { triggerHaptic } from '../utils/telegramWebApp';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  compareItems: Product[];
  onRemoveFromCompare: (productId: string) => void;
  onClearCompare: () => void;
  onAddToCart: (product: Product) => void;
  onOpenDetails: (product: Product) => void;
  allProducts: Product[];
  onAddProductToCompare: (product: Product) => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  isOpen,
  onClose,
  compareItems,
  onRemoveFromCompare,
  onClearCompare,
  onAddToCart,
  onOpenDetails,
  allProducts,
  onAddProductToCompare,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Filter available products to add to compare
  const availableToAdd = allProducts.filter(
    (p) => !compareItems.some((c) => c.id === p.id) &&
           (searchQuery.trim() === '' || 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            p.bazaarName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Extract all unique spec keys across compared products
  const allSpecKeys = Array.from(
    new Set(
      compareItems.flatMap((p) => (p.specs || []).map((s) => s.label))
    )
  );

  // Calculate price difference between first two products if available
  const p1 = compareItems[0];
  const p2 = compareItems[1];
  const priceDiff = p1 && p2 ? Math.abs(p1.price - p2.price) : 0;
  const cheaperProduct = p1 && p2 ? (p1.price < p2.price ? p1 : p2.price < p1.price ? p2 : null) : null;
  const pricePercent = p1 && p2 && Math.max(p1.price, p2.price) > 0
    ? Math.round((priceDiff / Math.max(p1.price, p2.price)) * 100)
    : 0;

  // Copy comparison summary to clipboard
  const handleCopySummary = () => {
    if (compareItems.length === 0) return;
    triggerHaptic('light');

    let text = `⚖️ RAVON AUTO TUNING — TAQQOSLASH NATIJASI\n━━━━━━━━━━━━━━━━━━━━\n`;
    compareItems.forEach((p, idx) => {
      text += `${idx + 1}. "${p.bazaarName}" (${p.name})\n`;
      text += `   💰 Narxi: ${formatUzbekSum(p.price)}\n`;
      text += `   🚗 Mos mashinalar: ${p.carModels.join(', ')}\n`;
      text += `   ⭐ Reyting: ${p.rating} (${p.reviewCount} sharh)\n\n`;
    });

    if (p1 && p2) {
      if (priceDiff > 0 && cheaperProduct) {
        text += `📊 Narx bo‘yicha xulosa: "${cheaperProduct.bazaarName}" ${formatUzbekSum(priceDiff)} (${pricePercent}%) arzonroq!\n`;
      } else {
        text += `📊 Narx bo‘yicha xulosa: Har ikkala detal bir xil narxda.\n`;
      }
    }
    text += `━━━━━━━━━━━━━━━━━━━━\nBatafsil do'konimizda: https://t.me/RavonAutoTuningUz`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div 
        className="relative w-full max-w-5xl bg-[#0d0f17] border border-zinc-700/80 rounded-3xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-6 bg-zinc-950/90 border-b border-zinc-800 flex items-center justify-between gap-4 sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-500 shadow-lg shadow-red-900/30">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-racing font-bold text-white tracking-wide">
                  Ehtiyot Qismlarini Taqqoslash
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-racing text-[11px] font-bold">
                  {compareItems.length} ta detal
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Narxi, texnik parametrlari va mos keluvchi avtomobillar bo‘yicha solishtiring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {compareItems.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 hover:text-white border border-zinc-800 transition"
                  title="Taqqoslash matnini nusxalash"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{copied ? "Nusxalandi!" : "Xulosani olish"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('medium');
                    onClearCompare();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-red-950/60 text-xs text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-800/60 transition flex items-center gap-1"
                  title="Barchasini tozalash"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tozalash</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-zinc-900 hover:bg-red-600 text-zinc-400 hover:text-white border border-zinc-800 transition"
              title="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Price Difference Highlight Banner (If 2 products compared) */}
        {p1 && p2 && (
          <div className="bg-gradient-to-r from-red-950/60 via-zinc-900 to-amber-950/40 border-b border-zinc-800 px-4 sm:px-6 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              {priceDiff > 0 ? (
                <TrendingDown className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Equal className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className="text-zinc-200">
                {priceDiff > 0 && cheaperProduct ? (
                  <>
                    <strong className="text-emerald-400 font-bold">"{cheaperProduct.bazaarName}"</strong> detali boshqasiga qaraganda{' '}
                    <strong className="text-white font-racing">{formatUzbekSum(priceDiff)} ({pricePercent}%) arzonroq!</strong>
                  </>
                ) : (
                  <span className="text-zinc-300 font-medium">Ikkala mahsulot ham bir xil narx toifasida.</span>
                )}
              </span>
            </div>

            {compareItems.length < 4 && (
              <button
                onClick={() => setIsPickerOpen(true)}
                className="text-[11px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1 ml-auto"
              >
                <Plus className="w-3 h-3" /> Yana detal qo‘shish ({compareItems.length}/4)
              </button>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* EMPTY STATE: No items selected */}
          {compareItems.length === 0 && (
            <div className="py-12 px-4 text-center max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
                <ArrowLeftRight className="w-8 h-8 text-zinc-600" />
              </div>
              <div>
                <h3 className="text-lg font-racing font-bold text-white mb-1">
                  Taqqoslash uchun zapchast tanlanmagan
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Katalogdagi mahsulot kartalarida joylashgan <strong className="text-red-400">Taqqoslash</strong> tugmasini bosib, kamida 2 ta detalni bir-biri bilan solishtirishingiz mumkin.
                </p>
              </div>

              <button
                onClick={() => setIsPickerOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-racing font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 mx-auto shadow-lg shadow-red-900/30 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Katalogdan tanlash</span>
              </button>
            </div>
          )}

          {/* SINGLE ITEM STATE: Prompt to add second item */}
          {compareItems.length === 1 && (
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/50 text-amber-200 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Solishtirish uchun yana bitta detal tanlang. O‘ng tomondagi <strong>"+ Detal qo‘shish"</strong> tugmasini bosing.
                </span>
              </div>
              <button
                onClick={() => setIsPickerOpen(true)}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-racing font-bold text-xs shrink-0"
              >
                + Ikkinchi detalni tanlash
              </button>
            </div>
          )}

          {/* MAIN COMPARISON GRID */}
          {compareItems.length > 0 && (
            <div className="space-y-6">
              
              {/* Product Cards Row */}
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${compareItems.length >= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} ${compareItems.length >= 4 ? 'xl:grid-cols-4' : ''} gap-4`}>
                {compareItems.map((product) => (
                  <div 
                    key={product.id}
                    className="bg-[#121520] border-2 border-zinc-800 hover:border-red-600/50 rounded-2xl p-4 flex flex-col justify-between relative group shadow-xl transition"
                  >
                    {/* Remove button */}
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        onRemoveFromCompare(product.id);
                      }}
                      className="absolute top-3 right-3 p-1.5 rounded-lg bg-zinc-900/90 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 border border-zinc-700/60 z-10 transition"
                      title="Taqqoslashdan chiqarish"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="space-y-3">
                      {/* Product Image */}
                      <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-black/60 flex items-center justify-center border border-zinc-800">
                        <img 
                          src={product.image} 
                          alt={product.name}
                          className="max-h-full max-w-full object-cover group-hover:scale-105 transition duration-300" 
                        />
                        {product.badge && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-600 text-white font-racing text-[9px] font-bold uppercase">
                            {product.badge}
                          </span>
                        )}
                      </div>

                      {/* Bazaar Name & Category */}
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-red-400 font-racing">
                          Bozorda: "{product.bazaarName}"
                        </div>
                        <h4 
                          onClick={() => onOpenDetails(product)}
                          className="text-sm font-bold text-white hover:text-red-400 transition cursor-pointer line-clamp-2 mt-0.5"
                        >
                          {product.name}
                        </h4>
                      </div>

                      {/* Price Tag */}
                      <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-zinc-500 uppercase font-medium">Narxi:</div>
                          <div className="text-base sm:text-lg font-racing font-black text-red-500">
                            {formatUzbekSum(product.price)}
                          </div>
                        </div>
                        {product.originalPrice && (
                          <div className="text-right">
                            <div className="text-[10px] text-zinc-500 line-through">
                              {formatUzbekSum(product.originalPrice)}
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950 text-red-400 font-bold">
                              Chegirma
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick action buttons */}
                    <div className="pt-3 border-t border-zinc-850 grid grid-cols-2 gap-2 mt-3">
                      <button
                        onClick={() => {
                          triggerHaptic('medium');
                          onAddToCart(product);
                        }}
                        className="py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-racing font-bold text-xs uppercase flex items-center justify-center gap-1.5 shadow-md shadow-red-950 transition active:scale-95"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Savatga</span>
                      </button>

                      <button
                        onClick={() => onOpenDetails(product)}
                        className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs flex items-center justify-center gap-1 border border-zinc-800 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Batafsil</span>
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add product card slot if less than 4 items */}
                {compareItems.length < 4 && (
                  <div 
                    onClick={() => setIsPickerOpen(true)}
                    className="border-2 border-dashed border-zinc-800 hover:border-red-500/70 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[280px] bg-zinc-950/40 hover:bg-zinc-900/40 group transition"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 group-hover:border-red-500/50 flex items-center justify-center text-zinc-400 group-hover:text-red-400 group-hover:scale-110 transition mb-3">
                      <Plus className="w-6 h-6" />
                    </div>
                    <div className="font-racing font-bold text-sm text-white group-hover:text-red-400">
                      Yana detal qo‘shish
                    </div>
                    <p className="text-xs text-zinc-500 max-w-[180px] mt-1">
                      Katalogdan boshqa qismni tanlab, yonma-yon solishtiring
                    </p>
                  </div>
                )}
              </div>

              {/* DETAILED COMPARISON TABLE */}
              <div className="bg-[#10121c] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-3.5 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between">
                  <span className="font-racing font-bold text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-red-500" />
                    Xususiyatlar Bo‘yicha Solishtirish Jadvali
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <tbody>
                      {/* 1. Bazaar Name Row */}
                      <tr className="border-b border-zinc-850 hover:bg-zinc-900/40">
                        <td className="p-3.5 font-bold text-zinc-400 bg-zinc-950/40 w-44 shrink-0">
                          Bozordagi Laqabi
                        </td>
                        {compareItems.map((p) => (
                          <td key={p.id} className="p-3.5 font-racing font-bold text-red-400 text-sm">
                            "{p.bazaarName}"
                          </td>
                        ))}
                      </tr>

                      {/* 2. Category Row */}
                      <tr className="border-b border-zinc-850 hover:bg-zinc-900/40">
                        <td className="p-3.5 font-bold text-zinc-400 bg-zinc-950/40">
                          Kategoriya
                        </td>
                        {compareItems.map((p) => (
                          <td key={p.id} className="p-3.5 text-zinc-200 font-semibold">
                            {p.category}
                          </td>
                        ))}
                      </tr>

                      {/* 3. Compatible Cars Row */}
                      <tr className="border-b border-zinc-850 hover:bg-zinc-900/40">
                        <td className="p-3.5 font-bold text-zinc-400 bg-zinc-950/40">
                          Mos keluvchi mashinalar
                        </td>
                        {compareItems.map((p) => (
                          <td key={p.id} className="p-3.5">
                            <div className="flex flex-wrap gap-1">
                              {p.carModels.map((car, idx) => (
                                <span 
                                  key={idx}
                                  className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-semibold border border-zinc-700/60"
                                >
                                  {car}
                                </span>
                              ))}
                            </div>
                          </td>
                        ))}
                      </tr>

                      {/* 4. Price & Economy Row */}
                      <tr className="border-b border-zinc-850 hover:bg-zinc-900/40">
                        <td className="p-3.5 font-bold text-zinc-400 bg-zinc-950/40">
                          Narx & Tejamkorlik
                        </td>
                        {compareItems.map((p) => (
                          <td key={p.id} className="p-3.5">
                            <div className="font-racing font-black text-white text-sm">
                              {formatUzbekSum(p.price)}
                            </div>
                            {p === cheaperProduct && priceDiff > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-0.5">
                                <CheckCircle2 className="w-3 h-3" /> Eng arzon variant (-{formatUzbekSum(priceDiff)})
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>

                      {/* 5. Rating & Reviews Row */}
                      <tr className="border-b border-zinc-850 hover:bg-zinc-900/40">
                        <td className="p-3.5 font-bold text-zinc-400 bg-zinc-950/40">
                          Reyting & Sharhlar
                        </td>
                        {compareItems.map((p) => (
                          <td key={p.id} className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              <span className="font-bold text-white">{p.rating}</span>
                              <span className="text-zinc-500 text-[11px]">({p.reviewCount} ta sharh)</span>
                            </div>
                          </td>
                        ))}
                      </tr>

                      {/* 6. In-Stock Availability Row */}
                      <tr className="border-b border-zinc-850 hover:bg-zinc-900/40">
                        <td className="p-3.5 font-bold text-zinc-400 bg-zinc-950/40">
                          Ombordagi Holati
                        </td>
                        {compareItems.map((p) => (
                          <td key={p.id} className="p-3.5">
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-xs">
                              <ShieldCheck className="w-3.5 h-3.5" /> Omborda mavjud (Tezkor yetkazish)
                            </span>
                          </td>
                        ))}
                      </tr>

                      {/* 7. Dynamic Technical Specifications (specs) */}
                      {allSpecKeys.map((key) => (
                        <tr key={key} className="border-b border-zinc-850 hover:bg-zinc-900/40">
                          <td className="p-3.5 font-bold text-zinc-400 bg-zinc-950/40">
                            {key}
                          </td>
                          {compareItems.map((p) => {
                            const spec = (p.specs || []).find((s) => s.label === key);
                            return (
                              <td key={p.id} className="p-3.5 text-zinc-200">
                                {spec ? (
                                  <span className="font-medium text-white">{spec.value}</span>
                                ) : (
                                  <span className="text-zinc-500 italic">Standart</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* 8. Short Description Row */}
                      <tr className="hover:bg-zinc-900/40">
                        <td className="p-3.5 font-bold text-zinc-400 bg-zinc-950/40 align-top">
                          Tavsif & Ma'lumot
                        </td>
                        {compareItems.map((p) => (
                          <td key={p.id} className="p-3.5 text-zinc-300 text-[11px] leading-relaxed align-top">
                            {p.description}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Product Picker Modal / Drawer (when user clicks + to add another product) */}
        {isPickerOpen && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-40 p-4 sm:p-6 flex flex-col justify-between animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-red-500" />
                <h3 className="font-racing font-bold text-lg text-white">
                  Taqqoslashga mahsulot qo‘shish
                </h3>
              </div>
              <button
                onClick={() => setIsPickerOpen(false)}
                className="p-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="py-3">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Zapchast nomi yoki mashina modelini yozing..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 pl-10 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  autoFocus
                />
              </div>
            </div>

            {/* List of Available Products */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pr-1 py-2">
              {availableToAdd.map((product) => (
                <div 
                  key={product.id}
                  onClick={() => {
                    triggerHaptic('medium');
                    onAddProductToCompare(product);
                    setIsPickerOpen(false);
                  }}
                  className="bg-zinc-900/80 border border-zinc-800 hover:border-red-500/80 rounded-xl p-3 flex gap-3 items-center cursor-pointer group transition"
                >
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-14 h-14 rounded-lg object-cover bg-black border border-zinc-800 shrink-0" 
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-red-400 font-bold uppercase truncate font-racing">
                      "{product.bazaarName}"
                    </div>
                    <div className="text-xs font-semibold text-white truncate group-hover:text-red-300">
                      {product.name}
                    </div>
                    <div className="text-xs font-racing font-bold text-red-500 mt-1">
                      {formatUzbekSum(product.price)}
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-zinc-500 group-hover:text-red-400 shrink-0" />
                </div>
              ))}

              {availableToAdd.length === 0 && (
                <div className="col-span-full py-8 text-center text-xs text-zinc-500">
                  Mos mahsulot topilmadi yoki barchasi qo‘shilgan.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800 text-right">
              <button
                onClick={() => setIsPickerOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
              >
                Yopish
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
