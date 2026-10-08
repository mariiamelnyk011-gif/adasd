import { Vacancy, Candidate, Interview, Intern } from '../types';

export interface FunnelMetrics {
  totalApplications: number;
  contacted: number;
  totalContacted: number;
  totalInvited: number;
  completedInterviews: number;
  scheduledInterviews: number;
  noShowInterviews: number;
  successfulInterviews: number;
  totalInterns: number;
  activeInterns: number;
  completedInterns: number;
  failedInterns: number;
  totalHired: number;

  // Step-by-step conversions (%)
  appToContactConv: number;
  contactToInterviewConv: number;
  interviewToInternConv: number;
  internToHireConv: number;

  // Conversions relative to total applications (%)
  appToInterviewConv: number;
  appToInternConv: number;
  overallConversion: number;

  // Normalized widths for visual funnel bars (0 - 100%)
  applicationsBarWidth: number;
  contactedBarWidth: number;
  interviewsBarWidth: number;
  internsBarWidth: number;
  hiredBarWidth: number;

  // Additional rates
  interviewPassRate: number;
  showUpRate: number;
  internSuccessRate: number;
}

export interface VacancyFunnelItem extends FunnelMetrics {
  vacancy: Vacancy;
  vCandidates: Candidate[];
  vInterviews: Interview[];
  vInterns: Intern[];
  hiredCandidatesList: Array<{ id: string; name: string; position: string; department?: string; source?: string }>;
  hotApplications: number;
  coldApplications: number;
  rejectedCount: number;
  currentPriority: string;
  priorityScore: number;
  daysOpen: number;
  bottleneckText: string;
  bottleneckClass: string;
}

/**
 * Checks whether candidate belongs to a specific vacancy.
 * Uses vacancyId as primary key, with fallback to normalized title and department,
 * and links via associated internship if present.
 */
export function matchCandidateToVacancy(
  c: Candidate | null | undefined, 
  v: Vacancy | null | undefined,
  allInterns?: Intern[]
): boolean {
  if (!c || !v) return false;
  if (c.vacancyId && v.id && c.vacancyId === v.id) return true;
  
  // Also check if candidate is linked to an intern for this vacancy
  if (allInterns && allInterns.length > 0) {
    const linkedIntern = allInterns.find(it => 
      (it.candidateId && it.candidateId === c.id) ||
      (it.candidateName && c.name && it.candidateName.trim().toLowerCase() === c.name.trim().toLowerCase())
    );
    if (linkedIntern) {
      const vTitle = (v.title || '').trim().toLowerCase();
      const itPos = (linkedIntern.position || '').trim().toLowerCase();
      if (itPos && vTitle && (itPos === vTitle || itPos.includes(vTitle) || vTitle.includes(itPos))) {
        if (linkedIntern.department && v.department) {
          if (linkedIntern.department.trim().toLowerCase() === v.department.trim().toLowerCase()) {
            return true;
          }
        } else {
          return true;
        }
      }
    }
  }

  const cPos = ((c as any).position || (c as any).desiredPosition || '').trim().toLowerCase();
  const vTitle = (v.title || '').trim().toLowerCase();
  if (cPos && vTitle && (cPos === vTitle || cPos.includes(vTitle) || vTitle.includes(cPos))) {
    const cDept = ((c as any).department || '').trim().toLowerCase();
    const vDept = (v.department || '').trim().toLowerCase();
    if (cDept && vDept) {
      return cDept === vDept;
    }
    return true;
  }
  return false;
}

/**
 * Checks whether an interview belongs to a specific vacancy.
 */
export function matchInterviewToVacancy(
  i: Interview | null | undefined,
  v: Vacancy | null | undefined,
  vacancyCandidateIds: Set<string>,
  vacancyCandidateNames: Set<string>
): boolean {
  if (!i || !v) return false;
  if (i.candidateId && vacancyCandidateIds.has(i.candidateId)) return true;
  if (i.candidateName && vacancyCandidateNames.has(i.candidateName.trim().toLowerCase())) return true;
  if ((i as any).vacancyId && (i as any).vacancyId === v.id) return true;
  
  const iPos = ((i as any).position || '').trim().toLowerCase();
  const vTitle = (v.title || '').trim().toLowerCase();
  if (iPos && vTitle && (iPos === vTitle || iPos.includes(vTitle) || vTitle.includes(iPos))) {
    return true;
  }
  return false;
}

