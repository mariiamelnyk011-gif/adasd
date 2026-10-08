import React, { useState, useEffect, useRef } from 'react';
import { HRSystemData, Candidate, Vacancy } from '../types';
import {
  Search,
  Zap,
  UserPlus,
  Users,
  Briefcase,
  Clock,
  Award,
  Calendar,
  FileSpreadsheet,
  X,
  ArrowRight,
  Command,
  Sparkles,
  Phone,
  Eye,
  Check
} from 'lucide-react';

interface GlobalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  data: HRSystemData;
  onSelectTab: (tab: any) => void;
  onOpenQuickInterview: () => void;
  onOpenCandidateFile: (candidateId: string) => void;
  onAddCandidateClick?: () => void;
  onAddVacancyClick?: () => void;
  onExportExcelAll?: () => void;
}

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({
  isOpen,
  onClose,
  data,
  onSelectTab,
  onOpenQuickInterview,
  onOpenCandidateFile,
  onAddCandidateClick,
  onAddVacancyClick,
  onExportExcelAll,
}) => {
  const [query, setQuery] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cleanQuery = query.trim().toLowerCase();

  // Filter candidates
  const matchingCandidates = (data.candidates || []).filter(c =>
    c.name.toLowerCase().includes(cleanQuery) ||
    c.phone.toLowerCase().includes(cleanQuery) ||
    c.status.toLowerCase().includes(cleanQuery) ||
    c.source.toLowerCase().includes(cleanQuery)
  ).slice(0, 5);

  // Filter vacancies
  const matchingVacancies = (data.vacancies || []).filter(v =>
    v.title.toLowerCase().includes(cleanQuery) ||
    v.department.toLowerCase().includes(cleanQuery) ||
    v.status.toLowerCase().includes(cleanQuery)
  ).slice(0, 4);

  // Quick action commands
  const quickActions = [
    {
      id: 'quick_interview',
      title: '⚡ Зареєструвати Експрес-Співбесіду',
      subtitle: 'Швидке внесення кандидата прямо під час розмови',
      category: 'Дії',
      action: () => {
        onClose();
        onOpenQuickInterview();
      }
    },
    {
      id: 'go_candidates',
      title: '👥 Перейти до бази Кандидатів',
      subtitle: 'Перегляд усіх статусів та воронок',
      category: 'Навігація',
      action: () => {
        onClose();
        onSelectTab('candidates');
      }
    },
    {
      id: 'go_vacancies',
      title: '💼 Переглянути Вакансії',
      subtitle: 'Активні та закриті вакансії компанії',
      category: 'Навігація',
      action: () => {
        onClose();
        onSelectTab('vacancies');
      }
    },
    {
      id: 'go_tables',
      title: '📊 Табличний режим та Експорт Excel',
      subtitle: 'Вивантаження всієї бази у пару кліків',
      category: 'Навігація',
      action: () => {
        onClose();
        onSelectTab('tables');
      }
    },
  ];

  const handleCopyPhone = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedText(phone);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-4 animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Input Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center space-x-3 bg-slate-50/80">
          <Search className="h-5 w-5 text-teal-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введіть ПІБ кандидата, номер телефону, вакансію чи дію..."
            className="w-full bg-transparent border-none text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-1 rounded-md bg-slate-200/50"
            >
              Скинути
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Hotkeys Bar */}
        <div className="px-4 py-2 bg-teal-50/60 border-b border-teal-100/50 flex flex-wrap items-center justify-between text-[11px] text-teal-800 font-semibold gap-2">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <kbd className="bg-white border border-teal-200 px-1.5 py-0.5 rounded text-[10px] shadow-2xs font-mono">Alt + I</kbd>
              <span>Експрес-співбесіда</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="bg-white border border-teal-200 px-1.5 py-0.5 rounded text-[10px] shadow-2xs font-mono">Alt + N</kbd>
              <span>Каут кандидата</span>
            </span>
          </div>
          <span className="text-slate-500 text-[10px]">Натисніть <kbd className="bg-white px-1 py-0.5 border border-slate-200 rounded font-mono">Esc</kbd> щоб закрити</span>
        </div>

        {/* Content Results */}
        <div className="overflow-y-auto p-4 space-y-5 divide-y divide-slate-100">
          {/* Quick Actions / Navigation */}
          {!cleanQuery && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">Швидкі Дії</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickActions.map((act) => (
                  <button
                    key={act.id}
                    onClick={act.action}
                    className="flex items-start space-x-3 p-3 rounded-xl hover:bg-teal-50/70 border border-transparent hover:border-teal-200 transition text-left cursor-pointer group"
                  >
                    <div className="p-2 bg-slate-100 group-hover:bg-teal-700 group-hover:text-white rounded-xl text-slate-700 transition shrink-0 mt-0.5">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 group-hover:text-teal-900">{act.title}</h4>
                      <p className="text-[11px] text-slate-500">{act.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Candidate Results */}
          {(cleanQuery ? matchingCandidates.length > 0 : true) && (
            <div className="pt-3 space-y-2">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                  <Users className="h-3.5 w-3.5 text-teal-600" />
                  <span>Кандидати ({matchingCandidates.length})</span>
                </h3>
                {!cleanQuery && (
                  <button
                    onClick={() => {
                      onClose();
                      onSelectTab('candidates');
                    }}
                    className="text-[11px] font-bold text-teal-700 hover:underline flex items-center space-x-1"
                  >
                    <span>Усі кандидати</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              {matchingCandidates.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-2 py-1">Кандидатів за запитом не знайдено</p>
              ) : (
                <div className="space-y-1">
                  {matchingCandidates.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        onClose();
                        onOpenCandidateFile(c.id);
                      }}
                      className="p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 hover:border-slate-200 flex items-center justify-between transition cursor-pointer group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-teal-700">{c.name}</h4>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                            <span className="font-medium text-slate-600 select-all">{c.phone}</span>
                            <span>•</span>
                            <span className="font-semibold text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded text-[10px]">
                              {c.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => handleCopyPhone(e, c.phone)}
                          className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition"
                          title="Скопіювати телефон"
                        >
                          {copiedText === c.phone ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Phone className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          className="p-1.5 text-teal-700 hover:bg-teal-100 rounded-lg font-bold text-[11px] flex items-center space-x-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Картка</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Vacancies Results */}
          {(cleanQuery ? matchingVacancies.length > 0 : true) && (
            <div className="pt-3 space-y-2">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                  <Briefcase className="h-3.5 w-3.5 text-teal-600" />
                  <span>Вакансії ({matchingVacancies.length})</span>
                </h3>
              </div>

              {matchingVacancies.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-2 py-1">Вакансій не знайдено</p>
              ) : (
                <div className="space-y-1">
                  {matchingVacancies.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => {
                        onClose();
                        onSelectTab('vacancies');
                      }}
                      className="p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 flex items-center justify-between transition cursor-pointer group"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-teal-700">{v.title}</h4>
                        <p className="text-[11px] text-slate-500">{v.department} • {v.salary}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        v.status === 'Активна' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {v.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
