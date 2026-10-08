import React, { useState, useMemo } from 'react';
import { FiredEmployee, Intern, Candidate } from '../types';
import { formatDate, getTodayDateString, calculateTenureMonths, formatTenure, calculateAge } from '../lib/dateUtils';
import { 
  Plus, 
  UserX, 
  Clock, 
  HelpCircle, 
  MessageSquare, 
  Trash2, 
  Calendar, 
  Search, 
  Filter, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Printer, 
  Briefcase, 
  Building2, 
  UserCheck,
  TrendingDown,
  Sparkles,
  FileText,
  Phone,
  Mail,
  FileCheck,
  ExternalLink,
  Edit2,
  Save,
  Check,
  Copy,
  Paperclip,
  ShieldCheck,
  FolderOpen,
  FileSpreadsheet,
  Eye
} from 'lucide-react';
import { CvPreviewModal } from './CvPreviewModal';

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

interface FiredAnalyticsProps {
  firedEmployees: FiredEmployee[];
  positions?: string[];
  departments?: string[];
  firedReasons?: string[];
  interns?: Intern[];
  candidates?: Candidate[];
  onAddFiredEmployee: (employee: Omit<FiredEmployee, 'id'>) => void;
  onUpdateFiredEmployee?: (employee: FiredEmployee) => void;
  onDeleteFiredEmployee?: (employeeId: string) => void;
  onViewPersonalFile?: (candidateId: string) => void;
}

const DEFAULT_DEPARTURE_REASONS = [
  "Виїзд за кордон",
  "Знайшов іншу роботу",
  "Кар'єрне зростання",
  "Рівень оплати праці",
  "Конфлікт у команді",
  "Особисті причини",
  "Не пройшов випробувальний термін",
  "Зміна сфери діяльності",
  "Незадоволеність керівництвом",
  "За власним бажанням",
  "За згодою сторін",
  "Скорочення штату",
  "Інше"
];

