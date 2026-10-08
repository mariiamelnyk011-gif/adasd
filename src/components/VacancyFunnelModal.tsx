import React, { useState, useMemo } from 'react';
import { Vacancy, Candidate, Interview, Intern } from '../types';
import { formatDate, formatDateTime, parseDateComponents } from '../lib/dateUtils';
import { PRIORITY_CONFIG, getNormalizedPriority } from './VacanciesManager';
import IframePrintModal from './IframePrintModal';
import {
  matchCandidateToVacancy,
  matchInterviewToVacancy,
  matchInternToVacancy,
  isCandidateHired,
  isInternCompleted
} from '../lib/funnelUtils';
import {
  TrendingUp,
  Users,
  Calendar,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
  Phone,
  FileText,
  Search,
  Printer,
  X,
  ArrowRight,
  Sparkles,
  Flame,
  Filter,
  Check,
  Percent,
  Layers,
  PieChart as PieIcon,
  ChevronRight,
  AlertTriangle,
  Zap,
  Timer,
  Target,
  ArrowDownRight,
  UserCheck,
  UserX,
  GraduationCap,
  Activity,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  Info
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface VacancyFunnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  vacancy: Vacancy | null;
  candidates: Candidate[];
  interviews?: Interview[];
  interns?: Intern[];
  onViewPersonalFile?: (candidateId: string) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  'work.ua': '#0f766e',
  'robota.ua': '#0284c7',
  'facebook': '#3b82f6',
  'instagram': '#ec4899',
  'threads': '#6366f1',
  'працівник': '#10b981',
  'внз': '#f59e0b',
  'інше': '#64748b'
};

