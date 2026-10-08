import React, { useState, useMemo } from 'react';
import { HRSystemData, Candidate, Interview, Intern, Vacancy } from '../types';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import {
  XCircle,
  Users,
  Clock,
  Award,
  Search,
  Filter,
  ArrowRight,
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  FileText,
  Calendar,
  CheckCircle,
  Printer,
  Info
} from 'lucide-react';
import IframePrintModal from './IframePrintModal';

interface RejectionsAnalyticsProps {
  data: HRSystemData;
  onOpenPersonalFile?: (id: string) => void;
}

const COLORS = ['#f43f5e', '#fb7185', '#fda4af', '#fecdd3', '#fda4af', '#e11d48', '#be123c', '#9f1239', '#881337'];
const THEME_COLORS = ['#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#0284c7', '#3b82f6', '#6366f1', '#4f46e5', '#475569'];

export default function RejectionsAnalytics({ data, onOpenPersonalFile }: RejectionsAnalyticsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'candidates' | 'interviews' | 'interns'>('candidates');
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState('Всі');
  const [vacancyFilter, setVacancyFilter] = useState('Всі');
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  const handlePrint = () => {
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) {
      setShowPrintModal(true);
    } else {
      window.print();
    }
  };

  // Find vacancy name helper
  const getVacancyTitle = (vacancyId: string): string => {
    const vacancy = data.vacancies.find(v => v.id === vacancyId);
    return vacancy ? vacancy.title : 'Невідома вакансія';
  };

  // 1. Rejected Candidates
  const rejectedCandidates = useMemo(() => {
    return data.candidates.filter(c => c.status === 'Відмова компанії' || c.status === 'Відмова кандидата' || c.status === 'Відхилено');
  }, [data.candidates]);

  // 2. Rejected Interviews (result is rejection or candidate didn't show up or was cancelled)
  const rejectedInterviews = useMemo(() => {
    return data.interviews.filter(i => 
      i.result === 'Відмова компанії' || 
      i.result === 'Відмова кандидата' || 
      i.result === 'Співбесіда не відбулася' ||
      i.status === 'Не прийшов' ||
      i.status === 'Скасовано'
    );
  }, [data.interviews]);

  // 3. Rejected/Failed Interns (status === 'Не пройшов')
  const failedInterns = useMemo(() => {
    return data.interns.filter(in_ => in_.status === 'Не пройшов');
  }, [data.interns]);

  // Rates and metrics calculations
  const stats = useMemo(() => {
    const totalCandidates = data.candidates.length;
    const totalInterviews = data.interviews.length;
    const totalInterns = data.interns.length;

    const candRejectionRate = totalCandidates > 0 
      ? Math.round((rejectedCandidates.length / totalCandidates) * 100) 
      : 0;

    const interviewRejectionRate = totalInterviews > 0 
      ? Math.round((rejectedInterviews.length / totalInterviews) * 100) 
      : 0;

    const internFailureRate = totalInterns > 0 
      ? Math.round((failedInterns.length / totalInterns) * 100) 
      : 0;

    const grandTotalRejections = rejectedCandidates.length + rejectedInterviews.length + failedInterns.length;

    return {
      candRejectionsCount: rejectedCandidates.length,
      candRejectionRate,
      interviewRejectionsCount: rejectedInterviews.length,
      interviewRejectionRate,
      internFailureCount: failedInterns.length,
      internFailureRate,
      grandTotalRejections,
      totalCandidates,
      totalInterviews,
      totalInterns
    };
  }, [data, rejectedCandidates, rejectedInterviews, failedInterns]);

  // Dynamic distribution of rejections by Vacancy
  const rejectionsByVacancyData = useMemo(() => {
    const counts: Record<string, number> = {};

    // 1. Candidate rejections mapped to vacancies
    rejectedCandidates.forEach(c => {
      const vTitle = getVacancyTitle(c.vacancyId);
      counts[vTitle] = (counts[vTitle] || 0) + 1;
    });

    // 2. Interview rejections mapped to vacancies
    rejectedInterviews.forEach(i => {
      // Find candidate's vacancy ID
      const candidate = data.candidates.find(c => c.id === i.candidateId);
      if (candidate) {
        const vTitle = getVacancyTitle(candidate.vacancyId);
        counts[vTitle] = (counts[vTitle] || 0) + 1;
      } else {
        counts['Інше / Спільна'] = (counts['Інше / Спільна'] || 0) + 1;
      }
    });

    // 3. Failed interns mapped to vacancies/positions
    failedInterns.forEach(in_ => {
      const title = in_.position || 'Не вказана посада';
      counts[title] = (counts[title] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, 'Кількість відмов': value }))
      .sort((a, b) => b['Кількість відмов'] - a['Кількість відмов'])
      .slice(0, 10); // top 10
  }, [data, rejectedCandidates, rejectedInterviews, failedInterns]);

  // Rejection reasons analysis for Candidates
  const candidateReasonsData = useMemo(() => {
    const reasons: Record<string, number> = {};
    rejectedCandidates.forEach(c => {
      const reason = c.rejectionReason || 'Не вказана причина';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    return Object.entries(reasons).map(([name, value]) => ({
      name,
      value,
      percentage: rejectedCandidates.length > 0 ? Math.round((value / rejectedCandidates.length) * 100) : 0
    })).sort((a, b) => b.value - a.value);
  }, [rejectedCandidates]);

  // Rejection reasons analysis for Interviews
  const interviewReasonsData = useMemo(() => {
    const results: Record<string, number> = {};
    rejectedInterviews.forEach(i => {
      const reason = i.status === 'Не прийшов' ? (i.rejectionReason || 'Не прийшов на співбесіду') : (i.rejectionReason || i.result || 'Не вказана причина');
      results[reason] = (results[reason] || 0) + 1;
    });
    return Object.entries(results).map(([name, value]) => ({
      name,
      value,
      percentage: rejectedInterviews.length > 0 ? Math.round((value / rejectedInterviews.length) * 100) : 0
    })).sort((a, b) => b.value - a.value);
  }, [rejectedInterviews]);

  // Failure reasons analysis for Interns
  const internReasonsData = useMemo(() => {
    const reasons: Record<string, number> = {};
    failedInterns.forEach(in_ => {
      const reason = in_.rejectionReason || 'Не вказана причина';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    return Object.entries(reasons).map(([name, value]) => ({
      name,
      value,
      percentage: failedInterns.length > 0 ? Math.round((value / failedInterns.length) * 100) : 0
    })).sort((a, b) => b.value - a.value);
  }, [failedInterns]);

  // Unique lists of values for filters in current active subtab
  const reasonsListForFilter = useMemo(() => {
    if (activeSubTab === 'candidates') {
      return Array.from(new Set(rejectedCandidates.map(c => c.rejectionReason || 'Не вказана причина')));
    } else if (activeSubTab === 'interviews') {
      return Array.from(new Set(rejectedInterviews.map(i => i.status === 'Не прийшов' ? (i.rejectionReason || 'Не прийшов на співбесіду') : (i.rejectionReason || i.result || 'Не вказана причина'))));
    } else {
      return Array.from(new Set(failedInterns.map(in_ => in_.rejectionReason || 'Не вказана причина')));
    }
  }, [activeSubTab, rejectedCandidates, rejectedInterviews, failedInterns]);

  const vacanciesListForFilter = useMemo(() => {
    const titles = data.vacancies.map(v => v.title);
    return Array.from(new Set(titles)).sort((a, b) => a.localeCompare(b, 'uk'));
  }, [data.vacancies]);

  // Final filtered datasets for tables
  const filteredCandidatesTable = useMemo(() => {
    return rejectedCandidates.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (c.comment || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesReason = reasonFilter === 'Всі' || (c.rejectionReason || 'Не вказана причина') === reasonFilter;
      const matchesVacancy = vacancyFilter === 'Всі' || getVacancyTitle(c.vacancyId) === vacancyFilter;
      return matchesSearch && matchesReason && matchesVacancy;
    });
  }, [rejectedCandidates, searchQuery, reasonFilter, vacancyFilter]);

  const filteredInterviewsTable = useMemo(() => {
    return rejectedInterviews.filter(i => {
      const matchesSearch = i.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (i.feedback || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (i.interviewer || '').toLowerCase().includes(searchQuery.toLowerCase());
      const reasonKey = i.status === 'Не прийшов' ? (i.rejectionReason || 'Не прийшов на співбесіду') : (i.rejectionReason || i.result || 'Не вказана причина');
      const matchesReason = reasonFilter === 'Всі' || reasonKey === reasonFilter;
      const matchesVacancy = vacancyFilter === 'Всі' || (() => {
        const candidate = data.candidates.find(c => c.id === i.candidateId);
        return candidate ? getVacancyTitle(candidate.vacancyId) === vacancyFilter : false;
      })();
      return matchesSearch && matchesReason && matchesVacancy;
    });
  }, [rejectedInterviews, data.candidates, searchQuery, reasonFilter, vacancyFilter]);

  const filteredInternsTable = useMemo(() => {
    return failedInterns.filter(in_ => {
      const matchesSearch = in_.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (in_.comment || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (in_.rejectionReason || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (in_.mentor || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesVacancy = vacancyFilter === 'Всі' || in_.position === vacancyFilter;
      const matchesReason = reasonFilter === 'Всі' || (in_.rejectionReason || 'Не вказана причина') === reasonFilter;
      return matchesSearch && matchesVacancy && matchesReason;
    });
  }, [failedInterns, searchQuery, reasonFilter, vacancyFilter]);

  return (
    <div className="space-y-6">
      {/* Upper Title Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-extrabold text-slate-800 text-lg flex items-center">
            <XCircle className="h-5 w-5 text-rose-600 mr-2 shrink-0" />
            Деталізована аналітика та аудит відмов
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Комплексний аналіз причин відхилення кандидатів, непройдених співбесід та стажувань.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="no-print flex items-center justify-center space-x-1.5 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs shrink-0"
        >
          <Printer className="h-4 w-4 text-slate-500" />
          <span>Надрукувати аналіз</span>
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Загальний показник */}
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 p-5 rounded-2xl border border-rose-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-rose-800 uppercase tracking-wider">Сумарно відмов у системі</span>
            <div className="p-2 bg-rose-600 text-white rounded-xl">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-rose-950">{stats.grandTotalRejections} випадків</h3>
            <p className="text-[11px] text-rose-800/80 font-bold mt-1">Зі всієї бази залучення</p>
          </div>
        </div>

        {/* Card 2: Кандидати */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Кандидати: Відмови</span>
            <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-800">{stats.candRejectionsCount} осіб</h3>
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mt-1">
              <span>Відсоток відхилення:</span>
              <span className="text-rose-600 font-extrabold text-xs">{stats.candRejectionRate}%</span>
            </div>
          </div>
        </div>

        {/* Card 3: Співбесіди */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Співбесіди: Не пройшли</span>
            <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-800">{stats.interviewRejectionsCount} співбесід</h3>
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mt-1">
              <span>Питома вага відмов:</span>
              <span className="text-rose-600 font-extrabold text-xs">{stats.interviewRejectionRate}%</span>
            </div>
          </div>
        </div>

        {/* Card 4: Стажери */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Стажування: Не завершено</span>
            <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-800">{stats.internFailureCount} стажерів</h3>
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mt-1">
              <span>Рівень вибуття (Churn):</span>
              <span className="text-rose-600 font-extrabold text-xs">{stats.internFailureRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Reasons Distribution (Pie/Bar depending on subtab) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-800 text-sm flex items-center mb-1">
              <TrendingDown className="h-4 w-4 text-rose-500 mr-2" />
              Причини відмов: {activeSubTab === 'candidates' ? 'Кандидати' : activeSubTab === 'interviews' ? 'Співбесіди' : 'Стажери'}
            </h4>
            <p className="text-[11px] text-slate-400 font-medium mb-4">Розподіл найважливіших чинників відхилення</p>

            <div className="h-64 flex flex-col justify-center">
              {activeSubTab === 'candidates' && candidateReasonsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={candidateReasonsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {candidateReasonsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} осіб`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : activeSubTab === 'interviews' && interviewReasonsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={interviewReasonsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {interviewReasonsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={THEME_COLORS[index % THEME_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} співбесід`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : activeSubTab === 'interns' && internReasonsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={internReasonsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {internReasonsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} стажерів`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-xs text-slate-400 py-10">Немає зареєстрованих відмов для відображення діаграми</div>
              )}
            </div>

            {/* Custom Legend */}
            <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-bold text-slate-600">
              {activeSubTab === 'candidates' && candidateReasonsData.map((entry, index) => (
                <div key={entry.name} className="flex items-center space-x-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  <span className="truncate">{entry.name} ({entry.percentage}%)</span>
                </div>
              ))}
              {activeSubTab === 'interviews' && interviewReasonsData.map((entry, index) => (
                <div key={entry.name} className="flex items-center space-x-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: THEME_COLORS[index % THEME_COLORS.length] }}></span>
                  <span className="truncate">{entry.name} ({entry.percentage}%)</span>
                </div>
              ))}
              {activeSubTab === 'interns' && internReasonsData.map((entry, index) => (
                <div key={entry.name} className="flex items-center space-x-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: COLORS[(index + 2) % COLORS.length] }}></span>
                  <span className="truncate">{entry.name} ({entry.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-slate-50 text-[9px] text-slate-400 font-bold uppercase tracking-wider text-center">
            Аналізуйте структуру причин для адаптації умов роботи чи зміни профілю пошуку
          </div>
        </div>

        {/* Chart 2: Top Vacancies by Rejection Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-800 text-sm flex items-center mb-1">
              <AlertTriangle className="h-4 w-4 text-teal-600 mr-2" />
              Вакансії з найбільшою кількістю відмов
            </h4>
            <p className="text-[11px] text-slate-400 font-medium mb-4">Накопичені відхилення за напрямками та вакансіями</p>

            <div className="h-64">
              {rejectionsByVacancyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rejectionsByVacancyData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Bar dataKey="Кількість відмов" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-xs text-slate-400 py-20">Дані про вакансії відсутні</div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-50 text-[9px] text-slate-400 font-bold uppercase tracking-wider text-center">
            Дисбаланс у відмовах може свідчити про нечіткі вимоги до конкретної вакансії
          </div>
        </div>

      </div>

      {/* Structured Detailed Rejections Explorer */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        
        {/* Navigation & Controls header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm">Табличний навігатор та аудит карток відхилення</h4>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Переглядайте коментарі та фіксуйте джерело проблеми</p>
            </div>

            {/* Segmented active tab selection */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 self-start">
              <button
                onClick={() => {
                  setActiveSubTab('candidates');
                  setReasonFilter('Всі');
                  setSearchQuery('');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                  activeSubTab === 'candidates' 
                    ? 'bg-white text-slate-800 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>1. Кандидати ({stats.candRejectionsCount})</span>
              </button>
              <button
                onClick={() => {
                  setActiveSubTab('interviews');
                  setReasonFilter('Всі');
                  setSearchQuery('');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                  activeSubTab === 'interviews' 
                    ? 'bg-white text-slate-800 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>2. Співбесіди ({stats.interviewRejectionsCount})</span>
              </button>
              <button
                onClick={() => {
                  setActiveSubTab('interns');
                  setReasonFilter('Всі');
                  setSearchQuery('');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                  activeSubTab === 'interns' 
                    ? 'bg-white text-slate-800 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Award className="h-3.5 w-3.5" />
                <span>3. Стажери ({stats.internFailureCount})</span>
              </button>
            </div>
          </div>

          {/* Filters shelf */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Пошук за ім'ям або коментарем..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium placeholder-slate-400"
              />
            </div>

            {/* Filter by Reason */}
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">Фільтр причин:</span>
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden text-slate-700 font-bold"
              >
                <option value="Всі">Всі причини</option>
                {reasonsListForFilter.map(reason => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>

            {/* Filter by Vacancy */}
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">Вакансія:</span>
              <select
                value={vacancyFilter}
                onChange={(e) => setVacancyFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden text-slate-700 font-bold"
              >
                <option value="Всі">Всі напрямки</option>
                {vacanciesListForFilter.map(title => (
                  <option key={title} value={title}>{title}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tables Workspaces */}
        <div className="overflow-x-auto">
          {activeSubTab === 'candidates' && (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Дата</th>
                  <th className="py-3 px-5">ПІБ</th>
                  <th className="py-3 px-5">Посада / Вакансія</th>
                  <th className="py-3 px-5">Джерело</th>
                  <th className="py-3 px-5">Причина відмови</th>
                  <th className="py-3 px-5">HR Коментар</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {filteredCandidatesTable.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">Нічого не знайдено за вказаними фільтрами</td>
                  </tr>
                ) : (
                  filteredCandidatesTable.map(candidate => (
                    <tr key={candidate.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-5 text-slate-400 whitespace-nowrap">{candidate.contactDate || candidate.appliedAt}</td>
                      <td className="py-3 px-5 font-bold text-slate-800">
                        <button 
                          onClick={() => onOpenPersonalFile?.(candidate.id)}
                          className="hover:text-teal-600 hover:underline text-left font-bold focus:outline-hidden transition cursor-pointer"
                        >
                          {candidate.name}
                        </button>
                      </td>
                      <td className="py-3 px-5">{getVacancyTitle(candidate.vacancyId)}</td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">{candidate.source}</span>
                          {candidate.sourceDetails && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded px-1.5 py-0.2 font-bold whitespace-nowrap" title={`Уточнення: ${candidate.sourceDetails}`}>
                              📌 {candidate.sourceDetails}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span className="inline-flex items-center text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md font-bold text-[10px]">
                          {candidate.rejectionReason || 'Не вказана причина'}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-slate-500 italic max-w-xs truncate" title={candidate.comment}>
                        {candidate.comment || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeSubTab === 'interviews' && (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Дата і час</th>
                  <th className="py-3 px-5">ПІБ кандидата</th>
                  <th className="py-3 px-5">Інтерв'юер</th>
                  <th className="py-3 px-5">Тип відмови</th>
                  <th className="py-3 px-5">Причина відмови</th>
                  <th className="py-3 px-5">Фідбек / Нотатки співбесіди</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {filteredInterviewsTable.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">Нічого не знайдено за вказаними фільтрами</td>
                  </tr>
                ) : (
                  filteredInterviewsTable.map(interview => (
                    <tr key={interview.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-5 text-slate-400 whitespace-nowrap">{interview.dateTime.replace('T', ' ')}</td>
                      <td className="py-3 px-5 font-bold text-slate-800">
                        <button 
                          onClick={() => onOpenPersonalFile?.(interview.candidateId)}
                          className="hover:text-teal-600 hover:underline text-left font-bold focus:outline-hidden transition cursor-pointer"
                        >
                          {interview.candidateName}
                        </button>
                      </td>
                      <td className="py-3 px-5 font-semibold text-slate-600">{interview.interviewer || '—'}</td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md font-bold text-[10px] ${
                          interview.status === 'Не прийшов'
                            ? 'bg-red-50 text-red-700 border border-red-150'
                            : interview.result === 'Відмова компанії' 
                            ? 'bg-rose-50 text-rose-700 border border-rose-100'
                            : interview.result === 'Відмова кандидата'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {interview.status === 'Не прийшов' ? 'Не прийшов' : interview.result}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className="inline-flex items-center text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md font-bold text-[10px]">
                          {interview.status === 'Не прийшов' ? (interview.rejectionReason || 'Не прийшов на співбесіду') : (interview.rejectionReason || 'Не вказана причина')}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-slate-500 italic max-w-sm truncate" title={interview.feedback}>
                        {interview.feedback || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeSubTab === 'interns' && (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Період стажування</th>
                  <th className="py-3 px-5">ПІБ стажера</th>
                  <th className="py-3 px-5">Посада / Департамент</th>
                  <th className="py-3 px-5">Ментор</th>
                  <th className="py-3 px-5">Причина вибуття</th>
                  <th className="py-3 px-5">HR Примітки про вибуття</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {filteredInternsTable.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">Нічого не знайдено за вказаними фільтрами</td>
                  </tr>
                ) : (
                  filteredInternsTable.map(intern => (
                    <tr key={intern.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-5 text-slate-400 whitespace-nowrap">{intern.startDate} — {intern.endDate}</td>
                      <td className="py-3 px-5 font-bold text-slate-800">
                        {intern.candidateId ? (
                          <button 
                             onClick={() => onOpenPersonalFile?.(intern.candidateId)}
                            className="hover:text-teal-600 hover:underline text-left font-bold focus:outline-hidden transition cursor-pointer"
                          >
                            {intern.candidateName}
                          </button>
                        ) : (
                          <span>{intern.candidateName}</span>
                        )}
                      </td>
                      <td className="py-3 px-5">{intern.position} <span className="text-slate-400 font-semibold text-[11px] block">{intern.department}</span></td>
                      <td className="py-3 px-5 text-slate-600">{intern.mentor || '—'}</td>
                      <td className="py-3 px-5">
                        <span className="inline-flex items-center text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md font-bold text-[10px]">
                          {intern.rejectionReason || 'Не вказана причина'}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-slate-500 italic max-w-sm truncate" title={intern.comment}>
                        {intern.comment || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info box */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center space-x-2 text-[11px] text-slate-500 font-semibold">
          <Info className="h-4 w-4 text-slate-400 shrink-0" />
          <span>Для коригування інформації або повернення кандидата в активну стадію скористайтеся відповідною карткою у головних реєстрах.</span>
        </div>

      </div>

      {showPrintModal && (
        <IframePrintModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} />
      )}
    </div>
  );
}
