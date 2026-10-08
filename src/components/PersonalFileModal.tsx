import React, { useState, useEffect, useRef } from 'react';
import { 
  HRSystemData, 
  Candidate, 
  Interview, 
  Intern, 
  FiredEmployee, 
  CandidateStatus, 
  InterviewStatus, 
  InterviewResult, 
  InternStatus 
} from '../types';
import { 
  formatDate, 
  formatDateTime, 
  getTodayDateString, 
  getTodayDateTimeString, 
  calculateTenureMonths, 
  formatDateForInput 
} from '../lib/dateUtils';
import { DEFAULT_FIRED_REASONS } from '../App';
import { 
  X, 
  User, 
  Phone, 
  Calendar, 
  Star, 
  Award, 
  Clock, 
  FileText, 
  Edit2, 
  Save, 
  Plus, 
  Copy, 
  Check, 
  Eye, 
  CheckCircle2, 
  PauseCircle, 
  XCircle, 
  RotateCcw, 
  MessageSquare, 
  Briefcase, 
  CheckCheck,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserX,
  Building2,
  CalendarCheck,
  ExternalLink,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { CvPreviewModal } from './CvPreviewModal';

interface PersonalFileModalProps {
  candidateId: string;
  data: HRSystemData;
  onClose: () => void;
  onUpdateCandidate: (c: Candidate) => void;
  onUpdateIntern?: (i: Intern) => void;
  onUpdateInterview?: (i: Interview) => void;
  onAddInterview?: (i: Omit<Interview, 'id'>) => void;
  onDeleteInterview?: (interviewId: string) => void;
  onAddIntern?: (i: Omit<Intern, 'id'>) => void;
  onDeleteIntern?: (internId: string) => void;
  onUpdateFiredEmployee?: (f: FiredEmployee) => void;
}

// 5 послідовних кроків воронки
const SEQUENTIAL_STAGES: CandidateStatus[] = [
  'Новий',
  'Повідомлення',
  'Співбесіда',
  'Стажування',
  'Працевлаштовано'
];

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

function calculateAge(birthDate: string | undefined | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  return age >= 0 && age < 120 ? age : null;
}

export default function PersonalFileModal({
  candidateId,
  data,
  onClose,
  onUpdateCandidate,
  onUpdateIntern,
  onUpdateInterview,
  onAddInterview,
  onDeleteInterview,
  onAddIntern,
  onDeleteIntern,
  onUpdateFiredEmployee
}: PersonalFileModalProps) {
  // Знаходимо кандидата або пов'язані записи
  const firedEmployeeById = data.firedEmployees?.find(f => f.id === candidateId || f.candidateId === candidateId);
  const internById = data.interns?.find(i => i.id === candidateId || i.candidateId === candidateId);
  const interviewById = data.interviews?.find(i => i.id === candidateId || i.candidateId === candidateId);

  // Знаходимо кандидата за прямим id або зв'язком
  const candidate = data.candidates.find(c => c.id === candidateId) ||
                    (firedEmployeeById ? data.candidates.find(c => (firedEmployeeById.candidateId && c.id === firedEmployeeById.candidateId) || c.name.trim().toLowerCase() === firedEmployeeById.name.trim().toLowerCase()) : undefined) ||
                    (internById ? data.candidates.find(c => (internById.candidateId && c.id === internById.candidateId) || c.name.trim().toLowerCase() === internById.candidateName.trim().toLowerCase()) : undefined) ||
                    (interviewById ? data.candidates.find(c => (interviewById.candidateId && c.id === interviewById.candidateId) || c.name.trim().toLowerCase() === interviewById.candidateName.trim().toLowerCase()) : undefined);

  const name = candidate?.name || 
               firedEmployeeById?.name || 
               interviewById?.candidateName || 
               internById?.candidateName || 
               'Невідомий кандидат';

  const firedRecord = data.firedEmployees.find(f => 
    f.id === candidateId || 
    f.candidateId === candidateId ||
    (candidate && (f.candidateId === candidate.id || f.name.trim().toLowerCase() === candidate.name.trim().toLowerCase())) ||
    f.name.trim().toLowerCase() === name.trim().toLowerCase()
  );

  const vacancy = data.vacancies.find(v => v.id === (candidate?.vacancyId || '')) ||
                  data.vacancies.find(v => v.title.toLowerCase() === (firedRecord?.position || internById?.position || '').toLowerCase());
  const dismissalReasonsList = (data.firedReasonsList && data.firedReasonsList.length > 0) ? data.firedReasonsList : DEFAULT_FIRED_REASONS;

  // Пов'язані записи
  const interviews = data.interviews.filter(i => 
    i.candidateId === candidateId || 
    (candidate && (i.candidateId === candidate.id || i.candidateName.trim().toLowerCase() === candidate.name.trim().toLowerCase())) ||
    i.candidateName.trim().toLowerCase() === name.trim().toLowerCase()
  );
  const interns = data.interns.filter(i => 
    i.candidateId === candidateId || 
    (candidate && (i.candidateId === candidate.id || i.candidateName.trim().toLowerCase() === candidate.name.trim().toLowerCase())) ||
    i.candidateName.trim().toLowerCase() === name.trim().toLowerCase()
  );

  // Найновіша / активна співбесіда
  const latestInterview = interviews[interviews.length - 1];
  // Попередні співбесіди (якщо їх більше 1)
  const previousInterviews = interviews.slice(0, -1);
  // Найновіше / активне стажування
  const latestIntern = interns[interns.length - 1];

  // Стан редагування анкети
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editContactDate, setEditContactDate] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editSourceDetails, setEditSourceDetails] = useState('');
  const [editVacancyId, setEditVacancyId] = useState('');
  const [editCallType, setEditCallType] = useState<'Гарячий' | 'Холодний'>('Гарячий');
  const [editHasDocuments, setEditHasDocuments] = useState(false);

  // Нотатки рекрутера
  const [commentText, setCommentText] = useState('');

  // Тост успішного збереження
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const successTimeoutRef = useRef<any>(null);

  const showSaveSuccess = (msg: string = 'Дані успішно збережено!') => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    setSaveSuccessMessage(msg);
    successTimeoutRef.current = setTimeout(() => {
      setSaveSuccessMessage(null);
    }, 2500);
  };

  // Entity tracking & Debounced Note Saving to prevent losing spaces or caret jumping
  const currentEntityId = candidate?.id || firedRecord?.id || internById?.id || '';
  const lastLoadedIdRef = useRef<string | null>(null);
  const saveNotesTimeoutRef = useRef<any>(null);
  const pendingNotesRef = useRef<string | null>(null);

  // Reference to current entities to avoid stale closures in timeouts and blur
  const entityRef = useRef({
    candidate,
    internById,
    firedRecord,
    latestIntern,
    vacancy,
    onUpdateCandidate,
    onUpdateIntern,
    onUpdateFiredEmployee
  });

  useEffect(() => {
    entityRef.current = {
      candidate,
      internById,
      firedRecord,
      latestIntern,
      vacancy,
      onUpdateCandidate,
      onUpdateIntern,
      onUpdateFiredEmployee
    };
  });

  // Допоміжні стани
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewCv, setPreviewCv] = useState<{ candidateName: string; fileName?: string; fileContent?: string; cvLink?: string } | null>(null);
  const [showHistoryInterviews, setShowHistoryInterviews] = useState(false);

  // Модалка відхилення
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionType, setRejectionType] = useState<'candidate' | 'company'>('company');
  const [rejectionSelect, setRejectionSelect] = useState('');
  const [rejectionCustom, setRejectionCustom] = useState('');

  // Форма створення/редагування співбесіди
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [editingInterviewId, setEditingInterviewId] = useState<string | null>(null);
  const [intDateTime, setIntDateTime] = useState('');
  const [intInterviewer, setIntInterviewer] = useState('');
  const [intStatus, setIntStatus] = useState<InterviewStatus>('Заплановано');
  const [intResult, setIntResult] = useState<InterviewResult>('Очікує рішення');
  const [intRating, setIntRating] = useState(0);
  const [intFeedback, setIntFeedback] = useState('');

  // Форма створення/редагування стажування
  const [showInternForm, setShowInternForm] = useState(false);
  const [editingInternId, setEditingInternId] = useState<string | null>(null);
  const [internPosition, setInternPosition] = useState('');
  const [internDepartment, setInternDepartment] = useState('');
  const [internStartDate, setInternStartDate] = useState('');
  const [internEndDate, setInternEndDate] = useState('');
  const [internMentor, setInternMentor] = useState('');
  const [internProject, setInternProject] = useState('');
  const [internProgress, setInternProgress] = useState(0);
  const [internStatus, setInternStatus] = useState<InternStatus>('Триває');
  const [internRejectionReason, setInternRejectionReason] = useState('');
  const [confirmDeleteIntern, setConfirmDeleteIntern] = useState(false);

  // Форма редагування звільнення (якщо є архів)
  const [showFiredForm, setShowFiredForm] = useState(false);
  const [firedReason, setFiredReason] = useState('');
  const [firedNotes, setFiredNotes] = useState('');
  const [firedStartDate, setFiredStartDate] = useState('');
  const [firedEndDate, setFiredEndDate] = useState('');
  const [firedDocsReturned, setFiredDocsReturned] = useState(false);
  const [firedTransferNotes, setFiredTransferNotes] = useState('');

  // Функція для синхронізації полів форми з актуальними даними
  const syncFieldsFromEntity = () => {
    if (candidate) {
      setEditName(candidate.name || '');
      setEditPhone(candidate.phone || '');
      setEditBirthDate(formatDateForInput(candidate.birthDate));
      setEditContactDate(formatDateForInput(candidate.contactDate));
      setEditSource(candidate.source || '');
      setEditSourceDetails(candidate.sourceDetails || '');
      setEditVacancyId(candidate.vacancyId || '');
      setEditCallType(candidate.callType || 'Гарячий');
      setEditHasDocuments(Boolean(candidate.hasDocuments));
      const rawComment = candidate.comment || latestInterview?.feedback || '';
      const cleanComment = rawComment
        .replace(/\[(Фідбек співбесіди|Експрес-співбесіда[^\]]*)\]:\s*/g, '');
      setCommentText(cleanComment);
      pendingNotesRef.current = cleanComment;
    } else if (internById) {
      setEditName(internById.candidateName || '');
      setEditPhone(internById.phone || '');
      setEditBirthDate(formatDateForInput(internById.birthDate));
      setEditContactDate(formatDateForInput(internById.startDate));
      setEditSource('Стажування');
      setEditVacancyId(vacancy?.id || '');
      setCommentText(internById.comment || '');
      pendingNotesRef.current = internById.comment || '';
      setEditHasDocuments(Boolean(internById.hasDocuments));
    } else if (firedRecord) {
      setEditName(firedRecord.name || '');
      setEditPhone(firedRecord.phone || '');
      setEditContactDate(formatDateForInput(firedRecord.startDate));
      setEditSource('Звільнені співробітники');
      setEditVacancyId(vacancy?.id || '');
      setCommentText(firedRecord.exitNotes || '');
      pendingNotesRef.current = firedRecord.exitNotes || '';
      setEditHasDocuments(Boolean(firedRecord.hasDocumentsReturned));
    }
  };

  // Початкове завантаження даних при відкритті нової сутності або зміні ID
  useEffect(() => {
    if (currentEntityId && currentEntityId !== lastLoadedIdRef.current) {
      lastLoadedIdRef.current = currentEntityId;
      syncFieldsFromEntity();
    }
  }, [currentEntityId, candidate, firedRecord, internById]);

  // Відкрити форму редагування анкети
  const handleStartEdit = () => {
    syncFieldsFromEntity();
    setIsEditing(true);
  };

  // Збереження оновленої анкети
  const handleSaveProfile = () => {
    const trimmedName = editName.trim();
    const finalComment = pendingNotesRef.current !== null && pendingNotesRef.current !== undefined 
      ? pendingNotesRef.current 
      : (commentText || candidate?.comment || '');

    if (candidate) {
      onUpdateCandidate({
        ...candidate,
        name: trimmedName || candidate.name,
        phone: editPhone.trim(),
        birthDate: editBirthDate,
        contactDate: editContactDate,
        source: editSource,
        sourceDetails: editSource.toLowerCase().includes('інше') ? (editSourceDetails.trim() || undefined) : undefined,
        vacancyId: editVacancyId,
        callType: editCallType,
        hasDocuments: editHasDocuments,
        comment: finalComment
      });

      // Синхронізуємо також дані в записі стажера, якщо він є (зберігаючи дату початку стажування)
      if (latestIntern && onUpdateIntern) {
        onUpdateIntern({
          ...latestIntern,
          candidateName: trimmedName || latestIntern.candidateName,
          phone: editPhone.trim() || latestIntern.phone,
          birthDate: editBirthDate || latestIntern.birthDate,
          startDate: latestIntern.startDate,
          hasDocuments: editHasDocuments
        });
      }
    } else if (internById && onUpdateIntern) {
      onUpdateIntern({
        ...internById,
        candidateName: trimmedName || internById.candidateName,
        phone: editPhone.trim(),
        birthDate: editBirthDate,
        startDate: editContactDate || internById.startDate,
        position: vacancy?.title || internById.position,
        department: vacancy?.department || internById.department,
        hasDocuments: editHasDocuments,
        comment: finalComment
      });
    } else if (firedRecord && onUpdateFiredEmployee) {
      onUpdateFiredEmployee({
        ...firedRecord,
        name: trimmedName || firedRecord.name,
        phone: editPhone.trim(),
        position: vacancy?.title || firedRecord.position,
        department: vacancy?.department || firedRecord.department,
        exitNotes: finalComment,
        hasDocumentsReturned: editHasDocuments
      });
    }

    setIsEditing(false);
    showSaveSuccess('Анкетні дані успішно збережено!');
  };

  // Фактичне збереження нотаток у стан додатку без втрати пробілів та зміщення курсору
  const commitNotes = (text: string) => {
    const { candidate: c, internById: inById, firedRecord: fr, onUpdateCandidate: updC, onUpdateIntern: updIn, onUpdateFiredEmployee: updFr } = entityRef.current;
    if (c && updC) {
      updC({
        ...c,
        comment: text
      });
    } else if (inById && updIn) {
      updIn({
        ...inById,
        comment: text
      });
    } else if (fr && updFr) {
      updFr({
        ...fr,
        exitNotes: text
      });
    }
  };

  // Збереження єдиної графи нотаток із плавним дебаунсом
  const handleSaveNotes = (text: string) => {
    setCommentText(text);
    pendingNotesRef.current = text;
    if (saveNotesTimeoutRef.current) {
      clearTimeout(saveNotesTimeoutRef.current);
    }
    saveNotesTimeoutRef.current = setTimeout(() => {
      commitNotes(text);
    }, 500);
  };

  const handleNotesBlur = () => {
    if (saveNotesTimeoutRef.current) {
      clearTimeout(saveNotesTimeoutRef.current);
    }
    if (pendingNotesRef.current !== null && pendingNotesRef.current !== undefined) {
      commitNotes(pendingNotesRef.current);
    }
  };

  // Фіксуємо нотатки при закритті модального вікна
  useEffect(() => {
    return () => {
      if (saveNotesTimeoutRef.current) {
        clearTimeout(saveNotesTimeoutRef.current);
      }
      if (pendingNotesRef.current !== null && pendingNotesRef.current !== undefined) {
        commitNotes(pendingNotesRef.current);
      }
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  // Копіювання номера телефону
  const handleCopyPhone = (phone: string) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Копіювання шаблону
  const handleCopyTemplate = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplate(key);
    setTimeout(() => setCopiedTemplate(null), 2500);
  };

  // Зміна етапу у воронці
  const handleStageSelect = (stage: CandidateStatus) => {
    if (!candidate) return;
    if (stage === 'Відхилено') {
      setRejectionSelect('');
      setRejectionCustom('');
      setShowRejectionModal(true);
      return;
    }

    onUpdateCandidate({
      ...candidate,
      status: stage,
      rejectionReason: ''
    });

    if (stage === 'Резерв' && latestIntern && onDeleteIntern) {
      onDeleteIntern(latestIntern.id);
    }

    // Якщо обрано Співбесіду і ще немає записів — відкриваємо форму призначення
    if (stage === 'Співбесіда') {
      if (interviews.length === 0) {
        handleOpenAddInterview();
      }
    } else if (stage === 'Стажування') {
      if (interns.length === 0) {
        handleOpenAddIntern();
      }
    }
  };

  // Підтвердження відхилення
  const handleConfirmRejection = () => {
    if (!candidate) return;
    const finalReason = rejectionCustom.trim() || rejectionSelect || (rejectionType === 'candidate' ? 'Відмова кандидата' : 'Невідповідність вимогам');
    const targetStatus: CandidateStatus = rejectionType === 'candidate' ? 'Відмова кандидата' : 'Відмова компанії';
    onUpdateCandidate({
      ...candidate,
      status: targetStatus,
      rejectionReason: finalReason
    });
    setShowRejectionModal(false);
  };

  // Зміна рейтингу
  const handleSetRating = (star: number) => {
    if (!candidate) return;
    onUpdateCandidate({
      ...candidate,
      rating: candidate.rating === star ? 0 : star
    });
  };

  // ================= СПІВБЕСІДИ =================
  const handleOpenAddInterview = () => {
    setIntDateTime(getTodayDateTimeString());
    setIntInterviewer('');
    setIntStatus('Заплановано');
    setIntResult('Очікує рішення');
    setIntRating(candidate?.rating || 0);
    setIntFeedback('');
    setEditingInterviewId(null);
    setShowInterviewForm(true);
  };

  const handleOpenEditInterview = (i: Interview) => {
    setIntDateTime(i.dateTime || getTodayDateTimeString());
    setIntInterviewer(i.interviewer || '');
    setIntStatus(i.status || 'Заплановано');
    setIntResult(i.result || 'Очікує рішення');
    setIntRating(i.rating || 0);
    setIntFeedback(i.feedback || '');
    setEditingInterviewId(i.id);
    setShowInterviewForm(true);
  };

  const handleSaveInterview = () => {
    if (editingInterviewId && onUpdateInterview) {
      const existing = interviews.find(i => i.id === editingInterviewId);
      if (existing) {
        onUpdateInterview({
          ...existing,
          dateTime: intDateTime,
          interviewer: intInterviewer.trim() || 'Рекрутер',
          status: intStatus,
          result: intResult,
          rating: intRating,
          feedback: intFeedback.trim()
        });
      }
    } else if (onAddInterview) {
      onAddInterview({
        candidateId: candidate?.id || firedRecord?.candidateId || internById?.candidateId || candidateId,
        candidateName: name,
        dateTime: intDateTime || getTodayDateTimeString(),
        interviewer: intInterviewer.trim() || 'Рекрутер',
        status: intStatus,
        result: intResult,
        rating: intRating,
        feedback: intFeedback.trim()
      });
      // Оновлюємо статус кандидата до Співбесіда, якщо був Новий чи Повідомлення
      if (candidate && (candidate.status === 'Новий' || candidate.status === 'Повідомлення' || candidate.status === 'Скринінг')) {
        onUpdateCandidate({ ...candidate, status: 'Співбесіда' });
      }
    }
    setShowInterviewForm(false);
    setEditingInterviewId(null);
    showSaveSuccess('Дані співбесіди збережено!');
  };

  // ================= СТАЖУВАННЯ =================
  const handleOpenAddIntern = () => {
    setInternPosition(vacancy ? vacancy.title : 'Стажер');
    setInternDepartment(vacancy?.department || 'Загальний');
    setInternStartDate(getTodayDateString());
    setInternEndDate('');
    setInternMentor('');
    setInternProject('');
    setInternProgress(0);
    setInternStatus('Триває');
    setInternRejectionReason('');
    setEditingInternId(null);
    setShowInternForm(true);
  };

  const handleOpenEditIntern = (intern: Intern) => {
    setInternPosition(intern.position || '');
    setInternDepartment(intern.department || '');
    setInternStartDate(formatDateForInput(intern.startDate) || intern.startDate || '');
    setInternEndDate(formatDateForInput(intern.endDate) || intern.endDate || '');
    setInternMentor(intern.mentor || '');
    setInternProject(intern.project || '');
    setInternProgress(intern.progress || 0);
    setInternStatus(intern.status || 'Триває');
    setInternRejectionReason(intern.rejectionReason || '');
    setEditingInternId(intern.id);
    setShowInternForm(true);
  };

  const handleSaveIntern = () => {
    const isFailedOrRefused = internStatus === 'Не пройшов' || internStatus === 'Відмовився';
    const finalInternReason = isFailedOrRefused ? internRejectionReason.trim() : '';

    if (editingInternId && onUpdateIntern) {
      const existing = interns.find(i => i.id === editingInternId) || data.interns.find(i => i.id === editingInternId);
      if (existing) {
        onUpdateIntern({
          ...existing,
          position: internPosition.trim() || 'Стажер',
          department: internDepartment.trim() || 'Загальний',
          startDate: internStartDate,
          endDate: internEndDate,
          mentor: internMentor.trim(),
          project: internProject.trim(),
          progress: existing.progress || 0,
          status: internStatus,
          rejectionReason: finalInternReason
        });
      }

      if (candidate) {
        let newCandStatus = candidate.status;
        let newRejectionReason = candidate.rejectionReason;
        if (internStatus === 'Не пройшов') {
          newCandStatus = 'Відмова компанії';
          newRejectionReason = finalInternReason || 'Не пройшов стажування';
        } else if (internStatus === 'Відмовився') {
          newCandStatus = 'Відмова кандидата';
          newRejectionReason = finalInternReason || 'Відмовився від стажування';
        } else if (internStatus === 'Триває') {
          newCandStatus = 'Стажування';
          newRejectionReason = '';
        } else if (internStatus === 'Успішно завершено') {
          newCandStatus = 'Працевлаштовано';
          newRejectionReason = '';
        }

        onUpdateCandidate({
          ...candidate,
          status: newCandStatus,
          rejectionReason: newRejectionReason,
          contactDate: candidate.contactDate
        });
      }
    } else if (onAddIntern) {
      onAddIntern({
        candidateId: candidate?.id || firedRecord?.candidateId || internById?.candidateId || candidateId,
        candidateName: name,
        birthDate: candidate?.birthDate || internById?.birthDate || '',
        phone: candidate?.phone || internById?.phone || '',
        position: internPosition.trim() || vacancy?.title || 'Стажер',
        department: internDepartment.trim() || vacancy?.department || 'Загальний',
        startDate: internStartDate || getTodayDateString(),
        endDate: internEndDate,
        mentor: internMentor.trim(),
        project: internProject.trim(),
        progress: 0,
        status: internStatus,
        rating: candidate?.rating || 0,
        comment: '',
        hasDocuments: Boolean(candidate?.hasDocuments || editHasDocuments),
        rejectionReason: finalInternReason
      });
      // Переводимо кандидата на Стажування
      if (candidate && candidate.status !== 'Стажування') {
        onUpdateCandidate({ ...candidate, status: 'Стажування' });
      }
    }
    setShowInternForm(false);
    setEditingInternId(null);
    showSaveSuccess('Дані стажування збережено!');
  };

  // Працевлаштувати зі стажування
  const handleHireFromInternship = (internRecord?: Intern) => {
    if (candidate) {
      onUpdateCandidate({ ...candidate, status: 'Працевлаштовано' });
    }
    if (internRecord && onUpdateIntern) {
      onUpdateIntern({
        ...internRecord,
        status: 'Успішно завершено',
        progress: 100,
        endDate: internRecord.endDate || getTodayDateString()
      });
    }
    showSaveSuccess('Працівника успішно зараховано в штат!');
  };

  // ================= ЗВІЛЬНЕННЯ =================
  const handleStartEditFired = () => {
    if (!firedRecord) return;
    setFiredReason(firedRecord.reason || '');
    setFiredNotes(firedRecord.exitNotes || '');
    setFiredStartDate(firedRecord.startDate || '');
    setFiredEndDate(firedRecord.endDate || '');
    setFiredDocsReturned(Boolean(firedRecord.hasDocumentsReturned));
    setFiredTransferNotes(firedRecord.transferCaseNotes || '');
    setShowFiredForm(true);
  };

  const handleSaveFired = () => {
    if (!firedRecord || !onUpdateFiredEmployee) return;
    const tenure = calculateTenureMonths(firedStartDate, firedEndDate);
    onUpdateFiredEmployee({
      ...firedRecord,
      reason: firedReason,
      exitNotes: firedNotes,
      startDate: firedStartDate,
      endDate: firedEndDate,
      tenureMonths: tenure,
      hasDocumentsReturned: firedDocsReturned,
      transferCaseNotes: firedTransferNotes
    });
    setShowFiredForm(false);
    showSaveSuccess('Дані звільнення збережено!');
  };

  // Поточний статус
  const currentNormalizedStatus = (candidate?.status === 'Скринінг' ? 'Повідомлення' : candidate?.status) || 'Новий';
  const currentStageIndex = SEQUENTIAL_STAGES.indexOf(currentNormalizedStatus as CandidateStatus);
  const isSpecialStatus = candidate?.status === 'Подумає' || candidate?.status === 'Відмова кандидата' || candidate?.status === 'Відмова компанії' || candidate?.status === 'Відхилено';

  // Видалення співбесіди
  const handleDeleteInterview = (interviewId: string) => {
    if (onDeleteInterview) {
      onDeleteInterview(interviewId);
      showSaveSuccess('Співбесіду видалено');
    }
  };

  // Швидка зміна статусу співбесіди (в 1 клік)
  const handleQuickUpdateInterviewStatus = (status: InterviewStatus) => {
    if (latestInterview && onUpdateInterview) {
      onUpdateInterview({
        ...latestInterview,
        status
      });
    }
  };

  // Швидка зміна результату співбесіди
  const handleQuickUpdateInterviewResult = (result: InterviewResult) => {
    if (latestInterview && onUpdateInterview) {
      onUpdateInterview({
        ...latestInterview,
        result
      });
      if (result === 'Співбесіда з керівником' && candidate) {
        onUpdateCandidate({
          ...candidate,
          status: 'Співбесіда з керівником'
        });
      }
    }
  };

  // Швидка зміна оцінки співбесіди
  const handleQuickUpdateInterviewRating = (rating: number) => {
    if (latestInterview && onUpdateInterview) {
      onUpdateInterview({
        ...latestInterview,
        rating: latestInterview.rating === rating ? 0 : rating
      });
    }
  };

  // Шаблони швидкого повідомлення
  const vacancyTitle = vacancy ? vacancy.title : 'відкриту посаду';
  const candidateFirstName = name.split(' ')[0] || 'Кандидате';
  const messageTemplate = `Добрий день, ${candidateFirstName}! Дякуємо за ваш відгук на вакансію «${vacancyTitle}». Чи актуальний для вас зараз пошук роботи? Підкажіть, коли вам зручно поспілкуватися для знайомства?`;

  const calculatedAge = calculateAge(candidate?.birthDate);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-fade-in text-left">
      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-200/90 max-w-6xl w-full max-h-[96vh] overflow-hidden flex flex-col">
        {saveSuccessMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-60 px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-full shadow-lg flex items-center space-x-1.5 animate-fade-in pointer-events-none">
            <CheckCircle2 className="h-4 w-4 text-white" />
            <span>{saveSuccessMessage}</span>
          </div>
        )}
        
        {/* =========================================================================
            1. ВЕРХНЯ ШАПКА КАРТКИ КАНДИДАТА
           ========================================================================= */}
        <div className="px-5 py-3.5 bg-slate-50/90 border-b border-slate-200">
          <div className="flex items-center justify-between gap-3">
            
            <div className="flex items-center space-x-3 min-w-0">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border shadow-xs ${
                candidate?.status === 'Працевлаштовано' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                candidate?.status === 'Стажування' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                candidate?.status === 'Співбесіда' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
                candidate?.status === 'Повідомлення' ? 'bg-sky-100 text-sky-800 border-sky-300' :
                candidate?.status === 'Відмова кандидата' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                (candidate?.status === 'Відмова компанії' || candidate?.status === 'Відхилено') ? 'bg-rose-100 text-rose-800 border-rose-300' :
                candidate?.status === 'Подумає' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                'bg-slate-200 text-slate-700 border-slate-300'
              }`}>
                {name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'КК'}
              </div>

              <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <h3 className="text-lg font-extrabold text-slate-900 tracking-tight truncate max-w-sm sm:max-w-md">
                    {name}
                  </h3>

                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border shrink-0 ${
                    candidate?.status === 'Працевлаштовано' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                    candidate?.status === 'Стажування' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                    candidate?.status === 'Співбесіда' ? 'bg-indigo-50 text-indigo-700 border-indigo-300' :
                    candidate?.status === 'Повідомлення' ? 'bg-sky-50 text-sky-700 border-sky-300' :
                    candidate?.status === 'Відмова кандидата' ? 'bg-amber-50 text-amber-900 border-amber-300' :
                    (candidate?.status === 'Відмова компанії' || candidate?.status === 'Відхилено') ? 'bg-rose-50 text-rose-700 border-rose-300' :
                    candidate?.status === 'Подумає' ? 'bg-purple-50 text-purple-700 border-purple-300' :
                    'bg-slate-100 text-slate-700 border-slate-300'
                  }`}>
                    {currentNormalizedStatus}
                  </span>

                  {candidate?.callType && (
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      candidate.callType === 'Гарячий' ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-sky-700 bg-sky-50 border border-sky-200'
                    }`}>
                      {candidate.callType === 'Гарячий' ? '🔥 Гарячий' : '❄️ Холодний'}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium mt-0.5">
                  <span className="font-bold text-slate-700 flex items-center space-x-1">
                    <Briefcase className="h-3 w-3 text-slate-400" />
                    <span>{vacancy ? vacancy.title : 'Загальна база'}</span>
                    {vacancy?.department && (
                      <span className="text-slate-400 font-normal">({vacancy.department})</span>
                    )}
                  </span>
                  {candidate?.source && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-600 font-semibold inline-flex items-center gap-1">
                        <span>{candidate.source}</span>
                        {candidate.sourceDetails && (
                          <span className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded px-1.5 font-bold" title={`Уточнення джерела: ${candidate.sourceDetails}`}>
                            📌 {candidate.sourceDetails}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Рейтинг, Кнопка редагування анкети, Закрити */}
            <div className="flex items-center space-x-2 shrink-0">
              <div className="hidden sm:flex items-center space-x-0.5 bg-white border border-slate-200 px-2 py-1 rounded-xl shadow-xs" title="Рейтинг кандидата">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleSetRating(star)}
                    className="p-0.5 cursor-pointer hover:scale-110 transition"
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${
                        star <= (candidate?.rating || 0)
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-slate-200'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {isEditing ? (
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-xs"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Зберегти анкету</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Скасувати
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                  title="Редагувати анкетні дані"
                >
                  <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Редагувати анкету</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition cursor-pointer"
                title="Закрити картку"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            2. ЕТАПИ ВОРОНКИ НАЙМУ (ШВИДКИЙ ПЕРЕХІД)
           ========================================================================= */}
        <div className="bg-slate-100/80 px-5 py-2.5 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-1 overflow-x-auto py-0.5">
              {SEQUENTIAL_STAGES.map((stg, idx) => {
                const isCurrent = currentNormalizedStatus === stg;
                const isPassed = !isSpecialStatus && currentStageIndex > idx;

                return (
                  <React.Fragment key={stg}>
                    <button
                      type="button"
                      onClick={() => handleStageSelect(stg)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                        isCurrent
                          ? 'bg-teal-700 text-white shadow-xs ring-2 ring-teal-200'
                          : isPassed
                          ? 'bg-emerald-100/80 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
                      }`}
                      title={`Перевести на етап «${stg}»`}
                    >
                      <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                        isCurrent ? 'bg-white/20 text-white' :
                        isPassed ? 'bg-emerald-600 text-white' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {isPassed ? '✓' : idx + 1}
                      </span>
                      <span>{stg}</span>
                    </button>
                    {idx < SEQUENTIAL_STAGES.length - 1 && (
                      <span className="text-slate-300 font-bold px-0.5">➔</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Спеціальні статуси: Подумає / Відмова кандидата / Відмова компанії */}
            <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-auto flex-wrap gap-y-1">
              <button
                type="button"
                onClick={() => handleStageSelect('Подумає')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center space-x-1 ${
                  candidate?.status === 'Подумає'
                    ? 'bg-purple-100 text-purple-900 border-purple-400 font-extrabold ring-1 ring-purple-300'
                    : 'bg-white hover:bg-purple-50 text-purple-700 border-purple-200'
                }`}
                title="Поставити кандидата на паузу (думає)"
              >
                <PauseCircle className="h-3.5 w-3.5 text-purple-600" />
                <span>Подумає</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRejectionType('candidate');
                  setRejectionSelect('');
                  setRejectionCustom('');
                  setShowRejectionModal(true);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center space-x-1 ${
                  candidate?.status === 'Відмова кандидата'
                    ? 'bg-amber-100 text-amber-900 border-amber-400 font-extrabold ring-1 ring-amber-300'
                    : 'bg-white hover:bg-amber-50 text-amber-800 border-amber-200'
                }`}
                title="Кандидат відмовився від вакансії"
              >
                <UserX className="h-3.5 w-3.5 text-amber-600" />
                <span>Відмова кандидата</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRejectionType('company');
                  setRejectionSelect('');
                  setRejectionCustom('');
                  setShowRejectionModal(true);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center space-x-1 ${
                  candidate?.status === 'Відмова компанії' || candidate?.status === 'Відхилено'
                    ? 'bg-rose-100 text-rose-900 border-rose-400 font-extrabold ring-1 ring-rose-300'
                    : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200'
                }`}
                title="Компанія відмовила кандидату"
              >
                <XCircle className="h-3.5 w-3.5 text-rose-600" />
                <span>Відмова компанії</span>
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. ГОЛОВНА ОБЛАСТЬ: ДВІ ЗРУЧНІ КОЛОНКИ БЕЗ ПЕРЕМИКАННЯ ВКЛАДОК
           ========================================================================= */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/50">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:divide-x divide-slate-200 min-h-full">
            
            {/* =====================================================================
                ЛІВА КОЛОНКА: АНКЕТНІ ДАНІ, РЕЗЮМЕ, ШВИДКЕ ПОВІДОМЛЕННЯ ТА НОТАТКИ (lg:col-span-5)
               ===================================================================== */}
            <div className="lg:col-span-5 p-5 space-y-4 bg-white">
              
              {/* БЛОК 1: АНКЕТА ТА КОНТАКТИ */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center">
                    <User className="h-3.5 w-3.5 text-teal-600 mr-1.5" />
                    Анкета та контакти
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      if (!candidate) return;
                      onUpdateCandidate({ ...candidate, hasDocuments: !candidate.hasDocuments });
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                      candidate?.hasDocuments
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                    title="Клікніть для зміни статусу документів"
                  >
                    {candidate?.hasDocuments ? '📄 Документи є' : '⚠️ Без документів'}
                  </button>
                </div>

                {isEditing ? (
                  /* ФОРМА РЕДАГУВАННЯ АНКЕТИ */
                  <div className="space-y-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">ПІБ кандидата:</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Телефон:</label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Вакансія / Посада:</label>
                        <select
                          value={editVacancyId}
                          onChange={(e) => setEditVacancyId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs"
                        >
                          <option value="">-- Без вакансії --</option>
                          {data.vacancies.map(v => (
                            <option key={v.id} value={v.id}>{v.title} ({v.department || 'Основний'})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Підрозділ / Відділ:</label>
                        <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-xs text-slate-700 flex items-center space-x-1 min-h-[31px]">
                          <Building2 className="h-3 w-3 text-teal-600 shrink-0" />
                          <span className="truncate">{data.vacancies.find(v => v.id === editVacancyId)?.department || 'Основний підрозділ'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Джерело:</label>
                        <select
                          value={editSource}
                          onChange={(e) => setEditSource(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs"
                        >
                          {(data.sourcesList || ['work.ua', 'robota.ua', 'facebook', 'instagram', 'threads', 'працівник', 'внз', 'інше']).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Дата народження:</label>
                        <input
                          type="date"
                          value={editBirthDate}
                          onChange={(e) => setEditBirthDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    {editSource.toLowerCase().includes('інше') && (
                      <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-lg p-2.5 space-y-1 animate-fade-in">
                        <label className="text-[10px] font-bold text-indigo-900 uppercase block">
                          📌 Уточнення / коментар (що саме «інше»):
                        </label>
                        <input
                          type="text"
                          value={editSourceDetails}
                          onChange={(e) => setEditSourceDetails(e.target.value)}
                          placeholder="Наприклад: білборд, реклама у транспорті, ярмарок кар'єри, знайомі..."
                          className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-600"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Тип контакту:</label>
                        <select
                          value={editCallType}
                          onChange={(e) => setEditCallType(e.target.value as 'Гарячий' | 'Холодний')}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                        >
                          <option value="Гарячий">🔥 Гарячий</option>
                          <option value="Холодний">❄️ Холодний</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Документи:</label>
                        <label className="flex items-center space-x-2 mt-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editHasDocuments}
                            onChange={(e) => setEditHasDocuments(e.target.checked)}
                            className="rounded text-teal-600 h-4 w-4"
                          />
                          <span className="text-xs font-bold text-slate-700">В наявності</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2.5 border-t border-slate-200 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          syncFieldsFromEntity();
                          setIsEditing(false);
                        }}
                        className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Скасувати
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveProfile}
                        className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>Зберегти зміни</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ПЕРЕГЛЯД АНКЕТИ */
                  <div className="space-y-2 text-xs">
                    {candidate?.phone ? (
                      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-teal-600 shrink-0" />
                          <span className="font-extrabold text-slate-900 tracking-tight text-sm select-all">
                            {candidate.phone}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(candidate.phone)}
                            className="p-1 text-slate-400 hover:text-teal-700 rounded hover:bg-white transition cursor-pointer"
                            title="Скопіювати номер"
                          >
                            {copiedPhone ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>

                        <div className="flex items-center space-x-1">
                          <a
                            href={getTelegramLink(candidate.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-[10px] font-black border border-sky-200 transition"
                            title="Відкрити діалог у Telegram"
                          >
                            TG
                          </a>
                          <a
                            href={getViberLink(candidate.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-[10px] font-black border border-purple-200 transition"
                            title="Відкрити у Viber"
                          >
                            Viber
                          </a>
                          <a
                            href={`tel:${candidate.phone}`}
                            className="p-1 text-slate-600 hover:text-teal-700 hover:bg-white rounded-lg transition"
                            title="Зателефонувати"
                          >
                            📞
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-400 italic text-xs py-1">Телефон не вказано</p>
                    )}

                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-[11px] text-slate-600 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Вакансія:</span>
                        <span className="font-bold text-slate-800">{vacancy ? vacancy.title : 'Загальна база'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Підрозділ:</span>
                        <span className="font-bold text-teal-800">{vacancy?.department || 'Основний підрозділ'}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Дата народження:</span>
                        <span className="font-bold text-slate-800">
                          {candidate?.birthDate ? formatDate(candidate.birthDate) : 'Не вказано'}
                          {calculatedAge !== null && (
                            <span className="text-slate-500 font-normal ml-1">({calculatedAge} р.)</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* БЛОК 2: РЕЗЮМЕ (CV) */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center">
                    <FileText className="h-3.5 w-3.5 text-teal-600 mr-1.5" />
                    Резюме (CV)
                  </h4>
                  {candidate && (candidate.cvLink || candidate.cvFileContent) && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateCandidate({
                          ...candidate,
                          cvLink: '',
                          cvFileName: '',
                          cvFileContent: ''
                        });
                        showSaveSuccess('Резюме видалено');
                      }}
                      className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                    >
                      Видалити
                    </button>
                  )}
                </div>

                {candidate?.cvFileContent || candidate?.cvLink ? (
                  <div className="p-3 bg-teal-50/40 border border-teal-100 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 truncate max-w-[200px]">
                        {candidate.cvFileName || (candidate.cvLink ? 'Посилання на резюме' : 'Резюме кандидата')}
                      </span>
                      <span className="text-[9px] font-bold text-teal-700 bg-white px-1.5 py-0.5 rounded border border-teal-200">
                        {candidate.cvFileContent ? 'PDF/Файл' : 'URL Лінк'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewCv({
                          candidateName: candidate.name,
                          fileName: candidate.cvFileName || 'Резюме.pdf',
                          fileContent: candidate.cvFileContent,
                          cvLink: candidate.cvLink
                        })}
                        className="flex-1 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-xs flex items-center justify-center space-x-1 cursor-pointer shadow-xs"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Переглянути CV</span>
                      </button>

                      {candidate.cvFileContent && (
                        <a
                          href={candidate.cvFileContent}
                          download={candidate.cvFileName || 'resume.pdf'}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-bold text-xs"
                          title="Завантажити файл"
                        >
                          Завантажити
                        </a>
                      )}

                      {candidate.cvLink && (
                        <a
                          href={candidate.cvLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-bold text-xs"
                          title="Відкрити посилання у новій вкладці"
                        >
                          Відкрити ↗
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && candidate) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          onUpdateCandidate({
                            ...candidate,
                            cvFileName: file.name,
                            cvFileContent: ev.target?.result as string
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className={`p-3 border border-dashed rounded-xl text-center cursor-pointer transition ${
                      isDragging ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-300 hover:border-teal-500 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <label className="cursor-pointer block">
                      <span className="font-semibold text-xs block text-slate-700">
                        📎 Завантажити резюме (PDF/Word)
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Клікніть або перетягніть файл сюди</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && candidate) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              onUpdateCandidate({
                                ...candidate,
                                cvFileName: file.name,
                                cvFileContent: ev.target?.result as string
                              });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* БЛОК 3: НОТАТКИ (ЄДИНА ГРАФА ДЛЯ ВСІХ НОТАТОК ТА КОМЕНТАРІВ) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center">
                    <FileText className="h-3.5 w-3.5 text-teal-600 mr-1.5" />
                    Нотатки
                  </h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-slate-400">автозбереження</span>
                    <button
                      type="button"
                      onClick={() => {
                        commitNotes(commentText);
                        showSaveSuccess('Нотатки збережено!');
                      }}
                      className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-md text-[10px] font-bold transition cursor-pointer"
                    >
                      Зберегти
                    </button>
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={commentText}
                  onChange={(e) => handleSaveNotes(e.target.value)}
                  onBlur={handleNotesBlur}
                  placeholder="Введіть нотатки про кандидата, результати спілкування, коментарі зі співбесіди..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 font-medium text-slate-700 text-xs resize-y transition"
                />
              </div>

            </div>

            {/* =====================================================================
                ПРАВА КОЛОНКА: СПІВБЕСІДА ТА СТАЖУВАННЯ (ОБИДВА БЛОКИ ОДРАЗУ НА ЕКРАНІ!) (lg:col-span-7)
               ===================================================================== */}
            <div className="lg:col-span-7 p-5 space-y-5 bg-slate-50/60 overflow-y-auto">
              
              {/* ПОПЕРЕДЖЕННЯ: СПЕЦІАЛЬНИЙ СТАТУС (ВІДМОВА АБО ПОДУМАЄ) */}
              {(candidate?.status === 'Відмова компанії' || candidate?.status === 'Відмова кандидата' || candidate?.status === 'Відхилено') && (
                <div className={`border rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs ${
                  candidate?.status === 'Відмова кандидата'
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}>
                  <div className="flex items-center space-x-2 min-w-0">
                    {candidate?.status === 'Відмова кандидата' ? (
                      <UserX className="h-5 w-5 text-amber-600 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="font-extrabold block">
                        {candidate?.status === 'Відмова кандидата' ? 'Відмова кандидата' : 'Відмова компанії'}
                      </span>
                      <span className="truncate block font-medium">Причина: {candidate.rejectionReason || 'Не вказана'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStageSelect('Новий')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-teal-700 border border-teal-200 font-bold rounded-xl text-xs flex items-center space-x-1 cursor-pointer shrink-0 shadow-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Повернути в роботу</span>
                  </button>
                </div>
              )}

              {candidate?.status === 'Подумає' && (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-2 text-purple-900 min-w-0">
                    <PauseCircle className="h-5 w-5 text-purple-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-extrabold block">Кандидат думає</span>
                      <span className="text-purple-700 text-[11px] block">Кандидат перебуває в кадровому резерві</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStageSelect('Співбесіда')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-purple-700 border border-purple-200 font-bold rounded-xl text-xs flex items-center space-x-1 cursor-pointer shrink-0 shadow-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Відновити спілкування</span>
                  </button>
                </div>
              )}

              {/* ===================================================================
                  СЕКЦІЯ 1: СПІВБЕСІДА (ПОВНІ ДЕТАЛІ, ПІДРОЗДІЛ, КОМЕНТАР ОДРАЗУ, ВИДАЛЕННЯ)
                 =================================================================== */}
              <div className="bg-white rounded-2xl border border-indigo-200/90 shadow-xs overflow-hidden">
                
                {/* ШАПКА БЛОКУ СПІВБЕСІДИ */}
                <div className="px-4 py-3 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-2xs">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-extrabold text-slate-900 text-sm">Деталі співбесіди</h4>
                        {latestInterview ? (
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold shadow-2xs ${
                            latestInterview.status === 'Заплановано' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                            latestInterview.status === 'Завершено' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            latestInterview.status === 'Не прийшов' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                            'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {latestInterview.status}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            Не призначено
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">Посада, підрозділ, дата, результат та швидкий фідбек</p>
                    </div>
                  </div>

                  {/* Дії у шапці */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    {showInterviewForm ? (
                      <button
                        type="button"
                        onClick={() => { setShowInterviewForm(false); setEditingInterviewId(null); }}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Скасувати
                      </button>
                    ) : (
                      <>
                        {latestInterview ? (
                          <>
                            <button
                              type="button"
                              onClick={handleOpenAddInterview}
                              className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-2xs"
                              title="Призначити ще один етап співбесіди"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Ще етап</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteInterview(latestInterview.id)}
                              className="px-2.5 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-2xs"
                              title="Видалити цю співбесіду"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                              <span className="hidden sm:inline">Видалити</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={handleOpenAddInterview}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-xs"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Призначити співбесіду</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* ТІЛО БЛОКУ СПІВБЕСІДИ */}
                <div className="p-4 space-y-4">
                  {showInterviewForm ? (
                    /* ІНЛАЙН-ФОРМА СПІВБЕСІДИ */
                    <div className="space-y-3.5 text-xs bg-indigo-50/40 p-4 rounded-xl border border-indigo-200 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                        <span className="font-extrabold text-indigo-950 text-sm">
                          {editingInterviewId ? 'Редагування співбесіди' : 'Призначення нової співбесіди'}
                        </span>
                      </div>

                      {/* Відображення посади та підрозділу у формі */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-indigo-100">
                        <div className="flex items-center space-x-2">
                          <Briefcase className="h-4 w-4 text-indigo-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Посада:</span>
                            <span className="font-bold text-slate-900 truncate block">{vacancy ? vacancy.title : 'Загальна база'}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Підрозділ:</span>
                            <span className="font-bold text-slate-900 truncate block">{vacancy?.department || 'Основний підрозділ'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Дата та час:</label>
                          <input
                            type="datetime-local"
                            value={intDateTime}
                            onChange={(e) => setIntDateTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Інтерв'юер (хто проводить):</label>
                          <input
                            type="text"
                            value={intInterviewer}
                            onChange={(e) => setIntInterviewer(e.target.value)}
                            placeholder="ПІБ інтерв'юера / рекрутера"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Статус співбесіди:</label>
                          <select
                            value={intStatus}
                            onChange={(e) => setIntStatus(e.target.value as InterviewStatus)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                          >
                            <option value="Заплановано">Заплановано</option>
                            <option value="Завершено">Завершено</option>
                            <option value="Скасовано">Скасовано</option>
                            <option value="Не прийшов">Не прийшов</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Результат:</label>
                          <select
                            value={intResult}
                            onChange={(e) => setIntResult(e.target.value as InterviewResult)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                          >
                            {(data.interviewResultsList || [
                              'Очікує рішення',
                              'Співбесіда з керівником',
                              'Співбесіда пройшла успішно',
                              'Перейшов на стажування',
                              'Відмова компанії',
                              'Відмова кандидата',
                              'Резерв',
                              'Подумає',
                              'Інше'
                            ]).map(res => (
                              <option key={res} value={res}>{res}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="sm:col-span-2 flex items-center space-x-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Оцінка зустрічі:</label>
                          <div className="flex items-center space-x-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setIntRating(s === intRating ? 0 : s)}
                                className="p-0.5 cursor-pointer hover:scale-110 transition"
                              >
                                <Star
                                  className={`h-4 w-4 ${
                                    s <= intRating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Враження / Фідбек інтерв'юера:</label>
                          <textarea
                            rows={3}
                            value={intFeedback}
                            onChange={(e) => setIntFeedback(e.target.value)}
                            placeholder="Коментар про результати співбесіди, сильні/слабкі сторони..."
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg resize-y font-medium text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 pt-2 border-t border-indigo-100">
                        <button
                          type="button"
                          onClick={() => { setShowInterviewForm(false); setEditingInterviewId(null); }}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold cursor-pointer"
                        >
                          Скасувати
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveInterview}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center space-x-1"
                        >
                          <Save className="h-3.5 w-3.5" />
                          <span>Зберегти співбесіду</span>
                        </button>
                      </div>
                    </div>
                  ) : latestInterview ? (
                    /* ПЕРЕГЛЯД АКТИВНОЇ СПІВБЕСІДИ (ЗРУЧНА КОЛОНКА) */
                    <div className="space-y-3.5 text-xs">
                      {/* 1. БЛОК: ПОСАДА ТА ПІДРОЗДІЛ */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Посада / Вакансія */}
                        <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100/90 flex items-start space-x-2.5">
                          <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg shrink-0 mt-0.5">
                            <Briefcase className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Посада / Вакансія:</span>
                            <span className="font-extrabold text-slate-900 text-sm truncate block mt-0.5" title={vacancy?.title || 'Загальна база'}>
                              {vacancy ? vacancy.title : 'Загальна база'}
                            </span>
                          </div>
                        </div>

                        {/* Підрозділ */}
                        <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100/90 flex items-start space-x-2.5">
                          <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg shrink-0 mt-0.5">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Підрозділ / Відділ:</span>
                            <span className="font-extrabold text-indigo-950 text-sm truncate block mt-0.5" title={vacancy?.department || 'Основний підрозділ'}>
                              {vacancy?.department ? vacancy.department : 'Основний підрозділ'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 2. БЛОК: ДАТА, ЧАС ТА ІНТЕРВ'ЮЕР */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Дата та час */}
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center space-x-2.5">
                          <CalendarCheck className="h-4 w-4 text-indigo-600 shrink-0" />
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Дата та час:</span>
                            <span className="font-extrabold text-slate-800 text-xs mt-0.5 block">
                              {formatDateTime(latestInterview.dateTime)}
                            </span>
                          </div>
                        </div>

                        {/* Інтерв'юер */}
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center space-x-2.5">
                          <User className="h-4 w-4 text-slate-500 shrink-0" />
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Інтерв'юер:</span>
                            <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                              {latestInterview.interviewer || 'Рекрутер'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 3. БЛОК: ШВИДКА ЗМІНА СТАТУСУ, РЕЗУЛЬТАТУ ТА ОЦІНКИ (В 1 КЛІК) */}
                      <div className="bg-slate-50/90 p-3 rounded-xl border border-slate-200 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Статус зустрічі (в 1 клік):</span>
                            <div className="flex flex-wrap gap-1">
                              {(['Заплановано', 'Завершено', 'Не прийшов', 'Скасовано'] as InterviewStatus[]).map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleQuickUpdateInterviewStatus(st)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    latestInterview.status === st
                                      ? st === 'Завершено' ? 'bg-emerald-600 text-white shadow-xs' :
                                        st === 'Не прийшов' ? 'bg-rose-600 text-white shadow-xs' :
                                        st === 'Скасовано' ? 'bg-slate-700 text-white shadow-xs' :
                                        'bg-indigo-600 text-white shadow-xs'
                                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                  }`}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Оцінка співбесіди */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Оцінка (1-5):</span>
                            <div className="flex items-center space-x-1">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => handleQuickUpdateInterviewRating(s)}
                                  className="p-1 cursor-pointer hover:scale-125 transition"
                                  title={`Оцінка ${s}`}
                                >
                                  <Star
                                    className={`h-4 w-4 ${
                                      s <= (latestInterview.rating || 0)
                                        ? 'text-amber-500 fill-amber-500'
                                        : 'text-slate-300'
                                    }`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Результат співбесіди */}
                        <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center space-x-2 flex-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Результат співбесіди:</label>
                            <select
                              value={latestInterview.result || 'Очікує рішення'}
                              onChange={(e) => handleQuickUpdateInterviewResult(e.target.value as InterviewResult)}
                              className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 flex-1 max-w-xs focus:ring-1 focus:ring-indigo-500"
                            >
                              {(data.interviewResultsList || [
                                'Очікує рішення',
                                'Співбесіда з керівником',
                                'Співбесіда пройшла успішно',
                                'Перейшов на стажування',
                                'Відмова компанії',
                                'Відмова кандидата',
                                'Резерв',
                                'Подумає',
                                'Інше'
                              ]).map(res => (
                                <option key={res} value={res}>{res}</option>
                              ))}
                              </select>
                            </div>
                          </div>
                        </div>

                      {/* ШВИДКІ ДІЇ ВНИЗУ */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <div className="flex flex-wrap items-center gap-2">
                          {candidate?.status !== 'Співбесіда з керівником' && candidate?.status !== 'Стажування' && candidate?.status !== 'Працевлаштовано' && (
                            <button
                              type="button"
                              onClick={() => {
                                handleQuickUpdateInterviewResult('Співбесіда з керівником');
                                handleStageSelect('Співбесіда з керівником');
                              }}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>➔ До керівника</span>
                            </button>
                          )}

                          {candidate?.status !== 'Стажування' && candidate?.status !== 'Працевлаштовано' && (
                            <button
                              type="button"
                              onClick={() => {
                                handleStageSelect('Стажування');
                                if (!latestIntern) {
                                  handleOpenAddIntern();
                                }
                              }}
                              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                            >
                              <Award className="h-3.5 w-3.5" />
                              <span>➔ Перевести на стажування</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenEditInterview(latestInterview)}
                            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs flex items-center space-x-1 cursor-pointer"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>Змінити дату / деталі</span>
                          </button>
                        </div>

                        {/* Кнопка видалення співбесіди */}
                        <button
                          type="button"
                          onClick={() => handleDeleteInterview(latestInterview.id)}
                          className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition ml-auto"
                          title="Видалити цю співбесіду"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                          <span>Видалити співбесіду</span>
                        </button>
                      </div>

                      {/* 6. ПОПЕРЕДНІ ЕТАПИ СПІВБЕСІД (ЯКЩО Є) */}
                      {previousInterviews.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setShowHistoryInterviews(!showHistoryInterviews)}
                            className="text-[11px] font-bold text-indigo-700 hover:underline flex items-center space-x-1 cursor-pointer"
                          >
                            <span>Попередні етапи співбесід ({previousInterviews.length})</span>
                            {showHistoryInterviews ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>

                          {showHistoryInterviews && (
                            <div className="space-y-2 mt-2">
                              {previousInterviews.map((pi) => (
                                <div key={pi.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                                  <div className="min-w-0 pr-2">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-bold text-slate-800">{formatDateTime(pi.dateTime)}</span>
                                      <span className="text-slate-400">({pi.interviewer})</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">{pi.result} • {pi.status}</p>
                                    {pi.feedback && (
                                      <p className="text-[11px] text-slate-600 italic mt-0.5 line-clamp-1">"{pi.feedback}"</p>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditInterview(pi)}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg"
                                      title="Редагувати цю співбесіду"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteInterview(pi.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                      title="Видалити цю співбесіду"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* НЕМАЄ СПІВБЕСІДИ */
                    <div className="py-6 px-4 bg-indigo-50/20 rounded-2xl border border-dashed border-indigo-200 text-center space-y-3">
                      <div className="max-w-md mx-auto space-y-1">
                        <p className="text-xs font-bold text-indigo-950">Співбесіду ще не призначено для цього кандидата</p>
                        <p className="text-[11px] text-slate-500">
                          Посада: <strong className="text-slate-700">{vacancy ? vacancy.title : 'Загальна база'}</strong> • Підрозділ: <strong className="text-slate-700">{vacancy?.department || 'Основний підрозділ'}</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAddInterview}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs inline-flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Призначити співбесіду</span>
                      </button>
                    </div>
                  )}
                </div>

              </div>

              {/* ===================================================================
                  СЕКЦІЯ 2: СТАЖУВАННЯ (ЗАВЖДИ ВИДИМЕ ТА РЕДАГОВАНЕ ОДРАЗУ)
                 =================================================================== */}
              <div className="bg-white rounded-2xl border border-amber-200/80 shadow-xs overflow-hidden">
                
                {/* ШАПКА БЛОКУ СТАЖУВАННЯ */}
                <div className="px-4 py-3 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="p-1.5 bg-amber-100 text-amber-800 rounded-xl">
                      <Award className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-extrabold text-slate-900 text-sm">Стажування</h4>
                        {latestIntern ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            latestIntern.status === 'Триває' ? 'bg-amber-100 text-amber-800' :
                            latestIntern.status === 'Успішно завершено' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {latestIntern.status}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            Не оформлено
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">Посада, наставник та терміни стажування</p>
                    </div>
                  </div>

                  {/* Кнопки дій у шапці */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    {showInternForm ? (
                      <button
                        type="button"
                        onClick={() => { setShowInternForm(false); setEditingInternId(null); }}
                        className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        Скасувати
                      </button>
                    ) : (
                      <>
                        {latestIntern ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEditIntern(latestIntern)}
                            className="px-2.5 py-1.5 bg-white border border-amber-200 hover:bg-amber-50 text-amber-800 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-2xs"
                            title="Редагувати параметри стажування"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>Редагувати</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleOpenAddIntern}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-xs"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Оформити стажування</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* ТІЛО БЛОКУ СТАЖУВАННЯ */}
                <div className="p-4">
                  {showInternForm ? (
                    /* ІНЛАЙН-ФОРМА СТАЖУВАННЯ */
                    <div className="space-y-3 text-xs bg-amber-50/40 p-3.5 rounded-xl border border-amber-200/80 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                        <span className="font-extrabold text-amber-950">
                          {editingInternId ? 'Редагування параметрів стажування' : 'Оформлення нового стажування'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Посада стажера:</label>
                          <input
                            type="text"
                            value={internPosition}
                            onChange={(e) => setInternPosition(e.target.value)}
                            placeholder="Назва посади"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Відділ / Підрозділ:</label>
                          <input
                            type="text"
                            value={internDepartment}
                            onChange={(e) => setInternDepartment(e.target.value)}
                            placeholder="Відділ"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Дата початку:</label>
                          <input
                            type="date"
                            value={internStartDate}
                            onChange={(e) => setInternStartDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Дата завершення:</label>
                          <input
                            type="date"
                            value={internEndDate}
                            onChange={(e) => setInternEndDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Наставник (ментор):</label>
                          <input
                            type="text"
                            value={internMentor}
                            onChange={(e) => setInternMentor(e.target.value)}
                            placeholder="ПІБ куратора стажування"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Статус стажування:</label>
                          <select
                            value={internStatus}
                            onChange={(e) => setInternStatus(e.target.value as InternStatus)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                          >
                            <option value="Триває">Триває</option>
                            <option value="Успішно завершено">Успішно завершено</option>
                            <option value="Не пройшов">Не пройшов</option>
                            <option value="Відмовився">Відмовився</option>
                          </select>
                        </div>

                        {(internStatus === 'Не пройшов' || internStatus === 'Відмовився') && (
                          <div className="sm:col-span-2 bg-rose-50/60 p-3 rounded-xl border border-rose-200/60 space-y-1.5 animate-fade-in">
                            <label className="text-[10px] font-bold text-rose-800 uppercase block">
                              {internStatus === 'Відмовився' ? 'Причина відмови від стажування:' : 'Причина чому не пройшов стажування:'}
                            </label>
                            <input
                              type="text"
                              value={internRejectionReason}
                              onChange={(e) => setInternRejectionReason(e.target.value)}
                              placeholder={internStatus === 'Відмовився' ? 'Вкажіть, чому стажер відмовився...' : 'Вкажіть причину, чому не пройшов...'}
                              className="w-full px-2.5 py-1.5 bg-white border border-rose-200 rounded-lg font-medium text-slate-800 text-xs"
                            />
                          </div>
                        )}

                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Проект / Завдання стажування:</label>
                          <textarea
                            rows={2}
                            value={internProject}
                            onChange={(e) => setInternProject(e.target.value)}
                            placeholder="Цілі, проекти або ключові завдання..."
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg resize-none font-medium"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 pt-2 border-t border-amber-100">
                        <button
                          type="button"
                          onClick={() => { setShowInternForm(false); setEditingInternId(null); }}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold cursor-pointer"
                        >
                          Скасувати
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveIntern}
                          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center space-x-1"
                        >
                          <Save className="h-3.5 w-3.5" />
                          <span>Зберегти стажування</span>
                        </button>
                      </div>
                    </div>
                  ) : latestIntern ? (
                    /* ПЕРЕГЛЯД АКТИВНОГО СТАЖУВАННЯ */
                    <div className="space-y-3 text-xs">
                      <div className="bg-amber-50/30 p-3.5 rounded-xl border border-amber-100 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Посада та підрозділ:</span>
                            <span className="font-extrabold text-slate-900 text-sm block mt-0.5">
                              {latestIntern.position} <span className="text-slate-500 font-normal">({latestIntern.department || 'Загальний'})</span>
                            </span>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                            latestIntern.status === 'Триває' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                            latestIntern.status === 'Успішно завершено' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                            latestIntern.status === 'Відмовився' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                            'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {latestIntern.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 pt-1">
                          <p>Період: <strong>{formatDate(latestIntern.startDate)} — {latestIntern.endDate ? formatDate(latestIntern.endDate) : 'триває'}</strong></p>
                          <p>Наставник: <strong>{latestIntern.mentor || 'Не призначено'}</strong></p>
                        </div>

                        {(latestIntern.status === 'Не пройшов' || latestIntern.status === 'Відмовився') && latestIntern.rejectionReason && (
                          <div className="pt-2 border-t border-rose-100">
                            <span className="text-[10px] font-bold text-rose-700 uppercase block mb-0.5">
                              {latestIntern.status === 'Відмовився' ? 'Причина відмови:' : 'Причина чому не пройшов:'}
                            </span>
                            <p className="text-rose-800 bg-rose-50 p-2 rounded-lg border border-rose-200 text-xs font-semibold">
                              {latestIntern.rejectionReason}
                            </p>
                          </div>
                        )}

                        {latestIntern.project && (
                          <div className="pt-2 border-t border-amber-100/60">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Завдання стажування:</span>
                            <p className="text-slate-700 italic bg-white p-2 rounded-lg border border-amber-100 text-[11px]">
                              {latestIntern.project}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Швидкі переходи після стажування */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditIntern(latestIntern)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 text-amber-800 border border-amber-200 rounded-xl font-bold text-xs flex items-center space-x-1 cursor-pointer"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Редагувати параметри стажування</span>
                        </button>

                        {onDeleteIntern && (
                          confirmDeleteIntern ? (
                            <div className="flex items-center bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1 space-x-2 animate-fade-in text-xs font-bold text-rose-700">
                              <span>Дійсно видалити стажування?</span>
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteIntern(latestIntern.id);
                                  setConfirmDeleteIntern(false);
                                  showSaveSuccess('Стажування видалено!');
                                }}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition cursor-pointer"
                              >
                                Так
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteIntern(false)}
                                className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition cursor-pointer"
                              >
                                Ні
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteIntern(true)}
                              className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs flex items-center space-x-1 cursor-pointer transition"
                              title="Видалити запис про стажування"
                            >
                              <Trash2 className="h-3 w-3 text-rose-600" />
                              <span>Видалити стажування</span>
                            </button>
                          )
                        )}

                        {candidate?.status !== 'Працевлаштовано' && (
                          <button
                            type="button"
                            onClick={() => handleHireFromInternship(latestIntern)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Успішно завершив ➔ Працевлаштувати в штат</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* НЕМАЄ СТАЖУВАННЯ */
                    <div className="py-5 px-4 bg-amber-50/20 rounded-xl border border-dashed border-amber-200 text-center space-y-2">
                      <p className="text-xs text-amber-900 font-medium">Стажування ще не оформлено для цього кандидата.</p>
                      <button
                        type="button"
                        onClick={handleOpenAddIntern}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs inline-flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Оформити умови стажування</span>
                      </button>
                    </div>
                  )}
                </div>

              </div>

              {/* ===================================================================
                  СЕКЦІЯ 3: ПРАЦЕВЛАШТУВАННЯ ТА АРХІВ ЗВІЛЬНЕННЯ
                 =================================================================== */}
              {candidate?.status === 'Працевлаштовано' && (
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 space-y-3 text-xs text-emerald-950 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                      <div>
                        <h5 className="font-extrabold text-sm text-emerald-950">Працівник у штаті компанії 🎉</h5>
                        <p className="text-xs text-emerald-800">Кандидата успішно оформлено та працевлаштовано</p>
                      </div>
                    </div>

                    {firedRecord && (
                      <button
                        type="button"
                        onClick={handleStartEditFired}
                        className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition"
                      >
                        Запис звільнення
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* АРХІВ ЗВІЛЬНЕННЯ (ЯКЩО ВІДОМИЙ) */}
              {firedRecord && (
                <div className="p-3.5 bg-rose-50/60 rounded-2xl border border-rose-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-rose-950 flex items-center space-x-1">
                      <span>Архів звільнення співробітника</span>
                    </span>
                    <span className="text-[10px] text-rose-700 font-bold bg-white px-2 py-0.5 rounded-full border border-rose-200">
                      Звільнено: {formatDate(firedRecord.endDate)}
                    </span>
                  </div>
                  <p className="text-rose-900 font-medium">Причина звільнення: <strong>{firedRecord.reason}</strong></p>
                  {firedRecord.exitNotes && (
                    <p className="text-slate-600 italic bg-white p-2 rounded-lg border border-rose-100">
                      "{firedRecord.exitNotes}"
                    </p>
                  )}
                </div>
              )}

            </div>

          </div>
        </div>

      </div>

      {/* МОДАЛКА ВІДХИЛЕННЯ КАНДИДАТА */}
      {showRejectionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fade-in text-left">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
                {rejectionType === 'candidate' ? (
                  <>
                    <UserX className="h-4.5 w-4.5 text-amber-600" />
                    <span>Вкажіть причину відмови кандидата</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4.5 w-4.5 text-rose-600" />
                    <span>Вкажіть причину відмови компанії</span>
                  </>
                )}
              </h4>
              <button
                type="button"
                onClick={() => setShowRejectionModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Оберіть зі списку:</label>
                <select
                  value={rejectionSelect}
                  onChange={(e) => {
                    setRejectionSelect(e.target.value);
                    if (e.target.value) setRejectionCustom('');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="">-- Оберіть причину --</option>
                  {rejectionType === 'candidate' ? (
                    <>
                      <option value="Не підійшла заробітна плата">Не влаштували умови / заробітна плата</option>
                      <option value="Знайшов іншу роботу / прийняв офер">Знайшов іншу роботу / прийняв інший офер</option>
                      <option value="Незручний графік / формат роботи">Незручний графік або локація</option>
                      <option value="Не виходить на зв'язок">Кандидат не виходить на зв'язок</option>
                      <option value="Сімейні / особисті обставини">Сімейні або особисті обставини</option>
                      <option value="Відмовився без пояснень">Відмовився без пояснення причин</option>
                      <option value="Інше">Інша причина (вказати нижче)</option>
                    </>
                  ) : (
                    <>
                      <option value="Невідповідність вимогам вакансії">Невідповідність кваліфікаційним вимогам</option>
                      <option value="Недостатній досвід роботи">Недостатній досвід роботи</option>
                      <option value="Обрали іншого кандидата">Обрали іншого фіналіста</option>
                      <option value="Не пройшов співбесіду">Не пройшов співбесіду (soft/hard skills)</option>
                      <option value="Не з'явився на співбесіду">Не з'явився на співбесіду</option>
                      <option value="Не надав необхідні документи">Не надав необхідні документи</option>
                      <option value="Інше">Інша причина (вказати нижче)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Або введіть свою причину:</label>
                <input
                  type="text"
                  value={rejectionCustom}
                  onChange={(e) => setRejectionCustom(e.target.value)}
                  placeholder="Вкажіть конкретну причину відмови..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRejectionModal(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                className={`px-4 py-1.5 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs ${
                  rejectionType === 'candidate' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Підтвердити статус
              </button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА ПЕРЕГЛЯДУ РЕЗЮМЕ */}
      {previewCv && (
        <CvPreviewModal
          isOpen={Boolean(previewCv)}
          candidateName={previewCv.candidateName}
          fileName={previewCv.fileName}
          fileContent={previewCv.fileContent}
          cvLink={previewCv.cvLink}
          onClose={() => setPreviewCv(null)}
        />
      )}
    </div>
  );
}
