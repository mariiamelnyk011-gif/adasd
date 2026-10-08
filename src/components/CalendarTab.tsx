import React, { useState, useMemo } from 'react';
import { CalendarEvent, Candidate } from '../types';
import { formatDate, formatDateTime } from '../lib/dateUtils';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Clock, 
  User, 
  X, 
  AlertCircle, 
  CheckCircle,
  FileText,
  Edit2
} from 'lucide-react';

interface CalendarTabProps {
  events: CalendarEvent[];
  candidates: Candidate[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onUpdateEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (eventId: string) => void;
  onViewPersonalFile?: (candidateId: string) => void;
}

export default function CalendarTab({
  events,
  candidates,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onViewPersonalFile
}: CalendarTabProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  // Modal State
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [description, setDescription] = useState('');
  const [candidateId, setCandidateId] = useState('');

  const startEditingEvent = (evt: CalendarEvent) => {
    setEditingEvent(evt);
    setTitle(evt.title);
    setDateTime(evt.dateTime);
    setDescription(evt.description || '');
    setCandidateId(evt.candidateId || '');
    setIsAddingEvent(true);
  };

  const startAddingEvent = (defaultDateTime?: string) => {
    setEditingEvent(null);
    setTitle('');
    setDateTime(defaultDateTime || `${selectedDateStr}T10:00`);
    setDescription('');
    setCandidateId('');
    setIsAddingEvent(true);
  };

  const handleCloseModal = () => {
    setIsAddingEvent(false);
    setEditingEvent(null);
    setTitle('');
    setDateTime('');
    setDescription('');
    setCandidateId('');
  };

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];

