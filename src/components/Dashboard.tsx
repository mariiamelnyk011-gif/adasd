import { useState, useMemo } from 'react';
import { HRSystemData, Vacancy } from '../types';
import { calculateFunnelMetrics, calculateVacancyFunnel, matchCandidateToVacancy } from '../lib/funnelUtils';
import IframePrintModal from './IframePrintModal';
import RejectionsAnalytics from './RejectionsAnalytics';
import VacancyFunnelModal from './VacancyFunnelModal';
import AllVacanciesFunnelView from './AllVacanciesFunnelView';
import { getTodayDateString, parseDateComponents } from '../lib/dateUtils';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar
} from 'recharts';
import {
  Users,
  Clock,
  Briefcase,
  Award,
  Calendar,
  AlertCircle,
  TrendingUp,
  XCircle,
  Search,
  CheckCircle2,
  CalendarDays,
  ArrowUpRight,
  Filter,
  Check,
  Compass,
  Zap,
  Printer,
  PhoneCall,
  Building2,
  Layers,
  UserCheck
} from 'lucide-react';

interface DashboardProps {
  data: HRSystemData;
  onOpenPersonalFile?: (id: string) => void;
}

const COLORS = ['#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#0284c7', '#3b82f6', '#6366f1', '#4f46e5', '#475569'];

