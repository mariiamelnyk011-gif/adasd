import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Laptop,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  Users,
  RefreshCw,
  Key,
  ExternalLink,
  X,
  AlertCircle,
  Globe
} from 'lucide-react';
import QRCode from 'qrcode';
import { RemoteSessionInfo, fetchAllActiveSessions, UserSession } from '../lib/sessionManager';

interface MultiDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: UserSession | null;
  candidatesCount: number;
  vacanciesCount: number;
}

export const MultiDeviceModal: React.FC<MultiDeviceModalProps> = ({
  isOpen,
  onClose,
  currentSession,
  candidatesCount,
  vacanciesCount,
}) => {
  const [sessions, setSessions] = useState<RemoteSessionInfo[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'devices' | 'instructions'>('qr');

  // Compute direct quick-login URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const currentRole = currentSession?.user?.role || currentSession?.user?.displayName || 'Марія Мельник (Власник)';
  const quickLoginUrl = `${baseUrl}/?auth=1234&user=${encodeURIComponent(currentRole)}`;

  const refreshSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const list = await fetchAllActiveSessions();
      setSessions(list);
    } catch (err) {
      console.warn('Failed to load sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshSessions();
      // Generate crisp QR code
      QRCode.toDataURL(quickLoginUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#042f2e', // teal-950
          light: '#ffffff'
        }
      })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error('QR code generation error:', err));
    }
  }, [isOpen, quickLoginUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(quickLoginUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyPin = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText('1234');
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-teal-800 to-emerald-900 text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex items-center space-x-3 relative z-10">
            <div className="p-2.5 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-xs">
              <Smartphone className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black tracking-tight">Доступ з багатьох пристроїв</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 rounded-full">
                  Одночасні сесії
                </span>
              </div>
              <p className="text-xs text-teal-100 mt-0.5">
                Працюйте з комп'ютера, смартфона та планшета одночасно без викидання з системи
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-teal-200 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer relative z-10"
            title="Закрити"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Security & Sync Banner */}
        <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Постійна сесія:</strong> вхід під акаунтом <strong>{currentRole}</strong> активний. Інші пристрої не переривають роботу цього комп'ютера.
            </span>
          </div>
          <span className="hidden sm:inline-flex text-[11px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
            База: {candidatesCount} канд.
          </span>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-slate-100 flex space-x-2">
          <button
            onClick={() => setActiveTab('qr')}
            className={`pb-3 px-3 text-xs font-bold transition flex items-center space-x-1.5 border-b-2 ${
              activeTab === 'qr'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>QR-код для смартфона</span>
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={`pb-3 px-3 text-xs font-bold transition flex items-center space-x-1.5 border-b-2 ${
              activeTab === 'devices'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Laptop className="h-4 w-4" />
            <span>Підключені сесії {sessions.length > 0 && `(${sessions.length})`}</span>
          </button>

          <button
            onClick={() => setActiveTab('instructions')}
            className={`pb-3 px-3 text-xs font-bold transition flex items-center space-x-1.5 border-b-2 ${
              activeTab === 'instructions'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Key className="h-4 w-4" />
            <span>Як зайти вручну / PIN</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-left">
          
          {/* TAB 1: QR-CODE QUICK CONNECT */}
          {activeTab === 'qr' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                
                {/* QR Code Container */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-center">
                  {qrCodeDataUrl ? (
                    <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200">
                      <img
                        src={qrCodeDataUrl}
                        alt="QR-код для входу"
                        className="w-48 h-48 sm:w-56 sm:h-56 rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 sm:w-56 sm:h-56 bg-slate-200 animate-pulse rounded-lg flex items-center justify-center text-xs text-slate-400">
                      Генерація коду...
                    </div>
                  )}
                  <p className="text-[11px] font-bold text-slate-600 mt-3 flex items-center justify-center space-x-1">
                    <Smartphone className="h-3.5 w-3.5 text-teal-600" />
                    <span>Наведіть камеру смартфона</span>
                  </p>
                </div>

                {/* Steps & Direct Link */}
                <div className="md:col-span-7 space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900">Миттєвий вхід на телефоні за 3 секунди</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Камера смартфона автоматично відкриє систему з усіма <strong>{candidatesCount} кандидатами</strong> та <strong>{vacanciesCount} вакансіями</strong> без введення логінів чи паролів.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-start space-x-3 text-xs">
                      <div className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px]">
                        1
                      </div>
                      <p className="text-slate-600">
                        Відкрийте стандартну програму <strong>Камера</strong> на iPhone або Android.
                      </p>
                    </div>

                    <div className="flex items-start space-x-3 text-xs">
                      <div className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px]">
                        2
                      </div>
                      <p className="text-slate-600">
                        Наведіть на QR-код зліва та натисніть на жовте/синє посилання, що з'явиться.
                      </p>
                    </div>

                    <div className="flex items-start space-x-3 text-xs">
                      <div className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px]">
                        3
                      </div>
                      <p className="text-slate-600">
                        Ви автоматично увійдете в систему. Сесія на цьому комп'ютері <strong>не перерветься</strong>!
                      </p>
                    </div>
                  </div>

                  {/* Direct Link Box */}
                  <div className="pt-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Пряме посилання для відправки в Telegram / Viber / пошту:
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={quickLoginUrl}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 select-all"
                      />
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl transition text-xs flex items-center space-x-1.5 shrink-0 cursor-pointer shadow-xs"
                      >
                        {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedLink ? 'Скопійовано!' : 'Копіювати'}</span>
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACTIVE SESSIONS */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900">Підключені девайси під вашим акаунтом</h4>
                  <p className="text-xs text-slate-500">
                    Усі пристрої мають спільний доступ до центральної бази та автоматично оновлюються
                  </p>
                </div>
                <button
                  type="button"
                  onClick={refreshSessions}
                  disabled={isLoadingSessions}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center space-x-1 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingSessions ? 'animate-spin' : ''}`} />
                  <span>Оновити</span>
                </button>
              </div>

              <div className="space-y-2">
                {/* Current Device Card */}
                <div className="p-3.5 bg-teal-50/60 border border-teal-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-teal-600 text-white rounded-xl">
                      <Laptop className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900">
                          {currentSession?.deviceName || 'Поточний комп\'ютер / браузер'}
                        </span>
                        <span className="px-2 py-0.5 text-[9px] font-extrabold bg-teal-200 text-teal-900 rounded-full">
                          Цей пристрій
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Користувач: <strong>{currentRole}</strong> • Статус: <span className="text-emerald-600 font-bold">Онлайн зараз</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Remote Sessions List */}
                {sessions.filter(s => !s.isCurrent).map((s) => (
                  <div key={s.deviceId} className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                        {s.deviceName?.includes('iPhone') || s.deviceName?.includes('Android') ? (
                          <Smartphone className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Laptop className="h-4 w-4 text-teal-600" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800">{s.deviceName || 'Підключений пристрій'}</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {s.user?.displayName || s.user?.role || 'Користувач'} • Вхід: {new Date(s.loginTime).toLocaleDateString('uk-UA')} {new Date(s.loginTime).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Активна сесія</span>
                  </div>
                ))}

                {sessions.filter(s => !s.isCurrent).length === 0 && (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center space-y-1 text-slate-500 text-xs">
                    <p className="font-semibold">Інших підключених пристроїв поки що немає</p>
                    <p className="text-[11px] text-slate-400">
                      Відскануйте QR-код з першої вкладки зі свого телефону, щоб підключити мобільний пристрій.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MANUAL INSTRUCTIONS & PIN */}
          {activeTab === 'instructions' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-900">Вхід на будь-якому комп'ютері або телефоні вручну</h4>
                <p className="text-xs text-slate-500">
                  Якщо ви відкриваєте систему на іншому пристрої через браузер:
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">1. Загальний PIN-код команди:</p>
                    <p className="text-[11px] text-slate-500">Введіть його у формі входу на будь-якому пристрої</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1.5 bg-teal-100 text-teal-900 font-mono font-black text-sm rounded-xl tracking-wider">
                      1234
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPin}
                      className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 transition"
                      title="Скопіювати PIN"
                    >
                      {copiedPin ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 text-xs text-slate-600 space-y-1.5">
                  <p><strong>Адреса системи:</strong> {baseUrl}</p>
                  <p className="text-[11px] text-slate-500">
                    Виберіть свій профіль (наприклад, <em>«Марія Мельник (Власник)»</em>) та натисніть «Увійти».
                  </p>
                </div>
              </div>

              {/* Mobile app tip */}
              <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl space-y-2 text-teal-900 text-xs">
                <div className="flex items-center space-x-2">
                  <Smartphone className="h-4 w-4 text-teal-700" />
                  <p className="font-bold">Як користуватися як додатком на телефоні:</p>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-teal-800">
                  <li><strong>iPhone (Safari):</strong> натисніть кнопку «Поділитися» (квадрат зі стрілкою) → <em>«На початковий екран» (Add to Home Screen)</em>.</li>
                  <li><strong>Android (Chrome):</strong> натисніть три крапки вгорі → <em>«Встановити додаток»</em> або <em>«Додати на головний екран»</em>.</li>
                  <li>Додаток відкриватиметься на повний екран без рядка браузера, як справжній мобільний додаток!</li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span className="text-[11px]">Всі пристрої автоматично синхронізують зміни</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition cursor-pointer"
          >
            Зрозуміло
          </button>
        </div>

      </div>
    </div>
  );
};
