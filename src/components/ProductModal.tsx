import React, { useState } from 'react';
import {
  X,
  ShoppingBag,
  Check,
  Star,
  ShieldCheck,
  Truck,
  Phone,
  MessageSquare,
  Scale,
  Send,
  User,
} from 'lucide-react';
import { Product, ProductReview } from '../types';
import { formatUzbekSum } from '../utils/formatters';
import { triggerHaptic } from '../utils/telegramWebApp';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  isCompared?: boolean;
  onToggleCompare?: (product: Product) => void;
  reviews?: ProductReview[];
  onAddReview?: (product: Product, rating: number, customerName: string, comment: string) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  onClose,
  onAddToCart,
  isCompared = false,
  onToggleCompare,
  reviews = [],
  onAddReview,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedRating, setSelectedRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [customerName, setCustomerName] = useState(() => {
    try {
      return localStorage.getItem('ravon_reviewer_name') || '';
    } catch {
      return '';
    }
  });
  const [comment, setComment] = useState('');

  if (!product) return null;

  const approvedReviews = reviews.filter((r) => r.isApproved !== false);

  const displayRating =
    approvedReviews.length > 0
      ? Number(
          (
            approvedReviews.reduce((acc, item) => acc + Number(item.rating || 5), 0) /
            approvedReviews.length
          ).toFixed(1)
        )
      : product.rating || 5.0;

  const displayReviewCount =
    approvedReviews.length > 0 ? approvedReviews.length : product.reviewCount || 0;

  const handleAdd = () => {
    onAddToCart(product, quantity);
    onClose();
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddReview || !comment.trim()) return;
    const finalName = customerName.trim() || 'Xaridor';
    try {
      if (customerName.trim()) {
        localStorage.setItem('ravon_reviewer_name', customerName.trim());
      }
    } catch {}
    triggerHaptic('success');
    onAddReview(product, selectedRating, finalName, comment.trim());
    setComment('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div
        className="relative w-full max-w-3xl bg-[#0f1118] border border-zinc-700 rounded-3xl overflow-hidden shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-zinc-900/90 hover:bg-red-600 text-zinc-400 hover:text-white border border-zinc-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left: Product Image */}
          <div className="relative aspect-square md:aspect-auto bg-black flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-zinc-800">
            <img
              src={product.image}
              alt={product.name}
              className="max-h-[380px] w-full object-contain rounded-xl"
            />
            {product.badge && (
              <span className="absolute top-4 left-4 px-3 py-1 rounded-md bg-red-600 text-white font-racing text-xs font-bold uppercase tracking-wider">
                {product.badge}
              </span>
            )}
            <div className="absolute bottom-4 left-4 right-4 bg-zinc-950/80 backdrop-blur-md p-2.5 rounded-xl border border-zinc-800 text-center">
              <span className="text-xs text-zinc-400">Bozordagi mashhur nomi: </span>
              <span className="text-sm font-racing font-bold text-red-400">
                "{product.bazaarName}"
              </span>
            </div>
          </div>

          {/* Right: Product Specs & Buy */}
          <div className="p-6 sm:p-8 flex flex-col justify-between space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {product.brand && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 text-xs font-bold">
                      Brend: {product.brand}
                    </span>
                  )}
                  {product.carModels.map((car, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-xs font-semibold"
                    >
                      {car}
                    </span>
                  ))}
                  <span className="px-2.5 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/60 text-xs font-semibold">
                    {product.category}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-racing font-bold text-white leading-tight">
                  {product.name}
                </h2>

                <div className="flex items-center gap-2 mt-2">
                  <div className="flex text-amber-400 text-xs font-bold items-center gap-1">
                    <Star className="w-4 h-4 fill-amber-400" />
                    <span>{displayRating}</span>
                  </div>
                  <span className="text-xs text-zinc-500">({displayReviewCount} ta sharh)</span>
                  <span className="text-xs text-emerald-400 font-semibold ml-auto flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Omborda mavjud
                  </span>
                </div>
              </div>

              {/* Price */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs text-zinc-400">Donasi narxi:</div>
                  <div className="text-2xl font-racing font-black text-red-500">
                    {formatUzbekSum(product.price)}
                  </div>
                </div>
                {product.originalPrice && (
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">Eski narx:</div>
                    <div className="text-sm text-zinc-500 line-through">
                      {formatUzbekSum(product.originalPrice)}
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                {product.description}
              </p>

              {/* Specs List */}
              {product.specs && product.specs.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    Xususiyatlari:
                  </div>
                  {product.specs.map((spec, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between text-xs py-1 border-b border-zinc-850"
                    >
                      <span className="text-zinc-400">{spec.label}</span>
                      <span className="font-semibold text-zinc-200 text-right">{spec.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Customer Reviews & Rating Section */}
              {onAddReview && (
                <div className="pt-3 border-t border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-red-500" />
                      <span>Mijozlar bahosi va izohlari ({approvedReviews.length})</span>
                    </div>
                  </div>

                  <form
                    onSubmit={handleReviewSubmit}
                    className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Baholang:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const active = star <= (hoverRating || selectedRating);
                          return (
                            <button
                              key={star}
                              type="button"
                              onMouseEnter={() => setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(0)}
                              onClick={() => setSelectedRating(star)}
                              className="p-0.5 hover:scale-110 transition-transform"
                            >
                              <Star
                                className={`w-4 h-4 ${
                                  active ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Ismingiz"
                          maxLength={40}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-zinc-500"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Qisqa izoh yozing..."
                          maxLength={160}
                          required
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-racing font-bold uppercase flex items-center gap-1 shrink-0 transition"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </form>

                  {approvedReviews.length > 0 && (
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {approvedReviews.map((rev) => (
                        <div
                          key={rev.id}
                          className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">{rev.customerName}</span>
                            <div className="flex items-center gap-0.5 text-amber-400">
                              {Array.from({ length: rev.rating }).map((_, idx) => (
                                <Star key={idx} className="w-3 h-3 fill-amber-400" />
                              ))}
                            </div>
                          </div>
                          <p className="text-zinc-300 text-[11px]">"{rev.comment}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Extra guarantees */}
              <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-red-500" />
                  <span>Sifat kafolati</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-red-500" />
                  <span>O‘zbekiston bo‘ylab yetkazish</span>
                </div>
              </div>
            </div>

            {/* Quantity & CTA */}
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-zinc-700 rounded-xl bg-zinc-900 overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3.5 py-2 text-zinc-300 hover:bg-zinc-800 text-base font-bold transition"
                  >
                    -
                  </button>
                  <span className="px-4 py-2 text-white font-racing font-bold text-sm">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3.5 py-2 text-zinc-300 hover:bg-zinc-800 text-base font-bold transition"
                  >
                    +
                  </button>
                </div>

                {onToggleCompare && (
                  <button
                    type="button"
                    onClick={() => onToggleCompare(product)}
                    className={`p-3 rounded-xl border flex items-center justify-center transition ${
                      isCompared
                        ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/50'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-red-400 border-zinc-700'
                    }`}
                    title={
                      isCompared ? 'Taqqoslashdan chiqarish' : 'Boshqa detal bilan taqqoslash'
                    }
                  >
                    <Scale className="w-5 h-5" />
                  </button>
                )}

                <button
                  onClick={handleAdd}
                  className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-racing font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-900/50 active:scale-95 transition"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Savatga ({formatUzbekSum(product.price * quantity)})</span>
                </button>
              </div>

              {/* Consultation hotline */}
              <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
                <span>Savolingiz bormi? Mutaxassis maslahati:</span>
                <a
                  href="tel:+998954633736"
                  className="text-red-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Phone className="w-3 h-3" /> +998 (95) 463-37-36
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
