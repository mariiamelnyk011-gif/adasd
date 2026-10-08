import React, { useState, useEffect, useMemo } from 'react';
import { Candidate, Vacancy, Interview, Intern, CandidateStatus, InterviewStatus, InterviewResult } from '../types';
import { getTodayDateTimeString, getTodayDateString } from '../lib/dateUtils';
import { findMatchingCandidate } from '../lib/candidateUtils';
import { 
  X, 
  User, 
  Phone, 
  Briefcase, 
  Calendar, 
  Clock, 
  Star, 
  CheckCircle2, 
  MessageSquare, 
  Globe, 
  Flame, 
  Snowflake, 
  Upload, 
  Paperclip, 
  Eye, 
  FolderOpen, 
  Trash2, 
  AlertTriangle, 
  Cake, 
  Building2, 
  GraduationCap,
  UserCheck
} from 'lucide-react';

interface ScheduleInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedInterview?: Interview | null;
  initialCandidate?: Candidate | null;
  vacancies: Vacancy[];
  candidates: Candidate[];
  interviews?: Interview[];
  sourcesList?: string[];
  interviewStatusesList: string[];
  interviewResultsList: string[];
  onAddInterview: (interview: Omit<Interview, 'id'>) => void;
  onUpdateInterview: (interview: Interview) => void;
  onDeleteInterview?: (interviewId: string) => void;
  onAddCandidate?: (candidate: Omit<Candidate, 'id' | 'appliedAt'>) => Candidate;
  onUpdateCandidate?: (candidate: Candidate) => void;
  onAddIntern?: (intern: Omit<Intern, 'id'>) => void;
  onViewPersonalFile?: (candidateId: string) => void;
  onPreviewCv?: (preview: { candidateName: string; fileName?: string; fileContent?: string; cvLink?: string }) => void;
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

