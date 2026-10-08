import React, { useState, useEffect, useMemo } from 'react';
import { Intern, Candidate, InternStatus, Vacancy, Interview } from '../types';
import { formatDate, formatDateTime, getTodayDateString, calculateAge, formatDateForInput, parseDateComponents } from '../lib/dateUtils';
import IframePrintModal from './IframePrintModal';
import { 
  Award, 
  Plus, 
  Calendar, 
  User, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Sliders, 
  Star, 
  Phone, 
  MapPin, 
  Briefcase, 
  Cake, 
  Sparkles,
  ChevronRight,
  FileText,
  ExternalLink,
  AlertTriangle,
  FileCheck,
  Filter,
  Printer,
  X,
  Eye,
  UserCheck,
  Edit2,
  Copy,
  Check,
  ArrowUpDown
} from 'lucide-react';
import { CvPreviewModal } from './CvPreviewModal';

interface InternsManagerProps {
  interns: Intern[];
  candidates: Candidate[];
  vacancies: Vacancy[];
  interviews: Interview[];
  internStatusesList: string[];
  onAddIntern: (intern: Omit<Intern, 'id'>) => void;
  onUpdateIntern: (intern: Intern) => void;
  onDeleteIntern?: (internId: string) => void;
  onViewPersonalFile?: (candidateId: string) => void;
  onUpdateCandidate?: (candidate: Candidate) => void;
}

const calculateDurationInDays = (start?: string, end?: string) => {
  if (!start || !end) return null;
  const pStart = parseDateComponents(start);
  const pEnd = parseDateComponents(end);
  if (!pStart.isValid || !pEnd.isValid) return null;
  const diffTime = pEnd.timestamp - pStart.timestamp;
  if (isNaN(diffTime)) return null;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : null;
};

const getDaysWord = (days: number) => {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дні';
  return 'днів';
};

// Helpers for messenger links
function getTelegramLink(phone?: string): string {
  if (!phone) return '#';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '38' + digits;
  }
  return `https://t.me/+${digits}`;
}

function getViberLink(phone?: string): string {
  if (!phone) return '#';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '38' + digits;
  }
  return `viber://chat?number=%2B${digits}`;
}

