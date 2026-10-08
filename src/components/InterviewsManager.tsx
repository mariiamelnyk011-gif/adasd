import React, { useState, useMemo, useEffect } from 'react';
import { Interview, Candidate, InterviewStatus, InterviewResult, Vacancy, Intern, CandidateStatus } from '../types';
import { formatDateTime, getTodayDateString, getTodayDateTimeString, formatDate, calculateAge } from '../lib/dateUtils';
import { findMatchingCandidate } from '../lib/candidateUtils';
import IframePrintModal from './IframePrintModal';
import { 
  Calendar, 
  Plus, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Star, 
  MessageSquare, 
  User, 
  Trash2, 
  Flame, 
  Snowflake, 
  Sparkles, 
  AlertTriangle,
  FileText,
  ExternalLink,
  Cake,
  Globe,
  Briefcase,
  Building2,
  MapPin,
  Printer,
  Phone,
  X,
  Zap,
  UserCheck,
  Save,
  Check,
  FolderOpen,
  Eye,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Upload,
  Paperclip,
  CheckCircle2,
  Edit2,
  Copy
} from 'lucide-react';
import { CvPreviewModal } from './CvPreviewModal';
import ScheduleInterviewModal from './ScheduleInterviewModal';
import InterviewsFeedbackView from './InterviewsFeedbackView';

interface InterviewsManagerProps {
  interviews: Interview[];
  candidates: Candidate[];
  vacancies: Vacancy[];
  sourcesList?: string[];
  interviewStatusesList: string[];
  interviewResultsList: string[];
  onAddInterview: (interview: Omit<Interview, 'id'>) => void;
  onUpdateInterview: (interview: Interview) => void;
  onDeleteInterview?: (interviewId: string) => void;
  onViewPersonalFile?: (candidateId: string) => void;
  onUpdateCandidate?: (candidate: Candidate) => void;
  onAddCandidate?: (candidate: Omit<Candidate, 'id' | 'appliedAt'>) => Candidate;
  onDeleteCandidate?: (candidateId: string) => void;
  onOpenQuickInterview?: () => void;
  onAddIntern?: (intern: Omit<Intern, 'id'>) => void;
}

const QUICK_TAGS = [
  '⚡ Готовий/а приступити негайно',
  '💼 Є релевантний досвід',
  '🗣️ Приємна та комунікабельна людина',
  '⏱️ Шукає повну зайнятість',
  '🎓 Впевнено пройшов/ла співбесіду',
  '🏠 Проживає поруч з офісом',
  '⚠️ Потрібне додаткове навчання'
];

const DEFAULT_REJECTION_REASONS = [
  'Невідповідність вимогам (hard skills)',
  'Завищені очікування по заробітній платі',
  'Не пройшов співбесіду',
  'Не відповідає культурі компанії (soft skills)',
  'Не підходить графік роботи',
  'Не підходить заробітна плата',
  'Не підходить локація',
  'Кандидат сам відмовився',
  'Не з\'явився на співбесіду',
  'Інше'
];

const REJECTION_CHIPS = [
  '❌ Hard skills / досвід',
  '💰 Очікування по ЗП',
  '⏰ Графік / умови',
  '📍 Локація / дорога',
  '🚫 Відмова кандидата',
  '📵 Не прийшов на зустріч'
];

