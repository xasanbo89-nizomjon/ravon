import React, { useState, useEffect } from 'react';
import { Lock, X, ShieldAlert, User, KeyRound, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { AdminUser } from '../../types';
import { triggerHaptic } from '../../utils/telegramWebApp';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  admins: AdminUser[];
  onLoginSuccess: (user: AdminUser) => void;
}

const REQUIRED_ADMIN_LOGIN = 'sherzodjanovich_7';
const REQUIRED_ADMIN_PASS = 'xasan.95';

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLogin('');
      setPassword('');
      setShowPassword(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const enteredLogin = login.trim();
    const enteredPass = password.trim();

    if (!enteredLogin || !enteredPass) {
      setError('Iltimos, login va parolni to‘liq kiriting.');
      triggerHaptic('error');
      return;
    }

    // Strictly allow ONLY login = sherzodjanovich_7 and password = xasan.95
    if (enteredLogin === REQUIRED_ADMIN_LOGIN && enteredPass === REQUIRED_ADMIN_PASS) {
      triggerHaptic('success');
      const verifiedSuperAdmin: AdminUser = {
        id: 'superadmin-sherzod',
        fullName: 'Bosh Superadmin (@Sherzodjanovich_7)',
        email: REQUIRED_ADMIN_LOGIN,
        password: REQUIRED_ADMIN_PASS,
        role: 'superadmin',
        isBlocked: false,
        createdAt: new Date().toISOString(),
      };

      setLogin('');
      setPassword('');
      onLoginSuccess(verifiedSuperAdmin);
      return;
    }

    triggerHaptic('error');
    setError('Login yoki parol xato! Admin panelga kirish rad etildi.');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#0e1017] border-2 border-red-600/70 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-red-950/60 space-y-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
          aria-label="Yopish"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-red-600 to-red-950 border border-red-500 flex items-center justify-center text-white shadow-lg shadow-red-900/50">
            <Lock className="w-7 h-7" />
          </div>

          <div className="inline-block px-3 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/60 text-[10px] font-bold uppercase tracking-widest font-racing">
            2-Qadam: Login va Parol
          </div>
          <h2 className="text-2xl font-racing font-bold text-white tracking-wide">
            Admin Avtorizatsiyasi
          </h2>
          <p className="text-xs text-zinc-400">
            Maxfiy kod tasdiqlandi. Endi shaxsiy Login va Parolni kiriting
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs" autoComplete="off">
          <div>
            <label className="block text-zinc-300 font-semibold mb-1.5">
              Login:
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoFocus
                autoComplete="off"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Loginni kiriting..."
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-3 pl-10 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 transition"
              />
              <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-zinc-300 font-semibold">Parol:</label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Parolni kiriting..."
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-3 pl-10 pr-10 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 transition"
              />
              <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-racing font-bold uppercase text-xs tracking-wider shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <span>Admin Panelni Ochish</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-red-500" />
          <span>3 bosqichli himoya: Kod (0606) + Login + Parol</span>
        </div>
      </div>
    </div>
  );
};