/**
 * Checks whether an intern belongs to a specific vacancy.
 * Position & department match is the primary source of truth, avoiding mismatched cross-vacancy candidate IDs.
 */
export function matchInternToVacancy(
  it: Intern | null | undefined,
  v: Vacancy | null | undefined,
  allCandidates: Candidate[]
): boolean {
  if (!it || !v) return false;
  
  const vTitle = (v.title || '').trim().toLowerCase();
  const itPos = (it.position || '').trim().toLowerCase();
  const vDept = (v.department || '').trim().toLowerCase();
  const itDept = (it.department || '').trim().toLowerCase();

  // Helper to check if positions are conceptually compatible
  const isPosCompatible = !itPos || !vTitle || itPos === vTitle || itPos.includes(vTitle) || vTitle.includes(itPos) ||
    (itPos.includes('прач') && vTitle.includes('пральн')) ||
    (itPos.includes('пральн') && vTitle.includes('прач'));

  // If positions explicitly conflict, intern cannot belong to this vacancy
  if (!isPosCompatible) {
    return false;
  }

  // 1. Primary: match via position and department
  if (itPos && vTitle && isPosCompatible) {
    if (itDept && vDept && itDept !== 'основний' && vDept !== 'основний') {
      if (itDept === vDept || itDept.includes(vDept) || vDept.includes(itDept)) {
        return true;
      }
    } else {
      return true;
    }
  }

  // 2. Secondary: match via associated candidate vacancyId
  const cand = allCandidates.find(c => 
    (it.candidateId && c.id === it.candidateId) || 
    (c.name && it.candidateName && c.name.trim().toLowerCase() === it.candidateName.trim().toLowerCase())
  );
  
  if (cand && cand.vacancyId && v.id && cand.vacancyId === v.id) {
    return true;
  }

  return false;
}

/**
 * Standardized status definitions
 */
export function isCandidateHired(c: Candidate): boolean {
  if (!c || !c.status) return false;
  const s = c.status.trim().toLowerCase();
  return s === 'працевлаштовано' || s === 'офер прийнято' || s === 'прийнято' || s === 'найнято';
}

export function isInternCompleted(i: Intern): boolean {
  if (!i || !i.status) return false;
  const s = i.status.trim().toLowerCase();
  return s === 'успішно завершено' || s === 'завершено успішно' || s === 'працевлаштовано';
}

export function isInternActive(i: Intern): boolean {
  if (!i || !i.status) return false;
  const s = i.status.trim().toLowerCase();
  return s === 'триває' || s === 'активний' || s === 'проходить';
}

export function isInternFailed(i: Intern): boolean {
  if (!i || !i.status) return false;
  const s = i.status.trim().toLowerCase();
  return s === 'не пройшов' || s === 'відмова' || s === 'звільнено' || s === 'перервано';
}

/**
 * Calculates core funnel metrics for a given subset of candidates, interviews, and interns.
 * Strict recruitment funnel hierarchy: Applications >= Contacted >= Interviews >= Interns >= Hired.
 */