// Dynamically compute visual style and emojis for customized interview results
const getResultStyle = (value: string) => {
  const lower = value.toLowerCase();
  if (lower.includes('керівник')) {
    return { label: `👔 ${value}`, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  }
  if (lower.includes('успіш') || lower.includes('позитив') || lower.includes('прийнят') || lower.includes('так')) {
    return { label: `✅ ${value}`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (lower.includes('не відбу') || lower.includes('скасов') || lower.includes('відмов') || lower.includes('ні')) {
    return { label: `❌ ${value}`, color: 'bg-rose-50 text-rose-700 border-rose-200' };
  }
  if (lower.includes('стажування') || lower.includes('стажер')) {
    return { label: `🎓 ${value}`, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  }
  if (lower.includes('резерв')) {
    return { label: `📦 ${value}`, color: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
  if (lower.includes('подум') || lower.includes('вага')) {
    return { label: `🤔 ${value}`, color: 'bg-purple-50 text-purple-700 border-purple-200' };
  }
  return { label: `⏳ ${value}`, color: 'bg-slate-50 text-slate-700 border-slate-200' };
};

// Helpers for messenger links
function getTelegramLink(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '38' + digits;
  }
  return `https://t.me/+${digits}`;
}

function getViberLink(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '38' + digits;
  }
  return `viber://chat?number=%2B${digits}`;
}

export default function InterviewsManager({
  interviews,
  candidates,
  vacancies,
  sourcesList = ['work.ua', 'robota.ua', 'facebook', 'instagram', 'threads', 'працівник', 'інше'],
  interviewStatusesList,
  interviewResultsList,
  onAddInterview,
  onUpdateInterview,
  onDeleteInterview,
  onViewPersonalFile,
  onUpdateCandidate,
  onAddCandidate,
  onDeleteCandidate,
  onOpenQuickInterview,
  onAddIntern
}: InterviewsManagerProps) {
  const [filter, setFilter] = useState<string>('Всі');
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [candidateToRemove, setCandidateToRemove] = useState<{ cand: Candidate; interview?: Interview } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Search & Filter States
  const [searchName, setSearchName] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [previewCv, setPreviewCv] = useState<{ candidateName: string; fileName?: string; fileContent?: string; cvLink?: string } | null>(null);

  const handlePrint = () => {
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) {
      setShowPrintModal(true);
    } else {
      window.print();
    }
  };

  const [candidateForModal, setCandidateForModal] = useState<Candidate | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchName, filterStartDate, filterEndDate]);

  const isTargetFeedbackInterview = (i: Interview): boolean => {
    if (i.status === 'Скасовано') return false;
    const statusLower = (i.status || '').toLowerCase();
    const resultLower = (i.result || '').toLowerCase();
    const cand = candidates.find(c => c.id === i.candidateId);
    const candStatusLower = (cand?.status || '').toLowerCase();

    return (
      statusLower.includes('зворотн') ||
      statusLower.includes('фідбек') ||
      resultLower.includes('зворотн') ||
      resultLower.includes('фідбек') ||
      candStatusLower.includes('зворотн') ||
      candStatusLower.includes('фідбек')
    );
  };

  const feedbackPendingCount = useMemo(() => {
    return interviews.filter(i => isTargetFeedbackInterview(i) && !i.feedbackGiven).length;
  }, [interviews, candidates]);

  const filteredInterviews = useMemo(() => {
    return interviews.filter(i => {
      // 1. Status Filter
      if (filter === 'Заплановані' || filter === 'Заплановано') {
        if (i.status !== 'Заплановано') return false;
      } else if (filter === 'Завершено') {
        if (i.status !== 'Завершено') return false;
      } else if (filter === 'Зворотний зв\'язок' || filter === 'Надати зворотний зв\'язок') {
        return isTargetFeedbackInterview(i);
      } else if (filter === 'До керівника' || filter === 'Співбесіда з керівником') {
        const resultLower = (i.result || '').toLowerCase();
        const cand = candidates.find(c => c.id === i.candidateId);
        const isManager = resultLower.includes('керівник') || 
                          (i.interviewer || '').toLowerCase().includes('керівник') || 
                          cand?.status === 'Співбесіда з керівником';
        if (!isManager) return false;
      } else if (filter === 'Стажування') {
        const resultLower = (i.result || '').toLowerCase();
        const cand = candidates.find(c => c.id === i.candidateId);
        const isInternship = resultLower.includes('стажуван') || 
                             resultLower.includes('успішно') || 
                             cand?.status === 'Стажування';
        if (!isInternship) return false;
      } else if (filter === 'Відмови' || filter === 'Відмовлено') {
        const resultLower = (i.result || '').toLowerCase();
        const isRejected = i.status === 'Скасовано' || i.status === 'Не прийшов' || resultLower.includes('відмов') || resultLower.includes('скасов') || resultLower.includes('не відбу') || resultLower.includes('не прийшов');
        if (!isRejected) return false;
      } else if (filter === 'Очікують рішення' || filter === 'Очікує рішення') {
        // Exclude scheduled, cancelled, or no-show
        if (i.status === 'Заплановано' || i.status === 'Скасовано' || i.status === 'Не прийшов') {
          return false;
        }
        const resultLower = (i.result || '').toLowerCase();
        const isRejected = resultLower.includes('відмов') || resultLower.includes('скасов') || resultLower.includes('не відбу') || resultLower.includes('не прийшов');
        if (isRejected) return false;
        const isPending = i.result === 'Очікує рішення' || resultLower.includes('очікує');
        if (!isPending) return false;
      } else if (filter === 'Резерв') {
        if (i.status === 'Заплановано' || i.status === 'Скасовано' || i.status === 'Не прийшов') {
          return false;
        }
        const resultLower = (i.result || '').toLowerCase();
        const isReserve = i.result === 'Резерв' || resultLower.includes('резерв');
        if (!isReserve) return false;
      } else if (filter === 'Резерв / Очікує рішення') {
        if (i.status === 'Заплановано' || i.status === 'Скасовано' || i.status === 'Не прийшов') {
          return false;
        }
        const resultLower = (i.result || '').toLowerCase();
        const isRejected = resultLower.includes('відмов') || resultLower.includes('скасов') || resultLower.includes('не відбу') || resultLower.includes('не прийшов');
        if (isRejected) return false;
        const isReserveOrPending = i.result === 'Резерв' || i.result === 'Очікує рішення' || resultLower.includes('резерв') || resultLower.includes('очікує');
        if (!isReserveOrPending) return false;
      }

      // 2. Name Search
      if (searchName.trim()) {
        const query = searchName.toLowerCase();
        if (!i.candidateName.toLowerCase().includes(query)) return false;
      }

      // 3. Date Filter
      if (i.dateTime) {
        const interviewDate = i.dateTime.split('T')[0]; // YYYY-MM-DD
        if (filterStartDate && interviewDate < filterStartDate) return false;
        if (filterEndDate && interviewDate > filterEndDate) return false;
      } else if (filterStartDate || filterEndDate) {
        return false;
      }

      return true;
    });
  }, [interviews, filter, searchName, filterStartDate, filterEndDate]);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredInterviews.length / pageSize));

  const paginatedInterviews = useMemo(() => {
    if (pageSize === 'all') return filteredInterviews;
    const start = (currentPage - 1) * pageSize;
    return filteredInterviews.slice(start, start + pageSize);
  }, [filteredInterviews, currentPage, pageSize]);

  // Candidates waiting for an interview (status is Новий or Співбесіда and has no interviews OR has a scheduled interview)
  const candidatesWithoutInterviews = useMemo(() => {
    return candidates.filter(c => {
      if (c.status !== 'Новий' && c.status !== 'Співбесіда') return false;
      const hasInterview = interviews.some(i => i.candidateId === c.id);
      if (!hasInterview) return true;
      return interviews.some(i => i.candidateId === c.id && i.status === 'Заплановано');
    }).sort((a, b) => b.id.localeCompare(a.id));
  }, [candidates, interviews]);

  const handleAddNewInterview = () => {
    setSelectedInterview(null);
    setCandidateForModal(null);
    setIsModalOpen(true);
  };

  const handleOpenAddForCandidate = (cand: Candidate) => {
    const existing = interviews.find(i => 
      i.candidateId === cand.id || 
      (i.candidateName && cand.name && i.candidateName.trim().toLowerCase() === cand.name.trim().toLowerCase())
    );
    if (existing) {
      setSelectedInterview(existing);
      setCandidateForModal(null);
    } else {
      setSelectedInterview(null);
      setCandidateForModal(cand);
    }
    setIsModalOpen(true);
  };

  const handleOpenEdit = (interview: Interview) => {
    setSelectedInterview(interview);
    setCandidateForModal(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Candidates Waiting for Interview Banner/Grid */}
      {candidatesWithoutInterviews.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/80 p-5 rounded-2xl shadow-xs animate-fade-in no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-amber-200/60 gap-2">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
              <div>
                <h5 className="text-sm font-bold text-slate-800">
                  Чекають на співбесіду ({candidatesWithoutInterviews.length})
                </h5>
                <p className="text-[11px] text-amber-800 font-medium">Нові кандидати, що очікують призначення дати</p>
              </div>
            </div>
            <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 w-fit">
              Потрібна дія
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
            {candidatesWithoutInterviews.map((cand) => {
              const vac = vacancies.find(v => v.id === cand.vacancyId);
              const candInterview = interviews.find(i => i.candidateId === cand.id && i.status === 'Заплановано');
              return (
                <div
                  key={cand.id}
                  onClick={() => {
                    if (candInterview) {
                      handleOpenEdit(candInterview);
                    } else {
                      handleOpenAddForCandidate(cand);
                    }
                  }}
                  className="bg-white p-3 rounded-xl border border-amber-200/60 flex items-center justify-between gap-3 hover:bg-amber-50/50 hover:border-amber-300 transition cursor-pointer shadow-2xs hover:shadow-xs group animate-scale-up"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-slate-800 capitalize truncate group-hover:text-teal-800 transition">{cand.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-semibold truncate">
                      💼 {vac ? vac.title : 'Без вакансії'}
                    </p>
                    {candInterview ? (
                      <p className="text-[10px] text-amber-700 bg-amber-100/60 border border-amber-200/50 px-1.5 py-0.5 rounded-lg mt-1 font-bold w-fit flex items-center gap-1 animate-fade-in">
                        <Calendar className="h-3 w-3 text-amber-600 shrink-0" />
                        <span>Співбесіда: {formatDateTime(candInterview.dateTime)}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium truncate flex items-center gap-1">
                        <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700 select-all">{cand.phone || 'без телефону'}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCandidateToRemove({ cand, interview: candInterview });
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0 cursor-pointer"
                      title="Видалити з черги співбесід"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (candInterview) {
                          handleOpenEdit(candInterview);
                        } else {
                          handleOpenAddForCandidate(cand);
                        }
                      }}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer shrink-0 ${
                        candInterview 
                          ? 'bg-amber-100/70 hover:bg-amber-200/80 text-amber-800 border border-amber-200/50' 
                          : 'bg-amber-500 hover:bg-amber-600 text-white'
                      }`}
                    >
                      {candInterview ? (
                        <>
                          <Calendar className="h-3 w-3" />
                          <span>Картка</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3" />
                          <span>Призначити</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Interviews List Panel */}
      <div className="space-y-4">
        {/* Actions header */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {['Всі', 'Заплановані', 'Зворотний зв\'язок', 'До керівника', 'Стажування', 'Очікують рішення', 'Завершено', 'Резерв', 'Відмови'].map((opt) => {
              let count = 0;
              if (opt === 'Всі') {
                count = interviews.length;
              } else if (opt === 'Заплановані') {
                count = interviews.filter(i => i.status === 'Заплановано').length;
              } else if (opt === 'Зворотний зв\'язок') {
                count = feedbackPendingCount;
              } else if (opt === 'До керівника') {
                count = interviews.filter(i => {
                  const r = (i.result || '').toLowerCase();
                  const cand = candidates.find(c => c.id === i.candidateId);
                  return r.includes('керівник') || (i.interviewer || '').toLowerCase().includes('керівник') || cand?.status === 'Співбесіда з керівником';
                }).length;
              } else if (opt === 'Стажування') {
                count = interviews.filter(i => {
                  const r = (i.result || '').toLowerCase();
                  const cand = candidates.find(c => c.id === i.candidateId);
                  return r.includes('стажуван') || r.includes('успішно') || cand?.status === 'Стажування';
                }).length;
              } else if (opt === 'Завершено') {
                count = interviews.filter(i => i.status === 'Завершено').length;
              } else if (opt === 'Очікують рішення') {
                count = interviews.filter(i => {
                  if (i.status === 'Заплановано' || i.status === 'Скасовано' || i.status === 'Не прийшов') return false;
                  const r = (i.result || '').toLowerCase();
                  const isRejected = r.includes('відмов') || r.includes('скасов') || r.includes('не відбу') || r.includes('не прийшов');
                  if (isRejected) return false;
                  return i.result === 'Очікує рішення' || r.includes('очікує');
                }).length;
              } else if (opt === 'Резерв') {
                count = interviews.filter(i => {
                  if (i.status === 'Заплановано' || i.status === 'Скасовано' || i.status === 'Не прийшов') return false;
                  const r = (i.result || '').toLowerCase();
                  return i.result === 'Резерв' || r.includes('резерв');
                }).length;
              } else if (opt === 'Відмови') {
                count = interviews.filter(i => {
                  const r = (i.result || '').toLowerCase();
                  return i.status === 'Скасовано' || i.status === 'Не прийшов' || r.includes('відмов') || r.includes('скасов') || r.includes('не відбу') || r.includes('не прийшов');
                }).length;
              }

              const isActive = filter === opt || 
                (opt === 'Заплановані' && filter === 'Заплановано') ||
                (opt === 'Зворотний зв\'язок' && (filter === 'Зворотний зв\'язок' || filter === 'Надати зворотний зв\'язок')) ||
                (opt === 'До керівника' && (filter === 'До керівника' || filter === 'Співбесіда з керівником')) ||
                (opt === 'Очікують рішення' && filter === 'Очікує рішення') ||
                (opt === 'Відмови' && filter === 'Відмовлено');

              return (
                <button
                  key={opt}
                  onClick={() => setFilter(opt)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-teal-700 text-white shadow-xs font-bold'
                      : (opt === 'Зворотний зв\'язок' && count > 0)
                      ? 'bg-amber-50 text-amber-900 border border-amber-200/80 hover:bg-amber-100 font-bold'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {opt === 'Всі' && '📋 '}
                  {opt === 'Заплановані' && '📅 '}
                  {opt === 'Зворотний зв\'язок' && '📞 '}
                  {opt === 'До керівника' && '👔 '}
                  {opt === 'Стажування' && '🎓 '}
                  {opt === 'Завершено' && '✅ '}
                  {opt === 'Очікують рішення' && '⏳ '}
                  {opt === 'Резерв' && '📦 '}
                  {opt === 'Відмови' && '❌ '}
                  <span>{opt === 'Зворотний зв\'язок' ? 'Надати зворотний зв\'язок' : opt}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive 
                      ? 'bg-white/20 text-white' 
                      : (opt === 'Зворотний зв\'язок' && count > 0)
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-200/70 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="no-print hidden sm:flex items-center justify-center space-x-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="Надрукувати список"
            >
              <Printer className="h-4 w-4 text-slate-500" />
              <span>Друк</span>
            </button>
            <button
              id="add-interview-btn"
              onClick={handleAddNewInterview}
              className="flex items-center justify-center space-x-1.5 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Призначити співбесіду</span>
            </button>
          </div>
        </div>

        {/* If feedback tab is active, show the specialized feedback workspace */}
        {filter === 'Зворотний зв\'язок' || filter === 'Надати зворотний зв\'язок' ? (
          <InterviewsFeedbackView
            interviews={interviews}
            candidates={candidates}
            vacancies={vacancies}
            onUpdateInterview={onUpdateInterview}
            onUpdateCandidate={onUpdateCandidate}
            onViewPersonalFile={onViewPersonalFile}
            onAddIntern={onAddIntern}
          />
        ) : (
          <>
            {/* Search and Date Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Пошук за ім'ям..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden text-slate-700 font-semibold placeholder-slate-400"
            />
            <div className="absolute left-3 top-2.5 text-slate-400">
              <User className="h-4 w-4 text-slate-400" />
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
            <span>З дати:</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden text-slate-700 font-semibold"
            />
            <span>По дату:</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden text-slate-700 font-semibold"
            />
            {(searchName || filterStartDate || filterEndDate) && (
              <button
                onClick={() => {
                  setSearchName('');
                  setFilterStartDate('');
                  setFilterEndDate('');
                }}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-700 rounded-xl text-[10px] font-extrabold uppercase tracking-wide transition shrink-0 cursor-pointer"
              >
                Очистити
              </button>
            )}
          </div>
        </div>

        {/* List of Interviews */}
        <div className="space-y-3">
          {filteredInterviews.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-400 text-sm">
              Співбесід не знайдено
            </div>
          ) : (
            paginatedInterviews.map((interview) => {
              const resStyle = getResultStyle(interview.result || 'Очікує рішення');
              const isSelected = selectedInterview?.id === interview.id;
              const candidate = candidates.find(c => c.id === interview.candidateId);
              const vacancy = candidate ? vacancies.find(v => v.id === candidate.vacancyId) : null;
              
              return (
                <div
                  key={interview.id}
                  id={`interview-card-${interview.id}`}
                  onClick={() => handleOpenEdit(interview)}
                  className={`bg-white p-5 rounded-2xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSelected
                      ? 'border-teal-600 shadow-xs bg-teal-50/5'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-xl shrink-0 ${
                        interview.status === 'Заплановано' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        (interview.status === 'Зворотний зв\'язок' || (interview.status || '').toLowerCase().includes('зворотн')) ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        interview.status === 'Завершено' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        interview.status === 'Не прийшов' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                        'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}>
                        {(interview.status === 'Зворотний зв\'язок' || (interview.status || '').toLowerCase().includes('зворотн')) ? (
                          <Phone className="h-5 w-5 text-amber-700 animate-pulse" />
                        ) : (
                          <Calendar className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1.5 leading-tight">
                          <h4 
                            onClick={(e) => {
                              if (onViewPersonalFile) {
                                e.stopPropagation();
                                onViewPersonalFile(interview.candidateId);
                              }
                            }}
                            className={`font-bold text-slate-800 text-base ${
                              onViewPersonalFile ? 'hover:text-teal-700 hover:underline underline-offset-4 cursor-pointer' : ''
                            }`}
                            title={onViewPersonalFile ? "Переглянути особову справу" : ""}
                          >
                            {interview.candidateName}
                          </h4>
                          
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            interview.status === 'Заплановано' ? 'bg-amber-50 text-amber-700 border border-amber-200/50' :
                            (interview.status === 'Зворотний зв\'язок' || (interview.status || '').toLowerCase().includes('зворотн')) ? 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold shadow-2xs' :
                            interview.status === 'Завершено' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' :
                            interview.status === 'Не прийшов' ? 'bg-purple-50 text-purple-700 border border-purple-200/50' :
                            'bg-rose-50 text-rose-700 border border-rose-200/50'
                          }`}>
                            {(interview.status === 'Зворотний зв\'язок' || (interview.status || '').toLowerCase().includes('зворотн')) ? '📞 Зворотний зв\'язок' : interview.status}
                          </span>
                          
                          {(interview.status === 'Завершено' || interview.status === 'Зворотний зв\'язок' || (interview.status || '').toLowerCase().includes('зворотн')) && interview.result && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${resStyle.color}`}>
                              {resStyle.label}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-bold uppercase tracking-wider">
                          <span className="flex items-center">
                            <Clock className="h-3.5 w-3.5 mr-1 text-slate-400" />
                            {formatDateTime(interview.dateTime)}
                          </span>
                          {candidate?.birthDate && (
                            <span className="flex items-center text-slate-500 font-semibold normal-case">
                              <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" />
                              <span>ДН: {formatDate(candidate.birthDate)}</span>
                              {calculateAge(candidate.birthDate) !== null && (
                                <span className="ml-1 text-slate-400">({calculateAge(candidate.birthDate)} р.)</span>
                              )}
                            </span>
                          )}
                        </div>

                        {candidate?.phone && (
                          <div className="flex items-center text-[11px] text-slate-500 font-medium space-x-2 pt-1 flex-wrap gap-y-1">
                            <span className="flex items-center">
                              <Phone className="h-3.5 w-3.5 mr-1 text-slate-400" />
                              <span className="mr-2 text-slate-700 font-bold tracking-tight select-all">{candidate.phone}</span>
                            </span>
                            <span className="inline-flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(candidate.phone);
                                  setCopiedPhoneId(interview.id);
                                  setTimeout(() => setCopiedPhoneId(null), 2000);
                                }}
                                className="inline-flex items-center justify-center p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
                                title="Скопіювати номер"
                              >
                                {copiedPhoneId === interview.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              </button>
                              <a
                                href={getTelegramLink(candidate.phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center justify-center px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200/50 hover:bg-sky-100 rounded text-[9px] font-bold transition cursor-pointer tracking-wide"
                                title="Написати у Telegram"
                              >
                                TG
                              </a>
                              <a
                                href={getViberLink(candidate.phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center justify-center px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200/50 hover:bg-purple-100 rounded text-[9px] font-bold transition cursor-pointer tracking-wide"
                                title="Написати у Viber"
                              >
                                Viber
                              </a>
                            </span>
                          </div>
                        )}

                        {vacancy && (
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className="flex items-center text-[10px] font-extrabold text-teal-800 bg-teal-50 border border-teal-100/60 px-2.5 py-1 rounded-xl uppercase tracking-wide">
                              <Briefcase className="h-3 w-3 mr-1 text-teal-600 shrink-0" />
                              {vacancy.title}
                            </span>
                            <span className="flex items-center text-[10px] font-extrabold text-slate-600 bg-slate-50 border border-slate-200/50 px-2.5 py-1 rounded-xl uppercase tracking-wide">
                              <MapPin className="h-3 w-3 mr-1 text-slate-400 shrink-0" />
                              {vacancy.department}
                            </span>
                          </div>
                        )}

                        {interview.feedback && (
                          <div className="mt-2 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100/70 text-slate-600">
                            <strong>Результат / Фідбек:</strong> <span className="italic">{interview.feedback}</span>
                          </div>
                        )}

                        {(interview.result === 'Співбесіда з керівником' || interview.managerName || candidate?.status === 'Співбесіда з керівником') && (
                          <div className="mt-2 flex flex-wrap items-center text-xs text-indigo-800 bg-indigo-50/80 border border-indigo-200/80 rounded-xl px-3 py-1.5 font-bold gap-1.5">
                            <span>👔 Етап: Співбесіда з керівником</span>
                            {interview.managerName && <span>(Керівник: <strong>{interview.managerName}</strong>)</span>}
                            {interview.managerInterviewDate && <span>• Дата: <strong>{formatDateTime(interview.managerInterviewDate)}</strong></span>}
                          </div>
                        )}

                        {interview.status === 'Завершено' && (interview.result === 'Відмова компанії' || interview.result === 'Відмова кандидата') && interview.rejectionReason && (
                          <div className="mt-1.5 flex items-center text-[11px] text-rose-700 bg-rose-50/60 border border-rose-100 rounded-lg px-2.5 py-1 w-fit font-bold">
                            <AlertTriangle className="h-3.5 w-3.5 mr-1 text-rose-500 shrink-0" />
                            <span>Причина відмови: {interview.rejectionReason}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-end gap-2 shrink-0 justify-between md:justify-start border-t md:border-0 pt-3 md:pt-0 border-slate-50">
                    {interview.status === 'Завершено' && interview.rating > 0 && (
                      <div className="flex space-x-0.5 mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3.5 w-3.5 ${
                              star <= interview.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    )}

                    {/* CV and Personal File actions identical to CandidatesManager */}
                    {(candidate?.cvFileContent || candidate?.cvLink) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewCv({
                            candidateName: candidate.name,
                            fileName: candidate.cvFileName || (candidate.cvLink ? 'Посилання на резюме' : 'Резюме.pdf'),
                            fileContent: candidate.cvFileContent,
                            cvLink: candidate.cvLink
                          });
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/50 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer"
                      >
                        <Eye className="h-3 w-3 text-teal-600" />
                        <span>Перегляд CV</span>
                      </button>
                    )}
                    {candidate?.cvFileContent && (
                      <a
                        href={candidate.cvFileContent}
                        download={candidate.cvFileName || 'resume.pdf'}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/50 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer"
                      >
                        <FileText className="h-3 w-3 text-emerald-600" />
                        <span>Скачати</span>
                      </a>
                    )}
                    {onViewPersonalFile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewPersonalFile(interview.candidateId);
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-100/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer"
                      >
                        <FileText className="h-3 w-3 text-teal-700" />
                        <span>Особова справа</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(interview);
                      }}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer"
                      title="Редагувати співбесіду"
                    >
                      <Edit2 className="h-3 w-3 text-slate-600" />
                      <span>Редагувати</span>
                    </button>

                    {/* Quick feedback status button & toggle */}
                    {(interview.status === 'Зворотний зв\'язок' || (interview.status || '').toLowerCase().includes('зворотн')) ? (
                      <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setFilter('Зворотний зв\'язок')}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                          title="Перейти у вкладку зворотного зв'язку"
                        >
                          <Phone className="h-3 w-3" />
                          <span>Дати фідбек</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateInterview({ ...interview, status: 'Завершено', feedbackGiven: true })}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                          title="Позначити завершеним"
                        >
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Завершити</span>
                        </button>
                      </div>
                    ) : (interview.status !== 'Скасовано' && interview.status !== 'Не прийшов') ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateInterview({ ...interview, status: 'Зворотний зв\'язок' });
                        }}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition cursor-pointer bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-slate-600 hover:text-amber-900 border border-slate-200 shadow-2xs"
                        title="Встановити статус «Зворотний зв'язок», щоб кандидат з'явився у вкладці дзвінків"
                      >
                        <Phone className="h-3 w-3 text-slate-400 group-hover:text-amber-600" />
                        <span>На зворотний зв'язок</span>
                      </button>
                    ) : null}

                    <div className="inline-flex items-center mt-1">
                      {onDeleteInterview && (
                        <div className="inline-flex items-center">
                          {confirmDeleteId === interview.id ? (
                            <div className="flex items-center bg-rose-50 border border-rose-100 rounded-lg p-0.5 space-x-1 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[9px] font-bold text-rose-700 px-1 uppercase">Дійсно?</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteInterview(interview.id);
                                  setConfirmDeleteId(null);
                                  if (selectedInterview?.id === interview.id) {
                                    setSelectedInterview(null);
                                    setCandidateForModal(null);
                                    setIsModalOpen(false);
                                  }
                                }}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-bold rounded transition cursor-pointer"
                              >
                                Так
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] font-bold rounded transition cursor-pointer"
                              >
                                Ні
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              title="Видалити співбесіду"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(interview.id);
                              }}
                              className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition border border-rose-200/50 cursor-pointer inline-flex items-center space-x-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="text-[10px] font-bold">Видалити</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Toolbar */}
        {filteredInterviews.length > 0 && (
          <div className="bg-white p-3.5 px-4 rounded-2xl border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-600">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Показано:</span>
              <span className="font-bold text-slate-800">
                {pageSize === 'all' 
                  ? filteredInterviews.length 
                  : `${Math.min(filteredInterviews.length, (currentPage - 1) * pageSize + 1)}–${Math.min(filteredInterviews.length, currentPage * pageSize)}`
                }
              </span>
              <span className="text-slate-400">із</span>
              <span className="font-bold text-slate-800">{filteredInterviews.length}</span>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400 text-[11px]">На сторінці:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1 font-bold focus:outline-hidden"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="all">Всі ({filteredInterviews.length})</option>
                </select>
              </div>

              {pageSize !== 'all' && totalPages > 1 && (
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="Попередня сторінка"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 py-1 text-slate-700 font-bold">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="Наступна сторінка"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        </>
      )}
      </div>



      {/* Schedule / Detail Interview Modal */}
      <ScheduleInterviewModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedInterview(null);
          setCandidateForModal(null);
        }}
        selectedInterview={selectedInterview}
        initialCandidate={candidateForModal}
        vacancies={vacancies}
        candidates={candidates}
        interviews={interviews}
        sourcesList={sourcesList}
        interviewStatusesList={interviewStatusesList}
        interviewResultsList={interviewResultsList}
        onAddInterview={onAddInterview}
        onUpdateInterview={onUpdateInterview}
        onDeleteInterview={onDeleteInterview}
        onAddCandidate={onAddCandidate}
        onUpdateCandidate={onUpdateCandidate}
        onAddIntern={onAddIntern}
        onViewPersonalFile={onViewPersonalFile}
        onPreviewCv={setPreviewCv}
      />

      <IframePrintModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} />
      <CvPreviewModal
        isOpen={Boolean(previewCv)}
        onClose={() => setPreviewCv(null)}
        candidateName={previewCv?.candidateName || ''}
        fileName={previewCv?.fileName}
        fileContent={previewCv?.fileContent}
        cvLink={previewCv?.cvLink}
      />

      {/* Removal Modal for "Waiting for Interview" candidates */}
      {candidateToRemove && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    Зняти з черги співбесід
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">{candidateToRemove.cand.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCandidateToRemove(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Оберіть дію для кандидата <strong className="text-slate-800">{candidateToRemove.cand.name}</strong>:
            </p>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (onUpdateCandidate) {
                    onUpdateCandidate({
                      ...candidateToRemove.cand,
                      status: 'Повідомлення'
                    });
                  }
                  if (candidateToRemove.interview && onDeleteInterview) {
                    onDeleteInterview(candidateToRemove.interview.id);
                  }
                  setCandidateToRemove(null);
                }}
                className="w-full p-3 bg-blue-50 hover:bg-blue-100/80 border border-blue-200/80 text-blue-800 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center space-x-2 text-left">
                  <UserCheck className="h-4 w-4 text-blue-600 shrink-0" />
                  <div>
                    <p className="font-extrabold">Зняти з черги (статус «Повідомлення»)</p>
                    <p className="text-[10px] text-blue-600 font-medium">Прибирає з черги співбесід, повертає на етап «Повідомлення» (зв'язалися з кандидатом)</p>
                  </div>
                </div>
                <span className="text-blue-600 group-hover:translate-x-0.5 transition">➔</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onUpdateCandidate) {
                    onUpdateCandidate({
                      ...candidateToRemove.cand,
                      status: 'Відмова компанії',
                      rejectionReason: 'Знято з черги співбесід'
                    });
                  }
                  if (candidateToRemove.interview && onDeleteInterview) {
                    onDeleteInterview(candidateToRemove.interview.id);
                  }
                  setCandidateToRemove(null);
                }}
                className="w-full p-3 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 text-rose-800 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center space-x-2 text-left">
                  <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <div>
                    <p className="font-extrabold">Перевести у статус «Відмова компанії»</p>
                    <p className="text-[10px] text-rose-600 font-medium">Змінює етап кандидата та прибирає з черги</p>
                  </div>
                </div>
                <span className="text-rose-600 group-hover:translate-x-0.5 transition">➔</span>
              </button>

              {candidateToRemove.interview && (
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteInterview && candidateToRemove.interview) {
                      onDeleteInterview(candidateToRemove.interview.id);
                    }
                    setCandidateToRemove(null);
                  }}
                  className="w-full p-3 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 text-amber-800 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center space-x-2 text-left">
                    <Calendar className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <p className="font-extrabold">Скасувати розклад співбесіди</p>
                      <p className="text-[10px] text-amber-700 font-medium">Видаляє лише запланований час у календарі</p>
                    </div>
                  </div>
                  <span className="text-amber-600 group-hover:translate-x-0.5 transition">➔</span>
                </button>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCandidateToRemove(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
