import React, { useState, useMemo, useRef } from 'react';
import { HRSystemData } from '../types';
import { 
  Settings, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  Briefcase, 
  Building2, 
  Layers,
  Compass,
  Clock,
  FileCheck,
  Award,
  UserX,
  AlertTriangle,
  Search,
  CheckCircle2,
  ListPlus
} from 'lucide-react';

interface DirectoriesManagerProps {
  positions: string[];
  departments: string[];
  stages: string[];
  sources: string[];
  interviewStatuses: string[];
  interviewResults: string[];
  internStatuses: string[];
  firedReasons?: string[];
  onAddPosition: (name: string) => void;
  onRenamePosition: (oldName: string, newName: string) => void;
  onDeletePosition: (name: string) => void;
  onAddDepartment: (name: string) => void;
  onRenameDepartment: (oldName: string, newName: string) => void;
  onDeleteDepartment: (name: string) => void;
  onAddStage: (name: string) => void;
  onRenameStage: (oldName: string, newName: string) => void;
  onDeleteStage: (name: string) => void;
  onAddSource: (name: string) => void;
  onRenameSource: (oldName: string, newName: string) => void;
  onDeleteSource: (name: string) => void;
  onAddInterviewStatus: (name: string) => void;
  onRenameInterviewStatus: (oldName: string, newName: string) => void;
  onDeleteInterviewStatus: (name: string) => void;
  onAddInterviewResult: (name: string) => void;
  onRenameInterviewResult: (oldName: string, newName: string) => void;
  onDeleteInterviewResult: (name: string) => void;
  onAddInternStatus: (name: string) => void;
  onRenameInternStatus: (oldName: string, newName: string) => void;
  onDeleteInternStatus: (name: string) => void;
  onAddFiredReason?: (name: string) => void;
  onRenameFiredReason?: (oldName: string, newName: string) => void;
  onDeleteFiredReason?: (name: string) => void;
  data: HRSystemData;
}

type DirectoryCategory = 'positions' | 'departments' | 'stages' | 'sources' | 'interviewStatuses' | 'interviewResults' | 'internStatuses' | 'firedReasons';

