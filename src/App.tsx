import { useState, useEffect, useTransition, useMemo, useRef } from 'react';
import { HRSystemData, Vacancy, Candidate, Interview, Intern, FiredEmployee, CalendarEvent, CandidateStatus } from './types';
import { initialHRData, DEFAULT_POSITIONS, DEFAULT_DEPARTMENTS } from './lib/seedData';
import { getOrRestoreCvFile, saveCvFile, getCvFile } from './lib/cvStorage';
import { initAuth, googleSignIn, directGoogleSignIn, emailSignIn, emailSignUp, logout } from './lib/firebaseAuth';
import { getTodayDateTimeString, formatDateForInput, getTodayDateString } from './lib/dateUtils';
import {
  findSpreadsheet,
  createSpreadsheet,
  loadDataFromSheets,
  saveDataToSheets,
  getSpreadsheetLink
} from './lib/googleSheets';
import { User } from 'firebase/auth';

// Icons
import {
  Users,
  Briefcase,
  Calendar,
  Award,
  UserMinus,
  FileText,
  BarChart3,
  CloudLightning,
  CloudOff,
  LogOut,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Settings,
  Bell,
  Clock,
  XCircle,
  Zap,
  Search,
  Table as TableIcon,
  Smartphone
} from 'lucide-react';

// Components
import Dashboard from './components/Dashboard';
import VacanciesManager from './components/VacanciesManager';
import CandidatesManager from './components/CandidatesManager';
import InterviewsManager from './components/InterviewsManager';
import InternsManager from './components/InternsManager';
import FiredAnalytics from './components/FiredAnalytics';
import ReportGenerator from './components/ReportGenerator';
import PersonalFileModal from './components/PersonalFileModal';
import QuickInterviewModal from './components/QuickInterviewModal';
import CalendarTab from './components/CalendarTab';
import DirectoriesManager from './components/DirectoriesManager';
import RejectionsAnalytics from './components/RejectionsAnalytics';
import { TablesView } from './components/TablesView';
import { GlobalCommandPalette } from './components/GlobalCommandPalette';
import { LoginPage } from './components/LoginPage';
import { MultiDeviceModal } from './components/MultiDeviceModal';
import {
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  sendSessionHeartbeat,
  getOrCreateDeviceId,
  detectDeviceName,
  UserSession
} from './lib/sessionManager';

import { calculateTenureMonths } from './lib/dateUtils';

type ActiveTab = 'dashboard' | 'vacancies' | 'candidates' | 'interviews' | 'interns' | 'fired' | 'report' | 'calendar' | 'directories' | 'tables';

