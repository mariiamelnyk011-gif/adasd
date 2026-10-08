import React, { useState, useMemo } from 'react';
import { Interview, Candidate, Vacancy, Intern, CandidateStatus } from '../types';
import { formatDateTime, getTodayDateString, getTodayDateTimeString, formatDate, calculateAge } from '../lib/dateUtils';
import { 
  Phone, 
  MessageSquare, 
  Send, 
  Copy, 
  Check, 
  Star, 
  Clock, 
  Briefcase, 
  MapPin, 
  User, 
  AlertTriangle, 
  CheckCircle2, 
  PhoneCall, 
  PhoneMissed, 
  PhoneForwarded, 
  Calendar, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Search, 
  GraduationCap, 
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Edit3,
  Plus,
  X,
  Eye
} from 'lucide-react';
import { CvPreviewModal } from './CvPreviewModal';

interface InterviewsFeedbackViewProps {
  interviews: Interview[];
  candidates: Candidate[];
  vacancies: Vacancy[];
  onUpdateInterview: (interview: Interview) => void;
  onUpdateCandidate?: (candidate: Candidate) => void;
  onViewPersonalFile?: (candidateId: string) => void;
  onAddIntern?: (intern: Omit<Intern, 'id'>) => void;
}

type FeedbackTabFilter = 'pending' | 'given' | 'all';
type ResultFilter = 'all' | 'success' | 'reserve' | 'rejected' | 'pending';

