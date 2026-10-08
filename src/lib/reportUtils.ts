import { HRSystemData, Intern } from '../types';
import { calculateFunnelMetrics } from './funnelUtils';

/**
 * Generates a comprehensive, professional executive HR report strictly focused on RECRUITING and INTERNSHIPS.
 * Excludes regular employee/staff data as requested.
 */
export function generateLocalExecutiveReport(data: HRSystemData): string {
  const vacancies = data.vacancies || [];
  const candidates = data.candidates || [];
  const interviews = data.interviews || [];
  const interns = data.interns || [];

  const activeVacancies = vacancies.filter(v => v.status === 'Активна');
  const totalOpenPositions = activeVacancies.reduce((sum, v) => sum + (v.openPositions && v.openPositions > 0 ? v.openPositions : 1), 0);

  // Map candidates for quick source lookup for interns
  const candidateSourceMap = new Map<string, string>();
  candidates.forEach(c => {
    if (c.id) candidateSourceMap.set(c.id, c.source || 'Не вказано');
    if (c.name) candidateSourceMap.set(c.name.trim().toLowerCase(), c.source || 'Не вказано');
  });

  const getInternSource = (i: Intern): string => {
    return (
      candidateSourceMap.get(i.candidateId) ||
      candidateSourceMap.get(i.candidateName?.trim().toLowerCase()) ||
      (i as any).source ||
      'Не вказано'
    );
  };

  // Unified Funnel Calculation (single source of truth)
  const funnel = calculateFunnelMetrics(candidates, interviews, interns);

  // Candidate source counts for recommendations
  const sourceCounts: Record<string, number> = {};
  candidates.forEach(c => {
    const src = c.source || 'Не вказано';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });
  const sortedSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

  // Interns metrics & dropout analytics
  const totalInterns = interns.length;
  const activeInterns = interns.filter(i => i.status === 'Триває');
  const successfulInterns = interns.filter(i => i.status === 'Успішно завершено' || (i.status as any) === 'Завершено успішно');
  const failedInterns = interns.filter(i => i.status === 'Не пройшов');
  const failedCount = failedInterns.length;
  const failureRate = totalInterns > 0 ? ((failedCount / totalInterns) * 100).toFixed(1) : '0';

  // Duration calculations (in days)
  const parseDays = (startStr?: string, endStr?: string) => {
    if (!startStr) return null;
    const s = new Date(startStr);
    const e = endStr ? new Date(endStr) : new Date();
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
  };

  let totalAllDays = 0;
  let countWithDates = 0;
  interns.forEach(i => {
    const days = parseDays(i.startDate, i.endDate || i.dismissalDate);
    if (days !== null) {
      totalAllDays += days;
      countWithDates++;
    }
  });
  const avgInternshipDays = countWithDates > 0 ? (totalAllDays / countWithDates).toFixed(1) : '0';

  let totalFailedDays = 0;
  let countFailedWithDates = 0;
  failedInterns.forEach(i => {
    const days = parseDays(i.startDate, i.dismissalDate || i.endDate);
    if (days !== null) {
      totalFailedDays += days;
      countFailedWithDates++;
    }
  });
  const avgFailedDays = countFailedWithDates > 0 ? (totalFailedDays / countFailedWithDates).toFixed(1) : avgInternshipDays;

  // Rejection reasons for failed internships
  const internRejectionReasons: Record<string, number> = {};
  failedInterns.forEach(i => {
    const reason = i.rejectionReason?.trim() || i.comment?.trim() || 'Причина не уточнена';
    internRejectionReasons[reason] = (internRejectionReasons[reason] || 0) + 1;
  });
  const sortedInternRejectionReasons = Object.entries(internRejectionReasons).sort((a, b) => b[1] - a[1]);

  const todayStr = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return `# ЗВІТ З РЕКРУТИНГУ ТА СТАЖУВАННЯ ДЛЯ КЕРІВНИКА КОМПАНІЇ «НАДІЯ»
**Дата формування:** ${todayStr}
**Спрямування звіту:** Оперативна аналітика підбору персоналу, ефективності воронки найму та результатів стажування

---

## 1. РЕЗЮМЕ ДЛЯ КЕРІВНИКА (Executive Summary)

* **Поточна потреба в персоналі:** У роботі відділу перебуває **${vacancies.length}** вакансій, з них відкрито **${activeVacancies.length}** позицій із сукупною потребою у **${totalOpenPositions}** ${totalOpenPositions === 1 ? 'посаді' : totalOpenPositions < 5 ? 'посадах' : 'посадах'}.
* **Загальний обсяг воронки претендентів:** Опрацьовано **${funnel.totalApplications}** анкет претендентів.
* **Результативність адаптації:** На стажуванні перебуває **${activeInterns.length}** стажерів, успішно завершили програму та працевлаштовані **${funnel.totalHired}** чол.
* **Показник відсіву зі стажування:** Зафіксовано **${failedCount}** ${failedCount === 1 ? 'відмову' : failedCount < 5 ? 'відмови' : 'відмов'} від стажування (**${failureRate}%**), середній термін перебування стажера в компанії становить **${avgInternshipDays} днів**.

---

## 2. ВОРОНКА НАЙМУ ТА КОНВЕРСІЯ МІЖ ЕТАПАМИ У % ВІДНОШЕННІ

* **1. Нові вхідні відгуки (Заявки):** ${funnel.totalApplications} кандидатів (100% обсягу воронки)
* **2. Скринінг та перший контакт (зв'язалися):** ${funnel.totalContacted} кандидатів — Конверсія від заявок: **${funnel.appToContactConv}%**
* **3. Проведені співбесіди:** ${funnel.completedInterviews} кандидатів — Конверсія від контакту: **${funnel.contactToInterviewConv}%** (від загальних заявок: **${funnel.appToInterviewConv}%**)
* **4. Вихід на стажування:** ${funnel.totalInterns} стажерів — Конверсія від співбесід: **${funnel.interviewToInternConv}%** (від загальних заявок: **${funnel.appToInternConv}%**)
* **5. Фінальне працевлаштування (Найм):** ${funnel.totalHired} працівників — Конверсія від стажування: **${funnel.internToHireConv}%**
* 🎯 **Наскрізна результативність найму (End-to-End):** **${funnel.overallConversion}%** кандидатів доходять від першої заявки до працевлаштування.

---

## 3. АНАЛІТИКА СТАЖУВАННЯ ТА ВІДМОВ ВІД НЬОГО

* **Усього залучено до програми стажування:** ${funnel.totalInterns} стажерів
* **Активно проходять стажування зараз:** ${activeInterns.length} чол.
* **Успішно працевлаштовано після стажування:** ${successfulInterns.length} чол.
* **Всього відмов від стажування (відсів):** **${failedCount}** чол. (**${failureRate}%** від усіх залучених стажерів)
* **Середній термін проходження стажування:** **${avgInternshipDays} днів**
* **Середній термін до переривання / відмови від стажування:** **${avgFailedDays} днів**

### Топ причин відмов від стажування:
${sortedInternRejectionReasons.length > 0 
  ? sortedInternRejectionReasons.map(([reason, count]) => `* **${reason}:** ${count} чол. (${failedCount > 0 ? Math.round(count / failedCount * 100) : 0}% від усіх відмов)`).join('\n')
  : '* Наразі немає зафіксованих відмов від стажування або причини проходять уточнення.'}

${activeInterns.length > 0 ? `### Поточні стажери на випробувальному терміні:
` + activeInterns.map(i => `* **${i.candidateName}** — ${i.position} (${i.department}) | Джерело: **${getInternSource(i)}** | Ментор: ${i.mentor || 'Не призначено'}`).join('\n') : '* На даний момент активних стажерів немає.'}

---

## 4. СТРАТЕГІЧНИЙ ПЛАН ДІЙ ТА РЕКОМЕНДАЦІЇ (Action Plan)

1. **Масштабування найрезультативніших каналів:** Збільшити активність на джерелі **${sortedSources[0]?.[0] || 'Work.ua'}**, яке генерує максимальний потік цільових кандидатів.
2. **Зменшення відсіву зі стажування:** Враховуючи середній термін до відмови (${avgFailedDays} днів), організувати обов'язкову зустріч зворотного зв'язку з наставником на 2-й та 4-й день стажування для раннього виявлення демотивації.
3. **Оптимізація конверсії співбесід:** Прискорити термін узгодження кандидатів керівниками підрозділів, щоб зберегти інтерес претендентів та підвищити конверсію переходу на стажування (поточна: ${funnel.interviewToInternConv}%).`;
}
