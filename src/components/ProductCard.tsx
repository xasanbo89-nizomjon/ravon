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
import { ProductImagePlaceholder, hasRealProductImage } from './ProductImagePlaceholder';

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
  const [imageError, setImageError] = useState(false);
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

  const showRealImage = hasRealProductImage(product.image) && !imageError;
  const approvedReviews = reviews.filter((r) => r.isApproved !== false);
  const availableStock =
    product.inStock === false
      ? 0
      : typeof product.stock === 'number'
      ? Math.max(0, Math.floor(product.stock))
      : 10;
  const isOutOfStock = !product.inStock || availableStock <= 0;
  const isStockLimitReached = !isOutOfStock && inCartCount >= availableStock;

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
    <div className="group relative min-w-0 bg-[#0f1118] border border-zinc-800/90 hover:border-red-600/70 rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-red-950/30 flex flex-col justify-between">
      {/* Top Image & Badges */}
      <div
        onClick={() => onOpenDetails(product)}
        className="relative aspect-square sm:aspect-4/3 w-full overflow-hidden bg-zinc-950 cursor-pointer"
      >
        {showRealImage ? (
          <>
            <img
              src={product.image}
              alt={product.name}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1118] via-transparent to-black/40"></div>
          </>
        ) : (
          <ProductImagePlaceholder
            name={product.name}
            category={product.category}
            sku={product.sku}
            brand={product.brand}
            variant="card"
          />
        )}

        {/* Top Badges */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 right-16 sm:right-20 flex flex-wrap gap-1 sm:gap-1.5 z-10 pointer-events-none">
          {product.badge && (
            <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-red-600 text-white font-racing text-[9px] sm:text-[10px] font-bold tracking-wider uppercase shadow-md shadow-red-900/50 truncate max-w-full">
              {product.badge}
            </span>
          )}
          <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-zinc-300 text-[10px] font-semibold border border-zinc-700 items-center gap-1 truncate">
            <Tag className="w-2.5 h-2.5 text-red-500 shrink-0" />
            <span className="truncate">{product.category}</span>
          </span>
        </div>

        {/* Bazaar nickname sticker */}
        <div className="absolute bottom-1.5 left-2 right-2 sm:right-auto sm:bottom-2.5 sm:left-3 z-10 pointer-events-none">
          <span className="inline-block max-w-full truncate px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg bg-zinc-900/95 text-red-400 border border-red-900/50 text-[10px] sm:text-xs font-racing font-bold tracking-wide">
            Bozorda: "{product.bazaarName}"
          </span>
        </div>

        {/* Quick Actions (Compare & View) */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex items-center gap-1 sm:gap-1.5 z-10">
          {onToggleCompare && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCompare(product);
              }}
              className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all duration-200 active:scale-95 ${
                isCompared
                  ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/60 opacity-100'
                  : 'bg-black/80 hover:bg-zinc-800 text-zinc-300 hover:text-red-400 border-zinc-700/60 opacity-90 sm:opacity-0 group-hover:opacity-100'
              }`}
              title={isCompared ? 'Taqqoslashdan chiqarish' : "Taqqoslashga qo'shish"}
            >
              <Scale className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(product);
            }}
            className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-black/80 hover:bg-red-600 text-zinc-300 hover:text-white border border-zinc-700/60 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-all duration-200 active:scale-95"
            title="Batafsil ko'rish"
          >
            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Product Content */}
      <div className="p-2.5 sm:p-5 flex-1 flex flex-col justify-between space-y-2 sm:space-y-3 min-w-0">
        <div className="min-w-0">
          {/* Compatible Car Models, SKU & Brand */}
          <div className="flex flex-wrap items-center gap-1 mb-1.5 sm:mb-2 max-h-[38px] sm:max-h-none overflow-hidden">
            {product.sku && (
              <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-700 truncate max-w-full">
                {product.sku}
              </span>
            )}
            {product.brand && (
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 truncate max-w-full">
                {product.brand}
              </span>
            )}
            {product.carModels.slice(0, 2).map((car, idx) => (
              <span
                key={idx}
                className="text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700/50 truncate"
              >
                {car}
              </span>
            ))}
            {product.carModels.length > 2 && (
              <span className="text-[9px] sm:text-[10px] font-semibold px-1 py-0.5 rounded bg-zinc-900 text-zinc-400">
                +{product.carModels.length - 2}
              </span>
            )}
          </div>

          {/* Product Title */}
          <h3
            onClick={() => onOpenDetails(product)}
            className="text-xs sm:text-base font-bold text-white group-hover:text-red-400 transition cursor-pointer line-clamp-2 min-h-[2.25rem] sm:min-h-[2.75rem] leading-snug break-words"
          >
            {product.name}
          </h3>

          {/* Rating & Stock Row */}
          <div className="flex flex-wrap items-center justify-between gap-1 sm:gap-2 mt-1.5 sm:mt-2.5">
            <div className="flex items-center gap-1 min-w-0">
              <div className="flex items-center gap-0.5" title="Baho berish uchun yulduzchani bosing">
                <Star className="w-3 h-3 sm:hidden fill-amber-400 text-amber-400 shrink-0" />
                <div className="hidden sm:flex items-center gap-0.5">
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
              </div>
              <span className="text-amber-400 text-[11px] sm:text-xs font-bold">{displayRating}</span>
              <button
                type="button"
                onClick={() => {
                  if (approvedReviews.length > 0) {
                    setShowReviewsList(!showReviewsList);
                  } else {
                    setIsReviewFormOpen(!isReviewFormOpen);
                  }
                }}
                className="text-zinc-400 hover:text-white text-[10px] sm:text-[11px] underline-offset-2 hover:underline transition truncate"
              >
                ({displayReviewCount})
              </button>
            </div>

            {isOutOfStock ? (
              <span className="text-[10px] sm:text-[11px] text-red-400 font-bold flex items-center gap-0.5 shrink-0">
                Tugagan
              </span>
            ) : (
              <span className="text-[10px] sm:text-[11px] text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                <span>Omborda: {availableStock} ta</span>
              </span>
            )}
          </div>

          {/* Quick Rate & Short Comment Action Bar */}
          <div className="mt-2 pt-1.5 sm:mt-2.5 sm:pt-2 border-t border-zinc-800/60 flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsReviewFormOpen(!isReviewFormOpen);
              }}
              className={`text-[10px] sm:text-[11px] font-semibold px-2 py-1 sm:px-2.5 rounded-lg border flex items-center gap-1 transition truncate active:scale-95 ${
                isReviewFormOpen
                  ? 'bg-red-600/20 text-red-300 border-red-500/50'
                  : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800'
              }`}
            >
              <MessageSquarePlus className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-400 shrink-0" />
              <span className="truncate">{isReviewFormOpen ? 'Yopish' : 'Izoh qoldirish'}</span>
            </button>

            {approvedReviews.length > 0 && (
              <button
                type="button"
                onClick={() => setShowReviewsList(!showReviewsList)}
                className="text-[10px] sm:text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-0.5 shrink-0 transition"
              >
                <span>({approvedReviews.length})</span>
                {showReviewsList ? (
                  <ChevronUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                ) : (
                  <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                )}
              </button>
            )}
          </div>

          {/* Inline Customer Rating & Short Comment Form */}
          {isReviewFormOpen && (
            <form
              onSubmit={handleSubmitReview}
              onClick={(e) => e.stopPropagation()}
              className="mt-2 p-2.5 sm:p-3 rounded-xl bg-zinc-900/95 border border-zinc-700/80 space-y-2 animate-in fade-in duration-150"
            >
              {submittedSuccess ? (
                <div className="py-2.5 text-center space-y-1 text-emerald-400 text-xs font-bold flex flex-col items-center justify-center">
                  <Check className="w-5 h-5 bg-emerald-500/20 text-emerald-400 rounded-full p-1" />
                  <span>Rahmat! Izohingiz saqlandi.</span>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[10px] font-semibold text-zinc-300">Baho:</span>
                    <div className="flex items-center gap-0.5">
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
                              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                                isFilled ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ismingiz"
                      maxLength={40}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 rounded-lg pl-8 pr-2.5 py-1.5 text-base sm:text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Qisqa izoh..."
                      maxLength={160}
                      required
                      className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-red-500 rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-white placeholder-zinc-500 focus:outline-none min-w-0"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 sm:py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-racing font-bold uppercase tracking-wider flex items-center justify-center gap-1 shrink-0 transition active:scale-95"
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
          {approvedReviews.length > 0 && showReviewsList && (
            <div className="mt-2 space-y-1.5">
              {approvedReviews.slice(0, 3).map((rev) => (
                <div
                  key={rev.id}
                  className="p-2 rounded-lg bg-zinc-900/70 border border-zinc-800/80 text-[10px] sm:text-[11px]"
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
              ))}
            </div>
          )}
        </div>

        {/* Price & Actions (Uzum Market style stacked on mobile, side-by-side on desktop) */}
        <div className="pt-2 sm:pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
          <div className="min-w-0">
            {product.originalPrice && (
              <div className="text-[10px] sm:text-xs text-zinc-500 line-through truncate">
                {formatUzbekSum(product.originalPrice)}
              </div>
            )}
            <div className="text-sm sm:text-xl font-racing font-black tracking-wide text-red-500 truncate">
              {formatUzbekSum(product.price)}
            </div>
          </div>

          <button
            type="button"
            disabled={isOutOfStock || isStockLimitReached}
            onClick={() => {
              if (isOutOfStock || isStockLimitReached) return;
              onAddToCart(product);
            }}
            className={`w-full sm:w-auto min-h-[38px] sm:min-h-[42px] px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-racing text-[11px] sm:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 ${
              isOutOfStock
                ? 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed opacity-75'
                : isStockLimitReached
                ? 'bg-zinc-800 text-amber-400 border border-amber-600/50 cursor-not-allowed'
                : inCartCount > 0
                ? 'bg-zinc-800 text-red-400 border border-red-600/50 hover:bg-zinc-700'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40 hover:shadow-red-600/30'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">
              {isOutOfStock
                ? 'Tugagan'
                : isStockLimitReached
                ? `Savatda (${inCartCount}/${availableStock})`
                : inCartCount > 0
                ? `Savatda (${inCartCount})`
                : 'Savatga'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
