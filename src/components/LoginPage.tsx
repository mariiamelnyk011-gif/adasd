import React, { useState } from 'react';
import {
  ShieldCheck,
  Key,
  LogIn,
  Sparkles,
  BarChart3,
  Users,
  Calendar,
  Lock,
  CheckCircle2,
  AlertCircle,
  Mail,
  UserPlus,
  UserCheck
} from 'lucide-react';

interface LoginPageProps {
  onGoogleLogin: () => Promise<void>;
  onEmailLogin: (email: string, pass: string, isRegister: boolean, name?: string) => Promise<void>;
  onLocalLogin: (pinOrPassword: string, roleName: string, remember: boolean) => boolean;
  isLoading: boolean;
  errorMessage: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onGoogleLogin,
  onEmailLogin,
  onLocalLogin,
  isLoading,
  errorMessage,
}) => {
  const [authMode, setAuthMode] = useState<'email' | 'google' | 'pin'>('email');
  const [isRegister, setIsRegister] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');

  const [pinInput, setPinInput] = useState('');
  const [roleInput, setRoleInput] = useState('Марія Мельник (Власник)');
  const [rememberMe, setRememberMe] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!emailInput.trim() || !passwordInput.trim()) {
      setLocalError('Заповніть електронну пошту та пароль');
      return;
    }
    try {
      await onEmailLogin(emailInput.trim(), passwordInput.trim(), isRegister, displayNameInput.trim());
    } catch (err) {
      // Error is handled in App.tsx via errorMessage
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!pinInput.trim()) {
      setLocalError('Введіть PIN-код або пароль доступу');
      return;
    }

    const success = onLocalLogin(pinInput.trim(), roleInput.trim() || 'HR Менеджер', rememberMe);
    if (!success) {
      setLocalError('Невірний PIN-код доступу. Спробуйте 1234 або пароль адміністратора.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100/80 overflow-hidden grid grid-cols-1 md:grid-cols-12 relative z-10 my-auto">
        
        {/* Left Side: Brand & Visual Preview */}
        <div className="md:col-span-5 bg-gradient-to-br from-slate-900 via-slate-850 to-teal-950 p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="space-y-6 relative z-10">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-teal-500/20 border border-teal-500/30 rounded-xl text-teal-300 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-teal-400" />
              <span>HR Control Portal</span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-100 leading-tight">
                Кадровий Облік & HR Аналітика
              </h1>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Централізована система управління кандидатами, вакансіями, співбесідами та аналітикою звільнень.
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-start space-x-3">
                <div className="p-1.5 bg-teal-500/20 text-teal-400 rounded-lg shrink-0 mt-0.5">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Воронка рекрутингу</h4>
                  <p className="text-[11px] text-slate-400">Аналітика етапів та причин відмов у реальному часі</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Персональні справи</h4>
                  <p className="text-[11px] text-slate-400">Повна історія кандидата, резюме та результати співбесід</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-lg shrink-0 mt-0.5">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Синхронізація з Google Sheets</h4>
                  <p className="text-[11px] text-slate-400">Спільна робота команди без втрати даних</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between relative z-10">
            <span className="flex items-center space-x-1.5">
              <Lock className="h-3.5 w-3.5 text-teal-400" />
              <span>Захищене з'єднання</span>
            </span>
            <span className="font-semibold text-slate-300">v2.4 Pro</span>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-center bg-white">
          <div className="max-w-md mx-auto w-full space-y-6">
            
            <div className="text-left space-y-1">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Вхід у систему</h2>
              <p className="text-xs text-slate-500">Авторизуйтесь для отримання доступу до даних HR-порталу</p>
            </div>

            {/* Error Notifications */}
            {(errorMessage || localError) && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-2 animate-in fade-in duration-200 text-left">
                <div className="flex items-start space-x-2.5">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Інформація / Помилка Google OAuth</p>
                    <p className="text-[11px] leading-tight text-rose-700">{errorMessage || localError}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-rose-200/80 text-[11px] text-rose-900 space-y-2">
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 space-y-1 text-amber-900">
                    <p className="font-bold text-[11px] flex items-center gap-1">
                      <span>🛠 Як виправити 400: origin_mismatch в Google Cloud Console:</span>
                    </p>
                    <ol className="list-decimal pl-4 text-[10.5px] space-y-0.5 text-amber-900/90">
                      <li>Перейдіть на <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="underline font-bold">console.cloud.google.com/apis/credentials</a></li>
                      <li>Відкрийте ваші <strong>OAuth 2.0 Client IDs</strong> (<code>602934972978-...</code>).</li>
                      <li>В полі <strong>Authorized JavaScript origins</strong> додайте URL: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono select-all">https://crm-alpha-lake-41.vercel.app</code></li>
                      <li>Збережіть зміни у консолі Google Cloud.</li>
                    </ol>
                  </div>

                  <div className="pt-1 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onLocalLogin('1234', 'Марія Мельник (Власник)', true);
                      }}
                      className="w-full py-2.5 px-3 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl transition text-[11px] flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm"
                    >
                      <Key className="h-4 w-4 text-teal-200" />
                      <span>Увійти в CRM за PIN 1234 зараз (Без Google)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Demo Access banner */}
            <div className="bg-teal-50 border border-teal-100 rounded-2xl p-3 flex items-center justify-between">
              <div className="text-left">
                <p className="text-[11px] font-bold text-teal-900">Швидкий перегляд системи</p>
                <p className="text-[10px] text-teal-700">Вхід як Марія Мельник (Власник)</p>
              </div>
              <button
                type="button"
                onClick={() => onLocalLogin('1234', 'Марія Мельник (Власник)', true)}
                className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs flex items-center space-x-1"
              >
                <span>⚡ Увійти в 1 клік</span>
              </button>
            </div>

            {/* Auth Mode Toggle Tabs */}

            <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-2xl text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('email');
                  setLocalError(null);
                }}
                className={`py-2 px-2 rounded-xl transition flex items-center justify-center space-x-1.5 ${
                  authMode === 'email'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'hover:text-slate-900'
                }`}
              >
                <Mail className="h-3.5 w-3.5 text-teal-600" />
                <span>Email та пароль</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('google');
                  setLocalError(null);
                }}
                className={`py-2 px-2 rounded-xl transition flex items-center justify-center space-x-1.5 ${
                  authMode === 'google'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'hover:text-slate-900'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('pin');
                  setLocalError(null);
                }}
                className={`py-2 px-2 rounded-xl transition flex items-center justify-center space-x-1.5 ${
                  authMode === 'pin'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'hover:text-slate-900'
                }`}
              >
                <Key className="h-3.5 w-3.5 text-teal-600" />
                <span>PIN-код</span>
              </button>
            </div>

            {/* Email & Password Form */}
            {authMode === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-4 pt-2 text-left">
                {/* Sign In vs Register Toggle */}
                <div className="flex items-center justify-between bg-slate-50 p-1 rounded-xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setIsRegister(false)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      !isRegister ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Вхід
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRegister(true)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      isRegister ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Реєстрація
                  </button>
                </div>

                {isRegister && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Ваше ім'я та прізвище
                    </label>
                    <input
                      type="text"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      placeholder="Марія Мельник"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:border-teal-600 focus:outline-none transition"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Електронна пошта (Email)
                  </label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="mariia.melnyk011@gmail.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:border-teal-600 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Пароль
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:border-teal-600 focus:outline-none transition"
                  />
                  {isRegister && (
                    <p className="text-[10px] text-slate-400 mt-1">Мінімум 6 символів</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white rounded-2xl font-bold text-xs shadow-lg shadow-teal-700/20 transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isRegister ? (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Зареєструватися</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      <span>Увійти по Email</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Google Auth Option */}
            {authMode === 'google' && (
              <div className="space-y-4 pt-2">
                <div className="p-4 bg-teal-50/70 border border-teal-100 rounded-2xl space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-teal-900 font-bold text-xs">
                      <CheckCircle2 className="h-4 w-4 text-teal-600" />
                      <span>Синхронізація з Firebase & Google</span>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-md text-[10px] font-black uppercase">
                      Власник
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Система зареєстрована на власника <strong>Марія Мельник</strong> (<span className="text-teal-700 font-medium">mariia.melnyk011@gmail.com</span>). Увійдіть через Google для повного доступу.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onGoogleLogin}
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white rounded-2xl font-bold text-xs shadow-lg shadow-teal-700/20 transition flex items-center justify-center space-x-3 cursor-pointer group"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-4 h-4 bg-white rounded-full p-0.5 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span className="group-hover:translate-x-0.5 transition">Увійти через Google (Марія Мельник)</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* PIN / Password Auth Form */}
            {authMode === 'pin' && (
              <form onSubmit={handlePinSubmit} className="space-y-4 pt-2 text-left">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Ваше ім'я / посада
                    </label>
                    <div className="flex space-x-1">
                      <button
                        type="button"
                        onClick={() => setRoleInput('Марія Мельник (Власник)')}
                        className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md transition"
                      >
                        👑 Марія Мельник (Власник)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoleInput('HR Менеджер')}
                        className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
                      >
                        HR Менеджер
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    placeholder="наприклад: Марія Мельник (Власник)"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:border-teal-600 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    PIN-код або пароль доступу <span className="text-teal-600 font-extrabold">(стандартний: 1234)</span>
                  </label>
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Введіть 1234 або пароль"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:bg-white focus:border-teal-600 focus:outline-none transition tracking-widest"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center space-x-2 text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300"
                    />
                    <span className="font-semibold text-slate-700">Запам'ятати мене</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs shadow-lg shadow-slate-900/20 transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <LogIn className="h-4 w-4 text-teal-400" />
                  <span>Увійти в систему</span>
                </button>
              </form>
            )}

            <div className="pt-4 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400">
                Якщо ви забули пароль або потребуєте прав доступу, зверніться до системного адміністратора HR.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

