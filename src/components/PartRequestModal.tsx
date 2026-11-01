import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  Upload,
  Car,
  Phone,
  User,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileText,
} from 'lucide-react';
import { PartRequest, SiteSettings } from '../types';
import { compressImageDataUrl } from '../services/supabaseSync';
import { safeFetchJson } from '../utils/apiClient';
import { triggerHaptic } from '../utils/telegramWebApp';

interface PartRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  carModels: string[];
  siteSettings: SiteSettings;
  initialSearchQuery?: string;
  onSubmitRequest: (req: PartRequest) => void;
}

export const PartRequestModal: React.FC<PartRequestModalProps> = ({
  isOpen,
  onClose,
  carModels,
  siteSettings,
  initialSearchQuery = '',
  onSubmitRequest,
}) => {
  const [image, setImage] = useState<string>('');
  const [carModel, setCarModel] = useState<string>('Gentra');
  const [customCarModel, setCustomCarModel] = useState<string>('');
  const [phone, setPhone] = useState<string>('+998 ');
  const [fullName, setFullName] = useState<string>('');
  const [partName, setPartName] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedRequest, setSubmittedRequest] = useState<PartRequest | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSubmittedRequest(null);
      if (initialSearchQuery && !partName) {
        setPartName(initialSearchQuery);
      }
    }
  }, [isOpen, initialSearchQuery]);

  if (!isOpen) return null;

  const availableCarModels = carModels.filter((m) => m !== 'Hammasi');

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const rawB64 = reader.result as string;
      const compressed = await compressImageDataUrl(rawB64, 600, 0.7);
      setImage(compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!image) {
      setErrorMsg('Iltimos, qidirayotgan zapchastingiz rasmini yuklang!');
      triggerHaptic('error');
      return;
    }

    const finalCar =
      carModel === 'Boshqa' ? customCarModel.trim() || 'Ko‘rsatilmagan' : carModel;
    const cleanPhone = phone.trim();
    const digitsOnly = cleanPhone.replace(/\D/g, '');

    if (digitsOnly.length < 9) {
      setErrorMsg('Iltimos, to‘g‘ri telefon raqamingizni kiriting!');
      triggerHaptic('error');
      return;
    }

    setIsSubmitting(true);
    const requestId = 'ZAP-' + Math.floor(100000 + Math.random() * 900000);
    const createdAt = new Date().toISOString();

    const newRequest: PartRequest = {
      id: requestId,
      createdAt,
      fullName: fullName.trim() || 'Xaridor',
      phone: cleanPhone,
      carModel: finalCar,
      ...(partName.trim() ? { partName: partName.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      image,
      status: 'Yangi',
    };

    try {
      await safeFetchJson('/api/part-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          fullName: newRequest.fullName,
          phone: newRequest.phone,
          carModel: newRequest.carModel,
          partName: newRequest.partName,
          note: newRequest.note,
          image: newRequest.image,
          botToken: siteSettings.telegramBotToken,
          adminChatId: siteSettings.telegramAdminChatId,
        }),
      });
    } catch {
      // Even if network is slow, still save locally and sync to Firebase
    }

    onSubmitRequest(newRequest);
    triggerHaptic('success');
    setIsSubmitting(false);
    setSubmittedRequest(newRequest);
  };

  const handleResetAndClose = () => {
    setImage('');
    setPartName('');
    setNote('');
    setSubmittedRequest(null);
    setErrorMsg(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden animate-in fade-in duration-200"
      onClick={handleResetAndClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0f1118] border-t sm:border border-red-600/50 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="sticky top-0 z-20 p-4 sm:p-5 bg-gradient-to-r from-red-950/95 via-zinc-900 to-zinc-950 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-900/50 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 block">
                Maxsus Buyurtma Stoli
              </span>
              <h3 className="font-racing text-base sm:text-lg font-bold text-white">
                Zapchastni Rasm Orqali So‘rash
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAndClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-red-600 text-zinc-400 hover:text-white border border-zinc-800 transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submittedRequest ? (
          <div className="p-6 sm:p-8 text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <span className="px-3 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 font-racing text-xs font-bold">
                SO‘ROV #{submittedRequest.id} QABUL QILINDI
              </span>
              <h4 className="font-racing text-xl font-bold text-white pt-1">
                Rasmingiz Menejerlarimizga Yuborildi!
              </h4>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                Mutaxassislarimiz ombordan va hamkorlar bazasidan ushbu zapchastni tekshirib, tez
                orada <strong className="text-white">{submittedRequest.phone}</strong> raqamingizga
                aloqaga chiqishadi.
              </p>
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 flex items-center gap-3.5 text-left">
              <img
                src={submittedRequest.image}
                alt="So'ralgan zapchast"
                className="w-16 h-16 rounded-xl object-cover border border-zinc-700 shrink-0 bg-black"
              />
              <div className="text-xs space-y-1 min-w-0 flex-1">
                <div className="font-bold text-white truncate">
                  Mashina: <span className="text-red-400">{submittedRequest.carModel}</span>
                </div>
                {submittedRequest.partName && (
                  <div className="text-zinc-300 truncate">
                    Detal: <span className="font-semibold">{submittedRequest.partName}</span>
                  </div>
                )}
                <div className="text-emerald-400 font-semibold">
                  Holati: Telegram bot (@ravonavto_bot) va Admin panelga yetkazildi ✓
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <a
                href="https://t.me/ravonavto_bot"
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-racing text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-blue-500/40 transition"
              >
                <Send className="w-4 h-4 text-blue-400" />
                <span>@ravonavto_bot</span>
              </a>
              <a
                href="tel:+998954633736"
                className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-racing text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-zinc-700 transition"
              >
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>Qo‘ng‘iroq qilish</span>
              </a>
              <button
                type="button"
                onClick={handleResetAndClose}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-racing text-xs font-bold uppercase tracking-wider transition"
              >
                Katalogga qaytish
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Katalogdan o‘zingizga kerakli ehtiyot qism yoki tyuning detalini topa olmadingizmi?
              Eski detalning yoki namunaning rasmini yuklang — omborimizdan topib beramiz!
            </p>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Photo Upload */}
            <div>
              <label className="block text-xs font-bold text-zinc-200 mb-1.5">
                1. Zapchast rasmini yuklang (yoki rasmga oling) *
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
              />
              {image ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/70 bg-black aspect-16/9 flex items-center justify-center group">
                  <img
                    src={image}
                    alt="Zapchast"
                    className="max-h-48 object-contain"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold border border-zinc-700 flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5 text-red-400" />
                      Boshqa rasm tanlash
                    </button>
                  </div>
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 shadow">
                    <CheckCircle2 className="w-3 h-3" /> Rasm yuklandi
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-7 px-4 rounded-2xl border-2 border-dashed border-red-500/50 hover:border-red-500 bg-red-950/15 hover:bg-red-950/30 transition flex flex-col items-center justify-center gap-2 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-white">
                    Zapchast rasmini tanlash uchun bosing *
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    JPG, PNG, WEBP — avtomatik siqiladi va Telegram botga yuboriladi
                  </div>
                </button>
              )}
            </div>

            {/* 2. Car Model & Part Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-200 mb-1 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-red-500" />
                  <span>2. Mashina rusumi *</span>
                </label>
                <select
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                >
                  {availableCarModels.map((car) => (
                    <option key={car} value={car}>
                      {car}
                    </option>
                  ))}
                  <option value="Boshqa">Boshqa model (yozish)</option>
                </select>
                {carModel === 'Boshqa' && (
                  <input
                    type="text"
                    required
                    value={customCarModel}
                    onChange={(e) => setCustomCarModel(e.target.value)}
                    placeholder="Mashina modelini yozing..."
                    className="mt-2 w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-200 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Zapchast nomi (ixtiyoriy)</span>
                </label>
                <input
                  type="text"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  placeholder="Masalan: Gentra o'ng fara yoki datchik"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* 3. Phone & Customer Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-200 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>3. Telefon raqamingiz *</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-200 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Ismingiz (ixtiyoriy)</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masalan: Sardor"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* 4. Additional Note */}
            <div>
              <label className="block text-xs font-bold text-zinc-200 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                <span>Qo‘shimcha ma’lumot (yili, OEM kodi va h.k.)</span>
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Mashina yili yoki detal haqida qisqacha izoh..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 text-white font-racing text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-red-900/40 transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Telegram va Adminga yuborilmoqda...'
                  : 'Rasmni Yuborish va Narxini Bilish'}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