export function calculateFunnelMetrics(
  candidatesList: Candidate[],
  interviewsList: Interview[],
  internsList: Intern[]
): FunnelMetrics {
  const safeCandidates = (candidatesList || []).filter(Boolean);
  const safeInterviews = (interviewsList || []).filter(Boolean);
  const safeInterns = (internsList || []).filter(Boolean);

  // 1. Interns breakdown
  const activeInterns = safeInterns.filter(isInternActive).length;
  const completedInterns = safeInterns.filter(isInternCompleted).length;
  const failedInterns = safeInterns.filter(isInternFailed).length;
  
  // Total unique individuals who entered internship
  const internCandidateIds = new Set(safeInterns.map(i => i.candidateId).filter(Boolean));
  const internCandidateNames = new Set(safeInterns.map(i => (i.candidateName || '').trim().toLowerCase()).filter(Boolean));

  let additionalInternsFromCandidates = 0;
  safeCandidates.forEach(c => {
    const s = (c.status || '').trim();
    if (s === 'Стажування' || s === 'Працевлаштовано' || s === 'Офер прийнято') {
      const alreadyInInterns = (c.id && internCandidateIds.has(c.id)) || (c.name && internCandidateNames.has(c.name.trim().toLowerCase()));
      if (!alreadyInInterns) {
        additionalInternsFromCandidates++;
      }
    }
  });

  const baseTotalInterns = safeInterns.length + additionalInternsFromCandidates;

  // 2. Total unique individuals hired:
  // Strictly individuals who completed internship successfully OR candidates marked hired
  // NEVER count active interns ('Стажування') as hired!
  const completedInternIds = new Set(safeInterns.filter(isInternCompleted).map(i => i.candidateId).filter(Boolean));
  const completedInternNames = new Set(safeInterns.filter(isInternCompleted).map(i => (i.candidateName || '').trim().toLowerCase()).filter(Boolean));

  let additionalDirectHires = 0;
  safeCandidates.forEach(c => {
    if (isCandidateHired(c)) {
      const alreadyCompleted = (c.id && completedInternIds.has(c.id)) || (c.name && completedInternNames.has(c.name.trim().toLowerCase()));
      if (!alreadyCompleted) {
        additionalDirectHires++;
      }
    }
  });

  const totalHired = completedInterns + additionalDirectHires;

  // Stage 4: Total Interns must be at least totalHired (in standard retail progression)
  const totalInterns = Math.max(baseTotalInterns, totalHired);

  // 3. Interviews (Conducted / Completed)
  const interviewCandidateIds = new Set<string>();
  const interviewCandidateNames = new Set<string>();

  safeInterviews.forEach(i => {
    const s = (i.status || '').trim();
    const r = (i.result || '').toLowerCase();
    const isDone = s === 'Завершено' || r.includes('успіш') || r.includes('стажуван') || r.includes('офер') || r.includes('відмов');
    if (isDone) {
      if (i.candidateId) interviewCandidateIds.add(i.candidateId);
      if (i.candidateName) interviewCandidateNames.add(i.candidateName.trim().toLowerCase());
    }
  });

  // Candidates whose status reached interview or beyond
  safeCandidates.forEach(c => {
    const s = (c.status || '').trim();
    if (s === 'Співбесіда' || s === 'Співбесіда з керівником' || s === 'Стажування' || s === 'Працевлаштовано' || s === 'Офер прийнято') {
      if (c.id) interviewCandidateIds.add(c.id);
      if (c.name) interviewCandidateNames.add(c.name.trim().toLowerCase());
    }
  });

  // Unique interviewed count from both records
  const uniqueInterviewedCount = Math.max(interviewCandidateIds.size, interviewCandidateNames.size);
  // An applicant must have been interviewed before internship/hire
  const completedInterviews = Math.max(uniqueInterviewedCount, totalInterns);

  const scheduledInterviews = safeInterviews.filter(i => {
    const s = (i.status || '').trim();
    return s === 'Заплановано';
  }).length;

  const noShowInterviews = safeInterviews.filter(i => {
    const s = (i.status || '').trim();
    const r = (i.result || '').toLowerCase();
    return s === 'Не з\'явився' || s === 'Не прийшов' || r.includes('не з\'явився') || r.includes('не прийшов');
  }).length;

  const successfulInterviews = safeInterviews.filter(i => {
    const r = (i.result || '').toLowerCase();
    return r.includes('пройшов') || r.includes('рекомендовано') || r.includes('стажування') || r.includes('офер') || r.includes('успіш');
  }).length;

  // 4. Contacted / Screened candidates
  const contactedIds = new Set<string>();
  const contactedNames = new Set<string>();

  safeCandidates.forEach(c => {
    const s = (c.status || '').trim();
    if (s !== 'Новий' || Boolean(c.contactDate) || c.callType === 'Холодний' || c.callType === 'Гарячий') {
      if (c.id) contactedIds.add(c.id);
      if (c.name) contactedNames.add(c.name.trim().toLowerCase());
    }
  });

  const uniqueContactedCount = Math.max(contactedIds.size, contactedNames.size);
  // An applicant must have been contacted before interview
  const contacted = Math.max(uniqueContactedCount, completedInterviews);

  // 5. Total Applications (Inflow)
  // Total applications must be at least totalContacted
  const totalApplications = Math.max(safeCandidates.length, contacted);

  // Conversions between steps (% ratio)
  const appToContactConv = totalApplications > 0 ? Math.min(100, Math.round((contacted / totalApplications) * 100)) : 0;
  const contactToInterviewConv = contacted > 0 ? Math.min(100, Math.round((completedInterviews / contacted) * 100)) : 0;
  const interviewToInternConv = completedInterviews > 0 ? Math.min(100, Math.round((totalInterns / completedInterviews) * 100)) : 0;
  const internToHireConv = totalInterns > 0 ? Math.min(100, Math.round((totalHired / totalInterns) * 100)) : 0;

  // Conversions relative to total applications (%)
  const appToInterviewConv = totalApplications > 0 ? Math.min(100, Math.round((completedInterviews / totalApplications) * 100)) : 0;
  const appToInternConv = totalApplications > 0 ? Math.min(100, Math.round((totalInterns / totalApplications) * 100)) : 0;
  const overallConversion = totalApplications > 0 ? Math.min(100, Math.round((totalHired / totalApplications) * 100)) : 0;

  // Normalized widths for visual funnel bars (guaranteed tapering funnel, max 100%)
  const applicationsBarWidth = totalApplications > 0 ? 100 : 0;
  const contactedBarWidth = totalApplications > 0 ? Math.min(100, Math.round((contacted / totalApplications) * 100)) : 0;
  const interviewsBarWidth = totalApplications > 0 ? Math.min(100, Math.round((completedInterviews / totalApplications) * 100)) : 0;
  const internsBarWidth = totalApplications > 0 ? Math.min(100, Math.round((totalInterns / totalApplications) * 100)) : 0;
  const hiredBarWidth = totalApplications > 0 ? Math.min(100, Math.round((totalHired / totalApplications) * 100)) : 0;

  // Rate metrics
  const totalInvited = completedInterviews + scheduledInterviews + noShowInterviews;
  const showUpRate = (completedInterviews + noShowInterviews) > 0 ? Math.round((completedInterviews / (completedInterviews + noShowInterviews)) * 100) : 100;
  const interviewPassRate = completedInterviews > 0 ? Math.round((Math.max(successfulInterviews, totalInterns) / completedInterviews) * 100) : 0;
  const internSuccessRate = totalInterns > 0 ? Math.round((totalHired / totalInterns) * 100) : 0;

  return {
    totalApplications,
    contacted,
    totalContacted: contacted,
    totalInvited,
    completedInterviews,
    scheduledInterviews,
    noShowInterviews,
    successfulInterviews,
    totalInterns,
    activeInterns,
    completedInterns,
    failedInterns,
    totalHired,
    appToContactConv,
    contactToInterviewConv,
    interviewToInternConv,
    internToHireConv,
    appToInterviewConv,
    appToInternConv,
    overallConversion,
    applicationsBarWidth,
    contactedBarWidth,
    interviewsBarWidth,
    internsBarWidth,
    hiredBarWidth,
    interviewPassRate,
    showUpRate,
    internSuccessRate
  };
}

