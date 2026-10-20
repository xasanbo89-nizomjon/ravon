import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldCheck, X, KeyRound, AlertCircle, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../../utils/telegramWebApp';

interface SecretPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SecretPinModal: React.FC<SecretPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      setIsSuccess(false);
      setIsShaking(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVerify = (codeToVerify?: string) => {
    const entered = (codeToVerify ?? pin).trim();
    if (!entered) {
      setError("Iltimos, maxfiy kodni kiriting.");
      triggerHaptic('error');
      return;
    }

    if (entered === '0606') {
      setIsSuccess(true);
      setError(null);
      triggerHaptic('success');

      try {
        sessionStorage.setItem('ravon_admin_authorized', 'true');
        sessionStorage.setItem('ravon_admin_logged', 'true');
      } catch (e) {}

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 350);
    } else {
      triggerHaptic('error');
      setError("Xato maxfiy kod! Kirish taqiqlanadi.");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setPin('');
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      setError(null);
      if (next.length === 4) {
        handleVerify(next);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm bg-[#0c0e14] border border-red-900/60 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(220,38,38,0.25)] space-y-5 animate-in zoom-in-95 duration-200 ${
          isShaking ? 'animate-shake' : ''
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
          aria-label="Yopish"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2 pt-2">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600/25 to-red-950/40 border border-red-500/50 flex items-center justify-center text-red-500 shadow-lg shadow-red-950/60">
              <Lock className="w-7 h-7" />
            </div>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full animate-ping" />
          </div>

          <div className="flex items-center justify-center gap-1.5 pt-1">
            <span className="px-2.5 py-0.5 rounded-full bg-red-950 border border-red-800/80 text-[10px] font-mono font-bold text-red-400 tracking-wider uppercase">
              Superadmin Tizimi
            </span>
          </div>

          <h3 className="font-racing text-xl font-bold text-white tracking-wide">
            Maxfiy Kodni Kiriting
          </h3>
          <p className="text-xs text-zinc-400">
            Boshqaruv paneliga kirish uchun 4 xonali parolni tering
          </p>
        </div>

        {/* PIN Input Indicator Circles (Raqamlar ko'rinmaydi, faqat maxfiy nuqtalar) */}
        <div className="flex justify-center items-center gap-3 py-2">
          {[0, 1, 2, 3].map((idx) => {
            const hasChar = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-11 h-12 rounded-xl border flex items-center justify-center transition-all duration-200 ${
                  isSuccess
                    ? 'border-green-500 bg-green-950/40 text-green-400 shadow-md shadow-green-900/40 scale-105'
                    : hasChar
                    ? 'border-red-500 bg-red-950/30 shadow-md shadow-red-950/50 scale-105'
                    : 'border-zinc-800 bg-zinc-900/60'
                }`}
              >
                {hasChar ? (
                  <span className={`w-3.5 h-3.5 rounded-full ${
                    isSuccess ? 'bg-green-400 shadow-md shadow-green-500/80 scale-110' : 'bg-red-500 shadow-md shadow-red-500/80'
                  } transition-all duration-150`} />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-zinc-700" />
                )}
              </div>
            );
          })}
        </div>

        {/* Hidden Native Input to capture typing & mobile keypad */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify();
          }}
          className="space-y-3"
        >
          <div className="relative">
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPin(val);
                setError(null);
                if (val.length === 4) {
                  handleVerify(val);
                }
              }}
              placeholder="••••"
              className="w-full bg-zinc-900/90 border border-zinc-750 focus:border-red-500 rounded-xl px-4 py-2.5 pl-10 text-center font-mono tracking-[0.5em] text-xl font-bold text-white placeholder-zinc-600 focus:outline-none transition"
              autoComplete="off"
            />
            <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {isSuccess && (
            <div className="p-3 rounded-xl bg-green-950/80 border border-green-800 text-green-200 text-xs flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <span>Kod to‘g‘ri! Superadmin panel ochilmoqda...</span>
            </div>
          )}

          {/* Virtual Quick Numpad for Phone / Touchscreen */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit)}
                className="py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 active:bg-red-950/60 border border-zinc-800 hover:border-zinc-700 text-white font-racing font-bold text-base transition active:scale-95 touch-manipulation"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPin('')}
              className="py-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-850 active:bg-zinc-800 border border-zinc-850 text-zinc-400 hover:text-zinc-200 font-racing text-xs font-bold transition active:scale-95"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 active:bg-red-950/60 border border-zinc-800 hover:border-zinc-700 text-white font-racing font-bold text-base transition active:scale-95 touch-manipulation"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="py-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-850 active:bg-zinc-800 border border-zinc-850 text-zinc-400 hover:text-zinc-200 font-racing text-xs font-bold transition active:scale-95"
            >
              ⌫
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full mt-3 py-3.5 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-racing font-bold text-sm uppercase tracking-wider shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <span>Kirish</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-[11px] text-zinc-500 text-center flex items-center justify-center gap-1.5 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
          <span>Xavfsiz sessiya kafolatlanadi</span>
        </div>
      </div>
    </div>
  );
};
