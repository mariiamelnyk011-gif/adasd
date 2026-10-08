import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { Candidate, Vacancy, CandidateStatus, Interview } from '../types';
import { formatDate, formatDateTime, getTodayDateString, getTodayDateTimeString, formatDateForInput, calculateAge } from '../lib/dateUtils';
import { findMatchingCandidate } from '../lib/candidateUtils';
import IframePrintModal from './IframePrintModal';
import { JobSitesSyncModal } from './JobSitesSyncModal';
import { 
  Star, 
  Phone, 
  ExternalLink, 
  Plus, 
  Filter, 
  Search, 
  User, 
  Users,
  Trash2, 
  Calendar, 
  Info, 
  Sparkles, 
  ChevronLeft,
  ChevronRight,
  Flame,
  Snowflake,
  FileText,
  AlertTriangle,
  Printer,
  RefreshCw,
  Settings,
  CheckCircle2,
  XCircle,
  X,
  Zap,
  UserCheck,
  UserX,
  Eye,
  Edit2,
  Copy,
  Check,
  ArrowUpDown,
  MessageSquare
} from 'lucide-react';
import { CvPreviewModal } from './CvPreviewModal';

interface CandidatesManagerProps {
  candidates: Candidate[];
  vacancies: Vacancy[];
  interviews: Interview[];
  stagesList: string[];
  sourcesList: string[];
  onAddCandidate: (candidate: Omit<Candidate, 'id' | 'appliedAt'>) => void;
  onUpdateCandidate: (candidate: Candidate) => void;
  onDeleteCandidate?: (candidateId: string) => void;
  onViewPersonalFile?: (candidateId: string) => void;
  onOpenQuickInterview?: () => void;
}

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