export default function FiredAnalytics({
  firedEmployees,
  positions = [],
  departments = [],
  firedReasons = [],
  interns = [],
  candidates = [],
  onAddFiredEmployee,
  onUpdateFiredEmployee,
  onDeleteFiredEmployee,
  onViewPersonalFile
}: FiredAnalyticsProps) {
  const reasonsList = useMemo(() => {
    return firedReasons.length > 0 ? firedReasons : DEFAULT_DEPARTURE_REASONS;
  }, [firedReasons]);
  const [selectedFired, setSelectedFired] = useState<FiredEmployee | null>(null);
  const [editingFired, setEditingFired] = useState<FiredEmployee | null>(null);
  const [viewingDossier, setViewingDossier] = useState<FiredEmployee | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [previewCv, setPreviewCv] = useState<{ candidateName: string; fileName?: string; fileContent?: string; cvLink?: string } | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterReason, setFilterReason] = useState('all');

  // Feedback notifications
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Quick Select from Interns/Candidates
  const [quickSelectId, setQuickSelectId] = useState('');

  // Main Form states (for creation or editing panel)
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState(getTodayDateString());
  const [reason, setReason] = useState(DEFAULT_DEPARTURE_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [exitNotes, setExitNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [transferCaseNotes, setTransferCaseNotes] = useState('');
  const [hasDocumentsReturned, setHasDocumentsReturned] = useState(false);
  const [fileLink, setFileLink] = useState('');

  // Dossier Modal Inline Edit states
  const [isEditingDossierModal, setIsEditingDossierModal] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalPosition, setModalPosition] = useState('');
  const [modalDepartment, setModalDepartment] = useState('');
  const [modalPhone, setModalPhone] = useState('');
  const [modalEmail, setModalEmail] = useState('');
  const [modalStartDate, setModalStartDate] = useState('');
  const [modalEndDate, setModalEndDate] = useState('');
  const [modalReason, setModalReason] = useState('');
  const [modalExitNotes, setModalExitNotes] = useState('');
  const [modalTransferNotes, setModalTransferNotes] = useState('');
  const [modalDocsReturned, setModalDocsReturned] = useState(false);
  const [modalFileLink, setModalFileLink] = useState('');
  const [copiedPhone, setCopiedPhone] = useState(false);

  const showNotification = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  // Computations & Analytics
  const stats = useMemo(() => {
    const count = firedEmployees.length;
    if (count === 0) return { avgTenure: '0', mainReason: 'Немає даних', reasonsBreakdown: [] };

    const totalTenure = firedEmployees.reduce((sum, f) => sum + calculateTenureMonths(f.startDate, f.endDate), 0);
    const avgTenure = (totalTenure / count).toFixed(1);

    const countsMap: Record<string, number> = {};
    firedEmployees.forEach(f => {
      countsMap[f.reason] = (countsMap[f.reason] || 0) + 1;
    });

    let mainReason = 'Невідомо';
    let maxCount = 0;
    Object.entries(countsMap).forEach(([r, c]) => {
      if (c > maxCount) {
        maxCount = c;
        mainReason = r;
      }
    });

    const reasonsBreakdown = Object.entries(countsMap)
      .map(([r, c]) => ({
        reason: r,
        count: c,
        percentage: Math.round((c / count) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    return {
      avgTenure,
      mainReason,
      reasonsBreakdown
    };
  }, [firedEmployees]);

  // Filtered list
  const filteredEmployees = useMemo(() => {
    return firedEmployees.filter(f => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        f.name.toLowerCase().includes(q) ||
        f.position.toLowerCase().includes(q) ||
        f.department.toLowerCase().includes(q) ||
        f.reason.toLowerCase().includes(q) ||
        (f.phone && f.phone.includes(q)) ||
        (f.email && f.email.toLowerCase().includes(q)) ||
        (f.transferCaseNotes && f.transferCaseNotes.toLowerCase().includes(q)) ||
        (f.exitNotes && f.exitNotes.toLowerCase().includes(q));

      const matchesDept = filterDepartment === 'all' || f.department === filterDepartment;
      const matchesReason = filterReason === 'all' || f.reason === filterReason;

      return matchesSearch && matchesDept && matchesReason;
    });
  }, [firedEmployees, searchQuery, filterDepartment, filterReason]);

  // Helper to handle Quick Select autofill
  const handleQuickSelect = (personId: string) => {
    setQuickSelectId(personId);
    if (!personId) return;

    if (personId.startsWith('intern-')) {
      const realId = personId.replace('intern-', '');
      const intern = interns.find(i => i.id === realId);
      if (intern) {
        setName(intern.candidateName);
        setPosition(intern.position || positions[0] || '');
        setDepartment(intern.department || departments[0] || '');
        setStartDate(intern.startDate || getTodayDateString());
        if (intern.endDate) setEndDate(intern.endDate);
        if (intern.phone) setPhone(intern.phone);
      }
    } else if (personId.startsWith('candidate-')) {
      const realId = personId.replace('candidate-', '');
      const candidate = candidates.find(c => c.id === realId);
      if (candidate) {
        setName(candidate.name);
        setPosition(positions[0] || '');
        setDepartment(departments[0] || '');
        setStartDate(candidate.appliedAt || getTodayDateString());
        if (candidate.phone) setPhone(candidate.phone);
      }
    }
  };

  // Populate form for editing in side panel
  const startEditing = (fired: FiredEmployee) => {
    setEditingFired(fired);
    setName(fired.name);
    setPosition(fired.position);
    setDepartment(fired.department);
    setStartDate(fired.startDate);
    setEndDate(fired.endDate);
    setPhone(fired.phone || '');
    setEmail(fired.email || '');
    setTransferCaseNotes(fired.transferCaseNotes || '');
    setHasDocumentsReturned(!!fired.hasDocumentsReturned);
    setFileLink(fired.fileLink || '');
    
    if (DEFAULT_DEPARTURE_REASONS.includes(fired.reason)) {
      setReason(fired.reason);
      setCustomReason('');
    } else {
      setReason('Інше');
      setCustomReason(fired.reason);
    }

    setExitNotes(fired.exitNotes || '');
  };

  const cancelEditing = () => {
    setEditingFired(null);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setPosition('');
    setDepartment('');
    setStartDate(getTodayDateString());
    setEndDate(getTodayDateString());
    setReason(DEFAULT_DEPARTURE_REASONS[0]);
    setCustomReason('');
    setExitNotes('');
    setPhone('');
    setEmail('');
    setTransferCaseNotes('');
    setHasDocumentsReturned(false);
    setFileLink('');
    setQuickSelectId('');
  };

  // Calculate live tenure months
  const calculatedTenureMonths = useMemo(() => {
    return calculateTenureMonths(startDate, endDate);
  }, [startDate, endDate]);

  // Submit Handler for side form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !position.trim() || !department.trim() || !startDate || !endDate) return;

    const finalReason = (reason === 'Інше' && customReason.trim()) ? customReason.trim() : reason;

    if (editingFired && onUpdateFiredEmployee) {
      onUpdateFiredEmployee({
        ...editingFired,
        name: name.trim(),
        position: position.trim(),
        department: department.trim(),
        startDate,
        endDate,
        tenureMonths: calculatedTenureMonths,
        reason: finalReason,
        exitNotes: exitNotes.trim(),
        phone: phone.trim(),
        email: email.trim(),
        transferCaseNotes: transferCaseNotes.trim(),
        hasDocumentsReturned,
        fileLink: fileLink.trim()
      });
      showNotification(`Справу для «${name.trim()}» успішно оновлено`);
      setEditingFired(null);
    } else {
      onAddFiredEmployee({
        name: name.trim(),
        position: position.trim(),
        department: department.trim(),
        startDate,
        endDate,
        tenureMonths: calculatedTenureMonths,
        reason: finalReason,
        exitNotes: exitNotes.trim(),
        phone: phone.trim(),
        email: email.trim(),
        transferCaseNotes: transferCaseNotes.trim(),
        hasDocumentsReturned,
        fileLink: fileLink.trim()
      });
      showNotification(`Справу звільнення для «${name.trim()}» зафіксовано`);
    }

    resetForm();
  };

  // Delete Handler
  const handleDelete = (id: string, empName: string) => {
    if (onDeleteFiredEmployee) {
      onDeleteFiredEmployee(id);
      showNotification(`Запис про звільнення «${empName}» вилучено`);
      if (selectedFired?.id === id) setSelectedFired(null);
      if (editingFired?.id === id) cancelEditing();
      if (viewingDossier?.id === id) setViewingDossier(null);
    }
    setConfirmDeleteId(null);
  };

  // Open Dossier Modal
  const handleOpenDossier = (fired: FiredEmployee) => {
    setViewingDossier(fired);
    setIsEditingDossierModal(false);
    setModalName(fired.name);
    setModalPosition(fired.position);
    setModalDepartment(fired.department);
    setModalPhone(fired.phone || '');
    setModalEmail(fired.email || '');
    setModalStartDate(fired.startDate);
    setModalEndDate(fired.endDate);
    setModalReason(fired.reason);
    setModalExitNotes(fired.exitNotes || '');
    setModalTransferNotes(fired.transferCaseNotes || '');
    setModalDocsReturned(!!fired.hasDocumentsReturned);
    setModalFileLink(fired.fileLink || '');
  };

  // Save changes from inside Dossier Modal
  const handleSaveDossierModal = () => {
    if (!viewingDossier || !onUpdateFiredEmployee) return;

    const tenure = calculateTenureMonths(modalStartDate, modalEndDate);

    const updated: FiredEmployee = {
      ...viewingDossier,
      name: modalName.trim(),
      position: modalPosition.trim(),
      department: modalDepartment.trim(),
      phone: modalPhone.trim(),
      email: modalEmail.trim(),
      startDate: modalStartDate,
      endDate: modalEndDate,
      tenureMonths: tenure,
      reason: modalReason.trim(),
      exitNotes: modalExitNotes.trim(),
      transferCaseNotes: modalTransferNotes.trim(),
      hasDocumentsReturned: modalDocsReturned,
      fileLink: modalFileLink.trim()
    };

    onUpdateFiredEmployee(updated);
    setViewingDossier(updated);
    setIsEditingDossierModal(false);
    showNotification(`Справу про звільнення для «${updated.name}» успішно оновлено`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Find linked candidate if exists
  const getLinkedCandidate = (fired: FiredEmployee) => {
    return candidates.find(c => c.name.toLowerCase() === fired.name.toLowerCase()) ||
           candidates.find(c => c.id === fired.id);
  };

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Toast Notification */}
      {feedbackMsg && (
        <div className="fixed bottom-5 right-5 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl z-50 flex items-center space-x-3 text-xs animate-bounce">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">{feedbackMsg}</span>
        </div>
      )}

      {/* Analytics Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-rose-50 rounded-xl text-rose-700 shrink-0">
            <TrendingDown className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Загалом звільнено</p>
            <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">{firedEmployees.length} осіб</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">База заархівованих справ</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-700 shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Середній термін роботи</p>
            <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">{stats.avgTenure} міс.</h3>
            <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Середній стаж працівників</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-teal-50 rounded-xl text-teal-700 shrink-0">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Головна причина</p>
            <h3 className="text-base font-bold text-slate-800 mt-0.5 truncate max-w-[180px]">{stats.mainReason}</h3>
            <p className="text-[11px] text-teal-600 font-semibold mt-0.5">Згідно з Exit Interview</p>
          </div>
        </div>
      </div>

      {/* Breakdown by Departure Reasons */}
      {stats.reasonsBreakdown.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-teal-700" />
            <span>Аналітика причин звільнення</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {stats.reasonsBreakdown.map((item) => (
              <div key={item.reason} className="bg-slate-50 p-3 rounded-xl border border-slate-100/80 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 truncate">{item.reason}</span>
                  <span className="font-extrabold text-rose-700 shrink-0 ml-2">{item.count} ({item.percentage}%)</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-rose-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column - List & Filters */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Шукати за ПІБ, посадою, телефоном, нотатками..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition font-medium"
                />
              </div>

              {/* Department Filter */}
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:bg-white focus:border-teal-600 focus:outline-hidden transition shrink-0"
              >
                <option value="all">Усі підрозділи</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              {/* Reason Filter */}
              <select
                value={filterReason}
                onChange={(e) => setFilterReason(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:bg-white focus:border-teal-600 focus:outline-hidden transition shrink-0 max-w-[160px] truncate"
              >
                <option value="all">Усі причини</option>
                {DEFAULT_DEPARTURE_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Departure List */}
          <div className="space-y-3">
            {filteredEmployees.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center text-slate-400 space-y-2">
                <UserX className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-500">Записів про звільнення не знайдено</p>
                <p className="text-[11px]">Заповніть форму праворуч або відредагуйте існуючі справи.</p>
              </div>
            ) : (
              filteredEmployees.map((fired) => {
                const isSelected = selectedFired?.id === fired.id;
                const isConfirmingDelete = confirmDeleteId === fired.id;
                const linkedCand = getLinkedCandidate(fired);

                return (
                  <div
                    key={fired.id}
                    id={`fired-card-${fired.id}`}
                    onClick={() => setSelectedFired(isSelected ? null : fired)}
                    className={`bg-white p-5 rounded-2xl border transition cursor-pointer space-y-3.5 ${
                      isSelected
                        ? 'border-rose-600 shadow-md ring-1 ring-rose-600/20'
                        : 'border-slate-100 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start space-x-3.5">
                        <div className="p-3 bg-rose-50 text-rose-700 rounded-xl shrink-0 mt-0.5">
                          <UserX className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h4
                              onClick={(e) => {
                                if (onViewPersonalFile) {
                                  e.stopPropagation();
                                  const linkedCand = getLinkedCandidate(fired);
                                  onViewPersonalFile(linkedCand ? linkedCand.id : fired.id);
                                }
                              }}
                              className={`font-bold text-slate-800 text-base ${
                                onViewPersonalFile ? 'hover:text-teal-700 hover:underline cursor-pointer' : ''
                              }`}
                              title={onViewPersonalFile ? "Переглянути особову справу" : ""}
                            >
                              {fired.name}
                            </h4>
                            {linkedCand?.hasDocuments ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center shrink-0" title="Документи є">
                                <span className="mr-1">📄</span> Документи є
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center shrink-0" title="Без документів">
                                <span className="mr-1">⚠️</span> Без документів
                              </span>
                            )}
                            {fired.hasDocumentsReturned && (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider flex items-center space-x-1" title="Обхідний лист підписано">
                                <FileCheck className="h-3 w-3" />
                                <span>Обхідний лист</span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs font-semibold text-teal-700 flex items-center space-x-1">
                              <Briefcase className="h-3 w-3 shrink-0" />
                              <span>{fired.position}</span>
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs font-semibold text-slate-600 flex items-center space-x-1">
                              <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
                              <span>{fired.department}</span>
                            </span>
                            {(fired.phone || linkedCand?.phone) && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-xs text-slate-600 font-semibold flex items-center space-x-1">
                                  <Phone className="h-3 w-3 text-slate-400" />
                                  <span className="select-all">{fired.phone || linkedCand?.phone}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const num = fired.phone || linkedCand?.phone || '';
                                      navigator.clipboard.writeText(num);
                                      setCopiedPhoneId(fired.id);
                                      setTimeout(() => setCopiedPhoneId(null), 2000);
                                    }}
                                    className="inline-flex items-center justify-center p-0.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
                                    title="Скопіювати номер"
                                  >
                                    {copiedPhoneId === fired.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                  </button>
                                  <a
                                    href={getTelegramLink(fired.phone || linkedCand?.phone || '')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center justify-center px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200/50 hover:bg-sky-100 rounded text-[9px] font-bold transition cursor-pointer tracking-wide"
                                    title="Написати у Telegram"
                                  >
                                    TG
                                  </a>
                                  <a
                                    href={getViberLink(fired.phone || linkedCand?.phone || '')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center justify-center px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200/50 hover:bg-purple-100 rounded text-[9px] font-bold transition cursor-pointer tracking-wide"
                                    title="Написати у Viber"
                                  >
                                    Viber
                                  </a>
                                </span>
                              </>
                            )}
                            {linkedCand?.birthDate && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-xs text-slate-500 font-medium flex items-center space-x-1">
                                  <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span>ДН: {formatDate(linkedCand.birthDate)}</span>
                                  {calculateAge(linkedCand.birthDate) !== null && (
                                    <span className="text-slate-400 font-semibold">({calculateAge(linkedCand.birthDate)} р.)</span>
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                          
                          <p className="text-xs text-slate-500 font-medium mt-1.5 flex items-center space-x-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>Термін роботи: <strong className="text-rose-700 font-bold">{formatTenure(fired.startDate, fired.endDate, fired.tenureMonths)}</strong> ({formatDate(fired.startDate)} — {formatDate(fired.endDate)})</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-2 shrink-0">
                        <span className="bg-rose-50 text-rose-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-rose-200/60 uppercase tracking-wider">
                          {fired.reason}
                        </span>

                        <div className="flex items-center space-x-1.5 pt-1 flex-wrap justify-end gap-y-1" onClick={e => e.stopPropagation()}>
                          {(linkedCand?.cvFileContent || linkedCand?.cvLink) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewCv({
                                  candidateName: fired.name,
                                  fileName: linkedCand.cvFileName || (linkedCand.cvLink ? 'Посилання на резюме' : 'Резюме.pdf'),
                                  fileContent: linkedCand.cvFileContent,
                                  cvLink: linkedCand.cvLink
                                });
                              }}
                              className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer flex items-center space-x-1"
                            >
                              <Eye className="h-3 w-3 text-teal-600" />
                              <span>Перегляд CV</span>
                            </button>
                          )}
                          {linkedCand?.cvFileContent && (
                            <a
                              href={linkedCand.cvFileContent}
                              download={linkedCand.cvFileName || 'resume.pdf'}
                              onClick={(e) => e.stopPropagation()}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer flex items-center space-x-1"
                            >
                              <FileText className="h-3 w-3 text-emerald-600" />
                              <span>Скачати</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (onViewPersonalFile) {
                                const linkedCand = getLinkedCandidate(fired);
                                onViewPersonalFile(linkedCand ? linkedCand.id : fired.id);
                              } else {
                                handleOpenDossier(fired);
                              }
                            }}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition flex items-center space-x-1 cursor-pointer"
                            title="Відкрити особову справу співробітника"
                          >
                            <FolderOpen className="h-3.5 w-3.5 text-rose-700" />
                            <span>Особова справа</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => startEditing(fired)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer flex items-center space-x-1"
                            title="Редагувати в бічній панелі"
                          >
                            <Edit2 className="h-3 w-3 text-slate-600" />
                            <span>Редагувати</span>
                          </button>

                          {onDeleteFiredEmployee && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(isConfirmingDelete ? null : fired.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                              title="Видалити запис"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delete Confirmation Alert */}
                    {isConfirmingDelete && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800 animate-fade-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center space-x-2 font-bold">
                          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                          <span>Дійсно видалити справу про звільнення?</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleDelete(fired.id, fired.name)}
                            className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg transition cursor-pointer"
                          >
                            Видалити
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition cursor-pointer"
                          >
                            Скасувати
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Transfer Case / Exit Notes previews */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {fired.transferCaseNotes && (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-700">
                          <span className="font-bold text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Передача справ & проектів:</span>
                          <p className="font-medium text-slate-800 line-clamp-2">{fired.transferCaseNotes}</p>
                        </div>
                      )}

                      {fired.exitNotes && (
                        <div className="bg-rose-50/40 p-2.5 rounded-xl border border-rose-100/50 text-slate-700">
                          <span className="font-bold text-rose-800/70 block text-[9px] uppercase tracking-wider mb-0.5">Exit Interview:</span>
                          <p className="italic text-slate-700 line-clamp-2">"{fired.exitNotes}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column - Registration / Edit Form */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs sticky top-4 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <UserX className="h-5 w-5 text-rose-700" />
                <h3 className="font-bold text-slate-800 text-sm">
                  {editingFired ? 'Редагування справи про звільнення' : 'Реєстрація звільнення'}
                </h3>
              </div>

              {editingFired && (
                <button
                  onClick={cancelEditing}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
                  title="Скасувати редагування"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Quick Autofill Selector (only when adding new) */}
            {!editingFired && (interns.length > 0 || candidates.length > 0) && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1">
                  <UserCheck className="h-3.5 w-3.5 text-teal-700" />
                  <span>Швидкий вибір зі стажерів/кандидатів</span>
                </label>
                <select
                  value={quickSelectId}
                  onChange={(e) => handleQuickSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                >
                  <option value="">-- Ввести вручну або обрати зі списку --</option>
                  {interns.length > 0 && (
                    <optgroup label="Стажери">
                      {interns.map(i => (
                        <option key={`intern-${i.id}`} value={`intern-${i.id}`}>
                          {i.candidateName} ({i.position} • {i.status})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {candidates.length > 0 && (
                    <optgroup label="Кандидати">
                      {candidates.map(c => (
                        <option key={`candidate-${c.id}`} value={`candidate-${c.id}`}>
                          {c.name} ({c.status})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  ПІБ Співробітника *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Прізвище, Ім'я, По батькові"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Посада *
                </label>
                <input
                  type="text"
                  required
                  list="positions-datalist"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="напр. Менеджер з продажів"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition font-medium"
                />
                <datalist id="positions-datalist">
                  {positions.map(p => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Підрозділ / Департамент *
                </label>
                <input
                  type="text"
                  required
                  list="departments-datalist"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="напр. Відділ продажів"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition font-medium"
                />
                <datalist id="departments-datalist">
                  {departments.map(d => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+380..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Дата прийому *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Дата звільнення *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                  />
                </div>
              </div>

              {/* Live Tenure preview */}
              <div className="bg-rose-50/70 border border-rose-100 p-2.5 rounded-xl text-xs text-rose-800 flex justify-between items-center font-semibold">
                <span>Розрахований стаж у компанії:</span>
                <span className="font-extrabold text-sm text-rose-700">{formatTenure(startDate, endDate, calculatedTenureMonths)}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Причина звільнення *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                >
                  {reasonsList.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                {reason === 'Інше' && (
                  <input
                    type="text"
                    required
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Вкажіть власну причину..."
                    className="w-full mt-2 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition font-medium"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Передача справ, доступів & проектів
                </label>
                <input
                  type="text"
                  value={transferCaseNotes}
                  onChange={(e) => setTransferCaseNotes(e.target.value)}
                  placeholder="Стан передачі проєктів, клієнтів, техпідтримки..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition font-medium"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-slate-700 cursor-pointer font-bold select-none text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition">
                  <input
                    type="checkbox"
                    checked={hasDocumentsReturned}
                    onChange={(e) => setHasDocumentsReturned(e.target.checked)}
                    className="rounded-sm border-slate-300 text-rose-600 focus:ring-rose-500 h-4 w-4 accent-rose-600"
                  />
                  <span>📁 Обхідний лист підписано (майно повернуто)</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Відгук співробітника (Exit Interview)
                </label>
                <textarea
                  value={exitNotes}
                  onChange={(e) => setExitNotes(e.target.value)}
                  placeholder="Зауваження, побажання, зворотний зв'язок від співробітника під час вихідної розмови..."
                  rows={3}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition font-medium resize-none"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                {editingFired && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    Скасувати
                  </button>
                )}
                <button
                  type="submit"
                  id="save-fired-submit"
                  className="flex-1 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  {editingFired ? 'Зберегти зміни' : 'Зафіксувати звільнення'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Dedicated Dismissal Case Dossier Modal (Особова справа звільненого) */}
      {viewingDossier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-left">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 text-white flex justify-between items-start shrink-0">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 bg-rose-500/30 text-rose-200 border border-rose-400/30 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                    Справа № {viewingDossier.id.substring(0, 8)} • Звільнений
                  </span>
                  {viewingDossier.hasDocumentsReturned && (
                    <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 rounded-full text-[10px] font-bold">
                      Обхідний лист підписано
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-black text-white">{viewingDossier.name}</h3>
                <p className="text-xs text-rose-200 font-medium">
                  {viewingDossier.position} • {viewingDossier.department}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {!isEditingDossierModal && onUpdateFiredEmployee && (
                  <button
                    type="button"
                    onClick={() => setIsEditingDossierModal(true)}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Редагувати справу</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition cursor-pointer"
                  title="Друкувати справу"
                >
                  <Printer className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setViewingDossier(null)}
                  className="p-2 text-rose-200 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">
              {isEditingDossierModal ? (
                /* Edit Mode inside Dossier Modal */
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-rose-50/50 p-3 rounded-2xl border border-rose-100 flex justify-between items-center">
                    <h4 className="font-bold text-rose-900 text-xs flex items-center space-x-1.5">
                      <Edit2 className="h-4 w-4 text-rose-700" />
                      <span>Редагування повної справи про звільнення</span>
                    </h4>
                    <span className="text-[10px] text-rose-700 font-semibold">Усі зміни зберігаються відразу в базі</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ПІБ Співробітника</label>
                      <input
                        type="text"
                        value={modalName}
                        onChange={(e) => setModalName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-600 focus:outline-hidden font-bold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Посада</label>
                      <input
                        type="text"
                        value={modalPosition}
                        onChange={(e) => setModalPosition(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-600 focus:outline-hidden font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Підрозділ / Департамент</label>
                      <input
                        type="text"
                        value={modalDepartment}
                        onChange={(e) => setModalDepartment(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-600 focus:outline-hidden font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Причина звільнення</label>
                      <select
                        value={reasonsList.includes(modalReason) ? modalReason : (modalReason ? 'Інше' : reasonsList[0] || 'Інше')}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== 'Інше') {
                            setModalReason(val);
                          } else {
                            if (reasonsList.includes(modalReason)) {
                              setModalReason('');
                            }
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-600 focus:outline-hidden font-bold text-rose-800"
                      >
                        {reasonsList.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                        {!reasonsList.includes('Інше') && <option value="Інше">Інше (власний варіант)...</option>}
                      </select>

                      {(!reasonsList.includes(modalReason) || modalReason === 'Інше') && (
                        <input
                          type="text"
                          value={modalReason === 'Інше' ? '' : modalReason}
                          onChange={(e) => setModalReason(e.target.value)}
                          placeholder="Вкажіть власну причину..."
                          className="w-full mt-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-600 focus:outline-hidden font-bold text-rose-800"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Телефон</label>
                      <input
                        type="tel"
                        value={modalPhone}
                        onChange={(e) => setModalPhone(e.target.value)}
                        placeholder="+380..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-600 focus:outline-hidden font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                      <input
                        type="email"
                        value={modalEmail}
                        onChange={(e) => setModalEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-600 focus:outline-hidden font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Дата прийняття на роботу</label>
                      <input
                        type="date"
                        value={modalStartDate}
                        onChange={(e) => setModalStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-600 focus:outline-hidden font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Дата звільнення</label>
                      <input
                        type="date"
                        value={modalEndDate}
                        onChange={(e) => setModalEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-600 focus:outline-hidden font-medium"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Передача справ & доступів</label>
                      <input
                        type="text"
                        value={modalTransferNotes}
                        onChange={(e) => setModalTransferNotes(e.target.value)}
                        placeholder="Передані проекти, клієнти, обладнання..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-600 focus:outline-hidden font-medium"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Нотатки вихідного інтерв'ю (Exit Interview)</label>
                      <textarea
                        value={modalExitNotes}
                        onChange={(e) => setModalExitNotes(e.target.value)}
                        rows={3}
                        placeholder="Відгук та фідбек про роботу в компанії..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-600 focus:outline-hidden resize-none font-medium text-slate-700"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="flex items-center space-x-2 text-slate-800 cursor-pointer font-bold select-none text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200 hover:bg-slate-100 transition">
                        <input
                          type="checkbox"
                          checked={modalDocsReturned}
                          onChange={(e) => setModalDocsReturned(e.target.checked)}
                          className="rounded-sm border-slate-300 text-rose-600 focus:ring-rose-500 h-4 w-4 accent-rose-600"
                        />
                        <span>📁 Обхідний лист підписано, майно та перепустку повернуто</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsEditingDossierModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                    >
                      Скасувати
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDossierModal}
                      className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl font-bold transition cursor-pointer shadow-xs"
                    >
                      Зберегти особову справу
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode inside Dossier Modal */
                <div className="space-y-5">
                  {/* Summary Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Термін роботи</span>
                      <span className="text-rose-800 font-extrabold text-sm block mt-0.5">{formatTenure(viewingDossier.startDate, viewingDossier.endDate, viewingDossier.tenureMonths)}</span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Дата прийняття</span>
                      <span className="text-slate-800 font-bold text-xs block mt-0.5">{formatDate(viewingDossier.startDate)}</span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Дата звільнення</span>
                      <span className="text-slate-800 font-bold text-xs block mt-0.5">{formatDate(viewingDossier.endDate)}</span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Причина</span>
                      <span className="text-rose-700 font-bold text-xs block mt-0.5 truncate" title={viewingDossier.reason}>{viewingDossier.reason}</span>
                    </div>
                  </div>

                  {/* Contact details */}
                  {(viewingDossier.phone || viewingDossier.email) && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                      <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Контактні дані</h5>
                      <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
                        {viewingDossier.phone && (
                          <div className="flex items-center space-x-2 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-bold text-slate-800 select-all">{viewingDossier.phone}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(viewingDossier.phone!)}
                              className="text-slate-400 hover:text-teal-700 p-1 cursor-pointer transition"
                              title="Скопіювати номер"
                            >
                              {copiedPhone ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        )}
                        {viewingDossier.email && (
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-slate-400" />
                            <span>{viewingDossier.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Transfer Case and Documents Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                      <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                        <ShieldCheck className="h-4 w-4 text-teal-700" />
                        <span>Обхідний лист & Майно</span>
                      </h5>
                      {viewingDossier.hasDocumentsReturned ? (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl font-bold flex items-center space-x-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                          <span>Обхідний лист підписано, усі матеріальні цінності повернуто компанії.</span>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl font-bold flex items-center space-x-2">
                          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                          <span>Обхідний лист в процесі або очікує підтвердження.</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                      <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                        <Briefcase className="h-4 w-4 text-rose-700" />
                        <span>Передача справ & проектів</span>
                      </h5>
                      {viewingDossier.transferCaseNotes ? (
                        <p className="font-medium text-slate-800 leading-relaxed bg-white p-3 rounded-xl border border-slate-200/80">
                          {viewingDossier.transferCaseNotes}
                        </p>
                      ) : (
                        <p className="text-slate-400 italic bg-white p-3 rounded-xl border border-slate-200/80">
                          Нотатки про передачу справ відсутні.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Exit Interview */}
                  <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 space-y-2">
                    <h5 className="font-bold text-rose-900 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                      <MessageSquare className="h-4 w-4 text-rose-700" />
                      <span>Зворотний зв'язок (Exit Interview)</span>
                    </h5>
                    {viewingDossier.exitNotes ? (
                      <p className="italic text-slate-800 leading-relaxed bg-white p-3.5 rounded-xl border border-rose-100">
                        "{viewingDossier.exitNotes}"
                      </p>
                    ) : (
                      <p className="text-slate-400 italic bg-white p-3.5 rounded-xl border border-rose-100">
                        Зауваження або фідбек під час вихідної розмови не зафіксовано.
                      </p>
                    )}
                  </div>

                  {/* Link to Candidate/Intern dossier if available */}
                  {onViewPersonalFile && getLinkedCandidate(viewingDossier) && (
                    <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100 flex items-center justify-between">
                      <div>
                        <h5 className="font-bold text-teal-900">Історія кандидата у системі</h5>
                        <p className="text-[11px] text-teal-700 mt-0.5">Доступна повна картка з співбесідами та стажуванням.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const cand = getLinkedCandidate(viewingDossier);
                          if (cand) {
                            setViewingDossier(null);
                            onViewPersonalFile(cand.id);
                          }
                        }}
                        className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs transition flex items-center space-x-1.5 cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Відкрити історію</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
              <span className="text-[10px] text-slate-400 font-medium">HR System Dossier Archive</span>
              <button
                type="button"
                onClick={() => setViewingDossier(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Закрити справу
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