/**
 * Calculates complete funnel analytics for a single vacancy.
 */
export function calculateVacancyFunnel(
  vacancy: Vacancy,
  allCandidates: Candidate[],
  allInterviews: Interview[],
  allInterns: Intern[]
): VacancyFunnelItem {
  const safeCandidates = (allCandidates || []).filter(Boolean);
  const safeInterviews = (allInterviews || []).filter(Boolean);
  const safeInterns = (allInterns || []).filter(Boolean);

  // 1. Matched interns (excluding reserve candidates)
  const vInterns = safeInterns.filter(it => {
    // Exclude reserve
    const cand = safeCandidates.find(c => 
      (it.candidateId && c.id === it.candidateId) || 
      (c.name && it.candidateName && c.name.trim().toLowerCase() === it.candidateName.trim().toLowerCase())
    );
    if (cand && cand.status === 'Резерв') return false;
    
    return matchInternToVacancy(it, vacancy, safeCandidates);
  });

  // 2. Matched candidates directly and through linked interns
  const directCandidates = safeCandidates.filter(c => matchCandidateToVacancy(c, vacancy, safeInterns));
  const vCandidates = [...directCandidates];
  const seenCandIds = new Set(vCandidates.map(c => c.id).filter(Boolean));
  const seenCandNames = new Set(vCandidates.map(c => (c.name || '').trim().toLowerCase()).filter(Boolean));

  vInterns.forEach(it => {
    const cand = safeCandidates.find(c => 
      (it.candidateId && c.id === it.candidateId) || 
      (c.name && it.candidateName && c.name.trim().toLowerCase() === it.candidateName.trim().toLowerCase())
    );
    if (cand && !seenCandIds.has(cand.id)) {
      seenCandIds.add(cand.id);
      seenCandNames.add((cand.name || '').trim().toLowerCase());
      vCandidates.push(cand);
    }
  });

  // 3. Matched interviews (evaluated with all candidate IDs and names belonging to this vacancy)
  const vInterviews = safeInterviews.filter(i => matchInterviewToVacancy(i, vacancy, seenCandIds, seenCandNames));

  // Also ensure candidates referenced by vInterviews belong to vCandidates
  vInterviews.forEach(inv => {
    const cand = safeCandidates.find(c => 
      (inv.candidateId && c.id === inv.candidateId) || 
      (c.name && inv.candidateName && c.name.trim().toLowerCase() === inv.candidateName.trim().toLowerCase())
    );
    if (cand && !seenCandIds.has(cand.id)) {
      seenCandIds.add(cand.id);
      seenCandNames.add((cand.name || '').trim().toLowerCase());
      vCandidates.push(cand);
    }
  });

  const coreMetrics = calculateFunnelMetrics(vCandidates, vInterviews, vInterns);

  // Collect list of hired candidates
  const hiredList: Array<{ id: string; name: string; position: string; department?: string; source?: string }> = [];
  const addedIds = new Set<string>();

  // From completed interns
  vInterns.filter(isInternCompleted).forEach(it => {
    const cand = safeCandidates.find(c => c.id === it.candidateId || (c.name && it.candidateName && c.name.trim().toLowerCase() === it.candidateName.trim().toLowerCase()));
    const id = it.candidateId || it.id;
    if (!addedIds.has(id)) {
      addedIds.add(id);
      hiredList.push({
        id,
        name: it.candidateName || cand?.name || 'Працівник',
        position: it.position || vacancy.title,
        department: it.department || vacancy.department,
        source: cand?.source || 'Не вказано'
      });
    }
  });

  // From direct hired candidates
  vCandidates.filter(isCandidateHired).forEach(c => {
    if (!addedIds.has(c.id)) {
      addedIds.add(c.id);
      hiredList.push({
        id: c.id,
        name: c.name,
        position: vacancy.title,
        department: vacancy.department,
        source: c.source || 'Не вказано'
      });
    }
  });

  // Calculate days open
  let daysOpen = 0;
  if (vacancy.createdAt) {
    const createdDate = new Date(vacancy.createdAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    daysOpen = Math.max(0, isNaN(diff) ? 0 : diff);
  }

  // Bottleneck detection
  let bottleneckText = '🟢 Стабільний потік';
  let bottleneckClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';

  if (coreMetrics.totalApplications === 0) {
    bottleneckText = '⚠️ Немає відгуків';
    bottleneckClass = 'bg-rose-50 text-rose-800 border-rose-200';
  } else if (coreMetrics.completedInterviews + coreMetrics.noShowInterviews > 0 && coreMetrics.showUpRate < 60) {
    bottleneckText = `⚠️ Низька явка (${coreMetrics.showUpRate}%)`;
    bottleneckClass = 'bg-rose-50 text-rose-800 border-rose-200';
  } else if (coreMetrics.appToContactConv < 60) {
    bottleneckText = `⏳ Затримка контакту (${coreMetrics.appToContactConv}%)`;
    bottleneckClass = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (coreMetrics.totalInterns > 0 && coreMetrics.internSuccessRate < 40) {
    bottleneckText = `⚠️ Відсів стажерів (${coreMetrics.internSuccessRate}%)`;
    bottleneckClass = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (coreMetrics.overallConversion >= 10) {
    bottleneckText = `⭐ Високий найм (${coreMetrics.overallConversion}%)`;
    bottleneckClass = 'bg-teal-50 text-teal-800 border-teal-200';
  }

  // Inflow types
  const hotApplications = vCandidates.filter(c => c.callType === 'Гарячий').length;
  const coldApplications = vCandidates.filter(c => c.callType === 'Холодний').length;

  // Total rejections
  const rejectedCount = vCandidates.filter(c => c.status === 'Відхилено').length + coreMetrics.failedInterns + coreMetrics.noShowInterviews;

  // Priority
  const currentPriority = vacancy.priority || 'Звичайна';
  const priorityScore = (currentPriority === 'Термінова' || currentPriority === 'Гаряча') ? 3 : currentPriority === 'Звичайна' ? 2 : 1;

  return {
    ...coreMetrics,
    vacancy,
    vCandidates,
    vInterviews,
    vInterns,
    hiredCandidatesList: hiredList,
    hotApplications,
    coldApplications,
    rejectedCount,
    currentPriority,
    priorityScore,
    daysOpen,
    bottleneckText,
    bottleneckClass
  };
}