export default function InterviewsFeedbackView({
  interviews,
  candidates,
  vacancies,
  onUpdateInterview,
  onUpdateCandidate,
  onViewPersonalFile,
  onAddIntern
}: InterviewsFeedbackViewProps) {
  const [activeTab, setActiveTab] = useState<FeedbackTabFilter>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  
  // State for active candidate being interacted with (card expanding message templates or feedback form)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [selectedTemplateType, setSelectedTemplateType] = useState<Record<string, string>>({});
  const [customMessages, setCustomMessages] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Feedback action form state per interview
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [feedbackChannel, setFeedbackChannel] = useState<'Телефон' | 'Viber' | 'Telegram' | 'WhatsApp' | 'SMS' | 'Email' | 'Інше'>('Телефон');
  const [feedbackOutcome, setFeedbackOutcome] = useState<string>('Запрошено на стажування');
  const [feedbackNotes, setFeedbackNotes] = useState<string>('');

  // Quick intern creation modal state
  const [internCandidate, setInternCandidate] = useState<{ cand: Candidate; interview: Interview; vacancy?: Vacancy } | null>(null);
  const [internStartDate, setInternStartDate] = useState(getTodayDateString());
  const [internMentor, setInternMentor] = useState('HR Менеджер');

  // State for modal to manually assign 'Зворотний зв'язок' status to other candidates
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [showOtherInterviews, setShowOtherInterviews] = useState(false);
  const [previewCv, setPreviewCv] = useState<{ candidateName: string; fileName?: string; fileContent?: string; cvLink?: string } | null>(null);

  // Helper to check if interview or candidate has feedback status
  const hasFeedbackStatus = (i: Interview): boolean => {
    if (i.status === 'Скасовано') return false;
    const s = (i.status || '').toLowerCase();
    const r = (i.result || '').toLowerCase();
    const c = candidates.find(cand => cand.id === i.candidateId);
    const cs = (c?.status || '').toLowerCase();

    return (
      s.includes('зворотн') ||
      s.includes('фідбек') ||
      r.includes('зворотн') ||
      r.includes('фідбек') ||
      cs.includes('зворотн') ||
      cs.includes('фідбек')
    );
  };

  // Other completed/past interviews that don't have the status yet
  const otherCompletedCount = useMemo(() => {
    return interviews.filter(i => {
      if (i.status === 'Скасовано') return false;
      if (hasFeedbackStatus(i) || i.feedbackGiven) return false;
      const isCompleted = i.status === 'Завершено';
      const isPast = i.dateTime && new Date(i.dateTime) <= new Date();
      const hasOutcome = i.result && i.result !== 'Очікує рішення';
      return isCompleted || isPast || hasOutcome;
    }).length;
  }, [interviews, candidates]);

  // Candidates who can be assigned the status
  const unassignedInterviews = useMemo(() => {
    return interviews.filter(i => {
      if (i.status === 'Скасовано') return false;
      if (hasFeedbackStatus(i)) return false;
      return true;
    }).sort((a, b) => (b.dateTime || '').localeCompare(a.dateTime || ''));
  }, [interviews, candidates]);

  // Filter candidates: strictly those who have the feedback status set (or given feedback archive, or other if toggled)
  const eligibleInterviews = useMemo(() => {
    return interviews.filter(i => {
      if (i.status === 'Скасовано') return false;
      
      // 1. Strictly candidates who have this status set
      if (hasFeedbackStatus(i)) return true;

      // 2. Previously given feedback (available in the given archive tab)
      if (i.feedbackGiven) return true;

      // 3. If the user explicitly toggled to view other conducted interviews
      if (showOtherInterviews) {
        const isCompleted = i.status === 'Завершено';
        const isPast = i.dateTime && new Date(i.dateTime) <= new Date();
        const hasOutcome = i.result && i.result !== 'Очікує рішення';
        return isCompleted || isPast || hasOutcome;
      }

      return false;
    });
  }, [interviews, candidates, showOtherInterviews]);

  const pendingCount = useMemo(() => {
    return interviews.filter(i => hasFeedbackStatus(i) && !i.feedbackGiven).length;
  }, [interviews, candidates]);

  const givenCount = useMemo(() => {
    return interviews.filter(i => !!i.feedbackGiven).length;
  }, [interviews]);

  const filteredInterviews = useMemo(() => {
    return eligibleInterviews.filter(interview => {
      // 1. Tab filter
      if (activeTab === 'pending') {
        if (interview.feedbackGiven) return false;
        if (!hasFeedbackStatus(interview) && !showOtherInterviews) return false;
      }
      if (activeTab === 'given' && !interview.feedbackGiven) return false;

      // 2. Result filter
      const resLower = (interview.result || '').toLowerCase();
      if (resultFilter === 'success') {
        const isSuccess = resLower.includes('успіш') || resLower.includes('стажуван');
        if (!isSuccess) return false;
      } else if (resultFilter === 'reserve') {
        if (!resLower.includes('резерв')) return false;
      } else if (resultFilter === 'rejected') {
        const isReject = resLower.includes('відмов') || interview.status === 'Не прийшов';
        if (!isReject) return false;
      } else if (resultFilter === 'pending') {
        const isPending = interview.result === 'Очікує рішення' || resLower.includes('очікує') || resLower.includes('подумає');
        if (!isPending) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const cand = candidates.find(c => c.id === interview.candidateId);
        const nameMatch = interview.candidateName.toLowerCase().includes(query);
        const phoneMatch = cand?.phone ? cand.phone.includes(query) : false;
        if (!nameMatch && !phoneMatch) return false;
      }

      return true;
    });
  }, [eligibleInterviews, activeTab, resultFilter, searchQuery, candidates, showOtherInterviews]);

  // Clean phone number for tel/viber/tg/wa
  const getCleanPhone = (phone: string): string => {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length === 10) {
      digits = '38' + digits;
    }
    return digits;
  };

  const getViberLink = (phone: string): string => {
    const digits = getCleanPhone(phone);
    return `viber://chat?number=%2B${digits}`;
  };

  const getTelegramLink = (phone: string): string => {
    const digits = getCleanPhone(phone);
    return `https://t.me/+${digits}`;
  };

  const getWhatsAppLink = (phone: string, text: string = ''): string => {
    const digits = getCleanPhone(phone);
    const encoded = encodeURIComponent(text);
    return `https://wa.me/${digits}${text ? `?text=${encoded}` : ''}`;
  };

  // Generate pre-populated message template
  const getTemplateMessage = (type: string, candName: string, vacancyTitle: string): string => {
    const firstName = candName.split(' ')[1] || candName.split(' ')[0] || candName;
    const vac = vacancyTitle || 'нашу вакансію';

    switch (type) {
      case 'manager':
        return `Вітаємо, ${firstName}! За результатами першої співбесіди на посаду «${vac}» раді повідомити, що ви успішно пройшли початковий етап! Запрошуємо вас на наступну співбесіду з керівником. Підкажіть, будь ласка, який час найближчими днями для вас буде найзручнішим?`;

      case 'offer':
        return `Вітаємо, ${firstName}! За результатами співбесіди на посаду «${vac}» раді повідомити, що ми успішно погодили вашу кандидатуру та запрошуємо вас на стажування! Коли вам буде зручно поспілкуватися щодо першого робочого дня?`;
      
      case 'reserve':
        return `Доброго дня, ${firstName}! Щиро дякуємо за ваш час та змістовну співбесіду на посаду «${vac}». Наразі ми зупинилися на іншому кандидатові, проте ваші навички справили гарне враження, і ми внесли ваші контакти до нашого кадрового резерву. Якщо відкриється нова позиція — зв'яжемося з вами першочергово!`;

      case 'rejected':
        return `Доброго дня, ${firstName}! Дякуємо за знайомство та участь у співбесіді на посаду «${vac}». На жаль, наразі ми обрали кандидата з більш релевантним досвідом для цього етапу. Бажаємо вам успіхів у пошуку роботи та професійного розвитку!`;

      case 'waiting':
        return `Доброго дня, ${firstName}! Дякуємо за приділений час на співбесіді на посаду «${vac}». Ми завершуємо розгляд усіх кандидатів і повернемося до вас із фінальним рішенням найближчим часом. Гарного дня!`;

      case 'missed_call':
        return `Доброго дня, ${firstName}! Намагалися зателефонувати вам щодо результатів співбесіди на посаду «${vac}». Будь ласка, зателефонуйте або напишіть, коли вам буде зручно поспілкуватися. Дякуємо!`;

      default:
        return `Доброго дня, ${firstName}! Звертаємося до вас щодо результатів співбесіди на посаду «${vac}».`;
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2500);
  };

  const handleStartFeedback = (interview: Interview) => {
    setEditingFeedbackId(interview.id);
    setFeedbackChannel(interview.feedbackChannel || 'Телефон');
    
    // Suggest outcome based on interview result
    const resLower = (interview.result || '').toLowerCase();
    if (resLower.includes('керівник')) {
      setFeedbackOutcome(interview.feedbackOutcome || 'Запрошено на співбесіду до керівника');
    } else if (resLower.includes('успіш') || resLower.includes('стажуван')) {
      setFeedbackOutcome(interview.feedbackOutcome || 'Запрошено на стажування');
    } else if (resLower.includes('резерв')) {
      setFeedbackOutcome(interview.feedbackOutcome || 'Повідомлено про кадровий резерв');
    } else if (resLower.includes('відмов')) {
      setFeedbackOutcome(interview.feedbackOutcome || 'Повідомлено про відмову');
    } else {
      setFeedbackOutcome(interview.feedbackOutcome || 'Запрошено на стажування');
    }
    
    setFeedbackNotes(interview.feedbackComment || '');
  };

  const handleSaveFeedback = (interview: Interview, markAsGiven: boolean = true) => {
    const isFeedbackStatus = (interview.status || '').toLowerCase().includes('зворотн');
    const updated: Interview = {
      ...interview,
      status: (markAsGiven && isFeedbackStatus) ? 'Завершено' : interview.status,
      result: feedbackOutcome === 'Запрошено на співбесіду до керівника' ? 'Співбесіда з керівником' : interview.result,
      feedbackGiven: markAsGiven,
      feedbackGivenAt: markAsGiven ? (interview.feedbackGivenAt || getTodayDateTimeString()) : undefined,
      feedbackChannel: feedbackChannel,
      feedbackOutcome: feedbackOutcome,
      feedbackComment: feedbackNotes.trim(),
      lastAttemptAt: getTodayDateTimeString(),
      feedbackAttempts: (interview.feedbackAttempts || 0) + 1
    };

    onUpdateInterview(updated);

    // Sync candidate status if appropriate
    if (onUpdateCandidate) {
      const cand = candidates.find(c => c.id === interview.candidateId);
      if (cand) {
        let newStatus: CandidateStatus = cand.status;
        if (feedbackOutcome === 'Запрошено на співбесіду до керівника') {
          newStatus = 'Співбесіда з керівником';
        } else if (feedbackOutcome === 'Запрошено на стажування') {
          newStatus = 'Стажування';
        } else if (feedbackOutcome === 'Повідомлено про відмову') {
          newStatus = 'Відмова компанії';
        } else if (feedbackOutcome === 'Повідомлено про кадровий резерв') {
          newStatus = 'Резерв';
        } else if (feedbackOutcome === 'Кандидат думає') {
          newStatus = 'Подумає';
        }

        if (newStatus !== cand.status || feedbackNotes.trim()) {
          onUpdateCandidate({
            ...cand,
            status: newStatus,
            comment: feedbackNotes.trim() 
              ? `${cand.comment ? cand.comment + ' | ' : ''}Зворотний зв'язок: ${feedbackNotes.trim()}`
              : cand.comment
          });
        }
      }
    }

    setEditingFeedbackId(null);
  };

  const handleRecordMissedCall = (interview: Interview) => {
    const updated: Interview = {
      ...interview,
      feedbackAttempts: (interview.feedbackAttempts || 0) + 1,
      lastAttemptAt: getTodayDateTimeString(),
      feedbackChannel: 'Телефон',
      feedbackOutcome: 'Не бере слухавку / Не відповів'
    };
    onUpdateInterview(updated);
  };

  const handleOpenAddIntern = (cand: Candidate, interview: Interview, vac?: Vacancy) => {
    setInternCandidate({ cand, interview, vacancy: vac });
    setInternStartDate(getTodayDateString());
    setInternMentor(interview.interviewer || 'HR Менеджер');
  };

  const handleConfirmAddIntern = () => {
    if (!internCandidate || !onAddIntern) return;
    const { cand, vacancy } = internCandidate;

    onAddIntern({
      candidateId: cand.id,
      candidateName: cand.name,
      birthDate: cand.birthDate || '',
      phone: cand.phone || '',
      position: vacancy?.title || 'Спеціаліст',
      department: vacancy?.department || 'Відділ',
      startDate: internStartDate,
      endDate: '',
      mentor: internMentor.trim() || 'HR Менеджер',
      project: 'Програма стажування та онбордингу',
      progress: 10,
      status: 'Триває',
      rating: cand.rating || 4,
      comment: 'Зараховано за результатами зворотного зв\'язку після співбесіди'
    });

    // Also mark candidate as 'Стажування'
    if (onUpdateCandidate) {
      onUpdateCandidate({
        ...cand,
        status: 'Стажування'
      });
    }

    setInternCandidate(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Strategy Summary */}
      <div className="bg-gradient-to-r from-teal-800 to-slate-800 text-white p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-teal-600/60 rounded-lg">
                <PhoneCall className="h-5 w-5 text-teal-200" />
              </span>
              <h3 className="text-base font-bold text-white">
                Надати зворотний зв'язок кандидатам
              </h3>
            </div>
            <p className="text-xs text-teal-100/80 max-w-xl">
              Зручний кабінет для надання відповіді кандидатам після співбесіди: дзвінки в 1 клік, готові шаблони для Viber, Telegram, WhatsApp та фіксація результату розмови.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(true)}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
              title="Обрати кандидата та встановити статус «Зворотний зв'язок»"
            >
              <Plus className="h-4 w-4" />
              <span>Додати кандидата на зв'язок</span>
            </button>
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 px-3.5 py-2 rounded-xl text-center">
              <p className="text-[10px] uppercase font-bold text-teal-200">Очікують відповіді</p>
              <p className="text-lg font-extrabold text-amber-300">{pendingCount}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 px-3.5 py-2 rounded-xl text-center">
              <p className="text-[10px] uppercase font-bold text-teal-200">Повідомлено</p>
              <p className="text-lg font-extrabold text-emerald-300">{givenCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Sub-tabs & Quick Result Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer shrink-0 ${
                activeTab === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>🔔 Потрібно зв'язатися</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {pendingCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('given')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer shrink-0 ${
                activeTab === 'given'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>✅ Відповідь надано</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'given' ? 'bg-teal-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {givenCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer shrink-0 ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📋 Всі у черзі фідбеку</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {eligibleInterviews.length}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Пошук за ім'ям чи тел..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden text-slate-700 font-semibold placeholder-slate-400"
            />
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Outcome filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
          <span className="text-slate-400 mr-1 text-[10px] uppercase font-bold tracking-wider">Фільтр результату:</span>
          {[
            { id: 'all', label: 'Всі результати' },
            { id: 'success', label: '🎉 Офер / Успішно' },
            { id: 'reserve', label: '📦 Резерв' },
            { id: 'rejected', label: '❌ Відмова' },
            { id: 'pending', label: '⏳ Очікує рішення / Подумає' }
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setResultFilter(f.id as ResultFilter)}
              className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                resultFilter === f.id
                  ? 'bg-slate-800 text-white font-bold'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notice banner if other conducted interviews exist without this status */}
      {otherCompletedCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-amber-50/90 border border-amber-200/80 px-4 py-2.5 rounded-xl text-xs text-amber-900 gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              У цій вкладці відображаються тільки кандидати зі статусом <strong>«Зворотний зв'язок»</strong>. Є ще <strong>{otherCompletedCount}</strong> проведених співбесід без цього статусу.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowOtherInterviews(!showOtherInterviews)}
              className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 font-bold border border-amber-300 rounded-lg text-[11px] transition cursor-pointer"
            >
              {showOtherInterviews ? 'Приховати інші' : `Показати всі проведені (${otherCompletedCount})`}
            </button>
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(true)}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              <span>Призначити</span>
            </button>
          </div>
        </div>
      )}

      {/* Candidate List */}
      <div className="space-y-3">
        {filteredInterviews.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-slate-100 text-center space-y-3 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
              {activeTab === 'pending' ? <Phone className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7 text-emerald-600" />}
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <p className="text-base font-extrabold text-slate-800">
                {activeTab === 'pending'
                  ? 'Немає кандидатів зі статусом «Зворотний зв\'язок»'
                  : 'Кандидатів за заданими фільтрами не знайдено'}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                {activeTab === 'pending'
                  ? 'У цій вкладці відображаються тільки ті кандидати, яким виставлено статус або результат «Зворотний зв\'язок». Ви можете призначити цей статус у списку співбесід або натиснути кнопку нижче.'
                  : 'Спробуйте змінити фільтри або очистити пошуковий запит.'}
              </p>
            </div>
            {activeTab === 'pending' && (
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(true)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Виставити статус кандидату</span>
                </button>
                {otherCompletedCount > 0 && !showOtherInterviews && (
                  <button
                    type="button"
                    onClick={() => setShowOtherInterviews(true)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Показати всі проведені ({otherCompletedCount})</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          filteredInterviews.map((interview) => {
            const candidate = candidates.find(c => c.id === interview.candidateId);
            const vacancy = candidate ? vacancies.find(v => v.id === candidate.vacancyId) : null;
            const phone = candidate?.phone || '';
            const isCardExpanded = expandedCardId === interview.id;
            const isEditing = editingFeedbackId === interview.id;

            // Template configuration for this candidate
            const templateType = selectedTemplateType[interview.id] || (
              interview.result?.toLowerCase().includes('успіш') || interview.result?.toLowerCase().includes('стажуван')
                ? 'offer'
                : interview.result?.toLowerCase().includes('резерв')
                ? 'reserve'
                : interview.result?.toLowerCase().includes('відмов')
                ? 'rejected'
                : 'waiting'
            );

            const defaultMsg = getTemplateMessage(templateType, interview.candidateName, vacancy?.title || '');
            const activeMsg = customMessages[interview.id] !== undefined ? customMessages[interview.id] : defaultMsg;

            return (
              <div
                key={interview.id}
                id={`feedback-card-${interview.id}`}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                  interview.feedbackGiven
                    ? 'border-slate-200/80 hover:border-slate-300'
                    : 'border-amber-200/80 bg-gradient-to-b from-white to-amber-50/20'
                }`}
              >
                {/* Main Card Row */}
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Candidate Info Block */}
                    <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        interview.feedbackGiven
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : 'bg-amber-100/80 text-amber-800 border border-amber-200/80'
                      }`}>
                        {interview.candidateName.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h4 
                            onClick={() => onViewPersonalFile && onViewPersonalFile(interview.candidateId)}
                            className={`font-extrabold text-slate-900 text-base ${
                              onViewPersonalFile ? 'hover:text-teal-700 hover:underline cursor-pointer' : ''
                            }`}
                            title={onViewPersonalFile ? 'Відкрити особову справу' : ''}
                          >
                            {interview.candidateName}
                          </h4>

                          {/* Interview Result Badge */}
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            interview.result === 'Співбесіда пройшла успішно' || interview.result === 'Перейшов на стажування'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : interview.result === 'Резерв'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : (interview.result || '').toLowerCase().includes('відмов') || interview.status === 'Не прийшов'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {interview.result || 'Очікує рішення'}
                          </span>

                          {/* Status Зворотний зв'язок badge or button */}
                          {hasFeedbackStatus(interview) ? (
                            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                              <Phone className="h-3 w-3 text-amber-700" />
                              <span>Статус: Зворотний зв'язок</span>
                            </span>
                          ) : !interview.feedbackGiven ? (
                            <button
                              type="button"
                              onClick={() => onUpdateInterview({ ...interview, status: 'Зворотний зв\'язок' })}
                              className="px-2.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Встановити статус «Зворотний зв'язок»"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Призначити статус</span>
                            </button>
                          ) : null}

                          {hasFeedbackStatus(interview) && (
                            <button
                              type="button"
                              onClick={() => onUpdateInterview({ ...interview, status: 'Завершено' })}
                              className="text-[10px] text-slate-400 hover:text-rose-600 hover:underline cursor-pointer"
                              title="Зняти статус «Зворотний зв'язок»"
                            >
                              Зняти статус
                            </button>
                          )}

                          {/* Feedback status badge */}
                          {interview.feedbackGiven ? (
                            <span className="px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-teal-600" />
                              <span>Відповідь надано</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[10px] font-bold animate-pulse flex items-center gap-1">
                              <Clock className="h-3 w-3 text-amber-700" />
                              <span>Очікує дзвінка/повідомлення</span>
                            </span>
                          )}

                          {interview.feedbackAttempts && interview.feedbackAttempts > 0 && !interview.feedbackGiven && (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-bold">
                              Спроб: {interview.feedbackAttempts}
                            </span>
                          )}
                        </div>

                        {/* Vacancy and department */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {vacancy ? (
                            <>
                              <span className="inline-flex items-center text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                <Briefcase className="h-3 w-3 mr-1 text-slate-500" />
                                {vacancy.title}
                              </span>
                              <span className="inline-flex items-center text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                                <MapPin className="h-3 w-3 mr-1 text-slate-400" />
                                {vacancy.department}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">Посада не вказана</span>
                          )}

                          <span className="text-xs text-slate-400 font-medium flex items-center">
                            <Clock className="h-3 w-3 mr-1 text-slate-300" />
                            Співбесіда: {formatDateTime(interview.dateTime)} ({interview.interviewer})
                          </span>

                          {candidate?.birthDate && (
                            <span className="text-xs text-slate-500 font-semibold flex items-center">
                              <Calendar className="h-3 w-3 mr-1 text-slate-400" />
                              <span>ДН: {formatDate(candidate.birthDate)}</span>
                              {calculateAge(candidate.birthDate) !== null && (
                                <span className="ml-1 text-slate-400">({calculateAge(candidate.birthDate)} р.)</span>
                              )}
                            </span>
                          )}

                          {interview.rating > 0 && (
                            <div className="flex items-center space-x-0.5 ml-1">
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star
                                  key={star}
                                  className={`h-3 w-3 ${
                                    star <= interview.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Interview notes / feedback quote */}
                        {interview.feedback && (
                          <div className="mt-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-700">
                            <span className="font-bold text-slate-800">Нотатка зі співбесіди:</span>{' '}
                            <span className="italic">«{interview.feedback}»</span>
                          </div>
                        )}

                        {/* Rejection reason if applicable */}
                        {interview.rejectionReason && (
                          <div className="mt-1.5 text-xs text-rose-700 bg-rose-50/70 border border-rose-100 px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                            <span>Причина відхилення: <strong>{interview.rejectionReason}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Direct Contact Action Panel (Phone, Viber, Telegram, WhatsApp) */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2 shrink-0 border-t lg:border-0 pt-3 lg:pt-0 border-slate-100">
                      {/* Phone link / quick call */}
                      {phone ? (
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <a
                            href={`tel:${phone}`}
                            className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-98"
                            title="Подзвонити кандидату"
                          >
                            <Phone className="h-4 w-4" />
                            <span>{phone}</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleCopyText(phone, `phone-${interview.id}`)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer shrink-0"
                            title="Скопіювати номер"
                          >
                            {copiedId === `phone-${interview.id}` ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Телефон відсутній</span>
                      )}

                      {/* Messengers buttons */}
                      {phone && (
                        <div className="flex items-center gap-1.5 w-full justify-between sm:justify-start">
                          <a
                            href={getViberLink(phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/60 rounded-xl text-[11px] font-bold transition"
                            title="Написати у Viber"
                          >
                            <MessageSquare className="h-3 w-3" />
                            <span>Viber</span>
                          </a>

                          <a
                            href={getTelegramLink(phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1 px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/60 rounded-xl text-[11px] font-bold transition"
                            title="Написати у Telegram"
                          >
                            <Send className="h-3 w-3" />
                            <span>Telegram</span>
                          </a>

                          <a
                            href={getWhatsAppLink(phone, activeMsg)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 rounded-xl text-[11px] font-bold transition"
                            title="Написати у WhatsApp"
                          >
                            <PhoneForwarded className="h-3 w-3" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      )}

                      {/* CV and Personal File actions identical to CandidatesManager & InternsManager */}
                      <div className="flex items-center gap-1.5 w-full flex-wrap justify-end pt-1">
                        {(candidate?.cvFileContent || candidate?.cvLink) && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewCv({
                                candidateName: candidate.name,
                                fileName: candidate.cvFileName || (candidate.cvLink ? 'Посилання на резюме' : 'Резюме.pdf'),
                                fileContent: candidate.cvFileContent,
                                cvLink: candidate.cvLink
                              });
                            }}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer"
                          >
                            <Eye className="h-3 w-3 text-teal-600" />
                            <span>Перегляд CV</span>
                          </button>
                        )}
                        {candidate?.cvFileContent && (
                          <a
                            href={candidate.cvFileContent}
                            download={candidate.cvFileName || 'resume.pdf'}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer"
                          >
                            <FileText className="h-3 w-3 text-emerald-600" />
                            <span>Скачати</span>
                          </a>
                        )}
                        {onViewPersonalFile && (
                          <button
                            type="button"
                            onClick={() => onViewPersonalFile(interview.candidateId)}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-100/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer"
                          >
                            <FileText className="h-3 w-3 text-teal-700" />
                            <span>Особова справа</span>
                          </button>
                        )}
                      </div>

                      {/* Toggle message template and record feedback buttons */}
                      <div className="flex items-center gap-2 w-full pt-1">
                        <button
                          type="button"
                          onClick={() => setExpandedCardId(isCardExpanded ? null : interview.id)}
                          className="flex-1 flex items-center justify-center space-x-1 text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-500" />
                          <span>Шаблони повідомлень</span>
                          {isCardExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartFeedback(interview)}
                          className={`flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            interview.feedbackGiven
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              : 'bg-teal-700 hover:bg-teal-800 text-white shadow-xs'
                          }`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>{interview.feedbackGiven ? 'Змінити результат' : 'Зафіксувати відповідь'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Summary Banner if already given */}
                  {interview.feedbackGiven && !isEditing && (
                    <div className="mt-4 p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="font-extrabold text-emerald-900">
                            Зворотний зв'язок надано: {interview.feedbackOutcome || 'Повідомлено'}
                          </span>
                          {interview.feedbackChannel && (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md text-[10px]">
                              Канал: {interview.feedbackChannel}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-emerald-800/90 pl-5.5">
                          Дата надання: <strong>{formatDateTime(interview.feedbackGivenAt || interview.dateTime)}</strong>
                          {interview.feedbackComment ? ` — Нотатка: «${interview.feedbackComment}»` : ''}
                        </p>
                      </div>

                      {/* Quick action to add to interns if outcome was offer */}
                      {(interview.feedbackOutcome === 'Запрошено на стажування' || interview.result === 'Співбесіда пройшла успішно' || interview.result === 'Перейшов на стажування') && candidate && onAddIntern && (
                        <button
                          type="button"
                          onClick={() => handleOpenAddIntern(candidate, interview, vacancy || undefined)}
                          className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-xs transition shrink-0 cursor-pointer"
                        >
                          <GraduationCap className="h-3.5 w-3.5" />
                          <span>+ Зарахувати на стажування</span>
                        </button>
                      )}

                      {/* Quick indicator if outcome was manager interview */}
                      {(interview.feedbackOutcome === 'Запрошено на співбесіду до керівника' || interview.result === 'Співбесіда з керівником') && candidate && (
                        <span className="inline-flex items-center space-x-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg font-bold text-xs shadow-xs shrink-0">
                          <span>👔 Співбесіда з керівником</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Missed Call Quick Notice if attempts exist and not given */}
                  {!interview.feedbackGiven && interview.feedbackAttempts && interview.feedbackAttempts > 0 && !isEditing && (
                    <div className="mt-3 p-2.5 bg-rose-50/70 border border-rose-200/80 rounded-xl flex items-center justify-between text-xs text-rose-800">
                      <div className="flex items-center space-x-2">
                        <PhoneMissed className="h-4 w-4 text-rose-500 shrink-0" />
                        <span>
                          Остання спроба зв'язку: <strong>{formatDateTime(interview.lastAttemptAt || '')}</strong> (Не відповів, спроб: {interview.feedbackAttempts})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRecordMissedCall(interview)}
                        className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                      >
                        + Зафіксувати ще одну спробу
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded Message Templates Drawer */}
                {isCardExpanded && (
                  <div className="bg-slate-50 border-t border-slate-100 p-5 space-y-3 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-1.5">
                        <Sparkles className="h-4 w-4 text-teal-600" />
                        <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Шаблони повідомлень для відправки кандидату
                        </h5>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Оберіть потрібний тип шаблону та скопіюйте або надішліть у месенджер
                      </span>
                    </div>

                    {/* Template chips selector */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'manager', label: '👔 Співбесіда з керівником', color: 'hover:border-indigo-300' },
                        { id: 'offer', label: '🎉 Запрошення / Офер', color: 'hover:border-emerald-300' },
                        { id: 'reserve', label: '📦 Кадровий резерв', color: 'hover:border-indigo-300' },
                        { id: 'rejected', label: '🤝 Ввічлива відмова', color: 'hover:border-rose-300' },
                        { id: 'waiting', label: '⏳ Очікуємо рішення', color: 'hover:border-amber-300' },
                        { id: 'missed_call', label: '📵 Не зміг дозвонитися', color: 'hover:border-slate-300' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setSelectedTemplateType(prev => ({ ...prev, [interview.id]: t.id }));
                            const newMsg = getTemplateMessage(t.id, interview.candidateName, vacancy?.title || '');
                            setCustomMessages(prev => ({ ...prev, [interview.id]: newMsg }));
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            templateType === t.id
                              ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                              : `bg-white text-slate-600 border-slate-200 ${t.color}`
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Textarea preview and editor */}
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={activeMsg}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomMessages(prev => ({ ...prev, [interview.id]: val }));
                        }}
                        className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-600 text-slate-800 font-medium leading-relaxed"
                        placeholder="Текст повідомлення..."
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyText(activeMsg, `msg-${interview.id}`)}
                            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                          >
                            {copiedId === `msg-${interview.id}` ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                <span>Скопійовано!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Скопіювати текст</span>
                              </>
                            )}
                          </button>

                          {phone && (
                            <a
                              href={getWhatsAppLink(phone, activeMsg)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs"
                            >
                              <Send className="h-3.5 w-3.5" />
                              <span>Відкрити у WhatsApp</span>
                            </a>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400">
                          {activeMsg.length} символів
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Inline Feedback Form Drawer */}
                {isEditing && (
                  <div className="bg-teal-50/40 border-t border-teal-100 p-5 space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-teal-100/80 pb-2.5">
                      <div className="flex items-center space-x-2">
                        <ShieldCheck className="h-5 w-5 text-teal-700" />
                        <div>
                          <h5 className="text-xs font-bold text-teal-900 uppercase tracking-wide">
                            Зафіксувати результат дзвінка / контакту з кандидатом
                          </h5>
                          <p className="text-[11px] text-teal-700">
                            Вкажіть спосіб зв'язку та фінальне рішення для оновлення статусу кандидата
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setEditingFeedbackId(null)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Channel picker */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Канал зв'язку:</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['Телефон', 'Viber', 'Telegram', 'WhatsApp', 'SMS', 'Email'] as const).map((ch) => (
                            <button
                              key={ch}
                              type="button"
                              onClick={() => setFeedbackChannel(ch)}
                              className={`py-1.5 px-2 rounded-xl text-xs font-bold border text-center transition cursor-pointer ${
                                feedbackChannel === ch
                                  ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {ch === 'Телефон' && '📞 '}
                              {ch === 'Viber' && '💬 '}
                              {ch === 'Telegram' && '✈️ '}
                              {ch === 'WhatsApp' && '📱 '}
                              {ch === 'SMS' && '✉️ '}
                              {ch === 'Email' && '📧 '}
                              {ch}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Outcome picker */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Результат контакту:</label>
                        <div className="space-y-1">
                          {[
                            { id: 'Запрошено на співбесіду до керівника', label: '👔 Запрошено на співбесіду до керівника' },
                            { id: 'Запрошено на стажування', label: '✅ Запрошено на стажування / Офер' },
                            { id: 'Повідомлено про відмову', label: '❌ Повідомлено про відмову' },
                            { id: 'Повідомлено про кадровий резерв', label: '📦 Повідомлено про кадровий резерв' },
                            { id: 'Кандидат думає', label: '⏳ Кандидат думає / чекаємо відповіді' },
                            { id: 'Не бере слухавку / Не відповів', label: '📵 Не бере слухавку / Дзвінок без відповіді' },
                            { id: 'Домовилися передзвонити пізніше', label: '🔁 Домовилися передзвонити пізніше' }
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setFeedbackOutcome(opt.id)}
                              className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                                feedbackOutcome === opt.id
                                  ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Comment input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        Нотатка про розмову / домовленість:
                      </label>
                      <input
                        type="text"
                        value={feedbackNotes}
                        onChange={(e) => setFeedbackNotes(e.target.value)}
                        placeholder="Наприклад: Виходить на стажування у понеділок на 09:00, або попросив передзвонити завтра..."
                        className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-600 text-slate-800 font-medium"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handleRecordMissedCall(interview)}
                        className="flex items-center space-x-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        <PhoneMissed className="h-3.5 w-3.5" />
                        <span>Зафіксувати «Не бере слухавку» (без закриття)</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingFeedbackId(null)}
                          className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Скасувати
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveFeedback(interview, true)}
                          className="flex items-center space-x-1.5 bg-teal-700 hover:bg-teal-800 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          <Check className="h-4 w-4" />
                          <span>Зберегти та позначити як повідомлено</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Quick Add Intern Modal */}
      {internCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-scale-up">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center space-x-2">
                <GraduationCap className="h-5 w-5 text-teal-600" />
                <h4 className="text-base font-bold text-slate-900">Зарахувати на стажування</h4>
              </div>
              <button
                type="button"
                onClick={() => setInternCandidate(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-teal-50/70 border border-teal-100 rounded-xl space-y-1">
                <p className="font-extrabold text-slate-800 text-sm">{internCandidate.cand.name}</p>
                <p className="text-slate-600">
                  Посада: <strong>{internCandidate.vacancy?.title || 'Спеціаліст'}</strong> ({internCandidate.vacancy?.department || 'Відділ'})
                </p>
                <p className="text-slate-600">
                  Телефон: <strong>{internCandidate.cand.phone}</strong>
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Дата початку стажування:</label>
                <input
                  type="date"
                  value={internStartDate}
                  onChange={(e) => setInternStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-teal-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Ментор / Керівник стажування:</label>
                <input
                  type="text"
                  value={internMentor}
                  onChange={(e) => setInternMentor(e.target.value)}
                  placeholder="ПІБ ментора"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-teal-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInternCandidate(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleConfirmAddIntern}
                className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Підтвердити зарахування
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Assign 'Зворотний зв'язок' Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Phone className="h-5 w-5 text-amber-400" />
                <h4 className="text-sm font-bold">Призначити статус «Зворотний зв'язок»</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Пошук кандидата..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-amber-500 text-slate-800 font-semibold"
                />
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div className="p-3 overflow-y-auto space-y-2 flex-1">
              {unassignedInterviews
                .filter(i => {
                  if (!assignSearch.trim()) return true;
                  const q = assignSearch.toLowerCase();
                  return (
                    i.candidateName.toLowerCase().includes(q) ||
                    (i.result || '').toLowerCase().includes(q)
                  );
                })
                .map((item) => {
                  const cand = candidates.find(c => c.id === item.candidateId);
                  const vac = cand ? vacancies.find(v => v.id === cand.vacancyId) : null;
                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-white hover:bg-amber-50/50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 transition"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{item.candidateName}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {vac ? vac.title : 'Вакансія'} • {formatDateTime(item.dateTime)}
                        </p>
                        <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold">
                          Статус: {item.status} {item.result ? `• ${item.result}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateInterview({ ...item, status: 'Зворотний зв\'язок' });
                          setIsAssignModalOpen(false);
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Виставити</span>
                      </button>
                    </div>
                  );
                })}
              {unassignedInterviews.length === 0 && (
                <p className="text-center text-xs text-slate-500 py-6">
                  Усі співбесіди вже мають статус «Зворотний зв'язок».
                </p>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CV Preview Modal */}
      <CvPreviewModal
        isOpen={Boolean(previewCv)}
        onClose={() => setPreviewCv(null)}
        candidateName={previewCv?.candidateName || ''}
        fileName={previewCv?.fileName}
        fileContent={previewCv?.fileContent}
        cvLink={previewCv?.cvLink}
      />
    </div>
  );
}
