import React, { useState, useMemo } from 'react';
import { Vacancy, Candidate, Interview, Intern } from '../types';
import { PRIORITY_CONFIG, getNormalizedPriority } from './VacanciesManager';
import { formatDate, parseDateComponents } from '../lib/dateUtils';
import { calculateVacancyFunnel } from '../lib/funnelUtils';
import {
  TrendingUp,
  Briefcase,
  Users,
  Calendar,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Filter,
  Search,
  ArrowUpDown,
  Flame,
  ChevronRight,
  Percent,
  Sparkles,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  Zap,
  Target,
  Phone,
  GraduationCap,
  LayoutGrid,
  TableProperties
} from 'lucide-react';

interface AllVacanciesFunnelViewProps {
  vacancies: Vacancy[];
  candidates: Candidate[];
  interviews?: Interview[];
  interns?: Intern[];
  onOpenVacancyFunnel: (vacancy: Vacancy) => void;
  onEditVacancy?: (vacancy: Vacancy) => void;
  onViewPersonalFile?: (id: string) => void;
}

type SortField = 'conversion' | 'applications' | 'contacted' | 'interviews' | 'showup' | 'interns' | 'hired' | 'title' | 'priority' | 'daysOpen';

export default function AllVacanciesFunnelView({
  vacancies,
  candidates,
  interviews = [],
  interns = [],
  onOpenVacancyFunnel,
  onEditVacancy
}: AllVacanciesFunnelViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'Активна' | 'Закрита'>('Активна');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortAsc, setSortAsc] = useState(false);
  const [viewLayout, setViewLayout] = useState<'table' | 'cards'>('table');

  // Compute all departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    (vacancies || []).forEach(v => {
      if (v && v.department) set.add(v.department);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uk'));
  }, [vacancies]);

  // Compute funnels for all vacancies
  const vacancyFunnels = useMemo(() => {
    const safeVacancies = (vacancies || []).filter((v): v is Vacancy => Boolean(v && v.id));
    const safeCandidates = (candidates || []).filter((c): c is Candidate => Boolean(c && c.id));
    const safeInterviews = (interviews || []).filter((i): i is Interview => Boolean(i && i.id));
    const safeInterns = (interns || []).filter((it): it is Intern => Boolean(it && it.id));

    return safeVacancies.map(vacancy => {
      return calculateVacancyFunnel(vacancy, safeCandidates, safeInterviews, safeInterns);
    });
  }, [vacancies, candidates, interviews, interns]);

  // Filtered and Sorted vacancies
  const filteredAndSortedFunnels = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();

    let list = vacancyFunnels.filter(item => {
      if (!item || !item.vacancy) return false;
      const vacTitle = item.vacancy.title || '';
      const vacDept = item.vacancy.department || '';
      const matchStatus = statusFilter === 'all' || item.vacancy.status === statusFilter;
      const matchPriority = priorityFilter === 'all' || item.currentPriority === priorityFilter;
      const matchDept = departmentFilter === 'all' || vacDept === departmentFilter;
      const matchSearch = !qLower || 
        vacTitle.toLowerCase().includes(qLower) ||
        vacDept.toLowerCase().includes(qLower);
      return matchStatus && matchPriority && matchDept && matchSearch;
    });

    list.sort((a, b) => {
      let res = 0;
      if (sortField === 'conversion') {
        res = b.overallConversion - a.overallConversion;
      } else if (sortField === 'applications') {
        res = b.totalApplications - a.totalApplications;
      } else if (sortField === 'contacted') {
        res = b.totalContacted - a.totalContacted;
      } else if (sortField === 'interviews') {
        res = b.completedInterviews - a.completedInterviews;
      } else if (sortField === 'showup') {
        res = b.showUpRate - a.showUpRate;
      } else if (sortField === 'interns') {
        res = b.totalInterns - a.totalInterns;
      } else if (sortField === 'hired') {
        res = b.totalHired - a.totalHired;
      } else if (sortField === 'daysOpen') {
        res = b.daysOpen - a.daysOpen;
      } else if (sortField === 'title') {
        const titleA = a?.vacancy?.title || '';
        const titleB = b?.vacancy?.title || '';
        res = titleA.localeCompare(titleB, 'uk');
      } else if (sortField === 'priority') {
        res = b.priorityScore - a.priorityScore;
      }

      return sortAsc ? -res : res;
    });

    return list;
  }, [vacancyFunnels, statusFilter, priorityFilter, departmentFilter, searchQuery, sortField, sortAsc]);


  // Summary Totals
  const summaryTotals = useMemo(() => {
    let apps = 0;
    let hot = 0;
    let cold = 0;
    let contacted = 0;
    let interviewsTotal = 0;
    let internsTotal = 0;
    let hiredTotal = 0;
    let rejectedTotal = 0;

    filteredAndSortedFunnels.forEach(f => {
      apps += f.totalApplications;
      hot += f.hotApplications;
      cold += f.coldApplications;
      contacted += f.totalContacted;
      interviewsTotal += f.completedInterviews;
      internsTotal += f.totalInterns;
      hiredTotal += f.totalHired;
      rejectedTotal += f.rejectedCount;
    });

    const avgConv = apps > 0 ? Math.round((hiredTotal / apps) * 100) : 0;
    const avgContactConv = apps > 0 ? Math.round((contacted / apps) * 100) : 0;
    const avgInterviewConv = apps > 0 ? Math.round((interviewsTotal / apps) * 100) : 0;

    return {
      apps,
      hot,
      cold,
      contacted,
      interviewsTotal,
      internsTotal,
      hiredTotal,
      rejectedTotal,
      avgConv,
      avgContactConv,
      avgInterviewConv
    };
  }, [filteredAndSortedFunnels]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top summary card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">
                Поглиблена воронка рекрутингу по кожній вакансії
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Повний наскрізний ланцюг: Відгуки ➔ Повідомлення ➔ Співбесіди ➔ Стажування ➔ Фінальний найм
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200/70">
              <button
                onClick={() => setViewLayout('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
                  viewLayout === 'table' ? 'bg-teal-700 text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Табличний вигляд"
              >
                <TableProperties className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Таблиця</span>
              </button>
              <button
                onClick={() => setViewLayout('cards')}
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
                  viewLayout === 'cards' ? 'bg-teal-700 text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Картковий вигляд"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Картки</span>
              </button>
            </div>

            <span className="text-xs bg-teal-50 text-teal-800 font-extrabold px-3 py-1.5 rounded-xl border border-teal-100">
              Наскрізний найм: {summaryTotals.avgConv}%
            </span>
          </div>
        </div>

        {/* Global mini metrics (6 Granular Step KPIs) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">1. Заявки (Вхід)</div>
            <div className="text-lg font-black text-slate-800 mt-0.5">{summaryTotals.apps}</div>
            <div className="text-[10px] text-slate-500 font-semibold">🔥 {summaryTotals.hot} | ❄️ {summaryTotals.cold}</div>
          </div>
          <div className="bg-teal-50/50 p-2.5 rounded-xl border border-teal-100">
            <div className="text-[10px] font-black text-teal-800 uppercase tracking-wider">2. Повідомлення</div>
            <div className="text-lg font-black text-teal-900 mt-0.5">{summaryTotals.contacted}</div>
            <div className="text-[10px] text-teal-700 font-bold">{summaryTotals.avgContactConv}% опрацьовано</div>
          </div>
          <div className="bg-sky-50/50 p-2.5 rounded-xl border border-sky-100">
            <div className="text-[10px] font-black text-sky-800 uppercase tracking-wider">3. Співбесіди</div>
            <div className="text-lg font-black text-sky-900 mt-0.5">{summaryTotals.interviewsTotal}</div>
            <div className="text-[10px] text-sky-700 font-bold">{summaryTotals.avgInterviewConv}% від заявок</div>
          </div>
          <div className="bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
            <div className="text-[10px] font-black text-indigo-800 uppercase tracking-wider">4. Стажування</div>
            <div className="text-lg font-black text-indigo-900 mt-0.5">{summaryTotals.internsTotal}</div>
            <div className="text-[10px] text-indigo-700 font-bold">
              {summaryTotals.interviewsTotal > 0 ? `${Math.round((summaryTotals.internsTotal / summaryTotals.interviewsTotal) * 100)}% успіх` : '0%'}
            </div>
          </div>
          <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
            <div className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">5. Працевлаштовано</div>
            <div className="text-lg font-black text-emerald-900 mt-0.5">{summaryTotals.hiredTotal}</div>
            <div className="text-[10px] text-emerald-700 font-extrabold">{summaryTotals.avgConv}% загальна</div>
          </div>
          <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-100">
            <div className="text-[10px] font-black text-rose-700 uppercase tracking-wider">6. Втрати / Відмови</div>
            <div className="text-lg font-black text-rose-900 mt-0.5">{summaryTotals.rejectedTotal}</div>
            <div className="text-[10px] text-rose-600 font-semibold">за всіма стадіями</div>
          </div>
        </div>

        {/* Filters and search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук вакансії для детального аналізу воронки..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Department Filter */}
            {departments.length > 0 && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:border-teal-600 focus:outline-hidden cursor-pointer"
              >
                <option value="all">🏢 Всі підрозділи ({departments.length})</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-xl border border-slate-200/70">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'all' ? 'bg-teal-700 text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Всі ({vacancies.length})
              </button>
              <button
                onClick={() => setStatusFilter('Активна')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'Активна' ? 'bg-teal-700 text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Активні ({vacancies.filter(v => v.status === 'Активна').length})
              </button>
              <button
                onClick={() => setStatusFilter('Закрита')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'Закрита' ? 'bg-teal-700 text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Закриті ({vacancies.filter(v => v.status === 'Закрита').length})
              </button>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-xl border border-slate-200/70">
              <button
                onClick={() => setPriorityFilter(priorityFilter === 'Гаряча' ? 'all' : 'Гаряча')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  priorityFilter === 'Гаряча' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                🔥 Гарячі
              </button>
              <button
                onClick={() => setPriorityFilter(priorityFilter === 'Звичайна' ? 'all' : 'Звичайна')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  priorityFilter === 'Звичайна' ? 'bg-teal-700 text-white' : 'text-teal-700 hover:bg-teal-50'
                }`}
              >
                🟢 Звичайні
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main comparative Table View */}
      {viewLayout === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider">
                  <th 
                    onClick={() => handleSort('title')}
                    className="py-3 px-3.5 cursor-pointer hover:text-teal-700 transition"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Посада та Підрозділ</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('priority')}
                    className="py-3 px-2 cursor-pointer hover:text-teal-700 transition text-center"
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Пріоритет</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('applications')}
                    className="py-3 px-2.5 cursor-pointer hover:text-teal-700 transition text-center"
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>📥 Заявки</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('contacted')}
                    className="py-3 px-2.5 cursor-pointer hover:text-teal-700 transition text-center"
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>💬 Повідомлення</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('interviews')}
                    className="py-3 px-2.5 cursor-pointer hover:text-teal-700 transition text-center"
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>👥 Співбесіди (Явка)</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('interns')}
                    className="py-3 px-2.5 cursor-pointer hover:text-teal-700 transition text-center"
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>🎓 Стажування</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('hired')}
                    className="py-3 px-2.5 cursor-pointer hover:text-teal-700 transition text-center"
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>🏆 Найнято</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">
                    <span>Діагностика воронки</span>
                  </th>
                  <th 
                    onClick={() => handleSort('conversion')}
                    className="py-3 px-3.5 cursor-pointer hover:text-teal-700 transition text-right"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>📈 Конверсія</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right">Дії</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredAndSortedFunnels.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-slate-400 text-xs font-semibold">
                      Вакансій за вибраними фільтрами не знайдено
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedFunnels.map((item) => {
                    const pConfig = PRIORITY_CONFIG[item.currentPriority] || PRIORITY_CONFIG['Звичайна'];
                    const isUrgent = item.currentPriority === 'Гаряча' && item.vacancy.status === 'Активна';

                    return (
                      <tr 
                        key={item.vacancy.id}
                        onClick={() => onOpenVacancyFunnel(item.vacancy)}
                        className="hover:bg-teal-50/20 transition-colors cursor-pointer group"
                      >
                        {/* Title & Department */}
                        <td className="py-3.5 px-3.5">
                          <div className="flex items-center space-x-2.5">
                            <div className={`p-2 rounded-xl shrink-0 ${
                              isUrgent ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600 group-hover:bg-teal-50 group-hover:text-teal-700'
                            }`}>
                              <Briefcase className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-extrabold text-slate-800 text-xs sm:text-sm group-hover:text-teal-800 flex items-center gap-1.5">
                                <span>{item.vacancy.title}</span>
                                {item.vacancy.isAlwaysOpen && (
                                  <span className="text-[9px] px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded-md font-bold">постійна</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                                {item.vacancy.department} • {item.daysOpen} дн. у роботі
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-2 text-center">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${pConfig.badgeClass}`}>
                            <span>{pConfig.icon}</span>
                            <span>{pConfig.label}</span>
                          </span>
                        </td>

                        {/* Applications */}
                        <td className="py-3.5 px-2.5 text-center">
                          <span className="font-black text-slate-800 text-xs">{item.totalApplications}</span>
                          <div className="text-[10px] text-slate-400 font-medium">
                            🔥 {item.hotApplications} | ❄️ {item.coldApplications}
                          </div>
                        </td>

                        {/* Screening */}
                        <td className="py-3.5 px-2.5 text-center">
                          <span className="font-black text-teal-900 text-xs">{item.totalContacted}</span>
                          <div className="text-[10px] text-teal-700 font-semibold">{item.appToContactConv}% зв'язок</div>
                        </td>

                        {/* Interviews */}
                        <td className="py-3.5 px-2.5 text-center">
                          <span className="font-black text-sky-900 text-xs">{item.completedInterviews}</span>
                          <div className="text-[10px] text-sky-600 font-semibold">явка {item.showUpRate}%</div>
                        </td>

                        {/* Internships */}
                        <td className="py-3.5 px-2.5 text-center">
                          <span className="font-black text-indigo-900 text-xs">{item.totalInterns}</span>
                          {item.completedInterns > 0 && (
                            <div className="text-[10px] text-indigo-600 font-semibold">{item.completedInterns} здали</div>
                          )}
                        </td>

                        {/* Hired */}
                        <td className="py-3.5 px-2.5 text-center">
                          <span className="font-black text-emerald-900 text-xs">{item.totalHired}</span>
                          {item.rejectedCount > 0 && (
                            <div className="text-[10px] text-rose-500 font-medium">{item.rejectedCount} відмов</div>
                          )}
                        </td>

                        {/* Bottlenecks diagnosis chip */}
                        <td className="py-3.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold border ${item.bottleneckClass}`}>
                            {item.bottleneckText}
                          </span>
                        </td>

                        {/* Conversion Rate */}
                        <td className="py-3.5 px-3.5 text-right">
                          <div className="space-y-1 inline-block text-right min-w-[90px]">
                            <div className="font-black text-teal-800 text-xs">
                              {item.overallConversion}%
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  item.overallConversion >= 20 ? 'bg-emerald-600' :
                                  item.overallConversion >= 10 ? 'bg-teal-600' :
                                  item.overallConversion > 0 ? 'bg-sky-500' : 'bg-slate-300'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(item.overallConversion, 5))}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onOpenVacancyFunnel(item.vacancy)}
                            className="px-2.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1 cursor-pointer ml-auto"
                            title="Відкрити 8-етапну поглиблену воронку"
                          >
                            <TrendingUp className="h-3 w-3" />
                            <span>Детально</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedFunnels.map((item) => {
            const pConfig = PRIORITY_CONFIG[item.currentPriority] || PRIORITY_CONFIG['Звичайна'];
            return (
              <div
                key={item.vacancy.id}
                onClick={() => onOpenVacancyFunnel(item.vacancy)}
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md hover:border-teal-200 transition cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-black text-slate-800 text-sm hover:text-teal-700 transition">
                        {item.vacancy.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                        {item.vacancy.department} • {item.daysOpen} дн.
                      </p>
                    </div>
                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${pConfig.badgeClass}`}>
                      <span>{pConfig.icon}</span>
                      <span>{pConfig.label}</span>
                    </span>
                  </div>

                  {/* Diagnosis Chip */}
                  <div className="mt-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${item.bottleneckClass}`}>
                      {item.bottleneckText}
                    </span>
                  </div>

                  {/* 4-Step Pipeline bar inside card */}
                  <div className="grid grid-cols-4 gap-1.5 text-center mt-3 pt-3 border-t border-slate-50">
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <div className="text-[9px] font-black text-slate-400 uppercase">Заявки</div>
                      <div className="text-sm font-black text-slate-800">{item.totalApplications}</div>
                    </div>
                    <div className="bg-sky-50/60 p-2 rounded-xl">
                      <div className="text-[9px] font-black text-sky-800 uppercase">Співбесіди</div>
                      <div className="text-sm font-black text-sky-900">{item.completedInterviews}</div>
                    </div>
                    <div className="bg-indigo-50/60 p-2 rounded-xl">
                      <div className="text-[9px] font-black text-indigo-800 uppercase">Стажери</div>
                      <div className="text-sm font-black text-indigo-900">{item.totalInterns}</div>
                    </div>
                    <div className="bg-emerald-50/80 p-2 rounded-xl">
                      <div className="text-[9px] font-black text-emerald-800 uppercase">Найм</div>
                      <div className="text-sm font-black text-emerald-900">{item.totalHired}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="text-xs">
                    <span className="text-slate-400 font-medium">Конверсія: </span>
                    <strong className="text-teal-800 font-black">{item.overallConversion}%</strong>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenVacancyFunnel(item.vacancy);
                    }}
                    className="px-3 py-1.5 bg-teal-50 hover:bg-teal-700 hover:text-white text-teal-700 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                  >
                    <span>8-етапний розбір</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