  // First day of current month (0 = Sunday, 1 = Monday, etc.)
  // Adjust so Monday is 0
  const firstDayIndex = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1;
  }, [year, month]);

  // Days in current month
  const daysInMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  // Days in previous month (for leading blank cells)
  const daysInPrevMonth = useMemo(() => {
    return new Date(year, month, 0).getDate();
  }, [year, month]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  // Group events by date (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(e => {
      const datePart = e.dateTime.split('T')[0].split(' ')[0];
      if (!map[datePart]) {
        map[datePart] = [];
      }
      map[datePart].push(e);
    });
    return map;
  }, [events]);

  // Selected date events
  const selectedDateEvents = useMemo(() => {
    return eventsByDate[selectedDateStr] || [];
  }, [eventsByDate, selectedDateStr]);

  // Handle click on day
  const handleDayClick = (dayNum: number, isCurrentMonth: 'prev' | 'curr' | 'next') => {
    let targetDate: Date;
    if (isCurrentMonth === 'prev') {
      targetDate = new Date(year, month - 1, dayNum);
    } else if (isCurrentMonth === 'next') {
      targetDate = new Date(year, month + 1, dayNum);
    } else {
      targetDate = new Date(year, month, dayNum);
    }
    
    // Set to local timezone date string
    const offset = targetDate.getTimezoneOffset();
    const localDate = new Date(targetDate.getTime() - (offset * 60 * 1000));
    setSelectedDateStr(localDate.toISOString().split('T')[0]);
  };

  // Submit event (add or update)
  const handleSubmitEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dateTime) return;

    if (editingEvent) {
      onUpdateEvent({
        ...editingEvent,
        title: title.trim(),
        dateTime,
        description: description.trim(),
        candidateId: candidateId || undefined,
      });
    } else {
      onAddEvent({
        title: title.trim(),
        dateTime,
        description: description.trim(),
        candidateId: candidateId || undefined,
        isNotificationSent: false
      });
    }

    handleCloseModal();
  };

  // Build grid days array
  const calendarDays = useMemo(() => {
    const days: { day: number; type: 'prev' | 'curr' | 'next'; dateStr: string }[] = [];

    // Prev month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(year, month - 1, dayNum);
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - (offset * 60 * 1000));
      days.push({
        day: dayNum,
        type: 'prev',
        dateStr: local.toISOString().split('T')[0]
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - (offset * 60 * 1000));
      days.push({
        day: i,
        type: 'curr',
        dateStr: local.toISOString().split('T')[0]
      });
    }

    // Next month days (fill grid to multiple of 7, usually 42 cells)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - (offset * 60 * 1000));
      days.push({
        day: i,
        type: 'next',
        dateStr: local.toISOString().split('T')[0]
      });
    }

    return days;
  }, [year, month, firstDayIndex, daysInMonth, daysInPrevMonth]);

  // All events sorted chronologically
  const sortedAllEvents = useMemo(() => {
    return [...events].sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  }, [events]);

  const selectedCandidateObject = useMemo(() => {
    if (!candidateId) return null;
    return candidates.find(c => c.id === candidateId);
  }, [candidateId, candidates]);

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-800">Календар HR-подій та днів народження</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Створюйте та плануйте HR-заходи. У календарі автоматично відображаються дні народження працівників, які успішно завершили стажування.
            </p>
          </div>
        </div>
        <button
          onClick={() => startAddingEvent()}
          className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shrink-0 shadow-xs cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Запланувати подію</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Interactive Calendar Grid (2/3 width) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 flex flex-col space-y-4">
          {/* Header Month / Nav */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
              <span className="text-teal-700 font-extrabold text-base">{monthNames[month]}</span>
              <span className="text-slate-400">{year}</span>
            </h3>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={handleToday}
                className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition"
              >
                Сьогодні
              </button>
              <button
                onClick={handlePrevMonth}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <div>Пн</div>
            <div>Вт</div>
            <div>Ср</div>
            <div>Чт</div>
            <div>Пт</div>
            <div className="text-slate-400">Сб</div>
            <div className="text-rose-500">Нд</div>
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((cell, idx) => {
              const dayEvents = eventsByDate[cell.dateStr] || [];
              const isSelected = cell.dateStr === selectedDateStr;
              const isToday = cell.dateStr === new Date().toISOString().split('T')[0];
              
              return (
                <button
                  key={`${cell.dateStr}-${idx}`}
                  onClick={() => handleDayClick(cell.day, cell.type)}
                  className={`min-h-[75px] p-2 rounded-xl flex flex-col justify-between text-left border transition cursor-pointer relative group ${
                    isSelected 
                      ? 'bg-teal-50/40 border-teal-600 ring-1 ring-teal-600' 
                      : cell.type === 'curr'
                        ? 'bg-white border-slate-100 hover:border-slate-200'
                        : 'bg-slate-50/50 border-transparent text-slate-300'
                  }`}
                >
                  <span className={`text-xs font-extrabold ${
                    isToday 
                      ? 'h-5 w-5 bg-teal-700 text-white flex items-center justify-center rounded-md font-bold'
                      : isSelected 
                        ? 'text-teal-900' 
                        : cell.type === 'curr' 
                          ? 'text-slate-600' 
                          : 'text-slate-300'
                  }`}>
                    {cell.day}
                  </span>

                  {/* Day Events Dots / Badges */}
                  <div className="space-y-1 w-full pt-1.5">
                    {dayEvents.slice(0, 2).map((evt) => {
                      const isBirthday = evt.id.startsWith('birthday-') || evt.title.includes('День народження');
                      return (
                        <div 
                          key={evt.id}
                          className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold truncate ${
                            isBirthday
                              ? 'bg-amber-100 text-amber-900 border border-amber-200/80 font-extrabold'
                              : evt.isNotificationSent 
                                ? 'bg-slate-100 text-slate-500 line-through' 
                                : 'bg-teal-50 text-teal-800'
                          }`}
                          title={evt.title}
                        >
                          {evt.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <div className="text-[8px] text-slate-400 font-bold pl-1">
                        +{dayEvents.length - 2} ще
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Date Event Info Panel (1/3 width) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col space-y-4">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Події: <span className="text-teal-700 font-extrabold">{new Date(selectedDateStr).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}</span>
            </h3>
            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-md uppercase">
              {selectedDateEvents.length} подій
            </span>
          </div>

          {/* Events List for Selected Date */}
          <div className="flex-1 space-y-3 overflow-y-auto max-h-[360px] pr-1">
            {selectedDateEvents.map((evt) => {
              const matchedCandidate = candidates.find(c => c.id === evt.candidateId);
              const timeParts = evt.dateTime.split(/[T ]/);
              const eventTime = timeParts[1] ? timeParts[1].substring(0, 5) : '';
              const isBirthday = evt.id.startsWith('birthday-') || evt.title.includes('День народження');

              return (
                <div 
                  key={evt.id} 
                  className={`p-3.5 rounded-2xl border flex flex-col space-y-2 relative group transition ${
                    isBirthday 
                      ? 'bg-amber-50/70 border-amber-200/80' 
                      : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <h4 className={`text-xs font-bold ${isBirthday ? 'text-amber-950' : 'text-slate-700'}`}>
                        {evt.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center space-x-1">
                        <Clock className="h-3 w-3 text-teal-600 mr-0.5" />
                        <span>{eventTime}</span>
                        {isBirthday && (
                          <span className="inline-flex items-center text-[9px] text-amber-800 bg-amber-100/90 px-1.5 py-0.2 rounded font-extrabold uppercase ml-1">
                            День народження
                          </span>
                        )}
                        {!isBirthday && evt.isNotificationSent && (
                          <span className="inline-flex items-center text-[9px] text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded font-bold uppercase ml-1">
                            Сповіщено
                          </span>
                        )}
                      </p>
                    </div>

                    {!isBirthday && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => startEditingEvent(evt)}
                          className="text-slate-400 hover:text-teal-600 p-1 rounded-lg hover:bg-teal-50 transition"
                          title="Редагувати подію"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteEvent(evt.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition"
                          title="Видалити подію"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {evt.description && (
                    <p className={`text-[11px] leading-relaxed font-medium p-2 rounded-lg border ${
                      isBirthday 
                        ? 'bg-amber-100/40 text-amber-900 border-amber-200/50' 
                        : 'bg-white text-slate-500 border-slate-100'
                    }`}>
                      {evt.description}
                    </p>
                  )}

                  {matchedCandidate && (
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100/60">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <div className="h-5 w-5 bg-teal-50 rounded-full flex items-center justify-center shrink-0">
                          <User className="h-3 w-3 text-teal-700" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 capitalize truncate">
                          Кандидат: {matchedCandidate.name}
                        </span>
                      </div>
                      {onViewPersonalFile && (
                        <button
                          onClick={() => onViewPersonalFile(matchedCandidate.id)}
                          className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-100 rounded-md text-[9px] font-bold uppercase transition cursor-pointer shrink-0 ml-1"
                          title="Відкрити особову справу"
                        >
                          <FileText className="h-2.5 w-2.5 text-teal-700 mr-0.5" />
                          <span>Профіль</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {selectedDateEvents.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <CalendarIcon className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs font-bold">На цей день подій не заплановано</p>
                <button
                  onClick={() => {
                    const defaultTime = `${selectedDateStr}T10:00`;
                    setDateTime(defaultTime);
                    setIsAddingEvent(true);
                  }}
                  className="text-teal-700 hover:underline font-extrabold text-[11px] mt-1"
                >
                  Запланувати подію +
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* List of All Chronological Events Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-800">Повний графік подій компанії</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 font-medium">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                <th className="py-2.5 px-4">Подія</th>
                <th className="py-2.5 px-4">Дата та Час</th>
                <th className="py-2.5 px-4">Опис події</th>
                <th className="py-2.5 px-4">Пов'язаний Кандидат</th>
                <th className="py-2.5 px-4">Статус сповіщення</th>
                <th className="py-2.5 px-4 text-right">Дія</th>
              </tr>
            </thead>
            <tbody>
              {sortedAllEvents.map((evt) => {
                const matchedCandidate = candidates.find(c => c.id === evt.candidateId);
                const isOverdue = new Date(evt.dateTime) < new Date() && !evt.isNotificationSent;
                const isBirthday = evt.id.startsWith('birthday-') || evt.title.includes('День народження');

                return (
                  <tr key={evt.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-bold text-slate-800">{evt.title}</td>
                    <td className="py-3 px-4">
                      {formatDateTime(evt.dateTime)}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate" title={evt.description}>{evt.description || '-'}</td>
                    <td className="py-3 px-4 capitalize font-semibold text-slate-700">
                      {matchedCandidate ? (
                        <div className="flex items-center space-x-1.5">
                          <span 
                            onClick={() => onViewPersonalFile?.(matchedCandidate.id)}
                            className={`font-semibold text-slate-700 ${
                              onViewPersonalFile ? 'hover:text-teal-700 hover:underline cursor-pointer' : ''
                            }`}
                            title={onViewPersonalFile ? "Переглянути особову справу" : ""}
                          >
                            {matchedCandidate.name}
                          </span>
                          {onViewPersonalFile && (
                            <button
                              onClick={() => onViewPersonalFile(matchedCandidate.id)}
                              className="text-teal-600 hover:text-teal-800 p-0.5 cursor-pointer shrink-0"
                              title="Відкрити особову справу"
                            >
                              <FileText className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {evt.isNotificationSent ? (
                        <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                          <CheckCircle className="h-3 w-3 mr-0.5 text-emerald-500" />
                          <span>Надіслано</span>
                        </span>
                      ) : isOverdue ? (
                        <span className="inline-flex items-center space-x-1 text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-full uppercase">
                          <span>Минула</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full uppercase">
                          <Clock className="h-3 w-3 mr-0.5 text-amber-500" />
                          <span>Очікує</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!isBirthday && (
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => startEditingEvent(evt)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                            title="Редагувати подію"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteEvent(evt.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Видалити подію"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sortedAllEvents.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 font-bold">
                    Графік порожній. Немає запланованих заходів.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Event Overlay Modal */}
      {isAddingEvent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full p-6 space-y-4 text-left">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {editingEvent ? 'Редагувати подію' : 'Запланувати нову подію'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingEvent ? 'Внесіть необхідні зміни у подію.' : 'Введіть інформацію для відображення в системі.'}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitEvent} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Заголовок події</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="напр., Співбесіда: Іван Коваленко"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Дата та час події</label>
                <input
                  type="datetime-local"
                  required
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Прив'язати кандидата (необов'язково)</label>
                <select
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-semibold"
                >
                  <option value="">-- Оберіть кандидата --</option>
                  {candidates.map(cand => (
                    <option key={cand.id} value={cand.id}>
                      {cand.name} ({cand.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Короткий опис або нотатка</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="напр., Перевірка технічних навичок, обговорення вимог..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                />
              </div>

              <div className="flex space-x-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {editingEvent ? 'Зберегти зміни' : 'Зберегти зустріч'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
