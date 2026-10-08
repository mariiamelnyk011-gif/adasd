import React, { useState, useMemo } from 'react';
import { Vacancy, VacancyStatus, VacancyPriority, Candidate, Interview, Intern } from '../types';
import { formatDate } from '../lib/dateUtils';
import { DEFAULT_POSITIONS, DEFAULT_DEPARTMENTS } from '../lib/seedData';
import IframePrintModal from './IframePrintModal';
import VacancyFunnelModal from './VacancyFunnelModal';
import AllVacanciesFunnelView from './AllVacanciesFunnelView';
import { 
  Briefcase, 
  Plus, 
  Calendar, 
  Coins, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  Clock, 
  Sparkles, 
  AlertCircle,
  Trash2,
  Printer,
  Search,
  X,
  Flame,
  Zap,
  ArrowUpDown,
  Filter,
  Check,
  TrendingUp,
  Users,
  Layers
} from 'lucide-react';

interface VacanciesManagerProps {
  vacancies: Vacancy[];
  positions?: string[];
  departments?: string[];
  candidates?: Candidate[];
  interviews?: Interview[];
  interns?: Intern[];
  onAddVacancy: (vacancy: Omit<Vacancy, 'id' | 'createdAt'> & { createdAt?: string }) => void;
  onUpdateVacancy: (vacancy: Vacancy) => void;
  onDeleteVacancy?: (vacancyId: string) => void;
  onViewPersonalFile?: (candidateId: string) => void;
}

export const PRIORITY_CONFIG: Record<string, {
  label: string;
  badgeClass: string;
  badgeSolidClass: string;
  bgCard: string;
  borderAccent: string;
  icon: string;
  score: number;
  description: string;
}> = {
  'Гаряча': {
    label: 'Гаряча',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    badgeSolidClass: 'bg-rose-600 text-white',
    bgCard: 'border-l-4 border-l-rose-500 bg-rose-50/15',
    borderAccent: 'border-rose-500',
    icon: '🔥',
    score: 3,
    description: 'Терміново закрити! Гаряча потреба'
  },
  'Термінова': {
    label: 'Гаряча',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    badgeSolidClass: 'bg-rose-600 text-white',
    bgCard: 'border-l-4 border-l-rose-500 bg-rose-50/15',
    borderAccent: 'border-rose-500',
    icon: '🔥',
    score: 3,
    description: 'Терміново закрити! Гаряча потреба'
  },
  'Звичайна': {
    label: 'Звичайна',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
    badgeSolidClass: 'bg-teal-600 text-white',
    bgCard: 'border-l-4 border-l-teal-500/50',
    borderAccent: 'border-teal-500',
    icon: '🟢',
    score: 2,
    description: 'Плановий стандартний підбір'
  },
  'Холодна': {
    label: 'Холодна',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    badgeSolidClass: 'bg-sky-600 text-white',
    bgCard: 'border-l-4 border-l-sky-400 bg-sky-50/15',
    borderAccent: 'border-sky-400',
    icon: '❄️',
    score: 1,
    description: 'Формування резерву, не термінова'
  }
};

export const getNormalizedPriority = (p?: string): 'Гаряча' | 'Звичайна' | 'Холодна' => {
  if (p === 'Гаряча' || p === 'Термінова' || p === 'Критична' || p === 'Висока') return 'Гаряча';
  if (p === 'Холодна' || p === 'Низька' || p === 'Резерв') return 'Холодна';
  return 'Звичайна';
};

type SortOption = 'priority-desc' | 'date-desc' | 'date-asc' | 'title-asc' | 'department-asc';