export default function DirectoriesManager({
  positions,
  departments,
  stages,
  sources,
  interviewStatuses,
  interviewResults,
  internStatuses,
  firedReasons = [],
  onAddPosition,
  onRenamePosition,
  onDeletePosition,
  onAddDepartment,
  onRenameDepartment,
  onDeleteDepartment,
  onAddStage,
  onRenameStage,
  onDeleteStage,
  onAddSource,
  onRenameSource,
  onDeleteSource,
  onAddInterviewStatus,
  onRenameInterviewStatus,
  onDeleteInterviewStatus,
  onAddInterviewResult,
  onRenameInterviewResult,
  onDeleteInterviewResult,
  onAddInternStatus,
  onRenameInternStatus,
  onDeleteInternStatus,
  onAddFiredReason,
  onRenameFiredReason,
  onDeleteFiredReason,
  data
}: DirectoriesManagerProps) {
  const [activeCategory, setActiveCategory] = useState<DirectoryCategory>('positions');
  const [searchQuery, setSearchQuery] = useState('');
  const [newValue, setNewValue] = useState('');

  // Editing and Delete Confirmation states
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<string | null>(null);

  // Feedback notifications
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Batch Add Modal state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchInput, setBatchInput] = useState('');

  const showNotification = (msg: string) => {
    setFeedbackMsg(msg);
    setErrorMsg(null);
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  const categories = [
    { id: 'positions', label: 'Посади', icon: Briefcase, count: positions.length },
    { id: 'departments', label: 'Підрозділи', icon: Building2, count: departments.length },
    { id: 'stages', label: 'Етапи підбору', icon: Layers, count: stages.length },
    { id: 'sources', label: 'Джерела кандидата', icon: Compass, count: sources.length },
    { id: 'interviewStatuses', label: 'Статуси співбесід', icon: Clock, count: interviewStatuses.length },
    { id: 'interviewResults', label: 'Результати співбесід', icon: FileCheck, count: interviewResults.length },
    { id: 'internStatuses', label: 'Статуси стажування', icon: Award, count: internStatuses.length },
    { id: 'firedReasons', label: 'Причини звільнення', icon: UserX, count: firedReasons.length },
  ] as const;

  const activeList = useMemo(() => {
    switch (activeCategory) {
      case 'positions': return positions;
      case 'departments': return departments;
      case 'stages': return stages;
      case 'sources': return sources;
      case 'interviewStatuses': return interviewStatuses;
      case 'interviewResults': return interviewResults;
      case 'internStatuses': return internStatuses;
      case 'firedReasons': return firedReasons;
      default: return [];
    }
  }, [activeCategory, positions, departments, stages, sources, interviewStatuses, interviewResults, internStatuses, firedReasons]);

  const filteredItems = useMemo(() => {
    return activeList
      .filter(item => item.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'uk'));
  }, [activeList, searchQuery]);

  // Usage checker to warn before deletion/rename
  const getItemUsage = (name: string) => {
    switch (activeCategory) {
      case 'positions': {
        const vacancies = data.vacancies.filter(v => v.title === name).length;
        const interns = data.interns.filter(i => i.position === name).length;
        return {
          total: vacancies + interns,
          text: `Використовується: у вакансіях (${vacancies}), стажерах (${interns})`
        };
      }
      case 'departments': {
        const vacancies = data.vacancies.filter(v => v.department === name).length;
        const interns = data.interns.filter(i => i.department === name).length;
        return {
          total: vacancies + interns,
          text: `Використовується: у вакансіях (${vacancies}), стажерах (${interns})`
        };
      }
      case 'stages': {
        const candidates = data.candidates.filter(c => c.status === name).length;
        return {
          total: candidates,
          text: `Використовується у кандидатів (${candidates})`
        };
      }
      case 'sources': {
        const candidates = data.candidates.filter(c => c.source === name).length;
        return {
          total: candidates,
          text: `Використовується у кандидатів (${candidates})`
        };
      }
      case 'interviewStatuses': {
        const interviews = data.interviews.filter(i => i.status === name).length;
        return {
          total: interviews,
          text: `Використовується у співбесідах (${interviews})`
        };
      }
      case 'interviewResults': {
        const interviews = data.interviews.filter(i => i.result === name).length;
        return {
          total: interviews,
          text: `Використовується у співбесідах (${interviews})`
        };
      }
      case 'internStatuses': {
        const interns = data.interns.filter(i => i.status === name).length;
        return {
          total: interns,
          text: `Використовується у стажерів (${interns})`
        };
      }
      case 'firedReasons': {
        const count = data.firedEmployees.filter(f => f.reason === name).length;
        return {
          total: count,
          text: `Використовується у звільнених (${count})`
        };
      }
      default: return { total: 0, text: '' };
    }
  };

  // Dispatch Handlers
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newValue.trim();
    if (!clean) {
      setErrorMsg(`Будь ласка, введіть назву для додавання у довідник «${categories.find(c => c.id === activeCategory)?.label}»`);
      if (inputRef.current) {
        inputRef.current.focus();
      }
      return;
    }

    // Check duplicate
    if (activeList.some(item => item.trim().toLowerCase() === clean.toLowerCase())) {
      setErrorMsg(`Пункт «${clean}» вже існує в довіднику «${categories.find(c => c.id === activeCategory)?.label}»!`);
      if (inputRef.current) {
        inputRef.current.focus();
      }
      return;
    }

    setErrorMsg(null);

    switch (activeCategory) {
      case 'positions': onAddPosition(clean); break;
      case 'departments': onAddDepartment(clean); break;
      case 'stages': onAddStage(clean); break;
      case 'sources': onAddSource(clean); break;
      case 'interviewStatuses': onAddInterviewStatus(clean); break;
      case 'interviewResults': onAddInterviewResult(clean); break;
      case 'internStatuses': onAddInternStatus(clean); break;
      case 'firedReasons': onAddFiredReason?.(clean); break;
    }
    setNewValue('');
    showNotification(`Пункт «${clean}» успішно додано та збережено!`);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleBatchAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchInput.trim()) return;

    // Split by newlines or commas
    const rawItems = batchInput
      .split(/[\n,]+/)
      .map(i => i.trim())
      .filter(Boolean);

    if (rawItems.length === 0) return;

    let addedCount = 0;
    const currentCategoryLabel = categories.find(c => c.id === activeCategory)?.label || '';

    rawItems.forEach(clean => {
      const isDuplicate = activeList.some(item => item.trim().toLowerCase() === clean.toLowerCase());
      if (!isDuplicate) {
        switch (activeCategory) {
          case 'positions': onAddPosition(clean); break;
          case 'departments': onAddDepartment(clean); break;
          case 'stages': onAddStage(clean); break;
          case 'sources': onAddSource(clean); break;
          case 'interviewStatuses': onAddInterviewStatus(clean); break;
          case 'interviewResults': onAddInterviewResult(clean); break;
          case 'internStatuses': onAddInternStatus(clean); break;
          case 'firedReasons': onAddFiredReason?.(clean); break;
        }
        addedCount++;
      }
    });

    setBatchInput('');
    setShowBatchModal(false);

    if (addedCount > 0) {
      showNotification(`Додано пунктів: ${addedCount} у розділ «${currentCategoryLabel}».`);
    } else {
      setErrorMsg('Усі введені пункти вже існують у довіднику.');
    }
  };

  const handleRenameItem = (oldVal: string, newVal: string) => {
    const clean = newVal.trim();
    if (!clean || clean === oldVal) return;

    if (activeList.some(item => item !== oldVal && item.trim().toLowerCase() === clean.toLowerCase())) {
      setErrorMsg(`Пункт «${clean}» вже існує в довіднику!`);
      return;
    }

    setErrorMsg(null);

    switch (activeCategory) {
      case 'positions': onRenamePosition(oldVal, clean); break;
      case 'departments': onRenameDepartment(oldVal, clean); break;
      case 'stages': onRenameStage(oldVal, clean); break;
      case 'sources': onRenameSource(oldVal, clean); break;
      case 'interviewStatuses': onRenameInterviewStatus(oldVal, clean); break;
      case 'interviewResults': onRenameInterviewResult(oldVal, clean); break;
      case 'internStatuses': onRenameInternStatus(oldVal, clean); break;
      case 'firedReasons': onRenameFiredReason?.(oldVal, clean); break;
    }
    showNotification(`Назву змінено з «${oldVal}» на «${clean}»`);
  };

  const handleDeleteItem = (val: string) => {
    switch (activeCategory) {
      case 'positions': onDeletePosition(val); break;
      case 'departments': onDeleteDepartment(val); break;
      case 'stages': onDeleteStage(val); break;
      case 'sources': onDeleteSource(val); break;
      case 'interviewStatuses': onDeleteInterviewStatus(val); break;
      case 'interviewResults': onDeleteInterviewResult(val); break;
      case 'internStatuses': onDeleteInternStatus(val); break;
      case 'firedReasons': onDeleteFiredReason?.(val); break;
    }
    showNotification(`Пункт «${val}» успішно видалено`);
  };

  const startEdit = (item: string) => {
    setEditingItem(item);
    setEditingValue(item);
    setErrorMsg(null);
  };

  const saveEdit = () => {
    if (editingItem) {
      handleRenameItem(editingItem, editingValue);
    }
    setEditingItem(null);
  };

  const ActiveIcon = categories.find(c => c.id === activeCategory)?.icon || Settings;

  return (
    <div className="space-y-6">
      {/* Overview Block */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-800">Керування довідниками системи</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Налаштовуйте списки вибору для кожної категорії. Нові пункти автоматично зберігаються в базі та синхронізуються.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowBatchModal(true)}
          className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shrink-0 cursor-pointer shadow-xs self-start md:self-auto"
        >
          <ListPlus className="h-4 w-4" />
          <span>+ Додати декілька пунктів</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {feedbackMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-emerald-600 hover:text-emerald-900 p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Error Message Banner */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-600 hover:text-rose-900 p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar categories */}
        <div className="w-full lg:w-72 shrink-0 bg-white border border-slate-100 rounded-2xl p-4 self-start space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3.5 mb-2.5">Категорії довідників</p>
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isCatActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSearchQuery('');
                  setEditingItem(null);
                  setConfirmDeleteItem(null);
                  setErrorMsg(null);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  isCatActive
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${isCatActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{cat.label}</span>
                </div>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  isCatActive ? 'bg-teal-800 text-teal-100' : 'bg-slate-100 text-slate-500'
                }`}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Active Directory details */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-6 flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <ActiveIcon className="h-5 w-5 text-teal-700" />
              <h3 className="text-sm font-bold text-slate-800">
                {categories.find(c => c.id === activeCategory)?.label} ({activeList.length})
              </h3>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">
              Збереження автоматичне
            </span>
          </div>

          {/* Add Form */}
          <form onSubmit={handleAddItem} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newValue}
              onChange={(e) => {
                setNewValue(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder={`Введіть нове значення в ${categories.find(c => c.id === activeCategory)?.label.toLowerCase()}...`}
              className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shrink-0 cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Додати</span>
            </button>
          </form>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Шукати значення в цьому довіднику..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50/50 border border-slate-100 rounded-xl focus:bg-white focus:border-slate-200 focus:outline-hidden transition text-slate-600 font-medium"
            />
          </div>

          {/* Value List */}
          <div className="overflow-y-auto max-h-[420px] pr-1 space-y-1.5 scrollbar-thin">
            {filteredItems.map((item) => {
              const usage = getItemUsage(item);
              const isEditing = editingItem === item;
              const isConfirmingDelete = confirmDeleteItem === item;

              return (
                <div 
                  key={item} 
                  className={`flex flex-col p-3 rounded-xl border transition ${
                    isEditing ? 'border-teal-500 bg-teal-50/10' : 'border-slate-100 hover:border-slate-200 bg-slate-50/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {isEditing ? (
                      <div className="flex-1 flex gap-1.5 items-center">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs bg-white border border-teal-400 rounded-lg focus:outline-hidden text-slate-700 font-medium"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') setEditingItem(null);
                          }}
                        />
                        <button 
                          onClick={saveEdit}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition"
                          title="Зберегти"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => setEditingItem(null)}
                          className="p-1 text-slate-400 hover:bg-slate-100 rounded-md transition"
                          title="Скасувати"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 capitalize truncate">{item}</p>
                          {usage.total > 0 && (
                            <p className="text-[10px] text-teal-600 font-bold mt-0.5">
                              {usage.text}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-slate-100 rounded-lg transition"
                            title="Змінити назву"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteItem(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Видалити"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Confirm Delete Alert */}
                  {isConfirmingDelete && (
                    <div className="mt-2 p-2.5 bg-rose-50 rounded-xl border border-rose-100 flex flex-col space-y-2">
                      <div className="flex items-start space-x-2 text-[11px] text-rose-800">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Ви дійсно хочете видалити це значення?</p>
                          {usage.total > 0 && (
                            <p className="mt-0.5 text-rose-700 font-semibold leading-relaxed">
                              Це значення використовується у {usage.total} записах. Видалення прибере його з випадаючого довідника, але збережені записи не будуть втрачені.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end space-x-1.5 pt-1">
                        <button
                          onClick={() => setConfirmDeleteItem(null)}
                          className="px-2.5 py-1 text-[10px] bg-slate-100 text-slate-600 rounded-md font-bold hover:bg-slate-200 transition"
                        >
                          Скасувати
                        </button>
                        <button
                          onClick={() => {
                            handleDeleteItem(item);
                            setConfirmDeleteItem(null);
                          }}
                          className="px-2.5 py-1 text-[10px] bg-rose-600 text-white rounded-md font-bold hover:bg-rose-700 transition"
                        >
                          Видалити
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-8">Нічого не знайдено</p>
            )}
          </div>
        </div>
      </div>

      {/* Batch Add Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ListPlus className="h-5 w-5 text-teal-700" />
                <h3 className="text-sm font-bold text-slate-800">
                  Додати декілька пунктів у «{categories.find(c => c.id === activeCategory)?.label}»
                </h3>
              </div>
              <button 
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Введіть нові значення, кожне з нового рядка або через кому. Система автоматично перевірить їх на дублікати та збереже у довіднику.
            </p>

            <textarea
              rows={6}
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              placeholder="Наприклад:&#10;Менеджер з продажів&#10;Маркетолог&#10;Дизайнер"
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition font-medium text-slate-700"
            />

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleBatchAdd}
                className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Додати всі пункти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