export const DEFAULT_STAGES = ['Новий', 'Повідомлення', 'Співбесіда', 'Співбесіда з керівником', 'Стажування', 'Працевлаштовано', 'Подумає', 'Резерв', 'Відмова кандидата', 'Відмова компанії'];
export const DEFAULT_SOURCES = ['work.ua', 'robota.ua', 'facebook', 'instagram', 'threads', 'працівник', 'внз', 'інше'];
export const DEFAULT_INTERVIEW_STATUSES = ['Заплановано', 'Зворотний зв\'язок', 'Завершено', 'Скасовано', 'Не прийшов'];
export const DEFAULT_INTERVIEW_RESULTS = [
  'Очікує рішення',
  'Зворотний зв\'язок',
  'Співбесіда з керівником',
  'Співбесіда не відбулася',
  'Співбесіда пройшла успішно',
  'Перейшов на стажування',
  'Відмова компанії',
  'Відмова кандидата',
  'Резерв',
  'Подумає',
  'Інше'
];
export const DEFAULT_INTERN_STATUSES = ['Триває', 'Успішно завершено', 'Не пройшов', 'Відмовився'];
export const DEFAULT_FIRED_REASONS = [
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

export const ensureDefaults = (raw: any): HRSystemData => {
  const rawCandidates: Candidate[] = raw?.candidates || [];
  const processedCandidates = rawCandidates.map(c => {
    const seed = initialHRData?.candidates?.find(s => s.id === c.id || s.name === c.name);
    const cvLink = c.cvLink !== undefined ? c.cvLink : (seed?.cvLink || '');
    const cvFileName = c.cvFileName !== undefined ? c.cvFileName : (seed?.cvFileName || '');
    let cvFileContent = c.cvFileContent || seed?.cvFileContent || '';

    if (cvFileContent && (cvFileContent.startsWith('[') || cvFileContent.includes('обрізано'))) {
      cvFileContent = seed?.cvFileContent || '';
    }

    // Restore uploaded file from local storage if previously uploaded by the user
    const restored = getOrRestoreCvFile(
      c.id,
      c.name,
      'Спеціаліст',
      c.phone,
      cvFileName,
      cvFileContent
    );

    let vacancyId = c.vacancyId;
    if (c.id === 'C-516' && (vacancyId === 'V-25' || !vacancyId)) {
      vacancyId = 'V-26';
    } else if (c.id === 'C-230' && (vacancyId === 'V-17' || !vacancyId)) {
      vacancyId = 'V-20';
    } else if (c.id === 'C-196' && (vacancyId === 'V-4' || !vacancyId)) {
      vacancyId = 'V-1';
    } else if (c.id === 'C-153' && !vacancyId) {
      vacancyId = 'V-20';
    } else if (c.id === 'C-133' && (vacancyId === 'V-17' || !vacancyId)) {
      vacancyId = 'V-5';
    }

    let finalStatus = (c.status === 'Скринінг' ? 'Повідомлення' : c.status) || 'Новий';
    let finalRejectionReason = c.rejectionReason;
    if (finalStatus === 'Відхилено') {
      finalStatus = 'Відмова компанії';
      if (!finalRejectionReason) {
        finalRejectionReason = 'Відмова компанії';
      }
    }

    return {
      ...c,
      vacancyId,
      status: finalStatus,
      rejectionReason: finalRejectionReason,
      cvLink,
      cvFileName: restored.fileName || cvFileName,
      cvFileContent: restored.fileContent
    };
  });

  // Always ensure candidates are consistently sorted newest first (by contact/applied date & numeric ID descending)
  processedCandidates.sort((a, b) => {
    const dateA = a.contactDate || a.appliedAt || '';
    const dateB = b.contactDate || b.appliedAt || '';
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
    return numB - numA;
  });

  // Normalize stagesList to ensure logical pipeline flow
  const rawStages: string[] = (raw?.stagesList && Array.isArray(raw.stagesList) && raw.stagesList.length > 0)
    ? raw.stagesList
    : DEFAULT_STAGES;
  const migratedStages = rawStages.map((s: string) => s === 'Скринінг' ? 'Повідомлення' : s);
  if (!migratedStages.includes('Повідомлення')) {
    const idx = migratedStages.indexOf('Новий');
    if (idx !== -1) migratedStages.splice(idx + 1, 0, 'Повідомлення');
    else migratedStages.unshift('Повідомлення');
  }
  if (!migratedStages.includes('Працевлаштовано')) {
    const sIdx = migratedStages.indexOf('Стажування');
    if (sIdx !== -1) migratedStages.splice(sIdx + 1, 0, 'Працевлаштовано');
    else migratedStages.push('Працевлаштовано');
  }
  const orderedStages = [
    'Новий',
    'Повідомлення',
    'Співбесіда',
    'Співбесіда з керівником',
    'Стажування',
    'Працевлаштовано',
    ...migratedStages.filter((s: string) => !['Новий', 'Повідомлення', 'Співбесіда', 'Співбесіда з керівником', 'Стажування', 'Працевлаштовано', 'Подумає', 'Резерв', 'Відхилено', 'Відмова кандидата', 'Відмова компанії'].includes(s)),
    ...(migratedStages.includes('Подумає') || DEFAULT_STAGES.includes('Подумає') ? ['Подумає'] : []),
    ...(migratedStages.includes('Резерв') || DEFAULT_STAGES.includes('Резерв') ? ['Резерв'] : []),
    'Відмова кандидата',
    'Відмова компанії'
  ];
  const finalStagesList = Array.from(new Set(orderedStages));

  // Dedup interviews so each candidate has at most ONE interview card.
  // Merges multiple interviews (e.g. initial + manager interview) into a single card.
  const rawInterviews: Interview[] = raw?.interviews || [];
  const interviewMap = new Map<string, Interview>();
  for (const inv of rawInterviews) {
    const key = (inv.candidateId && inv.candidateId.trim()) 
      ? inv.candidateId.trim() 
      : (inv.candidateName ? inv.candidateName.trim().toLowerCase() : inv.id);
    if (!interviewMap.has(key)) {
      interviewMap.set(key, inv);
    } else {
      const existing = interviewMap.get(key)!;
      const isManager = inv.result === 'Співбесіда з керівником' || Boolean(inv.managerName);
      interviewMap.set(key, {
        ...existing,
        ...inv,
        id: existing.id, // Retain primary ID
        result: isManager ? 'Співбесіда з керівником' : (inv.result || existing.result),
        status: inv.status === 'Завершено' ? 'Завершено' : (inv.status || existing.status),
        managerName: inv.managerName || existing.managerName,
        managerInterviewDate: inv.managerInterviewDate || existing.managerInterviewDate,
        feedback: inv.feedback ? (existing.feedback && existing.feedback !== inv.feedback ? `${existing.feedback}\n${inv.feedback}` : inv.feedback) : existing.feedback
      });
    }
  }
  let processedInterviews = Array.from(interviewMap.values());

  // Process interns (exclude reserve)
  let processedInterns = (raw?.interns || []).filter((intern: any) => {
    // Exclude interns who are in reserve
    const cand = processedCandidates.find(c => c.id === intern.candidateId || (c.name && intern.candidateName && c.name.trim().toLowerCase() === intern.candidateName.trim().toLowerCase()));
    if (cand && cand.status === 'Резерв') return false;
    const hasReserveInterview = rawInterviews.some((inv: any) => 
      (inv.candidateId === intern.candidateId || (inv.candidateName && intern.candidateName && inv.candidateName.trim().toLowerCase() === intern.candidateName.trim().toLowerCase())) &&
      (inv.result === 'Резерв' || inv.result?.toLowerCase().includes('резерв'))
    );
    if (hasReserveInterview) return false;
    return true;
  }).map((intern: any) => {
    const cand = processedCandidates.find(c => c.id === intern.candidateId);
    const seedIntern = initialHRData?.interns?.find(s => s.id === intern.id);
    return {
      ...intern,
      candidateName: (intern.candidateName && intern.candidateName.trim()) || cand?.name || seedIntern?.candidateName || 'Стажер',
      hasDocuments: cand?.hasDocuments !== undefined ? cand.hasDocuments : Boolean(intern.hasDocuments)
    };
  });

  // Ensure EVERY candidate with status === 'Стажування' appears BOTH in interviews AND in interns
  for (const cand of processedCandidates) {
    if (cand.status === 'Стажування') {
      // 1. Must appear in interviews
      const intIdx = processedInterviews.findIndex(i => 
        i.candidateId === cand.id || 
        (i.candidateName && cand.name && i.candidateName.trim().toLowerCase() === cand.name.trim().toLowerCase())
      );
      if (intIdx !== -1) {
        const existingInt = processedInterviews[intIdx];
        processedInterviews[intIdx] = {
          ...existingInt,
          candidateName: cand.name,
          status: 'Завершено',
          result: (existingInt.result === 'Співбесіда пройшла успішно' || existingInt.result === 'Перейшов на стажування')
            ? existingInt.result 
            : 'Перейшов на стажування'
        };
      } else {
        const nextIntNum = processedInterviews.length > 0 ? Math.max(...processedInterviews.map(i => {
          const p = i.id.split('-');
          return parseInt(p[1]) || 0;
        })) + 1 : 1;
        const initialIntDate = cand.contactDate 
          ? (formatDateForInput(cand.contactDate) ? `${formatDateForInput(cand.contactDate)}T10:00` : cand.contactDate) 
          : new Date().toISOString().slice(0, 16);
        processedInterviews.unshift({
          id: `I-${nextIntNum}`,
          candidateId: cand.id,
          candidateName: cand.name,
          dateTime: initialIntDate,
          interviewer: 'HR Менеджер',
          feedback: cand.comment || 'Зараховано на стажування',
          rating: cand.rating || 4,
          status: 'Завершено',
          result: 'Перейшов на стажування'
        });
      }

      // 2. Sync candidate info with existing intern if present (never auto-create here to avoid resurrecting deleted interns)
      const inIdx = processedInterns.findIndex(i => 
        i.candidateId === cand.id || 
        (i.candidateName && cand.name && i.candidateName.trim().toLowerCase() === cand.name.trim().toLowerCase())
      );
      if (inIdx !== -1) {
        const existingIn = processedInterns[inIdx];
        processedInterns[inIdx] = {
          ...existingIn,
          candidateName: cand.name,
          phone: cand.phone || existingIn.phone,
          birthDate: cand.birthDate || existingIn.birthDate,
          hasDocuments: cand.hasDocuments !== undefined ? cand.hasDocuments : existingIn.hasDocuments
        };
      }
    }
  }

  return {
    vacancies: (raw?.vacancies || []).map((v: any) => ({
      ...v,
      priority: (v.priority === 'Термінова' || v.priority === 'Критична' || v.priority === 'Висока') ? 'Термінова' : (v.priority || 'Звичайна')
    })),
    candidates: processedCandidates,
    interviews: processedInterviews,
    interns: processedInterns,
    firedEmployees: raw?.firedEmployees || [],
    positionsList: (raw?.positionsList && Array.isArray(raw.positionsList) && raw.positionsList.length > 0) ? raw.positionsList : DEFAULT_POSITIONS,
    departmentsList: (raw?.departmentsList && Array.isArray(raw.departmentsList) && raw.departmentsList.length > 0) ? raw.departmentsList : DEFAULT_DEPARTMENTS,
    stagesList: finalStagesList,
    sourcesList: (raw?.sourcesList && Array.isArray(raw.sourcesList) && raw.sourcesList.length > 0) ? raw.sourcesList : DEFAULT_SOURCES,
    interviewStatusesList: (() => {
      const list = (raw?.interviewStatusesList && Array.isArray(raw.interviewStatusesList) && raw.interviewStatusesList.length > 0) ? raw.interviewStatusesList : DEFAULT_INTERVIEW_STATUSES;
      if (!list.includes('Зворотний зв\'язок')) {
        return ['Заплановано', 'Зворотний зв\'язок', ...list.filter((s: string) => s !== 'Заплановано')];
      }
      return list;
    })(),
    interviewResultsList: (() => {
      const list = (raw?.interviewResultsList && Array.isArray(raw.interviewResultsList) && raw.interviewResultsList.length > 0) ? raw.interviewResultsList : DEFAULT_INTERVIEW_RESULTS;
      let res = [...list];
      if (!res.includes('Зворотний зв\'язок')) {
        res = ['Очікує рішення', 'Зворотний зв\'язок', ...res.filter((s: string) => s !== 'Очікує рішення')];
      }
      if (!res.includes('Співбесіда з керівником')) {
        const idx = res.indexOf('Зворотний зв\'язок');
        if (idx !== -1) {
          res.splice(idx + 1, 0, 'Співбесіда з керівником');
        } else {
          res.push('Співбесіда з керівником');
        }
      }
      return res;
    })(),
    internStatusesList: (() => {
      const list = (raw?.internStatusesList && Array.isArray(raw.internStatusesList) && raw.internStatusesList.length > 0) ? raw.internStatusesList : DEFAULT_INTERN_STATUSES;
      if (!list.includes('Відмовився')) {
        return [...list, 'Відмовився'];
      }
      return list;
    })(),
    firedReasonsList: (raw?.firedReasonsList && Array.isArray(raw.firedReasonsList) && raw.firedReasonsList.length > 0) ? raw.firedReasonsList : DEFAULT_FIRED_REASONS,
    calendarEvents: raw?.calendarEvents || []
  };
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [personalFileCandidateId, setPersonalFileCandidateId] = useState<string | null>(null);
  const [isQuickInterviewOpen, setIsQuickInterviewOpen] = useState(false);

  const openPersonalFile = (id: string | null) => {
    if (id) {
      setIsQuickInterviewOpen(false);
      setShowCustomSheetModal(false);
    }
    setPersonalFileCandidateId(id);
  };

  const openQuickInterview = () => {
    setPersonalFileCandidateId(null);
    setShowCustomSheetModal(false);
    setIsQuickInterviewOpen(true);
  };

  const [data, setData] = useState<HRSystemData>(() => {
    const saved = localStorage.getItem('hr_analytics_local_data');
    if (saved) {
      try {
        return ensureDefaults(JSON.parse(saved));
      } catch (err) {
        console.error('Error parsing local data, resetting to seed data:', err);
        return ensureDefaults(initialHRData);
      }
    }
    return ensureDefaults(initialHRData);
  });

  // Authentication & Google Sheets integration states
  const [user, setUser] = useState<User | null>(null);
  const [isLocalAuth, setIsLocalAuth] = useState<boolean>(() => {
    // Check URL parameters first for instant multi-device QR / shared link login
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const authParam = params.get('auth');
        const userParam = params.get('user');
        if (authParam === '1234' || (authParam && authParam.trim().length >= 3)) {
          const roleToSet = userParam ? decodeURIComponent(userParam) : 'Марія Мельник (Власник)';
          localStorage.setItem('hr_local_auth', 'true');
          localStorage.setItem('hr_local_role', roleToSet);
          window.history.replaceState({}, '', window.location.pathname);
          return true;
        }
      } catch {}
    }
    const saved = localStorage.getItem('hr_local_auth');
    if (saved === 'false') return false;
    return true;
  });
  const [localRole, setLocalRole] = useState<string>(() => {
    return localStorage.getItem('hr_local_role') || 'Марія Мельник (Власник)';
  });
  const [currentSession, setCurrentSession] = useState<UserSession | null>(() => loadActiveSession());
  const [showMultiDeviceModal, setShowMultiDeviceModal] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem('custom_spreadsheet_id') || null;
  });
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(() => {
    const id = localStorage.getItem('custom_spreadsheet_id');
    return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'offline' | 'error'>('synced');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeNotifications, setActiveNotifications] = useState<{ id: string; title: string; time: string }[]>([]);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Centralized Cloud Synchronization Engine (Real-time Cross-Computer / Cross-Device Sync)
  const serverVersionRef = useRef<number>(1);
  const lastModifiedRef = useRef<string | null>(null);
  const isSyncingRef = useRef<boolean>(false);
  const isInitialFetchDoneRef = useRef<boolean>(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  // Global Keyboard Shortcuts (Ctrl+K, Alt+I, Alt+N, Alt+V) for speed
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K: Open Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      // Alt+I: Express Interview
      if (e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        openQuickInterview();
      }
      // Alt+N: Candidates tab
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setActiveTab('candidates');
      }
      // Alt+V: Vacancies tab
      if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setActiveTab('vacancies');
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  const [, startTransition] = useTransition();

  // Load centralized cloud data from the shared server
  const loadCloudData = async (isBackgroundPoll = false) => {
    if (isSyncingRef.current) return;
    if (!isBackgroundPoll) setIsCloudSyncing(true);

    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          serverVersionRef.current = json.version || 1;
          lastModifiedRef.current = json.lastModified || null;

          const sheetId = json.spreadsheetId || null;
          if (sheetId) {
            setSpreadsheetId(sheetId);
            setSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
            localStorage.setItem('custom_spreadsheet_id', sheetId);
          }

          // Check if local storage on this computer has richer user data than a fresh server (migration)
          const localRaw = localStorage.getItem('hr_analytics_local_data');
          let localParsed: HRSystemData | null = null;
          if (localRaw) {
            try { localParsed = JSON.parse(localRaw); } catch {}
          }

          const serverCandidates = json.data.candidates || [];
          const localCandidates = localParsed?.candidates || [];

          if (!isInitialFetchDoneRef.current && localCandidates.length > serverCandidates.length && localCandidates.length > 4) {
            console.log('Migrating richer local browser data to central server database...');
            const merged = ensureDefaults({
              ...json.data,
              ...localParsed,
              candidates: localCandidates
            });
            await pushDataToServer(merged, sheetId);
            setData(merged);
            latestDataRef.current = merged;
          } else {
            const defaulted = ensureDefaults(json.data);
            // Restore CV contents if available in memory store
            if (defaulted.candidates) {
              defaulted.candidates = defaulted.candidates.map(c => {
                const cv = getCvFile(c.id);
                if (cv && !c.cvFileContent) {
                  return { ...c, cvFileContent: cv.fileContent, cvFileName: cv.fileName || c.cvFileName };
                }
                return c;
              });
            }
            setData(defaulted);
            latestDataRef.current = defaulted;
            try {
              localStorage.setItem('hr_analytics_local_data', JSON.stringify(defaulted));
            } catch {}
          }

          setSyncStatus('synced');
          setLastSyncedTime(new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      }
    } catch (err) {
      console.warn('Could not fetch cloud data, using local fallback:', err);
    } finally {
      isInitialFetchDoneRef.current = true;
      if (!isBackgroundPoll) setIsCloudSyncing(false);
    }
  };

  // Push data to central cloud server
  const serverSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pushDataToServer = async (dataToPush: HRSystemData, currentSheetId?: string) => {
    try {
      setSyncStatus('saving');
      const targetSheetId = currentSheetId !== undefined ? currentSheetId : (spreadsheetId || localStorage.getItem('custom_spreadsheet_id') || null);
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: dataToPush,
          spreadsheetId: targetSheetId
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.version) {
          serverVersionRef.current = json.version;
        }
        if (json.lastModified) {
          lastModifiedRef.current = json.lastModified;
        }
        setSyncStatus('synced');
        setLastSyncedTime(new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.warn('Cloud server save error:', err);
    }
  };

  // 1. Initialize Auth and Centralized Cloud Sync on page load
  useEffect(() => {
    setIsLoading(true);
    // Always load cloud data first
    loadCloudData().finally(() => {
      setIsLoading(false);
    });

    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        handleGoogleConnection(token);
      },
      () => {
        // Fallback to local auth if not signed in with Google
        setUser(null);
        setAccessToken(null);
      }
    );

    // Cross-device auto-sync: Poll server metadata every 5 seconds
    const interval = setInterval(async () => {
      if (isSyncingRef.current || syncStatus === 'saving') return;
      try {
        const metaRes = await fetch('/api/data/meta');
        if (metaRes.ok) {
          const meta = await metaRes.json();
          const hasNewVersion = meta.version && meta.version > serverVersionRef.current;
          const hasModified = meta.lastModified && meta.lastModified !== lastModifiedRef.current;
          if (hasNewVersion || hasModified) {
            console.log(`Cloud update from another computer detected (v${meta.version}, mod: ${meta.lastModified}), syncing...`);
            loadCloudData(true);
          }
        }
      } catch {}
    }, 5000);

    // Sync immediately when window gains focus or tab becomes visible
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetch('/api/data/meta')
          .then(r => r.json())
          .then(meta => {
            const hasNewVersion = meta.version && meta.version > serverVersionRef.current;
            const hasModified = meta.lastModified && meta.lastModified !== lastModifiedRef.current;
            if (hasNewVersion || hasModified) {
              loadCloudData(true);
            }
          })
          .catch(() => {});
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    // Concurrent multi-device session heartbeat ping every 30s
    const activeSession = loadActiveSession();
    if (activeSession) {
      sendSessionHeartbeat(activeSession);
    }
    const hbInterval = setInterval(() => {
      const active = loadActiveSession();
      if (active) {
        sendSessionHeartbeat(active);
      }
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
      clearInterval(hbInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // Load from local storage for offline/demo mode
  const loadLocalData = () => {
    const saved = localStorage.getItem('hr_analytics_local_data');
    if (saved) {
      try {
        const parsed = ensureDefaults(JSON.parse(saved));
        if (parsed.candidates) {
          parsed.candidates = parsed.candidates.map(c => {
            const cv = getCvFile(c.id);
            if (cv && !c.cvFileContent) {
              return { ...c, cvFileContent: cv.fileContent, cvFileName: cv.fileName || c.cvFileName };
            }
            return c;
          });
        }
        setData(parsed);
      } catch (err) {
        console.error('Error parsing local data, resetting to seed data:', err);
        setData(ensureDefaults(initialHRData));
      }
    } else {
      setData(ensureDefaults(initialHRData));
      localStorage.setItem('hr_analytics_local_data', JSON.stringify(ensureDefaults(initialHRData)));
    }
  };

  // Save to local storage for offline fallback
  const saveLocalData = (updated: HRSystemData) => {
    const defaulted = ensureDefaults(updated);
    setData(defaulted);
    try {
      const candidatesToStore = (defaulted.candidates || []).map(c => {
        if (c.cvFileContent && !c.cvFileContent.startsWith('[') && !c.cvFileContent.includes('обрізано') && c.cvFileContent.length > 50) {
          saveCvFile(c.id, c.cvFileName || `Резюме_${c.name.split(' ')[0]}.pdf`, c.cvFileContent);
          return { ...c, cvFileContent: '' };
        }
        return c;
      });
      localStorage.setItem('hr_analytics_local_data', JSON.stringify({ ...defaulted, candidates: candidatesToStore }));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  };

  // 2. Core Google Sheets Sync Mechanism
  const handleGoogleConnection = async (token: string, overrideId?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Step A: Find existing spreadsheet or create one
      let sheetId = overrideId || spreadsheetId || localStorage.getItem('custom_spreadsheet_id') || await findSpreadsheet(token);
      let isNew = false;

      if (!sheetId) {
        setSyncStatus('saving');
        sheetId = await createSpreadsheet(token);
        isNew = true;
      } else {
        localStorage.setItem('custom_spreadsheet_id', sheetId);
      }

      setSpreadsheetId(sheetId);

      // Step B: Fetch spreadsheet web link for the user
      const url = await getSpreadsheetLink(token, sheetId);
      setSpreadsheetUrl(url);

      // Step C: Read existing data from spreadsheet
      if (!isNew) {
        const cloudData = await loadDataFromSheets(token, sheetId);
        if (cloudData) {
          // Merge logic: If cloud data has empty tables but local has data, preserve the local ones
          const mergedData = { ...cloudData };
          let needsWriteBack = false;

          if ((!cloudData.calendarEvents || cloudData.calendarEvents.length === 0) && data.calendarEvents && data.calendarEvents.length > 0) {
            mergedData.calendarEvents = data.calendarEvents;
            needsWriteBack = true;
          }
          if ((!cloudData.interviews || cloudData.interviews.length === 0) && data.interviews && data.interviews.length > 0) {
            mergedData.interviews = data.interviews;
            needsWriteBack = true;
          }
          if ((!cloudData.candidates || cloudData.candidates.length === 0) && data.candidates && data.candidates.length > 0) {
            mergedData.candidates = data.candidates;
            needsWriteBack = true;
          } else if (cloudData.candidates && data.candidates) {
            const cloudIds = new Set(cloudData.candidates.map(c => c.id));
            const missingLocalCandidates = data.candidates.filter(c => !cloudIds.has(c.id));
            if (missingLocalCandidates.length > 0) {
              needsWriteBack = true;
            }
            const updatedCloudCandidates = cloudData.candidates.map(cloudCand => {
              const localCand = data.candidates?.find(c => c.id === cloudCand.id);
              const cvLink = cloudCand.cvLink || localCand?.cvLink;
              const cvFileName = cloudCand.cvFileName || localCand?.cvFileName;
              const isPlaceholder = cloudCand.cvFileContent && (cloudCand.cvFileContent.startsWith('[') || cloudCand.cvFileContent.includes('обрізано'));
              const cvFileContent = (!isPlaceholder && cloudCand.cvFileContent) ? cloudCand.cvFileContent : (localCand?.cvFileContent || '');
              if ((!cloudCand.cvLink && localCand?.cvLink) || (!cloudCand.cvFileContent && localCand?.cvFileContent)) {
                needsWriteBack = true;
              }
              return {
                ...cloudCand,
                cvLink,
                cvFileName,
                cvFileContent
              };
            });
            mergedData.candidates = [...updatedCloudCandidates, ...missingLocalCandidates].sort((a, b) => {
              const dateA = a.contactDate || a.appliedAt || '';
              const dateB = b.contactDate || b.appliedAt || '';
              if (dateA !== dateB) return dateB.localeCompare(dateA);
              const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
              const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
              return numB - numA;
            });
          }
          if ((!cloudData.vacancies || cloudData.vacancies.length === 0) && data.vacancies && data.vacancies.length > 0) {
            mergedData.vacancies = data.vacancies;
            needsWriteBack = true;
          }
          if ((!cloudData.interns || cloudData.interns.length === 0) && data.interns && data.interns.length > 0) {
            mergedData.interns = data.interns;
            needsWriteBack = true;
          }
          if ((!cloudData.firedEmployees || cloudData.firedEmployees.length === 0) && data.firedEmployees && data.firedEmployees.length > 0) {
            mergedData.firedEmployees = data.firedEmployees;
            needsWriteBack = true;
          }

          if (needsWriteBack) {
            await saveDataToSheets(token, sheetId, mergedData);
          }

          saveLocalData(mergedData);
          await pushDataToServer(mergedData, sheetId);
          setSyncStatus('synced');
        } else {
          // Fallback if load returns null
          await saveDataToSheets(token, sheetId, data);
          await pushDataToServer(data, sheetId);
          setSyncStatus('synced');
        }
      } else {
        // It's a brand new spreadsheet: write our template/seed data
        await saveDataToSheets(token, sheetId, data);
        await pushDataToServer(data, sheetId);
        setSyncStatus('synced');
      }
    } catch (err: any) {
      console.error('Google Connection Error:', err);
      const isAuthError = err.message && (
        err.message.includes('сесії Google закінчився') || 
        err.message.includes('401') || 
        err.message.includes('Unauthorized')
      );

      if (isAuthError) {
        localStorage.removeItem('oauth_access_token');
        setAccessToken(null);
        setSpreadsheetId(null);
        setSpreadsheetUrl(null);
        setSyncStatus('offline');
        loadLocalData();
        
        try {
          await logout();
        } catch (logoutErr) {
          console.error('Error during auto-logout:', logoutErr);
        }
        setUser(null);

        setErrorMessage('Термін дії сесії Google закінчився. Будь ласка, увійдіть знову для відновлення синхронізації.');
      } else {
        setErrorMessage('Помилка синхронізації з Google Sheets: ' + err.message);
        setSyncStatus('error');
        loadLocalData(); // Fallback to local
      }
    } finally {
      setIsLoading(false);
    }
  };

  const [customUrlInput, setCustomUrlInput] = useState('');
  const [showCustomSheetModal, setShowCustomSheetModal] = useState(false);

  const handleConnectCustomSheet = async (urlOrId: string) => {
    if (!accessToken) {
      alert('Будь ласка, спочатку увійдіть через Google!');
      return;
    }
    if (!urlOrId.trim()) return;

    // Extract spreadsheet ID from URL if it's a URL
    let targetId = urlOrId.trim();
    const urlMatch = targetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      targetId = urlMatch[1];
    }

    try {
      localStorage.setItem('custom_spreadsheet_id', targetId);
      await handleGoogleConnection(accessToken, targetId);
      setShowCustomSheetModal(false);
      setCustomUrlInput('');
    } catch (err: any) {
      setErrorMessage('Не вдалося підключити вказану таблицю: ' + err.message);
    }
  };

  const handleResetCustomSheet = async () => {
    localStorage.removeItem('custom_spreadsheet_id');
    setSpreadsheetId(null);
    setSpreadsheetUrl(null);
    if (accessToken) {
      await handleGoogleConnection(accessToken);
    }
  };

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestDataRef = useRef<HRSystemData | null>(null);
  const sentNotificationIdsRef = useRef<Set<string>>(new Set());

  const localStorageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to save data either to Cloud or Local Storage with support for functional state updaters
  const persistData = (updatedOrFn: HRSystemData | ((prev: HRSystemData) => HRSystemData)) => {
    setData((prev) => {
      const updated = typeof updatedOrFn === 'function' ? updatedOrFn(prev) : updatedOrFn;
      const defaulted = ensureDefaults(updated);

      latestDataRef.current = defaulted;

      // Asynchronously schedule local storage write so UI updates render in 0ms without main thread lag
      if (localStorageTimeoutRef.current) {
        clearTimeout(localStorageTimeoutRef.current);
      }
      localStorageTimeoutRef.current = setTimeout(() => {
        try {
          const candidatesToStore = (defaulted.candidates || []).map(c => {
            if (c.cvFileContent && !c.cvFileContent.startsWith('[') && !c.cvFileContent.includes('обрізано') && c.cvFileContent.length > 50) {
              saveCvFile(c.id, c.cvFileName || `Резюме_${c.name.split(' ')[0]}.pdf`, c.cvFileContent);
              return { ...c, cvFileContent: '' };
            }
            return c;
          });
          localStorage.setItem('hr_analytics_local_data', JSON.stringify({ ...defaulted, candidates: candidatesToStore }));
        } catch (e) {
          console.error('Failed to save local data:', e);
        }
      }, 150);

      // Schedule central cloud server write (debounced 250ms for seamless multi-device sync)
      setSyncStatus('saving');
      if (serverSaveTimeoutRef.current) {
        clearTimeout(serverSaveTimeoutRef.current);
      }
      serverSaveTimeoutRef.current = setTimeout(() => {
        const d = latestDataRef.current || defaulted;
        pushDataToServer(d);
      }, 250);

      // Google Sheets sync if authenticated with Google
      if (accessToken && spreadsheetId) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
          const dataToSave = latestDataRef.current || defaulted;
          saveDataToSheets(accessToken, spreadsheetId, dataToSave)
            .then(() => setSyncStatus('synced'))
            .catch((err: any) => {
              console.error('Google Sheets Save Error:', err);
              const isAuthError = err.message && (
                err.message.includes('сесії Google закінчився') || 
                err.message.includes('401') || 
                err.message.includes('Unauthorized')
              );

              if (isAuthError) {
                localStorage.removeItem('oauth_access_token');
                setAccessToken(null);
                setSpreadsheetId(null);
                setSpreadsheetUrl(null);
                logout().catch((logoutErr) => console.error('Error during auto-logout:', logoutErr));
                setUser(null);
                setErrorMessage('Термін дії сесії Google закінчився. Будь ласка, увійдіть знову для відновлення синхронізації з Google Sheets.');
              }
            });
        }, 800);
      }

      return defaulted;
    });
  };

  // 3. User Actions: Google Login/Logout & Local Auth
  const handleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setIsLocalAuth(false);
        await handleGoogleConnection(result.accessToken);
      }
    } catch (err: any) {
      console.warn('Google login initial attempt failed, trying direct Google OAuth GIS...', err);
      try {
        const directRes = await directGoogleSignIn();
        if (directRes) {
          setUser(directRes.user);
          setAccessToken(directRes.accessToken);
          setIsLocalAuth(false);
          await handleGoogleConnection(directRes.accessToken);
          return;
        }
      } catch (directErr: any) {
        console.error('Direct Google OAuth login error:', directErr);
        setErrorMessage(directErr.message || err.message || 'Помилка авторизації через Google');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectGoogleDirect = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await directGoogleSignIn(true);
      if (res?.accessToken) {
        setAccessToken(res.accessToken);
        if (res.user) {
          setUser(res.user);
        }
        await handleGoogleConnection(res.accessToken);
      }
    } catch (err: any) {
      console.error('Direct Google OAuth error:', err);
      setErrorMessage('Помилка підключення Google Sheets: ' + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (email: string, pass: string, isRegister: boolean, name?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      let u: User;
      if (isRegister) {
        u = await emailSignUp(email, pass, name);
      } else {
        u = await emailSignIn(email, pass);
      }
      setUser(u);
      setIsLocalAuth(false);
      localStorage.removeItem('hr_local_auth');
      localStorage.removeItem('hr_local_role');

      // Create and register device session
      const devSession: UserSession = {
        deviceId: getOrCreateDeviceId(),
        deviceName: detectDeviceName(),
        user: {
          uid: u.uid,
          email: u.email || email,
          displayName: u.displayName || name || email,
          role: 'HR Менеджер',
          photoURL: u.photoURL || null
        },
        loginTime: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };
      saveActiveSession(devSession);
      setCurrentSession(devSession);
      sendSessionHeartbeat(devSession);
    } catch (err: any) {
      console.error('Email login error:', err);

      let msg = err.message || 'Помилка авторизації';
      if (err.code === 'auth/operation-not-allowed') {
        msg = 'У вашому Firebase проєкті вимкнено авторизацію за Email/паролем. Увімкніть її у Firebase Console (Authentication → Sign-in method) або скористайтесь PIN-кодом (1234).';
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = 'Домен crm-alpha-lake-41.vercel.app не додано в авторизовані домени Firebase Console.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'Невірний email або пароль. Перевірте введені дані або зареєструйте новий акаунт у вкладці "Реєстрація".';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'Користувач з такою електронною поштою вже існує. Перейдіть на вкладку "Вхід".';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Пароль занадто простий (потрібно мінімум 6 символів).';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Некоректний формат електронної пошти.';
      }
      setErrorMessage(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocalLogin = (pinOrPassword: string, roleName: string, remember: boolean): boolean => {
    // Standard PIN is 1234, or accept any PIN/password >= 3 characters
    if (pinOrPassword === '1234' || pinOrPassword.trim().length >= 3) {
      const selectedRole = roleName || 'HR Менеджер';
      setIsLocalAuth(true);
      setLocalRole(selectedRole);
      if (remember) {
        localStorage.setItem('hr_local_auth', 'true');
        localStorage.setItem('hr_local_role', selectedRole);
      }

      // Create and register device session
      const devSession: UserSession = {
        deviceId: getOrCreateDeviceId(),
        deviceName: detectDeviceName(),
        user: {
          uid: 'user-' + Date.now(),
          email: 'mariia.melnyk011@gmail.com',
          displayName: selectedRole,
          role: selectedRole,
          photoURL: null
        },
        loginTime: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };
      saveActiveSession(devSession);
      setCurrentSession(devSession);
      sendSessionHeartbeat(devSession);
      return true;
    }
    return false;
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
      const currentDeviceId = getOrCreateDeviceId();
      fetch(`/api/sessions/${currentDeviceId}`, { method: 'DELETE' }).catch(() => {});
    } catch (err: any) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setAccessToken(null);
      setSpreadsheetId(null);
      setSpreadsheetUrl(null);
      setSyncStatus('offline');
      setIsLocalAuth(false);
      clearActiveSession();
      setCurrentSession(null);
      loadLocalData();
      setIsLoading(false);
    }
  };

  // Forced Manual Sync (Cloud Database + Google Sheets)
  const handleForceSync = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await loadCloudData(false);
      if (accessToken) {
        await handleGoogleConnection(accessToken);
      }
    } catch (err: any) {
      setErrorMessage('Помилка примусової синхронізації: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Record Mutations (Add, Update, Delete)

  // -- Vacancies
  const addVacancy = (v: Omit<Vacancy, 'id' | 'createdAt'> & { createdAt?: string }) => {
    persistData((prev) => {
      const nextIdNum = prev.vacancies.length > 0 ? Math.max(...prev.vacancies.map(item => {
        const parts = item.id.split('-');
        return parseInt(parts[1]) || 0;
      })) + 1 : 1;
      const newVacancy: Vacancy = {
        ...v as any,
        id: `V-${nextIdNum}`,
        priority: v.priority || 'Звичайна',
        createdAt: v.createdAt || new Date().toISOString().split('T')[0]
      };
      return {
        ...prev,
        vacancies: [newVacancy, ...prev.vacancies]
      };
    });
  };

  const updateVacancy = (v: Vacancy) => {
    persistData((prev) => {
      const updatedVacancies = prev.vacancies.map(item => item.id === v.id ? { ...item, ...v, priority: v.priority || 'Звичайна' } : item);
      return {
        ...prev,
        vacancies: updatedVacancies
      };
    });
  };

  const deleteVacancy = (vacancyId: string) => {
    persistData((prev) => ({
      ...prev,
      vacancies: prev.vacancies.filter(v => v.id !== vacancyId)
    }));
  };

  // -- Candidates
  const addCandidate = (c: Omit<Candidate, 'id' | 'appliedAt'>) => {
    let createdCandidate: Candidate | null = null;
    persistData((prev) => {
      const nextIdNum = prev.candidates.length > 0 ? Math.max(...prev.candidates.map(item => {
        const parts = item.id.split('-');
        return parseInt(parts[1]) || 0;
      })) + 1 : 1;
      const newCandidate: Candidate = {
        ...c,
        id: `C-${nextIdNum}`,
        appliedAt: (c as any).appliedAt || getTodayDateTimeString()
      };
      createdCandidate = newCandidate;

      // Auto-create interview if status is "Співбесіда" or "Стажування" and skipAutoInterview is not true
      let updatedInterviews = [...prev.interviews];
      let updatedInterns = [...prev.interns];

      if (newCandidate.status === 'Стажування') {
        // Candidate MUST appear in interviews
        const intExists = updatedInterviews.some(i => i.candidateId === newCandidate.id);
        if (!intExists) {
          const nextIntIdNum = updatedInterviews.length > 0 ? Math.max(...updatedInterviews.map(item => {
            const parts = item.id.split('-');
            return parseInt(parts[1]) || 0;
          })) + 1 : 1;

          updatedInterviews.unshift({
            id: `I-${nextIntIdNum}`,
            candidateId: newCandidate.id,
            candidateName: newCandidate.name,
            dateTime: (c as any).interviewDateTime || new Date().toISOString().slice(0, 16),
            interviewer: (c as any).interviewInterviewer || 'HR Менеджер',
            feedback: newCandidate.comment || 'Зараховано на стажування',
            rating: newCandidate.rating || 4,
            status: 'Завершено',
            result: 'Перейшов на стажування'
          });
        }

        // Candidate MUST appear in interns
        const nextInternIdNum = updatedInterns.length > 0 ? Math.max(...updatedInterns.map(item => {
          const parts = item.id.split('-');
          return parseInt(parts[1]) || 0;
        })) + 1 : 1;
        const matchedVacancy = prev.vacancies.find(v => v.id === newCandidate.vacancyId);
        const todayStr = new Date().toISOString().split('T')[0];

        updatedInterns.unshift({
          id: `IN-${nextInternIdNum}`,
          candidateId: newCandidate.id,
          candidateName: newCandidate.name,
          birthDate: newCandidate.birthDate || '',
          phone: newCandidate.phone || '',
          position: matchedVacancy?.title || 'Стажер',
          department: matchedVacancy?.department || 'Загальний',
          startDate: todayStr,
          endDate: '',
          mentor: (c as any).mentor || 'Наставник',
          project: 'Програма стажування та онбордингу',
          progress: 0,
          status: 'Триває',
          rating: newCandidate.rating || 4,
          comment: newCandidate.comment || '',
          hasDocuments: Boolean(newCandidate.hasDocuments)
        });
      } else if (newCandidate.status === 'Співбесіда з керівником') {
        const intExists = updatedInterviews.some(i => i.candidateId === newCandidate.id);
        if (!intExists) {
          const nextIntIdNum = updatedInterviews.length > 0 ? Math.max(...updatedInterviews.map(item => {
            const parts = item.id.split('-');
            return parseInt(parts[1]) || 0;
          })) + 1 : 1;

          updatedInterviews.unshift({
            id: `I-${nextIntIdNum}`,
            candidateId: newCandidate.id,
            candidateName: newCandidate.name,
            dateTime: (c as any).interviewDateTime || new Date(Date.now() + 86400000).toISOString().slice(0, 16),
            interviewer: (c as any).interviewInterviewer || 'Керівник підрозділу',
            feedback: newCandidate.comment || '',
            rating: newCandidate.rating || 4,
            status: 'Заплановано',
            result: 'Співбесіда з керівником'
          });
        }
      } else if (newCandidate.status === 'Співбесіда' && !(c as any).skipAutoInterview) {
        const interviewExists = updatedInterviews.some(i => i.candidateId === newCandidate.id);
        if (!interviewExists) {
          const nextIntIdNum = updatedInterviews.length > 0 ? Math.max(...updatedInterviews.map(item => {
            const parts = item.id.split('-');
            return parseInt(parts[1]) || 0;
          })) + 1 : 1;
          
          const customDateTime = (c as any).interviewDateTime || new Date(Date.now() + 86400000).toISOString().slice(0, 16);
          const customInterviewer = (c as any).interviewInterviewer || '';

          updatedInterviews.unshift({
            id: `I-${nextIntIdNum}`,
            candidateId: newCandidate.id,
            candidateName: newCandidate.name,
            dateTime: customDateTime,
            interviewer: customInterviewer,
            feedback: '',
            rating: 3,
            status: 'Заплановано',
            result: 'Очікує рішення'
          });
        }
      }

      return {
        ...prev,
        candidates: [newCandidate, ...prev.candidates],
        interviews: updatedInterviews,
        interns: updatedInterns
      };
    });
    return createdCandidate!;
  };

  const updateCandidate = (c: Candidate) => {
    persistData((prev) => {
      const updatedCandidates = prev.candidates.map(item => item.id === c.id ? c : item);
      
      let updatedInterviews = [...prev.interviews];
      let updatedInterns = [...prev.interns];

      if (c.status === 'Стажування') {
        // 1. Candidate MUST appear in interviews with successful result
        const interviewIndex = updatedInterviews.findIndex(i => 
          i.candidateId === c.id || 
          (i.candidateName && i.candidateName.trim().toLowerCase() === c.name.trim().toLowerCase())
        );

        if (interviewIndex !== -1) {
          const existingInt = updatedInterviews[interviewIndex];
          updatedInterviews[interviewIndex] = {
            ...existingInt,
            candidateName: c.name,
            status: 'Завершено',
            result: existingInt.result === 'Співбесіда пройшла успішно' ? existingInt.result : 'Перейшов на стажування'
          };
        } else {
          const nextIntIdNum = updatedInterviews.length > 0 ? Math.max(...updatedInterviews.map(item => {
            const parts = item.id.split('-');
            return parseInt(parts[1]) || 0;
          })) + 1 : 1;

          updatedInterviews.unshift({
            id: `I-${nextIntIdNum}`,
            candidateId: c.id,
            candidateName: c.name,
            dateTime: (c as any).interviewDateTime || new Date().toISOString().slice(0, 16),
            interviewer: (c as any).interviewInterviewer || 'HR Менеджер',
            feedback: c.comment || 'Зараховано на стажування',
            rating: c.rating || 4,
            status: 'Завершено',
            result: 'Перейшов на стажування'
          });
        }

        // 2. Candidate MUST appear in interns
        const internIndex = updatedInterns.findIndex(item => 
          item.candidateId === c.id || 
          (item.candidateName && item.candidateName.trim().toLowerCase() === c.name.trim().toLowerCase())
        );

        const matchedVacancy = prev.vacancies.find(v => v.id === c.vacancyId);
        const todayStr = new Date().toISOString().split('T')[0];

        const internStartDateVal = (c as any).internStartDate ? formatDateForInput((c as any).internStartDate) : '';
        const candidateDateVal = c.contactDate ? formatDateForInput(c.contactDate) : '';
        const effectiveStartDate = internStartDateVal || candidateDateVal || todayStr;

        if (internIndex !== -1) {
          const existing = updatedInterns[internIndex];
          updatedInterns[internIndex] = {
            ...existing,
            candidateName: c.name,
            phone: c.phone || existing.phone,
            birthDate: c.birthDate || existing.birthDate,
            position: matchedVacancy?.title || existing.position || 'Стажер',
            department: matchedVacancy?.department || existing.department || 'Загальний',
            hasDocuments: c.hasDocuments !== undefined ? c.hasDocuments : existing.hasDocuments,
            status: existing.status === 'Не пройшов' ? 'Триває' : existing.status,
            startDate: internStartDateVal || existing.startDate || effectiveStartDate
          };
        } else {
          const nextInternIdNum = updatedInterns.length > 0 ? Math.max(...updatedInterns.map(item => {
            const parts = item.id.split('-');
            return parseInt(parts[1]) || 0;
          })) + 1 : 1;

          const newIntern: Intern = {
            id: `IN-${nextInternIdNum}`,
            candidateId: c.id,
            candidateName: c.name,
            birthDate: c.birthDate || '',
            phone: c.phone || '',
            position: matchedVacancy?.title || 'Стажер',
            department: matchedVacancy?.department || 'Загальний',
            startDate: effectiveStartDate,
            endDate: '',
            mentor: (c as any).mentor || 'Наставник',
            project: 'Програма стажування та онбордингу',
            progress: 0,
            status: 'Триває',
            rating: c.rating || 4,
            comment: c.comment || '',
            hasDocuments: Boolean(c.hasDocuments)
          };
          updatedInterns = [newIntern, ...updatedInterns];
        }
      } else if (c.status === 'Співбесіда з керівником') {
        const interviewIndex = updatedInterviews.findIndex(i => 
          i.candidateId === c.id || 
          (i.candidateName && i.candidateName.trim().toLowerCase() === c.name.trim().toLowerCase())
        );

        if (interviewIndex !== -1) {
          // Update existing interview in place - NO DUPLICATE!
          const existingInt = updatedInterviews[interviewIndex];
          updatedInterviews[interviewIndex] = {
            ...existingInt,
            candidateName: c.name,
            result: 'Співбесіда з керівником'
          };
        } else {
          // Single interview record
          const nextIntIdNum = updatedInterviews.length > 0 ? Math.max(...updatedInterviews.map(item => {
            const parts = item.id.split('-');
            return parseInt(parts[1]) || 0;
          })) + 1 : 1;

          updatedInterviews.unshift({
            id: `I-${nextIntIdNum}`,
            candidateId: c.id,
            candidateName: c.name,
            dateTime: (c as any).interviewDateTime || new Date(Date.now() + 86400000).toISOString().slice(0, 16),
            interviewer: (c as any).interviewInterviewer || 'Керівник підрозділу',
            feedback: '',
            rating: 3,
            status: 'Заплановано',
            result: 'Співбесіда з керівником'
          });
        }

        // Sync name/docs to any interns
        updatedInterns = updatedInterns.map(i => i.candidateId === c.id ? {
          ...i,
          candidateName: c.name,
          hasDocuments: c.hasDocuments !== undefined ? c.hasDocuments : i.hasDocuments
        } : i);
      } else if (c.status === 'Співбесіда') {
        const interviewIndex = updatedInterviews.findIndex(i => i.candidateId === c.id);
        const customDateTime = (c as any).interviewDateTime;
        const customInterviewer = (c as any).interviewInterviewer;

        if (interviewIndex === -1) {
          const nextIntIdNum = updatedInterviews.length > 0 ? Math.max(...updatedInterviews.map(item => {
            const parts = item.id.split('-');
            return parseInt(parts[1]) || 0;
          })) + 1 : 1;
          
          updatedInterviews.unshift({
            id: `I-${nextIntIdNum}`,
            candidateId: c.id,
            candidateName: c.name,
            dateTime: customDateTime || new Date(Date.now() + 86400000).toISOString().slice(0, 16),
            interviewer: customInterviewer || 'Рекрутер',
            feedback: '',
            rating: 3,
            status: 'Заплановано',
            result: 'Очікує рішення'
          });
        } else {
          updatedInterviews[interviewIndex] = {
            ...updatedInterviews[interviewIndex],
            candidateName: c.name,
            dateTime: customDateTime || updatedInterviews[interviewIndex].dateTime,
            interviewer: customInterviewer || updatedInterviews[interviewIndex].interviewer
          };
        }

        // Sync name/docs to any interns
        updatedInterns = updatedInterns.map(i => i.candidateId === c.id ? {
          ...i,
          candidateName: c.name,
          hasDocuments: c.hasDocuments !== undefined ? c.hasDocuments : i.hasDocuments
        } : i);
      } else {
        // Sync candidate name to any interviews
        updatedInterviews = updatedInterviews.map(i => i.candidateId === c.id ? {
          ...i,
          candidateName: c.name
        } : i);

        // Sync candidate name and documents to any interns, OR remove if moved to 'Резерв'
        if (c.status === 'Резерв') {
          updatedInterns = updatedInterns.filter(item => 
            item.candidateId !== c.id && 
            item.candidateName?.trim().toLowerCase() !== c.name.trim().toLowerCase()
          );
        } else {
          updatedInterns = updatedInterns.map(i => i.candidateId === c.id ? {
            ...i,
            candidateName: c.name,
            hasDocuments: c.hasDocuments !== undefined ? c.hasDocuments : i.hasDocuments
          } : i);
        }
      }

      return {
        ...prev,
        candidates: updatedCandidates,
        interviews: updatedInterviews,
        interns: updatedInterns
      };
    });
  };

  const deleteCandidate = (candidateId: string) => {
    persistData((prev) => ({
      ...prev,
      candidates: prev.candidates.filter(c => c.id !== candidateId)
    }));
  };

  // -- Interviews
  const addInterview = (i: Omit<Interview, 'id'>) => {
    persistData((prev) => {
      // Check if interview already exists for this candidate
      const existingIndex = prev.interviews.findIndex(item => 
        (i.candidateId && item.candidateId === i.candidateId) ||
        (i.candidateName && item.candidateName && item.candidateName.trim().toLowerCase() === i.candidateName.trim().toLowerCase())
      );

      let updatedInterviews = [...prev.interviews];
      let finalInterview: Interview;

      if (existingIndex !== -1) {
        // Update the existing card! All changes happen in the same card - no duplicate!
        const existing = prev.interviews[existingIndex];
        finalInterview = {
          ...existing,
          ...i,
          id: existing.id,
          candidateName: i.candidateName || existing.candidateName,
          dateTime: i.dateTime || existing.dateTime,
          interviewer: i.interviewer || existing.interviewer,
          feedback: i.feedback !== undefined ? i.feedback : existing.feedback,
          rating: i.rating !== undefined ? i.rating : existing.rating,
          status: i.status || existing.status,
          result: i.result || existing.result,
          rejectionReason: i.rejectionReason !== undefined ? i.rejectionReason : existing.rejectionReason,
          managerName: i.managerName || existing.managerName,
          managerInterviewDate: i.managerInterviewDate || existing.managerInterviewDate
        };
        updatedInterviews[existingIndex] = finalInterview;
      } else {
        const nextIdNum = prev.interviews.length > 0 ? Math.max(...prev.interviews.map(item => {
          const parts = item.id.split('-');
          return parseInt(parts[1]) || 0;
        })) + 1 : 1;
        finalInterview = {
          ...i,
          id: `I-${nextIdNum}`
        };
        updatedInterviews.unshift(finalInterview);
      }

      let updatedCandidates = prev.candidates.map(candidate => {
        if (candidate.id === finalInterview.candidateId || (candidate.name && finalInterview.candidateName && candidate.name.trim().toLowerCase() === finalInterview.candidateName.trim().toLowerCase())) {
          let newStatus = candidate.status;
          let rejectionReason = candidate.rejectionReason;

          // Auto-sync candidate status
          if (finalInterview.status === 'Не прийшов' || finalInterview.status === 'Скасовано') {
            newStatus = 'Відмова компанії';
            rejectionReason = finalInterview.rejectionReason || (finalInterview.status === 'Не прийшов' ? 'Не прийшов на співбесіду' : 'Співбесіду скасовано');
          } else if (finalInterview.result === 'Співбесіда з керівником') {
            newStatus = 'Співбесіда з керівником';
          } else if (finalInterview.result === 'Перейшов на стажування' || finalInterview.result === 'Співбесіда пройшла успішно') {
            newStatus = 'Стажування';
          } else if (finalInterview.result === 'Відмова кандидата') {
            newStatus = 'Відмова кандидата';
            rejectionReason = finalInterview.rejectionReason || 'Кандидат відмовився';
          } else if (finalInterview.result === 'Відмова компанії' || finalInterview.result === 'Співбесіда не відбулася') {
            newStatus = 'Відмова компанії';
            rejectionReason = finalInterview.rejectionReason || finalInterview.result;
          } else if (finalInterview.result === 'Подумає') {
            newStatus = 'Подумає';
          } else if (finalInterview.result === 'Резерв' || finalInterview.result?.toLowerCase().includes('резерв')) {
            newStatus = 'Резерв';
          } else if (candidate.status === 'Новий' || (finalInterview.status === 'Заплановано' && candidate.status !== 'Співбесіда з керівником' && candidate.status !== 'Стажування')) {
            newStatus = 'Співбесіда';
          }
          
          let newComment = candidate.comment;
          if (finalInterview.feedback && !newComment) {
            newComment = finalInterview.feedback;
          }

          const isRejected = newStatus === 'Відмова компанії' || newStatus === 'Відмова кандидата' || newStatus === 'Відхилено';
          return {
            ...candidate,
            status: newStatus,
            rejectionReason: isRejected ? (rejectionReason || 'Не пройшов співбесіду') : '',
            comment: newComment
          };
        }
        return candidate;
      });

      // Sync to interns if passed to internship (or remove if in reserve)
      let updatedInterns = [...prev.interns];
      const isReserve = finalInterview.result === 'Резерв' || finalInterview.result?.toLowerCase().includes('резерв');
      if (isReserve) {
        updatedInterns = updatedInterns.filter(in_ => in_.candidateId !== finalInterview.candidateId);
      }
      const isInternship = !isReserve && (
        (finalInterview.status === 'Завершено' && (finalInterview.result === 'Перейшов на стажування' || finalInterview.result === 'Співбесіда пройшла успішно')) ||
        updatedCandidates.some(c => (c.id === finalInterview.candidateId || (c.name && finalInterview.candidateName && c.name.trim().toLowerCase() === finalInterview.candidateName.trim().toLowerCase())) && c.status === 'Стажування')
      );
      if (isInternship) {
        const targetCand = updatedCandidates.find(c => c.id === finalInterview.candidateId || (c.name && finalInterview.candidateName && c.name.trim().toLowerCase() === finalInterview.candidateName.trim().toLowerCase()));
        if (targetCand && targetCand.status !== 'Резерв') {
          const internIndex = updatedInterns.findIndex(in_ => in_.candidateId === targetCand.id || (in_.candidateName && targetCand.name && in_.candidateName.trim().toLowerCase() === targetCand.name.trim().toLowerCase()));
          const targetVacancy = prev.vacancies.find(v => v.id === targetCand.vacancyId);
          if (internIndex !== -1) {
            const existingIn = updatedInterns[internIndex];
            updatedInterns[internIndex] = {
              ...existingIn,
              candidateName: targetCand.name,
              phone: targetCand.phone || existingIn.phone,
              birthDate: targetCand.birthDate || existingIn.birthDate,
              position: targetVacancy?.title || existingIn.position || 'Стажер',
              department: targetVacancy?.department || existingIn.department || 'Загальний',
              hasDocuments: targetCand.hasDocuments !== undefined ? targetCand.hasDocuments : existingIn.hasDocuments
            };
          } else {
            const nextInternIdNum = updatedInterns.length > 0 ? Math.max(...updatedInterns.map(item => {
              const parts = item.id.split('-');
              return parseInt(parts[1]) || 0;
            })) + 1 : 1;
            updatedInterns.unshift({
              id: `IN-${nextInternIdNum}`,
              candidateId: targetCand.id,
              candidateName: targetCand.name,
              birthDate: targetCand.birthDate || '',
              phone: targetCand.phone || '',
              position: targetVacancy?.title || 'Стажер',
              department: targetVacancy?.department || 'Основний',
              startDate: new Date().toISOString().split('T')[0],
              endDate: '',
              mentor: finalInterview.interviewer || 'HR Менеджер',
              project: 'Випробувальний термін',
              progress: 0,
              status: 'Триває',
              rating: finalInterview.rating || targetCand.rating || 3,
              comment: finalInterview.feedback ? `Перейшов зі співбесіди: ${finalInterview.feedback}` : (targetCand.comment || 'Зараховано на стажування'),
              hasDocuments: targetCand.hasDocuments || false
            });
          }
        }
      }

      return {
        ...prev,
        interviews: updatedInterviews,
        candidates: updatedCandidates,
        interns: updatedInterns
      };
    });
  };

  const updateInterview = (i: Interview) => {
    persistData((prev) => {
      // Automatically update candidate based on interview results
      const updatedCandidates = prev.candidates.map(candidate => {
        if (candidate.id === i.candidateId) {
          let newStatus = candidate.status;
          let rejectionReason = candidate.rejectionReason;
          
          if (i.status === 'Не прийшов' || i.status === 'Скасовано') {
            newStatus = 'Відмова компанії';
            rejectionReason = i.rejectionReason || (i.status === 'Не прийшов' ? 'Не прийшов на співбесіду' : 'Співбесіду скасовано');
          } else if (i.status === 'Завершено' || i.status === 'Зворотний зв\'язок') {
            if (i.result === 'Співбесіда з керівником') {
              newStatus = 'Співбесіда з керівником';
            } else if (i.result === 'Перейшов на стажування' || i.result === 'Співбесіда пройшла успішно') {
              newStatus = 'Стажування';
            } else if (i.result === 'Відмова кандидата') {
              newStatus = 'Відмова кандидата';
              rejectionReason = i.rejectionReason || 'Кандидат відмовився';
            } else if (i.result === 'Відмова компанії' || i.result === 'Співбесіда не відбулася') {
              newStatus = 'Відмова компанії';
              rejectionReason = i.rejectionReason || i.result;
            } else if (i.result === 'Подумає') {
              newStatus = 'Подумає';
            } else if (i.result === 'Резерв' || i.result?.toLowerCase().includes('резерв')) {
              newStatus = 'Резерв';
            }
          }
          
          let newComment = candidate.comment;
          if (i.feedback && !newComment) {
            newComment = i.feedback;
          }

          const isRejected = newStatus === 'Відмова компанії' || newStatus === 'Відмова кандидата' || newStatus === 'Відхилено';
          return {
            ...candidate,
            status: newStatus,
            rejectionReason: isRejected ? (rejectionReason || 'Не пройшов співбесіду') : '',
            comment: newComment
          };
        }
        return candidate;
      });

      // Sync to interns if passed to internship (or remove if in reserve)
      let updatedInterns = [...prev.interns];
      const isReserve = i.result === 'Резерв' || i.result?.toLowerCase().includes('резерв');
      if (isReserve) {
        updatedInterns = updatedInterns.filter(in_ => in_.candidateId !== i.candidateId);
      }
      const isInternship = !isReserve && (i.status === 'Завершено' && (i.result === 'Перейшов на стажування' || i.result === 'Співбесіда пройшла успішно'));
      if (isInternship) {
        const targetCand = updatedCandidates.find(c => c.id === i.candidateId);
        if (targetCand && targetCand.status !== 'Резерв') {
          const internExists = updatedInterns.some(in_ => in_.candidateId === i.candidateId);
          if (!internExists) {
            const nextInternIdNum = updatedInterns.length > 0 ? Math.max(...updatedInterns.map(item => {
              const parts = item.id.split('-');
              return parseInt(parts[1]) || 0;
            })) + 1 : 1;
            const targetVacancy = prev.vacancies.find(v => v.id === targetCand.vacancyId);
            updatedInterns.unshift({
              id: `IN-${nextInternIdNum}`,
              candidateId: targetCand.id,
              candidateName: targetCand.name,
              birthDate: targetCand.birthDate || '',
              phone: targetCand.phone || '',
              position: targetVacancy?.title || 'Посада',
              department: targetVacancy?.department || 'Основний',
              startDate: new Date().toISOString().split('T')[0],
              endDate: '',
              mentor: i.interviewer || 'HR Менеджер',
              project: 'Випробувальний термін',
              progress: 0,
              status: 'Триває',
              rating: i.rating || 3,
              comment: i.feedback ? `Перейшов зі співбесіди: ${i.feedback}` : 'Перейшов зі співбесіди',
              hasDocuments: targetCand.hasDocuments || false
            });
          }
        }
      }

      return {
        ...prev,
        interviews: prev.interviews.map(item => item.id === i.id ? i : item),
        candidates: updatedCandidates,
        interns: updatedInterns
      };
    });
  };

  const deleteInterview = (interviewId: string) => {
    persistData((prev) => ({
      ...prev,
      interviews: prev.interviews.filter(i => i.id !== interviewId)
    }));
  };

  // -- Interns
  const addIntern = (in_: Omit<Intern, 'id'>) => {
    persistData((prev) => {
      const cand = prev.candidates.find(c => c.id === in_.candidateId || (c.name && in_.candidateName && c.name.trim().toLowerCase() === in_.candidateName.trim().toLowerCase()));
      const safeCandidateName = in_.candidateName?.trim() || cand?.name || 'Стажер';
      const normalizedStartDate = formatDateForInput(in_.startDate) || in_.startDate || getTodayDateString();
      const normalizedEndDate = formatDateForInput(in_.endDate) || in_.endDate || '';
      const safeIn = {
        ...in_,
        candidateName: safeCandidateName,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate
      };

      const existingIndex = prev.interns.findIndex(item => 
        (in_.candidateId && item.candidateId === in_.candidateId) ||
        (item.candidateName && safeCandidateName && item.candidateName.trim().toLowerCase() === safeCandidateName.trim().toLowerCase())
      );
      let updatedInternsList: Intern[];
      if (existingIndex !== -1) {
        updatedInternsList = prev.interns.map((item, idx) => idx === existingIndex ? { ...item, ...safeIn, id: item.id } : item);
      } else {
        const nextIdNum = prev.interns.length > 0 ? Math.max(...prev.interns.map(item => {
          const parts = item.id.split('-');
          return parseInt(parts[1]) || 0;
        })) + 1 : 1;
        const newIntern: Intern = {
          ...safeIn,
          id: `IN-${nextIdNum}`
        };
        updatedInternsList = [newIntern, ...prev.interns];
      }
      
      // Sync candidate status & document status back to candidate
      const updatedCandidates = prev.candidates.map(c => {
        const matchesCand = (in_.candidateId && c.id === in_.candidateId) || 
          (c.name && safeCandidateName && c.name.trim().toLowerCase() === safeCandidateName.trim().toLowerCase());

        if (matchesCand) {
          let newStatus = c.status;
          let rejectionReason = c.rejectionReason;
          
          if (in_.status === 'Триває') {
            newStatus = 'Стажування';
          } else if (in_.status === 'Не пройшов') {
            newStatus = 'Відмова компанії';
            rejectionReason = in_.rejectionReason || 'Не пройшов стажування';
          } else if (in_.status === 'Відмовився') {
            newStatus = 'Відмова кандидата';
            rejectionReason = in_.rejectionReason || 'Відмовився від стажування';
          }
          
          const isRejected = newStatus === 'Відмова компанії' || newStatus === 'Відмова кандидата' || newStatus === 'Відхилено';
          return {
            ...c,
            status: newStatus,
            rejectionReason: isRejected ? rejectionReason : '',
            hasDocuments: in_.hasDocuments,
            contactDate: c.contactDate || normalizedStartDate
          };
        }
        return c;
      });

      return {
        ...prev,
        candidates: updatedCandidates,
        interns: updatedInternsList
      };
    });
  };

  const updateIntern = (in_: Intern) => {
    persistData((prev) => {
      const cand = prev.candidates.find(c => c.id === in_.candidateId || (c.name && in_.candidateName && c.name.trim().toLowerCase() === in_.candidateName.trim().toLowerCase()));
      const safeCandidateName = in_.candidateName?.trim() || cand?.name || in_.candidateName || 'Стажер';
      const normalizedStartDate = formatDateForInput(in_.startDate) || in_.startDate;
      const normalizedEndDate = formatDateForInput(in_.endDate) || in_.endDate || '';
      const safeIn = {
        ...in_,
        candidateName: safeCandidateName,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate
      };

      // Sync candidate status & document status back to candidate
      const updatedCandidates = prev.candidates.map(c => {
        const matchesCand = (in_.candidateId && c.id === in_.candidateId) || 
          (c.name && safeCandidateName && c.name.trim().toLowerCase() === safeCandidateName.trim().toLowerCase());

        if (matchesCand) {
          let newStatus = c.status;
          let rejectionReason = c.rejectionReason;
          
          if (in_.status === 'Триває') {
            newStatus = 'Стажування';
          } else if (in_.status === 'Не пройшов') {
            newStatus = 'Відмова компанії';
            rejectionReason = in_.rejectionReason || 'Не пройшов стажування';
          } else if (in_.status === 'Відмовився') {
            newStatus = 'Відмова кандидата';
            rejectionReason = in_.rejectionReason || 'Відмовився від стажування';
          } else if (in_.status === 'Успішно завершено') {
            newStatus = 'Працевлаштовано';
          }
          
          const isRejected = newStatus === 'Відмова компанії' || newStatus === 'Відмова кандидата' || newStatus === 'Відхилено';
          return {
            ...c,
            status: newStatus,
            rejectionReason: isRejected ? rejectionReason : '',
            hasDocuments: in_.hasDocuments,
            contactDate: c.contactDate || normalizedStartDate
          };
        }
        return c;
      });

      // Synchronize candidate name in interviews if candidate name was updated (do not corrupt interview dates)
      const updatedInterviews = prev.interviews.map(inv => {
        const matchesCand = (in_.candidateId && inv.candidateId === in_.candidateId) || 
          (inv.candidateName && safeCandidateName && inv.candidateName.trim().toLowerCase() === safeCandidateName.trim().toLowerCase());
        if (matchesCand) {
          return {
            ...inv,
            candidateName: safeCandidateName
          };
        }
        return inv;
      });

      return {
        ...prev,
        candidates: updatedCandidates,
        interviews: updatedInterviews,
        interns: prev.interns.map(item => item.id === in_.id ? safeIn : item)
      };
    });
  };

  const deleteIntern = (internId: string) => {
    persistData((prev) => {
      const internToDelete = prev.interns.find(i => i.id === internId);
      const updatedCandidates = prev.candidates.map(c => {
        const matchesCand = internToDelete && (
          (internToDelete.candidateId && c.id === internToDelete.candidateId) ||
          (c.name && internToDelete.candidateName && c.name.trim().toLowerCase() === internToDelete.candidateName.trim().toLowerCase())
        );
        if (matchesCand) {
          if (c.status === 'Стажування') {
            return {
              ...c,
              status: 'Відмова компанії' as CandidateStatus,
              rejectionReason: 'Видалено зі списку стажерів'
            };
          }
        }
        return c;
      });

      return {
        ...prev,
        candidates: updatedCandidates,
        interns: prev.interns.filter(i => i.id !== internId)
      };
    });
  };

  // -- Fired Employees
  const addFiredEmployee = (f: Omit<FiredEmployee, 'id'>) => {
    const tenureMonths = calculateTenureMonths(f.startDate, f.endDate);
    const newFired: FiredEmployee = {
      ...f,
      tenureMonths,
      id: `F-${Date.now()}`
    };
    persistData((prev) => ({
      ...prev,
      firedEmployees: [...(prev.firedEmployees || []), newFired]
    }));
  };

  const deleteFiredEmployee = (employeeId: string) => {
    persistData((prev) => ({
      ...prev,
      firedEmployees: (prev.firedEmployees || []).filter(f => f.id !== employeeId)
    }));
  };

  const updateFiredEmployee = (employee: FiredEmployee) => {
    const tenureMonths = calculateTenureMonths(employee.startDate, employee.endDate);
    const updatedEmployee = { ...employee, tenureMonths };
    persistData((prev) => ({
      ...prev,
      firedEmployees: (prev.firedEmployees || []).map(f => f.id === employee.id ? updatedEmployee : f)
    }));
  };

  // -- Calendar Events
  const addCalendarEvent = (event: Omit<CalendarEvent, 'id'>) => {
    const nextId = `E-${Date.now()}`;
    const newEvent: CalendarEvent = {
      ...event,
      id: nextId
    };
    persistData((prev) => ({
      ...prev,
      calendarEvents: [newEvent, ...(prev.calendarEvents || [])]
    }));
  };

  const updateCalendarEvent = (event: CalendarEvent) => {
    if (event.id.startsWith('interview-')) {
      const interviewId = event.id.replace('interview-', '');
      const existingInterview = data.interviews.find(i => i.id === interviewId);
      if (existingInterview) {
        const updatedInterview = {
          ...existingInterview,
          dateTime: event.dateTime,
          feedback: event.description || existingInterview.feedback
        };
        updateInterview(updatedInterview);
      }
    } else {
      persistData((prev) => ({
        ...prev,
        calendarEvents: (prev.calendarEvents || []).map(item => item.id === event.id ? event : item)
      }));
    }
  };

  const deleteCalendarEvent = (eventId: string) => {
    if (eventId.startsWith('interview-')) {
      const interviewId = eventId.replace('interview-', '');
      deleteInterview(interviewId);
    } else {
      persistData((prev) => ({
        ...prev,
        calendarEvents: (prev.calendarEvents || []).filter(item => item.id !== eventId)
      }));
    }
  };

  // -- Custom Positions / Departments
  const addPosition = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const currentList = data.positionsList || DEFAULT_POSITIONS;
    if (currentList.some(p => p.trim().toLowerCase() === clean.toLowerCase())) return;
    const updated = {
      ...data,
      positionsList: [...currentList, clean]
    };
    persistData(updated);
  };

  const renamePosition = (oldName: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || clean === oldName) return;
    const currentList = data.positionsList || DEFAULT_POSITIONS;
    const updated = {
      ...data,
      positionsList: currentList.map(p => p === oldName ? clean : p),
      vacancies: data.vacancies.map(v => v.title === oldName ? { ...v, title: clean } : v),
      interns: data.interns.map(i => i.position === oldName ? { ...i, position: clean } : i),
      firedEmployees: data.firedEmployees.map(f => f.position === oldName ? { ...f, position: clean } : f)
    };
    persistData(updated);
  };

  const deletePosition = (name: string) => {
    const currentList = data.positionsList || DEFAULT_POSITIONS;
    const updated = {
      ...data,
      positionsList: currentList.filter(p => p !== name)
    };
    persistData(updated);
  };

  const addDepartment = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const currentList = data.departmentsList || DEFAULT_DEPARTMENTS;
    if (currentList.some(d => d.trim().toLowerCase() === clean.toLowerCase())) return;
    const updated = {
      ...data,
      departmentsList: [...currentList, clean]
    };
    persistData(updated);
  };

  const renameDepartment = (oldName: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || clean === oldName) return;
    const currentList = data.departmentsList || DEFAULT_DEPARTMENTS;
    const updated = {
      ...data,
      departmentsList: currentList.map(d => d === oldName ? clean : d),
      vacancies: data.vacancies.map(v => v.department === oldName ? { ...v, department: clean } : v),
      interns: data.interns.map(i => i.department === oldName ? { ...i, department: clean } : i),
      firedEmployees: data.firedEmployees.map(f => f.department === oldName ? { ...f, department: clean } : f)
    };
    persistData(updated);
  };

  const deleteDepartment = (name: string) => {
    const currentList = data.departmentsList || DEFAULT_DEPARTMENTS;
    const updated = {
      ...data,
      departmentsList: currentList.filter(d => d !== name)
    };
    persistData(updated);
  };

  const addStage = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const currentList = data.stagesList || DEFAULT_STAGES;
    if (currentList.some(s => s.trim().toLowerCase() === clean.toLowerCase())) return;
    const updated = {
      ...data,
      stagesList: [...currentList, clean]
    };
    persistData(updated);
  };

  const renameStage = (oldName: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || clean === oldName) return;
    const currentList = data.stagesList || DEFAULT_STAGES;
    const updated = {
      ...data,
      stagesList: currentList.map(s => s === oldName ? clean : s),
      candidates: data.candidates.map(c => c.status === oldName ? { ...c, status: clean as any } : c)
    };
    persistData(updated);
  };

  const deleteStage = (name: string) => {
    const currentList = data.stagesList || DEFAULT_STAGES;
    const updated = {
      ...data,
      stagesList: currentList.filter(s => s !== name)
    };
    persistData(updated);
  };

  const addSource = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const currentList = data.sourcesList || DEFAULT_SOURCES;
    if (currentList.some(s => s.trim().toLowerCase() === clean.toLowerCase())) return;
    const updated = {
      ...data,
      sourcesList: [...currentList, clean]
    };
    persistData(updated);
  };

  const renameSource = (oldName: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || clean === oldName) return;
    const currentList = data.sourcesList || DEFAULT_SOURCES;
    const updated = {
      ...data,
      sourcesList: currentList.map(s => s === oldName ? clean : s),
      candidates: data.candidates.map(c => c.source === oldName ? { ...c, source: clean } : c)
    };
    persistData(updated);
  };

  const deleteSource = (name: string) => {
    const currentList = data.sourcesList || DEFAULT_SOURCES;
    const updated = {
      ...data,
      sourcesList: currentList.filter(s => s !== name)
    };
    persistData(updated);
  };

  const addInterviewStatus = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const currentList = data.interviewStatusesList || DEFAULT_INTERVIEW_STATUSES;
    if (currentList.some(s => s.trim().toLowerCase() === clean.toLowerCase())) return;
    const updated = {
      ...data,
      interviewStatusesList: [...currentList, clean]
    };
    persistData(updated);
  };

  const renameInterviewStatus = (oldName: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || clean === oldName) return;
    const currentList = data.interviewStatusesList || DEFAULT_INTERVIEW_STATUSES;
    const updated = {
      ...data,
      interviewStatusesList: currentList.map(s => s === oldName ? clean : s),
      interviews: data.interviews.map(i => i.status === oldName ? { ...i, status: clean as any } : i)
    };
    persistData(updated);
  };

  const deleteInterviewStatus = (name: string) => {
    const currentList = data.interviewStatusesList || DEFAULT_INTERVIEW_STATUSES;
    const updated = {
      ...data,
      interviewStatusesList: currentList.filter(s => s !== name)
    };
    persistData(updated);
  };

  const addInterviewResult = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const currentList = data.interviewResultsList || DEFAULT_INTERVIEW_RESULTS;
    if (currentList.some(r => r.trim().toLowerCase() === clean.toLowerCase())) return;
    const updated = {
      ...data,
      interviewResultsList: [...currentList, clean]
    };
    persistData(updated);
  };

  const renameInterviewResult = (oldName: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || clean === oldName) return;
    const currentList = data.interviewResultsList || DEFAULT_INTERVIEW_RESULTS;
    const updated = {
      ...data,
      interviewResultsList: currentList.map(r => r === oldName ? clean : r),
      interviews: data.interviews.map(i => i.result === oldName ? { ...i, result: clean as any } : i)
    };
    persistData(updated);
  };

  const deleteInterviewResult = (name: string) => {
    const currentList = data.interviewResultsList || DEFAULT_INTERVIEW_RESULTS;
    const updated = {
      ...data,
      interviewResultsList: currentList.filter(r => r !== name)
    };
    persistData(updated);
  };

  const addInternStatus = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const currentList = data.internStatusesList || DEFAULT_INTERN_STATUSES;
    if (currentList.some(s => s.trim().toLowerCase() === clean.toLowerCase())) return;
    const updated = {
      ...data,
      internStatusesList: [...currentList, clean]
    };
    persistData(updated);
  };

  const renameInternStatus = (oldName: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || clean === oldName) return;
    const currentList = data.internStatusesList || DEFAULT_INTERN_STATUSES;
    const updated = {
      ...data,
      internStatusesList: currentList.map(s => s === oldName ? clean : s),
      interns: data.interns.map(i => i.status === oldName ? { ...i, status: clean as any } : i)
    };
    persistData(updated);
  };

  const deleteInternStatus = (name: string) => {
    const currentList = data.internStatusesList || DEFAULT_INTERN_STATUSES;
    const updated = {
      ...data,
      internStatusesList: currentList.filter(s => s !== name)
    };
    persistData(updated);
  };

  const addFiredReason = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const currentList = data.firedReasonsList || DEFAULT_FIRED_REASONS;
    if (currentList.some(r => r.trim().toLowerCase() === clean.toLowerCase())) return;
    const updated = {
      ...data,
      firedReasonsList: [...currentList, clean]
    };
    persistData(updated);
  };

  const renameFiredReason = (oldName: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || clean === oldName) return;
    const currentList = data.firedReasonsList || DEFAULT_FIRED_REASONS;
    const updated = {
      ...data,
      firedReasonsList: currentList.map(r => r === oldName ? clean : r),
      firedEmployees: data.firedEmployees.map(f => f.reason === oldName ? { ...f, reason: clean } : f)
    };
    persistData(updated);
  };

  const deleteFiredReason = (name: string) => {
    const currentList = data.firedReasonsList || DEFAULT_FIRED_REASONS;
    const updated = {
      ...data,
      firedReasonsList: currentList.filter(r => r !== name)
    };
    persistData(updated);
  };

  // Automatic calendar notifications checker (checks for upcoming events)
  useEffect(() => {
    const checkUpcomingEvents = () => {
      const events = data.calendarEvents || [];
      if (events.length === 0) return;

      const now = new Date();
      const newNotifs: { id: string; title: string; time: string }[] = [];

      events.forEach((event) => {
        if (event.isNotificationSent || sentNotificationIdsRef.current.has(event.id)) return;

        const eventTime = new Date(event.dateTime);
        const diffMs = eventTime.getTime() - now.getTime();
        const diffMins = diffMs / (1000 * 60);

        // Alert user if the event starts within the next 15 minutes, or up to 10 minutes overdue
        if (diffMins >= -10 && diffMins <= 15) {
          sentNotificationIdsRef.current.add(event.id);
          newNotifs.push({
            id: event.id,
            title: event.title,
            time: new Date(event.dateTime).toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit' })
          });
        }
      });

      if (newNotifs.length > 0) {
        setActiveNotifications(prev => [...prev, ...newNotifs]);
      }
    };

    checkUpcomingEvents();
    const intervalId = setInterval(checkUpcomingEvents, 30000); // Check every 30s
    return () => clearInterval(intervalId);
  }, [data.calendarEvents]);

  // 5. Sidebar Navigation structure
  const sidebarItems = [
    { id: 'dashboard', label: 'Панель аналітики', icon: BarChart3 },
    { id: 'vacancies', label: 'Вакансії', icon: Briefcase },
    { id: 'candidates', label: 'Кандидати', icon: Users },
    { id: 'interviews', label: 'Співбесіди', icon: Clock },
    { id: 'interns', label: 'Стажери', icon: Award },
    { id: 'fired', label: 'Звільнення', icon: UserMinus },
    { id: 'calendar', label: 'Календар подій', icon: Calendar },
    { id: 'report', label: 'Звіт для керівника', icon: FileText },
    { id: 'directories', label: 'Довідники', icon: Settings },
    { id: 'tables', label: 'Таблиці', icon: TableIcon },
  ] as const;

  const calendarEventsWithBirthdays = useMemo(() => {
    const customEvents = data.calendarEvents || [];

    // Filter interns who successfully completed internship
    const successfulInterns = (data.interns || []).filter(
      i => i.status === 'Успішно завершено'
    );

    const parseMonthDay = (dateStr: string): { month: number; day: number } | null => {
      if (!dateStr) return null;
      const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        return { month: parseInt(isoMatch[2], 10), day: parseInt(isoMatch[3], 10) };
      }
      const dotMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (dotMatch) {
        return { month: parseInt(dotMatch[2], 10), day: parseInt(dotMatch[1], 10) };
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return { month: d.getMonth() + 1, day: d.getDate() };
      }
      return null;
    };

    const birthdayEvents: CalendarEvent[] = [];
    const yearsToGenerate = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

    successfulInterns.forEach(intern => {
      const candidate = (data.candidates || []).find(c => c.id === intern.candidateId);
      const bDateStr = intern.birthDate || candidate?.birthDate;
      const parsed = parseMonthDay(bDateStr || '');

      if (parsed) {
        const { month, day } = parsed;
        const monthStr = month < 10 ? `0${month}` : `${month}`;
        const dayStr = day < 10 ? `0${day}` : `${day}`;

        yearsToGenerate.forEach(yr => {
          birthdayEvents.push({
            id: `birthday-${intern.id}-${yr}`,
            title: `🎂 День народження: ${intern.candidateName}`,
            dateTime: `${yr}-${monthStr}-${dayStr}T09:00`,
            description: `Працівник успішно пройшов стажування (${intern.position || 'Посада не вказана'}, ${intern.department || ''}).`,
            candidateId: intern.candidateId,
            isNotificationSent: false
          });
        });
      }
    });

    return [...customEvents, ...birthdayEvents];
  }, [data.calendarEvents, data.interns, data.candidates]);

  // Authorization Check
  const isAuthenticated = Boolean(user) || isLocalAuth;

  if (!isAuthenticated) {
    return (
      <LoginPage
        onGoogleLogin={handleLogin}
        onEmailLogin={handleEmailLogin}
        onLocalLogin={handleLocalLogin}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased relative">
      {/* Event Notifications Toast List */}
      {activeNotifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-auto">
          {activeNotifications.map((notif) => (
            <div 
              key={notif.id} 
              className="bg-teal-800 text-white p-4 rounded-2xl shadow-xl border border-teal-700 flex items-start space-x-3 animate-fade-in relative overflow-hidden"
            >
              {/* Pulse glow background effect */}
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400"></div>
              
              <div className="flex-1 pl-1">
                <div className="flex items-center space-x-1.5">
                  <Bell className="h-3.5 w-3.5 text-emerald-400 animate-bounce" />
                  <span className="text-[9px] font-bold text-teal-200 uppercase tracking-wider">Нагадування про подію</span>
                </div>
                <h4 className="text-xs font-bold mt-1 capitalize">{notif.title}</h4>
                <p className="text-[10px] text-teal-200 font-semibold mt-0.5">Початок о {notif.time}</p>
              </div>

              <button 
                onClick={() => setActiveNotifications(prev => prev.filter(n => n.id !== notif.id))}
                className="text-teal-300 hover:text-white transition font-bold text-base leading-none"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dynamic Alert Banner for Errors */}
      {errorMessage && (
        <div className="bg-rose-700 text-white text-xs py-3 px-4 text-center font-semibold flex flex-wrap items-center justify-center gap-3 animate-fade-in shrink-0 shadow-md">
          <div className="flex items-center space-x-2">
            <span className="font-bold">⚠️ Увага:</span>
            <span>{errorMessage}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleConnectGoogleDirect}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-3 py-1 rounded-lg transition text-[11px] cursor-pointer shadow-sm flex items-center space-x-1"
            >
              <span>🔑 Надати повні дозволи Google</span>
            </button>
            {accessToken && (
              <button 
                onClick={handleForceSync} 
                className="bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg text-white font-bold transition text-[11px] cursor-pointer"
              >
                🔄 Повторити
              </button>
            )}
            <button
              onClick={() => setShowCustomSheetModal(true)}
              className="bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg text-white font-bold transition text-[11px] cursor-pointer"
            >
              📊 Вказати таблицю
            </button>
            <button onClick={() => setErrorMessage(null)} className="underline hover:text-rose-200 ml-1 cursor-pointer text-[11px]">Закрити</button>
          </div>
        </div>
      )}

      {/* Main Header */}
      <header className="bg-white border-b border-slate-100 h-16 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-xs z-10 gap-3">
        <div className="flex items-center space-x-3 shrink-0">
          <div className="h-9 w-9 rounded-xl bg-teal-700 flex items-center justify-center text-white font-black text-lg tracking-wider">
            HR
          </div>
          <div className="hidden lg:block">
            <h1 className="font-extrabold text-slate-800 text-sm sm:text-base leading-tight tracking-tight">
              Система HR-Аналітики та Управління
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Управління та Звітність</p>
          </div>
        </div>

        {/* Global Quick Search / Command Palette Bar */}
        <button
          onClick={() => setShowCommandPalette(true)}
          className="flex-1 max-w-md bg-slate-100/80 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200/60 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer shadow-2xs group"
          title="Натисніть для швидкого пошуку кандидатів, вакансій або дій (Ctrl+K)"
        >
          <div className="flex items-center space-x-2 truncate">
            <Search className="h-4 w-4 text-teal-600 group-hover:scale-110 transition shrink-0" />
            <span className="truncate">Швидкий пошук та дії...</span>
          </div>
          <span className="hidden sm:inline-block bg-white border border-slate-200 text-slate-500 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-2xs shrink-0 ml-2">
            Ctrl+K
          </span>
        </button>

        {/* Sync Status & User Menu */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {/* Express Walk-in Interview Button */}
          <button
            onClick={openQuickInterview}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold shadow-sm hover:shadow-md transition cursor-pointer shrink-0"
            title="Швидко зареєструвати співбесіду кандидата"
          >
            <Zap className="h-4 w-4 fill-amber-200 text-white animate-bounce" />
            <span className="hidden sm:inline">⚡ Експрес-співбесіда</span>
            <span className="sm:hidden">⚡ Співбесіда</span>
          </button>

          {/* Multi-Device Sessions Button */}
          <button
            onClick={() => setShowMultiDeviceModal(true)}
            className="flex items-center space-x-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
            title="Управління сесіями та вхід з кількох пристроїв (смартфон, ноутбук, ПК)"
          >
            <Smartphone className="h-3.5 w-3.5 text-teal-700" />
            <span className="hidden sm:inline">📱 Пристрої</span>
          </button>

          {/* Standing Out from IFrame helper */}
          {typeof window !== 'undefined' && window.self !== window.top && (
            <a
              href="https://ais-pre-26xf6bblusnpopeinrwtkt-283714184287.europe-west2.run.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold transition"
              title="Відкрити додаток в окремому чистому вікні без чату ШІ збоку"
            >
              <ExternalLink className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="hidden xs:inline">Окреме вікно ↗</span>
            </a>
          )}

          {/* Cloud Sync Status & Multi-Device Connection Pill */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-full text-[11px] font-bold">
            {syncStatus === 'saving' || isCloudSyncing ? (
              <div className="flex items-center space-x-1.5 text-amber-700 px-1">
                <RefreshCw className="h-3 w-3 animate-spin text-amber-600 shrink-0" />
                <span className="hidden sm:inline">Збереження в хмару...</span>
                <span className="sm:hidden">Збереження...</span>
              </div>
            ) : accessToken ? (
              <div className="flex items-center space-x-1.5 text-emerald-800 px-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="hidden sm:inline">Хмара & Google Sheets</span>
                <span className="sm:hidden">Google Активний</span>
                {spreadsheetUrl && (
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-950 hover:text-emerald-700 ml-0.5 flex items-center shrink-0"
                    title="Відкрити Google Таблицю"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 text-teal-800 px-1" title="Централізована хмарна база активна. Дані синхронізуються між усіма комп'ютерами.">
                <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0"></span>
                <span className="hidden sm:inline">Хмарна база</span>
                <span className="sm:hidden">Хмара</span>
              </div>
            )}

            <button
              onClick={() => handleForceSync()}
              disabled={isCloudSyncing || isLoading}
              className="p-1 text-slate-500 hover:text-teal-700 hover:bg-slate-200/70 rounded-full transition cursor-pointer"
              title={`Оновити дані з хмари${lastSyncedTime ? ` (Остання синхронізація: ${lastSyncedTime})` : ''}`}
            >
              <RefreshCw className={`h-3 w-3 ${isCloudSyncing ? 'animate-spin text-teal-600' : ''}`} />
            </button>
          </div>

          {/* User Profile / Logout Widget */}
          {user ? (
            <div className="flex items-center space-x-3 pl-3 border-l border-slate-100">
              <div className="hidden md:block text-right">
                <p className="text-xs font-bold text-slate-700">{user.displayName || 'Користувач'}</p>
                <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{user.email}</p>
              </div>
              <img
                src={user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop'}
                alt={user.displayName || 'Avatar'}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-full border border-slate-200/50 object-cover"
              />
              <button
                onClick={handleLogout}
                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition font-bold text-xs flex items-center space-x-1 cursor-pointer"
                title="Вийти з системи"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-600" />
                <span className="hidden sm:inline">Вийти</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3 pl-3 border-l border-slate-100">
              <div className="hidden md:block text-right">
                <p className="text-xs font-bold text-slate-700">{localRole}</p>
                <p className="text-[10px] text-slate-400 font-medium">Локальний доступ</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-slate-900 text-teal-400 flex items-center justify-center font-black text-xs border border-slate-700 shadow-sm shrink-0">
                HR
              </div>
              <button
                onClick={handleLogout}
                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition font-bold text-xs flex items-center space-x-1 cursor-pointer"
                title="Вийти з системи"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-600" />
                <span className="hidden sm:inline">Вийти</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Menu */}
        <aside className="w-64 bg-white border-r border-slate-100 flex flex-col justify-between shrink-0 hidden md:flex">
          <nav className="p-4 space-y-1.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => startTransition(() => setActiveTab(item.id))}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Connected Google info or prompt */}
          <div className="p-5 border-t border-slate-100 bg-slate-50/50 m-4 rounded-xl space-y-2 text-center">
            {accessToken ? (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">База підключена</p>
                <p className="text-[11px] text-slate-400 font-medium">Дані автоматично синхронізуються з Google Sheets.</p>
                <div className="flex flex-col space-y-1 items-center justify-center pt-1 border-t border-slate-100/50">
                  <button
                    onClick={handleForceSync}
                    className="inline-flex items-center space-x-1 text-[11px] text-teal-700 hover:underline font-bold"
                  >
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Примусовий синхрон</span>
                  </button>
                  <button
                    onClick={() => setShowCustomSheetModal(true)}
                    className="text-[10px] text-slate-500 hover:text-slate-800 hover:underline font-bold mt-1"
                  >
                    Змінити/Підключити ID
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Локальний демо-режим</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">Підключіть Google Sheets, щоб автоматично експортувати та редагувати дані.</p>
                <button
                  onClick={handleLogin}
                  className="text-[11px] text-teal-700 hover:underline font-extrabold"
                >
                  Активувати хмару
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Central Workspace Canvas */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6">
          {/* Mobile Top Tabs menu (fallback of sidebar on small screens) */}
          <div className="md:hidden bg-white p-3.5 rounded-2xl border border-slate-100 flex items-center space-x-2 overflow-x-auto">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => startTransition(() => setActiveTab(item.id))}
                  className={`flex items-center space-x-2 shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold ${
                    isActive ? 'bg-teal-700 text-white' : 'text-slate-500 bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Loading backdrop / skeleton inside panel if loading */}
          {isLoading ? (
            <div className="bg-white p-16 rounded-2xl border border-slate-100 text-center flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="h-10 w-10 text-teal-700 animate-spin" />
              <p className="text-xs text-slate-500 font-bold">Оновлюємо дані та зв'язуємося з сервісами Google...</p>
            </div>
          ) : (
            <div className="animate-fade-in">
              {activeTab === 'dashboard' && (
                <Dashboard
                  data={data}
                  onOpenPersonalFile={openPersonalFile}
                />
              )}
              {activeTab === 'vacancies' && (
                <VacanciesManager
                  vacancies={data.vacancies}
                  positions={data.positionsList}
                  departments={data.departmentsList}
                  candidates={data.candidates}
                  interviews={data.interviews}
                  interns={data.interns}
                  onAddVacancy={addVacancy}
                  onUpdateVacancy={updateVacancy}
                  onDeleteVacancy={deleteVacancy}
                  onViewPersonalFile={openPersonalFile}
                />
              )}
              {activeTab === 'candidates' && (
                <CandidatesManager
                  candidates={data.candidates}
                  vacancies={data.vacancies}
                  interviews={data.interviews || []}
                  stagesList={data.stagesList || DEFAULT_STAGES}
                  sourcesList={data.sourcesList || DEFAULT_SOURCES}
                  onAddCandidate={addCandidate}
                  onUpdateCandidate={updateCandidate}
                  onDeleteCandidate={deleteCandidate}
                  onViewPersonalFile={openPersonalFile}
                  onOpenQuickInterview={openQuickInterview}
                />
              )}
              {activeTab === 'interviews' && (
                <InterviewsManager
                  interviews={data.interviews}
                  candidates={data.candidates}
                  vacancies={data.vacancies}
                  sourcesList={data.sourcesList || DEFAULT_SOURCES}
                  interviewStatusesList={data.interviewStatusesList || DEFAULT_INTERVIEW_STATUSES}
                  interviewResultsList={data.interviewResultsList || DEFAULT_INTERVIEW_RESULTS}
                  onAddInterview={addInterview}
                  onUpdateInterview={updateInterview}
                  onDeleteInterview={deleteInterview}
                  onViewPersonalFile={openPersonalFile}
                  onUpdateCandidate={updateCandidate}
                  onAddCandidate={addCandidate}
                  onDeleteCandidate={deleteCandidate}
                  onOpenQuickInterview={openQuickInterview}
                  onAddIntern={addIntern}
                />
              )}
              {activeTab === 'interns' && (
                <InternsManager
                  interns={data.interns}
                  candidates={data.candidates}
                  vacancies={data.vacancies}
                  interviews={data.interviews}
                  internStatusesList={data.internStatusesList || DEFAULT_INTERN_STATUSES}
                  onAddIntern={addIntern}
                  onUpdateIntern={updateIntern}
                  onDeleteIntern={deleteIntern}
                  onViewPersonalFile={openPersonalFile}
                  onUpdateCandidate={updateCandidate}
                />
              )}
              {activeTab === 'fired' && (
                <FiredAnalytics
                  firedEmployees={data.firedEmployees || []}
                  positions={data.positionsList || DEFAULT_POSITIONS}
                  departments={data.departmentsList || DEFAULT_DEPARTMENTS}
                  firedReasons={data.firedReasonsList || DEFAULT_FIRED_REASONS}
                  interns={data.interns || []}
                  candidates={data.candidates || []}
                  onAddFiredEmployee={addFiredEmployee}
                  onUpdateFiredEmployee={updateFiredEmployee}
                  onDeleteFiredEmployee={deleteFiredEmployee}
                  onViewPersonalFile={openPersonalFile}
                />
              )}
              {activeTab === 'calendar' && (
                <CalendarTab
                  events={calendarEventsWithBirthdays}
                  candidates={data.candidates}
                  onAddEvent={addCalendarEvent}
                  onUpdateEvent={updateCalendarEvent}
                  onDeleteEvent={deleteCalendarEvent}
                  onViewPersonalFile={openPersonalFile}
                />
              )}
              {activeTab === 'report' && (
                <ReportGenerator
                  data={data}
                  accessToken={accessToken}
                  spreadsheetId={spreadsheetId}
                />
              )}
              {activeTab === 'directories' && (
                <DirectoriesManager
                  positions={data.positionsList || DEFAULT_POSITIONS}
                  departments={data.departmentsList || DEFAULT_DEPARTMENTS}
                  stages={data.stagesList || DEFAULT_STAGES}
                  sources={data.sourcesList || DEFAULT_SOURCES}
                  interviewStatuses={data.interviewStatusesList || DEFAULT_INTERVIEW_STATUSES}
                  interviewResults={data.interviewResultsList || DEFAULT_INTERVIEW_RESULTS}
                  internStatuses={data.internStatusesList || DEFAULT_INTERN_STATUSES}
                  firedReasons={data.firedReasonsList || DEFAULT_FIRED_REASONS}
                  onAddPosition={addPosition}
                  onRenamePosition={renamePosition}
                  onDeletePosition={deletePosition}
                  onAddDepartment={addDepartment}
                  onRenameDepartment={renameDepartment}
                  onDeleteDepartment={deleteDepartment}
                  onAddStage={addStage}
                  onRenameStage={renameStage}
                  onDeleteStage={deleteStage}
                  onAddSource={addSource}
                  onRenameSource={renameSource}
                  onDeleteSource={deleteSource}
                  onAddInterviewStatus={addInterviewStatus}
                  onRenameInterviewStatus={renameInterviewStatus}
                  onDeleteInterviewStatus={deleteInterviewStatus}
                  onAddInterviewResult={addInterviewResult}
                  onRenameInterviewResult={renameInterviewResult}
                  onDeleteInterviewResult={deleteInterviewResult}
                  onAddInternStatus={addInternStatus}
                  onRenameInternStatus={renameInternStatus}
                  onDeleteInternStatus={deleteInternStatus}
                  onAddFiredReason={addFiredReason}
                  onRenameFiredReason={renameFiredReason}
                  onDeleteFiredReason={deleteFiredReason}
                  data={data}
                />
              )}
              {activeTab === 'tables' && (
                <TablesView
                  data={data}
                  spreadsheetUrl={spreadsheetUrl}
                  spreadsheetId={spreadsheetId}
                  accessToken={accessToken}
                  syncStatus={syncStatus}
                  onForceSync={handleForceSync}
                  onOpenCustomSheetModal={() => setShowCustomSheetModal(true)}
                  onViewCandidateFile={(c) => openPersonalFile(c.id)}
                  onViewPersonalFile={openPersonalFile}
                  onDeleteIntern={deleteIntern}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {showCustomSheetModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full p-6 space-y-4 text-left">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Підключити існуючу Google Таблицю</h3>
                <p className="text-xs text-slate-400 mt-0.5">Вставте посилання або ID таблиці, яку ви використовуєте спільно з колегами.</p>
              </div>
              <button
                onClick={() => setShowCustomSheetModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl"
              >
                &times;
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">URL-адреса або ID таблиці</label>
                <input
                  type="text"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden transition text-slate-700 font-medium"
                />
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1.5 text-xs text-slate-600 leading-relaxed">
                <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Як це налаштувати:</h4>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Надайте колезі доступ на редагування вашої таблиці в Google Drive.</li>
                  <li>Колега заходить у додаток, натискає <strong className="text-slate-800">"Увійти через Google"</strong>.</li>
                  <li>Колега копіює посилання на таблицю та вставляє його в поле вище.</li>
                  <li>Після цього ви обидва працюватимете з однією базою даних у реальному часі!</li>
                </ol>
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setShowCustomSheetModal(false)}
                className="flex-1 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Скасувати
              </button>
              {localStorage.getItem('custom_spreadsheet_id') && (
                <button
                  onClick={async () => {
                    await handleResetCustomSheet();
                    setShowCustomSheetModal(false);
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-700 rounded-xl text-xs font-bold transition"
                  title="Скинути до стандартної автоматичної таблиці"
                >
                  Скинути
                </button>
              )}
              <button
                onClick={() => handleConnectCustomSheet(customUrlInput)}
                disabled={!customUrlInput.trim()}
                className="flex-1 px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition"
              >
                Підключити
              </button>
            </div>
          </div>
        </div>
      )}

      {personalFileCandidateId && (
        <PersonalFileModal
          candidateId={personalFileCandidateId}
          data={data}
          onClose={() => setPersonalFileCandidateId(null)}
          onUpdateCandidate={updateCandidate}
          onUpdateIntern={updateIntern}
          onUpdateInterview={updateInterview}
          onAddInterview={addInterview}
          onDeleteInterview={deleteInterview}
          onAddIntern={addIntern}
          onDeleteIntern={deleteIntern}
          onUpdateFiredEmployee={updateFiredEmployee}
        />
      )}

      {isQuickInterviewOpen && (
        <QuickInterviewModal
          isOpen={isQuickInterviewOpen}
          onClose={() => setIsQuickInterviewOpen(false)}
          vacancies={data.vacancies}
          candidates={data.candidates}
          sourcesList={data.sourcesList || DEFAULT_SOURCES}
          interviewStatusesList={data.interviewStatusesList || DEFAULT_INTERVIEW_STATUSES}
          interviewResultsList={data.interviewResultsList || DEFAULT_INTERVIEW_RESULTS}
          onAddCandidate={addCandidate}
          onAddInterview={addInterview}
          onAddIntern={addIntern}
          onUpdateCandidate={updateCandidate}
          onViewPersonalFile={(id) => {
            openPersonalFile(id);
          }}
        />
      )}

      <GlobalCommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        data={data}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenQuickInterview={openQuickInterview}
        onOpenCandidateFile={(id) => openPersonalFile(id)}
      />

      <MultiDeviceModal
        isOpen={showMultiDeviceModal}
        onClose={() => setShowMultiDeviceModal(false)}
        currentSession={currentSession}
        candidatesCount={data.candidates.length}
        vacanciesCount={data.vacancies.length}
      />
    </div>
  );
}