export default function Dashboard({ data, onOpenPersonalFile }: DashboardProps) {
  const [period, setPeriod] = useState<string>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(getTodayDateString());
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayDateString());

  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'funnels' | 'departments' | 'rejections'>('overview');
  const [funnelVacancyFilter, setFunnelVacancyFilter] = useState<string>('all');
  const [selectedFunnelVacancy, setSelectedFunnelVacancy] = useState<Vacancy | null>(null);
  const [isFunnelModalOpen, setIsFunnelModalOpen] = useState<boolean>(false);

  const handlePrint = () => {
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) {
      setShowPrintModal(true);
    } else {
      window.print();
    }
  };

  const PERIODS = [
    { id: 'today', label: 'Сьогодні' },
    { id: 'week', label: '7 днів' },
    { id: 'month', label: '30 днів' },
    { id: 'three_months', label: '90 днів' },
    { id: 'year', label: 'Цей рік' },
    { id: 'all', label: 'Весь час' },
    { id: 'custom', label: 'Календар 📅' }
  ];

  // Helper to determine if a date is within the selected period relative to current local date
  const isWithinPeriod = (dateStr: string | undefined, periodId: string): boolean => {
    if (!dateStr) return false;
    if (periodId === 'all') return true;

    const parsed = parseDateComponents(dateStr);
    if (!parsed.isValid) return false;

    const timestamp = parsed.timestamp;

    if (periodId === 'custom') {
      let startOk = true;
      let endOk = true;
      if (customStartDate) {
        const startParsed = parseDateComponents(customStartDate);
        if (startParsed.isValid) {
          const startLimit = new Date(startParsed.year, startParsed.month - 1, startParsed.day, 0, 0, 0).getTime();
          startOk = timestamp >= startLimit;
        }
      }
      if (customEndDate) {
        const endParsed = parseDateComponents(customEndDate);
        if (endParsed.isValid) {
          const endLimit = new Date(endParsed.year, endParsed.month - 1, endParsed.day, 23, 59, 59, 999).getTime();
          endOk = timestamp <= endLimit;
        }
      }
      return startOk && endOk;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    switch (periodId) {
      case 'today':
        return timestamp >= todayStart && timestamp <= todayEnd;
      case 'week': {
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0).getTime();
        return timestamp >= sevenDaysAgo && timestamp <= todayEnd;
      }
      case 'month': {
        const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0).getTime();
        return timestamp >= thirtyDaysAgo && timestamp <= todayEnd;
      }
      case 'three_months': {
        const ninetyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89, 0, 0, 0).getTime();
        return timestamp >= ninetyDaysAgo && timestamp <= todayEnd;
      }
      case 'year': {
        const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0).getTime();
        return timestamp >= startOfYear && timestamp <= todayEnd;
      }
      default:
        return true;
    }
  };

  // 1. Core Metrics Calculations with period filtering
  const metrics = useMemo(() => {
    // 1. Vacancies Metrics
    const totalVacanciesInPeriod = data.vacancies.filter(v => isWithinPeriod(v.createdAt, period));
    const activeVacanciesList = data.vacancies.filter(v => v.status === 'Активна');
    const activeVacancies = activeVacanciesList.length;
    const urgentVacancies = activeVacanciesList.filter(v => v.priority === 'Термінова').length;
    const closedInPeriod = data.vacancies.filter(v => v.status === 'Закрита' && v.closeDate && isWithinPeriod(v.closeDate, period)).length;

    // 2. Candidates Metrics
    const candidatesInPeriod = data.candidates.filter(c => 
      isWithinPeriod(c.appliedAt, period) || isWithinPeriod(c.contactDate, period)
    );
    const totalCandidatesCount = candidatesInPeriod.length;
    const processedCandidatesCount = candidatesInPeriod.filter(c => c.status !== 'Новий').length;

    // 3. Interviews Metrics (Accurate separation: conducted/completed vs scheduled vs cancelled/no-show)
    const interviewsInPeriod = data.interviews.filter(i => isWithinPeriod(i.dateTime, period));
    const totalInterviewsCount = interviewsInPeriod.length;
    const scheduledInterviewsCount = interviewsInPeriod.filter(i => i.status === 'Заплановано').length;
    const completedInterviewsCount = interviewsInPeriod.filter(i => i.status === 'Завершено').length;
    const cancelledInterviewsCount = interviewsInPeriod.filter(i => i.status === 'Скасовано' || i.status === 'Не прийшов').length;
    
    // Successful interviews (among completed ones)
    const successfulInterviewsCount = interviewsInPeriod.filter(i => 
      i.status === 'Завершено' && (
        i.result === 'Співбесіда пройшла успішно' || 
        i.result === 'Перейшов на стажування' || 
        (i.result && i.result.toLowerCase().includes('успіш'))
      )
    ).length;

    // 4. Interns Metrics
    const internsInPeriod = data.interns.filter(in_ => isWithinPeriod(in_.startDate, period));
    const totalInternsCount = internsInPeriod.length;
    const activeInternsCount = internsInPeriod.filter(in_ => in_.status === 'Триває').length;
    
    // 5. Successfully Completed Internships
    const completedInternshipsInPeriod = data.interns.filter(in_ => 
      in_.status === 'Успішно завершено' && isWithinPeriod(in_.endDate, period)
    );
    const completedInternshipsCount = completedInternshipsInPeriod.length;

    // 7. Vacancy Closure Time
    let totalClosureDays = 0;
    let closedWithDatesCount = 0;

    data.vacancies.forEach(v => {
      if (v.status === 'Закрита' && v.createdAt && v.closeDate && isWithinPeriod(v.closeDate, period)) {
        const created = new Date(v.createdAt).getTime();
        const closed = new Date(v.closeDate).getTime();
        if (!isNaN(created) && !isNaN(closed) && closed >= created) {
          const diffDays = Math.max(1, Math.round((closed - created) / (1000 * 60 * 60 * 24)));
          totalClosureDays += diffDays;
          closedWithDatesCount++;
        }
      }
    });

    const averageClosureTime = closedWithDatesCount > 0 ? Math.round(totalClosureDays / closedWithDatesCount) : 0;

    // 8. Conversion Rates Funnel (Standardized via funnelUtils)
    const globalFunnel = calculateFunnelMetrics(candidatesInPeriod, interviewsInPeriod, internsInPeriod);

    return {
      vacanciesOpened: totalVacanciesInPeriod.length,
      vacanciesActive: activeVacancies,
      vacanciesUrgent: urgentVacancies,
      vacanciesClosed: closedInPeriod,
      totalCandidates: totalCandidatesCount,
      processedCandidates: processedCandidatesCount,
      totalInterviews: totalInterviewsCount,
      scheduledInterviews: scheduledInterviewsCount,
      completedInterviews: completedInterviewsCount,
      cancelledInterviews: cancelledInterviewsCount,
      successfulInterviews: successfulInterviewsCount,
      totalInterns: totalInternsCount,
      activeInterns: activeInternsCount,
      completedInternships: completedInternshipsCount,
      averageClosureTime,
      closedWithDatesCount,
      funnelApplications: globalFunnel.totalApplications,
      funnelCompletedInterviews: globalFunnel.completedInterviews,
      funnelInterns: globalFunnel.totalInterns,
      totalHired: globalFunnel.totalHired,
      overallConversion: globalFunnel.overallConversion,
      appToInterviewConv: globalFunnel.appToInterviewConv,
      interviewToInternConv: globalFunnel.interviewToInternConv,
      internToHireConv: globalFunnel.internToHireConv
    };
  }, [data, period, customStartDate, customEndDate]);

  // Dynamic funnel calculation for KPI 8 based on funnelVacancyFilter
  const activeFunnelData = useMemo(() => {
    const candidatesInPeriod = data.candidates.filter(c => 
      isWithinPeriod(c.appliedAt, period) || isWithinPeriod(c.contactDate, period)
    );
    const interviewsInPeriod = data.interviews.filter(i => isWithinPeriod(i.dateTime, period));
    const internsInPeriod = data.interns.filter(in_ => {
      if (isWithinPeriod(in_.startDate, period) || (in_.endDate && isWithinPeriod(in_.endDate, period))) {
        return true;
      }
      return false;
    });

    if (funnelVacancyFilter === 'all') {
      const f = calculateFunnelMetrics(candidatesInPeriod, interviewsInPeriod, internsInPeriod);
      return {
        applications: f.totalApplications,
        contacted: f.contacted,
        appToContactConv: f.appToContactConv,
        completedInterviews: f.completedInterviews,
        scheduledInterviews: f.scheduledInterviews,
        interns: f.totalInterns,
        activeInterns: f.activeInterns,
        hired: f.totalHired,
        overallConversion: f.overallConversion,
        appToInterviewConv: f.appToInterviewConv,
        contactToInterviewConv: f.contactToInterviewConv,
        interviewToInternConv: f.interviewToInternConv,
        internToHireConv: f.internToHireConv,
        applicationsBarWidth: f.applicationsBarWidth,
        contactedBarWidth: f.contactedBarWidth,
        interviewsBarWidth: f.interviewsBarWidth,
        internsBarWidth: f.internsBarWidth,
        hiredBarWidth: f.hiredBarWidth,
        showUpRate: f.showUpRate,
        interviewPassRate: f.interviewPassRate,
        internSuccessRate: f.internSuccessRate,
        bottleneckText: '',
        bottleneckClass: '',
        vacancy: null as Vacancy | null,
      };
    }

    const matchedVac = (data.vacancies || []).find(v => v && v.id === funnelVacancyFilter);
    if (!matchedVac) {
      const f = calculateFunnelMetrics(candidatesInPeriod, interviewsInPeriod, internsInPeriod);
      return {
        applications: f.totalApplications,
        contacted: f.contacted,
        appToContactConv: f.appToContactConv,
        completedInterviews: f.completedInterviews,
        scheduledInterviews: f.scheduledInterviews,
        interns: f.totalInterns,
        activeInterns: f.activeInterns,
        hired: f.totalHired,
        overallConversion: f.overallConversion,
        appToInterviewConv: f.appToInterviewConv,
        contactToInterviewConv: f.contactToInterviewConv,
        interviewToInternConv: f.interviewToInternConv,
        internToHireConv: f.internToHireConv,
        applicationsBarWidth: f.applicationsBarWidth,
        contactedBarWidth: f.contactedBarWidth,
        interviewsBarWidth: f.interviewsBarWidth,
        internsBarWidth: f.internsBarWidth,
        hiredBarWidth: f.hiredBarWidth,
        showUpRate: f.showUpRate,
        interviewPassRate: f.interviewPassRate,
        internSuccessRate: f.internSuccessRate,
        bottleneckText: '',
        bottleneckClass: '',
        vacancy: null as Vacancy | null,
      };
    }

    // For a specific vacancy: use full vacancy pipeline if period has no events for this vacancy,
    // ensuring candidates and active interns are always accurately displayed in the vacancy funnel.
    const candForVacInPeriod = candidatesInPeriod.filter(c => matchCandidateToVacancy(c, matchedVac, data.interns));
    const effectiveCandidates = (candForVacInPeriod.length > 0 && period !== 'all')
      ? candidatesInPeriod
      : data.candidates;
    const effectiveInterviews = (candForVacInPeriod.length > 0 && period !== 'all')
      ? interviewsInPeriod
      : data.interviews;
    const effectiveInterns = (candForVacInPeriod.length > 0 && period !== 'all')
      ? internsInPeriod
      : data.interns;

    const vf = calculateVacancyFunnel(matchedVac, effectiveCandidates, effectiveInterviews, effectiveInterns);
    return {
      applications: vf.totalApplications,
      contacted: vf.contacted,
      appToContactConv: vf.appToContactConv,
      completedInterviews: vf.completedInterviews,
      scheduledInterviews: vf.scheduledInterviews,
      interns: vf.totalInterns,
      activeInterns: vf.activeInterns,
      hired: vf.totalHired,
      overallConversion: vf.overallConversion,
      appToInterviewConv: vf.appToInterviewConv,
      contactToInterviewConv: vf.contactToInterviewConv,
      interviewToInternConv: vf.interviewToInternConv,
      internToHireConv: vf.internToHireConv,
      applicationsBarWidth: vf.applicationsBarWidth,
      contactedBarWidth: vf.contactedBarWidth,
      interviewsBarWidth: vf.interviewsBarWidth,
      internsBarWidth: vf.internsBarWidth,
      hiredBarWidth: vf.hiredBarWidth,
      showUpRate: vf.showUpRate,
      interviewPassRate: vf.interviewPassRate,
      internSuccessRate: vf.internSuccessRate,
      bottleneckText: vf.bottleneckText,
      bottleneckClass: vf.bottleneckClass,
      vacancy: matchedVac,
    };
  }, [data, period, funnelVacancyFilter]);

  // 6. Combined Rejection Reasons (within selected period)
  const rejectionReasonsData = useMemo(() => {
    const reasons: Record<string, number> = {
      "Невідповідність кваліфікації": 0,
      "Рівень оплати праці": 0,
      "Інша пропозиція": 0,
      "Не вийшов на зв'язок / Пропав": 0,
      "Невідповідність умовам / графіку": 0,
      "Не пройшов перевірку (СБ)": 0,
      "Особисті причини": 0,
      "Інше / Не вказано": 0,
    };

    let totalRejections = 0;

    // A. Rejected Candidates
    data.candidates.forEach(c => {
      const isCandidateRejected = c.status === 'Відмова компанії' || c.status === 'Відмова кандидата' || c.status === 'Відхилено';
      if (isCandidateRejected && (isWithinPeriod(c.appliedAt, period) || isWithinPeriod(c.contactDate, period))) {
        totalRejections++;
        if (c.rejectionReason) {
          let reasonKey = c.rejectionReason;
          if (reasonKey === "Невідповідність вимогам (hard skills)") {
            reasonKey = "Невідповідність кваліфікації";
          } else if (reasonKey === "Завищені очікування по ЗП") {
            reasonKey = "Рівень оплати праці";
          } else if (reasonKey === "Не відповідає культурі компанії (soft skills)") {
            reasonKey = "Невідповідність кваліфікації";
          } else if (reasonKey === "Не пройшов співбесіду") {
            reasonKey = "Невідповідність кваліфікації";
          } else if (reasonKey === "Кандидат сам відмовився від вакансії") {
            reasonKey = "Інша пропозиція";
          } else if (reasonKey === "Інше / Не вийшов на зв'язок") {
            reasonKey = "Не вийшов на зв'язок / Пропав";
          }
          reasons[reasonKey] = (reasons[reasonKey] || 0) + 1;
        } else {
          const text = (c.comment || '').toLowerCase();
          if (text.includes('досвід') || text.includes('кваліф') || text.includes('навик') || text.includes('вмін') || text.includes('мову') || text.includes('англій') || text.includes('освіт')) {
            reasons["Невідповідність кваліфікації"]++;
          } else if (text.includes('зарплат') || text.includes('ставка') || text.includes('оплат') || text.includes('грош') || text.includes('бюджет')) {
            reasons["Рівень оплати праці"]++;
          } else if (text.includes('інш') || text.includes('офер') || text.includes('конкурент') || text.includes('запропо')) {
            reasons["Інша пропозиція"]++;
          } else if (text.includes('не вийшов') || text.includes('не відпов') || text.includes('зв\'яз') || text.includes('пропав') || text.includes('телефон') || text.includes('трубку')) {
            reasons["Не вийшов на зв'язок / Пропав"]++;
          } else if (text.includes('графік') || text.includes('умов') || text.includes('далек') || text.includes('доїзд') || text.includes('змін') || text.includes('транспорт')) {
            reasons["Невідповідність умовам / графіку"]++;
          } else if (text.includes('безпек') || text.includes('сб') || text.includes('судим')) {
            reasons["Не пройшов перевірку (СБ)"]++;
          } else if (text.includes('особист') || text.includes('переїзд') || text.includes('здоров')) {
            reasons["Особисті причини"]++;
          } else {
            reasons["Інше / Не вказано"]++;
          }
        }
      }
    });

    // B. Rejected Interview results
    data.interviews.forEach(i => {
      if ((i.status === 'Не прийшов' || (i.status === 'Завершено' && (i.result === 'Відмова компанії' || i.result === 'Відмова кандидата'))) && isWithinPeriod(i.dateTime, period)) {
        totalRejections++;
        const reasonKey = i.status === 'Не прийшов' ? "Не прийшов на співбесіду" : i.rejectionReason;
        if (reasonKey) {
          let mappedReason = reasonKey;
          if (mappedReason === "Невідповідність вимогам (hard skills)") {
            mappedReason = "Невідповідність кваліфікації";
          } else if (mappedReason === "Завищені очікування по ЗП") {
            mappedReason = "Рівень оплати праці";
          } else if (mappedReason === "Не відповідає культурі компанії (soft skills)") {
            mappedReason = "Невідповідність кваліфікації";
          } else if (mappedReason === "Не пройшов співбесіду") {
            mappedReason = "Невідповідність кваліфікації";
          } else if (mappedReason === "Кандидат сам відмовився від вакансії") {
            mappedReason = "Інша пропозиція";
          } else if (mappedReason === "Інше / Не вийшов на зв'язок") {
            mappedReason = "Не вийшов на зв'язок / Пропав";
          } else if (mappedReason === "Не підходить графік" || mappedReason === "Не підходить локація") {
            mappedReason = "Невідповідність умовам / графіку";
          } else if (mappedReason === "Не підходить заробітна плата") {
            mappedReason = "Рівень оплати праці";
          } else if (mappedReason === "Не прийшов на співбесіду") {
            mappedReason = "Не вийшов на зв'язок / Пропав";
          }
          
          if (reasons[mappedReason] !== undefined) {
            reasons[mappedReason]++;
          } else {
            reasons["Інше / Не вказано"]++;
          }
        } else {
          const text = (i.feedback || '').toLowerCase();
          if (text.includes('досвід') || text.includes('кваліф') || text.includes('навик') || text.includes('вмін') || text.includes('мову') || text.includes('англій') || text.includes('освіт')) {
            reasons["Невідповідність кваліфікації"]++;
          } else if (text.includes('зарплат') || text.includes('ставка') || text.includes('оплат') || text.includes('грош') || text.includes('бюджет')) {
            reasons["Рівень оплати праці"]++;
          } else if (text.includes('інш') || text.includes('офер') || text.includes('конкурент') || text.includes('запропо')) {
            reasons["Інша пропозиція"]++;
          } else if (text.includes('не вийшов') || text.includes('не відпов') || text.includes('зв\'яз') || text.includes('пропав') || text.includes('телефон') || text.includes('трубку') || text.includes('не прийшов')) {
            reasons["Не вийшов на зв'язок / Пропав"]++;
          } else if (text.includes('графік') || text.includes('умов') || text.includes('далек') || text.includes('доїзд') || text.includes('змін') || text.includes('транспорт')) {
            reasons["Невідповідність умовам / графіку"]++;
          } else if (text.includes('безпек') || text.includes('сб') || text.includes('судим')) {
            reasons["Не пройшов перевірку (СБ)"]++;
          } else if (text.includes('особист') || text.includes('переїзд') || text.includes('здоров')) {
            reasons["Особисті причини"]++;
          } else {
            reasons["Інше / Не вказано"]++;
          }
        }
      }
    });

    // C. Rejected Interns (Failed)
    data.interns.forEach(in_ => {
      if (in_.status === 'Не пройшов' && isWithinPeriod(in_.endDate, period)) {
        const text = ((in_.comment || '') + ' ' + (in_.project || '')).toLowerCase();
        totalRejections++;
        if (text.includes('досвід') || text.includes('кваліф') || text.includes('навик') || text.includes('вмін') || text.includes('робот')) {
          reasons["Невідповідність кваліфікації"]++;
        } else if (text.includes('зарплат') || text.includes('ставка') || text.includes('оплат') || text.includes('грош') || text.includes('бюджет')) {
          reasons["Рівень оплати праці"]++;
        } else if (text.includes('інш') || text.includes('офер') || text.includes('конкурент') || text.includes('запропо')) {
          reasons["Інша пропозиція"]++;
        } else if (text.includes('не вийшов') || text.includes('не відпов') || text.includes('зв\'яз') || text.includes('пропав') || text.includes('телефон')) {
          reasons["Не вийшов на зв'язок / Пропав"]++;
        } else if (text.includes('графік') || text.includes('умов') || text.includes('далек') || text.includes('доїзд') || text.includes('змін')) {
          reasons["Невідповідність умовам / графіку"]++;
        } else if (text.includes('безпек') || text.includes('сб') || text.includes('судим')) {
          reasons["Не пройшов перевірку (СБ)"]++;
        } else if (text.includes('особист') || text.includes('переїзд') || text.includes('здоров')) {
          reasons["Особисті причини"]++;
        } else {
          reasons["Інше / Не вказано"]++;
        }
      }
    });

    const reasonsList = Object.entries(reasons)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalRejections > 0 ? Math.round((count / totalRejections) * 100) : 0
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);

    return {
      total: totalRejections,
      list: reasonsList
    };
  }, [data, period, customStartDate, customEndDate]);

  // 9. Search Sources (Джерела пошуку) inside period
  const sourceData = useMemo(() => {
    const sourcesMap: Record<string, number> = {};
    const candidatesInPeriod = data.candidates.filter(c => 
      isWithinPeriod(c.appliedAt, period) || isWithinPeriod(c.contactDate, period)
    );

    candidatesInPeriod.forEach(c => {
      const src = c.source || 'Інше';
      sourcesMap[src] = (sourcesMap[src] || 0) + 1;
    });

    const total = candidatesInPeriod.length;

    return Object.entries(sourcesMap)
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? Math.round((value / total) * 100) : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [data.candidates, period, customStartDate, customEndDate]);

  // Dynamic hiring trend calculations
  const trendData = useMemo(() => {
    const now = new Date();

    const getCandidateDate = (c: { appliedAt?: string; contactDate?: string }): string => {
      return (c.appliedAt || c.contactDate || '').trim();
    };

    if (period === 'custom') {
      const startParsed = parseDateComponents(customStartDate);
      const endParsed = parseDateComponents(customEndDate);
      const start = startParsed.isValid 
        ? new Date(startParsed.year, startParsed.month - 1, startParsed.day) 
        : new Date();
      const end = endParsed.isValid 
        ? new Date(endParsed.year, endParsed.month - 1, endParsed.day, 23, 59, 59) 
        : new Date();

      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 31 && diffDays >= 0) {
        // Daily breakdown
        const dailyMap: Record<string, number> = {};
        for (let i = 0; i <= diffDays; i++) {
          const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const key = `${y}-${m}-${day}`;
          dailyMap[key] = 0;
        }
        data.candidates.forEach(c => {
          const candDate = getCandidateDate(c);
          if (candDate && isWithinPeriod(candDate, 'custom')) {
            const parsed = parseDateComponents(candDate);
            if (parsed.isValid && dailyMap[parsed.dateKey] !== undefined) {
              dailyMap[parsed.dateKey]++;
            }
          }
        });
        return Object.entries(dailyMap).map(([key, value]) => {
          const [y, m, d] = key.split('-').map(Number);
          const label = `${d}.${String(m).padStart(2, '0')}`;
          return { label, 'Заявки': value };
        });
      } else {
        // Monthly breakdown
        const monthsMap: Record<string, number> = {};
        const monthsOrder: string[] = [];
        const monthNamesUa = ['Січ', 'Лют', 'Бер', 'Квіт', 'Трав', 'Черв', 'Лип', 'Серп', 'Вер', 'Жовт', 'Лист', 'Груд'];
        
        let curr = new Date(start.getFullYear(), start.getMonth(), 1);
        while (curr <= end) {
          const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;
          monthsMap[key] = 0;
          monthsOrder.push(key);
          curr.setMonth(curr.getMonth() + 1);
        }

        data.candidates.forEach(c => {
          const candDate = getCandidateDate(c);
          if (candDate && isWithinPeriod(candDate, 'custom')) {
            const parsed = parseDateComponents(candDate);
            if (parsed.isValid && monthsMap[parsed.monthKey] !== undefined) {
              monthsMap[parsed.monthKey]++;
            }
          }
        });

        return monthsOrder.map(key => {
          const [year, month] = key.split('-').map(Number);
          const label = `${monthNamesUa[month - 1]} ${year}`;
          return { label, 'Заявки': monthsMap[key] || 0 };
        });
      }
    }
    
    if (period === 'today') {
      const currentHour = now.getHours();
      // Generate working hours between 08:00 and at least 18:00 (or up to 20:00)
      const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
      const hoursMap: Record<string, number> = {};
      hours.forEach(h => { hoursMap[h] = 0; });

      data.candidates.forEach(c => {
        const candDate = getCandidateDate(c);
        if (candDate && isWithinPeriod(candDate, 'today')) {
          const parsed = parseDateComponents(candDate);
          if (parsed.isValid) {
            let h: number;
            if (parsed.hasTime) {
              h = parsed.hours;
            } else {
              // If no time is stored, default to morning / current hour so it is never in the future
              h = Math.min(Math.max(currentHour, 8), 9);
            }
            if (h < 8) h = 8;
            if (h > 20) h = 20;
            const hourKey = `${String(h).padStart(2, '0')}:00`;
            if (hoursMap[hourKey] !== undefined) {
              hoursMap[hourKey]++;
            } else {
              hoursMap['09:00'] = (hoursMap['09:00'] || 0) + 1;
            }
          }
        }
      });

      return Object.entries(hoursMap).map(([label, value]) => ({ label, 'Заявки': value }));
    }

    if (period === 'week') {
      const daysMap: Record<string, number> = {};
      const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${day}`;
        daysMap[key] = 0;
      }
      data.candidates.forEach(c => {
        const candDate = getCandidateDate(c);
        if (candDate && isWithinPeriod(candDate, 'week')) {
          const parsed = parseDateComponents(candDate);
          if (parsed.isValid && daysMap[parsed.dateKey] !== undefined) {
            daysMap[parsed.dateKey]++;
          }
        }
      });
      return Object.entries(daysMap).map(([key, value]) => {
        const [y, m, dayNum] = key.split('-').map(Number);
        const d = new Date(y, m - 1, dayNum);
        const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        const label = isToday 
          ? `Сьогодні (${dayNum}.${String(m).padStart(2, '0')})` 
          : `${dayNames[d.getDay()]} (${dayNum}.${String(m).padStart(2, '0')})`;
        return { label, 'Заявки': value };
      });
    }

    if (period === 'month') {
      const dailyMap: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${day}`;
        dailyMap[key] = 0;
      }
      data.candidates.forEach(c => {
        const candDate = getCandidateDate(c);
        if (candDate && isWithinPeriod(candDate, 'month')) {
          const parsed = parseDateComponents(candDate);
          if (parsed.isValid && dailyMap[parsed.dateKey] !== undefined) {
            dailyMap[parsed.dateKey]++;
          }
        }
      });
      return Object.entries(dailyMap).map(([key, value]) => {
        const [y, m, d] = key.split('-').map(Number);
        const label = `${d}.${String(m).padStart(2, '0')}`;
        return { label, 'Заявки': value };
      });
    }

    if (period === 'three_months') {
      const monthsMap: Record<string, number> = {};
      const monthsOrder: string[] = [];
      const monthNamesUa = ['Січ', 'Лют', 'Бер', 'Квіт', 'Трав', 'Черв', 'Лип', 'Серп', 'Вер', 'Жовт', 'Лист', 'Груд'];
      
      for (let i = 2; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthsMap[key] = 0;
        monthsOrder.push(key);
      }

      data.candidates.forEach(c => {
        const candDate = getCandidateDate(c);
        if (candDate && isWithinPeriod(candDate, 'three_months')) {
          const parsed = parseDateComponents(candDate);
          if (parsed.isValid && monthsMap[parsed.monthKey] !== undefined) {
            monthsMap[parsed.monthKey]++;
          }
        }
      });

      return monthsOrder.map(key => {
        const [year, month] = key.split('-').map(Number);
        const label = `${monthNamesUa[month - 1]} ${year}`;
        return { label, 'Заявки': monthsMap[key] || 0 };
      });
    }

    if (period === 'year') {
      const monthsMap: Record<string, number> = {};
      const monthNamesUa = ['Січ', 'Лют', 'Бер', 'Квіт', 'Трав', 'Черв', 'Лип', 'Серп', 'Вер', 'Жовт', 'Лист', 'Груд'];
      const currentYear = now.getFullYear();

      for (let m = 1; m <= 12; m++) {
        const key = `${currentYear}-${String(m).padStart(2, '0')}`;
        monthsMap[key] = 0;
      }

      data.candidates.forEach(c => {
        const candDate = getCandidateDate(c);
        if (candDate && isWithinPeriod(candDate, 'year')) {
          const parsed = parseDateComponents(candDate);
          if (parsed.isValid && monthsMap[parsed.monthKey] !== undefined) {
            monthsMap[parsed.monthKey]++;
          }
        }
      });

      return Object.entries(monthsMap).map(([key, value]) => {
        const [, month] = key.split('-').map(Number);
        const label = monthNamesUa[month - 1];
        return { label, 'Заявки': value };
      });
    }

    // Default trend for 'all': Last 6 calendar months
    const monthsMap: Record<string, number> = {};
    const monthsOrder: string[] = [];
    const monthNamesUa = ['Січ', 'Лют', 'Бер', 'Квіт', 'Трав', 'Черв', 'Лип', 'Серп', 'Вер', 'Жовт', 'Лист', 'Груд'];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap[key] = 0;
      monthsOrder.push(key);
    }

    data.candidates.forEach(c => {
      const candDate = getCandidateDate(c);
      if (candDate) {
        const parsed = parseDateComponents(candDate);
        if (parsed.isValid && monthsMap[parsed.monthKey] !== undefined) {
          monthsMap[parsed.monthKey]++;
        }
      }
    });

    return monthsOrder.map(key => {
      const [year, month] = key.split('-').map(Number);
      const label = `${monthNamesUa[month - 1]} ${year}`;
      return { label, 'Заявки': monthsMap[key] || 0 };
    });
  }, [data.candidates, period, customStartDate, customEndDate]);

  // 10. Call Types Analytics (Гарячі / Холодні / Повторні)
  const callTypesData = useMemo(() => {
    const map: Record<string, { count: number; hires: number }> = {
      'Гарячий': { count: 0, hires: 0 },
      'Холодний': { count: 0, hires: 0 },
      'Повторний': { count: 0, hires: 0 },
    };

    const candidatesInPeriod = data.candidates.filter(c => 
      isWithinPeriod(c.appliedAt, period) || isWithinPeriod(c.contactDate, period)
    );

    candidatesInPeriod.forEach(c => {
      const type = c.callType || 'Гарячий';
      if (!map[type]) map[type] = { count: 0, hires: 0 };
      map[type].count += 1;
      if (c.status === 'Стажування') {
        map[type].hires += 1;
      }
    });

    const total = candidatesInPeriod.length;

    return Object.entries(map).map(([type, val]) => ({
      type,
      count: val.count,
      percentage: total > 0 ? Math.round((val.count / total) * 100) : 0,
      hires: val.hires,
      conversion: val.count > 0 ? Math.round((val.hires / val.count) * 100) : 0
    }));
  }, [data.candidates, period, customStartDate, customEndDate]);

  // 11. Department Breakdown (Розподіл за відділами)
  const departmentData = useMemo(() => {
    const deptMap: Record<string, { vacancies: number; candidates: number; interns: number; fired: number }> = {};

    data.departmentsList.forEach(dept => {
      deptMap[dept] = { vacancies: 0, candidates: 0, interns: 0, fired: 0 };
    });

    data.vacancies.forEach(v => {
      const dept = v.department || 'Інше';
      if (!deptMap[dept]) deptMap[dept] = { vacancies: 0, candidates: 0, interns: 0, fired: 0 };
      if (v.status === 'Активна') {
        deptMap[dept].vacancies += 1;
      }
    });

    data.candidates.forEach(c => {
      if (isWithinPeriod(c.appliedAt, period) || isWithinPeriod(c.contactDate, period)) {
        const vac = data.vacancies.find(v => v.id === c.vacancyId);
        const dept = vac?.department || 'Інше';
        if (!deptMap[dept]) deptMap[dept] = { vacancies: 0, candidates: 0, interns: 0, fired: 0 };
        deptMap[dept].candidates += 1;
      }
    });

    data.interns.forEach(in_ => {
      if (isWithinPeriod(in_.startDate, period)) {
        const dept = in_.department || 'Інше';
        if (!deptMap[dept]) deptMap[dept] = { vacancies: 0, candidates: 0, interns: 0, fired: 0 };
        deptMap[dept].interns += 1;
      }
    });

    data.firedEmployees.forEach(f => {
      if (isWithinPeriod(f.endDate, period)) {
        const dept = f.department || 'Інше';
        if (!deptMap[dept]) deptMap[dept] = { vacancies: 0, candidates: 0, interns: 0, fired: 0 };
        deptMap[dept].fired += 1;
      }
    });

    return Object.entries(deptMap)
      .map(([department, val]) => ({
        department,
        ...val
      }))
      .filter(item => item.vacancies > 0 || item.candidates > 0 || item.interns > 0 || item.fired > 0);
  }, [data, period, customStartDate, customEndDate]);

  // 12. Interviewer Efficiency
  const interviewerData = useMemo(() => {
    const map: Record<string, { total: number; completed: number; successful: number }> = {};

    data.interviews.forEach(i => {
      if (isWithinPeriod(i.dateTime, period)) {
        const interviewer = i.interviewer || 'Не вказано';
        if (!map[interviewer]) map[interviewer] = { total: 0, completed: 0, successful: 0 };
        map[interviewer].total += 1;
        if (i.status === 'Завершено') {
          map[interviewer].completed += 1;
        }
        if (i.result === 'Співбесіда пройшла успішно' || i.result === 'Перейшов на стажування') {
          map[interviewer].successful += 1;
        }
      }
    });

    return Object.entries(map).map(([interviewer, val]) => ({
      interviewer,
      total: val.total,
      completed: val.completed,
      successful: val.successful,
      successRate: val.completed > 0 ? Math.round((val.successful / val.completed) * 100) : 0
    })).sort((a, b) => b.total - a.total);
  }, [data.interviews, period, customStartDate, customEndDate]);

  // 13. Candidate Stages Breakdown
  const stageData = useMemo(() => {
    const map: Record<string, number> = {};
    const candidatesInPeriod = data.candidates.filter(c => 
      isWithinPeriod(c.appliedAt, period) || isWithinPeriod(c.contactDate, period)
    );

    data.stagesList.forEach(st => {
      map[st] = 0;
    });

    candidatesInPeriod.forEach(c => {
      const st = c.status || 'Новий';
      map[st] = (map[st] || 0) + 1;
    });

    const total = candidatesInPeriod.length;

    return Object.entries(map).map(([stage, count]) => ({
      stage,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }));
  }, [data.candidates, data.stagesList, period, customStartDate, customEndDate]);

  return (
    <div className="space-y-6">
      {/* Upper Command Bar: Title and Period Selectors */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex justify-between items-start w-full md:w-auto">
          <div className="space-y-1">
            <h3 className="font-extrabold text-slate-800 text-lg flex items-center">
              <Zap className="h-5 w-5 text-teal-600 mr-2" />
              Інтерактивна аналітика процесів
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Період аналізу: <strong className="text-teal-700">{PERIODS.find(p => p.id === period)?.label}</strong> (Поточна дата: {new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })})
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="no-print hidden sm:flex items-center space-x-1.5 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Надрукувати аналітику"
            >
              <Printer className="h-4 w-4" />
              <span>Друк</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Selector (Segmented control layout) */}
          <div className="flex flex-wrap gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-100/70">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                  period === p.id
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {period === p.id && <Check className="h-3 w-3 mr-0.5 shrink-0" />}
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handlePrint}
            className="no-print hidden md:flex items-center space-x-1.5 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs shrink-0"
            title="Надрукувати аналітику"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Друк звіту</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {period === 'custom' && (
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs flex flex-wrap items-center gap-4 animate-fade-in text-xs font-bold text-slate-600">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-extrabold uppercase tracking-wide">З дати:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden text-slate-700 font-bold"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-extrabold uppercase tracking-wide">По дату:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden text-slate-700 font-bold"
            />
          </div>
        </div>
      )}

      {/* Tab Selectors inside Dashboard */}
      <div className="flex border-b border-slate-100 mb-2 overflow-x-auto">
        <button
          onClick={() => setDashboardTab('overview')}
          className={`px-5 py-3 text-xs sm:text-sm font-extrabold border-b-2 transition-all shrink-0 cursor-pointer ${
            dashboardTab === 'overview'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Загальний огляд KPI
        </button>
        <button
          onClick={() => setDashboardTab('funnels')}
          className={`px-5 py-3 text-xs sm:text-sm font-extrabold border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
            dashboardTab === 'funnels'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <TrendingUp className="h-4 w-4 text-teal-600" />
          <span>Воронка по кожній вакансії</span>
        </button>
        <button
          onClick={() => setDashboardTab('departments')}
          className={`px-5 py-3 text-xs sm:text-sm font-extrabold border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
            dashboardTab === 'departments'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Building2 className="h-4 w-4 text-teal-600" />
          <span>Відділи, Етапи та Інтерв'юери</span>
        </button>
        <button
          onClick={() => setDashboardTab('rejections')}
          className={`px-5 py-3 text-xs sm:text-sm font-extrabold border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
            dashboardTab === 'rejections'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <XCircle className="h-4 w-4 text-rose-500" />
          <span>Детальна аналітика відмов</span>
        </button>
      </div>

      {dashboardTab === 'funnels' ? (
        <AllVacanciesFunnelView
          vacancies={data.vacancies}
          candidates={data.candidates}
          interviews={data.interviews}
          interns={data.interns}
          onOpenVacancyFunnel={(vac) => {
            setSelectedFunnelVacancy(vac);
            setIsFunnelModalOpen(true);
          }}
          onViewPersonalFile={onOpenPersonalFile}
        />
      ) : dashboardTab === 'rejections' ? (
        <RejectionsAnalytics data={data} onOpenPersonalFile={onOpenPersonalFile} />
      ) : dashboardTab === 'departments' ? (
        <div className="space-y-6 animate-fade-in">
          {/* Department Breakdown Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h4 className="font-bold text-slate-800 text-sm flex items-center">
                <Building2 className="h-4.5 w-4.5 mr-2 text-teal-700" />
                <span>Розподіл кандидатів та стажерів за відділами</span>
              </h4>
              <span className="text-xs text-slate-400 font-semibold">
                Загалом відділів: {departmentData.length}
              </span>
            </div>

            {departmentData.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">Немає даних за відділами за обраний період</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase font-extrabold border-b border-slate-100">
                      <th className="py-2.5 px-3 rounded-l-xl">Відділ</th>
                      <th className="py-2.5 px-3 text-center">Активні вакансії</th>
                      <th className="py-2.5 px-3 text-center">Кандидати</th>
                      <th className="py-2.5 px-3 text-center">Стажери</th>
                      <th className="py-2.5 px-3 text-center rounded-r-xl">Звільнені</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {departmentData.map((d) => (
                      <tr key={d.department} className="hover:bg-slate-50/80 transition font-medium text-slate-700">
                        <td className="py-3 px-3 font-bold text-slate-800 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                          <span>{d.department}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded-md">
                            {d.vacancies}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-800">
                          {d.candidates}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md">
                            {d.interns}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center text-rose-600 font-bold">
                          {d.fired}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Candidates Stage Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h4 className="font-bold text-slate-800 text-sm flex items-center">
                  <Layers className="h-4.5 w-4.5 mr-2 text-sky-600" />
                  <span>Розподіл кандидатів за воронкою етапів</span>
                </h4>
              </div>
              <div className="space-y-3">
                {stageData.map((st) => (
                  <div key={st.stage} className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                      <span className="font-bold">{st.stage}</span>
                      <span className="text-slate-500">{st.count} осіб ({st.percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-sky-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${st.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interviewer Performance Table */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h4 className="font-bold text-slate-800 text-sm flex items-center">
                  <UserCheck className="h-4.5 w-4.5 mr-2 text-indigo-600" />
                  <span>Результативність інтерв'юерів</span>
                </h4>
              </div>

              {interviewerData.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">Співбесіди відсутні за період</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase font-extrabold border-b border-slate-100">
                        <th className="py-2.5 px-3 rounded-l-xl">Інтерв'юер</th>
                        <th className="py-2.5 px-3 text-center">Всього</th>
                        <th className="py-2.5 px-3 text-center">Завершено</th>
                        <th className="py-2.5 px-3 text-center">Успішні</th>
                        <th className="py-2.5 px-3 text-center rounded-r-xl">% Успіху</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {interviewerData.map((inv) => (
                        <tr key={inv.interviewer} className="hover:bg-slate-50/80 transition font-medium text-slate-700">
                          <td className="py-3 px-3 font-bold text-slate-800">
                            {inv.interviewer}
                          </td>
                          <td className="py-3 px-3 text-center font-bold">{inv.total}</td>
                          <td className="py-3 px-3 text-center">{inv.completed}</td>
                          <td className="py-3 px-3 text-center font-bold text-emerald-700">{inv.successful}</td>
                          <td className="py-3 px-3 text-center">
                            <span className="bg-emerald-50 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md">
                              {inv.successRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Grid of 5 Key Metrics (Bento Style) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Вакансії */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">1. Вакансії</span>
            <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl">
              <Briefcase className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800">{metrics.vacanciesOpened} відкрито</h3>
            <div className="text-[10px] text-slate-500 font-bold mt-1.5 space-y-0.5">
              <p className="flex justify-between">Активних зараз: <span className="text-teal-700 font-extrabold">{metrics.vacanciesActive}</span></p>
              <p className="flex justify-between">Закрито в період: <span className="text-slate-700 font-extrabold">{metrics.vacanciesClosed}</span></p>
            </div>
          </div>
        </div>

        {/* KPI 2: Оброблені кандидати */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">2. Кандидати</span>
            <div className="p-2.5 bg-sky-50 text-sky-700 rounded-xl">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800">{metrics.processedCandidates} оброблено</h3>
            <div className="text-[10px] text-slate-500 font-bold mt-1.5 space-y-0.5">
              <p className="flex justify-between">Всього нових заявок: <span className="text-sky-700 font-extrabold">{metrics.totalCandidates}</span></p>
              <p className="flex justify-between">Рівень обробки: <span className="text-slate-700 font-extrabold">
                {metrics.totalCandidates > 0 ? `${Math.round((metrics.processedCandidates / metrics.totalCandidates) * 100)}%` : '0%'}
              </span></p>
            </div>
          </div>
        </div>

        {/* KPI 3: Співбесіди */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">3. Співбесіди</span>
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <Calendar className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800">{metrics.completedInterviews} проведено</h3>
            <div className="text-[10px] text-slate-500 font-bold mt-1.5 space-y-1">
              <p className="flex justify-between text-amber-600">
                <span>Заплановано:</span>
                <span className="font-extrabold">{metrics.scheduledInterviews}</span>
              </p>
              <p className="flex justify-between text-emerald-700">
                <span>Успішні:</span>
                <span className="font-extrabold">{metrics.successfulInterviews}</span>
              </p>
              <p className="flex justify-between text-slate-400 pt-0.5 border-t border-slate-100">
                <span>Всього в розкладі:</span>
                <span>{metrics.totalInterviews}</span>
              </p>
            </div>
          </div>
        </div>

        {/* KPI 4 & 5: Стажери та успішні завершення */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">4-5. Стажери</span>
            <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl">
              <Award className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800">{metrics.totalInterns} розпочали</h3>
            <div className="text-[10px] text-slate-500 font-bold mt-1.5 space-y-0.5">
              <p className="flex justify-between text-emerald-700 font-extrabold">Успішно закінчили: <span className="font-black text-xs">{metrics.completedInternships}</span></p>
              <p className="flex justify-between">Проходять зараз: <span>{metrics.activeInterns}</span></p>
            </div>
          </div>
        </div>

        {/* KPI 7: Час закриття вакансії */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">7. Час закриття</span>
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
              <Clock className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800">
              {metrics.averageClosureTime > 0 ? `${metrics.averageClosureTime} днів` : '—'}
            </h3>
            <div className="text-[10px] text-slate-500 font-bold mt-1.5 space-y-0.5">
              <p className="truncate">За закритими вакансіями: {metrics.closedWithDatesCount}</p>
              {metrics.averageClosureTime > 0 ? (
                <p className="text-[9px] text-teal-600 font-extrabold uppercase tracking-wide">
                  {metrics.averageClosureTime < 14 ? '⚡ Дуже швидко' : metrics.averageClosureTime < 30 ? '👍 Помірно' : '⏱️ Потребує аналізу'}
                </p>
              ) : (
                <p className="text-[9px] text-slate-400 italic">Немає закритих вакансій</p>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Middle Row: Recruitment Funnel (KPI 8) and Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recruitment Funnel & Conversion (KPI 8) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between lg:col-span-1">
          <div>
            <div className="flex flex-col gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1.5 text-teal-700" />
                  <span>8. Конверсія найму</span>
                </h4>
                <span className="text-xs bg-teal-50 text-teal-700 font-extrabold px-2.5 py-1 rounded-lg border border-teal-100">
                  {funnelVacancyFilter === 'all' ? 'Загальна' : 'Вакансія'}: {activeFunnelData.overallConversion}%
                </span>
              </div>

              {/* Vacancy Funnel Filter */}
              <div className="flex items-center space-x-2 pt-1">
                <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <select
                  value={funnelVacancyFilter}
                  onChange={(e) => setFunnelVacancyFilter(e.target.value)}
                  className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:border-teal-600 focus:outline-hidden cursor-pointer"
                >
                  <option value="all">🌐 Всі вакансії разом</option>
                  {data.vacancies.map((v) => (
                    <option key={v.id} value={v.id}>
                      📌 {v.title} ({v.department}) {v.priority === 'Гаряча' ? '🔥' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {activeFunnelData.vacancy && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-semibold text-slate-500 truncate">
                    {activeFunnelData.vacancy.department} • {activeFunnelData.vacancy.priority || 'Звичайна'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeFunnelData.vacancy) {
                        setSelectedFunnelVacancy(activeFunnelData.vacancy);
                        setIsFunnelModalOpen(true);
                      }
                    }}
                    className="text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-lg transition cursor-pointer shrink-0"
                  >
                    🔍 Детальний розбір
                  </button>
                </div>
              )}

              {activeFunnelData.bottleneckText && (
                <div className={`mt-2 px-2.5 py-1 rounded-lg text-xs font-bold border ${activeFunnelData.bottleneckClass}`}>
                  {activeFunnelData.bottleneckText}
                </div>
              )}
            </div>

            {/* Funnel visualization */}
            <div className="space-y-3 pt-3">
              
              {/* Step 1: Заявки */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">1. Заявки (Вхідний потік)</span>
                  <span className="font-extrabold text-slate-700">{activeFunnelData.applications} осіб (100%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-teal-700 h-full rounded-full transition-all duration-300" style={{ width: `${activeFunnelData.applicationsBarWidth}%` }}></div>
                </div>
              </div>

              {/* Step 2: Первинний контакт */}
              <div className="space-y-1 pl-2 border-l-2 border-teal-200">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-teal-800 flex items-center">
                    <ArrowUpRight className="h-3.5 w-3.5 mr-1 text-teal-500" />
                    <span>2. Повідомлення (зв'язалися)</span>
                  </span>
                  <span className="font-bold text-teal-800">
                    {activeFunnelData.contacted} осіб ({activeFunnelData.appToContactConv}% від заявок)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-teal-600 h-full rounded-full transition-all duration-300" style={{ width: `${activeFunnelData.contactedBarWidth}%` }}></div>
                </div>
              </div>

              {/* Step 3: Співбесіди */}
              <div className="space-y-1 pl-3 border-l-2 border-sky-300">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-sky-800 flex items-center">
                    <ArrowUpRight className="h-3.5 w-3.5 mr-1 text-sky-500" />
                    <span>3. Проведені співбесіди</span>
                  </span>
                  <span className="font-bold text-sky-800">
                    {activeFunnelData.completedInterviews} осіб ({activeFunnelData.appToInterviewConv}% від заявок)
                  </span>
                </div>
                {activeFunnelData.scheduledInterviews > 0 && (
                  <p className="text-[10px] text-amber-600 font-semibold pl-4">
                    + {activeFunnelData.scheduledInterviews} співбесід заплановано
                  </p>
                )}
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-sky-600 h-full rounded-full transition-all duration-300" style={{ width: `${activeFunnelData.interviewsBarWidth}%` }}></div>
                </div>
              </div>

              {/* Step 4: Стажування */}
              <div className="space-y-1 pl-4 border-l-2 border-indigo-300">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-indigo-800 flex items-center">
                    <ArrowUpRight className="h-3.5 w-3.5 mr-1 text-indigo-500" />
                    <span>4. Стажування</span>
                  </span>
                  <span className="font-bold text-indigo-800">
                    {activeFunnelData.interns} осіб ({activeFunnelData.interviewToInternConv}% від співбесід)
                  </span>
                </div>
                {activeFunnelData.activeInterns > 0 && (
                  <p className="text-[10px] text-indigo-600 font-semibold pl-4">
                    • {activeFunnelData.activeInterns} стажерів зараз проходять програму
                  </p>
                )}
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${activeFunnelData.internsBarWidth}%` }}></div>
                </div>
              </div>

              {/* Step 5: Працевлаштування */}
              <div className="space-y-1 pl-5 border-l-2 border-emerald-500">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-emerald-900 flex items-center">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                    <span>5. Працевлаштовано (Найм)</span>
                  </span>
                  <span className="font-extrabold text-emerald-700">
                    {activeFunnelData.hired} осіб ({activeFunnelData.overallConversion}% від старту)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full transition-all duration-300" style={{ width: `${activeFunnelData.hiredBarWidth}%` }}></div>
                </div>
              </div>

            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 font-semibold text-center leading-relaxed">
            {funnelVacancyFilter === 'all' 
              ? 'Показник конверсії відображає доходимість та успіх кандидатів на кожному етапі воронки.' 
              : `Аналітика воронки розрахована персонально для вакансії "${activeFunnelData.vacancy?.title}".`}
          </div>
        </div>

        {/* Dynamic Trend Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-700" />
              <span>Динаміка залучення нових заявок (Кандидати)</span>
            </h4>
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100/70 font-bold">
              <CalendarDays className="h-3.5 w-3.5 text-teal-600" />
              <span>Всього у періоді: <strong className="text-teal-800">{metrics.totalCandidates}</strong></span>
            </div>
          </div>
          <div className="h-60">
            {trendData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs font-semibold">Немає заявок за обраний період</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                    labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                  />
                  <Line type="monotone" dataKey="Заявки" stroke="#0f766e" strokeWidth={3} dot={{ r: 4, fill: '#0f766e' }} activeDot={{ r: 6, fill: '#0d9488' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Row: Rejections Reasons (KPI 6), Recruitment Sources (KPI 9) & Call Types (KPI 10) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* KPI 6: Кількість відмов і причини відмов */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-700 text-sm flex items-center">
                <XCircle className="h-4.5 w-4.5 text-rose-600 mr-2" />
                <span>6. Аналітика причин відмов</span>
              </h4>
              <span className="text-xs bg-rose-50 text-rose-700 font-extrabold px-2.5 py-0.5 rounded-full uppercase shrink-0">
                Всього: {rejectionReasonsData.total}
              </span>
            </div>

            {rejectionReasonsData.total === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-xs text-center space-y-1">
                <AlertCircle className="h-8 w-8 text-slate-200" />
                <span>Немає зафіксованих відмов за цей період</span>
              </div>
            ) : (
              <div className="space-y-3.5 pt-4">
                {rejectionReasonsData.list.map((entry, index) => (
                  <div key={entry.name} className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                      <span className="flex items-center">
                        <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                        {entry.name}
                      </span>
                      <span className="text-slate-500 font-bold">{entry.count} осіб ({entry.percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden border border-slate-100/50">
                      <div 
                        className="h-full rounded-full transition-all duration-300" 
                        style={{ 
                          width: `${entry.percentage}%`,
                          backgroundColor: COLORS[index % COLORS.length]
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed">
            Система автоматично групує причини відмов, аналізуючи коментарі у закритих картках кандидатів, інтерв'ю та стажерів.
          </div>
        </div>

        {/* KPI 9: Джерела пошуку кандидатів */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-700 text-sm flex items-center">
                <Search className="h-4.5 w-4.5 text-teal-600 mr-2" />
                <span>9. Джерела пошуку кандидатів</span>
              </h4>
              <span className="text-xs bg-teal-50 text-teal-700 font-extrabold px-2.5 py-0.5 rounded-full uppercase shrink-0">
                Залучено: {sourceData.reduce((acc, curr) => acc + curr.value, 0)} канд.
              </span>
            </div>

            {sourceData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-xs text-center space-y-1">
                <Compass className="h-8 w-8 text-slate-200" />
                <span>Заявки за цей період відсутні</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-between gap-4 pt-4">
                {/* Visual Pie */}
                <div className="h-32 w-32 shrink-0 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={32}
                        outerRadius={48}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {sourceData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[9px] uppercase font-black text-slate-400">Шлях</span>
                    <span className="text-[10px] font-black text-teal-700 uppercase">Пошуку</span>
                  </div>
                </div>

                {/* Legend list */}
                <div className="flex-1 space-y-1.5 max-h-[140px] overflow-y-auto w-full">
                  {sourceData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between text-xs py-1 hover:bg-slate-50 rounded-lg px-2 transition font-semibold text-slate-700">
                      <div className="flex items-center min-w-0 mr-2">
                        <span className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                        <span className="truncate">{entry.name}</span>
                      </div>
                      <span className="font-extrabold text-slate-500 shrink-0">{entry.value} ({entry.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed">
            Показує, які канали рекрутингу привели найбільше кандидатів.
          </div>
        </div>

        {/* KPI 10: Аналітика типів контактів */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-700 text-sm flex items-center">
                <PhoneCall className="h-4.5 w-4.5 text-amber-600 mr-2" />
                <span>10. Типи контактів та конверсія</span>
              </h4>
            </div>

            <div className="space-y-4 pt-4">
              {callTypesData.map((ct) => (
                <div key={ct.type} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        ct.type === 'Гарячий' ? 'bg-amber-500' : ct.type === 'Холодний' ? 'bg-sky-500' : 'bg-indigo-500'
                      }`}></span>
                      <span>{ct.type} контакт</span>
                    </span>
                    <span className="font-extrabold text-slate-700">{ct.count} осіб ({ct.percentage}%)</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold pt-1 border-t border-slate-200/50">
                    <span>Перейшли у найм: <strong className="text-slate-700">{ct.hires} осіб</strong></span>
                    <span className="bg-amber-100/80 text-amber-900 font-bold px-2 py-0.5 rounded-md">
                      Конверсія: {ct.conversion}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed">
            Дозволяє порівняти ефективність опрацювання "гарячих", "холодних" та повторних звернень.
          </div>
        </div>

      </div>
      </>
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
        candidates={data.candidates}
        interviews={data.interviews}
        interns={data.interns}
        onViewPersonalFile={onOpenPersonalFile}
      />
    </div>
  );
}