const DEFAULT_CHART_COLORS = ['#0f766e', '#0284c7', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

export type GranularStageKey = 
  | 'all'
  | 'inflow_hot'
  | 'inflow_cold'
  | 'screening_passed'
  | 'interviews_scheduled'
  | 'interviews_attended'
  | 'interviews_passed'
  | 'interns_started'
  | 'interns_completed'
  | 'hired'
  | 'rejected';

export default function VacancyFunnelModal({
  isOpen,
  onClose,
  vacancy,
  candidates,
  interviews = [],
  interns = [],
  onViewPersonalFile
}: VacancyFunnelModalProps) {
  const [activeStageTab, setActiveStageTab] = useState<GranularStageKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [viewDepthMode, setViewDepthMode] = useState<'deep_8_stages' | 'step_analysis' | 'sources_matrix' | 'losses_breakdown'>('deep_8_stages');

  const handlePrint = () => {
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) {
      setShowPrintModal(true);
    } else {
      window.print();
    }
  };

  // 1. Gather all candidates related to this vacancy (direct + linked via interns/interviews)
  const vacancyCandidates = useMemo(() => {
    if (!vacancy || !vacancy.id) return [];
    const safeCandidates = (candidates || []).filter((c): c is Candidate => Boolean(c && c.id));
    const safeInterns = (interns || []).filter((it): it is Intern => Boolean(it && it.id));
    const direct = safeCandidates.filter(c => matchCandidateToVacancy(c, vacancy, safeInterns));
    const candIdSet = new Set(direct.map(c => c.id));

    // Also include candidates linked through interns belonging to this vacancy
    safeInterns.forEach(it => {
      if (matchInternToVacancy(it, vacancy, safeCandidates)) {
        const cand = safeCandidates.find(c => (it.candidateId && c.id === it.candidateId) || (c.name && it.candidateName && c.name.trim().toLowerCase() === it.candidateName.trim().toLowerCase()));
        if (cand && !candIdSet.has(cand.id)) {
          candIdSet.add(cand.id);
          direct.push(cand);
        }
      }
    });

    return direct;
  }, [vacancy, candidates, interns]);

  // 2. Gather interviews for these candidates
  const vacancyInterviews = useMemo(() => {
    if (!vacancy || !vacancy.id) return [];
    const safeInterviews = (interviews || []).filter((i): i is Interview => Boolean(i && i.id));
    const candIds = new Set(vacancyCandidates.map(c => c.id).filter(Boolean));
    const candNames = new Set(vacancyCandidates.map(c => (c.name || '').trim().toLowerCase()).filter(Boolean));
    return safeInterviews.filter(i => matchInterviewToVacancy(i, vacancy, candIds, candNames));
  }, [vacancy, vacancyCandidates, interviews]);

  // 3. Gather interns for this vacancy/position (excluding reserve)
  const vacancyInterns = useMemo(() => {
    if (!vacancy || !vacancy.id) return [];
    const safeInterns = (interns || []).filter((intern): intern is Intern => Boolean(intern && intern.id));
    const safeCandidates = (candidates || []).filter((c): c is Candidate => Boolean(c && c.id));
    
    return safeInterns.filter(intern => {
      // Exclude reserve
      const cand = safeCandidates.find(c => 
        (intern.candidateId && c.id === intern.candidateId) || 
        (c.name && intern.candidateName && c.name.trim().toLowerCase() === intern.candidateName.trim().toLowerCase())
      );
      if (cand && cand.status === 'Резерв') return false;
      const hasReserveInterview = (interviews || []).some(inv => 
        (inv.candidateId === intern.candidateId || (inv.candidateName && intern.candidateName && inv.candidateName.trim().toLowerCase() === intern.candidateName.trim().toLowerCase())) &&
        (inv.result === 'Резерв' || inv.result?.toLowerCase().includes('резерв'))
      );
      if (hasReserveInterview) return false;

      return matchInternToVacancy(intern, vacancy, safeCandidates);
    });
  }, [vacancy, interns, candidates, interviews]);

  // 4. Granular Deep Funnel Metrics Calculation (8 Specific Stages)
  const funnelMetrics = useMemo(() => {
    if (!vacancy) {
      return {
        totalApplications: 0,
        hotApplications: 0,
        coldApplications: 0,
        withResume: 0,
        withDocuments: 0,
        totalContacted: 0,
        screeningPassed: 0,
        consideringCandidates: 0,
        rejectedAtScreening: 0,
        totalInterviewInvited: 0,
        completedInterviews: 0,
        scheduledInterviews: 0,
        noShowInterviews: 0,
        showUpRate: 0,
        successfulInterviews: 0,
        rejectedAfterInterview: 0,
        reserveInterviews: 0,
        totalInterns: 0,
        activeInterns: 0,
        completedInterns: 0,
        failedInterns: 0,
        totalHired: 0,
        totalRejected: 0,
        overallConv: 0,
        appToContactConv: 0,
        contactToInterviewConv: 0,
        interviewAttendedConv: 0,
        interviewPassRate: 0,
        passToInternConv: 0,
        internCompletionRate: 0,
        avgDaysToContact: 0,
        daysOpen: 0,
        bottlenecks: []
      };
    }

    const rawApplications = vacancyCandidates.length;

    // Stage 1: Inflow Sub-breakdowns
    const hotApplications = vacancyCandidates.filter(c => c.callType === 'Гарячий').length;
    const coldApplications = vacancyCandidates.filter(c => c.callType === 'Холодний').length;
    const withResume = vacancyCandidates.filter(c => Boolean(c.cvLink || c.cvFileContent || c.cvFileName)).length;
    const withDocuments = vacancyCandidates.filter(c => Boolean(c.hasDocuments)).length;

    // Stage 2: Screening & Contact
    const contactedCandidates = vacancyCandidates.filter(c => c.status !== 'Новий');
    const rawContacted = contactedCandidates.length;
    const screeningPassed = vacancyCandidates.filter(c => 
      c.status === 'Співбесіда' || 
      c.status === 'Стажування' || 
      (c.status !== 'Відхилено' && c.status !== 'Новий')
    ).length;
    const consideringCandidates = vacancyCandidates.filter(c => c.status === 'Подумає' || c.status === 'Повідомлення').length;
    const rejectedAtScreening = vacancyCandidates.filter(c => c.status === 'Відхилено' && !vacancyInterviews.some(i => i.candidateId === c.id)).length;

    // Stage 3 & 4: Interviews (Scheduled, Showed up, No-Show)
    const scheduledInterviews = vacancyInterviews.filter(i => i.status === 'Заплановано').length;
    const rawCompletedInterviews = vacancyInterviews.filter(i => i.status === 'Завершено').length;
    const noShowInterviews = vacancyInterviews.filter(i => i.status === 'Не прийшов' || i.status === 'Скасовано').length;
    const totalInterviewInvited = rawCompletedInterviews + scheduledInterviews + noShowInterviews;

    // Show-up rate (% of invited that actually attended)
    const showUpRate = totalInterviewInvited > 0
      ? Math.round((rawCompletedInterviews / totalInterviewInvited) * 100)
      : (rawCompletedInterviews > 0 ? 100 : 0);

    // Stage 5: Interview Result (Passed / Qualified)
    const successfulInterviews = vacancyInterviews.filter(i => 
      i.result === 'Співбесіда пройшла успішно' || 
      i.result === 'Перейшов на стажування' ||
      (i.rating && i.rating >= 4)
    ).length;
    const rejectedAfterInterview = vacancyInterviews.filter(i => 
      i.result === 'Відмова компанії' || 
      i.result === 'Відмова кандидата'
    ).length;
    const reserveInterviews = vacancyInterviews.filter(i => i.result === 'Резерв' || i.result === 'Подумає').length;

    // Stage 6 & 7: Internship (Started, Active, Completed, Dropped)
    const activeInterns = vacancyInterns.filter(intern => intern.status === 'Триває').length;
    const completedInterns = vacancyInterns.filter(intern => isInternCompleted(intern)).length;
    const failedInterns = vacancyInterns.filter(intern => intern.status === 'Не пройшов').length;

    // Additional candidates on internship who don't have an intern record yet
    const internCandIds = new Set(vacancyInterns.map(i => i.candidateId).filter(Boolean));
    const internCandNames = new Set(vacancyInterns.map(i => (i.candidateName || '').trim().toLowerCase()).filter(Boolean));
    let extraInternsFromCandidates = 0;
    vacancyCandidates.forEach(c => {
      if (c.status === 'Стажування' || isCandidateHired(c)) {
        const alreadyInInterns = (c.id && internCandIds.has(c.id)) || (c.name && internCandNames.has(c.name.trim().toLowerCase()));
        if (!alreadyInInterns) {
          extraInternsFromCandidates++;
        }
      }
    });

    // Stage 8: Final Hires
    // Unique individuals who successfully completed internship OR have candidate status 'Працевлаштовано' / 'Офер прийнято'
    // NEVER count active interns ('Стажування') as hired!
    const completedInternCandIds = new Set(vacancyInterns.filter(isInternCompleted).map(i => i.candidateId).filter(Boolean));
    const completedInternCandNames = new Set(vacancyInterns.filter(isInternCompleted).map(i => (i.candidateName || '').trim().toLowerCase()).filter(Boolean));
    let directHiresCount = 0;
    vacancyCandidates.forEach(c => {
      if (isCandidateHired(c)) {
        const alreadyInCompleted = (c.id && completedInternCandIds.has(c.id)) || (c.name && completedInternCandNames.has(c.name.trim().toLowerCase()));
        if (!alreadyInCompleted) {
          directHiresCount++;
        }
      }
    });
    const totalHired = completedInterns + directHiresCount;
    const totalInterns = Math.max(vacancyInterns.length + extraInternsFromCandidates, totalHired);

    // Interviews progression: at least totalInterns
    const completedInterviews = Math.max(rawCompletedInterviews, totalInterns);

    // Contact progression: at least completedInterviews
    const totalContacted = Math.max(rawContacted, completedInterviews);

    // Total Applications: at least totalContacted
    const totalApplications = Math.max(rawApplications, totalContacted);

    // Total Rejections Across Entire Funnel
    const totalRejected = vacancyCandidates.filter(c => c.status === 'Відхилено').length + failedInterns + noShowInterviews;

    // Step-to-Step Conversion Rates
    const appToContactConv = totalApplications > 0 ? Math.min(100, Math.round((totalContacted / totalApplications) * 100)) : 0;
    const contactToInterviewConv = totalContacted > 0 ? Math.min(100, Math.round((completedInterviews / totalContacted) * 100)) : 0;
    const interviewAttendedConv = totalInterviewInvited > 0 ? Math.min(100, Math.round((completedInterviews / totalInterviewInvited) * 100)) : (completedInterviews > 0 ? 100 : 0);
    const interviewPassRate = completedInterviews > 0 ? Math.min(100, Math.round((Math.max(successfulInterviews, totalInterns) / completedInterviews) * 100)) : (successfulInterviews > 0 ? 100 : 0);
    const passToInternConv = completedInterviews > 0 ? Math.min(100, Math.round((totalInterns / completedInterviews) * 100)) : 0;
    const internCompletionRate = totalInterns > 0 ? Math.min(100, Math.round((totalHired / totalInterns) * 100)) : 0;
    const overallConv = totalApplications > 0 ? Math.min(100, Math.round((totalHired / totalApplications) * 100)) : 0;

    // Velocity / Time-to-hire calculation
    let totalCycleDays = 0;
    let cycleCount = 0;
    vacancyCandidates.forEach(c => {
      if (c.appliedAt && c.contactDate) {
        const p1 = parseDateComponents(c.appliedAt);
        const p2 = parseDateComponents(c.contactDate);
        if (p1.isValid && p2.isValid && p2.timestamp >= p1.timestamp) {
          const diffDays = Math.round((p2.timestamp - p1.timestamp) / (1000 * 60 * 60 * 24));
          totalCycleDays += diffDays;
          cycleCount++;
        }
      }
    });
    const avgDaysToContact = cycleCount > 0 ? Math.max(1, Math.round(totalCycleDays / cycleCount)) : 1;

    // Vacancy open duration in days
    let daysOpen = 0;
    if (vacancy?.createdAt) {
      const pCreated = parseDateComponents(vacancy.createdAt);
      if (pCreated.isValid) {
        const nowTs = Date.now();
        daysOpen = Math.max(1, Math.round((nowTs - pCreated.timestamp) / (1000 * 60 * 60 * 24)));
      }
    }

    // Diagnostics / Bottlenecks detection
    const bottlenecks: { title: string; severity: 'warning' | 'danger' | 'success'; desc: string; tip: string }[] = [];

    if (totalApplications === 0) {
      bottlenecks.push({
        title: 'Недостатній вхідний потік',
        severity: 'danger',
        desc: 'За даною вакансією ще немає отриманих відгуків або кандидатів.',
        tip: 'Рекомендація: перевірте публікацію на сайтах пошуку роботи (Work.ua, Robota.ua) та запустіть рекламу в соцмережах.'
      });
    } else {
      if (appToContactConv < 60) {
        bottlenecks.push({
          title: 'Затримка на етапі першого контакту',
          severity: 'warning',
          desc: `Опрацьовано лише ${appToContactConv}% відгуків. ${totalApplications - totalContacted} кандидатів очікують дзвінка.`,
          tip: 'Рекомендація: прискоріть перший контакт протягом 24 годин після надходження резюме.'
        });
      }

      if (totalInterviewInvited > 0 && showUpRate < 65) {
        bottlenecks.push({
          title: 'Низька доходимість на співбесіди',
          severity: 'danger',
          desc: `Явка на інтерв'ю становить ${showUpRate}%. ${noShowInterviews} кандидатів не прийшли або скасували зустріч.`,
          tip: 'Рекомендація: надсилайте нагадування з адресою/посиланням у Telegram/Viber за 2-3 години до зустрічі.'
        });
      }

      if (completedInterviews > 0 && interviewPassRate < 35) {
        bottlenecks.push({
          title: 'Високий відсів після співбесіди',
          severity: 'warning',
          desc: `Лише ${interviewPassRate}% кандидатів успішно проходять інтерв'ю.`,
          tip: 'Рекомендація: скоригуйте фільтри на первинному скринінгу або деталізуйте вимоги у тексті вакансії.'
        });
      }

      if (totalInterns > 0 && internCompletionRate < 50) {
        bottlenecks.push({
          title: 'Відсів під час стажування',
          severity: 'danger',
          desc: `Лише ${internCompletionRate}% стажерів успішно доходять до працевлаштування.`,
          tip: 'Рекомендація: перевірте систему онбордингу, чіткість завдань та якість менторської підтримки.'
        });
      }

      if (bottlenecks.length === 0 && overallConv >= 15) {
        bottlenecks.push({
          title: 'Збалансована та ефективна воронка',
          severity: 'success',
          desc: `Конверсія найму становить ${overallConv}%, що є відмінним показником.`,
          tip: 'Воронка функціонує ритмічно без критичних втрат на проміжних етапах.'
        });
      }
    }

    return {
      totalApplications,
      hotApplications,
      coldApplications,
      withResume,
      withDocuments,
      totalContacted,
      screeningPassed,
      consideringCandidates,
      rejectedAtScreening,
      totalInterviewInvited,
      completedInterviews,
      scheduledInterviews,
      noShowInterviews,
      showUpRate,
      successfulInterviews,
      rejectedAfterInterview,
      reserveInterviews,
      totalInterns,
      activeInterns,
      completedInterns,
      failedInterns,
      totalHired,
      totalRejected,
      // Conversions
      overallConv,
      appToContactConv,
      contactToInterviewConv,
      interviewAttendedConv,
      interviewPassRate,
      passToInternConv,
      internCompletionRate,
      // Speed
      avgDaysToContact,
      daysOpen,
      bottlenecks
    };
  }, [vacancy, vacancyCandidates, vacancyInterviews, vacancyInterns]);

  // 5. Deep 8-Stage Pipeline Structure Definition
  const deepFunnelStages = useMemo(() => {
    return [
      {
        id: 'stage-1',
        stepNum: '1',
        title: 'Вхідний потік (Заявки)',
        subtitle: 'Всі отримані відгуки та знайдені ліди',
        count: funnelMetrics.totalApplications,
        subStats: [
          { label: 'Гарячі відгуки', value: funnelMetrics.hotApplications, color: 'text-rose-600 font-bold' },
          { label: 'Холодний пошук', value: funnelMetrics.coldApplications, color: 'text-sky-600 font-bold' },
          { label: 'З резюме', value: funnelMetrics.withResume, color: 'text-teal-700' }
        ],
        stepConv: '100%',
        stepLoss: 0,
        convLabel: '100% стартової бази',
        colorBg: 'bg-teal-700',
        colorText: 'text-teal-800',
        colorLightBg: 'bg-teal-50',
        borderColor: 'border-teal-200',
        barWidth: 100,
        stageKey: 'all' as GranularStageKey
      },
      {
        id: 'stage-2',
        stepNum: '2',
        title: 'Повідомлення & Контакт',
        subtitle: 'Встановлено зв\'язок з кандидатами',
        count: funnelMetrics.totalContacted,
        subStats: [
          { label: 'Пройшли скринінг', value: funnelMetrics.screeningPassed, color: 'text-teal-700' },
          { label: 'Думають', value: funnelMetrics.consideringCandidates, color: 'text-amber-600' },
          { label: 'Відсіяні', value: funnelMetrics.rejectedAtScreening, color: 'text-rose-500' }
        ],
        stepConv: `${funnelMetrics.appToContactConv}%`,
        stepLoss: funnelMetrics.totalApplications - funnelMetrics.totalContacted,
        convLabel: 'від усіх заявок',
        colorBg: 'bg-teal-600',
        colorText: 'text-teal-700',
        colorLightBg: 'bg-teal-50',
        borderColor: 'border-teal-200',
        barWidth: Math.max(15, funnelMetrics.appToContactConv),
        stageKey: 'screening_passed' as GranularStageKey
      },
      {
        id: 'stage-3',
        stepNum: '3',
        title: 'Призначено співбесіду',
        subtitle: 'Погоджено дату та час зустрічі',
        count: funnelMetrics.totalInterviewInvited,
        subStats: [
          { label: 'В плані (майбутні)', value: funnelMetrics.scheduledInterviews, color: 'text-sky-600' },
          { label: 'Відмова до зустрічі', value: funnelMetrics.totalContacted - funnelMetrics.totalInterviewInvited > 0 ? funnelMetrics.totalContacted - funnelMetrics.totalInterviewInvited : 0, color: 'text-slate-400' }
        ],
        stepConv: `${funnelMetrics.contactToInterviewConv}%`,
        stepLoss: Math.max(0, funnelMetrics.totalContacted - funnelMetrics.totalInterviewInvited),
        convLabel: 'від контактів',
        colorBg: 'bg-sky-600',
        colorText: 'text-sky-800',
        colorLightBg: 'bg-sky-50',
        borderColor: 'border-sky-200',
        barWidth: Math.max(12, funnelMetrics.totalApplications > 0 ? Math.round((funnelMetrics.totalInterviewInvited / funnelMetrics.totalApplications) * 100) : 0),
        stageKey: 'interviews_scheduled' as GranularStageKey
      },
      {
        id: 'stage-4',
        stepNum: '4',
        title: 'Проведено співбесіду (Явка)',
        subtitle: 'Кандидати, які дійшли та пройшли зустріч',
        count: funnelMetrics.completedInterviews,
        subStats: [
          { label: 'Доходимість (Show-up)', value: `${funnelMetrics.showUpRate}%`, color: 'text-sky-800 font-extrabold' },
          { label: 'Не з\'явилися / Зрив', value: funnelMetrics.noShowInterviews, color: 'text-rose-600 font-bold' }
        ],
        stepConv: `${funnelMetrics.showUpRate}%`,
        stepLoss: funnelMetrics.noShowInterviews,
        convLabel: 'явка на інтерв\'ю',
        colorBg: 'bg-sky-700',
        colorText: 'text-sky-900',
        colorLightBg: 'bg-sky-50',
        borderColor: 'border-sky-200',
        barWidth: Math.max(10, funnelMetrics.totalApplications > 0 ? Math.round((funnelMetrics.completedInterviews / funnelMetrics.totalApplications) * 100) : 0),
        stageKey: 'interviews_attended' as GranularStageKey
      },
      {
        id: 'stage-5',
        stepNum: '5',
        title: 'Успішна співбесіда (Кваліфіковано)',
        subtitle: 'Позитивне рішення інтерв\'юера та офер',
        count: funnelMetrics.successfulInterviews,
        subStats: [
          { label: 'Оцінка 4-5 зірок', value: `${funnelMetrics.successfulInterviews} осіб`, color: 'text-amber-600 font-bold' },
          { label: 'Відмова після інтерв\'ю', value: funnelMetrics.rejectedAfterInterview, color: 'text-rose-600' },
          { label: 'В резерв', value: funnelMetrics.reserveInterviews, color: 'text-slate-500' }
        ],
        stepConv: `${funnelMetrics.interviewPassRate}%`,
        stepLoss: funnelMetrics.completedInterviews - funnelMetrics.successfulInterviews > 0 ? funnelMetrics.completedInterviews - funnelMetrics.successfulInterviews : 0,
        convLabel: 'успіх інтерв\'ю',
        colorBg: 'bg-indigo-600',
        colorText: 'text-indigo-800',
        colorLightBg: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        barWidth: Math.max(8, funnelMetrics.totalApplications > 0 ? Math.round((funnelMetrics.successfulInterviews / funnelMetrics.totalApplications) * 100) : 0),
        stageKey: 'interviews_passed' as GranularStageKey
      },
      {
        id: 'stage-6',
        stepNum: '6',
        title: 'Вихід на стажування',
        subtitle: 'Прийняли пропозицію та приступили до навчання',
        count: funnelMetrics.totalInterns,
        subStats: [
          { label: 'Активні зараз', value: funnelMetrics.activeInterns, color: 'text-indigo-600 font-bold' },
          { label: 'Вихід з оферу', value: `${funnelMetrics.passToInternConv}%`, color: 'text-indigo-700' }
        ],
        stepConv: `${funnelMetrics.passToInternConv}%`,
        stepLoss: Math.max(0, funnelMetrics.successfulInterviews - funnelMetrics.totalInterns),
        convLabel: 'від успішних співбесід',
        colorBg: 'bg-indigo-700',
        colorText: 'text-indigo-900',
        colorLightBg: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        barWidth: Math.max(7, funnelMetrics.totalApplications > 0 ? Math.round((funnelMetrics.totalInterns / funnelMetrics.totalApplications) * 100) : 0),
        stageKey: 'interns_started' as GranularStageKey
      },
      {
        id: 'stage-7',
        stepNum: '7',
        title: 'Успішне стажування',
        subtitle: 'Склали іспити / завершили випробувальний термін',
        count: funnelMetrics.completedInterns,
        subStats: [
          { label: 'Успіх випробування', value: `${funnelMetrics.internCompletionRate}%`, color: 'text-emerald-700 font-bold' },
          { label: 'Не пройшли стаж', value: funnelMetrics.failedInterns, color: 'text-rose-600' }
        ],
        stepConv: `${funnelMetrics.internCompletionRate}%`,
        stepLoss: funnelMetrics.failedInterns,
        convLabel: 'захистили проєкт',
        colorBg: 'bg-emerald-600',
        colorText: 'text-emerald-800',
        colorLightBg: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        barWidth: Math.max(6, funnelMetrics.totalApplications > 0 ? Math.round((funnelMetrics.completedInterns / funnelMetrics.totalApplications) * 100) : 0),
        stageKey: 'interns_completed' as GranularStageKey
      },
      {
        id: 'stage-8',
        stepNum: '8',
        title: 'Зарахування в штат (Найм)',
        subtitle: 'Оформлено в штат співробітників компанії',
        count: funnelMetrics.totalHired,
        subStats: [
          { label: 'Наскрізна конверсія', value: `${funnelMetrics.overallConv}%`, color: 'text-emerald-700 font-black' },
          { label: 'Статус закриття', value: vacancy?.status === 'Активна' ? 'Позиція відкрита' : 'Укомплектовано', color: 'text-slate-600' }
        ],
        stepConv: `${funnelMetrics.overallConv}%`,
        stepLoss: 0,
        convLabel: 'загальний результат',
        colorBg: 'bg-emerald-700',
        colorText: 'text-emerald-900',
        colorLightBg: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        barWidth: Math.max(5, funnelMetrics.overallConv),
        stageKey: 'hired' as GranularStageKey
      }
    ];
  }, [funnelMetrics, vacancy]);

  // 6. Deep Source Quality & Conversion Matrix for this Vacancy
  const deepSourceMatrix = useMemo(() => {
    const srcMap: Record<string, {
      total: number;
      hot: number;
      cold: number;
      interviews: number;
      interns: number;
      hired: number;
      rejected: number;
      avgRating: number;
      ratingsSum: number;
      details: string[];
    }> = {};

    vacancyCandidates.forEach(c => {
      const src = (c.source || 'інше').toLowerCase();
      if (!srcMap[src]) {
        srcMap[src] = {
          total: 0,
          hot: 0,
          cold: 0,
          interviews: 0,
          interns: 0,
          hired: 0,
          rejected: 0,
          avgRating: 0,
          ratingsSum: 0,
          details: []
        };
      }
      srcMap[src].total++;
      if (c.callType === 'Гарячий') srcMap[src].hot++;
      else srcMap[src].cold++;

      if (c.sourceDetails && !srcMap[src].details.includes(c.sourceDetails)) {
        srcMap[src].details.push(c.sourceDetails);
      }

      if (c.status === 'Співбесіда') srcMap[src].interviews++;
      if (c.status === 'Стажування') srcMap[src].interns++;
      if (c.status === 'Відхилено') srcMap[src].rejected++;

      const rating = c.rating || 3;
      srcMap[src].ratingsSum += rating;
    });

    // Also factor in real interviews & interns
    const candSourceMap = new Map<string, string>(vacancyCandidates.map(c => [c.id, (c.source || 'інше').toLowerCase()]));

    vacancyInterviews.forEach(i => {
      const src = candSourceMap.get(i.candidateId);
      if (src && srcMap[src] && i.status === 'Завершено') {
        srcMap[src].interviews = Math.max(srcMap[src].interviews, srcMap[src].interviews + 1);
      }
    });

    vacancyInterns.forEach(intern => {
      const src = candSourceMap.get(intern.candidateId);
      if (src && srcMap[src]) {
        srcMap[src].interns = Math.max(srcMap[src].interns, srcMap[src].interns + 1);
        if (intern.status === 'Успішно завершено') {
          srcMap[src].hired++;
        }
      }
    });

    return Object.entries(srcMap).map(([source, stats]) => {
      const convToHire = stats.total > 0 ? Math.round((stats.hired / stats.total) * 100) : 0;
      const convToInterview = stats.total > 0 ? Math.round((stats.interviews / stats.total) * 100) : 0;
      const avgRating = stats.total > 0 ? Number((stats.ratingsSum / stats.total).toFixed(1)) : 3;

      return {
        source,
        ...stats,
        convToHire,
        convToInterview,
        avgRating
      };
    }).sort((a, b) => b.total - a.total);
  }, [vacancyCandidates, vacancyInterviews, vacancyInterns]);

  // 7. Stage-by-Stage Rejection / Loss Breakdown
  const stageLossesBreakdown = useMemo(() => {
    const losses: { stage: string; count: number; items: { reason: string; count: number; by: 'candidate' | 'company' | 'other' }[] }[] = [];

    // Stage 1/2: Screening rejections
    const screeningMap: Record<string, number> = {};
    vacancyCandidates.forEach(c => {
      if (c.status === 'Відхилено' && !vacancyInterviews.some(i => i.candidateId === c.id)) {
        const r = c.rejectionReason || 'Невідповідність кваліфікації';
        screeningMap[r] = (screeningMap[r] || 0) + 1;
      }
    });
    const screeningItems = Object.entries(screeningMap).map(([reason, count]) => ({
      reason,
      count,
      by: (reason.toLowerCase().includes('відмова кандидата') || reason.toLowerCase().includes('зарплатні')) ? 'candidate' as const : 'company' as const
    }));

    losses.push({
      stage: '1. Первинний скринінг & Недозвони',
      count: screeningItems.reduce((acc, i) => acc + i.count, 0),
      items: screeningItems
    });

    // Stage 3/4: Interview No-show / Drop
    const interviewDropMap: Record<string, number> = {};
    vacancyInterviews.forEach(i => {
      if (i.status === 'Не прийшов' || i.status === 'Скасовано') {
        const r = i.status === 'Не прийшов' ? 'Не з\'явився на співбесіду (No-show)' : 'Скасовано кандидатом заздалегідь';
        interviewDropMap[r] = (interviewDropMap[r] || 0) + 1;
      } else if (i.result === 'Відмова компанії' || i.result === 'Відмова кандидата') {
        const r = i.rejectionReason || i.result;
        interviewDropMap[r] = (interviewDropMap[r] || 0) + 1;
      }
    });
    const interviewItems = Object.entries(interviewDropMap).map(([reason, count]) => ({
      reason,
      count,
      by: reason.includes('кандидат') || reason.includes('Не з\'явився') ? 'candidate' as const : 'company' as const
    }));

    losses.push({
      stage: '2. Співбесіди (Зриви явки та відмови)',
      count: interviewItems.reduce((acc, i) => acc + i.count, 0),
      items: interviewItems
    });

    // Stage 5: Internship drop-outs
    const internLossMap: Record<string, number> = {};
    vacancyInterns.forEach(it => {
      if (it.status === 'Не пройшов') {
        const r = it.rejectionReason || 'Не склав фінальну атестацію';
        internLossMap[r] = (internLossMap[r] || 0) + 1;
      }
    });
    const internItems = Object.entries(internLossMap).map(([reason, count]) => ({
      reason,
      count,
      by: 'company' as const
    }));

    losses.push({
      stage: '3. Стажування (Не склали випробування)',
      count: internItems.reduce((acc, i) => acc + i.count, 0),
      items: internItems
    });

    return losses;
  }, [vacancyCandidates, vacancyInterviews, vacancyInterns]);

  // 8. Granular Stage Candidates Filter
  const granularFilteredCandidates = useMemo(() => {
    let list = vacancyCandidates;

    if (activeStageTab === 'inflow_hot') {
      list = list.filter(c => c.callType === 'Гарячий');
    } else if (activeStageTab === 'inflow_cold') {
      list = list.filter(c => c.callType === 'Холодний');
    } else if (activeStageTab === 'screening_passed') {
      list = list.filter(c => c.status !== 'Новий' && c.status !== 'Відхилено');
    } else if (activeStageTab === 'interviews_scheduled') {
      const scheduledIds = new Set(vacancyInterviews.filter(i => i.status === 'Заплановано').map(i => i.candidateId));
      list = list.filter(c => scheduledIds.has(c.id) || c.status === 'Співбесіда');
    } else if (activeStageTab === 'interviews_attended') {
      const attendedIds = new Set(vacancyInterviews.filter(i => i.status === 'Завершено').map(i => i.candidateId));
      list = list.filter(c => attendedIds.has(c.id) || c.status === 'Співбесіда' || c.status === 'Стажування');
    } else if (activeStageTab === 'interviews_passed') {
      const passedIds = new Set(vacancyInterviews.filter(i => i.result === 'Співбесіда пройшла успішно' || i.result === 'Перейшов на стажування').map(i => i.candidateId));
      list = list.filter(c => passedIds.has(c.id) || c.status === 'Стажування');
    } else if (activeStageTab === 'interns_started') {
      const internCandIds = new Set(vacancyInterns.map(i => i.candidateId).filter(Boolean));
      const internCandNames = new Set(vacancyInterns.map(i => (i.candidateName || '').trim().toLowerCase()).filter(Boolean));
      list = list.filter(c => 
        internCandIds.has(c.id) || 
        internCandNames.has((c.name || '').trim().toLowerCase()) || 
        c.status === 'Стажування' || 
        isCandidateHired(c)
      );
    } else if (activeStageTab === 'interns_completed' || activeStageTab === 'hired') {
      const completedCandIds = new Set(vacancyInterns.filter(isInternCompleted).map(i => i.candidateId).filter(Boolean));
      const completedCandNames = new Set(vacancyInterns.filter(isInternCompleted).map(i => (i.candidateName || '').trim().toLowerCase()).filter(Boolean));
      list = list.filter(c => 
        completedCandIds.has(c.id) || 
        completedCandNames.has((c.name || '').trim().toLowerCase()) || 
        isCandidateHired(c)
      );
    } else if (activeStageTab === 'rejected') {
      list = list.filter(c => c.status === 'Відхилено');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.comment && c.comment.toLowerCase().includes(q)) ||
        (c.sourceDetails && c.sourceDetails.toLowerCase().includes(q)) ||
        (c.source && c.source.toLowerCase().includes(q))
      );
    }

    return list;
  }, [vacancyCandidates, vacancyInterviews, vacancyInterns, activeStageTab, searchQuery]);

  if (!isOpen || !vacancy) return null;

  const currentPriority = getNormalizedPriority(vacancy.priority);
  const pConfig = PRIORITY_CONFIG[currentPriority] || PRIORITY_CONFIG['Звичайна'];

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-fade-in no-print"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-6xl w-full p-5 sm:p-7 relative max-h-[94vh] overflow-y-auto space-y-6 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start space-x-3">
            <div className="p-3 bg-teal-50 text-teal-700 rounded-2xl shrink-0 border border-teal-100">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                  Глибока воронка рекрутингу: {vacancy.title}
                </h3>
                <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${pConfig.badgeClass}`}>
                  <span>{pConfig.icon}</span>
                  <span>{pConfig.label}</span>
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  vacancy.status === 'Активна' 
                    ? 'bg-teal-50 text-teal-700 border border-teal-200' 
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {vacancy.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>🏢 {vacancy.department}</span>
                <span>📅 Відкрито: {formatDate(vacancy.createdAt)} ({funnelMetrics.daysOpen} дн.)</span>
                {vacancy.salary && <span>💰 ЗП: {vacancy.salary}</span>}
                <span>⏱️ Середній контакт: {funnelMetrics.avgDaysToContact} дн.</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Надрукувати детальний звіт воронки"
            >
              <Printer className="h-4 w-4 text-slate-500" />
              <span>Друк аналізу</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Закрити"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Top Granular Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {/* Card 1: Applications */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center">
              <Users className="h-3.5 w-3.5 mr-1 text-teal-700" /> Заявки
            </span>
            <div className="text-xl font-black text-slate-800">{funnelMetrics.totalApplications}</div>
            <p className="text-[10px] text-slate-500 font-semibold">
              🔥 {funnelMetrics.hotApplications} | ❄️ {funnelMetrics.coldApplications}
            </p>
          </div>

          {/* Card 2: Contacts */}
          <div className="bg-teal-50/60 p-3 rounded-2xl border border-teal-100 space-y-1">
            <span className="text-[10px] font-black text-teal-800 uppercase tracking-wider flex items-center">
              <Phone className="h-3.5 w-3.5 mr-1 text-teal-600" /> Повідомлення
            </span>
            <div className="text-xl font-black text-teal-900">{funnelMetrics.totalContacted}</div>
            <p className="text-[10px] text-teal-700 font-bold">{funnelMetrics.appToContactConv}% зв'язок</p>
          </div>

          {/* Card 3: Interviews */}
          <div className="bg-sky-50/60 p-3 rounded-2xl border border-sky-100 space-y-1">
            <span className="text-[10px] font-black text-sky-800 uppercase tracking-wider flex items-center">
              <Calendar className="h-3.5 w-3.5 mr-1 text-sky-600" /> Співбесіди
            </span>
            <div className="text-xl font-black text-sky-900">{funnelMetrics.completedInterviews}</div>
            <p className="text-[10px] text-sky-700 font-bold">Явка: {funnelMetrics.showUpRate}%</p>
          </div>

          {/* Card 4: Qualified */}
          <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-100 space-y-1">
            <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider flex items-center">
              <Target className="h-3.5 w-3.5 mr-1 text-amber-600" /> Успіх інтерв'ю
            </span>
            <div className="text-xl font-black text-amber-900">{funnelMetrics.successfulInterviews}</div>
            <p className="text-[10px] text-amber-700 font-bold">{funnelMetrics.interviewPassRate}% пройшли</p>
          </div>

          {/* Card 5: Internships */}
          <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-100 space-y-1">
            <span className="text-[10px] font-black text-indigo-800 uppercase tracking-wider flex items-center">
              <GraduationCap className="h-3.5 w-3.5 mr-1 text-indigo-600" /> Стажування
            </span>
            <div className="text-xl font-black text-indigo-900">{funnelMetrics.totalInterns}</div>
            <p className="text-[10px] text-indigo-700 font-bold">{funnelMetrics.completedInterns} здали ({funnelMetrics.internCompletionRate}%)</p>
          </div>

          {/* Card 6: Hired */}
          <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200 space-y-1">
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" /> У штаті (Найм)
            </span>
            <div className="text-xl font-black text-emerald-900">{funnelMetrics.totalHired}</div>
            <p className="text-[10px] text-emerald-700 font-extrabold">{funnelMetrics.overallConv}% наскрізна</p>
          </div>
        </div>

        {/* Bottleneck Alerts Section */}
        {funnelMetrics.bottlenecks.length > 0 && (
          <div className="space-y-2">
            {funnelMetrics.bottlenecks.map((item, idx) => (
              <div 
                key={idx}
                className={`p-3.5 rounded-2xl border flex items-start space-x-3 text-xs ${
                  item.severity === 'danger' 
                    ? 'bg-rose-50/80 border-rose-200 text-rose-900' 
                    : item.severity === 'warning'
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="p-1 rounded-lg shrink-0 mt-0.5">
                  {item.severity === 'danger' ? (
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                  ) : item.severity === 'warning' ? (
                    <Zap className="h-4 w-4 text-amber-600" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                  )}
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="font-extrabold flex items-center gap-2">
                    <span>{item.title}</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full font-bold uppercase tracking-wider bg-white/70 border border-current/20">
                      {item.severity === 'danger' ? 'Критично' : item.severity === 'warning' ? 'Зверніть увагу' : 'Оптимально'}
                    </span>
                  </div>
                  <p className="font-medium opacity-90">{item.desc}</p>
                  <p className="text-[11px] font-bold opacity-80 pt-0.5">{item.tip}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Depth Mode Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
          <button
            onClick={() => setViewDepthMode('deep_8_stages')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              viewDepthMode === 'deep_8_stages'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>8-етапна поглиблена воронка</span>
          </button>

          <button
            onClick={() => setViewDepthMode('step_analysis')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              viewDepthMode === 'step_analysis'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Percent className="h-3.5 w-3.5" />
            <span>Матриця переходів і втрат (Drop-off)</span>
          </button>

          <button
            onClick={() => setViewDepthMode('sources_matrix')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              viewDepthMode === 'sources_matrix'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <PieIcon className="h-3.5 w-3.5" />
            <span>Воронка за джерелами</span>
          </button>

          <button
            onClick={() => setViewDepthMode('losses_breakdown')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              viewDepthMode === 'losses_breakdown'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>Аналітика відмов по етапах</span>
          </button>
        </div>

        {/* View Mode 1: 8 Deep Stages Visual Pipeline */}
        {viewDepthMode === 'deep_8_stages' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center space-x-2">
                <Layers className="h-4 w-4 text-teal-700" />
                <span>Наскрізний потік кандидатів за 8 етапами</span>
              </h4>
              <span className="text-xs bg-teal-50 text-teal-800 font-extrabold px-3 py-1 rounded-xl border border-teal-100">
                Загальна конверсія: {funnelMetrics.overallConv}%
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              {deepFunnelStages.map((stage) => {
                const isSelected = activeStageTab === stage.stageKey;
                return (
                  <div
                    key={stage.id}
                    onClick={() => setActiveStageTab(stage.stageKey)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-teal-500 bg-teal-50/20 shadow-xs ring-2 ring-teal-500/15' 
                        : 'border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs mb-2">
                      <div className="flex items-center space-x-2.5">
                        <span className={`h-6 w-6 rounded-lg ${stage.colorBg} text-white font-black text-xs flex items-center justify-center shrink-0`}>
                          {stage.stepNum}
                        </span>
                        <div>
                          <div className="font-extrabold text-slate-800 text-sm">{stage.title}</div>
                          <div className="text-[11px] text-slate-400 font-medium">{stage.subtitle}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Sub-breakdowns chips */}
                        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 text-[11px]">
                          {stage.subStats.map((sub, i) => (
                            <span key={i} className="flex items-center space-x-1">
                              <span className="text-slate-400 font-medium">{sub.label}:</span>
                              <strong className={sub.color}>{sub.value}</strong>
                              {i < stage.subStats.length - 1 && <span className="text-slate-300">|</span>}
                            </span>
                          ))}
                        </div>

                        <span className={`font-black text-sm ${stage.colorText}`}>
                          {stage.count} осіб
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${stage.colorLightBg} ${stage.colorText} border ${stage.borderColor}`}>
                          {stage.stepConv} {stage.convLabel}
                        </span>
                      </div>
                    </div>

                    {/* Funnel Stage Bar */}
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className={`${stage.colorBg} h-full rounded-full transition-all duration-500 ease-out`}
                        style={{ width: `${stage.barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* View Mode 2: Step-by-Step Conversion & Drop-off Table */}
        {viewDepthMode === 'step_analysis' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center space-x-2">
                <Percent className="h-4 w-4 text-teal-700" />
                <span>Матриця коефіцієнтів конверсії та точок відсіву (Drop-off Analysis)</span>
              </h4>
              <span className="text-xs text-slate-400 font-bold">Аналіз втрат на кожному кроці</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-wider bg-slate-50">
                    <th className="py-2.5 px-3">Крок</th>
                    <th className="py-2.5 px-3">Етап воронки</th>
                    <th className="py-2.5 px-3 text-center">Кількість (осіб)</th>
                    <th className="py-2.5 px-3 text-center">Конверсія від старту (% of Total)</th>
                    <th className="py-2.5 px-3 text-center">Перехід з попереднього кроку (% Step-to-Step)</th>
                    <th className="py-2.5 px-3 text-center text-rose-700">Відсів / Втрати (Drop-off)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {deepFunnelStages.map((st, idx) => {
                    const prevCount = idx === 0 ? st.count : deepFunnelStages[idx - 1].count;
                    const stepDrop = Math.max(0, prevCount - st.count);
                    const dropPct = prevCount > 0 ? Math.round((stepDrop / prevCount) * 100) : 0;
                    const pctOfTotal = funnelMetrics.totalApplications > 0 ? Math.round((st.count / funnelMetrics.totalApplications) * 100) : 0;

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-400">#{st.stepNum}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800">{st.title}</div>
                          <div className="text-[11px] text-slate-400">{st.subtitle}</div>
                        </td>
                        <td className="py-3 px-3 text-center font-black text-slate-800 text-sm">
                          {st.count}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                            {pctOfTotal}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                            {st.stepConv}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {idx === 0 ? (
                            <span className="text-slate-400 font-semibold">-</span>
                          ) : stepDrop > 0 ? (
                            <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                              -{stepDrop} осіб ({dropPct}%)
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                              0% втрат 👍
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View Mode 3: Source Conversion Matrix */}
        {viewDepthMode === 'sources_matrix' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center space-x-2">
                <PieIcon className="h-4 w-4 text-teal-700" />
                <span>Наскрізна результативність каналів залучення (ROI джерел)</span>
              </h4>
              <span className="text-xs text-slate-400 font-bold">Якість лідів по кожному сайту/каналу</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-wider bg-slate-50">
                    <th className="py-2.5 px-3">Джерело</th>
                    <th className="py-2.5 px-3 text-center">Заявки (Всього)</th>
                    <th className="py-2.5 px-3 text-center">Гарячі / Холодні</th>
                    <th className="py-2.5 px-3 text-center">Співбесіди</th>
                    <th className="py-2.5 px-3 text-center">Стажування</th>
                    <th className="py-2.5 px-3 text-center text-emerald-800">Найм</th>
                    <th className="py-2.5 px-3 text-center">Оцінка лідів</th>
                    <th className="py-2.5 px-3 text-right">Конверсія в найм</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {deepSourceMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-6 text-slate-400 text-xs">
                        Немає даних про джерела
                      </td>
                    </tr>
                  ) : (
                    deepSourceMatrix.map((item) => {
                      const color = SOURCE_COLORS[item.source] || '#64748b';
                      return (
                        <tr key={item.source} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span 
                                className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold text-white uppercase tracking-wider"
                                style={{ backgroundColor: color }}
                              >
                                {item.source}
                              </span>
                              {item.details && item.details.length > 0 && (
                                <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded px-1.5 py-0.5 font-medium" title={item.details.join(', ')}>
                                  📌 {Array.from(new Set(item.details)).slice(0, 2).join(', ')}{new Set(item.details).size > 2 ? '...' : ''}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-800">{item.total}</td>
                          <td className="py-3 px-3 text-center text-[11px] text-slate-500 font-semibold">
                            🔥 {item.hot} | ❄️ {item.cold}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-sky-800">{item.interviews}</td>
                          <td className="py-3 px-3 text-center font-bold text-indigo-800">{item.interns}</td>
                          <td className="py-3 px-3 text-center font-black text-emerald-800 text-sm">{item.hired}</td>
                          <td className="py-3 px-3 text-center font-bold text-amber-500">
                            ★ {item.avgRating}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                              item.convToHire >= 20 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              item.convToHire >= 10 ? 'bg-teal-50 text-teal-800 border-teal-200' :
                              'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {item.convToHire}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View Mode 4: Stage-by-Stage Loss Breakdown */}
        {viewDepthMode === 'losses_breakdown' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center space-x-2 text-rose-800">
                <XCircle className="h-4 w-4 text-rose-600" />
                <span>Глибока структуризація причин відмов за етапами (Loss Analysis)</span>
              </h4>
              <span className="text-xs bg-rose-50 text-rose-700 font-extrabold px-3 py-1 rounded-xl border border-rose-100">
                Всього втрачено: {funnelMetrics.totalRejected} осіб
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stageLossesBreakdown.map((stageLoss, i) => (
                <div key={i} className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-bold text-slate-800 text-xs">{stageLoss.stage}</span>
                    <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                      {stageLoss.count} осіб
                    </span>
                  </div>

                  {stageLoss.items.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3 text-center">Втрат на цьому етапі немає 👍</p>
                  ) : (
                    <div className="space-y-2">
                      {stageLoss.items.map((it, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                          <div className="flex justify-between font-bold text-slate-700">
                            <span className="truncate max-w-[180px]">{it.reason}</span>
                            <span className="text-rose-600 font-bold">{it.count}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            Ініціатор: {it.by === 'candidate' ? '👤 Кандидат' : '🏢 Компанія'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Granular Candidates Explorer (For every specific micro-stage) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center">
                <Users className="h-4 w-4 mr-1.5 text-teal-700" />
                <span>Кандидати за обраним етапом ({granularFilteredCandidates.length})</span>
              </h4>
              <p className="text-xs text-slate-400 font-medium">Переглядайте точний список кандидатів на кожній стадії воронки</p>
            </div>

            {/* Granular Filter Buttons */}
            <div className="flex flex-wrap gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100 max-w-full overflow-x-auto">
              {[
                { id: 'all', label: `Всі (${vacancyCandidates.length})` },
                { id: 'inflow_hot', label: `🔥 Гарячі (${funnelMetrics.hotApplications})` },
                { id: 'inflow_cold', label: `❄️ Холодні (${funnelMetrics.coldApplications})` },
                { id: 'screening_passed', label: `Повідомлення (${funnelMetrics.totalContacted})` },
                { id: 'interviews_attended', label: `Співбесіди (${funnelMetrics.completedInterviews})` },
                { id: 'interviews_passed', label: `Офер (${funnelMetrics.successfulInterviews})` },
                { id: 'interns_started', label: `Стажери (${funnelMetrics.totalInterns})` },
                { id: 'hired', label: `Найм (${funnelMetrics.totalHired})` },
                { id: 'rejected', label: `Відхилені (${funnelMetrics.totalRejected})` }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveStageTab(tab.id as GranularStageKey)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                    activeStageTab === tab.id
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук кандидатів за ПІБ, телефоном, коментарем або джерелом..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition"
            />
          </div>

          {/* Candidates List Table */}
          <div className="overflow-x-auto">
            {granularFilteredCandidates.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                Немає кандидатів на цьому етапі або за заданим пошуком
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-extrabold text-[10px]">
                    <th className="py-2.5 px-3">Кандидат / ПІБ</th>
                    <th className="py-2.5 px-3">Телефон</th>
                    <th className="py-2.5 px-3">Джерело & Тип</th>
                    <th className="py-2.5 px-3">Статус у воронці</th>
                    <th className="py-2.5 px-3">Оцінка</th>
                    <th className="py-2.5 px-3">Дата контакту</th>
                    <th className="py-2.5 px-3 text-right">Дія</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium">
                  {granularFilteredCandidates.map((cand) => (
                    <tr key={cand.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800">{cand.name}</div>
                        {cand.comment && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">{cand.comment}</div>
                        )}
                        {cand.rejectionReason && (
                          <div className="text-[10px] text-rose-600 font-semibold truncate max-w-xs">
                            Причина: {cand.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                        {cand.phone}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 capitalize">
                            {cand.source || 'інше'}
                          </span>
                          {cand.sourceDetails && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded px-1.5 py-0.2 font-bold whitespace-nowrap" title={`Уточнення: ${cand.sourceDetails}`}>
                              📌 {cand.sourceDetails}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold ${cand.callType === 'Гарячий' ? 'text-rose-600' : 'text-sky-600'}`}>
                            {cand.callType === 'Гарячий' ? '🔥' : '❄️'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          cand.status === 'Стажування' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          cand.status === 'Співбесіда' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                          cand.status === 'Відхилено' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-teal-50 text-teal-700 border border-teal-200'
                        }`}>
                          {cand.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-amber-500">{'★'.repeat(cand.rating || 3)}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {formatDate(cand.contactDate || cand.appliedAt)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {onViewPersonalFile && (
                          <button
                            onClick={() => {
                              onViewPersonalFile(cand.id);
                              onClose();
                            }}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-700 hover:text-white text-teal-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                          >
                            Особова справа
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pt-3 border-t border-slate-100 text-xs text-slate-400">
          <div>
            Поглиблена воронка синхронізована з усіма етапами підбору за посадою <strong>"{vacancy.title}"</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer self-end sm:self-auto"
          >
            Закрити
          </button>
        </div>
      </div>

      <IframePrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
      />
    </div>
  );
}