export default function VacanciesManager({ 
  vacancies, 
  positions, 
  departments, 
  candidates = [],
  interviews = [],
  interns = [],
  onAddVacancy, 
  onUpdateVacancy, 
  onDeleteVacancy,
  onViewPersonalFile
}: VacanciesManagerProps) {
  const [activeView, setActiveView] = useState<'cards' | 'funnels'>('cards');
  const [selectedFunnelVacancy, setSelectedFunnelVacancy] = useState<Vacancy | null>(null);
  const [isFunnelModalOpen, setIsFunnelModalOpen] = useState(false);

  const [filter, setFilter] = useState<'Всі' | 'Активна' | 'Закрита'>('Всі');
  const [priorityFilter, setPriorityFilter] = useState<'Всі' | 'Гаряча' | 'Звичайна' | 'Холодна'>('Всі');
  const [sortBy, setSortBy] = useState<SortOption>('priority-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quickPriorityMenuId, setQuickPriorityMenuId] = useState<string | null>(null);

  // Compute funnels for each vacancy
  const funnelsByVacancyId = useMemo(() => {
    const map: Record<string, {
      totalApplications: number;
      totalContacted: number;
      interviewsCount: number;
      internsCount: number;
      hiredCount: number;
      conversion: number;
    }> = {};

    const safeVacancies = (vacancies || []).filter((v): v is Vacancy => Boolean(v && v.id));
    const safeCandidates = (candidates || []).filter((c): c is Candidate => Boolean(c && c.id));
    const safeInterviews = (interviews || []).filter((i): i is Interview => Boolean(i && i.id));
    const safeInterns = (interns || []).filter((it): it is Intern => Boolean(it && it.id));

    safeVacancies.forEach(v => {
      const vTitle = (v.title || '').toLowerCase();
      const vCands = safeCandidates.filter(c => c.vacancyId === v.id);
      const candIds = new Set(vCands.map(c => c.id));
      const vInterviews = safeInterviews.filter(i => candIds.has(i.candidateId));
      const vInterns = safeInterns.filter(intern => {
        // Exclude reserve
        const cand = safeCandidates.find(c => c.id === intern.candidateId || (c.name && intern.candidateName && c.name.trim().toLowerCase() === intern.candidateName.trim().toLowerCase()));
        if (cand && cand.status === 'Резерв') return false;
        const hasReserveInterview = safeInterviews.some(inv => 
          (inv.candidateId === intern.candidateId || (inv.candidateName && intern.candidateName && inv.candidateName.trim().toLowerCase() === intern.candidateName.trim().toLowerCase())) &&
          (inv.result === 'Резерв' || inv.result?.toLowerCase().includes('резерв'))
        );
        if (hasReserveInterview) return false;

        if (intern.candidateId) {
          return candIds.has(intern.candidateId);
        }
        return Boolean(intern.position && vTitle && intern.position.toLowerCase() === vTitle);
      });

      const totalApplications = vCands.length;
      const totalContacted = vCands.filter(c => c.status !== 'Новий').length;
      const interviewsCount = vInterviews.filter(i => i.status === 'Завершено').length;
      const internsCount = vInterns.length;
      const hiredCount = vInterns.filter(i => i.status === 'Успішно завершено').length;
      const conversion = totalApplications > 0 ? Math.round((hiredCount / totalApplications) * 100) : 0;

      map[v.id] = {
        totalApplications,
        totalContacted,
        interviewsCount,
        internsCount,
        hiredCount,
        conversion
      };
    });

    return map;
  }, [vacancies, candidates, interviews, interns]);

  const handlePrint = () => {
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) {
      setShowPrintModal(true);
    } else {
      window.print();
    }
  };

  // Form states
  const [title, setTitle] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [isCustomTitle, setIsCustomTitle] = useState(false);

  const [department, setDepartment] = useState('');
  const [customDepartment, setCustomDepartment] = useState('');
  const [isCustomDepartment, setIsCustomDepartment] = useState(false);

  const [salary, setSalary] = useState('');
  const [schedule, setSchedule] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [requirements, setRequirements] = useState('');
  const [duties, setDuties] = useState('');
  const [isAlwaysOpen, setIsAlwaysOpen] = useState(false);
  const [priority, setPriority] = useState<VacancyPriority>('Звичайна');
  const [status, setStatus] = useState<VacancyStatus>('Активна');
  const [openPositions, setOpenPositions] = useState<number>(1);
  const [formError, setFormError] = useState<string | null>(null);

  // Dynamic alphabetized positions lists
  const availablePositions = useMemo(() => {
    const fromSeed = positions || DEFAULT_POSITIONS;
    const fromVacancies = (vacancies || []).map(v => v?.title).filter(Boolean);
    const unique = Array.from(new Set([...fromSeed, ...fromVacancies])).filter(Boolean);
    return unique.sort((a, b) => a.localeCompare(b, 'uk'));
  }, [vacancies, positions]);

  // Dynamic alphabetized departments lists
  const availableDepartments = useMemo(() => {
    const fromSeed = departments || DEFAULT_DEPARTMENTS;
    const fromVacancies = (vacancies || []).map(v => v?.department).filter(Boolean);
    const unique = Array.from(new Set([...fromSeed, ...fromVacancies])).filter(Boolean);
    return unique.sort((a, b) => a.localeCompare(b, 'uk'));
  }, [vacancies, departments]);

  // Urgency counters (for active vacancies)
  const priorityStats = useMemo(() => {
    const active = (vacancies || []).filter(v => v && v.status === 'Активна');
    return {
      totalActive: active.length,
      hot: active.filter(v => getNormalizedPriority(v.priority) === 'Гаряча').length,
      normal: active.filter(v => getNormalizedPriority(v.priority) === 'Звичайна').length,
      cold: active.filter(v => getNormalizedPriority(v.priority) === 'Холодна').length,
    };
  }, [vacancies]);

  const filteredAndSortedVacancies = useMemo(() => {
    const safeList = (vacancies || []).filter((v): v is Vacancy => Boolean(v && v.id));
    const filtered = safeList.filter(v => {
      const matchesStatus = filter === 'Всі' || v.status === filter;
      const vPriority = getNormalizedPriority(v.priority);
      const matchesPriority = priorityFilter === 'Всі' || vPriority === priorityFilter;
      const matchesSearch = !searchQuery || 
        (v.title && v.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.department && v.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.requirements && v.requirements.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.duties && v.duties.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.schedule && v.schedule.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesPriority && matchesSearch;
    });

    return filtered.sort((a, b) => {
      // Always place Active vacancies at the top and Closed vacancies at the end
      if (a.status !== b.status) {
        return a.status === 'Активна' ? -1 : 1;
      }

      // 1. Sort by urgency/priority
      if (sortBy === 'priority-desc') {
        const scoreA = PRIORITY_CONFIG[getNormalizedPriority(a.priority)]?.score || 1;
        const scoreB = PRIORITY_CONFIG[getNormalizedPriority(b.priority)]?.score || 1;
        if (scoreA !== scoreB) {
          return scoreB - scoreA; // Urgent first
        }
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }

      if (sortBy === 'date-desc') {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }

      if (sortBy === 'date-asc') {
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      }

      if (sortBy === 'title-asc') {
        return (a.title || '').localeCompare(b.title || '', 'uk');
      }

      if (sortBy === 'department-asc') {
        return (a.department || '').localeCompare(b.department || '', 'uk');
      }

      return 0;
    });
  }, [vacancies, filter, priorityFilter, sortBy, searchQuery]);

  const resetForm = () => {
    setSelectedVacancy(null);
    setTitle('');
    setCustomTitle('');
    setIsCustomTitle(false);
    setDepartment('');
    setCustomDepartment('');
    setIsCustomDepartment(false);
    setSalary('');
    setSchedule('');
    setCreatedAt(new Date().toISOString().split('T')[0]);
    setCloseDate('');
    setRequirements('');
    setDuties('');
    setIsAlwaysOpen(false);
    setPriority('Звичайна');
    setStatus('Активна');
    setOpenPositions(1);
    setFormError(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleAddNewVacancy = () => {
    handleOpenAdd();
  };

  const handleOpenEdit = (vacancy: Vacancy) => {
    setFormError(null);
    setSelectedVacancy(vacancy);
    
    if (availablePositions.includes(vacancy.title)) {
      setTitle(vacancy.title);
      setIsCustomTitle(false);
    } else {
      setTitle('__custom__');
      setCustomTitle(vacancy.title);
      setIsCustomTitle(true);
    }

    if (availableDepartments.includes(vacancy.department)) {
      setDepartment(vacancy.department);
      setIsCustomDepartment(false);
    } else {
      setDepartment('__custom__');
      setCustomDepartment(vacancy.department);
      setIsCustomDepartment(true);
    }

    setSalary(vacancy.salary || '');
    setSchedule(vacancy.schedule || '');
    setCreatedAt(vacancy.createdAt || '');
    setCloseDate(vacancy.closeDate || '');
    setRequirements(vacancy.requirements || '');
    setDuties(vacancy.duties || '');
    setIsAlwaysOpen(vacancy.isAlwaysOpen || false);
    setPriority(vacancy.priority || 'Звичайна');
    setStatus(vacancy.status);
    setOpenPositions(vacancy.openPositions && vacancy.openPositions > 0 ? vacancy.openPositions : 1);
    setIsModalOpen(true);
  };

  const handleQuickPriorityChange = (e: React.MouseEvent, vacancy: Vacancy, newPriority: VacancyPriority) => {
    e.stopPropagation();
    onUpdateVacancy({
      ...vacancy,
      priority: newPriority
    });
    setQuickPriorityMenuId(null);
  };

  const handlePositionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (val === '__custom__') {
      setIsCustomTitle(true);
    } else {
      setIsCustomTitle(false);
    }
  };

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setDepartment(val);
    if (val === '__custom__') {
      setIsCustomDepartment(true);
    } else {
      setIsCustomDepartment(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalTitle = isCustomTitle ? customTitle.trim() : title;
    const finalDepartment = isCustomDepartment ? customDepartment.trim() : department;

    if (!finalTitle || finalTitle === '__custom__') {
      setFormError('Будь ласка, введіть або виберіть посаду');
      return;
    }
    if (!finalDepartment || finalDepartment === '__custom__') {
      setFormError('Будь ласка, введіть або виберіть підрозділ');
      return;
    }
    setFormError(null);

    const vacancyData = {
      title: finalTitle,
      department: finalDepartment,
      salary: salary.trim(),
      schedule: schedule.trim(),
      requirements: requirements.trim(),
      duties: duties.trim(),
      isAlwaysOpen,
      priority,
      status,
      openPositions: Number(openPositions) > 0 ? Number(openPositions) : 1,
      closeDate: status === 'Закрита' ? (closeDate || new Date().toISOString().split('T')[0]) : undefined
    };

    if (selectedVacancy) {
      onUpdateVacancy({
        ...selectedVacancy,
        ...vacancyData,
        createdAt // Keep original creation date
      });
      resetForm();
    } else {
      onAddVacancy({
        ...vacancyData,
        createdAt: createdAt || new Date().toISOString().split('T')[0]
      });
      resetForm();
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Top View Toggle: Cards vs All Vacancies Funnel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveView('cards')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center space-x-2 ${
              activeView === 'cards'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>📋 Реєстр вакансій ({vacancies.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('funnels')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center space-x-2 ${
              activeView === 'funnels'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>📊 Воронка по кожній вакансії</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-1.5 bg-teal-700 hover:bg-teal-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Нова вакансія</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Друк реєстру"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Друк</span>
          </button>
        </div>
      </div>

      {activeView === 'funnels' ? (
        <AllVacanciesFunnelView
          vacancies={vacancies}
          candidates={candidates}
          interviews={interviews}
          interns={interns}
          onOpenVacancyFunnel={(v) => {
            setSelectedFunnelVacancy(v);
            setIsFunnelModalOpen(true);
          }}
          onEditVacancy={(v) => handleOpenEdit(v)}
        />
      ) : (
        <>
          {/* Urgency Summary Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Управління вакансіями та терміновістю</h3>
                  <p className="text-xs text-slate-500">Всього відкритих позицій: <strong className="text-slate-800">{priorityStats.totalActive}</strong></p>
                </div>
              </div>

              {/* Quick Urgency Badges / Filters */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setPriorityFilter(priorityFilter === 'Гаряча' ? 'Всі' : 'Гаряча')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    priorityFilter === 'Гаряча'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-rose-50 text-rose-700 border-rose-200/80 hover:bg-rose-100'
                  }`}
                  title="Фільтр: Гарячі вакансії"
                >
                  <Flame className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
                  <span>Гарячі: {priorityStats.hot}</span>
                </button>

                <button
                  onClick={() => setPriorityFilter(priorityFilter === 'Звичайна' ? 'Всі' : 'Звичайна')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    priorityFilter === 'Звичайна'
                      ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                      : 'bg-teal-50 text-teal-700 border-teal-200/80 hover:bg-teal-100'
                  }`}
                  title="Фільтр: Звичайні вакансії"
                >
                  <span>🟢 Звичайні: {priorityStats.normal}</span>
                </button>

                <button
                  onClick={() => setPriorityFilter(priorityFilter === 'Холодна' ? 'Всі' : 'Холодна')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    priorityFilter === 'Холодна'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-sky-50 text-sky-700 border-sky-200/80 hover:bg-sky-100'
                  }`}
                  title="Фільтр: Холодні вакансії (резерв/на перспективу)"
                >
                  <span>❄️ Холодні: {priorityStats.cold}</span>
                </button>

                {priorityFilter !== 'Всі' && (
                  <button
                    onClick={() => setPriorityFilter('Всі')}
                    className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Скинути пріоритет ✕
                  </button>
                )}
              </div>
            </div>
          </div>

      {/* Main Panel */}
      <div className="space-y-4">
        {/* Actions header with Search, Sorting, and Filters */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Пошук вакансій за назвою, підрозділом чи вимогами..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition"
              />
            </div>
            
            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="text-xs bg-transparent text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
                  title="Сортування вакансій"
                >
                  <option value="priority-desc">🔥 За терміновістю (найважливіші)</option>
                  <option value="date-desc">📅 За датою (найновіші)</option>
                  <option value="date-asc">📅 За датою (старіші)</option>
                  <option value="title-asc">🔤 За назвою (А-Я)</option>
                  <option value="department-asc">🏢 За підрозділом</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handlePrint}
                className="no-print flex items-center justify-center space-x-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                title="Надрукувати список"
              >
                <Printer className="h-4 w-4 text-slate-500" />
                <span>Друк</span>
              </button>
              <button
                id="add-vacancy-btn"
                onClick={handleAddNewVacancy}
                className="flex items-center justify-center space-x-1.5 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>Нова вакансія</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
            {/* Status Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Статус:</span>
              {(['Всі', 'Активна', 'Закрита'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFilter(opt)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    filter === opt
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {opt} {opt === 'Всі' ? `(${vacancies.length})` : `(${vacancies.filter(v => v.status === opt).length})`}
                </button>
              ))}
            </div>

            {/* Active filters note */}
            <div className="text-xs text-slate-400">
              Відображено: <strong className="text-slate-700">{filteredAndSortedVacancies.length}</strong> з {vacancies.length}
            </div>
          </div>
        </div>

        {/* List of Vacancies */}
        <div className="space-y-3">
          {filteredAndSortedVacancies.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-slate-100 text-center text-slate-400 text-sm space-y-3">
              <p>Нічого не знайдено за вибраними фільтрами</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {(filter !== 'Всі' || priorityFilter !== 'Всі' || searchQuery) && (
                  <button
                    onClick={() => { setFilter('Всі'); setPriorityFilter('Всі'); setSearchQuery(''); }}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700 underline cursor-pointer px-3 py-1.5"
                  >
                    Скинути всі фільтри
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Створити вакансію</span>
                </button>
              </div>
            </div>
          ) : (
            filteredAndSortedVacancies.map((vacancy) => {
              const currentPriority = getNormalizedPriority(vacancy.priority);
              const pConfig = PRIORITY_CONFIG[currentPriority] || PRIORITY_CONFIG['Звичайна'];
              const isUrgent = currentPriority === 'Гаряча' && vacancy.status === 'Активна';

              return (
                <div
                  key={vacancy.id}
                  id={`vacancy-card-${vacancy.id}`}
                  onClick={() => handleOpenEdit(vacancy)}
                  className={`bg-white p-5 rounded-2xl border transition cursor-pointer flex items-center justify-between relative group ${
                    pConfig.bgCard
                  } ${
                    selectedVacancy?.id === vacancy.id
                      ? 'border-teal-600 shadow-xs bg-teal-50/5'
                      : isUrgent
                        ? 'border-rose-200 hover:border-rose-300 shadow-xs'
                        : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-start space-x-4 min-w-0 flex-1">
                    <div className={`p-3 rounded-xl shrink-0 ${
                      vacancy.status === 'Активна' 
                        ? isUrgent
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : vacancy.isAlwaysOpen 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                            : 'bg-teal-50 text-teal-700 border border-teal-100' 
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {isUrgent ? (
                        <Flame className="h-5 w-5 fill-rose-500 text-rose-600" />
                      ) : (
                        <Briefcase className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-slate-800 text-sm sm:text-base truncate leading-tight">
                          {vacancy.title}
                        </h4>

                        {/* Priority / Urgency Badge with Quick Selector Trigger */}
                        <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickPriorityMenuId(quickPriorityMenuId === vacancy.id ? null : vacancy.id);
                            }}
                            className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                              pConfig.badgeClass
                            } hover:opacity-90`}
                            title="Змінити терміновість вакансії в 1 клік"
                          >
                            <span>{pConfig.icon}</span>
                            <span>{pConfig.label}</span>
                            <span className="text-[9px] opacity-60 ml-0.5">▼</span>
                          </button>

                          {/* Quick Priority Dropdown Popup */}
                          {quickPriorityMenuId === vacancy.id && (
                            <div 
                              className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-40 min-w-[190px] space-y-1 animate-fade-in"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                Встановити пріоритет:
                              </div>
                              {(['Гаряча', 'Звичайна', 'Холодна'] as VacancyPriority[]).map((p) => {
                                const itemConfig = PRIORITY_CONFIG[p];
                                const isCurrent = currentPriority === p;
                                return (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={(e) => handleQuickPriorityChange(e, vacancy, p)}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                                      isCurrent 
                                        ? `${itemConfig.badgeSolidClass}` 
                                        : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <span className="flex items-center space-x-1.5">
                                      <span>{itemConfig.icon}</span>
                                      <span>{itemConfig.label}</span>
                                    </span>
                                    {isCurrent && <Check className="h-3.5 w-3.5" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          vacancy.status === 'Активна'
                            ? 'bg-teal-50 text-teal-700 border border-teal-200/50'
                            : 'bg-slate-100 text-slate-500 border border-slate-200/50'
                        }`}>
                          {vacancy.status}
                        </span>

                        {/* Open Positions Count Badge */}
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
                          <Users className="h-2.5 w-2.5 text-teal-600" />
                          <span>{vacancy.openPositions || 1} {((vacancy.openPositions || 1) === 1) ? 'посада' : ((vacancy.openPositions || 1) < 5) ? 'посади' : 'посад'}</span>
                        </span>

                        {vacancy.isAlwaysOpen && vacancy.status === 'Активна' && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            <Sparkles className="h-2.5 w-2.5" />
                            <span>Постійна (на перспективу)</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{vacancy.department}</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-1.5 gap-x-4 text-xs text-slate-500 pt-1">
                        <span className="flex items-center text-[11px] font-medium">
                          <Coins className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" /> <strong className="text-slate-700 mr-1">ЗП:</strong> {vacancy.salary || 'Не вказано'}
                        </span>
                        <span className="flex items-center text-[11px]">
                          <Clock className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" /> <strong className="text-slate-700 mr-1">Графік:</strong> {vacancy.schedule || 'Не вказано'}
                        </span>
                        <span className="flex items-center text-[11px]">
                          <Calendar className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" /> <strong className="text-slate-700 mr-1">Відкрито:</strong> {formatDate(vacancy.createdAt)}
                        </span>
                        {vacancy.status === 'Закрита' && vacancy.closeDate && (
                          <span className="flex items-center text-[11px] text-rose-700 sm:col-span-2">
                            <AlertCircle className="h-3.5 w-3.5 mr-1.5 text-rose-400 shrink-0" /> <strong className="font-bold mr-1">Закрито:</strong> {formatDate(vacancy.closeDate)}
                          </span>
                        )}
                      </div>

                      {/* Mini Funnel Preview for Vacancy */}
                      {funnelsByVacancyId[vacancy.id] && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-1 border-t border-slate-100/80 text-xs">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium bg-slate-50/80 px-2.5 py-1 rounded-xl border border-slate-200/50">
                            <span className="text-slate-500 font-bold">📥 Заявки:</span>
                            <strong className="text-slate-800">{funnelsByVacancyId[vacancy.id].totalApplications}</strong>
                            <span className="text-slate-300">➔</span>
                            <span className="text-sky-600 font-bold">👥 Співбесіди:</span>
                            <strong className="text-sky-800">{funnelsByVacancyId[vacancy.id].interviewsCount}</strong>
                            <span className="text-slate-300">➔</span>
                            <span className="text-indigo-600 font-bold">🎓 Стажери:</span>
                            <strong className="text-indigo-800">{funnelsByVacancyId[vacancy.id].internsCount}</strong>
                            <span className="text-slate-300">➔</span>
                            <span className="text-emerald-700 font-bold">🏆 Найм:</span>
                            <strong className="text-emerald-800">{funnelsByVacancyId[vacancy.id].hiredCount}</strong>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFunnelVacancy(vacancy);
                              setIsFunnelModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-700 hover:text-white text-teal-800 rounded-xl text-xs font-bold transition flex items-center space-x-1 border border-teal-200/60 cursor-pointer shadow-2xs shrink-0"
                            title="Відкрити детальну воронку для цієї вакансії"
                          >
                            <TrendingUp className="h-3 w-3" />
                            <span>Воронка ({funnelsByVacancyId[vacancy.id].conversion}%)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 ml-4">
                    {onDeleteVacancy && (
                      <div className="flex items-center">
                        {confirmDeleteId === vacancy.id ? (
                          <div className="flex items-center bg-rose-50 border border-rose-100 rounded-xl p-1 space-x-1 animate-fade-in">
                            <span className="text-[10px] font-bold text-rose-700 px-1 uppercase">Дійсно?</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteVacancy(vacancy.id);
                                setConfirmDeleteId(null);
                                if (selectedVacancy?.id === vacancy.id) {
                                  setSelectedVacancy(null);
                                  resetForm();
                                }
                              }}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg transition cursor-pointer"
                            >
                              Так
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                            >
                              Ні
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            title="Видалити вакансію"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(vacancy.id);
                            }}
                            className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition border border-transparent hover:border-rose-100 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-400 transition" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      </>
      )}

      {/* Detail / Editor Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print" 
          onClick={() => { setIsModalOpen(false); setSelectedVacancy(null); }}
        >
          <div 
            className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-2xl w-full p-6 relative max-h-[92vh] overflow-y-auto space-y-4 animate-scale-up" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => { setIsModalOpen(false); setSelectedVacancy(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-slate-800 text-lg">
                {selectedVacancy ? 'Редагувати вакансію' : 'Нова вакансія'}
              </h4>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-xl font-bold animate-shake">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Urgency / Priority Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Пріоритет вакансії
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['Гаряча', 'Звичайна', 'Холодна'] as VacancyPriority[]).map((p) => {
                    const cfg = PRIORITY_CONFIG[p];
                    const isSelected = getNormalizedPriority(priority) === p;
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? p === 'Гаряча'
                              ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-500/20 shadow-xs'
                              : p === 'Холодна'
                              ? 'bg-sky-50 border-sky-500 text-sky-900 ring-2 ring-sky-500/20 shadow-xs'
                              : 'bg-teal-50 border-teal-600 text-teal-900 ring-2 ring-teal-600/20 shadow-xs'
                            : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xl">{cfg.icon}</span>
                          {isSelected && <Check className="h-4 w-4 text-current font-bold" />}
                        </div>
                        <div className="mt-2">
                          <div className="font-bold text-sm">{cfg.label}</div>
                          <div className="text-[11px] opacity-80 mt-0.5 leading-tight">{cfg.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Position Select & Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Посада (Вакансія)</label>
                <select
                  value={isCustomTitle ? '__custom__' : title}
                  onChange={handlePositionChange}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition mb-2 font-medium text-slate-700"
                >
                  <option value="">-- Оберіть посаду --</option>
                  {availablePositions.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                  <option value="__custom__">✍️ + Додати власну посаду...</option>
                </select>

                {isCustomTitle && (
                  <input
                    type="text"
                    required
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Введіть назву посади"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition"
                  />
                )}
              </div>

              {/* Department Select & Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Підрозділ</label>
                <select
                  value={isCustomDepartment ? '__custom__' : department}
                  onChange={handleDepartmentChange}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition mb-2 font-medium text-slate-700"
                >
                  <option value="">-- Оберіть підрозділ --</option>
                  {availableDepartments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                  <option value="__custom__">✍️ + Додати власний підрозділ...</option>
                </select>

                {isCustomDepartment && (
                  <input
                    type="text"
                    required
                    value={customDepartment}
                    onChange={(e) => setCustomDepartment(e.target.value)}
                    placeholder="Введіть назву підрозділу"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition"
                  />
                )}
              </div>

              {/* Salary / ЗП, Schedule & Positions count */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Заробітна плата</label>
                  <input
                    type="text"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    placeholder="напр. 22,000 грн"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Графік роботи</label>
                  <input
                    type="text"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="напр. 2/2, 3/3, Пн-Пт"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Кількість посад</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={openPositions}
                    onChange={(e) => setOpenPositions(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition font-bold text-teal-700"
                    placeholder="1"
                  />
                </div>
              </div>

              {/* Dates of open / close */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Дата відкриття</label>
                  <input
                    type="date"
                    required
                    value={createdAt}
                    onChange={(e) => setCreatedAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Дата закриття</label>
                  <input
                    type="date"
                    disabled={status !== 'Закрита'}
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Always open checkbox */}
              <div className="flex items-start space-x-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                <input
                  type="checkbox"
                  id="isAlwaysOpen"
                  checked={isAlwaysOpen}
                  onChange={(e) => setIsAlwaysOpen(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <label htmlFor="isAlwaysOpen" className="text-xs font-medium text-slate-600 leading-normal cursor-pointer">
                  <strong>Постійно відкрита вакансія</strong>
                  <span className="block text-[10px] text-slate-400 mt-0.5">Повний штат, але шукаємо сильних кандидатів на перспективу.</span>
                </label>
              </div>

              {/* Status Select (Active / Closed) */}
              {selectedVacancy && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Статус вакансії</label>
                  <div className="flex gap-2">
                    {(['Активна', 'Закрита'] as const).map((st) => (
                      <button
                        type="button"
                        key={st}
                        onClick={() => {
                          setStatus(st);
                          if (st === 'Закрита' && !closeDate) {
                            setCloseDate(new Date().toISOString().split('T')[0]);
                          }
                        }}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                          status === st
                            ? st === 'Активна'
                              ? 'bg-teal-50 border-teal-300 text-teal-800'
                              : 'bg-rose-50 border-rose-300 text-rose-800'
                            : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        {st === 'Активна' ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        <span>{st}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements / Duties */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Вимоги до кандидата</label>
                <textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="Основні вимоги (досвід, навички, знання)..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition resize-none text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Обов'язки на посаді</label>
                <textarea
                  value={duties}
                  onChange={(e) => setDuties(e.target.value)}
                  placeholder="Ключові робочі завдання..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition resize-none text-slate-600"
                />
              </div>

              <div className="pt-2 flex space-x-3">
                {selectedVacancy && onDeleteVacancy && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Видалити вакансію "${selectedVacancy.title}"?`)) {
                        onDeleteVacancy(selectedVacancy.id);
                        setSelectedVacancy(null);
                        setIsModalOpen(false);
                        resetForm();
                      }
                    }}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition border border-rose-200/50 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  id="save-vacancy-submit"
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs hover:shadow-md"
                >
                  {selectedVacancy ? 'Зберегти зміни' : 'Створити вакансію'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <IframePrintModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} />

      {/* Per-Vacancy Funnel Modal */}
      <VacancyFunnelModal
        isOpen={isFunnelModalOpen}
        onClose={() => {
          setIsFunnelModalOpen(false);
          setSelectedFunnelVacancy(null);
        }}
        vacancy={selectedFunnelVacancy}
        candidates={candidates}
        interviews={interviews}
        interns={interns}
        onViewPersonalFile={onViewPersonalFile}
      />
    </div>
  );
}