export default function ScheduleInterviewModal({
  isOpen,
  onClose,
  selectedInterview,
  initialCandidate,
  vacancies,
  candidates,
  interviews = [],
  sourcesList = ['work.ua', 'robota.ua', 'facebook', 'instagram', 'threads', 'працівник', 'інше'],
  interviewStatusesList,
  interviewResultsList,
  onAddInterview,
  onUpdateInterview,
  onDeleteInterview,
  onAddCandidate,
  onUpdateCandidate,
  onAddIntern,
  onViewPersonalFile,
  onPreviewCv
}: ScheduleInterviewModalProps) {
  // Candidate form fields
  const [candidateId, setCandidateId] = useState<string>('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [vacancyId, setVacancyId] = useState(vacancies.length > 0 ? vacancies[0].id : '');
  const [customVacancy, setCustomVacancy] = useState('');
  const [source, setSource] = useState(sourcesList[0] || 'work.ua');
  const [sourceDetails, setSourceDetails] = useState('');
  const [callType, setCallType] = useState<'Гарячий' | 'Холодний'>('Гарячий');
  const [cvLink, setCvLink] = useState('');
  const [cvFileName, setCvFileName] = useState('');
  const [cvFileContent, setCvFileContent] = useState('');

  // Interview form fields
  const [dateTime, setDateTime] = useState(getTodayDateTimeString());
  const [interviewer, setInterviewer] = useState('HR Менеджер');
  const [rating, setRating] = useState<number>(4);
  const [status, setStatus] = useState<string>(interviewStatusesList[0] || 'Заплановано');
  const [result, setResult] = useState<string>(interviewResultsList[0] || 'Очікує рішення');
  const [rejectionReason, setRejectionReason] = useState('');
  const [feedback, setFeedback] = useState('');

  // Internship transition
  const [directToIntern, setDirectToIntern] = useState(false);
  const [internStartDate, setInternStartDate] = useState(getTodayDateString());
  const [internMentor, setInternMentor] = useState('HR Менеджер');

  // Manager interview transition (2-й етап)
  const [managerName, setManagerName] = useState('');
  const [managerDateTime, setManagerDateTime] = useState('');

  // Initialize form whenever modal opens or inputs change
  useEffect(() => {
    if (!isOpen) return;

    if (selectedInterview) {
      setCandidateId(selectedInterview.candidateId);
      const cand = candidates.find(c => c.id === selectedInterview.candidateId);
      setName(cand?.name || selectedInterview.candidateName || '');
      setPhone(cand?.phone || '');
      setBirthDate(cand?.birthDate || '');
      setVacancyId(cand?.vacancyId || (vacancies[0]?.id || ''));
      setCustomVacancy('');
      setSource(cand?.source || sourcesList[0] || 'work.ua');
      setSourceDetails(cand?.sourceDetails || '');
      setCallType(cand?.callType || 'Гарячий');
      setCvLink(cand?.cvLink || '');
      setCvFileName(cand?.cvFileName || '');
      setCvFileContent(cand?.cvFileContent || '');

      setDateTime(selectedInterview.dateTime || getTodayDateTimeString());
      setInterviewer(selectedInterview.interviewer || 'HR Менеджер');
      setRating(selectedInterview.rating || 4);
      setStatus(selectedInterview.status || 'Заплановано');
      setResult(selectedInterview.result || 'Очікує рішення');
      setRejectionReason(selectedInterview.rejectionReason || '');
      setFeedback(selectedInterview.feedback || '');
      setDirectToIntern(false);
      setInternStartDate(getTodayDateString());
      setInternMentor(selectedInterview.interviewer || 'HR Менеджер');
      setManagerName(selectedInterview.managerName || '');
      setManagerDateTime(selectedInterview.managerInterviewDate || '');
    } else if (initialCandidate) {
      setCandidateId(initialCandidate.id);
      setName(initialCandidate.name || '');
      setPhone(initialCandidate.phone || '');
      setBirthDate(initialCandidate.birthDate || '');
      setVacancyId(initialCandidate.vacancyId || (vacancies[0]?.id || ''));
      setCustomVacancy('');
      setSource(initialCandidate.source || sourcesList[0] || 'work.ua');
      setSourceDetails(initialCandidate.sourceDetails || '');
      setCallType(initialCandidate.callType || 'Гарячий');
      setCvLink(initialCandidate.cvLink || '');
      setCvFileName(initialCandidate.cvFileName || '');
      setCvFileContent(initialCandidate.cvFileContent || '');

      const existingInt = interviews.find(i => 
        i.candidateId === initialCandidate.id || 
        (i.candidateName && initialCandidate.name && i.candidateName.trim().toLowerCase() === initialCandidate.name.trim().toLowerCase())
      );

      if (existingInt) {
        setDateTime(existingInt.dateTime || getTodayDateTimeString());
        setInterviewer(existingInt.interviewer || 'HR Менеджер');
        setRating(existingInt.rating || initialCandidate.rating || 4);
        setStatus(existingInt.status || interviewStatusesList[0] || 'Заплановано');
        setResult(existingInt.result || interviewResultsList[0] || 'Очікує рішення');
        setRejectionReason(existingInt.rejectionReason || '');
        setFeedback(existingInt.feedback || initialCandidate.comment || '');
        setDirectToIntern(false);
        setInternStartDate(getTodayDateString());
        setInternMentor(existingInt.interviewer || 'HR Менеджер');
        setManagerName(existingInt.managerName || '');
        setManagerDateTime(existingInt.managerInterviewDate || '');
      } else {
        setDateTime(getTodayDateTimeString());
        setInterviewer('HR Менеджер');
        setRating(initialCandidate.rating || 4);
        setStatus(interviewStatusesList[0] || 'Заплановано');
        setResult(interviewResultsList[0] || 'Очікує рішення');
        setRejectionReason('');
        setFeedback(initialCandidate.comment || '');
        setDirectToIntern(false);
        setInternStartDate(getTodayDateString());
        setInternMentor('HR Менеджер');
      }
    } else {
      setCandidateId('');
      setName('');
      setPhone('');
      setBirthDate('');
      setVacancyId(vacancies.length > 0 ? vacancies[0].id : '');
      setCustomVacancy('');
      setSource(sourcesList[0] || 'work.ua');
      setSourceDetails('');
      setCallType('Гарячий');
      setCvLink('');
      setCvFileName('');
      setCvFileContent('');

      setDateTime(getTodayDateTimeString());
      setInterviewer('HR Менеджер');
      setRating(4);
      setStatus(interviewStatusesList[0] || 'Заплановано');
      setResult(interviewResultsList[0] || 'Очікує рішення');
      setRejectionReason('');
      setFeedback('');
      setDirectToIntern(false);
      setInternStartDate(getTodayDateString());
      setInternMentor('HR Менеджер');
    }
  }, [isOpen, selectedInterview, initialCandidate, vacancies, sourcesList, interviewStatusesList, interviewResultsList, candidates]);

  // Auto-matching candidate check
  const autoMatchedCandidate = useMemo(() => {
    if (!isOpen || selectedInterview || candidateId) return null;
    if (phone.trim().length < 6 && name.trim().length < 3) return null;
    return findMatchingCandidate(candidates, name, phone);
  }, [isOpen, selectedInterview, candidateId, name, phone, candidates]);

  if (!isOpen) return null;

  const handleCvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Розмір файлу не повинен перевищувати 5 МБ');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCvFileName(file.name);
      setCvFileContent(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Будь ласка, вкажіть ПІБ кандидата');
      return;
    }
    if (!dateTime) {
      alert('Будь ласка, вкажіть дату та час співбесіди');
      return;
    }
    if (!vacancyId || (vacancyId === 'other' && !customVacancy.trim())) {
      alert('Будь ласка, оберіть або вкажіть вакансію для кандидата');
      return;
    }

    const selectedVacancy = vacancies.find(v => v.id === vacancyId);
    const targetPosition = selectedVacancy 
      ? selectedVacancy.title 
      : (vacancyId === 'other' ? (customVacancy.trim() || 'Інша посада') : 'Не вказано');
    const targetDept = selectedVacancy ? selectedVacancy.department : 'Основний';

    // Status derivation
    let candidateStatus: CandidateStatus = 'Співбесіда';
    if (directToIntern || (status === 'Завершено' && result === 'Перейшов на стажування')) {
      candidateStatus = 'Стажування';
    } else if (status === 'Завершено' && result === 'Співбесіда з керівником') {
      candidateStatus = 'Співбесіда з керівником';
    } else if (
      status === 'Не прийшов' ||
      status === 'Скасовано' ||
      (status === 'Завершено' && (result === 'Відмова компанії' || result === 'Відмова кандидата'))
    ) {
      candidateStatus = result === 'Відмова кандидата' ? 'Відмова кандидата' : 'Відмова компанії';
    } else if (status === 'Завершено' && result === 'Резерв') {
      candidateStatus = 'Резерв';
    } else if (status === 'Завершено' && result === 'Подумає') {
      candidateStatus = 'Подумає';
    }

    const finalReason = (status === 'Завершено' && (result === 'Відмова компанії' || result === 'Відмова кандидата'))
      ? rejectionReason.trim()
      : status === 'Не прийшов'
      ? (rejectionReason.trim() || 'Не прийшов на співбесіду')
      : status === 'Скасовано'
      ? (rejectionReason.trim() || 'Співбесіду скасовано')
      : '';

    let finalResult: InterviewResult = 'Очікує рішення';
    if (status === 'Завершено') {
      finalResult = result as InterviewResult;
    } else if (status === 'Скасовано' || status === 'Не прийшов') {
      finalResult = 'Співбесіда не відбулася';
    } else if (status === 'Заплановано') {
      finalResult = 'Очікує рішення';
    }

    let finalCandidateId = candidateId;
    let finalCandidateName = name.trim();

    // 1. Create or Update Candidate
    if (candidateId) {
      const existingCand = candidates.find(c => c.id === candidateId);
      if (existingCand && onUpdateCandidate) {
        const isRej = candidateStatus === 'Відмова компанії' || candidateStatus === 'Відмова кандидата';
        onUpdateCandidate({
          ...existingCand,
          name: finalCandidateName,
          phone: phone.trim(),
          birthDate: birthDate.trim(),
          vacancyId: vacancyId === 'other' ? '' : vacancyId,
          source: source || existingCand.source,
          sourceDetails: (source || existingCand.source).toLowerCase().includes('інше') ? (sourceDetails.trim() || undefined) : undefined,
          callType,
          rating,
          status: candidateStatus,
          rejectionReason: isRej ? (finalReason || existingCand.rejectionReason || 'Відмова') : existingCand.rejectionReason,
          cvLink: cvLink.trim() || existingCand.cvLink,
          cvFileName: cvFileName || existingCand.cvFileName,
          cvFileContent: cvFileContent || existingCand.cvFileContent,
          comment: feedback.trim() ? feedback.trim() : existingCand.comment
        });
      }
    } else {
      if (onAddCandidate) {
        const commentText = feedback.trim() 
          ? (vacancyId === 'other' && customVacancy ? `[Посада: ${customVacancy.trim()}] ${feedback.trim()}` : feedback.trim())
          : (vacancyId === 'other' && customVacancy ? `Посада: ${customVacancy.trim()}` : 'Внесено при призначенні співбесіди');

        const isRej = candidateStatus === 'Відмова компанії' || candidateStatus === 'Відмова кандидата';
        const newCand = onAddCandidate({
          name: finalCandidateName,
          birthDate: birthDate.trim(),
          contactDate: getTodayDateString(),
          callType,
          phone: phone.trim(),
          vacancyId: vacancyId === 'other' ? '' : vacancyId,
          status: candidateStatus,
          source: source || 'інше',
          sourceDetails: (source || 'інше').toLowerCase().includes('інше') ? (sourceDetails.trim() || undefined) : undefined,
          rating,
          comment: commentText,
          hasDocuments: false,
          cvLink: cvLink.trim() || undefined,
          cvFileName: cvFileName || undefined,
          cvFileContent: cvFileContent || undefined,
          rejectionReason: isRej ? (finalReason || 'Відмова') : undefined,
          skipAutoInterview: true
        } as any);
        finalCandidateId = newCand.id;
        finalCandidateName = newCand.name;
      } else {
        alert('Помилка: не вдалося зберегти дані кандидата');
        return;
      }
    }

    // 2. Add or Update Interview (all changes stay in one single card without duplication)
    const interviewPayload = {
      candidateId: finalCandidateId,
      candidateName: finalCandidateName,
      dateTime: (finalResult === 'Співбесіда з керівником' && managerDateTime) ? managerDateTime : dateTime,
      interviewer: (finalResult === 'Співбесіда з керівником' && managerName.trim()) 
        ? `Керівник: ${managerName.trim()}` 
        : (interviewer.trim() || 'HR Менеджер'),
      feedback: feedback.trim(),
      rating,
      status: status as InterviewStatus,
      result: finalResult,
      rejectionReason: finalReason,
      managerName: managerName.trim() || undefined,
      managerInterviewDate: managerDateTime || undefined
    };

    const targetInterview = selectedInterview || interviews.find(i => 
      (finalCandidateId && i.candidateId === finalCandidateId) ||
      (finalCandidateName && i.candidateName && i.candidateName.trim().toLowerCase() === finalCandidateName.toLowerCase())
    );

    if (targetInterview) {
      onUpdateInterview({
        ...targetInterview,
        ...interviewPayload
      });
    } else {
      onAddInterview(interviewPayload);
    }

    // 3. Add to Interns if checked
    if (directToIntern && onAddIntern) {
      onAddIntern({
        candidateId: finalCandidateId,
        candidateName: finalCandidateName,
        birthDate: birthDate.trim(),
        phone: phone.trim(),
        position: targetPosition,
        department: targetDept,
        startDate: internStartDate || getTodayDateString(),
        endDate: '',
        mentor: internMentor.trim() || interviewer.trim() || 'HR Менеджер',
        project: 'Стажування',
        progress: 0,
        status: 'Триває',
        rating,
        comment: `Зараховано після співбесіди ${getTodayDateString()}. ${feedback.trim()}`,
        hasDocuments: false
      });
    }

    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in no-print overflow-y-auto" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-2xl w-full p-5 sm:p-7 relative my-auto max-h-[92vh] overflow-y-auto space-y-5 animate-scale-up" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-start justify-between pr-8">
            <div>
              <h4 className="font-extrabold text-slate-900 text-lg sm:text-xl flex items-center gap-2">
                <Calendar className="h-5 w-5 text-teal-700" />
                <span>{selectedInterview ? 'Деталі співбесіди' : 'Призначити співбесіду'}</span>
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {selectedInterview 
                  ? 'Перегляд та редагування анкети і результатів співбесіди' 
                  : 'Експрес-внесення анкетних даних та планування співбесіди'}
              </p>
            </div>
            {candidateId && onViewPersonalFile && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewPersonalFile(candidateId);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200/60 rounded-xl transition cursor-pointer"
                title="Відкрити особову справу"
              >
                <FolderOpen className="h-3.5 w-3.5 text-teal-700" />
                <span>Особова справа</span>
              </button>
            )}
          </div>
        </div>

        {/* Auto-Match Candidate Banner */}
        {autoMatchedCandidate && autoMatchedCandidate.id !== candidateId && (
          <div className="bg-amber-50 border border-amber-200/90 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-amber-900 font-medium">
                  У базі вже є кандидат: <strong className="font-bold text-slate-900">{autoMatchedCandidate.name}</strong> ({autoMatchedCandidate.phone || 'без тел.'})
                </span>
                {autoMatchedCandidate.status && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-950 font-extrabold text-[10px]">
                    {autoMatchedCandidate.status}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setCandidateId(autoMatchedCandidate.id);
                setName(autoMatchedCandidate.name);
                setPhone(autoMatchedCandidate.phone);
                setBirthDate(autoMatchedCandidate.birthDate || '');
                if (autoMatchedCandidate.vacancyId) setVacancyId(autoMatchedCandidate.vacancyId);
                if (autoMatchedCandidate.source) setSource(autoMatchedCandidate.source);
                if (autoMatchedCandidate.sourceDetails) setSourceDetails(autoMatchedCandidate.sourceDetails);
                if (autoMatchedCandidate.callType) setCallType(autoMatchedCandidate.callType);
                if (autoMatchedCandidate.cvLink) setCvLink(autoMatchedCandidate.cvLink);
                if (autoMatchedCandidate.cvFileName) setCvFileName(autoMatchedCandidate.cvFileName);
                if (autoMatchedCandidate.cvFileContent) setCvFileContent(autoMatchedCandidate.cvFileContent);
              }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 transition cursor-pointer self-start sm:self-auto"
            >
              Підтягнути дані
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1: Анкетні дані кандидата */}
          <div className="bg-slate-50/70 border border-slate-200/70 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm border-b border-slate-200/60 pb-2">
              <User className="h-4 w-4 text-teal-700" />
              <span>1. Анкетні дані кандидата</span>
            </div>

            {/* ПІБ кандидата */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ПІБ кандидата <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Наприклад: Коваленко Олена Василівна"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            {/* Телефон та Дата народження */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>Номер телефону</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+380 XX XXX XX XX"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Cake className="h-3.5 w-3.5 text-slate-400" />
                  <span>Дата народження</span>
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Вакансія та Підрозділ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5 text-teal-600" />
                  <span>Вакансія / Посада <span className="text-rose-500">*</span></span>
                </label>
                <select
                  required
                  value={vacancyId}
                  onChange={(e) => setVacancyId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                >
                  <option value="">Оберіть вакансію...</option>
                  {vacancies.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} ({v.department})
                    </option>
                  ))}
                  <option value="other">Інша вакансія...</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-teal-600" />
                  <span>Підрозділ / Відділ</span>
                </label>
                <div className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-teal-800 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-teal-600 shrink-0" />
                  <span className="truncate">
                    {(() => {
                      const vac = vacancies.find(v => v.id === vacancyId);
                      if (vac) return vac.department;
                      if (vacancyId === 'other') return 'Вкажіть окремо';
                      return 'Оберіть вакансію';
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {vacancyId === 'other' && (
              <div className="animate-fade-in">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Вкажіть назву посади <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customVacancy}
                  onChange={(e) => setCustomVacancy(e.target.value)}
                  placeholder="Наприклад: Старший товарознавець"
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>
            )}

            {/* Джерело та Тип звернення */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-slate-400" />
                  <span>Джерело ліда</span>
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                >
                  {sourcesList.map((src) => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Тип звернення
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCallType('Гарячий')}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                      callType === 'Гарячий'
                        ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Flame className="h-3.5 w-3.5 text-rose-500" />
                    <span>Гарячий</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCallType('Холодний')}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                      callType === 'Холодний'
                        ? 'bg-sky-50 border-sky-300 text-sky-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Snowflake className="h-3.5 w-3.5 text-sky-500" />
                    <span>Холодний</span>
                  </button>
                </div>
              </div>
            </div>

            {source.toLowerCase().includes('інше') && (
              <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3 space-y-1 animate-fade-in">
                <label className="block text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <span>📌 Уточнення джерела (що саме «інше»):</span>
                </label>
                <input
                  type="text"
                  value={sourceDetails}
                  onChange={(e) => setSourceDetails(e.target.value)}
                  placeholder="Вкажіть деталі: наприклад, білборд, реклама у транспорті, ярмарок кар'єри, рекомендація тощо"
                  className="w-full px-3.5 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-600"
                />
              </div>
            )}

            {/* Резюме (CV) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                  <span>Резюме кандидата (CV)</span>
                </span>
                {cvFileName && (
                  <span className="text-[11px] text-teal-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Файл додано
                  </span>
                )}
              </label>
              <div className="space-y-2">
                <input
                  type="url"
                  value={cvLink}
                  onChange={(e) => setCvLink(e.target.value)}
                  placeholder="Посилання на резюме (Google Drive, Work.ua тощо)"
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs">
                    <Upload className="h-3.5 w-3.5 text-slate-500" />
                    <span>{cvFileName ? 'Замінити файл' : 'Завантажити файл CV'}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      onChange={handleCvUpload}
                      className="hidden"
                    />
                  </label>

                  {cvFileName && (
                    <div className="flex items-center gap-1.5 bg-teal-50 border border-teal-200 px-3 py-1 rounded-xl text-xs font-semibold text-teal-800">
                      <span className="truncate max-w-[180px]">{cvFileName}</span>
                      {onPreviewCv && (
                        <button
                          type="button"
                          onClick={() => onPreviewCv({ candidateName: name || 'Кандидат', fileName: cvFileName, fileContent: cvFileContent, cvLink })}
                          className="p-1 hover:text-teal-950 transition cursor-pointer"
                          title="Переглянути"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setCvFileName(''); setCvFileContent(''); }}
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Видалити файл"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Параметри співбесіди */}
          <div className="bg-teal-50/40 border border-teal-100/90 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm border-b border-teal-100 pb-2">
              <Clock className="h-4 w-4 text-teal-700" />
              <span>2. Параметри та статус співбесіди</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-teal-700" />
                  <span>Дата та час зустрічі <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-teal-200/80 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span>Хто проводить (інтерв'юер)</span>
                </label>
                <input
                  type="text"
                  value={interviewer}
                  onChange={(e) => setInterviewer(e.target.value)}
                  placeholder="HR Менеджер"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Статус співбесіди
                </label>
                <select
                  value={status}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setStatus(newStatus);
                    if (newStatus === 'Завершено' && result === 'Очікує рішення') {
                      setResult('Співбесіда пройшла успішно');
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                >
                  {interviewStatusesList.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {(status === 'Завершено' || status === 'Зворотний зв\'язок') ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Результат співбесіди
                  </label>
                  <select
                    value={result}
                    onChange={(e) => {
                      const val = e.target.value;
                      setResult(val);
                      if (val === 'Перейшов на стажування') {
                        setDirectToIntern(true);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  >
                    {interviewResultsList.map((res) => (
                      <option key={res} value={res}>{res}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-white/70 border border-teal-100 rounded-xl text-[11px] text-slate-500 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-teal-600 shrink-0" />
                  <span>Співбесіду заплановано. Результат фіксується після її проведення.</span>
                </div>
              )}
            </div>

            {status === 'Зворотний зв\'язок' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2.5 animate-fade-in">
                <Phone className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="font-medium">
                  Кандидат буде у вкладці <strong>«Зворотний зв'язок»</strong> для надання відповіді (дзвінок або шаблон у месенджер).
                </span>
              </div>
            )}

            {status === 'Не прийшов' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2 animate-fade-in">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Кандидату буде встановлено статус «Відмова компанії» з причиною «Не з'явився на співбесіду».</span>
              </div>
            )}

            {status === 'Скасовано' && (
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center gap-2 animate-fade-in">
                <AlertTriangle className="h-4 w-4 text-slate-500 shrink-0" />
                <span>Співбесіду буде позначено як скасовану.</span>
              </div>
            )}

            {/* Причина відмови */}
            {status === 'Завершено' && (result === 'Відмова компанії' || result === 'Відмова кандидата') && (
              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2 animate-fade-in">
                <label className="block text-xs font-bold text-rose-900">
                  Причина відмови <span className="text-rose-500">*</span>
                </label>
                <select
                  value={DEFAULT_REJECTION_REASONS.includes(rejectionReason) ? rejectionReason : (rejectionReason ? 'Інше' : '')}
                  onChange={(e) => {
                    if (e.target.value !== 'Інше') {
                      setRejectionReason(e.target.value);
                    } else if (!rejectionReason || DEFAULT_REJECTION_REASONS.includes(rejectionReason)) {
                      setRejectionReason('');
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-rose-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-rose-400 focus:outline-hidden"
                >
                  <option value="">Оберіть стандартну причину...</option>
                  {DEFAULT_REJECTION_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Вкажіть або уточніть причину відмови..."
                  className="w-full px-3 py-2 bg-white border border-rose-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-400 focus:outline-hidden"
                />

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {REJECTION_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setRejectionReason(chip)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 transition cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Оцінка кандидата */}
            {status === 'Завершено' && (
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-teal-100">
                <span className="text-xs font-bold text-slate-700">Оцінка кандидата:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 cursor-pointer transition hover:scale-110"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          star <= rating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Пряме переведення на стажування */}
            {status === 'Завершено' && (
              <div className="bg-white p-3.5 rounded-xl border border-teal-200/80 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={directToIntern}
                    onChange={(e) => setDirectToIntern(e.target.checked)}
                    className="h-4 w-4 rounded-md text-teal-700 focus:ring-teal-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4 text-teal-700" />
                    <span>Одразу зарахувати на стажування</span>
                  </span>
                </label>

                {directToIntern && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 animate-fade-in">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Дата початку стажування
                      </label>
                      <input
                        type="date"
                        value={internStartDate}
                        onChange={(e) => setInternStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Наставник / Ментор
                      </label>
                      <input
                        type="text"
                        value={internMentor}
                        onChange={(e) => setInternMentor(e.target.value)}
                        placeholder="HR Менеджер"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Направлення на співбесіду до керівника (2-й етап) */}
            {(result === 'Співбесіда з керівником' || status === 'Завершено') && (
              <div className={`p-3.5 rounded-xl border transition space-y-3 ${
                result === 'Співбесіда з керівником'
                  ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={result === 'Співбесіда з керівником'}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setResult('Співбесіда з керівником');
                          setDirectToIntern(false);
                          if (!managerDateTime) {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            tomorrow.setHours(11, 0, 0, 0);
                            const pad = (n: number) => n < 10 ? '0' + n : n;
                            setManagerDateTime(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}T11:00`);
                          }
                        } else {
                          setResult('Співбесіда пройшла успішно');
                        }
                      }}
                      className="h-4 w-4 rounded-md text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <UserCheck className="h-4 w-4 text-indigo-600" />
                      <span>Направити на співбесіду до керівника (2-й етап)</span>
                    </span>
                  </label>
                  {result === 'Співбесіда з керівником' && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
                      Статус: Співбесіда з керівником
                    </span>
                  )}
                </div>

                {result === 'Співбесіда з керівником' && (
                  <div className="space-y-3 pt-2 border-t border-indigo-100 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Керівник (ПІБ або посада)
                        </label>
                        <input
                          type="text"
                          value={managerName}
                          onChange={(e) => setManagerName(e.target.value)}
                          placeholder="напр. Іванчук О.В. / Керівник відділу"
                          className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Дата та час зустрічі з керівником
                        </label>
                        <input
                          type="datetime-local"
                          value={managerDateTime}
                          onChange={(e) => setManagerDateTime(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-800 bg-indigo-100/70 px-3 py-2 rounded-xl mt-1">
                      <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span>Всі деталі співбесіди з керівником зберігаються в цій же картці без створення зайвих дублікатів</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: Коментар та нотатки */}
          <div className="bg-slate-50/70 border border-slate-200/70 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between text-slate-800 font-extrabold text-sm border-b border-slate-200/60 pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-teal-700" />
                <span>3. Коментар та нотатки</span>
              </div>
              <span className="text-[11px] text-slate-400 font-normal">для внутрішніх заміток</span>
            </div>

            {/* Швидкі теги */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500">Швидкі нотатки:</span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setFeedback((prev) => (prev ? `${prev}; ${tag}` : tag));
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-300 rounded-lg text-[11px] font-medium transition cursor-pointer shadow-2xs"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Вкажіть враження від кандидата, домовленості, коментарі щодо досвіду тощо..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {selectedInterview && onDeleteInterview ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Видалити співбесіду з ${selectedInterview.candidateName}?`)) {
                    onDeleteInterview(selectedInterview.id);
                    onClose();
                  }
                }}
                className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition border border-rose-200/60 cursor-pointer"
                title="Видалити співбесіду"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="submit"
                id="save-interview-submit"
                className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{selectedInterview ? 'Зберегти зміни' : 'Призначити співбесіду'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