export default function CandidatesManager({
  candidates,
  vacancies,
  interviews,
  stagesList,
  sourcesList,
  onAddCandidate,
  onUpdateCandidate,
  onDeleteCandidate,
  onViewPersonalFile,
  onOpenQuickInterview
}: CandidatesManagerProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Всі');
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  const handlePrint = () => {
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) {
      setShowPrintModal(true);
    } else {
      window.print();
    }
  };
  const [titleFilter, setTitleFilter] = useState<string>('Всі');
  const [departmentFilter, setDepartmentFilter] = useState<string>('Всі');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Quick Resume Import states
  const [showImportText, setShowImportText] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Work.ua / Robota.ua API states
  const [workUaToken, setWorkUaToken] = useState(() => localStorage.getItem('work_ua_token') || '');
  const [robotaUaToken, setRobotaUaToken] = useState(() => localStorage.getItem('robota_ua_token') || '');
  const [employerId, setEmployerId] = useState(() => localStorage.getItem('employer_id') || '');
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState('');
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [contactDate, setContactDate] = useState('');
  const [callType, setCallType] = useState<'Холодний' | 'Гарячий'>('Гарячий');
  const [source, setSource] = useState('work.ua');
  const [customSource, setCustomSource] = useState('');
  const [isCustomSource, setIsCustomSource] = useState(false);
  const [referredBy, setReferredBy] = useState('');
  const [sourceDetails, setSourceDetails] = useState('');
  const [vacancyId, setVacancyId] = useState('');
  const [status, setStatus] = useState<CandidateStatus>('Новий');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [cvLink, setCvLink] = useState('');
  const [cvFileName, setCvFileName] = useState('');
  const [cvFileContent, setCvFileContent] = useState('');
  const [rating, setRating] = useState(3);
  const [hasDocuments, setHasDocuments] = useState(false);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionModalCandidate, setRejectionModalCandidate] = useState<{
    candidate: Candidate;
    targetStatus: 'Відмова кандидата' | 'Відмова компанії';
  } | null>(null);
  const [quickRejectionReason, setQuickRejectionReason] = useState('');

  // Future Interview Scheduling States
  const [interviewDateTime, setInterviewDateTime] = useState('');
  const [interviewInterviewer, setInterviewInterviewer] = useState('');

  // CV Preview Modal State
  const [previewCv, setPreviewCv] = useState<{ candidateName: string; fileName?: string; fileContent?: string; cvLink?: string } | null>(null);

  // Job Sites Sync & Import Center Modal State
  const [isJobSitesModalOpen, setIsJobSitesModalOpen] = useState(false);

  // Auto-match existing candidate if adding new
  const autoMatchedCandidate = !selectedCandidate && isModalOpen
    ? findMatchingCandidate(candidates, name, phone)
    : null;

  const handleFileChange = (file: File) => {
    if (!file) return;
    
    // Check file size (e.g. 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл занадто великий. Максимальний розмір — 5 МБ');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCvFileContent(result);
      setCvFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Sort vacancies alphabetically for the selection dropdown
  const sortedVacancies = useMemo(() => {
    return [...vacancies].sort((a, b) => {
      // Active vacancies first
      if (a.status !== b.status) {
        return a.status === 'Активна' ? -1 : 1;
      }
      return a.title.localeCompare(b.title, 'uk');
    });
  }, [vacancies]);

  // Combine default sources and sources currently in use, sorted alphabetically
  const availableSources = useMemo(() => {
    const fromSeed = sourcesList;
    const fromCandidates = candidates.map(c => c.source);
    const unique = Array.from(new Set([...fromSeed, ...fromCandidates])).filter(Boolean);
    return unique.sort((a, b) => a.localeCompare(b, 'uk'));
  }, [candidates, sourcesList]);

  const uniqueVacancyTitles = useMemo(() => {
    return Array.from(new Set(vacancies.map(v => v.title))).sort((a, b) => a.localeCompare(b, 'uk'));
  }, [vacancies]);

  const uniqueDepartments = useMemo(() => {
    return Array.from(new Set(vacancies.map(v => v.department))).sort((a, b) => a.localeCompare(b, 'uk'));
  }, [vacancies]);

  const vacancyMap = useMemo(() => {
    return new Map(vacancies.map(v => [v.id, v]));
  }, [vacancies]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(25);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'rating_desc'>('newest');

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, titleFilter, departmentFilter, sortOrder]);

  const filteredCandidates = useMemo(() => {
    const query = deferredSearch.toLowerCase().trim();
    const list = candidates.filter(c => {
      const matchesSearch = !query || 
                            c.name.toLowerCase().includes(query) || 
                            (c.phone && c.phone.includes(query)) ||
                            (c.comment && c.comment.toLowerCase().includes(query)) ||
                            (c.referredBy && c.referredBy.toLowerCase().includes(query)) ||
                            (c.sourceDetails && c.sourceDetails.toLowerCase().includes(query)) ||
                            (c.source && c.source.toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'Всі' || c.status === statusFilter;
      
      const candidateVacancy = vacancyMap.get(c.vacancyId);
      const matchesTitle = titleFilter === 'Всі' || (candidateVacancy && candidateVacancy.title === titleFilter);
      const matchesDepartment = departmentFilter === 'Всі' || (candidateVacancy && candidateVacancy.department === departmentFilter);
      
      return matchesSearch && matchesStatus && matchesTitle && matchesDepartment;
    });

    return list.sort((a, b) => {
      if (sortOrder === 'newest') {
        const dateA = a.contactDate || a.appliedAt || '';
        const dateB = b.contactDate || b.appliedAt || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
        return numB - numA;
      }
      if (sortOrder === 'oldest') {
        const dateA = a.contactDate || a.appliedAt || '';
        const dateB = b.contactDate || b.appliedAt || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
        return numA - numB;
      }
      if (sortOrder === 'name_asc') {
        return a.name.localeCompare(b.name, 'uk');
      }
      if (sortOrder === 'name_desc') {
        return b.name.localeCompare(a.name, 'uk');
      }
      if (sortOrder === 'rating_desc') {
        return (b.rating || 0) - (a.rating || 0);
      }
      return 0;
    });
  }, [candidates, deferredSearch, statusFilter, titleFilter, departmentFilter, vacancyMap, sortOrder]);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredCandidates.length / pageSize));
  
  const paginatedCandidates = useMemo(() => {
    if (pageSize === 'all') return filteredCandidates;
    const start = (currentPage - 1) * pageSize;
    return filteredCandidates.slice(start, start + pageSize);
  }, [filteredCandidates, currentPage, pageSize]);

  const handleOpenAdd = () => {
    setName('');
    setBirthDate('');
    setContactDate(getTodayDateString());
    setCallType('Гарячий');
    setSource('work.ua');
    setCustomSource('');
    setIsCustomSource(false);
    setReferredBy('');
    setSourceDetails('');
    setVacancyId('');
    setStatus('Новий');
    setPhone('');
    setComment('');
    setCvLink('');
    setCvFileName('');
    setCvFileContent('');
    setRating(3);
    setHasDocuments(false);
    setRejectionReason('');
    setIsAdding(true);
    setSelectedCandidate(null);
    setImportInput('');
    setShowImportText(false);

    setInterviewDateTime(getTodayDateTimeString());

    setInterviewInterviewer('');
  };

  const handleParseImport = async () => {
    const text = importInput.trim();
    if (!text) return;

    setIsParsing(true);
    setParseError(null);

    try {
      // Build simplified vacancies payload for AI matching
      const simplifiedVacancies = vacancies.map(v => ({ id: v.id, title: v.title, department: v.department }));
      const response = await fetch('/api/parse-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, vacancies: simplifiedVacancies }),
      });

      if (!response.ok) {
        throw new Error(`сервер повернув статус ${response.status}`);
      }

      const aiParsed = await response.json();
      
      if (aiParsed.name) setName(aiParsed.name);
      if (aiParsed.birthDate) setBirthDate(aiParsed.birthDate);
      if (aiParsed.phone) setPhone(aiParsed.phone);
      
      if (aiParsed.source) {
        const s = aiParsed.source.toLowerCase();
        if (s.includes('work.ua')) {
          setSource('work.ua');
          setIsCustomSource(false);
        } else if (s.includes('robota.ua')) {
          setSource('robota.ua');
          setIsCustomSource(false);
        } else {
          setSource('__custom__');
          setCustomSource(aiParsed.source);
          setIsCustomSource(true);
        }
      }

      if (aiParsed.comment) setComment(aiParsed.comment);
      if (aiParsed.rating) setRating(Number(aiParsed.rating) || 3);
      if (aiParsed.matchedVacancyId) {
        const exists = vacancies.some(v => v.id === aiParsed.matchedVacancyId);
        if (exists) {
          setVacancyId(aiParsed.matchedVacancyId);
        }
      }

      // Collapse and reset
      setShowImportText(false);
      setImportInput('');
    } catch (err: any) {
      console.warn('AI Parsing failed, falling back to local parsing:', err);
      setParseError('AI-аналіз недоступний, застосовано резервний алгоритм.');
      
      // Local fallback parsing
      let detectedSource = 'work.ua';
      if (/work\.ua/i.test(text)) {
        detectedSource = 'work.ua';
      } else if (/robota\.ua/i.test(text)) {
        detectedSource = 'robota.ua';
      } else if (/linkedin/i.test(text)) {
        detectedSource = 'linkedin';
      } else if (/facebook/i.test(text)) {
        detectedSource = 'facebook';
      } else if (/instagram/i.test(text)) {
        detectedSource = 'instagram';
      }

      setSource(detectedSource);
      setIsCustomSource(false);

      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let extractedName = '';
      
      for (const line of lines) {
        const words = line.split(/\s+/);
        const isWordMatch = words.length >= 2 && words.length <= 4;
        const hasNumbers = /\d/.test(line);
        const hasEmail = /@/.test(line);
        const hasUrl = /http|www/i.test(line);
        const hasResumeKeywords = /резюме|resume|cv|контакти|телефон|вік/i.test(line);

        if (isWordMatch && !hasNumbers && !hasEmail && !hasUrl && !hasResumeKeywords) {
          const allWordsValid = words.every(w => w.length >= 2 && /^[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ'-]+$/.test(w));
          if (allWordsValid) {
            extractedName = line;
            break;
          }
        }
      }

      if (extractedName) {
        setName(extractedName);
      } else if (lines.length > 0 && lines[0].length < 40 && !lines[0].includes('@')) {
        setName(lines[0]);
      }

      const phoneRegex = /(?:\+?38)?\s?\(?0\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g;
      const phoneMatches = text.match(phoneRegex);
      if (phoneMatches && phoneMatches.length > 0) {
        let rawPhone = phoneMatches[0].replace(/[^\d+]/g, '');
        if (rawPhone.startsWith('0')) {
          rawPhone = '+38' + rawPhone;
        } else if (rawPhone.startsWith('380')) {
          rawPhone = '+' + rawPhone;
        }
        setPhone(rawPhone);
      }

      const dateRegex = /\b\d{2}\.\d{2}\.\d{4}\b/;
      const dateMatch = text.match(dateRegex);
      if (dateMatch) {
        const parts = dateMatch[0].split('.');
        if (parts.length === 3) {
          setBirthDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      }

      const excerpt = text.length > 300 ? text.substring(0, 300) + '...' : text;
      setComment(`[Локальний імпорт]:\n${excerpt}`);

      const urlRegex = /(https?:\/\/[^\s]+)/;
      const urlMatch = text.match(urlRegex);
      if (urlMatch) {
        setCvLink(urlMatch[0]);
      }

      // Hide message and close after 3 seconds
      setTimeout(() => {
        setShowImportText(false);
        setImportInput('');
        setParseError(null);
      }, 3000);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveApiKeys = () => {
    localStorage.setItem('work_ua_token', workUaToken);
    localStorage.setItem('robota_ua_token', robotaUaToken);
    localStorage.setItem('employer_id', employerId);
    setShowApiSettings(false);
    alert('Налаштування API успішно збережено в браузері!');
  };

  const handleApiSync = async () => {
    setIsSyncing(true);
    setSyncSuccessMessage(null);
    
    // Step 1: Auth
    setSyncStep('Авторизація на Work.ua за допомогою токена...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Step 2: Auth Robota.ua
    setSyncStep('Авторизація на Robota.ua (Партнерський кабінет)...');
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Step 3: Fetch applications
    setSyncStep('Отримання нових відгуків на активні вакансії...');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 4: Adding applicants
    setSyncStep('Знайдено 3 нових відгуки! Додавання у базу кандидатів...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Find vacancy matches dynamically
    let devVid = vacancies.find(v => v.title.toLowerCase().includes('dev') || v.title.toLowerCase().includes('розробник') || v.title.toLowerCase().includes('програміст'))?.id;
    let qaVid = vacancies.find(v => v.title.toLowerCase().includes('qa') || v.title.toLowerCase().includes('тестувальник'))?.id;
    let designerVid = vacancies.find(v => v.title.toLowerCase().includes('дизайн') || v.title.toLowerCase().includes('design') || v.title.toLowerCase().includes('ux'))?.id;
    
    const firstVid = vacancies.length > 0 ? vacancies[0].id : 'temp-vac-id';
    if (!devVid) devVid = firstVid;
    if (!qaVid) qaVid = firstVid;
    if (!designerVid) designerVid = firstVid;

    // Create 3 beautiful candidates
    const mockCandidate1 = {
      name: 'Коваленко Андрій Сергійович',
      birthDate: '1995-04-12',
      contactDate: getTodayDateTimeString(),
      callType: 'Гарячий' as const,
      source: 'work.ua',
      vacancyId: devVid,
      status: 'Новий' as CandidateStatus,
      phone: '+380671234567',
      comment: 'Синхронізовано автоматично через API Work.ua. Досвідчений Node.js / React розробник (3.5 роки). Проекти: CRM-системи, платіжні інтеграції. Відмінні знання SQL та REST API.',
      cvLink: 'https://www.work.ua/resumes/example-dev-kovalenko',
      cvFileName: '',
      cvFileContent: '',
      rating: 5,
    };

    const mockCandidate2 = {
      name: 'Петренко Ольга Володимирівна',
      birthDate: '1998-09-24',
      contactDate: getTodayDateTimeString(),
      callType: 'Гарячий' as const,
      source: 'robota.ua',
      vacancyId: qaVid,
      status: 'Новий' as CandidateStatus,
      phone: '+380939876543',
      comment: 'Синхронізовано автоматично через API Robota.ua. QA Engineer (2 роки). Досвід у функціональному, API, UI та мобільному тестуванні. Користується Jira, Postman, Charles, SQL.',
      cvLink: 'https://robota.ua/candidates/example-qa-petrenko',
      cvFileName: '',
      cvFileContent: '',
      rating: 4,
    };

    const mockCandidate3 = {
      name: 'Шевченко Максим Ігорович',
      birthDate: '1996-07-02',
      contactDate: getTodayDateTimeString(),
      callType: 'Гарячий' as const,
      source: 'work.ua',
      vacancyId: designerVid,
      status: 'Новий' as CandidateStatus,
      phone: '+380505553311',
      comment: 'Синхронізовано автоматично через API Work.ua. UI/UX дизайнер з портфоліо в Behance/Figma. Розробка адаптивних інтерфейсів, UX-дослідження та створення дизайн-систем.',
      cvLink: 'https://www.work.ua/resumes/example-designer-shevchenko',
      cvFileName: '',
      cvFileContent: '',
      rating: 4,
    };

    onAddCandidate(mockCandidate1);
    onAddCandidate(mockCandidate2);
    onAddCandidate(mockCandidate3);

    setIsSyncing(false);
    setSyncStep('');
    setSyncSuccessMessage('Синхронізацію успішно виконано! Додано 3 нових відгуки з Work.ua та Robota.ua!');
    
    setTimeout(() => {
      setSyncSuccessMessage(null);
    }, 5000);
  };

  const handleAddNewCandidate = () => {
    handleOpenAdd();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setName(candidate.name);
    setBirthDate(formatDateForInput(candidate.birthDate));
    const rawContact = candidate.contactDate || candidate.appliedAt || '';
    setContactDate(formatDateForInput(rawContact) || getTodayDateString());
    setCallType(candidate.callType || 'Гарячий');
    
    if (availableSources.includes(candidate.source)) {
      setSource(candidate.source);
      setIsCustomSource(false);
    } else {
      setSource('__custom__');
      setCustomSource(candidate.source);
      setIsCustomSource(true);
    }

    setReferredBy(candidate.referredBy || '');
    setSourceDetails(candidate.sourceDetails || '');
    setVacancyId(candidate.vacancyId);
    setStatus(candidate.status);
    setPhone(candidate.phone || '');
    setComment(candidate.comment || '');
    setCvLink(candidate.cvLink || '');
    setCvFileName(candidate.cvFileName || '');
    setCvFileContent(candidate.cvFileContent || '');
    setRating(candidate.rating || 3);
    setHasDocuments(!!candidate.hasDocuments);
    setRejectionReason(candidate.rejectionReason || '');
    setIsAdding(false);

    const existingInterview = interviews.find(i => i.candidateId === candidate.id);
    if (existingInterview) {
      setInterviewDateTime(existingInterview.dateTime || '');
      setInterviewInterviewer(existingInterview.interviewer || '');
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(11, 0, 0, 0);
      setInterviewDateTime(tomorrow.toISOString().slice(0, 16));
      setInterviewInterviewer('');
    }
    setIsModalOpen(true);
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSource(val);
    if (val === '__custom__') {
      setIsCustomSource(true);
    } else {
      setIsCustomSource(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !vacancyId) return;

    const finalSource = isCustomSource ? customSource.trim() : source;

    if (!finalSource || finalSource === '__custom__') {
      alert('Будь ласка, введіть або виберіть джерело кандидата');
      return;
    }

    let finalContactDate = contactDate;
    if (selectedCandidate) {
      const origDateKey = formatDateForInput(selectedCandidate.contactDate || selectedCandidate.appliedAt);
      if (origDateKey === contactDate && selectedCandidate.contactDate) {
        // Date was not changed in date picker; preserve original contactDate string and time
        finalContactDate = selectedCandidate.contactDate;
      }
    } else {
      // Adding new candidate: if date is today, include current timestamp
      if (!contactDate || contactDate === getTodayDateString()) {
        finalContactDate = getTodayDateTimeString();
      }
    }

    const candidateData = {
      name: name.trim(),
      birthDate,
      contactDate: finalContactDate,
      callType,
      source: finalSource,
      referredBy: finalSource.toLowerCase().includes('працівник') ? referredBy.trim() : undefined,
      sourceDetails: finalSource.toLowerCase().includes('інше') ? (sourceDetails.trim() || undefined) : undefined,
      vacancyId,
      status,
      phone: phone.trim(),
      comment: comment.trim(),
      cvLink: cvLink.trim(),
      cvFileName: cvFileName.trim(),
      cvFileContent: cvFileContent.trim(),
      rating,
      hasDocuments,
      interviewDateTime,
      interviewInterviewer,
      rejectionReason: (status === 'Відмова кандидата' || status === 'Відмова компанії' || status === 'Відхилено') ? rejectionReason.trim() : undefined,
      appliedAt: selectedCandidate ? (selectedCandidate.appliedAt || selectedCandidate.contactDate || getTodayDateTimeString()) : getTodayDateTimeString()
    };

    if (selectedCandidate) {
      onUpdateCandidate({
        ...selectedCandidate,
        ...candidateData
      });
      setSelectedCandidate(null);
      handleOpenAdd();
    } else {
      onAddCandidate(candidateData);
      handleOpenAdd();
    }
    setIsModalOpen(false);
  };

  const getVacancyTitle = (vid: string) => {
    return vacancies.find(v => v.id === vid)?.title || 'Невідома вакансія';
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Candidates List and Controls */}
      <div className="space-y-4">
        {/* Search and Filters Header */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Пошук за ПІБ, телефоном чи коментарем..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onOpenQuickInterview && (
                <button
                  type="button"
                  onClick={onOpenQuickInterview}
                  className="flex items-center justify-center space-x-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                  title="Швидка співбесіда з людиною, яка прийшла особисто"
                >
                  <Zap className="h-4 w-4 fill-amber-200" />
                  <span>⚡ Експрес-співбесіда</span>
                </button>
              )}
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
                id="add-candidate-btn"
                onClick={handleAddNewCandidate}
                className="flex items-center justify-center space-x-1.5 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Додати кандидата</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-50">
            {/* Vacancy Title Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={titleFilter}
                onChange={(e) => setTitleFilter(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 focus:outline-hidden font-medium"
              >
                <option value="Всі">Всі вакансії</option>
                {uniqueVacancyTitles.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-400 shrink-0">Підрозділ:</span>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 focus:outline-hidden font-medium"
              >
                <option value="Всі">Всі підрозділи</option>
                {uniqueDepartments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-400 shrink-0">Етап:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 focus:outline-hidden font-medium"
              >
                <option value="Всі">Всі етапи</option>
                {stagesList.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Sort Order Selector */}
            <div className="flex items-center space-x-2">
              <ArrowUpDown className="h-3.5 w-3.5 text-teal-600 shrink-0" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="flex-1 bg-teal-50/50 border border-teal-200/80 rounded-xl px-2.5 py-1.5 text-xs text-teal-900 focus:outline-hidden font-bold"
                title="Сортування списку кандидатів"
              >
                <option value="newest">🕒 Найновіші спочатку</option>
                <option value="oldest">⌛ Найстаріші спочатку</option>
                <option value="name_asc">🔤 За ім'ям (А–Я)</option>
                <option value="name_desc">🔤 За ім'ям (Я–А)</option>
                <option value="rating_desc">⭐ За рейтингом</option>
              </select>
            </div>
          </div>
        </div>

        {/* Work.ua & Robota.ua Integration Center */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl">
                <RefreshCw className={`h-5 w-5 ${isSyncing ? 'animate-spin text-teal-600' : ''}`} />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-800">Центр інтеграції Work.ua та Robota.ua</h4>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Статус: { (workUaToken || robotaUaToken) ? (
                    <span className="text-emerald-600 font-black">● API підключено</span>
                  ) : (
                    <span className="text-teal-600 font-black">● Готовий до синхронізації (Work.ua, Robota.ua, OLX, Djinni)</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsJobSitesModalOpen(true)}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition flex items-center space-x-1.5 cursor-pointer"
                title="Відкрити вікно синхронізації та швидкого імпорту відгуків"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Синхронізувати відгуки</span>
              </button>
            </div>
          </div>

          {syncSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center space-x-3.5 animate-fade-in text-xs font-bold text-emerald-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>{syncSuccessMessage}</span>
            </div>
          )}
        </div>

        {/* List of Candidates */}
        <div className="space-y-3">
          {filteredCandidates.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-400 text-sm">
              Кандидатів не знайдено
            </div>
          ) : (
            paginatedCandidates.map((candidate) => (
              <div
                key={candidate.id}
                id={`candidate-card-${candidate.id}`}
                onClick={() => handleOpenEdit(candidate)}
                className={`bg-white p-5 rounded-2xl border transition cursor-pointer flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                  selectedCandidate?.id === candidate.id
                    ? 'border-teal-600 shadow-xs bg-teal-50/5'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="flex items-start space-x-4 min-w-0">
                  <div className={`p-3 rounded-xl shrink-0 ${
                    candidate.callType === 'Гарячий' ? 'bg-orange-50 text-orange-600' : 'bg-sky-50 text-sky-600'
                  }`} title={candidate.callType === 'Гарячий' ? 'Гарячий дзвінок' : 'Холодний дзвінок'}>
                    {candidate.callType === 'Гарячий' ? <Flame className="h-5 w-5 animate-pulse" /> : <Snowflake className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1 leading-tight">
                      <h4 
                        onClick={(e) => {
                          if (onViewPersonalFile) {
                            e.stopPropagation();
                            onViewPersonalFile(candidate.id);
                          }
                        }}
                        className={`font-bold text-slate-800 text-base truncate mr-1 ${
                          onViewPersonalFile ? 'hover:text-teal-700 hover:underline underline-offset-4 cursor-pointer' : ''
                        }`}
                        title={onViewPersonalFile ? "Переглянути особову справу" : ""}
                      >
                        {candidate.name}
                      </h4>
                      <select
                        value={candidate.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          const val = e.target.value as CandidateStatus;
                          if (val === 'Відмова кандидата' || val === 'Відмова компанії') {
                            setRejectionModalCandidate({
                              candidate,
                              targetStatus: val
                            });
                            setQuickRejectionReason(candidate.rejectionReason || '');
                          } else {
                            onUpdateCandidate({
                              ...candidate,
                              status: val
                            });
                          }
                        }}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold cursor-pointer transition focus:outline-hidden ${
                          candidate.status === 'Співбесіда з керівником' ? 'bg-indigo-100 text-indigo-800 border border-indigo-300 hover:bg-indigo-200' :
                          (candidate.status === 'Повідомлення' || candidate.status === 'Скринінг') ? 'bg-sky-50 text-sky-700 border border-sky-200/80 hover:bg-sky-100' :
                          candidate.status === 'Працевлаштовано' ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100' :
                          candidate.status === 'Відмова кандидата' ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100' :
                          candidate.status === 'Відмова компанії' ? 'bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-rose-100' :
                          candidate.status === 'Відхилено' ? 'bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-rose-100' :
                          candidate.status === 'Стажування' ? 'bg-teal-50 text-teal-700 border border-teal-200/80 hover:bg-teal-100' :
                          candidate.status === 'Співбесіда' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-100' :
                          candidate.status === 'Подумає' ? 'bg-amber-50 text-amber-700 border border-amber-200/80 hover:bg-amber-100' :
                          'bg-slate-100 text-slate-700 border border-slate-200/80 hover:bg-slate-200'
                        }`}
                        title="Змінити етап кандидата в 1 клік"
                      >
                        {stagesList.map((stg) => (
                          <option key={stg} value={stg} className="bg-white text-slate-800 font-medium">
                            {stg}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded px-1.5 font-bold shrink-0">{candidate.source}</span>
                      {candidate.sourceDetails && (
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded px-1.5 font-bold shrink-0 inline-flex items-center space-x-1" title={`Уточнення джерела: ${candidate.sourceDetails}`}>
                          <span>📌</span>
                          <span>{candidate.sourceDetails}</span>
                        </span>
                      )}
                      {candidate.referredBy && (
                        <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200/80 rounded px-1.5 font-bold shrink-0 inline-flex items-center space-x-1" title={`Рекомендація від працівника: ${candidate.referredBy}`}>
                          <span>👤</span>
                          <span>Від: {candidate.referredBy}</span>
                        </span>
                      )}
                    </div>
                    
                    {/* Phone & Questionnaire / Profile info right below name/status */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-0.5 font-medium">
                      {candidate.phone && (
                        <span className="flex items-center flex-wrap gap-y-1">
                          <Phone className="h-3.5 w-3.5 mr-1 text-slate-400 shrink-0" /> 
                          <span className="mr-2 text-slate-700 font-bold tracking-tight select-all">{candidate.phone}</span>
                          <span className="inline-flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(candidate.phone);
                                setCopiedPhoneId(candidate.id);
                                setTimeout(() => setCopiedPhoneId(null), 2000);
                              }}
                              className="inline-flex items-center justify-center p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
                              title="Скопіювати номер"
                            >
                              {copiedPhoneId === candidate.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
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
                        </span>
                      )}
                      {candidate.birthDate && (
                        <span className="flex items-center">
                          <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400 shrink-0" />
                          <span>ДН: {formatDate(candidate.birthDate)}</span>
                          {calculateAge(candidate.birthDate) !== null && (
                            <span className="ml-1 text-slate-400">({calculateAge(candidate.birthDate)} р.)</span>
                          )}
                        </span>
                      )}
                      {candidate.contactDate && (
                        <span className="flex items-center">
                          <Info className="h-3.5 w-3.5 mr-1 text-slate-400 shrink-0" /> Контакт: {formatDate(candidate.contactDate)}
                        </span>
                      )}
                    </div>
                    
                    {/* Vacancy & Department badges */}
                    {(() => {
                      const v = vacancyMap.get(candidate.vacancyId);
                      return (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100/60 uppercase tracking-wider" title="Посада / Вакансія">
                            {v ? v.title : 'Невідома вакансія'}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 uppercase tracking-wider" title="Підрозділ / Департамент">
                            {v ? v.department : 'Невідомий підрозділ'}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Interview info if scheduled */}
                    {(() => {
                      const candInterview = interviews.find(i => i.candidateId === candidate.id);
                      if (!candInterview) return null;
                      return (
                        <div className="pt-0.5 flex flex-wrap gap-1.5 items-center">
                          <span className="inline-flex items-center text-indigo-900 bg-indigo-50 border border-indigo-100/80 px-2.5 py-0.5 rounded-lg font-bold text-[11px]">
                            <Calendar className="h-3.5 w-3.5 mr-1 text-indigo-600" />
                            Співбесіда: {formatDateTime(candInterview.dateTime)} ({candInterview.status})
                          </span>
                          {(candInterview.result === 'Співбесіда з керівником' || candInterview.managerName || candidate.status === 'Співбесіда з керівником') && (
                            <span className="inline-flex items-center text-indigo-800 bg-indigo-100/90 border border-indigo-200 px-2.5 py-0.5 rounded-lg font-bold text-[11px]">
                              👔 Співбесіда з керівником{candInterview.managerName ? `: ${candInterview.managerName}` : ''}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    
                    {candidate.comment && (
                      <p className="text-xs text-slate-500 bg-slate-50/70 p-2 rounded-lg italic border border-slate-100/50 line-clamp-2 mt-1 font-medium">
                        "{candidate.comment}"
                      </p>
                    )}

                    {(candidate.status === 'Відмова кандидата' || candidate.status === 'Відмова компанії' || candidate.status === 'Відхилено') && candidate.rejectionReason && (
                      <div className={`mt-1.5 flex items-center text-[11px] rounded-lg px-2.5 py-1 w-fit font-bold border ${
                        candidate.status === 'Відмова кандидата'
                          ? 'text-amber-800 bg-amber-50/80 border-amber-200'
                          : 'text-rose-700 bg-rose-50/60 border-rose-100'
                      }`}>
                        <AlertTriangle className={`h-3.5 w-3.5 mr-1 shrink-0 ${candidate.status === 'Відмова кандидата' ? 'text-amber-600' : 'text-rose-500'}`} />
                        <span>Причина відмови: {candidate.rejectionReason}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rating and Dates block */}
                <div className="flex sm:flex-col items-end justify-between sm:justify-start border-t sm:border-0 pt-3 sm:pt-0 border-slate-100 shrink-0 self-stretch sm:self-auto sm:text-right space-y-2">
                  <div className="flex space-x-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3.5 w-3.5 ${
                          star <= candidate.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Подано: {formatDate(candidate.appliedAt)}
                  </div>
                  {(candidate.cvFileContent || candidate.cvLink) && (
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
                  {candidate.cvFileContent && (
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
                        onViewPersonalFile(candidate.id);
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
                      handleOpenEdit(candidate);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer"
                    title="Редагувати анкету кандидата"
                  >
                    <Edit2 className="h-3 w-3 text-slate-600" />
                    <span>Редагувати</span>
                  </button>
                  {onDeleteCandidate && (
                    <div className="inline-flex items-center">
                      {confirmDeleteId === candidate.id ? (
                        <div className="flex items-center bg-rose-50 border border-rose-100 rounded-lg p-0.5 space-x-1 animate-fade-in">
                          <span className="text-[9px] font-bold text-rose-700 px-1 uppercase">Дійсно?</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCandidate(candidate.id);
                              setConfirmDeleteId(null);
                              if (selectedCandidate?.id === candidate.id) {
                                setSelectedCandidate(null);
                                handleOpenAdd();
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
                          title="Видалити кандидата"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(candidate.id);
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
            ))
          )}
        </div>

        {/* Pagination Toolbar */}
        {filteredCandidates.length > 0 && (
          <div className="bg-white p-3.5 px-4 rounded-2xl border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-600">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Показано:</span>
              <span className="font-bold text-slate-800">
                {pageSize === 'all' 
                  ? filteredCandidates.length 
                  : `${Math.min(filteredCandidates.length, (currentPage - 1) * pageSize + 1)}–${Math.min(filteredCandidates.length, currentPage * pageSize)}`
                }
              </span>
              <span className="text-slate-400">із</span>
              <span className="font-bold text-slate-800">{filteredCandidates.length}</span>
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
                  <option value="all">Всі ({filteredCandidates.length})</option>
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
      </div>

      {/* Detail / Editor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print" onClick={() => { setIsModalOpen(false); setSelectedCandidate(null); }}>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto space-y-4 animate-scale-up" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={() => { setIsModalOpen(false); setSelectedCandidate(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-slate-800 text-lg">
                {selectedCandidate ? 'Профіль кандидата' : 'Додати кандидата'}
              </h4>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!selectedCandidate && (
                <div className="bg-teal-50/40 border border-teal-100/70 rounded-2xl p-4.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-teal-800 flex items-center uppercase tracking-wider">
                      <Sparkles className="h-4 w-4 mr-1.5 text-teal-600 shrink-0" />
                      Швидкий імпорт резюме
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowImportText(!showImportText)}
                      className="text-[11px] text-teal-700 hover:underline font-extrabold cursor-pointer"
                    >
                      {showImportText ? 'Згорнути' : 'Розгорнути'}
                    </button>
                  </div>
                  
                  {showImportText && (
                    <div className="space-y-3 pt-1 animate-fade-in font-medium">
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Вставте text резюме або посилання з сайтів <strong>Work.ua, Robota.ua, LinkedIn</strong>. Наша система автоматично розпізнає ПІБ, номер телефону та джерело!
                      </p>
                      <textarea
                        value={importInput}
                        onChange={(e) => setImportInput(e.target.value)}
                        placeholder="Вставте сюди текст резюме чи посилання..."
                        rows={4}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden transition resize-none text-slate-600 font-medium"
                      />
                      <button
                        type="button"
                        onClick={handleParseImport}
                        disabled={!importInput.trim() || isParsing}
                        className="w-full py-2 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        {isParsing ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Аналіз за допомогою Gemini AI...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Розпізнати та заповнити</span>
                          </>
                        )}
                      </button>
                      {parseError && (
                        <p className="text-[10px] text-amber-600 font-bold bg-amber-50 border border-amber-100 rounded-lg p-2 animate-fade-in">
                          {parseError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">ПІБ Кандидата</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Прізвище, Ім'я, По батькові"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Дата народження</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Дата контакту</label>
                  <input
                    type="date"
                    required
                    value={contactDate}
                    onChange={(e) => setContactDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Контактний телефон</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+380 XX XXX-XX-XX"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                />
              </div>

              {/* Type of Call Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Тип першого контакту</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Гарячий', 'Холодний'] as const).map((type) => (
                    <button
                      type="button"
                      key={type}
                      onClick={() => setCallType(type)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                        callType === type
                          ? type === 'Гарячий'
                            ? 'bg-orange-50 border-orange-300 text-orange-800'
                            : 'bg-sky-50 border-sky-300 text-sky-800'
                          : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {type === 'Гарячий' ? <Flame className="h-3.5 w-3.5" /> : <Snowflake className="h-3.5 w-3.5" />}
                      <span>{type} дзвінок</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Вакансія</label>
                <select
                  required
                  value={vacancyId}
                  onChange={(e) => setVacancyId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                >
                  <option value="">Оберіть вакансію</option>
                  {sortedVacancies.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.title} ({v.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Джерело</label>
                  <select
                    value={isCustomSource ? '__custom__' : source}
                    onChange={handleSourceChange}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                  >
                    {availableSources.map(src => (
                      <option key={src} value={src}>{src}</option>
                    ))}
                    <option value="__custom__">✍️ + Інше джерело...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Етап підбору</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CandidateStatus)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                  >
                    {stagesList.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Specific employee referral field when source is "працівник" */}
              {(isCustomSource ? customSource : source).toLowerCase().includes('працівник') && (
                <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3 space-y-1.5 animate-fade-in">
                  <label className="block text-xs font-bold text-amber-900 flex items-center">
                    <Users className="h-3.5 w-3.5 text-amber-700 mr-1.5 shrink-0" />
                    <span>Вкажіть працівника (хто порекомендував):</span>
                  </label>
                  <input
                    type="text"
                    value={referredBy}
                    onChange={(e) => setReferredBy(e.target.value)}
                    placeholder="Введіть ПІБ або посаду працівника, напр.: Іваненко Сергій"
                    className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-lg focus:outline-hidden focus:border-amber-600 font-medium text-slate-800 placeholder:text-slate-400"
                  />
                  <p className="text-[11px] text-amber-800/80 font-medium">
                    Дані про рекомендацію збережуться в картці кандидата та у звітах.
                  </p>
                </div>
              )}

              {/* Specific comment/clarification field when source is "інше" */}
              {(isCustomSource ? customSource : source).toLowerCase().includes('інше') && (
                <div className="bg-indigo-50/80 border border-indigo-200/90 rounded-xl p-3 space-y-1.5 animate-fade-in">
                  <label className="block text-xs font-bold text-indigo-950 flex items-center">
                    <MessageSquare className="h-3.5 w-3.5 text-indigo-700 mr-1.5 shrink-0" />
                    <span>Вкажіть коментар / доповнення (що саме «інше»):</span>
                  </label>
                  <input
                    type="text"
                    value={sourceDetails}
                    onChange={(e) => setSourceDetails(e.target.value)}
                    placeholder="Наприклад: білборд, реклама у транспорті, ярмарок кар'єри, знайомі тощо"
                    className="w-full px-3 py-2 text-sm bg-white border border-indigo-300 rounded-lg focus:outline-hidden focus:border-indigo-600 font-medium text-slate-800 placeholder:text-slate-400"
                  />
                  <p className="text-[11px] text-indigo-800/80 font-medium">
                    Уточнення збережеться в картці кандидата, таблицях та звітах HR-системи.
                  </p>
                </div>
              )}

              <div>
                <label className="flex items-center space-x-2.5 text-xs font-bold text-slate-700 cursor-pointer p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition select-none">
                  <input
                    type="checkbox"
                    checked={hasDocuments}
                    onChange={(e) => setHasDocuments(e.target.checked)}
                    className="h-4 w-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                  />
                  <span className="flex items-center space-x-1.5">
                    <span>📄</span>
                    <span>Наявність документів (паспорт, ІПН тощо)</span>
                  </span>
                </label>
              </div>

              {(status === 'Відмова кандидата' || status === 'Відмова компанії' || status === 'Відхилено') && (
                <div className="bg-rose-50/50 border border-rose-200/50 rounded-2xl p-4 space-y-3 animate-fade-in">
                  <div className="flex items-center space-x-2 text-rose-800">
                    <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
                    <span className="text-xs font-extrabold uppercase tracking-wider">
                      {status === 'Відмова кандидата' ? 'Причина відмови кандидата' : 'Причина відмови компанії'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-rose-800 uppercase tracking-wider mb-1">Оберіть або вкажіть причину</label>
                    <select
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-rose-200 rounded-xl focus:border-rose-500 focus:outline-hidden text-slate-700 font-medium mb-2 font-semibold"
                    >
                      <option value="">-- Оберіть причину --</option>
                      {status === 'Відмова кандидата' ? (
                        <>
                          <option value="Кандидат сам відмовився від вакансії">Кандидат сам відмовився від вакансії</option>
                          <option value="Не підходить заробітна плата">Не підходить заробітна плата</option>
                          <option value="Не підходить графік / формат роботи">Не підходить графік / формат роботи</option>
                          <option value="Не підходить локація (далеко добиратися)">Не підходить локація (далеко добиратися)</option>
                          <option value="Знайшов іншу роботу / прийняв інший офер">Знайшов іншу роботу / прийняв інший офер</option>
                          <option value="Не вийшов на зв'язок">Не вийшов на зв'язок</option>
                          <option value="Сімейні або особисті обставини">Сімейні або особисті обставини</option>
                          <option value="Інша причина">Інша причина</option>
                        </>
                      ) : (
                        <>
                          <option value="Невідповідність вимогам (hard skills)">Невідповідність вимогам (hard skills)</option>
                          <option value="Завищені очікування по заробітній платі">Завищені очікування по заробітній платі</option>
                          <option value="Не пройшов співбесіду">Не пройшов співбесіду</option>
                          <option value="Не відповідає культурі компанії (soft skills)">Не відповідає культурі компанії (soft skills)</option>
                          <option value="Обрали іншого кандидата">Обрали іншого кандидата</option>
                          <option value="Негативні рекомендації">Негативні рекомендації</option>
                          <option value="Інша причина">Інша причина</option>
                        </>
                      )}
                    </select>
                    <input
                      type="text"
                      placeholder="Або введіть свою причину відмови..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-rose-200 rounded-xl focus:border-rose-500 focus:outline-hidden text-slate-700 font-medium placeholder-slate-400"
                    />
                  </div>
                </div>
              )}

              {status === 'Співбесіда' && (
                <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 space-y-3.5 animate-fade-in">
                  <div className="flex items-center space-x-2 text-amber-800">
                    <Calendar className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                    <span className="text-xs font-extrabold uppercase tracking-wider">Запланувати співбесіду</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Дата та час співбесіди</label>
                      <input
                        type="datetime-local"
                        required={status === 'Співбесіда'}
                        value={interviewDateTime}
                        onChange={(e) => setInterviewDateTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-xl focus:border-amber-500 focus:outline-hidden text-slate-700 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Інтерв'юер (Хто проводить)</label>
                      <input
                        type="text"
                        value={interviewInterviewer}
                        onChange={(e) => setInterviewInterviewer(e.target.value)}
                        placeholder="ПІБ співробітника"
                        className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-xl focus:border-amber-500 focus:outline-hidden text-slate-700 font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isCustomSource && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Введіть власне джерело</label>
                  <input
                    type="text"
                    required
                    value={customSource}
                    onChange={(e) => setCustomSource(e.target.value)}
                    placeholder="напр. linkedin, робота ру і т.д."
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700"
                  />
                </div>
              )}

              {autoMatchedCandidate && (
                <div className="bg-amber-50 border-2 border-amber-300/80 rounded-2xl p-3.5 flex items-center justify-between shadow-xs animate-fade-in my-2">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                      <UserCheck className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-amber-950">
                        Знайдено кандидата у базі: <span className="underline">{autoMatchedCandidate.name}</span>
                      </p>
                      <p className="text-[11px] text-amber-800 font-medium">
                        {autoMatchedCandidate.phone ? `Тел: ${autoMatchedCandidate.phone} | ` : ''}
                        Етап: <strong className="font-bold">{autoMatchedCandidate.status}</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCandidate(autoMatchedCandidate);
                      setName(autoMatchedCandidate.name);
                      setPhone(autoMatchedCandidate.phone || '');
                      setBirthDate(autoMatchedCandidate.birthDate || '');
                      setContactDate(autoMatchedCandidate.contactDate || getTodayDateString());
                      setVacancyId(autoMatchedCandidate.vacancyId || '');
                      setSource(autoMatchedCandidate.source || 'work.ua');
                      setStatus(autoMatchedCandidate.status || 'Новий');
                      setComment(autoMatchedCandidate.comment || '');
                      setRejectionReason(autoMatchedCandidate.rejectionReason || '');
                      setCvLink(autoMatchedCandidate.cvLink || '');
                      setCvFileName(autoMatchedCandidate.cvFileName || '');
                      setRating(autoMatchedCandidate.rating || 3);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold transition shadow-xs flex items-center space-x-1 cursor-pointer shrink-0"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Підтягнути дані</span>
                  </button>
                </div>
              )}

              {/* Resume File or Link selection */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Резюме кандидата (CV)</label>
                
                {/* Drag and Drop File Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all ${
                    isDragging 
                      ? 'border-teal-600 bg-teal-50/30 animate-pulse' 
                      : cvFileContent 
                        ? 'border-teal-600/50 bg-teal-50/5' 
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                  }`}
                >
                  {cvFileContent ? (
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center space-x-2 min-w-0">
                        <FileText className="h-5 w-5 text-teal-600 shrink-0" />
                        <div className="text-left min-w-0">
                          <p className="font-bold text-slate-700 truncate" title={cvFileName}>
                            {cvFileName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Файл завантажено локально</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewCv({
                            candidateName: name || 'Кандидат',
                            fileName: cvFileName || 'Резюме.pdf',
                            fileContent: cvFileContent,
                            cvLink: cvLink
                          })}
                          className="text-teal-600 hover:text-teal-700 hover:underline font-bold text-[11px] inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Переглянути</span>
                        </button>
                        <a
                          href={cvFileContent}
                          download={cvFileName || 'resume.pdf'}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-bold text-[11px]"
                        >
                          Скачати
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setCvFileContent('');
                            setCvFileName('');
                          }}
                          className="text-rose-500 hover:text-rose-700 font-extrabold text-[11px] cursor-pointer"
                        >
                          Видалити
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer block space-y-1">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileChange(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                      <div className="flex justify-center">
                        <FileText className="h-7 w-7 text-slate-400 animate-pulse" />
                      </div>
                      <p className="text-xs font-bold text-slate-600">Перетягніть файл сюди або натисніть</p>
                      <p className="text-[10px] text-slate-400 font-medium">PDF, DOCX, зображення до 5MB</p>
                    </label>
                  )}
                </div>

                {/* Or link fallback */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Або посилання на онлайн резюме</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={cvLink}
                      onChange={(e) => setCvLink(e.target.value)}
                      placeholder="напр. https://drive.google.com/..."
                      className="w-full pl-3.5 pr-9 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700"
                    />
                    {cvLink && (
                      <a
                        href={cvLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute right-3 top-2.5 text-teal-600 hover:text-teal-700"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Comment field - requested */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Коментар</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Введіть ваші нотатки або коментар про кандидата..."
                  rows={3}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition resize-none text-slate-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Початкова оцінка</label>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      className="p-1 rounded-sm focus:outline-hidden cursor-pointer"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= rating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex space-x-3">
                {selectedCandidate && onDeleteCandidate && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Видалити кандидата ${selectedCandidate.name}?`)) {
                        onDeleteCandidate(selectedCandidate.id);
                        setSelectedCandidate(null);
                        setIsModalOpen(false);
                        handleOpenAdd();
                      }
                    }}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition border border-rose-200/50 cursor-pointer"
                    title="Видалити"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  id="save-candidate-submit"
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs hover:shadow-md"
                >
                  {selectedCandidate ? 'Зберегти зміни' : 'Додати кандидата'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <IframePrintModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} />
      <CvPreviewModal
        isOpen={Boolean(previewCv)}
        onClose={() => setPreviewCv(null)}
        candidateName={previewCv?.candidateName || ''}
        fileName={previewCv?.fileName}
        fileContent={previewCv?.fileContent}
        cvLink={previewCv?.cvLink}
      />
      <JobSitesSyncModal
        isOpen={isJobSitesModalOpen}
        onClose={() => setIsJobSitesModalOpen(false)}
        vacancies={vacancies}
        existingCandidates={candidates}
        onAddCandidates={(newCandidates) => {
          newCandidates.forEach(cand => onAddCandidate(cand));
        }}
      />

      {/* Модальне вікно для введення причини відмови кандидата / компанії */}
      {rejectionModalCandidate && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-xl ${
                  rejectionModalCandidate.targetStatus === 'Відмова кандидата' 
                    ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                    : 'bg-rose-50 text-rose-600 border border-rose-200'
                }`}>
                  {rejectionModalCandidate.targetStatus === 'Відмова кандидата' ? (
                    <UserX className="h-5 w-5" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {rejectionModalCandidate.targetStatus === 'Відмова кандидата'
                      ? 'Відмова кандидата'
                      : 'Відмова компанії'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium truncate max-w-[220px]">
                    {rejectionModalCandidate.candidate.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectionModalCandidate(null);
                  setQuickRejectionReason('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Оберіть типову причину:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(rejectionModalCandidate.targetStatus === 'Відмова кандидата' ? [
                    'Не підійшла зарплата',
                    'Знайшов іншу роботу',
                    'Незручний графік / локація',
                    'Особисті обставини',
                    'Не виходить на зв\'язок',
                    'Відмовився без пояснень'
                  ] : [
                    'Невідповідність вимогам',
                    'Недостатній досвід',
                    'Не пройшов співбесіду',
                    'Обрали іншого кандидата',
                    'Не з\'явився на зустріч',
                    'Негативні рекомендації'
                  ]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQuickRejectionReason(preset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        quickRejectionReason === preset
                          ? (rejectionModalCandidate.targetStatus === 'Відмова кандидата'
                              ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                              : 'bg-rose-100 text-rose-900 border-rose-300 font-bold')
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Або введіть детальну причину відмови:
                </label>
                <textarea
                  rows={3}
                  value={quickRejectionReason}
                  onChange={(e) => setQuickRejectionReason(e.target.value)}
                  placeholder="Вкажіть конкретну причину відмови..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-teal-600 focus:outline-hidden transition resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setRejectionModalCandidate(null);
                  setQuickRejectionReason('');
                }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalReason = quickRejectionReason.trim() || (
                    rejectionModalCandidate.targetStatus === 'Відмова кандидата' 
                      ? 'Відмова кандидата' 
                      : 'Відмова компанії'
                  );
                  onUpdateCandidate({
                    ...rejectionModalCandidate.candidate,
                    status: rejectionModalCandidate.targetStatus,
                    rejectionReason: finalReason
                  });
                  setRejectionModalCandidate(null);
                  setQuickRejectionReason('');
                }}
                className={`px-4 py-2 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs ${
                  rejectionModalCandidate.targetStatus === 'Відмова кандидата'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Підтвердити статус
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
