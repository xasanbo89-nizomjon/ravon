import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Upload, 
  Camera, 
  Car, 
  Tag, 
  Wrench, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowDown, 
  ShoppingBag, 
  Eye, 
  HelpCircle,
  Zap,
  Send,
  Phone,
  User,
  Clock
} from 'lucide-react';
import { AiAnalysisResult, Product, SiteSettings } from '../types';
import { SAMPLE_AI_PRESETS } from '../data/products';
import { formatUzbekSum, formatPhoneNumber } from '../utils/formatters';
import { sendTelegramNotification, formatAiInquiryTelegramMessage } from '../utils/telegram';
import { triggerHaptic } from '../utils/telegramWebApp';
import { safeFetchJson } from '../utils/apiClient';

interface HeroAiSearchProps {
  onSearchResult: (result: AiAnalysisResult, matchedProducts: Product[]) => void;
  allProducts: Product[];
  onAddToCart: (product: Product) => void;
  onOpenProductModal: (product: Product) => void;
  siteSettings: SiteSettings;
}

export const HeroAiSearch: React.FC<HeroAiSearchProps> = ({
  onSearchResult,
  allProducts,
  onAddToCart,
  onOpenProductModal,
  siteSettings,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiAnalysisResult | null>(null);
  const [matchedProducts, setMatchedProducts] = useState<Product[]>([]);
  const [customPrompt, setCustomPrompt] = useState<string>('');

  // Telegram AI Inquiry Form State (Prompt 5 requirement)
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryPhone, setInquiryPhone] = useState('+998 ');
  const [inquiryNotes, setInquiryNotes] = useState('');
  const [isInquirySubmitting, setIsInquirySubmitting] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Match AI result to our store catalog
  const findMatchingProducts = (aiData: AiAnalysisResult): Product[] => {
    const keywords = (aiData.searchKeywords || []).map(k => k.toLowerCase());
    const bazaar = (aiData.bazaarName || '').toLowerCase();
    const name = (aiData.partName || '').toLowerCase();
    const cars = (aiData.compatibleCars || []).map(c => c.toLowerCase());
    const category = (aiData.category || '').toLowerCase();

    const matched = allProducts.filter(p => {
      const pName = p.name.toLowerCase();
      const pBazaar = p.bazaarName.toLowerCase();
      const pCategory = p.category.toLowerCase();
      const pTags = p.tags.map(t => t.toLowerCase());
      const pCars = p.carModels.map(c => c.toLowerCase());

      // Direct matches
      if (bazaar && (pBazaar.includes(bazaar) || pName.includes(bazaar))) return true;
      if (pBazaar && (name.includes(pBazaar) || bazaar.includes(pBazaar))) return true;

      // Keyword matches
      const tagMatch = keywords.some(k => pTags.includes(k) || pName.includes(k) || pBazaar.includes(k));
      if (tagMatch) return true;

      // Category + Car match
      const carMatch = cars.some(c => pCars.includes(c));
      if (carMatch && pCategory === category) return true;

      return false;
    });

    return matched.length > 0 ? matched : allProducts.slice(0, 3);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError("Iltimos, faqat rasm faylini yuklang (JPG, PNG, WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedImage(base64);
      setError(null);
      setResult(null);
      triggerHaptic('medium');
      // Foydalanuvchi rasm yuklaganda 'AI tahlil qilmoqda...' jarayonini darhol ishga tushirish
      analyzeImage({ imageBase64: base64 });
    };
    reader.readAsDataURL(file);
  };

// Safe error formatter to guarantee NO raw JSON or 404 errors ever appear on screen
function cleanAiErrorMessage(rawMsg?: string | null): string {
  const friendlyDefault = "Xizmat bilan bog'lanishda vaqtinchalik uzilish yuz berdi. Iltimos, birozdan so'ng qayta urinib ko'ring.";

  if (!rawMsg) {
    return friendlyDefault;
  }

  const str = String(rawMsg).trim();
  const lower = str.toLowerCase();

  // 1. High demand / 503 / 429 / overloaded
  if (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('overload') ||
    lower.includes('high demand') ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('quota') ||
    lower.includes('yuklama yuqori') ||
    lower.includes('navbat yuqori')
  ) {
    return "Hozirda AI qidiruv tizimida navbat yuqori. Iltimos, 5-10 soniyadan so'ng qayta urinib ko'ring.";
  }

  // 2. Hide 404, HTML, raw JSON, and technical messages from customers
  if (
    str.startsWith('{') ||
    str.startsWith('[') ||
    str.includes('{"') ||
    str.includes('"code":') ||
    str.includes('"status":') ||
    str.includes('"message":') ||
    str.includes('<!DOCTYPE') ||
    str.includes('<html') ||
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('status:') ||
    lower.includes('unexpected token') ||
    lower.includes('is not valid json') ||
    lower.includes('so\'ralgan api') ||
    lower.includes('so\'ralgan xizmat') ||
    lower.includes('html sahifa') ||
    lower.includes('leaked') ||
    lower.includes('permission_denied') ||
    lower.includes('api_key') ||
    lower.includes('gemini_api_key')
  ) {
    return friendlyDefault;
  }

  const cleaned = str.replace(/^\[GoogleGenAI:[^\]]+\]\s*/i, '').trim();
  if (cleaned.startsWith('{') || cleaned.endsWith('}')) {
    return friendlyDefault;
  }

  return cleaned || friendlyDefault;
}

  const analyzeImage = async (imagePayload: { imageBase64?: string; imageUrl?: string }, retryCount = 0) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setAnalysisStep(retryCount > 0 ? "AI serveriga qayta ulanilmoqda..." : "Rasm qabul qilindi, tahlilga tayyorlanmoqda...");

    // Smooth scroll to loading skeleton
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    try {
      setAnalysisStep(retryCount > 0 ? "AI model zaxira kanali orqali skanerlamoqda..." : "AI model rasm detallarini skanerlamoqda...");

      const apiRes = await safeFetchJson<{ success: boolean; data?: AiAnalysisResult; error?: string; details?: string }>(
        '/api/analyze-part',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...imagePayload,
            prompt: customPrompt.trim() || undefined,
          }),
        }
      );

      // Check if server returned 503, 429 or high demand error or failed
      if (!apiRes.ok || !apiRes.data?.success || !apiRes.data?.data) {
        const errMsg = String(apiRes.data?.error || apiRes.data?.details || apiRes.error || '');
        const isHighDemand = apiRes.status === 503 || apiRes.status === 429 ||
          errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('yuklama') || errMsg.includes('overload') || errMsg.includes('unavailable');

        // Automatic retry once after 1 second if overloaded or network issue
        if ((isHighDemand || !apiRes.ok) && retryCount === 0) {
          setAnalysisStep("AI server bilan qayta bog'lanilmoqda (1 soniya)...");
          await new Promise((r) => setTimeout(r, 1000));
          return analyzeImage(imagePayload, 1);
        }

        throw new Error(cleanAiErrorMessage(errMsg || "Server bilan bog'lanishda xatolik yuz berdi."));
      }

      setAnalysisStep("Bozor terminlari, mos mashinalar va ombordagi zapchastlar aniqlanmoqda...");

      const aiData: AiAnalysisResult = apiRes.data.data;
      setResult(aiData);

      const matches = findMatchingProducts(aiData);
      setMatchedProducts(matches);
      onSearchResult(aiData, matches);

      // Scroll to result smoothly
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);

    } catch (err: any) {
      console.error('AI Analysis Error:', err);
      setError(cleanAiErrorMessage(err?.message));
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  const handleStartAnalysis = () => {
    if (!selectedImage) {
      setError("Iltimos, avval zapchast rasmini yuklang yoki quyidagi namunalardan birini tanlang.");
      return;
    }
    analyzeImage({ imageBase64: selectedImage });
  };

  const handleSelectPreset = (preset: typeof SAMPLE_AI_PRESETS[0]) => {
    setSelectedImage(preset.image);
    setError(null);
    setResult(null);
    analyzeImage({ imageUrl: preset.image });
  };

  const handleReset = () => {
    setSelectedImage(null);
    setResult(null);
    setError(null);
    setMatchedProducts([]);
    setCustomPrompt('');
    setInquiryName('');
    setInquiryPhone('+998 ');
    setInquiryNotes('');
    setInquirySuccess(false);
    setInquiryError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setInquiryPhone(formatted);
  };

  const handleSendAiInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result) return;
    setInquiryError(null);

    if (!inquiryName.trim()) {
      setInquiryError("Iltimos, ismingizni kiriting.");
      return;
    }
    const cleanPhone = inquiryPhone.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      setInquiryError("Iltimos, to‘g‘ri telefon raqamingizni kiriting (masalan: +998 90 123-45-67).");
      return;
    }

    setIsInquirySubmitting(true);
    try {
      const msg = formatAiInquiryTelegramMessage(
        inquiryName.trim(),
        inquiryPhone.trim(),
        result,
        inquiryNotes.trim() || (customPrompt.trim() ? customPrompt.trim() : undefined)
      );

      const res = await sendTelegramNotification(
        siteSettings.telegramBotToken,
        siteSettings.telegramAdminChatId,
        msg
      );

      if (res.success) {
        setInquirySuccess(true);
      } else {
        setInquiryError(res.error || "Telegramga so‘rov yuborishda xatolik yuz berdi. Iltimos, qaytadan urinib ko‘ring.");
      }
    } catch (err: any) {
      setInquiryError(err?.message || "Internet yoki Telegram aloqasida nosozlik yuz berdi.");
    } finally {
      setIsInquirySubmitting(false);
    }
  };

  return (
    <section id="ai-search" className="relative py-12 md:py-18 overflow-hidden bg-carbon-pattern border-b border-zinc-800">
      {/* Decorative Red Automotive Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-red-600/10 blur-[130px] rounded-full pointer-events-none"></div>
      <div className="absolute -top-10 -right-10 w-96 h-96 bg-red-700/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Main Header / Banner */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/80 border border-red-700/60 text-red-400 text-xs font-bold uppercase tracking-widest mb-4 shadow-lg shadow-red-950/50">
            <Sparkles className="w-4 h-4 text-red-500 animate-spin" style={{ animationDuration: '6s' }} />
            <span>AI Powered Zapchast Qidiruvi (O‘zbekiston bozori)</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-racing tracking-tight text-white mb-4 leading-tight">
            {siteSettings.heroTitlePrefix} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-red-400 to-amber-500">
              {siteSettings.heroTitleHighlight}
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-300 leading-relaxed font-normal max-w-2xl mx-auto">
            {siteSettings.heroSubtitle}
          </p>
        </div>

        {/* Upload & Analysis Box */}
        <div className="bg-[#10121a]/90 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative overflow-hidden">
          {/* Neon Top Highlight */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent"></div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Column: Image Drop / Upload Area */}
            <div className="lg:col-span-7 space-y-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
              <input 
                type="file" 
                ref={cameraInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
              />

              <div 
                onClick={() => !selectedImage && fileInputRef.current?.click()}
                className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center min-h-[260px] p-6 text-center cursor-pointer ${
                  selectedImage 
                    ? 'border-red-500/60 bg-black/60' 
                    : 'border-zinc-700 hover:border-red-500/80 bg-zinc-900/40 hover:bg-zinc-900/80 group'
                }`}
              >
                {selectedImage ? (
                  <div className="relative w-full h-[260px] rounded-xl overflow-hidden flex items-center justify-center">
                    <img 
                      src={selectedImage} 
                      alt="Yuklangan avtozapchast" 
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />

                    {/* High-Tech Laser HUD Scanner when analyzing */}
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-red-950/25 pointer-events-none overflow-hidden flex flex-col justify-between p-3 select-none">
                        {/* Top HUD */}
                        <div className="flex items-center justify-between text-[10px] font-mono text-red-400 bg-black/70 px-2 py-1 rounded-md backdrop-blur-sm border border-red-500/40 z-10">
                          <span className="flex items-center gap-1.5 font-bold">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                            AI OPTIC SCANNER
                          </span>
                          <span className="text-zinc-400">GEMINI SMART AI</span>
                        </div>

                        {/* Moving Laser Line with Glow */}
                        <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_20px_#ef4444] animate-laser-scan">
                          <div className="w-full h-8 bg-gradient-to-b from-red-500/25 to-transparent -translate-y-full"></div>
                        </div>

                        {/* Center Target Reticle */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-24 h-24 border border-red-500/30 rounded-full flex items-center justify-center animate-pulse">
                            <div className="w-12 h-12 border-2 border-red-500/80 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Live Status Pill */}
                        <div className="text-center bg-black/80 py-1.5 px-3 rounded-lg backdrop-blur-sm border border-red-500/40 text-[11px] font-mono text-white flex items-center justify-center gap-2 z-10 shadow-lg">
                          <Sparkles className="w-3.5 h-3.5 text-red-400 animate-spin" />
                          <span className="truncate font-semibold">{analysisStep || "AI tahlil qilmoqda..."}</span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReset();
                      }}
                      className="absolute top-3 right-3 bg-zinc-900/90 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-700 backdrop-blur-sm transition"
                    >
                      Boshqa rasm
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-950 to-zinc-900 border border-red-800/40 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-red-950/40">
                      <Upload className="w-8 h-8 text-red-500 group-hover:text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">
                        Zapchast rasmini shu yerga tashlang yoki tanlang
                      </h3>
                      <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                        Telefoningizdagi galereyadan yoki kompyuterdan rasm yuklang (JPG, PNG, WEBP)
                      </p>
                    </div>

                    {/* Touch-Friendly Dual Buttons: Camera & Gallery (Prompt 4 requirement) */}
                    <div className="w-full max-w-md grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('medium');
                          cameraInputRef.current?.click();
                        }}
                        className="py-3 px-4 rounded-xl bg-gradient-to-r from-red-650 via-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-xs sm:text-sm font-bold text-white shadow-lg shadow-red-900/40 flex items-center justify-center gap-2.5 active:scale-95 transition touch-manipulation border border-red-500/30"
                      >
                        <Camera className="w-4 h-4 text-white" />
                        <span>Kamera orqali rasmga olish</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('light');
                          fileInputRef.current?.click();
                        }}
                        className="py-3 px-4 rounded-xl bg-zinc-800/90 hover:bg-zinc-750 text-xs sm:text-sm font-bold text-zinc-200 border border-zinc-700 flex items-center justify-center gap-2 active:scale-95 transition touch-manipulation"
                      >
                        <Upload className="w-4 h-4 text-red-400" />
                        <span>Galereyadan tanlash</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional user note */}
              <div className="relative">
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Ixtiyoriy savol yoki izoh (masalan: Cobaltga tushadimi?)"
                  className="w-full bg-zinc-900/80 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 transition"
                  disabled={isAnalyzing}
                />
                <HelpCircle className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Right Column: AI Action & Sample Presets */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="bg-zinc-900/70 border border-zinc-800 p-4 rounded-2xl">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2">
                    <Zap className="w-4 h-4 text-red-500" />
                    AI qanday ishlaydi?
                  </div>
                  <ul className="text-xs text-zinc-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0"></span>
                      <span>Rasmdagi detalni va uning bozordagi nomini (laqabini) aniqlaydi.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0"></span>
                      <span>Qaysi mashinalarga (Gentra, Cobalt, Nexia va h.k.) mosligini aytadi.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0"></span>
                      <span>Do‘konimiz omboridagi tayyor variantlarni chiqaradi.</span>
                    </li>
                  </ul>
                </div>

                {/* Instant Presets for one-click test */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center justify-between">
                    <span>Yoki namunalardan birini sinab ko‘ring:</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
                    {SAMPLE_AI_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900/90 hover:bg-red-950/40 border border-zinc-800 hover:border-red-700/60 text-left transition group"
                      >
                        <img 
                          src={preset.image} 
                          alt={preset.title} 
                          className="w-10 h-10 rounded-lg object-cover border border-zinc-700 group-hover:border-red-500" 
                        />
                        <div className="overflow-hidden">
                          <div className="text-xs font-bold text-zinc-200 group-hover:text-red-400 truncate">
                            {preset.title}
                          </div>
                          <div className="text-[10px] text-zinc-400 truncate">
                            {preset.subtitle}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Main CTA Button */}
              <div>
                {error && (
                  <div className="p-3.5 mb-3.5 rounded-xl bg-red-950/90 border border-red-700/80 text-red-200 text-xs shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5 sm:mt-0" />
                      <span className="leading-relaxed font-medium">{error}</span>
                    </div>
                    {selectedImage && (
                      <button
                        type="button"
                        onClick={handleStartAnalysis}
                        disabled={isAnalyzing}
                        className="self-end sm:self-auto px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 transition active:scale-95 shadow"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                        <span>Qayta urinish</span>
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  disabled={isAnalyzing || !selectedImage}
                  className={`w-full py-4 rounded-2xl font-racing text-lg font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-3 shadow-xl ${
                    isAnalyzing
                      ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                      : !selectedImage
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700'
                      : 'bg-gradient-to-r from-red-600 via-red-500 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-red-600/30 glow-red active:scale-[0.98]'
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-5 h-5 text-red-400 animate-spin" />
                      <span>{analysisStep || 'AI Tahlil qilmoqda...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-amber-300" />
                      <span>AI bilan Zapchastni Aniqlash</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* AI Analyzing Skeleton Loader Section */}
          {isAnalyzing && (
            <div 
              ref={resultRef}
              className="mt-8 pt-8 border-t border-zinc-800 animate-in fade-in duration-300"
            >
              <div className="bg-gradient-to-br from-red-950/30 via-zinc-900 to-black border-2 border-red-500/40 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
                {/* Luminous Top Shimmer Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse"></div>

                {/* Status Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-500 shadow-lg shadow-red-900/40">
                        <Sparkles className="w-6 h-6 animate-spin" style={{ animationDuration: '3s' }} />
                      </div>
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full animate-ping"></span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-racing font-bold text-lg sm:text-2xl text-white tracking-wide">
                          AI tahlil qilmoqda...
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-red-950 border border-red-700/60 text-[10px] text-red-400 font-mono font-bold animate-pulse">
                          GEMINI SMART AI
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1 flex items-center gap-2 font-mono">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                        <span className="text-amber-300/90">{analysisStep || "Rasmdagi detal parametrlari aniqlanmoqda..."}</span>
                      </p>
                    </div>
                  </div>

                  {/* Pulsing progress bar */}
                  <div className="w-full sm:w-64 bg-zinc-950/80 p-3 rounded-xl border border-zinc-800">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono mb-1.5">
                      <span>SKANERLASH</span>
                      <span className="text-red-400 font-bold animate-pulse">JARAYONDA...</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 relative">
                      <div className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-red-600 rounded-full animate-[pulse_1s_ease-in-out_infinite] w-4/5"></div>
                    </div>
                  </div>
                </div>

                {/* Main Details Skeleton */}
                <div className="flex flex-col md:flex-row items-start justify-between gap-6 py-6 border-b border-zinc-800">
                  <div className="flex-1 space-y-3 w-full">
                    {/* Badge skeletons */}
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-28 bg-red-900/40 border border-red-800/40 rounded-full animate-pulse"></div>
                      <div className="h-6 w-36 bg-zinc-800/80 rounded-full animate-pulse"></div>
                    </div>

                    {/* Title & subtitle skeleton */}
                    <div className="space-y-2.5 pt-1">
                      <div className="h-3.5 w-40 bg-zinc-800/70 rounded animate-pulse"></div>
                      <div className="h-8 sm:h-10 w-3/4 max-w-md bg-gradient-to-r from-zinc-850 via-zinc-750 to-zinc-850 rounded-xl animate-pulse"></div>
                      <div className="h-4 sm:h-5 w-2/3 max-w-sm bg-zinc-800/60 rounded-lg animate-pulse"></div>
                    </div>
                  </div>

                  {/* Price Box Skeleton */}
                  <div className="w-full md:w-60 p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                    <div className="h-3 w-28 bg-zinc-800/80 rounded animate-pulse"></div>
                    <div className="h-7 w-36 bg-red-950/90 border border-red-900/60 rounded-lg animate-pulse"></div>
                    <div className="h-2.5 w-44 bg-zinc-800/50 rounded animate-pulse"></div>
                  </div>
                </div>

                {/* Cars & Keywords Skeletons */}
                <div className="py-5 border-b border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-red-500/70" />
                      <div className="h-3.5 w-48 bg-zinc-800 rounded animate-pulse"></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="h-7 w-20 bg-zinc-800/80 rounded-lg animate-pulse"></div>
                      <div className="h-7 w-20 bg-zinc-800/80 rounded-lg animate-pulse"></div>
                      <div className="h-7 w-20 bg-zinc-800/80 rounded-lg animate-pulse"></div>
                      <div className="h-7 w-16 bg-zinc-800/80 rounded-lg animate-pulse"></div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-red-500/70" />
                      <div className="h-3.5 w-32 bg-zinc-800 rounded animate-pulse"></div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <div className="h-5 w-16 bg-zinc-900 rounded animate-pulse"></div>
                      <div className="h-5 w-20 bg-zinc-900 rounded animate-pulse"></div>
                      <div className="h-5 w-14 bg-zinc-900 rounded animate-pulse"></div>
                      <div className="h-5 w-24 bg-zinc-900 rounded animate-pulse"></div>
                    </div>
                  </div>
                </div>

                {/* Description & Advice Boxes Skeletons */}
                <div className="py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-800 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-zinc-500" />
                      <div className="h-3.5 w-36 bg-zinc-800 rounded animate-pulse"></div>
                    </div>
                    <div className="h-3 w-full bg-zinc-800/60 rounded animate-pulse"></div>
                    <div className="h-3 w-5/6 bg-zinc-800/60 rounded animate-pulse"></div>
                    <div className="h-3 w-3/4 bg-zinc-800/60 rounded animate-pulse"></div>
                  </div>

                  <div className="bg-red-950/20 p-4 rounded-xl border border-red-900/30 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-red-500" />
                      <div className="h-3.5 w-40 bg-red-950 border border-red-900/40 rounded animate-pulse"></div>
                    </div>
                    <div className="h-3 w-full bg-zinc-800/60 rounded animate-pulse"></div>
                    <div className="h-3 w-4/5 bg-zinc-800/60 rounded animate-pulse"></div>
                    <div className="h-3 w-2/3 bg-zinc-800/60 rounded animate-pulse"></div>
                  </div>
                </div>

                {/* Matching Products Skeletons */}
                <div className="pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-600/30 border border-red-500 animate-pulse"></div>
                      <span className="text-sm font-bold text-zinc-300">
                        Do‘kondagi mos zapchastlar qidirilmoqda...
                      </span>
                    </div>
                    <div className="h-3.5 w-24 bg-zinc-800 rounded animate-pulse"></div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((item) => (
                      <div 
                        key={item}
                        className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex gap-3 items-center"
                      >
                        <div className="w-20 h-20 rounded-lg bg-zinc-800 animate-pulse shrink-0"></div>
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="h-2.5 w-14 bg-red-950 rounded animate-pulse"></div>
                          <div className="h-3.5 w-full bg-zinc-800 rounded animate-pulse"></div>
                          <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse"></div>
                          <div className="flex gap-2 pt-1">
                            <div className="h-6 w-16 bg-zinc-800 rounded-lg animate-pulse"></div>
                            <div className="h-6 w-14 bg-zinc-800 rounded-lg animate-pulse"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* AI Result Card Section */}
          {!isAnalyzing && result && (
            <div 
              ref={resultRef}
              className="mt-8 pt-8 border-t border-zinc-800 animate-in fade-in slide-in-from-bottom duration-500"
            >
              <div className="bg-gradient-to-br from-red-950/50 via-zinc-900 to-black border-2 border-red-600/50 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
                
                <div className="flex flex-col md:flex-row items-start justify-between gap-6 pb-6 border-b border-zinc-800">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-red-600 text-white font-racing text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-red-600/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        AI Aniqladi
                      </span>
                      <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-700">
                        Kategoriya: <strong className="text-white">{result.category}</strong>
                      </span>
                    </div>

                    <div>
                      <div className="text-xs uppercase font-bold text-red-400 tracking-wider">
                        Bozordagi mashhur laqabi:
                      </div>
                      <h2 className="text-2xl sm:text-4xl font-racing font-black text-white tracking-wide">
                        "{result.bazaarName}"
                      </h2>
                      <div className="text-sm sm:text-base font-semibold text-zinc-300 mt-1">
                        Rasmiy nomi: <span className="text-zinc-100">{result.partName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left md:text-right bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 min-w-[220px]">
                    <div className="text-xs text-zinc-400 font-medium">Bozordagi taxminiy narx:</div>
                    <div className="text-xl sm:text-2xl font-black font-racing text-red-400 mt-0.5">
                      {result.estimatedPriceRange || "Kelishilgan narxda"}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1">Do'konimizda arzonroq va kafolatli!</div>
                  </div>
                </div>

                {/* Compatibility Badges */}
                <div className="py-4 border-b border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase text-zinc-400 tracking-wider mb-2 flex items-center gap-1.5">
                      <Car className="w-4 h-4 text-red-500" />
                      Mos keladigan avtomobillar:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.compatibleCars && result.compatibleCars.length > 0 ? (
                        result.compatibleCars.map((car, idx) => (
                          <span 
                            key={idx}
                            className="px-3 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            {car}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-400">Gentra, Cobalt, Nexia</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold uppercase text-zinc-400 tracking-wider mb-2 flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-red-500" />
                      Kalit so‘zlar:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.searchKeywords?.map((kw, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 text-xs">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Description & Tuning Tips */}
                <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-800">
                    <div className="text-xs font-bold uppercase text-zinc-300 mb-1.5 flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-red-400" />
                      Detal haqida ma'lumot:
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      {result.description}
                    </p>
                  </div>

                  {result.tuningTips && (
                    <div className="bg-red-950/30 p-4 rounded-xl border border-red-900/40">
                      <div className="text-xs font-bold uppercase text-red-400 mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-red-500" />
                        Ravon Auto Tuning ustasidan maslahat:
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                        {result.tuningTips}
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. Telegram Inquiry Form (Prompt 5 requirement: Ombordan aniq narxini so'rash) */}
                <div className="my-5 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-red-950/40 via-zinc-900/90 to-amber-950/30 border-2 border-red-500/40 shadow-xl shadow-red-950/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-zinc-800">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-900/60 text-red-300 border border-red-700/60 text-[10px] font-racing font-bold uppercase tracking-wider mb-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Tezkor Ombordan So'rov</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-racing font-black text-white flex items-center gap-2">
                        <span>Ombordan aniq narxini so‘rash (5 daqiqada javob beramiz)</span>
                      </h3>
                      <p className="text-xs text-zinc-300 mt-0.5">
                        Ushbu <b>"{result.bazaarName}"</b> Namangan viloyati, Uychi tumanidagi do‘konimiz va omborimizda bormi? Telefon raqamingizni qoldiring, mutaxassisimiz Telegram orqali aniq narx va mavjudligini aytadi.
                      </p>
                    </div>
                  </div>

                  {inquirySuccess ? (
                    <div className="p-4 rounded-xl bg-green-950/80 border border-green-600 text-green-200 text-xs sm:text-sm space-y-3 animate-in fade-in">
                      <div className="flex items-center gap-2 font-bold text-green-300">
                        <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                        <span>Qidiruv so‘rovingiz Telegram orqali adminga darhol yuborildi!</span>
                      </div>
                      <p className="text-xs text-zinc-300">
                        Menejerimiz ushbu detalning ombordagi holati va narxini tekshirib, 5 daqiqa ichida siz bilan bog‘lanadi.
                      </p>
                      <button
                        type="button"
                        onClick={() => setInquirySuccess(false)}
                        className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 border border-zinc-700 transition"
                      >
                        Yana boshqa so‘rov yuborish
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSendAiInquiry} className="space-y-3">
                      {inquiryError && (
                        <div className="p-2.5 rounded-xl bg-red-950 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{inquiryError}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-zinc-300 font-semibold mb-1">Ismingiz *</label>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              value={inquiryName}
                              onChange={(e) => setInquiryName(e.target.value)}
                              placeholder="Masalan: Sardor"
                              className="w-full bg-zinc-950 border border-zinc-750 focus:border-red-500 rounded-xl px-3 py-2.5 pl-8 text-white placeholder-zinc-500 focus:outline-none"
                            />
                            <User className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-zinc-300 font-semibold mb-1">Telefon raqamingiz *</label>
                          <div className="relative">
                            <input
                              type="tel"
                              required
                              value={inquiryPhone}
                              onChange={handlePhoneInputChange}
                              placeholder="+998 90 123-45-67"
                              className="w-full bg-zinc-950 border border-zinc-750 focus:border-red-500 rounded-xl px-3 py-2.5 pl-8 text-white font-mono placeholder-zinc-500 focus:outline-none"
                            />
                            <Phone className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-zinc-300 font-semibold mb-1">Izoh / Mashina yili</label>
                          <input
                            type="text"
                            value={inquiryNotes}
                            onChange={(e) => setInquiryNotes(e.target.value)}
                            placeholder={customPrompt || "Gentra 2022 oq..."}
                            className="w-full bg-zinc-950 border border-zinc-750 focus:border-red-500 rounded-xl px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                        <span className="text-[11px] text-zinc-400">
                          ⚡ Telegram Bot: <strong className="text-zinc-200">{siteSettings.telegramAdminChatId ? `Chat #${siteSettings.telegramAdminChatId}` : 'Ulangan'}</strong>
                        </span>

                        <button
                          type="submit"
                          disabled={isInquirySubmitting}
                          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-racing font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-950 transition disabled:opacity-50"
                        >
                          {isInquirySubmitting ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Telegramga yuborilmoqda...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Telegram orqali adminga so‘rov yuborish</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Matching store products */}
                <div className="pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      Do‘konimiz bazasidagi mos mahsulotlar ({matchedProducts.length} ta):
                    </h3>
                    <a 
                      href="#katalog" 
                      className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      Barcha katalog <ArrowDown className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {matchedProducts.map(product => (
                      <div 
                        key={product.id}
                        className="bg-zinc-900/90 border border-zinc-800 hover:border-red-600/70 rounded-xl p-3 flex gap-3 items-center group transition shadow-lg"
                      >
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="w-20 h-20 rounded-lg object-cover shrink-0 border border-zinc-700" 
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-red-400 font-bold uppercase">
                            {product.bazaarName}
                          </div>
                          <div className="text-xs font-bold text-white truncate group-hover:text-red-300">
                            {product.name}
                          </div>
                          <div className="text-sm font-black font-racing text-red-400 mt-1">
                            {formatUzbekSum(product.price)}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => onAddToCart(product)}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition"
                            >
                              <ShoppingBag className="w-3 h-3" />
                              Savatga
                            </button>
                            <button
                              onClick={() => onOpenProductModal(product)}
                              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold rounded-lg flex items-center gap-1 transition"
                            >
                              <Eye className="w-3 h-3" />
                              Ko‘rish
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

      </div>
    </section>
  );
};
