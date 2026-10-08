import React, { useState, useEffect } from 'react';
import { Candidate, Vacancy, Interview, Intern, CandidateStatus } from '../types';
import { getTodayDateTimeString, getTodayDateString } from '../lib/dateUtils';
import { findMatchingCandidate, normalizePhone } from '../lib/candidateUtils';
import { 
  Zap, 
  X, 
  User, 
  Phone, 
  Briefcase, 
  Calendar, 
  Star, 
  CheckCircle2, 
  MessageSquare, 
  Globe, 
  Award, 
  Sparkles,
  ArrowRight,
  UserCheck,
  Building2,
  Check,
  AlertTriangle
} from 'lucide-react';

interface QuickInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  vacancies: Vacancy[];
  candidates: Candidate[];
  sourcesList: string[];
  interviewStatusesList: string[];
  interviewResultsList: string[];
  onAddCandidate: (candidate: Omit<Candidate, 'id' | 'appliedAt'>) => Candidate;
  onAddInterview: (interview: Omit<Interview, 'id'>) => void;
  onAddIntern?: (intern: Omit<Intern, 'id'>) => void;
  onUpdateCandidate?: (candidate: Candidate) => void;
  onViewPersonalFile?: (candidateId: string) => void;
}

const QUICK_TAGS = [
  '⚡ Готовий/а приступити негайно',
  '💼 Є релевантний досвід',
  '🗣️ Приємна та комунікабельна людина',
  '⏱️ Шукає повну зайнятість',
  '🎓 Впевнено пройшов/ла бліц-опитування',
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

export default function QuickInterviewModal({
  isOpen,
  onClose,
  vacancies,
  candidates,
  sourcesList,
  interviewStatusesList,
  interviewResultsList,
  onAddCandidate,
  onAddInterview,
  onAddIntern,
  onUpdateCandidate,
  onViewPersonalFile
}: QuickInterviewModalProps) {
  // Mode selection: new or existing candidate
  const [candidateMode, setCandidateMode] = useState<'new' | 'existing'>('new');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [candidateSearch, setCandidateSearch] = useState<string>('');

  // Form Fields - Candidate
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [vacancyId, setVacancyId] = useState(vacancies.length > 0 ? vacancies[0].id : '');
  const [customVacancyTitle, setCustomVacancyTitle] = useState('');
  const [source, setSource] = useState(sourcesList[0] || 'Work.ua');
  const [sourceDetails, setSourceDetails] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [hasDocuments, setHasDocuments] = useState(false);

  // Form Fields - Interview
  const [dateTime, setDateTime] = useState(getTodayDateTimeString());
  const [interviewer, setInterviewer] = useState('HR Менеджер');
  const [rating, setRating] = useState<number>(4);
  const [interviewStatus, setInterviewStatus] = useState<string>('Завершено');
  const [interviewResult, setInterviewResult] = useState<string>('Очікує рішення');
  const [managerName, setManagerName] = useState('');
  const [managerInterviewDate, setManagerInterviewDate] = useState('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [feedback, setFeedback] = useState('');

  // Internship Option
  const [directToIntern, setDirectToIntern] = useState(false);
  const [internStartDate, setInternStartDate] = useState(getTodayDateString());
  const [internMentor, setInternMentor] = useState('');

  // Success Notification state
  const [successSaved, setSuccessSaved] = useState<{ candidateId: string; name: string } | null>(null);

  // Auto-set vacancyId if vacancies change
  useEffect(() => {
    if (!vacancyId && vacancies.length > 0) {
      setVacancyId(vacancies[0].id);
    }
  }, [vacancies]);

  // Handle selected candidate
  useEffect(() => {
    if (candidateMode === 'existing' && selectedCandidateId) {
      const found = candidates.find(c => c.id === selectedCandidateId);
      if (found) {
        setName(found.name);
        setPhone(found.phone || '');
        setBirthDate(found.birthDate || '');
        if (found.vacancyId) setVacancyId(found.vacancyId);
        if (found.source) setSource(found.source);
        if (found.sourceDetails) setSourceDetails(found.sourceDetails);
        if (found.referredBy) setReferredBy(found.referredBy);
        if (found.rejectionReason) setRejectionReason(found.rejectionReason);
        if (found.hasDocuments !== undefined) setHasDocuments(Boolean(found.hasDocuments));
      }
    }
  }, [selectedCandidateId, candidateMode, candidates]);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setPhone('');
    setBirthDate('');
    setCustomVacancyTitle('');
    setReferredBy('');
    setSourceDetails('');
    setHasDocuments(false);
    setDateTime(getTodayDateTimeString());
    setInterviewer('HR Менеджер');
    setRating(4);
    setInterviewStatus('Завершено');
    setInterviewResult('Очікує рішення');
    setManagerName('');
    setManagerInterviewDate('');
    setRejectionReason('');
    setFeedback('');
    setDirectToIntern(false);
    setSelectedCandidateId('');
    setCandidateMode('new');
    setSuccessSaved(null);
  };

  const handleAddTag = (tag: string) => {
    if (feedback.includes(tag)) return;
    setFeedback(prev => prev ? `${prev}. ${tag}` : tag);
  };

  const isRefusal = 
    interviewResult === 'Відмова компанії' || 
    interviewResult === 'Відмова кандидата' || 
    interviewStatus === 'Скасовано' || 
    interviewStatus === 'Не прийшов' ||
    (typeof interviewResult === 'string' && interviewResult.toLowerCase().includes('відмов'));

  const autoMatchedCandidate = candidateMode === 'new' 
    ? findMatchingCandidate(candidates, name, phone) 
    : null;

  const filteredExistingCandidates = candidates.filter(c => {
    if (!candidateSearch.trim()) return true;
    const searchLower = candidateSearch.toLowerCase();
    const phoneNorm = normalizePhone(candidateSearch);
    const candPhoneNorm = normalizePhone(c.phone || '');
    return (
      c.name.toLowerCase().includes(searchLower) ||
      c.phone.toLowerCase().includes(searchLower) ||
      (phoneNorm.length >= 4 && candPhoneNorm.includes(phoneNorm))
    );
  });

  const handleSubmit = (keepOpen: boolean = false) => {
    if (candidateMode === 'new' && !name.trim()) {
      alert('Будь ласка, вкажіть ПІБ кандидата.');
      return;
    }

    if (candidateMode === 'new' && vacancyId === 'other' && !customVacancyTitle.trim()) {
      alert('Будь ласка, вкажіть назву вакансії / посади.');
      return;
    }

    if (candidateMode === 'existing' && !selectedCandidateId) {
      alert('Будь ласка, оберіть кандидата зі списку.');
      return;
    }

    let targetCandidateId = selectedCandidateId;
    let targetCandidateName = name.trim();

    const selectedVacancy = vacancies.find(v => v.id === vacancyId);
    const targetPosition = selectedVacancy 
      ? selectedVacancy.title 
      : (vacancyId === 'other' ? (customVacancyTitle.trim() || 'Інша посада') : 'Не вказано');

    // 1. Create or update candidate
    let candidateStatus: CandidateStatus = 'Співбесіда';
    if (directToIntern || interviewResult === 'Перейшов на стажування') {
      candidateStatus = 'Стажування';
    } else if (interviewResult === 'Співбесіда з керівником') {
      candidateStatus = 'Співбесіда з керівником';
    } else    if (
      interviewResult === 'Відмова компанії' ||
      interviewResult === 'Відмова кандидата' ||
      interviewStatus === 'Скасовано' ||
      interviewStatus === 'Не прийшов'
    ) {
      candidateStatus = interviewResult === 'Відмова кандидата' ? 'Відмова кандидата' : 'Відмова компанії';
    } else if (interviewResult === 'Подумає') {
      candidateStatus = 'Подумає';
    } else if (interviewResult === 'Резерв') {
      candidateStatus = 'Резерв';
    }

    if (candidateMode === 'new') {
      const candidateComment = feedback 
        ? (vacancyId === 'other' && customVacancyTitle ? `[Посада: ${customVacancyTitle.trim()}] ${feedback}` : feedback)
        : (vacancyId === 'other' && customVacancyTitle ? `Експрес-внесення (Посада: ${customVacancyTitle.trim()})` : 'Експрес-внесення');

      const isRej = candidateStatus === 'Відмова компанії' || candidateStatus === 'Відмова кандидата';
      const finalRejectionReason = isRej 
        ? (rejectionReason.trim() || interviewResult || interviewStatus || 'Відмова') 
        : undefined;

      const newCand = onAddCandidate({
        name: targetCandidateName,
        birthDate: birthDate.trim(),
        contactDate: getTodayDateString(),
        callType: 'Гарячий',
        phone: phone.trim(),
        vacancyId: vacancyId === 'other' ? '' : vacancyId,
        status: candidateStatus,
        source: source || 'Не вказано',
        referredBy: source.toLowerCase().includes('працівник') ? referredBy.trim() : undefined,
        sourceDetails: source.toLowerCase().includes('інше') ? (sourceDetails.trim() || undefined) : undefined,
        rating,
        comment: candidateComment,
        hasDocuments,
        rejectionReason: finalRejectionReason,
        skipAutoInterview: true
      } as any);
      targetCandidateId = newCand.id;
    } else if (onUpdateCandidate) {
      const foundCand = candidates.find(c => c.id === selectedCandidateId);
      if (foundCand) {
        const updatedName = name.trim() || foundCand.name;
        const isRej = candidateStatus === 'Відмова компанії' || candidateStatus === 'Відмова кандидата';
        const finalRejectionReason = isRej 
          ? (rejectionReason.trim() || interviewResult || interviewStatus || foundCand.rejectionReason || 'Відмова') 
          : foundCand.rejectionReason;

        onUpdateCandidate({
          ...foundCand,
          name: updatedName,
          phone: phone.trim(),
          birthDate: birthDate.trim(),
          vacancyId: vacancyId === 'other' ? '' : vacancyId,
          source: source || foundCand.source,
          sourceDetails: (source || foundCand.source).toLowerCase().includes('інше') ? (sourceDetails.trim() || undefined) : undefined,
          status: candidateStatus,
          rating,
          hasDocuments,
          rejectionReason: finalRejectionReason,
          comment: feedback.trim() || foundCand.comment
        });
        targetCandidateName = updatedName;
      }
    }

    // 2. Add Interview Record
    const isRejStatus = candidateStatus === 'Відмова компанії' || candidateStatus === 'Відмова кандидата';
    const finalInterviewRejectionReason = (isRejStatus || isRefusal)
      ? (rejectionReason.trim() || interviewResult || interviewStatus)
      : undefined;

    onAddInterview({
      candidateId: targetCandidateId,
      candidateName: targetCandidateName,
      dateTime: (interviewResult === 'Співбесіда з керівником' && managerInterviewDate) ? managerInterviewDate : dateTime,
      interviewer: (interviewResult === 'Співбесіда з керівником' && managerName.trim()) 
        ? `Керівник: ${managerName.trim()}` 
        : (interviewer || 'HR Менеджер'),
      feedback,
      rating,
      status: interviewStatus as any,
      result: interviewResult as any,
      rejectionReason: finalInterviewRejectionReason,
      managerName: managerName.trim() || undefined,
      managerInterviewDate: managerInterviewDate || undefined
    });

    // 3. Add to Interns if checked
    if (directToIntern && onAddIntern) {
      onAddIntern({
        candidateId: targetCandidateId,
        candidateName: targetCandidateName,
        birthDate: birthDate.trim(),
        phone: phone.trim(),
        position: targetPosition,
        department: selectedVacancy ? selectedVacancy.department : 'Основний',
        startDate: internStartDate || getTodayDateString(),
        endDate: '',
        mentor: internMentor || interviewer || 'HR Менеджер',
        project: 'Стажування',
        progress: 0,
        status: 'Триває',
        rating,
        comment: `Зараховано після експрес-співбесіди ${getTodayDateString()}. ${feedback}`,
        hasDocuments
      });
    }

    setSuccessSaved({ candidateId: targetCandidateId, name: targetCandidateName });

    if (keepOpen) {
      setTimeout(() => {
        resetForm();
      }, 1800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
              <Zap className="h-6 w-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">Експрес-внесення співбесіди</h2>
              <p className="text-xs text-teal-100 font-medium">Швидка реєстрація кандидата та фіксація результатів співбесіди</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-teal-100 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">

          {/* Success Banner */}
          {successSaved && (
            <div className="bg-emerald-50 border-2 border-emerald-200 p-4 rounded-2xl flex items-center justify-between space-x-3 animate-fade-in">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-600 text-white rounded-xl">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-950">Співбесіду успішно зафіксовано!</p>
                  <p className="text-xs text-emerald-800 font-medium">Кандидата <strong className="font-extrabold">{successSaved.name}</strong> додано та оновлено в системі.</p>
                </div>
              </div>
              {onViewPersonalFile && (
                <button
                  onClick={() => {
                    const id = successSaved.candidateId;
                    onClose();
                    onViewPersonalFile(id);
                  }}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center space-x-1 cursor-pointer shrink-0"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Особова справа</span>
                </button>
              )}
            </div>
          )}

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => setCandidateMode('new')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                candidateMode === 'new'
                  ? 'bg-white text-teal-800 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Новий кандидат</span>
            </button>
            <button
              type="button"
              onClick={() => setCandidateMode('existing')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                candidateMode === 'existing'
                  ? 'bg-white text-teal-800 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserCheck className="h-4 w-4" />
              <span>Обрати з вже існуючих</span>
            </button>
          </div>

          {/* SECTION 1: Candidate Info */}
          <div className="space-y-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <User className="h-3.5 w-3.5 text-teal-600" />
              <span>Інформація про кандидата</span>
            </h3>

            {candidateMode === 'existing' ? (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">Пошук та вибір кандидата:</label>
                <input
                  type="text"
                  placeholder="Введіть ПІБ або телефон для пошуку..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium"
                />
                <select
                  value={selectedCandidateId}
                  onChange={(e) => setSelectedCandidateId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-semibold text-slate-800"
                >
                  <option value="">-- Оберіть кандидата зі списку --</option>
                  {filteredExistingCandidates.map(c => {
                    const vacTitle = vacancies.find(v => v.id === c.vacancyId)?.title || 'Без вакансії';
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} — {vacTitle}
                      </option>
                    );
                  })}
                </select>

                {selectedCandidateId && (
                  <div className="pt-2.5 border-t border-slate-200/60 space-y-3 animate-fade-in">
                    <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">
                      Редагування основних даних обраного кандидата
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        ПІБ кандидата <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ПІБ кандидата"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-semibold text-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Номер телефону:</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="+380 XX XXX XX XX"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Дата народження:</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium text-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ПІБ кандидата <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Наприклад: Коваленко Олена Василівна"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-semibold text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Номер телефону:</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="+380 XX XXX XX XX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Дата народження:</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {autoMatchedCandidate && (
                  <div className="bg-amber-50 border-2 border-amber-300/80 rounded-2xl p-3.5 flex items-center justify-between shadow-xs animate-fade-in mt-2">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                        <UserCheck className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-amber-950">
                          Знайдено кандидатa у базі: <span className="underline">{autoMatchedCandidate.name}</span>
                        </p>
                        <p className="text-[11px] text-amber-800 font-medium">
                          {autoMatchedCandidate.phone ? `Тел: ${autoMatchedCandidate.phone} | ` : ''}
                          Статус: <strong className="font-bold">{autoMatchedCandidate.status}</strong>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCandidateMode('existing');
                        setSelectedCandidateId(autoMatchedCandidate.id);
                        setName(autoMatchedCandidate.name);
                        setPhone(autoMatchedCandidate.phone || '');
                        setBirthDate(autoMatchedCandidate.birthDate || '');
                        if (autoMatchedCandidate.vacancyId) setVacancyId(autoMatchedCandidate.vacancyId);
                        if (autoMatchedCandidate.source) setSource(autoMatchedCandidate.source);
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold transition shadow-xs flex items-center space-x-1 cursor-pointer shrink-0"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Підтягнути дані</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Vacancy & Source selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Вакансія / Посада <span className="text-rose-500">*</span>
                </label>
                <select
                  value={vacancyId}
                  onChange={(e) => setVacancyId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-bold text-teal-900"
                >
                  {vacancies.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.title} ({v.department})
                    </option>
                  ))}
                  <option value="other">Інше (вказати назву вручну)</option>
                  {vacancies.length === 0 && <option value="">Немає відкритих вакансій</option>}
                </select>
                {vacancyId === 'other' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      required
                      placeholder="Введіть назву вакансії / посади..."
                      value={customVacancyTitle}
                      onChange={(e) => setCustomVacancyTitle(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-teal-300 rounded-xl focus:border-teal-600 focus:outline-hidden font-semibold text-slate-800"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Джерело звернення:</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium"
                >
                  {sourcesList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {source.toLowerCase().includes('працівник') && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1 sm:col-span-2">
                  <label className="block text-xs font-bold text-amber-900">
                    👤 Вкажіть працівника, який порекомендував:
                  </label>
                  <input
                    type="text"
                    value={referredBy}
                    onChange={(e) => setReferredBy(e.target.value)}
                    placeholder="ПІБ працівника"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg focus:border-amber-600 focus:outline-hidden font-medium"
                  />
                </div>
              )}

              {source.toLowerCase().includes('інше') && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-1 sm:col-span-2 animate-fade-in">
                  <label className="block text-xs font-bold text-indigo-950">
                    📌 Вкажіть коментар / доповнення (що саме «інше»):
                  </label>
                  <input
                    type="text"
                    value={sourceDetails}
                    onChange={(e) => setSourceDetails(e.target.value)}
                    placeholder="Наприклад: білборд, реклама у транспорті, ярмарок вакансій, знайомі..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-300 rounded-lg focus:border-indigo-600 focus:outline-hidden font-medium text-slate-800 placeholder:text-slate-400"
                  />
                </div>
              )}
            </div>

            {/* Наявність документів */}
            <div className="pt-2 border-t border-slate-200/60">
              <label className="flex items-center space-x-2.5 p-3 rounded-xl border border-slate-200/90 hover:border-teal-400 bg-white cursor-pointer transition select-none shadow-2xs">
                <input
                  type="checkbox"
                  checked={hasDocuments}
                  onChange={(e) => setHasDocuments(e.target.checked)}
                  className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded"
                />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>📋</span>
                    <span>Наявність документів (паспорт, код/ІПН тощо)</span>
                  </span>
                  {hasDocuments ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                      ✓ Документи в наявності
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Не надано
                    </span>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* SECTION 2: Interview Results */}
          <div className="space-y-4 bg-teal-50/40 p-4 rounded-2xl border border-teal-100">
            <h3 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center space-x-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Результати проведеної розмови</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Дата та час співбесіди:</label>
                <input
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Інтерв'юер (HR):</label>
                <input
                  type="text"
                  value={interviewer}
                  onChange={(e) => setInterviewer(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Загальна оцінка HR:</label>
                <div className="flex items-center space-x-1 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`p-1 rounded-lg transition cursor-pointer ${
                        star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                      }`}
                    >
                      <Star className="h-5 w-5 fill-current" />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-600 ml-1">({rating}/5)</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Статус проведення:</label>
                <select
                  value={interviewStatus}
                  onChange={(e) => setInterviewStatus(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-semibold"
                >
                  <option value="Завершено">Завершено (розмову проведено)</option>
                  <option value="Заплановано">Заплановано (погоджено повторно)</option>
                  <option value="Не прийшов">Не прийшов / Перенесено</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Етап співбесіди / Результат:</label>
                <select
                  value={interviewResult}
                  onChange={(e) => {
                    const res = e.target.value;
                    setInterviewResult(res);
                    if (res === 'Перейшов на стажування') {
                      setDirectToIntern(true);
                    } else if (res === 'Відмова компанії' || res === 'Відмова кандидата') {
                      setDirectToIntern(false);
                    } else if (res === 'Співбесіда з керівником') {
                      setDirectToIntern(false);
                      if (!managerInterviewDate) {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(11, 0, 0, 0);
                        const pad = (n: number) => n < 10 ? '0' + n : n;
                        setManagerInterviewDate(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}T11:00`);
                      }
                    }
                  }}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-extrabold text-teal-900"
                >
                  <option value="Очікує рішення">Очікує рішення (подумає / передзвонимо)</option>
                  <option value="Співбесіда з керівником">👔 Співбесіда з керівником (2-й етап)</option>
                  <option value="Перейшов на стажування">🎓 Пройшов (Запрошено на стажування)</option>
                  <option value="Подумає">⏳ Кандидат подумає</option>
                  <option value="Резерв">📦 Додати в резерв</option>
                  <option value="Відмова компанії">❌ Відмова компанії</option>
                  <option value="Відмова кандидата">❌ Відмова кандидата</option>
                </select>
              </div>
            </div>

            {/* Співбесіда з керівником: параметри */}
            {interviewResult === 'Співбесіда з керівником' && (
              <div className="bg-indigo-50/90 border border-indigo-200 rounded-2xl p-4 space-y-3 animate-fade-in shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-indigo-950">
                    <div className="p-1.5 bg-indigo-100 border border-indigo-200 rounded-lg text-indigo-700">
                      <UserCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider">Етап: Співбесіда з керівником</h4>
                      <p className="text-[11px] text-indigo-700 font-medium">Кандидата буде збережено в одній картці зі статусом співбесіди з керівником</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-200 text-indigo-900 border border-indigo-300">
                    👔 2-й етап
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Керівник (ПІБ або посада):</label>
                    <input
                      type="text"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      placeholder="напр. Іванчук О.В. / Керівник відділу"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-300 rounded-xl focus:border-indigo-600 focus:outline-hidden font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Дата та час співбесіди з керівником:</label>
                    <input
                      type="datetime-local"
                      value={managerInterviewDate}
                      onChange={(e) => setManagerInterviewDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-300 rounded-xl focus:border-indigo-600 focus:outline-hidden font-medium text-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Conditional Rejection Reason Section */}
            {isRefusal && (
              <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-rose-900">
                    <div className="p-1.5 bg-rose-100 border border-rose-200 rounded-lg text-rose-700">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider">Причина відмови</h4>
                      <p className="text-[11px] text-rose-700 font-medium">Оберіть варіант або впишіть точну причину відмови</p>
                    </div>
                  </div>
                  {rejectionReason && (
                    <button
                      type="button"
                      onClick={() => setRejectionReason('')}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                    >
                      Очистити
                    </button>
                  )}
                </div>

                {/* Quick Chips */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-rose-900 uppercase tracking-wider">
                    Швидкі шаблони:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {REJECTION_CHIPS.map((chip) => {
                      const cleanText = chip.replace(/^[^\wа-яА-ЯіїєґІЇЄҐ]+\s*/, '');
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            const mappedReason = 
                              chip.includes('Hard skills') ? 'Невідповідність вимогам (hard skills)' :
                              chip.includes('ЗП') ? 'Завищені очікування по заробітній платі' :
                              chip.includes('Графік') ? 'Не підходить графік роботи' :
                              chip.includes('Локація') ? 'Не підходить локація' :
                              chip.includes('Відмова кандидата') ? 'Кандидат сам відмовився' :
                              chip.includes('Не прийшов') ? 'Не з\'явився на співбесіду' :
                              cleanText;
                            setRejectionReason(mappedReason);
                          }}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-xl transition cursor-pointer border ${
                            rejectionReason.toLowerCase().includes(cleanText.toLowerCase())
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-white hover:bg-rose-100 text-rose-900 border-rose-200'
                          }`}
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dropdown Select + Direct Text Input */}
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-rose-900 uppercase tracking-wider mb-1">
                      Типова категорія:
                    </label>
                    <select
                      value={DEFAULT_REJECTION_REASONS.includes(rejectionReason) ? rejectionReason : (rejectionReason ? 'custom' : '')}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          if (DEFAULT_REJECTION_REASONS.includes(rejectionReason)) {
                            setRejectionReason('');
                          }
                        } else {
                          setRejectionReason(e.target.value);
                        }
                      }}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-rose-200 rounded-xl focus:border-rose-500 focus:outline-hidden font-semibold text-slate-800"
                    >
                      <option value="">-- Оберіть зі списку або введіть нижче --</option>
                      {DEFAULT_REJECTION_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                      <option value="custom">✏️ Власна причина (ввести вручну)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-rose-900 uppercase tracking-wider mb-1">
                      Детальний коментар / причина відмови:
                    </label>
                    <input
                      type="text"
                      placeholder="Введіть або доповніть причину відмови..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-rose-200 rounded-xl focus:border-rose-500 focus:outline-hidden font-semibold text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Quick Tags for Feedback */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-slate-700">
                Нотатки та враження від кандидатa:
              </label>
              
              {/* Tag suggestions */}
              <div className="flex flex-wrap gap-1.5 pb-1">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleAddTag(tag)}
                    className="text-[11px] bg-white hover:bg-teal-100/70 border border-teal-200 text-teal-800 font-semibold px-2.5 py-1 rounded-xl transition cursor-pointer flex items-center space-x-1"
                  >
                    <span>+</span>
                    <span>{tag}</span>
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                placeholder="Вкажіть досвід, переваги, відповіді на питання, зауваження..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium"
              />
            </div>
          </div>

          {/* SECTION 3: Direct Internship Option */}
          <div className="bg-indigo-50/60 border border-indigo-100 p-4 rounded-2xl space-y-3">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={directToIntern}
                onChange={(e) => setDirectToIntern(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs font-extrabold text-indigo-950 flex items-center space-x-1.5">
                <Award className="h-4 w-4 text-indigo-600" />
                <span>Одразу зарахувати на стажування у штат</span>
              </span>
            </label>

            {directToIntern && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 pl-6 animate-fade-in">
                <div>
                  <label className="block text-[11px] font-bold text-indigo-900 mb-1">Дата початку стажування:</label>
                  <input
                    type="date"
                    value={internStartDate}
                    onChange={(e) => setInternStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-xl focus:border-indigo-600 font-bold text-indigo-950"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-indigo-900 mb-1">Наставник / Керівник:</label>
                  <input
                    type="text"
                    placeholder="ПІБ наставника..."
                    value={internMentor}
                    onChange={(e) => setInternMentor(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-xl focus:border-indigo-600 font-medium"
                  />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl transition cursor-pointer"
          >
            Скасувати
          </button>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Зберегти та +Наступний</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleSubmit(false);
                onClose();
              }}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>Зберегти співбесіду</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
