import React from 'react';
import { Printer, ExternalLink, X, AlertTriangle } from 'lucide-react';

interface IframePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IframePrintModal({ isOpen, onClose }: IframePrintModalProps) {
  if (!isOpen) return null;

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl max-w-md w-full p-6 relative space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-50 transition cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 shrink-0 border border-amber-100">
            <AlertTriangle className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-lg">
              Друк у фреймі обмежено
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">
              Браузер блокує прямий друк із фрейму попереднього перегляду через заходи безпеки.
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4.5 space-y-3.5">
          <p className="text-xs font-bold text-slate-700">Щоб роздрукувати цей звіт/документ:</p>
          <ol className="text-xs text-slate-600 space-y-2.5 list-decimal list-inside font-medium leading-relaxed">
            <li>
              Натисніть кнопку <span className="font-bold text-teal-700">«Відкрити у новій вкладці»</span> нижче.
            </li>
            <li>
              У новій вкладці натисніть на кнопку <span className="font-bold text-teal-700">«Друк»</span> ще раз (там вона працюватиме повноцінно).
            </li>
            <li>
              Налаштуйте параметри друку у стандартному вікні вашого браузера.
            </li>
          </ol>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-2">
          <button
            onClick={handleOpenInNewTab}
            className="flex-1 flex items-center justify-center space-x-2 bg-teal-700 hover:bg-teal-800 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Відкрити у новій вкладці</span>
          </button>
          <button
            onClick={() => {
              // Try printing anyway
              try {
                window.print();
              } catch (e) {
                console.error(e);
              }
              onClose();
            }}
            className="sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer text-center"
          >
            Спробувати друк
          </button>
        </div>
      </div>
    </div>
  );
}
