import React, { useState } from 'react';
import {
  ShoppingBag,
  Eye,
  Star,
  CheckCircle,
  Tag,
  Scale,
  MessageSquarePlus,
  Send,
  User,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import { Product, ProductReview } from '../types';
import { formatUzbekSum } from '../utils/formatters';
import { triggerHaptic } from '../utils/telegramWebApp';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onOpenDetails: (product: Product) => void;
  inCartCount?: number;
  isCompared?: boolean;
  onToggleCompare?: (product: Product) => void;
  reviews?: ProductReview[];
  onAddReview?: (product: Product, rating: number, customerName: string, comment: string) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: '1 - Yomon',
  2: '2 - Qoniqarsiz',
  3: "3 - O'rtacha",
  4: '4 - Yaxshi',
  5: "5 - A'lo",
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onOpenDetails,
  inCartCount = 0,
  isCompared = false,
  onToggleCompare,
  reviews = [],
  onAddReview,
}) => {
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [showReviewsList, setShowReviewsList] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>(() => {
    try {
      return localStorage.getItem('ravon_reviewer_name') || '';
    } catch {
      return '';
    }
  });
  const [comment, setComment] = useState<string>('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

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

  const handleStarClick = (star: number) => {
    triggerHaptic('selection');
    setSelectedRating(star);
    if (!isReviewFormOpen) {
      setIsReviewFormOpen(true);
    }
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddReview) return;

    const finalName = customerName.trim() || 'Xaridor';
    const finalComment = comment.trim() || `${RATING_LABELS[selectedRating] || "A'lo"} mahsulot!`;

    try {
      if (customerName.trim()) {
        localStorage.setItem('ravon_reviewer_name', customerName.trim());
      }
    } catch {}

    triggerHaptic('success');
    onAddReview(product, selectedRating, finalName, finalComment);
    setComment('');
    setSubmittedSuccess(true);
    setTimeout(() => {
      setSubmittedSuccess(false);
      setIsReviewFormOpen(false);
      setShowReviewsList(true);
    }, 1200);
  };

  return (
    <div className="group relative bg-[#0f1118] border border-zinc-800/90 hover:border-red-600/70 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-red-950/30 flex flex-col justify-between">
      {/* Top Image & Badges */}
      <div className="relative aspect-4/3 w-full overflow-hidden bg-zinc-950">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1118] via-transparent to-black/40"></div>

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
          {product.badge && (
            <span className="px-2.5 py-1 rounded-md bg-red-600 text-white font-racing text-[10px] font-bold tracking-wider uppercase shadow-md shadow-red-900/50">
              {product.badge}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-zinc-300 text-[10px] font-semibold border border-zinc-700 flex items-center gap-1">
            <Tag className="w-2.5 h-2.5 text-red-500" />
            {product.category}
          </span>
        </div>

        {/* Bazaar nickname sticker */}
        <div className="absolute bottom-2.5 left-3 z-10">
          <span className="px-2.5 py-1 rounded-lg bg-zinc-900/95 backdrop-blur-md text-red-400 border border-red-900/50 text-xs font-racing font-bold tracking-wide">
            Bozorda: "{product.bazaarName}"
          </span>
        </div>

        {/* Quick Actions (Compare & View) */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
          {onToggleCompare && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCompare(product);
              }}
              className={`p-2 rounded-xl backdrop-blur-md border transition-all duration-200 ${
                isCompared
                  ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/60 opacity-100 scale-105'
                  : 'bg-black/75 hover:bg-zinc-800 text-zinc-300 hover:text-red-400 border-zinc-700/60 opacity-80 sm:opacity-0 group-hover:opacity-100'
              }`}
              title={isCompared ? 'Taqqoslashdan chiqarish' : "Taqqoslashga qo'shish"}
            >
              <Scale className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(product);
            }}
            className="p-2 rounded-xl bg-black/75 hover:bg-red-600 text-zinc-300 hover:text-white backdrop-blur-md border border-zinc-700/60 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-all duration-200"
            title="Batafsil ko'rish"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Product Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Compatible Car Models */}
          <div className="flex flex-wrap gap-1 mb-2">
            {product.carModels.map((car, idx) => (
              <span
                key={idx}
                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700/50"
              >
                {car}
              </span>
            ))}
          </div>

          {/* Product Title */}
          <h3
            onClick={() => onOpenDetails(product)}
            className="text-sm sm:text-base font-bold text-white group-hover:text-red-400 transition cursor-pointer line-clamp-2 leading-snug"
          >
            {product.name}
          </h3>

          {/* Rating & Stock Row */}
          <div className="flex items-center justify-between gap-2 mt-2.5">
            <div className="flex items-center gap-1.5">
              {/* Interactive 5 stars on card */}
              <div className="flex items-center gap-0.5" title="Baho berish uchun yulduzchani bosing">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= Math.round(displayRating);
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleStarClick(star)}
                      className="p-0.5 hover:scale-125 transition-transform focus:outline-none"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          active ? 'fill-amber-400 text-amber-400' : 'text-zinc-600 hover:text-amber-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <span className="text-amber-400 text-xs font-bold">{displayRating}</span>
              <button
                type="button"
                onClick={() => {
                  if (approvedReviews.length > 0) {
                    setShowReviewsList(!showReviewsList);
                  } else {
                    setIsReviewFormOpen(!isReviewFormOpen);
                  }
                }}
                className="text-zinc-400 hover:text-white text-[11px] underline-offset-2 hover:underline transition"
              >
                ({displayReviewCount} ta izoh)
              </button>
            </div>

            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 shrink-0">
              <CheckCircle className="w-3 h-3" /> Bor
            </span>
          </div>

          {/* Quick Rate & Short Comment Action Bar */}
          <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsReviewFormOpen(!isReviewFormOpen);
              }}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition ${
                isReviewFormOpen
                  ? 'bg-red-600/20 text-red-300 border-red-500/50'
                  : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800'
              }`}
            >
              <MessageSquarePlus className="w-3.5 h-3.5 text-red-400" />
              <span>{isReviewFormOpen ? 'Yopish' : 'Baho va izoh qoldirish'}</span>
            </button>

            {approvedReviews.length > 0 && (
              <button
                type="button"
                onClick={() => setShowReviewsList(!showReviewsList)}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition"
              >
                <span>Izohlar ({approvedReviews.length})</span>
                {showReviewsList ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          {/* Inline Customer Rating & Short Comment Form */}
          {isReviewFormOpen && (
            <form
              onSubmit={handleSubmitReview}
              onClick={(e) => e.stopPropagation()}
              className="mt-2.5 p-3 rounded-xl bg-zinc-900/95 border border-zinc-700/80 space-y-2.5 animate-in fade-in duration-150"
            >
              {submittedSuccess ? (
                <div className="py-3 text-center space-y-1 text-emerald-400 text-xs font-bold flex flex-col items-center justify-center">
                  <Check className="w-5 h-5 bg-emerald-500/20 text-emerald-400 rounded-full p-1" />
                  <span>Rahmat! Baho va izohingiz saqlandi.</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-zinc-300">Bahoyingiz:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isFilled = star <= (hoverRating || selectedRating);
                        return (
                          <button
                            key={star}
                            type="button"
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setSelectedRating(star)}
                            className="p-0.5 transition-transform hover:scale-110"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                isFilled ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'
                              }`}
                            />
                          </button>
                        );
                      })}
                      <span className="text-[10px] font-bold text-amber-400 ml-1">
                        {RATING_LABELS[hoverRating || selectedRating]}
                      </span>
                    </div>
                  </div>

                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ismingiz (masalan: Azizbek)"
                      maxLength={40}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Qisqa izoh qoldiring..."
                      maxLength={160}
                      required
                      className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-red-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-racing font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 transition"
                    >
                      <Send className="w-3 h-3" />
                      <span>Yuborish</span>
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* Recent Customer Reviews Preview on Card */}
          {approvedReviews.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {(showReviewsList ? approvedReviews.slice(0, 4) : approvedReviews.slice(0, 1)).map(
                (rev) => (
                  <div
                    key={rev.id}
                    className="p-2 rounded-lg bg-zinc-900/70 border border-zinc-800/80 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-zinc-200 truncate">{rev.customerName}</span>
                      <div className="flex items-center gap-0.5 text-amber-400 shrink-0">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Star key={i} className="w-2.5 h-2.5 fill-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-zinc-400 line-clamp-2 mt-0.5 leading-snug">"{rev.comment}"</p>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Price & Actions */}
        <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
          <div>
            {product.originalPrice && (
              <div className="text-xs text-zinc-500 line-through">
                {formatUzbekSum(product.originalPrice)}
              </div>
            )}
            <div className="text-lg sm:text-xl font-racing font-black tracking-wide text-red-500">
              {formatUzbekSum(product.price)}
            </div>
          </div>

          <button
            onClick={() => onAddToCart(product)}
            className={`px-3.5 py-2.5 rounded-xl font-racing text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
              inCartCount > 0
                ? 'bg-zinc-800 text-red-400 border border-red-600/50 hover:bg-zinc-700'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40 hover:shadow-red-600/30'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{inCartCount > 0 ? `Savatda (${inCartCount})` : 'Savatga'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
