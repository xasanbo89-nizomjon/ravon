import React from 'react';
import { ShoppingBag, Eye, Star, CheckCircle, Tag, Scale } from 'lucide-react';
import { Product } from '../types';
import { formatUzbekSum } from '../utils/formatters';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onOpenDetails: (product: Product) => void;
  inCartCount?: number;
  isCompared?: boolean;
  onToggleCompare?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onOpenDetails,
  inCartCount = 0,
  isCompared = false,
  onToggleCompare,
}) => {
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
              title={isCompared ? "Taqqoslashdan chiqarish" : "Taqqoslashga qo'shish"}
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

          {/* Rating */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center text-amber-400 text-xs font-bold gap-0.5">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>{product.rating}</span>
            </div>
            <span className="text-zinc-500 text-xs">({product.reviewCount} ta sharh)</span>
            <span className="text-xs text-emerald-400 font-medium ml-auto flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Omborda bor
            </span>
          </div>
        </div>

        {/* Price & Actions */}
        <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
          <div>
            {product.originalPrice && (
              <div className="text-xs text-zinc-500 line-through">
                {formatUzbekSum(product.originalPrice)}
              </div>
            )}
            <div className="text-lg sm:text-xl font-racing font-black text-white tracking-wide text-red-500">
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
            <span>{inCartCount > 0 ? `Savatda (${inCartCount})` : "Savatga"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
