import React from 'react';
import { CarModel, ProductCategory, ProductBrand } from '../types';
import { Search, SlidersHorizontal, Car, Filter, X, ShieldCheck, Camera } from 'lucide-react';

interface FilterBarProps {
  selectedCar: CarModel;
  setSelectedCar: (car: CarModel) => void;
  selectedCategory: ProductCategory;
  setSelectedCategory: (cat: ProductCategory) => void;
  selectedBrand: ProductBrand;
  setSelectedBrand: (brand: ProductBrand) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  totalProductsCount: number;
  carModels: string[];
  categories: string[];
  brands: string[];
  onOpenPartRequest?: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedCar,
  setSelectedCar,
  selectedCategory,
  setSelectedCategory,
  selectedBrand,
  setSelectedBrand,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  totalProductsCount,
  carModels,
  categories,
  brands,
  onOpenPartRequest,
}) => {
  const hasActiveFilters =
    selectedCar !== 'Hammasi' ||
    selectedCategory !== 'Hammasi' ||
    selectedBrand !== 'Hammasi' ||
    searchQuery !== '';

  const handleResetFilters = () => {
    setSelectedCar('Hammasi');
    setSelectedCategory('Hammasi');
    setSelectedBrand('Hammasi');
    setSearchQuery('');
  };

  return (
    <div id="katalog" className="space-y-4 sm:space-y-5 pt-4 sm:pt-8 overflow-x-hidden">
      {/* Title & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-500 mb-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Rasmiy katalog</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-racing font-bold text-white tracking-wide">
            Ehtiyot Qismlar & Tyuning Mahsulotlari
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Jami: <strong className="text-red-400">{totalProductsCount}</strong> ta original va sifatli detal mavjud
          </p>
        </div>

        {/* Search, Sort & Photo Request Controls */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full md:w-auto">
          {/* Search input in catalog (Supports Cyrillic, Latin, Synonyms & OEM Artikul) */}
          <div className="relative w-full sm:w-72">
            <input
              id="catalog-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Qidiruv: nomi, артикул, жентра фара..."
              className="w-full min-h-[44px] bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-2.5 pl-10 text-base sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 transition"
            />
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-xs text-zinc-400 hover:text-white active:scale-95"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex-1 sm:flex-initial min-h-[44px] flex items-center gap-2 bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-zinc-300">
            <SlidersHorizontal className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Saralash tartibi"
              className="w-full bg-transparent text-base sm:text-xs text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="popular" className="bg-zinc-900">Ommaboplar</option>
              <option value="price-asc" className="bg-zinc-900">Narx: arzonroq</option>
              <option value="price-desc" className="bg-zinc-900">Narx: qimmatroq</option>
              <option value="rating" className="bg-zinc-900">Reyting bo‘yicha</option>
            </select>
          </div>

          {onOpenPartRequest && (
            <button
              type="button"
              onClick={onOpenPartRequest}
              className="w-full sm:w-auto min-h-[44px] px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-red-600/20 to-amber-500/20 hover:from-red-600 hover:to-red-700 text-red-300 hover:text-white border border-red-500/50 text-xs font-racing font-bold tracking-wide flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
            >
              <Camera className="w-4 h-4 text-red-400 group-hover:text-white shrink-0" />
              <span className="truncate">Kerakli zapchastni topmadingizmi? Rasmini yuboring!</span>
            </button>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full sm:w-auto min-h-[42px] px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-800 text-red-300 text-xs font-semibold flex items-center justify-center gap-1 transition active:scale-95"
            >
              <X className="w-3.5 h-3.5" />
              <span>Filtrlarni tozalash</span>
            </button>
          )}
        </div>
      </div>

      {/* Car Models, Categories & Brands Filter Panel */}
      <div className="bg-[#0f1118] border border-zinc-800/80 rounded-2xl p-3 sm:p-4 space-y-2.5 sm:space-y-3 overflow-hidden">
        <div className="flex items-center justify-between gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5 text-red-500" />
            <span>Avtomobil modeli bo‘yicha:</span>
          </div>
          <span className="text-[10px] text-zinc-500 sm:hidden font-normal">← suring →</span>
        </div>

        {/* Single-row horizontal swipe for Car Models */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 whitespace-nowrap">
          {carModels.map((car) => {
            const isActive = selectedCar === car;
            return (
              <button
                type="button"
                key={car}
                onClick={() => setSelectedCar(car)}
                className={`min-h-[38px] px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-racing font-bold tracking-wide transition-all shrink-0 cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-900/50 border border-red-500'
                    : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {car === 'Hammasi' ? 'Barcha mashinalar' : car}
              </button>
            );
          })}
        </div>

        {/* Single-row horizontal swipe for Categories */}
        <div className="pt-2 border-t border-zinc-850 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 whitespace-nowrap">
          <span className="text-[11px] uppercase font-bold text-zinc-500 shrink-0">Kategoriya:</span>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                type="button"
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-red-500/20 text-red-400 border border-red-500/60'
                    : 'bg-zinc-900/60 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Single-row horizontal swipe for Brands / Manufacturers */}
        {brands && brands.length > 0 && (
          <div className="pt-2 border-t border-zinc-850 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 whitespace-nowrap">
            <span className="text-[11px] uppercase font-bold text-zinc-500 shrink-0 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Brend:</span>
            </span>
            {brands.map((brand) => {
              const isActive = selectedBrand === brand;
              return (
                <button
                  type="button"
                  key={brand}
                  onClick={() => setSelectedBrand(brand)}
                  className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer active:scale-95 ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-sm shadow-amber-950/50'
                      : 'bg-zinc-900/60 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {brand === 'Hammasi' ? 'Barcha brendlar' : brand}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

