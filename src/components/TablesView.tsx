import React, { useState, useMemo } from 'react';
import { 
  Table as TableIcon, 
  Search, 
  Download, 
  ExternalLink, 
  RefreshCw, 
  Link as LinkIcon, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  UserCheck, 
  Briefcase, 
  Calendar, 
  GraduationCap, 
  UserX, 
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Trash2,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { HRSystemData, Candidate, Vacancy, Interview, Intern, FiredEmployee } from '../types';

interface TablesViewProps {
  data: HRSystemData;
  spreadsheetUrl: string | null;
  spreadsheetId: string | null;
  accessToken: string | null;
  syncStatus: 'synced' | 'saving' | 'offline' | 'error';
  onForceSync: () => Promise<void> | void;
  onOpenCustomSheetModal: () => void;
  onViewCandidateFile: (candidate: Candidate) => void;
  onViewPersonalFile?: (candidateId: string) => void;
  onDeleteIntern?: (internId: string) => void;
}

type TableTab = 'candidates' | 'vacancies' | 'interviews' | 'interns' | 'fired';

export const TablesView: React.FC<TablesViewProps> = ({
  data,
  spreadsheetUrl,
  spreadsheetId,
  accessToken,
  syncStatus,
  onForceSync,
  onOpenCustomSheetModal,
  onViewCandidateFile,
  onViewPersonalFile,
  onDeleteIntern
}) => {
  const [activeTab, setActiveTab] = useState<TableTab>('candidates');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [confirmDeleteInternId, setConfirmDeleteInternId] = useState<string | null>(null);

  // Helper mapping vacancy IDs to titles
  const vacancyMap = useMemo(() => {
    const map = new Map<string, Vacancy>();
    (data.vacancies || []).forEach(v => map.set(v.id, v));
    return map;
  }, [data.vacancies]);

  // Handle sorting toggles
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Sync handler
  const handleSyncClick = async () => {
    setIsSyncing(true);
    try {
      await onForceSync();
    } finally {
      setIsSyncing(false);
    }
  };

  // 1. Filter and sort Candidates
  const filteredCandidates = useMemo(() => {
    const list = data.candidates || [];
    return list.filter(c => {
      const v = vacancyMap.get(c.vacancyId);
      const pos = v ? v.title : '';
      const dept = v ? v.department : '';
      const matchesSearch = !searchQuery.trim() || 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        (c.source && c.source.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.sourceDetails && c.sourceDetails.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.comment && c.comment.toLowerCase().includes(searchQuery.toLowerCase())) ||
        pos.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dept.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesDept = departmentFilter === 'all' || dept === departmentFilter;

      return matchesSearch && matchesStatus && matchesDept;
    }).sort((a, b) => {
      if (!sortField) {
        const dateA = a.contactDate || a.appliedAt || '';
        const dateB = b.contactDate || b.appliedAt || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
        return numB - numA;
      }
      let valA: any = (a as any)[sortField] ?? '';
      let valB: any = (b as any)[sortField] ?? '';
      if (sortField === 'position') {
        valA = vacancyMap.get(a.vacancyId)?.title || '';
        valB = vacancyMap.get(b.vacancyId)?.title || '';
      } else if (sortField === 'department') {
        valA = vacancyMap.get(a.vacancyId)?.department || '';
        valB = vacancyMap.get(b.vacancyId)?.department || '';
      }
      if (typeof valA === 'string') {
        const res = valA.localeCompare(valB, 'uk');
        return sortAsc ? res : -res;
      }
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
  }, [data.candidates, searchQuery, statusFilter, departmentFilter, sortField, sortAsc, vacancyMap]);

  // 2. Filter and sort Vacancies
  const filteredVacancies = useMemo(() => {
    const list = data.vacancies || [];
    return list.filter(v => {
      const matchesSearch = !searchQuery.trim() ||
        v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.salary && v.salary.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.schedule && v.schedule.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchesDept = departmentFilter === 'all' || v.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesDept;
    }).sort((a, b) => {
      if (!sortField) return 0;
      const valA = (a as any)[sortField] ?? '';
      const valB = (b as any)[sortField] ?? '';
      if (typeof valA === 'string') {
        const res = valA.localeCompare(valB, 'uk');
        return sortAsc ? res : -res;
      }
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
  }, [data.vacancies, searchQuery, statusFilter, departmentFilter, sortField, sortAsc]);

  // 3. Filter and sort Interviews
  const filteredInterviews = useMemo(() => {
    const list = data.interviews || [];
    return list.filter(i => {
      const cand = (data.candidates || []).find(c => c.id === i.candidateId);
      const pos = cand ? (vacancyMap.get(cand.vacancyId)?.title || '') : '';
      const matchesSearch = !searchQuery.trim() ||
        i.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.interviewer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.feedback && i.feedback.toLowerCase().includes(searchQuery.toLowerCase())) ||
        pos.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      if (!sortField) return 0;
      const valA = (a as any)[sortField] ?? '';
      const valB = (b as any)[sortField] ?? '';
      if (typeof valA === 'string') {
        const res = valA.localeCompare(valB, 'uk');
        return sortAsc ? res : -res;
      }
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
  }, [data.interviews, data.candidates, vacancyMap, searchQuery, statusFilter, sortField, sortAsc]);

  // 4. Filter and sort Interns
  const filteredInterns = useMemo(() => {
    const list = data.interns || [];
    return list.filter(inRecord => {
      const matchesSearch = !searchQuery.trim() ||
        inRecord.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inRecord.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inRecord.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inRecord.mentor.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || inRecord.status === statusFilter;
      const matchesDept = departmentFilter === 'all' || inRecord.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesDept;
    }).sort((a, b) => {
      if (!sortField) return 0;
      const valA = (a as any)[sortField] ?? '';
      const valB = (b as any)[sortField] ?? '';
      if (typeof valA === 'string') {
        const res = valA.localeCompare(valB, 'uk');
        return sortAsc ? res : -res;
      }
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
  }, [data.interns, searchQuery, statusFilter, departmentFilter, sortField, sortAsc]);

  // 5. Filter and sort Fired
  const filteredFired = useMemo(() => {
    const list = data.firedEmployees || [];
    return list.filter(f => {
      const matchesSearch = !searchQuery.trim() ||
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.exitNotes && f.exitNotes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDept = departmentFilter === 'all' || f.department === departmentFilter;
      return matchesSearch && matchesDept;
    }).sort((a, b) => {
      if (!sortField) return 0;
      const valA = (a as any)[sortField] ?? '';
      const valB = (b as any)[sortField] ?? '';
      if (typeof valA === 'string') {
        const res = valA.localeCompare(valB, 'uk');
        return sortAsc ? res : -res;
      }
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
  }, [data.firedEmployees, searchQuery, departmentFilter, sortField, sortAsc]);

  // Current records list and pagination
  const currentRecords = useMemo(() => {
    switch (activeTab) {
      case 'candidates': return filteredCandidates;
      case 'vacancies': return filteredVacancies;
      case 'interviews': return filteredInterviews;
      case 'interns': return filteredInterns;
      case 'fired': return filteredFired;
    }
  }, [activeTab, filteredCandidates, filteredVacancies, filteredInterviews, filteredInterns, filteredFired]);

  const totalPages = Math.ceil(currentRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return currentRecords.slice(start, start + pageSize);
  }, [currentRecords, currentPage, pageSize]);

  // Reset page when tab/filters change
  const handleTabChange = (tab: TableTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setStatusFilter('all');
    setDepartmentFilter('all');
    setSortField('');
  };

  // Export current table to Excel (.xlsx)
  const exportCurrentTableToExcel = () => {
    const wb = XLSX.utils.book_new();

    if (activeTab === 'candidates') {
      const rows = filteredCandidates.map((c, idx) => {
        const v = vacancyMap.get(c.vacancyId);
        return {
          '№': idx + 1,
          'ПІБ': c.name,
          'Телефон': c.phone,
          'Посада': v?.title || '',
          'Підрозділ': v?.department || '',
          'Статус': c.status,
          'Дата контакту': c.contactDate || '',
          'Дата народження': c.birthDate || '',
          'Тип дзвінка': c.callType || '',
          'Джерело': c.source ? (c.sourceDetails ? `${c.source} (${c.sourceDetails})` : c.source) : '',
          'Уточнення джерела': c.sourceDetails || '',
          'Оцінка': c.rating || '',
          'Коментар': c.comment || '',
          'Причина відхилення': c.rejectionReason || ''
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Кандидати');
      XLSX.writeFile(wb, `HR_Кандидати_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'vacancies') {
      const rows = filteredVacancies.map((v, idx) => ({
        '№': idx + 1,
        'Посада': v.title,
        'Підрозділ': v.department,
        'Статус': v.status,
        'Зарплата': v.salary || '',
        'Графік': v.schedule || '',
        'Пріоритет': v.priority || '',
        'Дата відкриття': v.createdAt || '',
        'Дата закриття': v.closeDate || '',
        'Вимоги': v.requirements || '',
        'Обов\'язки': v.duties || ''
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Вакансії');
      XLSX.writeFile(wb, `HR_Вакансії_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'interviews') {
      const rows = filteredInterviews.map((i, idx) => ({
        '№': idx + 1,
        'Кандидат': i.candidateName,
        'Дата та час': i.dateTime,
        'Інтерв\'юер': i.interviewer,
        'Статус': i.status,
        'Результат': i.result,
        'Оцінка': i.rating,
        'Фідбек / Коментар': i.feedback || '',
        'Керівник': i.managerName || '',
        'Дата з керівником': i.managerInterviewDate || '',
        'Коментар керівника': i.managerFeedback || ''
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Співбесіди');
      XLSX.writeFile(wb, `HR_Співбесіди_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'interns') {
      const rows = filteredInterns.map((inRec, idx) => ({
        '№': idx + 1,
        'Стажер': inRec.candidateName,
        'Посада': inRec.position,
        'Підрозділ': inRec.department,
        'Телефон': inRec.phone || '',
        'Статус': inRec.status,
        'Прогрес %': inRec.progress,
        'Початок': inRec.startDate,
        'Кінець': inRec.endDate,
        'Наставник (ментор)': inRec.mentor,
        'Проєкт': inRec.project || '',
        'Оцінка': inRec.rating,
        'Коментар': inRec.comment || ''
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Стажери');
      XLSX.writeFile(wb, `HR_Стажери_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'fired') {
      const rows = filteredFired.map((f, idx) => ({
        '№': idx + 1,
        'ПІБ': f.name,
        'Посада': f.position,
        'Підрозділ': f.department,
        'Телефон': f.phone || '',
        'Дата прийняття': f.startDate,
        'Дата звільнення': f.endDate,
        'Стаж (міс.)': f.tenureMonths,
        'Причина звільнення': f.reason,
        'Вихідні примітки': f.exitNotes || '',
        'Передача справ': f.transferCaseNotes || ''
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Звільнені');
      XLSX.writeFile(wb, `HR_Звільнені_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  // Export ALL tables to a single multi-sheet Excel workbook
  const exportAllToExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Вакансії
    const vacRows = (data.vacancies || []).map((v, idx) => ({
      '№': idx + 1,
      'Посада': v.title,
      'Підрозділ': v.department,
      'Статус': v.status,
      'Зарплата': v.salary || '',
      'Графік': v.schedule || '',
      'Пріоритет': v.priority || '',
      'Дата відкриття': v.createdAt || '',
      'Дата закриття': v.closeDate || '',
      'Вимоги': v.requirements || '',
      'Обов\'язки': v.duties || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vacRows), 'Вакансії');

    // 2. Кандидати
    const candRows = (data.candidates || []).map((c, idx) => {
      const v = vacancyMap.get(c.vacancyId);
      return {
        '№': idx + 1,
        'ПІБ': c.name,
        'Телефон': c.phone,
        'Посада': v?.title || '',
        'Підрозділ': v?.department || '',
        'Статус': c.status,
        'Дата контакту': c.contactDate || '',
        'Дата народження': c.birthDate || '',
        'Тип дзвінка': c.callType || '',
        'Джерело': c.source ? (c.sourceDetails ? `${c.source} (${c.sourceDetails})` : c.source) : '',
        'Уточнення джерела': c.sourceDetails || '',
        'Оцінка': c.rating || '',
        'Коментар': c.comment || '',
        'Причина відхилення': c.rejectionReason || ''
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(candRows), 'Кандидати');

    // 3. Співбесіди
    const intRows = (data.interviews || []).map((i, idx) => ({
      '№': idx + 1,
      'Кандидат': i.candidateName,
      'Дата та час': i.dateTime,
      'Інтерв\'юер': i.interviewer,
      'Статус': i.status,
      'Результат': i.result,
      'Оцінка': i.rating,
      'Фідбек': i.feedback || '',
      'Керівник': i.managerName || '',
      'Коментар керівника': i.managerFeedback || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(intRows), 'Співбесіди');

    // 4. Стажери
    const inRows = (data.interns || []).map((inRec, idx) => ({
      '№': idx + 1,
      'Стажер': inRec.candidateName,
      'Посада': inRec.position,
      'Підрозділ': inRec.department,
      'Телефон': inRec.phone || '',
      'Статус': inRec.status,
      'Прогрес %': inRec.progress,
      'Початок': inRec.startDate,
      'Кінець': inRec.endDate,
      'Наставник': inRec.mentor,
      'Проєкт': inRec.project || '',
      'Оцінка': inRec.rating,
      'Коментар': inRec.comment || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inRows), 'Стажери');

    // 5. Звільнені
    const firedRows = (data.firedEmployees || []).map((f, idx) => ({
      '№': idx + 1,
      'ПІБ': f.name,
      'Посада': f.position,
      'Підрозділ': f.department,
      'Телефон': f.phone || '',
      'Дата прийняття': f.startDate,
      'Дата звільнення': f.endDate,
      'Стаж (міс.)': f.tenureMonths,
      'Причина': f.reason,
      'Примітки': f.exitNotes || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(firedRows), 'Звільнені');

    XLSX.writeFile(wb, `HR_База_Даних_Повна_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Sort indicator helper
  const renderSortIndicator = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-slate-300 ml-1 inline-block" />;
    }
    return sortAsc 
      ? <ArrowUp className="h-3 w-3 text-teal-600 ml-1 inline-block" /> 
      : <ArrowDown className="h-3 w-3 text-teal-600 ml-1 inline-block" />;
  };

  return (
    <div className="space-y-5 animate-fade-in text-left">
      {/* Top Banner: Google Sheets Integration Status & Actions */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100/80 shrink-0">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900">Таблиці бази даних</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-800 border border-emerald-200/60">
                Google Sheets & Excel
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Повний табличний перегляд реєстрів HR-системи. Ви можете шукати, сортувати дані, переходити безпосередньо у Google Sheets або експортувати таблиці у форматі Excel (.xlsx).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-end">
          {spreadsheetUrl ? (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Відкрити в Google Sheets</span>
            </a>
          ) : (
            <button
              onClick={onOpenCustomSheetModal}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              <span>Підключити Google Sheets</span>
            </button>
          )}

          <button
            onClick={handleSyncClick}
            disabled={isSyncing}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Синхронізувати з хмарою"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-teal-600' : ''}`} />
            <span>{isSyncing ? 'Синхронізація...' : 'Оновити'}</span>
          </button>

          <button
            onClick={exportCurrentTableToExcel}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Завантажити активну таблицю у форматі .xlsx"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Експорт (.xlsx)</span>
          </button>

          <button
            onClick={exportAllToExcel}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Завантажити всі 5 реєстрів в один файл Excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600" />
            <span>Вся база (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => handleTabChange('candidates')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'candidates' 
              ? 'bg-teal-700 text-white shadow-2xs' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <UserCheck className="h-3.5 w-3.5" />
          <span>Кандидати</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === 'candidates' ? 'bg-teal-800 text-teal-100' : 'bg-slate-200/80 text-slate-700'}`}>
            {data.candidates?.length || 0}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('vacancies')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'vacancies' 
              ? 'bg-teal-700 text-white shadow-2xs' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Briefcase className="h-3.5 w-3.5" />
          <span>Вакансії</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === 'vacancies' ? 'bg-teal-800 text-teal-100' : 'bg-slate-200/80 text-slate-700'}`}>
            {data.vacancies?.length || 0}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('interviews')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'interviews' 
              ? 'bg-teal-700 text-white shadow-2xs' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Співбесіди</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === 'interviews' ? 'bg-teal-800 text-teal-100' : 'bg-slate-200/80 text-slate-700'}`}>
            {data.interviews?.length || 0}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('interns')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'interns' 
              ? 'bg-teal-700 text-white shadow-2xs' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5" />
          <span>Стажери</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === 'interns' ? 'bg-teal-800 text-teal-100' : 'bg-slate-200/80 text-slate-700'}`}>
            {data.interns?.length || 0}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('fired')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'fired' 
              ? 'bg-teal-700 text-white shadow-2xs' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <UserX className="h-3.5 w-3.5" />
          <span>Звільнені</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === 'fired' ? 'bg-teal-800 text-teal-100' : 'bg-slate-200/80 text-slate-700'}`}>
            {data.firedEmployees?.length || 0}
          </span>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Пошук у таблиці..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9.5 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Status Filter for Candidates */}
          {activeTab === 'candidates' && (
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
            >
              <option value="all">Усі статуси</option>
              {(data.stagesList && data.stagesList.length > 0 ? data.stagesList : [
                'Новий', 'Повідомлення', 'Співбесіда', 'Співбесіда з керівником', 'Стажування', 'Працевлаштовано', 'Подумає', 'Резерв', 'Відмова кандидата', 'Відмова компанії'
              ]).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          {/* Status Filter for Vacancies */}
          {activeTab === 'vacancies' && (
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
            >
              <option value="all">Усі статуси</option>
              <option value="Активна">Активна</option>
              <option value="Закрита">Закрита</option>
            </select>
          )}

          {/* Status Filter for Interns */}
          {activeTab === 'interns' && (
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
            >
              <option value="all">Усі статуси</option>
              <option value="Триває">Триває</option>
              <option value="Успішно завершено">Успішно завершено</option>
              <option value="Не пройшов">Не пройшов</option>
              <option value="Відмовився">Відмовився</option>
            </select>
          )}

          {/* Page size selector */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500">
            <span>Показувати по:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-600 cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </select>
          </div>

          <span className="text-xs font-semibold text-slate-400 pl-2">
            Знайдено: <strong className="text-slate-700">{currentRecords.length}</strong>
          </span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[640px]">
          {/* 1. CANDIDATES TABLE */}
          {activeTab === 'candidates' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">№</th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('name')}>
                    ПІБ кандидата {renderSortIndicator('name')}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('position')}>
                    Посада {renderSortIndicator('position')}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('department')}>
                    Підрозділ {renderSortIndicator('department')}
                  </th>
                  <th className="py-3 px-3">Телефон</th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('status')}>
                    Етап / Статус {renderSortIndicator('status')}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('contactDate')}>
                    Дата контакту {renderSortIndicator('contactDate')}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('source')}>
                    Джерело {renderSortIndicator('source')}
                  </th>
                  <th className="py-3 px-3">Коментар</th>
                  <th className="py-3 px-3 text-center w-24">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      Кандидатів не знайдено
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((item: any, idx) => {
                    const c = item as Candidate;
                    const v = vacancyMap.get(c.vacancyId);
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={c.id} className="hover:bg-teal-50/30 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{rowNumber}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <button
                            onClick={() => onViewCandidateFile(c)}
                            className="hover:text-teal-700 hover:underline cursor-pointer text-left font-bold"
                          >
                            {c.name}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">{v?.title || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{v?.department || '—'}</td>
                        <td className="py-2.5 px-3">
                          {c.phone ? (
                            <a href={`tel:${c.phone}`} className="text-teal-700 hover:underline font-medium">
                              {c.phone}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'Працевлаштовано' ? 'bg-emerald-100 text-emerald-800' :
                            c.status === 'Стажування' ? 'bg-purple-100 text-purple-800' :
                            c.status === 'Співбесіда' || c.status === 'Співбесіда з керівником' ? 'bg-blue-100 text-blue-800' :
                            c.status === 'Відмова кандидата' ? 'bg-amber-100 text-amber-900' :
                            (c.status === 'Відмова компанії' || c.status === 'Відхилено') ? 'bg-rose-100 text-rose-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{c.contactDate || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-600">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{c.source || '—'}</span>
                            {c.sourceDetails && (
                              <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded px-1.5 py-0.5 font-bold whitespace-nowrap" title={`Уточнення джерела: ${c.sourceDetails}`}>
                                📌 {c.sourceDetails}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={c.comment}>
                          {c.comment || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => onViewCandidateFile(c)}
                            className="px-2.5 py-1 text-[11px] font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition cursor-pointer whitespace-nowrap"
                          >
                            Особова справа
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* 2. VACANCIES TABLE */}
          {activeTab === 'vacancies' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">№</th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('title')}>
                    Посада {renderSortIndicator('title')}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('department')}>
                    Підрозділ {renderSortIndicator('department')}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('status')}>
                    Статус {renderSortIndicator('status')}
                  </th>
                  <th className="py-3 px-3">Зарплата</th>
                  <th className="py-3 px-3">Графік</th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('createdAt')}>
                    Дата відкриття {renderSortIndicator('createdAt')}
                  </th>
                  <th className="py-3 px-3">Пріоритет</th>
                  <th className="py-3 px-3">Вимоги / Обов'язки</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Вакансій не знайдено
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((item: any, idx) => {
                    const v = item as Vacancy;
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={v.id} className="hover:bg-teal-50/30 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{rowNumber}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{v.title}</td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">{v.department}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            v.status === 'Активна' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{v.salary || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{v.schedule || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{v.createdAt || '—'}</td>
                        <td className="py-2.5 px-3">
                          {v.priority ? (
                            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                              {v.priority}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-sm truncate" title={`${v.requirements || ''} ${v.duties || ''}`}>
                          {v.requirements || v.duties || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* 3. INTERVIEWS TABLE */}
          {activeTab === 'interviews' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">№</th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('candidateName')}>
                    Кандидат {renderSortIndicator('candidateName')}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('dateTime')}>
                    Дата та час {renderSortIndicator('dateTime')}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('interviewer')}>
                    Інтерв'юер {renderSortIndicator('interviewer')}
                  </th>
                  <th className="py-3 px-3">Статус</th>
                  <th className="py-3 px-3">Результат</th>
                  <th className="py-3 px-3 text-center">Оцінка</th>
                  <th className="py-3 px-3">Керівник</th>
                  <th className="py-3 px-3">Фідбек</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Співбесід не знайдено
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((item: any, idx) => {
                    const i = item as Interview;
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={i.id} className="hover:bg-teal-50/30 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{rowNumber}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{i.candidateName}</td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{i.dateTime || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">{i.interviewer || '—'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            i.status === 'Завершено' ? 'bg-emerald-100 text-emerald-800' :
                            i.status === 'Заплановано' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {i.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{i.result || '—'}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-amber-600">{i.rating ? `${i.rating}★` : '—'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{i.managerName || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={i.feedback}>
                          {i.feedback || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* 4. INTERNS TABLE */}
          {activeTab === 'interns' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">№</th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('candidateName')}>
                    Стажер {renderSortIndicator('candidateName')}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('position')}>
                    Посада {renderSortIndicator('position')}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('department')}>
                    Підрозділ {renderSortIndicator('department')}
                  </th>
                  <th className="py-3 px-3">Телефон</th>
                  <th className="py-3 px-3">Статус</th>
                  <th className="py-3 px-3">Період</th>
                  <th className="py-3 px-3">Наставник</th>
                  <th className="py-3 px-3 text-right">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Стажерів не знайдено
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((item: any, idx) => {
                    const inRec = item as Intern;
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={inRec.id} className="hover:bg-teal-50/30 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{rowNumber}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{inRec.candidateName}</td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">{inRec.position}</td>
                        <td className="py-2.5 px-3 text-slate-500">{inRec.department}</td>
                        <td className="py-2.5 px-3 text-teal-700">{inRec.phone || '—'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inRec.status === 'Успішно завершено' ? 'bg-emerald-100 text-emerald-800' :
                            inRec.status === 'Триває' ? 'bg-purple-100 text-purple-800' :
                            inRec.status === 'Відмовився' ? 'bg-amber-100 text-amber-900' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {inRec.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {inRec.startDate} — {inRec.endDate}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{inRec.mentor || '—'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {onViewPersonalFile && (
                              <button
                                type="button"
                                onClick={() => onViewPersonalFile(inRec.candidateId || inRec.id)}
                                className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition cursor-pointer"
                                title="Відкрити особову справу"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {onDeleteIntern && (
                              confirmDeleteInternId === inRec.id ? (
                                <div className="flex items-center space-x-1 bg-rose-50 border border-rose-200 rounded-lg px-2 py-0.5 text-[10px] font-bold text-rose-700 animate-fade-in">
                                  <span>Видалити?</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteIntern(inRec.id);
                                      setConfirmDeleteInternId(null);
                                    }}
                                    className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded transition cursor-pointer"
                                  >
                                    Так
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteInternId(null)}
                                    className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition cursor-pointer"
                                  >
                                    Ні
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteInternId(inRec.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Видалити стажера"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* 5. FIRED TABLE */}
          {activeTab === 'fired' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">№</th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('name')}>
                    ПІБ працівника {renderSortIndicator('name')}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('position')}>
                    Посада {renderSortIndicator('position')}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('department')}>
                    Підрозділ {renderSortIndicator('department')}
                  </th>
                  <th className="py-3 px-3">Дата звільнення</th>
                  <th className="py-3 px-3">Стаж</th>
                  <th className="py-3 px-3">Причина звільнення</th>
                  <th className="py-3 px-3">Примітки</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Записів про звільнених не знайдено
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((item: any, idx) => {
                    const f = item as FiredEmployee;
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={f.id} className="hover:bg-teal-50/30 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{rowNumber}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{f.name}</td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">{f.position}</td>
                        <td className="py-2.5 px-3 text-slate-500">{f.department}</td>
                        <td className="py-2.5 px-3 text-rose-700 font-medium whitespace-nowrap">{f.endDate}</td>
                        <td className="py-2.5 px-3 text-slate-600">{f.tenureMonths} міс.</td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium">{f.reason}</td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={f.exitNotes}>
                          {f.exitNotes || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Сторінка <strong className="text-slate-800">{currentPage}</strong> з <strong className="text-slate-800">{totalPages}</strong>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Попередня
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Наступна
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