export default function InternsManager({
  interns = [],
  candidates = [],
  vacancies = [],
  interviews = [],
  internStatusesList = ['Триває', 'Успішно завершено', 'Не пройшов', 'Відмовився'],
  onAddIntern,
  onUpdateIntern,
  onDeleteIntern,
  onViewPersonalFile,
  onUpdateCandidate
}: InternsManagerProps) {
  const [filter, setFilter] = useState<string>('Всі');
  const [selectedIntern, setSelectedIntern] = useState<Intern | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handlePrint = () => {
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) {
      setShowPrintModal(true);
    } else {
      window.print();
    }
  };

  // Search & Filter States
  const [searchName, setSearchName] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'rating_desc'>('newest');
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [previewCv, setPreviewCv] = useState<{ candidateName: string; fileName?: string; fileContent?: string; cvLink?: string } | null>(null);

  // Candidates sorted alphabetically, excluding those who are rejected or in reserve
  const candidatesForInternship = useMemo(() => {
    return (candidates || [])
      .filter(c => {
        if (!c) return false;
        // Exclude rejected candidates and reserve
        if (c.status === 'Відмова компанії' || c.status === 'Відмова кандидата' || c.status === 'Відхилено' || c.status === 'Резерв') return false;
        
        // Exclude candidates with a "Резерв" interview result
        const hasReserveInterview = (interviews || []).some(i => i && i.candidateId === c.id && (i.result === 'Резерв' || i.result?.toLowerCase().includes('резерв')));
        if (hasReserveInterview) return false;
        
        return true;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'uk'));
  }, [candidates, interviews]);

  // Candidates who are not yet in interns and have an interview where result contains "стажування", excluding rejected or reserve
  const candidatesReadyForInternship = useMemo(() => {
    return (candidates || []).filter(c => {
      if (!c) return false;
      // Must not already be an intern
      if ((interns || []).some(i => i && i.candidateId === c.id)) return false;
      
      // Exclude if candidate is rejected or in reserve
      if (c.status === 'Відмова компанії' || c.status === 'Відмова кандидата' || c.status === 'Відхилено' || c.status === 'Резерв') return false;
      const hasReserveInterview = (interviews || []).some(i => i && i.candidateId === c.id && (i.result === 'Резерв' || i.result?.toLowerCase().includes('резерв')));
      if (hasReserveInterview) return false;

      // Must have an interview with result containing "стажування" (case-insensitive)
      return (interviews || []).some(i => i && i.candidateId === c.id && i.result?.toLowerCase().includes('стажування'));
    }).sort((a, b) => (b.id || '').localeCompare(a.id || ''));
  }, [candidates, interns, interviews]);

  // Form states
  const [candidateId, setCandidateId] = useState('');
  const [manualName, setManualName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [project, setProject] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('Триває');
  const [rating, setRating] = useState(3);
  const [comment, setComment] = useState('');
  const [hasDocuments, setHasDocuments] = useState(false);
  const [dismissalDate, setDismissalDate] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Filtering states like in Candidates
  const [titleFilter, setTitleFilter] = useState<string>('Всі');
  const [departmentFilter, setDepartmentFilter] = useState<string>('Всі');
  const [statusFilter, setStatusFilter] = useState<string>('Всі');

  const uniqueVacancyTitles = useMemo(() => {
    return Array.from(new Set((interns || []).map(i => i.position))).filter(Boolean).sort((a, b) => (a || '').localeCompare(b || '', 'uk'));
  }, [interns]);

  const uniqueDepartments = useMemo(() => {
    return Array.from(new Set((interns || []).map(i => i.department))).filter(Boolean).sort((a, b) => (a || '').localeCompare(b || '', 'uk'));
  }, [interns]);

  const uniquePositionsForForm = useMemo(() => {
    const fromVacancies = (vacancies || []).map(v => v.title);
    if (position && !fromVacancies.includes(position)) {
      fromVacancies.push(position);
    }
    return Array.from(new Set(fromVacancies)).filter(Boolean).sort((a, b) => (a || '').localeCompare(b || '', 'uk'));
  }, [vacancies, position]);

  const uniqueDepartmentsForForm = useMemo(() => {
    const fromVacancies = (vacancies || []).map(v => v.department);
    if (department && !fromVacancies.includes(department)) {
      fromVacancies.push(department);
    }
    return Array.from(new Set(fromVacancies)).filter(Boolean).sort((a, b) => (a || '').localeCompare(b || '', 'uk'));
  }, [vacancies, department]);


  // Exclude interns who are in reserve
  const nonReserveInterns = useMemo(() => {
    return (interns || []).filter(i => {
      if (!i) return false;
      const cName = i.candidateName ? i.candidateName.trim().toLowerCase() : '';
      // Check linked candidate status
      const cand = (candidates || []).find(c => (c.id && i.candidateId && c.id === i.candidateId) || (c.name && cName && c.name.trim().toLowerCase() === cName));
      if (cand && cand.status === 'Резерв') return false;

      // Check interview results
      const hasReserveInterview = (interviews || []).some(inv => 
        ((inv.candidateId && i.candidateId && inv.candidateId === i.candidateId) || (inv.candidateName && cName && inv.candidateName.trim().toLowerCase() === cName)) &&
        (inv.result === 'Резерв' || inv.result?.toLowerCase().includes('резерв'))
      );
      if (hasReserveInterview) return false;

      return true;
    });
  }, [interns, candidates, interviews]);

  const filteredInterns = useMemo(() => {
    const list = nonReserveInterns.filter(i => {
      if (!i) return false;
      // 1. Status Filter from tabs
      if (filter !== 'Всі' && i.status !== filter) return false;

      // 2. Status Filter from dropdown
      if (statusFilter !== 'Всі' && i.status !== statusFilter) return false;

      // 3. Vacancy Title Filter
      if (titleFilter !== 'Всі' && i.position !== titleFilter) return false;

      // 4. Department Filter
      if (departmentFilter !== 'Всі' && i.department !== departmentFilter) return false;

      // 5. Name Search
      if (searchName.trim()) {
        const query = searchName.toLowerCase();
        if (!(i.candidateName || '').toLowerCase().includes(query)) return false;
      }

      // 6. Date Filter
      if (i.startDate) {
        if (filterStartDate && i.startDate < filterStartDate) return false;
        if (filterEndDate && i.startDate > filterEndDate) return false;
      } else if (filterStartDate || filterEndDate) {
        return false;
      }

      return true;
    });

    // Accurate chronological sorting by internship start date (startDate)
    const getTimestamp = (dStr?: string) => {
      if (!dStr) return 0;
      const p = parseDateComponents(dStr);
      return p.isValid ? p.timestamp : (new Date(dStr).getTime() || 0);
    };

    return [...list].sort((a, b) => {
      if (sortOrder === 'newest') {
        const tsA = getTimestamp(a.startDate);
        const tsB = getTimestamp(b.startDate);
        if (tsA !== tsB) return tsB - tsA;
        const numA = parseInt(String(a.id || '').replace(/\D/g, '')) || 0;
        const numB = parseInt(String(b.id || '').replace(/\D/g, '')) || 0;
        return numB - numA;
      }
      if (sortOrder === 'oldest') {
        const tsA = getTimestamp(a.startDate);
        const tsB = getTimestamp(b.startDate);
        if (tsA !== tsB) return tsA - tsB;
        const numA = parseInt(String(a.id || '').replace(/\D/g, '')) || 0;
        const numB = parseInt(String(b.id || '').replace(/\D/g, '')) || 0;
        return numA - numB;
      }
      if (sortOrder === 'name_asc') {
        return (a.candidateName || '').localeCompare(b.candidateName || '', 'uk');
      }
      if (sortOrder === 'name_desc') {
        return (b.candidateName || '').localeCompare(a.candidateName || '', 'uk');
      }
      if (sortOrder === 'rating_desc') {
        return (b.rating || 0) - (a.rating || 0);
      }
      return 0;
    });
  }, [nonReserveInterns, filter, searchName, filterStartDate, filterEndDate, titleFilter, departmentFilter, statusFilter, sortOrder]);

  const prefillFromCandidate = (cid: string) => {
    const candidate = candidates.find(c => c.id === cid);
    if (candidate) {
      setManualName(candidate.name);
      setBirthDate(candidate.birthDate || '');
      setPhone(candidate.phone || '');
      // Get position and department from the candidate's vacancy
      const matchingVacancy = vacancies.find(v => v.id === candidate.vacancyId);
      if (matchingVacancy) {
        setPosition(matchingVacancy.title);
        setDepartment(matchingVacancy.department);
      } else {
        setPosition('');
        setDepartment('');
      }
    }
  };

  const handleOpenAdd = () => {
    setSelectedIntern(null);
    setCandidateId(''); // Default to empty choice to keep all fields clean!
    setManualName('');

    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setStartDate(today);
    setEndDate(nextMonth.toISOString().split('T')[0]);
    
    setProject('');
    setProgress(0);
    setStatus(internStatusesList?.[0] || 'Триває');
    setRating(3);
    setComment('');
    setHasDocuments(false);
    setBirthDate('');
    setPhone('');
    setPosition('');
    setDepartment('');
    setDismissalDate('');
    setRejectionReason('');
    setFormError(null);
  };

  // Run handleOpenAdd on mount to initialize form fields cleanly
  useEffect(() => {
    handleOpenAdd();
  }, []);

  // Watch candidate selection to auto-prefill fields
  const handleCandidateChange = (cid: string) => {
    setCandidateId(cid);
    setFormError(null);
    if (!cid) {
      setManualName('');
      setBirthDate('');
      setPhone('');
      setPosition('');
      setDepartment('');
    } else if (cid === '__manual__') {
      // Keep manualName if already typed, or empty
    } else {
      const candidate = candidates.find(c => c.id === cid);
      if (candidate) {
        setManualName(candidate.name);
      }
      prefillFromCandidate(cid);
    }
  };

  const handleAddNewIntern = () => {
    handleOpenAdd();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (intern: Intern) => {
    setSelectedIntern(intern);
    setFormError(null);
    const matchedCandidate = candidates.find(c => c.id === intern.candidateId);
    const matchedVacancy = matchedCandidate ? vacancies.find(v => v.id === matchedCandidate.vacancyId) : null;
    setCandidateId(intern.candidateId || '__manual__');
    setManualName(intern.candidateName || matchedCandidate?.name || '');
    setBirthDate(intern.birthDate || matchedCandidate?.birthDate || '');
    setPhone(intern.phone || matchedCandidate?.phone || '');
    setPosition(intern.position || matchedVacancy?.title || '');
    setDepartment(intern.department || matchedVacancy?.department || '');
    setStartDate(formatDateForInput(intern.startDate) || intern.startDate);
    setEndDate(formatDateForInput(intern.endDate) || intern.endDate);
    setProject(intern.project || '');
    setProgress(intern.progress || 0);
    setStatus(intern.status);
    setRating(intern.rating || 3);
    setComment(intern.comment || '');
    setHasDocuments(intern.hasDocuments || false);
    setDismissalDate(formatDateForInput(intern.dismissalDate) || intern.dismissalDate || '');
    setRejectionReason(intern.rejectionReason || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) {
      setFormError('Будь ласка, вкажіть дату початку стажування.');
      return;
    }
    
    if (!selectedIntern && !candidateId) {
      setFormError('Будь ласка, оберіть кандидата зі списку або виберіть ручне введення.');
      return;
    }

    const candidate = candidates.find(c => c.id === candidateId);
    const candidateName = manualName.trim() || (candidate ? candidate.name : (selectedIntern?.candidateName || ''));

    if (!candidateName.trim() || candidateName === 'Невідомий стажер') {
      setFormError('Будь ласка, введіть ПІБ стажера.');
      return;
    }

    const internData = {
      candidateId: candidateId === '__manual__' ? '' : (candidateId || selectedIntern?.candidateId || ''),
      candidateName: candidateName.trim(),
      birthDate: formatDateForInput(birthDate) || birthDate,
      phone,
      position: position.trim(),
      department: department.trim(),
      startDate: formatDateForInput(startDate) || startDate,
      endDate: formatDateForInput(endDate) || endDate,
      mentor: selectedIntern?.mentor || '',
      project: project.trim(),
      progress,
      status: status as InternStatus,
      rating,
      comment: comment.trim(),
      hasDocuments,
      dismissalDate: status === 'Успішно завершено' ? (formatDateForInput(dismissalDate) || dismissalDate) : undefined,
      rejectionReason: (status === 'Не пройшов' || status === 'Відмовився') ? rejectionReason.trim() : undefined
    };

    if (selectedIntern) {
      onUpdateIntern({
        ...selectedIntern,
        ...internData
      });
      setSelectedIntern(null);
      handleOpenAdd();
    } else {
      onAddIntern(internData);
      handleOpenAdd();
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Candidates Waiting for Internship Banner/Grid */}
      {candidatesReadyForInternship.length > 0 && (
        <div className="bg-emerald-50/70 border border-emerald-200/80 p-5 rounded-2xl shadow-xs animate-fade-in no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-emerald-200/60 gap-2">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-emerald-600 animate-pulse" />
              <div>
                <h5 className="text-sm font-bold text-slate-800">
                  Очікують стажування ({candidatesReadyForInternship.length})
                </h5>
                <p className="text-[11px] text-emerald-800 font-medium">Кандидати, які успішно пройшли співбесіду та готові до оформлення</p>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-900 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 w-fit">
              Готові до оформлення
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
            {candidatesReadyForInternship.map((cand) => {
              const vac = vacancies.find(v => v.id === cand.vacancyId);
              return (
                <div
                  key={cand.id}
                  onClick={() => {
                    handleCandidateChange(cand.id);
                    setIsModalOpen(true);
                  }}
                  className="bg-white p-3 rounded-xl border border-emerald-200/60 flex items-center justify-between gap-3 hover:bg-emerald-50/50 hover:border-emerald-300 transition cursor-pointer shadow-2xs hover:shadow-xs group animate-scale-up"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-800 capitalize truncate group-hover:text-teal-800 transition">{cand.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-semibold truncate">
                      💼 {vac ? vac.title : 'Без вакансії'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium truncate">
                      📞 {cand.phone || 'без телефону'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCandidateChange(cand.id);
                      setIsModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer shrink-0"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Оформити</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Interns List Panel */}
      <div className="space-y-4">
        {/* Actions header */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-800">Список стажерів</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="no-print flex items-center justify-center space-x-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="Надрукувати список стажерів"
            >
              <Printer className="h-4 w-4 text-slate-500" />
              <span>Друк</span>
            </button>
            <button
              id="add-intern-btn"
              onClick={handleAddNewIntern}
              className="flex items-center justify-center space-x-1.5 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Новий стажер</span>
            </button>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {['Всі', 'Триває', 'Успішно завершено', 'Не пройшов', 'Відмовився'].map((opt) => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
                filter === opt
                  ? 'bg-teal-700 text-white shadow-xs font-bold'
                  : 'bg-white border border-slate-200/80 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {opt === 'Всі' && '📋 '}
              {opt === 'Триває' && '🎓 '}
              {opt === 'Успішно завершено' && '✅ '}
              {opt === 'Не пройшов' && '❌ '}
              {opt === 'Відмовився' && '⚠️ '}
              {opt} ({
                opt === 'Всі' 
                  ? nonReserveInterns.length 
                  : nonReserveInterns.filter(i => i.status === opt).length
              })
            </button>
          ))}
        </div>

        {/* Search and Date Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col gap-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Пошук за ім'ям..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden text-slate-700 font-semibold placeholder-slate-400"
              />
              <div className="absolute left-3 top-2.5 text-slate-400">
                <User className="h-4 w-4 text-slate-400" />
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
              <span>З дати:</span>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden text-slate-700 font-semibold"
              />
              <span>По дату:</span>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden text-slate-700 font-semibold"
              />
              {(searchName || filterStartDate || filterEndDate || titleFilter !== 'Всі' || departmentFilter !== 'Всі' || statusFilter !== 'Всі') && (
                <button
                  onClick={() => {
                    setSearchName('');
                    setFilterStartDate('');
                    setFilterEndDate('');
                    setTitleFilter('Всі');
                    setDepartmentFilter('Всі');
                    setStatusFilter('Всі');
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-700 rounded-xl text-[10px] font-extrabold uppercase tracking-wide transition shrink-0 cursor-pointer"
                >
                  Очистити
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-50">
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

            {/* Sort Order Selector */}
            <div className="flex items-center space-x-2">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 focus:outline-hidden font-medium"
                title="Сортування списку стажерів"
              >
                <option value="newest">📅 За датою (нові спочатку)</option>
                <option value="oldest">📅 За датою (старі спочатку)</option>
                <option value="name_asc">🔤 За ПІБ (А - Я)</option>
                <option value="name_desc">🔤 За ПІБ (Я - А)</option>
                <option value="rating_desc">⭐ За рейтингом</option>
              </select>
            </div>
          </div>
        </div>

        {/* List of Interns */}
        <div className="space-y-3">
          {filteredInterns.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-400 text-sm">
              Стажерів не знайдено
            </div>
          ) : (
            filteredInterns.map((intern) => {
              const candidate = candidates.find(c => c.id === intern.candidateId);
              const daysWorked = calculateDurationInDays(intern.startDate, intern.endDate);
              
              return (
                <div
                  key={intern.id}
                  id={`intern-card-${intern.id}`}
                  onClick={() => handleOpenEdit(intern)}
                  className={`bg-white p-5 rounded-2xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    selectedIntern?.id === intern.id
                      ? 'border-teal-600 shadow-xs bg-teal-50/5'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-start space-x-4">
                       <div className="p-3 rounded-xl shrink-0 bg-teal-50 text-teal-700 border border-teal-100">
                        <Award className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 space-y-1 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1.5 leading-tight">
                          <h4 
                            onClick={(e) => {
                              if (onViewPersonalFile) {
                                e.stopPropagation();
                                onViewPersonalFile(intern.candidateId);
                              }
                            }}
                            className={`font-bold text-slate-800 text-base ${
                              onViewPersonalFile ? 'hover:text-teal-700 hover:underline underline-offset-4 cursor-pointer' : ''
                            }`}
                            title={onViewPersonalFile ? "Переглянути особову справу" : ""}
                          >
                            {intern.candidateName}
                          </h4>



                          {/* Status Select */}
                          <select
                            value={intern.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              const newStatus = e.target.value as InternStatus;
                              if (newStatus === 'Не пройшов' || newStatus === 'Відмовився') {
                                handleOpenEdit({
                                  ...intern,
                                  status: newStatus
                                });
                              } else {
                                onUpdateIntern({
                                  ...intern,
                                  status: newStatus
                                });
                              }
                            }}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold cursor-pointer transition focus:outline-hidden ${
                              intern.status === 'Триває' ? 'bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200' :
                              intern.status === 'Успішно завершено' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200' :
                              intern.status === 'Відмовився' ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200' :
                              'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200'
                            }`}
                            title="Змінити статус стажування в 1 клік"
                          >
                            <option value="Триває" className="bg-white text-slate-800 font-medium">🎓 Триває</option>
                            <option value="Успішно завершено" className="bg-white text-slate-800 font-medium">✅ Успішно завершено</option>
                            <option value="Не пройшов" className="bg-white text-slate-800 font-medium">❌ Не пройшов</option>
                            <option value="Відмовився" className="bg-white text-slate-800 font-medium">⚠️ Відмовився</option>
                          </select>

                          {/* Documents availability indicator */}
                          {intern.hasDocuments ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center shrink-0">
                              <span className="mr-1">📄</span> Документи є
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center shrink-0">
                              <span className="mr-1">⚠️</span> Без документів
                            </span>
                          )}
                        </div>
                      
                        <div className="flex flex-wrap items-center gap-x-2.5 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                          <span className="flex items-center text-teal-700">
                            <Briefcase className="h-3.5 w-3.5 mr-1 text-slate-400" /> {intern.position || 'Посада не вказана'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="flex items-center text-slate-500">
                            <MapPin className="h-3.5 w-3.5 mr-1 text-slate-400" /> {intern.department || 'Підрозділ не вказано'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4 pt-1.5 text-xs text-slate-500 font-medium">
                          <span className="flex items-center">
                            <strong>Завдання:</strong> <span className="text-slate-700 ml-1 font-bold">{intern.project || 'Основні задачі'}</span>
                          </span>
                          {(intern.birthDate || candidate?.birthDate) && (
                            <span className="flex items-center text-slate-600">
                              <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400 shrink-0" />
                              <span>ДН: {formatDate(intern.birthDate || candidate?.birthDate)}</span>
                              {calculateAge(intern.birthDate || candidate?.birthDate) !== null && (
                                <span className="ml-1 text-slate-400">({calculateAge(intern.birthDate || candidate?.birthDate)} р.)</span>
                              )}
                            </span>
                          )}
                          {intern.phone && (
                            <span className="flex items-center sm:col-span-2 text-[11px] flex-wrap gap-y-1">
                              <Phone className="h-3 w-3 mr-1.5 text-slate-400" /> 
                              <span className="mr-2 text-slate-700 font-bold tracking-tight select-all">{intern.phone}</span>
                              <span className="inline-flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(intern.phone);
                                    setCopiedPhoneId(intern.id);
                                    setTimeout(() => setCopiedPhoneId(null), 2000);
                                  }}
                                  className="inline-flex items-center justify-center p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
                                  title="Скопіювати номер"
                                >
                                  {copiedPhoneId === intern.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                </button>
                                <a
                                  href={getTelegramLink(intern.phone)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center justify-center px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200/50 hover:bg-sky-100 rounded text-[9px] font-bold transition cursor-pointer tracking-wide"
                                  title="Написати у Telegram"
                                >
                                  TG
                                </a>
                                <a
                                  href={getViberLink(intern.phone)}
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
                        </div>

                        {(() => {
                          const candInterview = interviews.find(i => i.candidateId === intern.candidateId);
                          if (!candInterview) return null;
                          return (
                            <div className="mt-2 text-xs bg-indigo-50/60 p-2 rounded-xl border border-indigo-100/70 text-indigo-900 font-medium flex items-center">
                              <Calendar className="h-3.5 w-3.5 mr-1.5 text-indigo-600 shrink-0" />
                              <span>Співбесіда: <strong>{formatDateTime(candInterview.dateTime)}</strong> ({candInterview.status})</span>
                            </div>
                          );
                        })()}

                        {intern.comment && (
                          <div className="mt-2 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100/70 text-slate-600">
                            <strong>Коментар:</strong> <span className="italic">{intern.comment}</span>
                          </div>
                        )}

                        {(intern.status === 'Не пройшов' || intern.status === 'Відмовився') && intern.rejectionReason && (
                          <div className="mt-1.5 flex items-center text-[11px] text-rose-700 bg-rose-50/60 border border-rose-100 rounded-lg px-2.5 py-1 w-fit font-bold">
                            <AlertTriangle className="h-3.5 w-3.5 mr-1 text-rose-500 shrink-0" />
                            <span>{intern.status === 'Відмовився' ? 'Відмовився:' : 'Причина:'} {intern.rejectionReason}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-end gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-50">
                    <div className="text-right text-xs text-slate-400 font-semibold mb-1">
                      <p className="flex items-center justify-end"><Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" /> {formatDate(intern.startDate)} — {intern.endDate ? formatDate(intern.endDate) : 'триває'}</p>
                    </div>

                    {/* Rating stars matching CandidatesManager */}
                    <div className="flex space-x-0.5 mb-1" title={`Оцінка: ${intern.rating || candidate?.rating || 0}/5`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-3.5 w-3.5 ${
                            star <= (intern.rating || candidate?.rating || 0) ? 'text-amber-500 fill-amber-500' : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>

                    {/* CV and Personal File actions identical to CandidatesManager */}
                    {(candidate?.cvFileContent || candidate?.cvLink) && (
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
                    {candidate?.cvFileContent && (
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
                          onViewPersonalFile(intern.candidateId);
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
                        handleOpenEdit(intern);
                      }}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer"
                      title="Редагувати картку стажера"
                    >
                      <Edit2 className="h-3 w-3 text-slate-600" />
                      <span>Редагувати</span>
                    </button>
                    {onDeleteIntern && (
                      <div className="inline-flex items-center">
                        {confirmDeleteId === intern.id ? (
                          <div className="flex items-center bg-rose-50 border border-rose-100 rounded-lg p-0.5 space-x-1 animate-fade-in">
                            <span className="text-[9px] font-bold text-rose-700 px-1 uppercase">Дійсно?</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteIntern(intern.id);
                                setConfirmDeleteId(null);
                                if (selectedIntern?.id === intern.id) {
                                  setSelectedIntern(null);
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
                            title="Видалити стажера"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(intern.id);
                            }}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer animate-fade-in"
                          >
                            <Trash2 className="h-3 w-3 text-rose-600" />
                          </button>
                        )}
                      </div>
                    )}
                    {intern.status === 'Успішно завершено' && intern.dismissalDate && (
                      <div className="mt-1 flex items-center justify-end text-[10px] text-rose-700 font-bold bg-rose-50 border border-rose-100 rounded-lg px-2 py-0.5 w-fit ml-auto">
                        <span>🚪 Звільнений: {intern.dismissalDate}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>



      {/* Detail / Editor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print" onClick={() => { setIsModalOpen(false); setSelectedIntern(null); }}>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto space-y-4 animate-scale-up" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={() => { setIsModalOpen(false); setSelectedIntern(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-teal-50 text-teal-700 rounded-2xl border border-teal-100 shrink-0">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <h4 className="font-extrabold text-slate-800 text-lg">
                      {selectedIntern ? 'Картка стажування' : 'Оформити стажера'}
                    </h4>
                    {selectedIntern && (
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-extrabold ${
                        (status || selectedIntern.status) === 'Успішно завершено' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        (status || selectedIntern.status) === 'Не пройшов' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {status || selectedIntern.status}
                      </span>
                    )}
                  </div>
                  {selectedIntern ? (
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      ПІБ стажера: <strong className="text-slate-900 font-bold text-sm">{manualName || selectedIntern.candidateName}</strong>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Заповніть інформацію для зарахування стажера
                    </p>
                  )}
                </div>
              </div>
              {!selectedIntern && (candidateId || manualName) && (
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="text-xs text-teal-700 hover:underline font-semibold cursor-pointer mr-8 shrink-0"
                >
                  Очистити поля
                </button>
              )}
            </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold flex items-center space-x-2 animate-fade-in">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}
            {/* Вибір кандидата з бази при оформленні нового стажера */}
            {!selectedIntern && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Обрати кандидата з бази
                </label>
                <select
                  value={candidateId}
                  onChange={(e) => handleCandidateChange(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                >
                  <option value="">-- Оберіть кандидата зі списку --</option>
                  {candidatesForInternship.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                  ))}
                  <option value="__manual__">+ Ввести дані вручну (без прив'язки до кандидата)</option>
                </select>
              </div>
            )}

            {/* ПІБ стажера - завжди доступно і наочно відображається */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  ПІБ стажера <span className="text-rose-500">*</span>
                </label>
                {selectedIntern?.candidateId && onViewPersonalFile && (
                  <button
                    type="button"
                    onClick={() => onViewPersonalFile(selectedIntern.candidateId)}
                    className="text-xs text-teal-700 hover:text-teal-900 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5 text-teal-600" />
                    <span>📂 Особова справа</span>
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-teal-600">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Введіть повне ПІБ стажера..."
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 focus:outline-hidden transition text-slate-900 font-bold shadow-2xs"
                />
              </div>
            </div>

            {/* Блок резюме та зв'язку з кандидатом */}
            {candidateId && candidateId !== '__manual__' && (() => {
              const cand = candidates.find(c => c.id === candidateId);
              if (!cand) return null;
              return (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 space-y-2 text-xs animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center">
                      <FileText className="h-4 w-4 mr-1 text-teal-600" />
                      Резюме (CV) кандидата: {cand.name} ({cand.status})
                    </span>
                    {onViewPersonalFile && (
                      <button
                        type="button"
                        onClick={() => onViewPersonalFile(cand.id)}
                        className="text-[10px] text-teal-700 hover:underline font-bold cursor-pointer"
                      >
                        📂 Відкрити справу
                      </button>
                    )}
                  </div>
                  
                  {cand.cvFileContent || cand.cvLink ? (
                    <div className="flex flex-col gap-1.5">
                      {cand.cvFileContent && (
                        <a
                          href={cand.cvFileContent}
                          download={cand.cvFileName || 'resume.pdf'}
                          className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold flex items-center justify-between transition"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="truncate max-w-[150px]">{cand.cvFileName}</span>
                          <span className="text-[9px] text-teal-600 font-bold uppercase shrink-0">Завантажити</span>
                        </a>
                      )}
                      {cand.cvLink && (
                        <a
                          href={cand.cvLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold flex items-center justify-between transition"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="truncate max-w-[150px]">{cand.cvLink}</span>
                          <span className="text-[9px] text-teal-600 font-bold uppercase shrink-0">Відкрити ↗</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-[11px]">Резюме не додано</p>
                  )}

                  <div className="pt-2 border-t border-slate-200/50 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Швидке додавання / заміна резюме:</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      <input
                        type="text"
                        placeholder="Вставте посилання на резюме"
                        value={cand.cvLink || ''}
                        onChange={(e) => {
                          onUpdateCandidate && onUpdateCandidate({
                            ...cand,
                            cvLink: e.target.value
                          });
                        }}
                        className="w-full px-2.5 py-1 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-teal-600"
                      />
                      <div className="flex items-center space-x-2">
                        <label className="flex-1 px-2.5 py-1 bg-white border border-slate-200 hover:border-teal-600 rounded-lg text-center cursor-pointer text-[10px] font-bold text-slate-600 truncate transition">
                          <span>{cand.cvFileName ? '📎 Змінити файл резюме' : '📎 Завантажити файл резюме'}</span>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  onUpdateCandidate && onUpdateCandidate({
                                    ...cand,
                                    cvFileName: file.name,
                                    cvFileContent: event.target?.result as string
                                  });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Дата народження</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Телефон стажера</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+380"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Посада стажування</label>
                <select
                  required
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-semibold"
                >
                  <option value="">-- Оберіть посаду --</option>
                  {uniquePositionsForForm.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Підрозділ стажування</label>
                <select
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-semibold"
                >
                  <option value="">-- Оберіть підрозділ --</option>
                  {uniqueDepartmentsForForm.map(dep => (
                    <option key={dep} value={dep}>{dep}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Дата початку</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Дата завершення</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700"
                />
              </div>
            </div>

            {/* Intern status configuration section */}
            <div className="space-y-3.5 p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Статус стажування 🎓</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-bold cursor-pointer"
                >
                  <option value="Триває">🎓 Триває (активне стажування)</option>
                  <option value="Успішно завершено">✅ Успішно завершено</option>
                  <option value="Не пройшов">❌ Не пройшов стажування</option>
                  <option value="Відмовився">⚠️ Відмовився від стажування</option>
                </select>
              </div>

              {status === 'Успішно завершено' && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Дата завершення/оформлення</label>
                  <input
                    type="date"
                    value={dismissalDate}
                    onChange={(e) => setDismissalDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-semibold"
                  />
                </div>
              )}

              {(status === 'Не пройшов' || status === 'Відмовився') && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {status === 'Відмовився' ? 'Причина відмови від стажування' : 'Причина чому не пройшов'}
                  </label>
                  <input
                    type="text"
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Вкажіть причину..."
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                  />
                </div>
              )}
            </div>

            {/* Documents Checkbox Selection */}
            <div className="flex items-center space-x-2.5 bg-slate-50 border border-slate-100 p-3 rounded-xl">
              <input
                type="checkbox"
                id="hasDocuments"
                checked={hasDocuments}
                onChange={(e) => setHasDocuments(e.target.checked)}
                className="h-4 w-4 rounded-md border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
              <label htmlFor="hasDocuments" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                Наявність документів (отримано) 📄
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Завдання стажування</label>
              <input
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="напр. Освоєння меню та стандартів видачі"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Оцінка роботи (1-5)</label>
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

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Коментар / Нотатка</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Введіть коментар або нотатку про роботу та успіхи стажера..."
                rows={3}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition resize-none text-slate-600 font-medium"
              />
            </div>

            <div className="pt-2 flex space-x-3">
              {selectedIntern && onDeleteIntern && (
                <div className="flex items-center shrink-0">
                  {confirmDeleteId === selectedIntern.id ? (
                    <div className="flex items-center bg-rose-50 border border-rose-100 rounded-xl p-1.5 space-x-2 animate-fade-in text-xs font-bold text-rose-700">
                      <span>Дійсно?</span>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteIntern(selectedIntern.id);
                          setConfirmDeleteId(null);
                          setSelectedIntern(null);
                          setIsModalOpen(false);
                          handleOpenAdd();
                        }}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition cursor-pointer"
                      >
                        Так
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition cursor-pointer"
                      >
                        Ні
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(selectedIntern.id)}
                      className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition border border-rose-100 cursor-pointer"
                      title="Видалити стажування"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
              <button
                type="submit"
                id="save-intern-submit"
                className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs hover:shadow-md animate-pulse"
              >
                {selectedIntern ? 'Зберегти зміни' : 'Оформити стажера'}
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
    </div>
  );
}
