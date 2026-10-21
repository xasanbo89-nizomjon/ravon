import React from 'react';
import { Gauge, Phone, MapPin, Clock, MessageSquare, ShieldCheck, Truck, Wrench, RefreshCw, Heart, Lock, ExternalLink, Receipt } from 'lucide-react';
import { SiteSettings } from '../types';

interface FooterProps {
  siteSettings: SiteSettings;
  onOpenAdminLogin: () => void;
  onOpenMyOrders?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  siteSettings,
  onOpenAdminLogin,
  onOpenMyOrders,
}) => {
  return (
    <footer className="bg-[#050608] border-t border-zinc-800 text-zinc-400 text-xs pt-12 pb-8">
      {/* Advantage Features Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs">100% Sifat Kafolati</h4>
              <p className="text-[11px] text-zinc-400">Faqat sinalgan original ehtiyot qismlar</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs">Tezkor Yetkazish</h4>
              <p className="text-[11px] text-zinc-400">
                Namangan viloyati, Uychi tumani va O‘zbekiston bo‘ylab tezkor yetkazish
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs">Usta Maslahati</h4>
              <p className="text-[11px] text-zinc-400">O‘rnatish va moslash bo‘yicha bepul yordam</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs">Kafolatli Almashtirish</h4>
              <p className="text-[11px] text-zinc-400">Mos tushmasa 14 kun ichida almashtiramiz</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-zinc-850">
        
        {/* Brand Col */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white font-racing">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <span className="font-racing text-xl font-bold text-white">{siteSettings.brandLogoWord1}</span>{' '}
              <span className="font-racing text-xl font-bold text-red-500">{siteSettings.brandLogoWord2}</span>
            </div>
          </div>
          <p className="text-zinc-400 text-xs leading-relaxed">
            <strong className="text-zinc-200">Biz haqimizda:</strong> {siteSettings.shopName} — <strong className="text-zinc-200">Namangan viloyati, Uychi tumanida</strong> joylashgan barcha GM va Ravon modellari uchun sifatli ehtiyot qismlar, zamonaviy tyuning detallari va AI yordamida zapchast qidiruv markazi.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <span className="px-2 py-1 rounded bg-zinc-900 text-zinc-300 font-bold text-[10px]">Click</span>
            <span className="px-2 py-1 rounded bg-zinc-900 text-zinc-300 font-bold text-[10px]">Payme</span>
            <span className="px-2 py-1 rounded bg-zinc-900 text-zinc-300 font-bold text-[10px]">Uzcard</span>
            <span className="px-2 py-1 rounded bg-zinc-900 text-zinc-300 font-bold text-[10px]">Humo</span>
            <span className="px-2 py-1 rounded bg-zinc-900 text-zinc-300 font-bold text-[10px]">Naqd</span>
          </div>
        </div>

        {/* Popular Categories */}
        <div>
          <h4 className="font-racing text-sm font-bold text-white uppercase tracking-wider mb-3">
            Ommabop Tyuning
          </h4>
          <ul className="space-y-2 text-xs">
            <li><a href="#katalog" className="hover:text-red-400 transition">Optra Stop chiroqlari (Smoke & Red)</a></li>
            <li><a href="#katalog" className="hover:text-red-400 transition">Amerikanka faralar va Bi-LED linzalar</a></li>
            <li><a href="#katalog" className="hover:text-red-400 transition">Malibu 2 & AMG sport anatomik rullar</a></li>
            <li><a href="#katalog" className="hover:text-red-400 transition">Mersedes 64-rangli turbina deflektorlar</a></li>
            <li><a href="#katalog" className="hover:text-red-400 transition">Malibu 2 markaziy podlokotnik bar</a></li>
            <li><a href="#katalog" className="hover:text-red-400 transition">Zimmer 120W Original LED lampalar</a></li>
          </ul>
        </div>

        {/* Cars list */}
        <div>
          <h4 className="font-racing text-sm font-bold text-white uppercase tracking-wider mb-3">
            Avtomobillar Bo‘yicha
          </h4>
          <ul className="space-y-2 text-xs">
            <li><a href="#katalog" className="hover:text-red-400 transition">Chevrolet Gentra / Lacetti tyuning</a></li>
            <li><a href="#katalog" className="hover:text-red-400 transition">Chevrolet Cobalt / Ravon R4 zapchast</a></li>
            <li><a href="#katalog" className="hover:text-red-400 transition">Nexia 3 / Ravon R3 ehtiyot qismlari</a></li>
            <li><a href="#katalog" className="hover:text-red-400 transition">Chevrolet Spark / Ravon R2 salon detallari</a></li>
            <li><a href="#katalog" className="hover:text-red-400 transition">Chevrolet Malibu 1/2 aksessuarlari</a></li>
            <li><a href="#katalog" className="hover:text-red-400 transition">Chevrolet Onix & Tracker 2 yangiliklari</a></li>
          </ul>
        </div>

        {/* Contact info */}
        <div>
          <h4 className="font-racing text-sm font-bold text-white uppercase tracking-wider mb-3">
            Bog‘lanish & Manzil
          </h4>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white">Namangan viloyati, Uychi tumani</div>
                <div className="text-zinc-400 text-[11px]">
                  Namangan viloyati, Uychi tumani • Ravon Auto Tuning markazi
                </div>
              </div>
            </div>
            <a 
              href="https://maps.google.com/?q=Namangan+viloyati,+Uychi+tumani"
              target="_blank" 
              rel="noreferrer"
              className="text-red-400 hover:underline flex items-center gap-1 font-semibold pl-6"
            >
              <span>Xaritada ko‘rish (Namangan viloyati, Uychi tumani)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-red-500 shrink-0" />
              <a 
                href={`tel:${siteSettings.phonePrimary.replace(/\D/g, '')}`} 
                className="text-white hover:text-red-400 font-bold transition select-none cursor-pointer"
                data-phone-admin="true"
                data-phone-primary="true"
              >
                {siteSettings.phonePrimary}
              </a>
            </div>
            {siteSettings.phoneSecondary && (
              <div className="flex items-center gap-2 text-zinc-400 pl-6">
                <span>Qo‘shimcha:</span>
                <a href={`tel:${siteSettings.phoneSecondary.replace(/\D/g, '')}`} className="text-zinc-200 hover:text-white">
                  {siteSettings.phoneSecondary}
                </a>
              </div>
            )}
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <a href="https://t.me/Doliyev_dilshod" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-semibold">
                  @Doliyev_dilshod
                </a>
                <span className="text-zinc-600">•</span>
                <a href="https://t.me/Sherzodjanovich_7" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-semibold">
                  @Sherzodjanovich_7
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock className="w-4 h-4 text-red-500 shrink-0" />
              <span>{siteSettings.workingHours}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Copyright & Secret Admin Access */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-zinc-500">
        <div>
          © {new Date().getFullYear()} "{siteSettings.shopName}" MCHJ. Barcha huquqlar himoyalangan.
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-zinc-400">
            <span>O‘zbekiston avto-havaskorlari uchun mehr bilan yaratilgan</span>
            <Heart className="w-3 h-3 text-red-500 fill-red-500" />
          </div>

          {onOpenMyOrders && (
            <button
              onClick={onOpenMyOrders}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-amber-400 transition group p-1 rounded"
              title="Shaxsiy buyurtma cheklarini ko'rish"
            >
              <Receipt className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-semibold">Shaxsiy cheklarim</span>
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
