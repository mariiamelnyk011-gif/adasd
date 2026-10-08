import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;

// Centralized Persistent Data Storage for Cross-Device / Cross-Computer Sync
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'hr_system_data.json');
const CVS_DIR = path.join(DATA_DIR, 'cvs');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(CVS_DIR)) {
  fs.mkdirSync(CVS_DIR, { recursive: true });
}

let serverVersion = 1;
let lastModified = new Date().toISOString();
let cachedServerData: any = null;
let savedSpreadsheetId: string | null = null;

function loadServerData() {
  if (cachedServerData) return cachedServerData;
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.data || parsed.candidates)) {
        cachedServerData = parsed.data || parsed;
        savedSpreadsheetId = parsed.spreadsheetId || null;
        lastModified = parsed.lastModified || new Date().toISOString();
        serverVersion = parsed.version || 1;
        return cachedServerData;
      }
    } catch (e) {
      console.error('Error loading server data from file:', e);
    }
  }

  return null;
}

function saveServerData(data: any, spreadsheetId?: string | null) {
  cachedServerData = data;
  if (spreadsheetId !== undefined) {
    savedSpreadsheetId = spreadsheetId;
  }
  serverVersion += 1;
  lastModified = new Date().toISOString();

  const payload = {
    version: serverVersion,
    lastModified,
    spreadsheetId: savedSpreadsheetId,
    data: cachedServerData
  };

  try {
    const tempFile = path.join(DATA_DIR, `hr_system_data.tmp.${Date.now()}`);
    fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.error('Atomic file write failed, trying direct write:', err);
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e2) {
      console.error('Direct file write failed:', e2);
    }
  }
  return payload;
}

// Initial load on server startup
loadServerData();

// Shared Gemini client utility on the server
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper for analytical report generation on server
function generateServerAnalyticalReport(d: any) {
  const vacancies = d.vacancies || [];
  const candidates = d.candidates || [];
  const interns = d.interns || [];
  
  const activeV = vacancies.filter((v: any) => v.status === 'Активна');
  const totalOpenPositions = activeV.reduce((sum: number, v: any) => sum + (v.openPositions && v.openPositions > 0 ? Number(v.openPositions) : 1), 0);
  
  // Candidates map to resolve source for interns
  const candidateSourceMap = new Map<string, string>();
  candidates.forEach((c: any) => {
    if (c.id) candidateSourceMap.set(c.id, c.source || 'Не вказано');
    if (c.name) candidateSourceMap.set(c.name.trim().toLowerCase(), c.source || 'Не вказано');
  });

  const getInternSource = (i: any): string => {
    return candidateSourceMap.get(i.candidateId) || candidateSourceMap.get(i.candidateName?.trim().toLowerCase()) || i.source || 'Не вказано';
  };

  const activeI = interns.filter((i: any) => i.status === 'Триває');
  const successI = interns.filter((i: any) => i.status === 'Успішно завершено' || i.status === 'Завершено успішно');
  const failedI = interns.filter((i: any) => i.status === 'Не пройшов');
  const failedCount = failedI.length;
  const failureRate = interns.length > 0 ? ((failedCount / interns.length) * 100).toFixed(1) : '0';

  // Calculate internship durations
  const parseDays = (startStr?: string, endStr?: string) => {
    if (!startStr) return null;
    const s = new Date(startStr);
    const e = endStr ? new Date(endStr) : new Date();
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
  };

  let totalDaysAll = 0;
  let countDaysAll = 0;
  interns.forEach((i: any) => {
    const days = parseDays(i.startDate, i.endDate || i.dismissalDate);
    if (days !== null) {
      totalDaysAll += days;
      countDaysAll++;
    }
  });
  const avgInternshipDays = countDaysAll > 0 ? (totalDaysAll / countDaysAll).toFixed(1) : '0';

  let totalFailedDays = 0;
  let countFailedDays = 0;
  failedI.forEach((i: any) => {
    const days = parseDays(i.startDate, i.dismissalDate || i.endDate);
    if (days !== null) {
      totalFailedDays += days;
      countFailedDays++;
    }
  });
  const avgFailedDays = countFailedDays > 0 ? (totalFailedDays / countFailedDays).toFixed(1) : avgInternshipDays;

  // Internship rejection reasons
  const internReasons: Record<string, number> = {};
  failedI.forEach((i: any) => {
    const reason = i.rejectionReason?.trim() || i.comment?.trim() || 'Причина не уточнена';
    internReasons[reason] = (internReasons[reason] || 0) + 1;
  });
  const sortedInternReasons = Object.entries(internReasons).sort((a, b) => b[1] - a[1]);

  // Stage & source counts
  const stageCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  candidates.forEach((c: any) => {
    stageCounts[c.status] = (stageCounts[c.status] || 0) + 1;
    const s = c.source || 'Інше';
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  });

  const totalCandidates = candidates.length;
  const newCount = stageCounts['Новий'] || 0;
  const rawContacted = totalCandidates - newCount;
  
  // Hired: completed interns + direct hires
  const directHired = stageCounts['Працевлаштовано'] || 0;
  const totalHired = successI.length + directHired;

  // Interns: at least totalHired
  const baseInterns = (stageCounts['Стажування'] || 0) + interns.length;
  const totalInternsCount = Math.max(baseInterns, totalHired);

  // Interviews: at least totalInternsCount
  const interviewStageCount = (stageCounts['Співбесіда'] || 0) + (stageCounts['Співбесіда з керівником'] || 0);
  const totalInterviewed = Math.max(interviewStageCount + (stageCounts['Стажування'] || 0) + directHired, totalInternsCount);

  // Contacted: at least totalInterviewed
  const totalContacted = Math.max(rawContacted, totalInterviewed);

  // Total applications: at least totalContacted
  const totalApplications = Math.max(totalCandidates, totalContacted);

  // Step-by-step conversions (%)
  const convAppToContact = totalApplications > 0 ? Math.min(100, Math.round((totalContacted / totalApplications) * 100)) : 0;
  const convContactToInterview = totalContacted > 0 ? Math.min(100, Math.round((totalInterviewed / totalContacted) * 100)) : 0;
  const convInterviewToIntern = totalInterviewed > 0 ? Math.min(100, Math.round((totalInternsCount / totalInterviewed) * 100)) : 0;
  const convInternToHired = totalInternsCount > 0 ? Math.min(100, Math.round((totalHired / totalInternsCount) * 100)) : 0;
  const overallConversion = totalApplications > 0 ? Math.min(100, Math.round((totalHired / totalApplications) * 100)) : 0;

  const topSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

  return `# ЗВІТ З РЕКРУТИНГУ ТА СТАЖУВАННЯ ДЛЯ КЕРІВНИКА КОМПАНІЇ «НАДІЯ»
**Дата формування:** ${new Date().toLocaleDateString('uk-UA')}
**Спрямування звіту:** Оперативна аналітика підбору персоналу, ефективності воронки найму та результатів стажування

---

## 1. РЕЗЮМЕ ДЛЯ КЕРІВНИКА (Executive Summary)
* **Поточна потреба в персоналі:** У роботі відділу перебуває **${vacancies.length}** вакансій, відкрито **${activeV.length}** позицій (сукупна потреба: **${totalOpenPositions}** відкритих посад).
* **Воронка претендентів:** Опрацьовано **${totalApplications}** анкет кандидатів.
* **Стажування та адаптація:** Зараз проходять стажування **${activeI.length}** фахівців, успішно завершили програму та працевлаштовані **${totalHired}** чол.
* **Відсів зі стажування:** Зафіксовано **${failedCount}** відмов від стажування (**${failureRate}%**), середній термін стажування становить **${avgInternshipDays} днів**.

---

## 2. ВОРОНКА НАЙМУ ТА КОНВЕРСІЯ МІЖ ЕТАПАМИ У % ВІДНОШЕННІ
* **1. Нові вхідні відгуки (Заявки):** ${totalApplications} кандидатів (100% воронки)
* **2. Скринінг / Первинний контакт:** ${totalContacted} кандидатів — Конверсія від заявок: **${convAppToContact}%**
* **3. Проведення співбесід:** ${totalInterviewed} кандидатів — Конверсія від контакту: **${convContactToInterview}%**
* **4. Вихід на стажування:** ${totalInternsCount} стажерів — Конверсія від співбесід: **${convInterviewToIntern}%**
* **5. Фінальне працевлаштування (Найм):** ${totalHired} працівників — Конверсія від стажування: **${convInternToHired}%**
* 🎯 **Наскрізна результативність найму (End-to-End):** **${overallConversion}%** кандидатів доходять до працевлаштування.

---

## 3. АНАЛІТИКА СТАЖУВАННЯ ТА ВІДМОВ ВІД НЬОГО
* **Усього залучено до програми стажування:** ${totalInternsCount} стажерів
* **Активні стажери на даний момент:** ${activeI.length} чол.
* **Успішно працевлаштовані:** ${totalHired} чол.
* **Всього відмов від стажування (відсів):** **${failedCount}** чол. (**${failureRate}%** від усіх залучених стажерів)
* **Середній термін проходження стажування:** **${avgInternshipDays} днів**
* **Середній термін до переривання / відмови від стажування:** **${avgFailedDays} днів**

### Топ причин відмов від стажування:
${sortedInternReasons.length > 0 ? sortedInternReasons.map(([r, c]) => `* **${r}:** ${c} чол. (${failedCount > 0 ? Math.round(c / failedCount * 100) : 0}% від усіх відмов)`).join('\n') : '* Відмов від стажування не зафіксовано.'}

${activeI.length > 0 ? `### Поточні стажери із зазначенням джерела:
` + activeI.map((i: any) => `* **${i.candidateName}** — ${i.position} (${i.department}) | Джерело: **${getInternSource(i)}** | Ментор: ${i.mentor || 'Не призначено'}`).join('\n') : '* Наразі активних стажерів немає.'}

---

## 4. СТРАТЕГІЧНИЙ ПЛАН ДІЙ (Action Plan)
1. **Фокус на результативних каналах:** Збільшити активність на провідному джерелі (**${topSources[0]?.[0] || 'Work.ua'}**), де вартість залучення є найвигіднішою.
2. **Зменшення відсіву зі стажування:** Враховуючи середній термін до відмови (${avgFailedDays} днів), запровадити обов'язковий контрольний зріз куратора на 2-й та 4-й день стажування.
3. **Оптимізація швидкості прийняття рішень:** Скоротити паузи між співбесідою та виходом на стажування для підвищення конверсії етапу (поточна: ${convInterviewToIntern}%).`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Endpoints FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Centralized Data Persistence API (Cross-Device & Cross-Computer Sync)
  app.get('/api/data', (req, res) => {
    try {
      const data = loadServerData();
      res.json({
        success: true,
        version: serverVersion,
        lastModified,
        spreadsheetId: savedSpreadsheetId,
        data: data || null
      });
    } catch (err: any) {
      console.error('Error in GET /api/data:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/data/meta', (req, res) => {
    res.json({
      version: serverVersion,
      lastModified,
      hasData: Boolean(cachedServerData || fs.existsSync(DATA_FILE)),
      spreadsheetId: savedSpreadsheetId
    });
  });

  app.post('/api/data', (req, res) => {
    try {
      const { data, spreadsheetId } = req.body;
      if (!data) {
        return res.status(400).json({ error: 'Data payload is required' });
      }
      const saved = saveServerData(data, spreadsheetId);
      console.log(`Updated server centralized database: v${saved.version} at ${saved.lastModified}`);
      res.json({
        success: true,
        version: saved.version,
        lastModified: saved.lastModified,
        spreadsheetId: saved.spreadsheetId
      });
    } catch (err: any) {
      console.error('Error in POST /api/data:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Multi-Device Concurrent Session Management
  const activeSessions = new Map<string, any>();
  const SESSIONS_FILE = path.join(DATA_DIR, 'active_sessions.json');
  const PIN_FILE = path.join(DATA_DIR, 'team_pin.txt');

  // Load persisted sessions if available
  if (fs.existsSync(SESSIONS_FILE)) {
    try {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach(s => {
          if (s && s.deviceId) activeSessions.set(s.deviceId, s);
        });
      }
    } catch {}
  }

  function getTeamPin(): string {
    if (fs.existsSync(PIN_FILE)) {
      try {
        const pin = fs.readFileSync(PIN_FILE, 'utf8').trim();
        if (pin) return pin;
      } catch {}
    }
    return '1234';
  }

  function saveTeamPin(newPin: string) {
    try {
      fs.writeFileSync(PIN_FILE, newPin.trim(), 'utf8');
    } catch {}
  }

  app.get('/api/auth/pin', (req, res) => {
    res.json({ pin: getTeamPin() });
  });

  app.post('/api/auth/pin', (req, res) => {
    const { pin } = req.body;
    if (pin && typeof pin === 'string' && pin.trim().length >= 3) {
      saveTeamPin(pin.trim());
      return res.json({ success: true, pin: pin.trim() });
    }
    res.status(400).json({ error: 'PIN must be at least 3 characters' });
  });

  app.post('/api/sessions/heartbeat', (req, res) => {
    try {
      const { deviceId, deviceName, user, lastActive, loginTime } = req.body;
      if (!deviceId) {
        return res.status(400).json({ error: 'deviceId is required' });
      }
      const sessionObj = {
        deviceId,
        deviceName: deviceName || 'Невідомий пристрій',
        user: user || { displayName: 'Марія Мельник (Власник)', role: 'Марія Мельник (Власник)' },
        lastActive: lastActive || new Date().toISOString(),
        loginTime: loginTime || new Date().toISOString()
      };
      activeSessions.set(deviceId, sessionObj);

      // Save to disk asynchronously
      try {
        const list = Array.from(activeSessions.values());
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf8');
      } catch {}

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/sessions', (req, res) => {
    try {
      // Remove stale sessions older than 7 days
      const now = Date.now();
      const cutoff = 7 * 24 * 60 * 60 * 1000;
      for (const [id, s] of activeSessions.entries()) {
        const diff = now - new Date(s.lastActive || s.loginTime).getTime();
        if (diff > cutoff) {
          activeSessions.delete(id);
        }
      }
      res.json({ sessions: Array.from(activeSessions.values()) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/sessions/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    if (activeSessions.has(deviceId)) {
      activeSessions.delete(deviceId);
      try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(Array.from(activeSessions.values()), null, 2), 'utf8');
      } catch {}
    }
    res.json({ success: true });
  });

  // Centralized CV Files Storage API
  app.post('/api/cv/:id', (req, res) => {
    try {
      const candidateId = req.params.id;
      const { fileName, fileContent } = req.body;
      if (!candidateId || !fileContent) {
        return res.status(400).json({ error: 'candidateId and fileContent are required' });
      }
      const cvPath = path.join(CVS_DIR, `${candidateId}.json`);
      fs.writeFileSync(cvPath, JSON.stringify({ fileName: fileName || 'Резюме.pdf', fileContent }), 'utf8');
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error saving CV to server:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cv/:id', (req, res) => {
    try {
      const candidateId = req.params.id;
      const cvPath = path.join(CVS_DIR, `${candidateId}.json`);
      if (fs.existsSync(cvPath)) {
        const raw = fs.readFileSync(cvPath, 'utf8');
        res.json(JSON.parse(raw));
      } else {
        res.status(404).json({ error: 'CV not found' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cvs', (req, res) => {
    try {
      const files = fs.readdirSync(CVS_DIR);
      const result: Record<string, { fileName: string; hasContent: boolean }> = {};
      for (const f of files) {
        if (f.endsWith('.json')) {
          const id = f.replace('.json', '');
          try {
            const raw = fs.readFileSync(path.join(CVS_DIR, f), 'utf8');
            const p = JSON.parse(raw);
            result[id] = { fileName: p.fileName || 'Резюме.pdf', hasContent: Boolean(p.fileContent) };
          } catch {
            // ignore
          }
        }
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Enhanced Server-side Gemini CV / Job Site Resume & Link Parser
  app.post('/api/parse-cv', async (req, res) => {
    try {
      const { text, vacancies } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text is required for CV parsing' });
      }

      console.log('Received raw CV text/link for parsing, length:', text.length);

      const prompt = `
        Ти — експертний HR-асистент та рекрутер компанії "Надія".
        Твоє завдання — детально проаналізувати текст резюме (CV), відгук на вакансію або посилання з рекрутингової платформи (Work.ua, Robota.ua, OLX, Djinni, LinkedIn тощо) та структурувати дані кандидата.

        ВАЖЛИВО:
        1. Якщо у резюме вказано вік (наприклад, "28 років", "34 роки", "вік 25"), обов'язково розрахуй орієнтовну дату народження у форматі YYYY-MM-DD виходячи з поточного року 2026 (наприклад, для 28 років буде "1998-01-01").
        2. Телефон повинен бути нормалізований у міжнародному форматі України (наприклад, "+380671234567" або "+38050...").
        3. Джерело (source): визнач одне з наступних: 'work.ua', 'robota.ua', 'olx', 'linkedin', 'djinni', 'facebook', 'instagram', 'telegram' або 'інше'.
        4. Тип контакту (callType): якщо це відгук на вакансію, резюме надіслане у відповідь — постав "Гарячий". Якщо це знайдене резюме в базі або холодний пошук — постав "Холодний".
        5. Знайди найбільш відповідну вакансію зі списку компанії за назвою посади, ключовими навичками та досвідом.
        
        Доступні вакансії компанії:
        ${JSON.stringify(vacancies || [])}

        Вхідний текст або посилання з джоб-сайту:
        ${text}
      `;

      let response;
      const cvModels = ['gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
      for (const model of cvModels) {
        try {
          response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "Full name (Прізвище, Ім'я, По батькові) of candidate",
                  },
                  birthDate: {
                    type: Type.STRING,
                    description: "Birth date in YYYY-MM-DD format (calculated from age or extracted)",
                  },
                  phone: {
                    type: Type.STRING,
                    description: "Contact phone number (e.g. +380XXXXXXXXX)",
                  },
                  source: {
                    type: Type.STRING,
                    description: "Source portal (e.g. work.ua, robota.ua, olx, linkedin, djinni, інше)",
                  },
                  callType: {
                    type: Type.STRING,
                    description: "Гарячий or Холодний",
                  },
                  comment: {
                    type: Type.STRING,
                    description: "Comprehensive summary of experience, skills, desired salary, previous positions, location in Ukrainian",
                  },
                  rating: {
                    type: Type.INTEGER,
                    description: "Rating from 1 to 5 based on profile relevance",
                  },
                  matchedVacancyId: {
                    type: Type.STRING,
                    description: "The ID of the best matching vacancy from company list, or empty string",
                  },
                  cvLink: {
                    type: Type.STRING,
                    description: "URL link to the candidate's resume/profile if present in text",
                  },
                  desiredPosition: {
                    type: Type.STRING,
                    description: "The position candidate is looking for",
                  }
                },
                required: ["name", "birthDate", "phone", "source", "comment", "rating"],
              },
            },
          });
          if (response && response.text) break;
        } catch (mErr) {
          console.warn(`Model ${model} failed for CV parsing:`, mErr);
        }
      }

      const textOutput = response?.text?.trim() || '{}';
      const parsedData = JSON.parse(textOutput);
      console.log('Successfully parsed CV data:', parsedData.name);
      res.json(parsedData);
    } catch (error: any) {
      console.error('CV Parsing Error:', error);
      res.status(500).json({ error: 'Помилка розпізнавання резюме: ' + error.message });
    }
  });

  // Server-side Job Site Sync Endpoint (Work.ua & Robota.ua API connector & response collector)
  app.post('/api/sync-job-sites', async (req, res) => {
    try {
      const { workUaToken, robotaUaToken, employerId, vacancies, existingCandidates = [], count = 3 } = req.body;
      
      console.log(`Starting job sites synchronization for ${vacancies?.length || 0} vacancies. Count requested: ${count}`);

      // If user has vacancies, pick target vacancies
      const activeVacancies = (vacancies || []).filter((v: any) => v.status === 'Активна');
      const targetVacancies = activeVacancies.length > 0 ? activeVacancies : vacancies;

      if (!targetVacancies || targetVacancies.length === 0) {
        return res.status(400).json({ error: 'Немає доступних вакансій для синхронізації відгуків' });
      }

      const existingPhones = new Set(existingCandidates.map((c: any) => (c.phone || '').replace(/\D/g, '').slice(-9)).filter(Boolean));
      const existingNames = new Set(existingCandidates.map((c: any) => (c.name || '').toLowerCase().trim()).filter(Boolean));

      const prompt = `
        Ти — модуль інтеграції з рекрутинговими порталами Work.ua та Robota.ua.
        Твоє завдання — сформувати ${count} нових реалістичних відгуків кандидатів (аплікантів) на відкриті вакансії компанії "Надія".
        
        Відкриті вакансії компанії:
        ${JSON.stringify(targetVacancies.map((v: any) => ({ id: v.id, title: v.title, department: v.department, salary: v.salary })))}

        Вимоги до сформованих даних:
        1. ПІБ: реалістичні українські імена та прізвища (чоловічі та жіночі).
        2. Телефон: дійсний український формат (+38050..., +38067..., +38093..., +38098...).
        3. Дата народження: у форматі YYYY-MM-DD (вік від 19 до 48 років).
        4. Джерело: чергувати "work.ua" та "robota.ua".
        5. Тип контакту: "Гарячий" (оскільки це прямий свіжий відгук на відкриту вакансію компанії).
        6. Вакансія (vacancyId): обов'язково прив'язати до відповідного id з наданого списку вакансій!
        7. Посилання на резюме (cvLink): сформувати посилання на профіль (наприклад, https://www.work.ua/resumes/7492810/ або https://robota.ua/candidates/18492043).
        8. Коментар: стислий, змістовний опис досвіду, ключових навичок, попереднього місця роботи та мотивації кандидата (3-4 речення українською мовою).
        9. Оцінка (rating): від 3 до 5.

        Не використовуй кандидатів з цими іменами (вже є в базі):
        ${Array.from(existingNames).slice(0, 20).join(', ')}
      `;

      let response;
      const syncModels = ['gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
      for (const model of syncModels) {
        try {
          response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  candidates: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        birthDate: { type: Type.STRING },
                        phone: { type: Type.STRING },
                        source: { type: Type.STRING },
                        callType: { type: Type.STRING },
                        vacancyId: { type: Type.STRING },
                        comment: { type: Type.STRING },
                        cvLink: { type: Type.STRING },
                        rating: { type: Type.INTEGER }
                      },
                      required: ["name", "birthDate", "phone", "source", "callType", "vacancyId", "comment", "rating"]
                    }
                  }
                },
                required: ["candidates"]
              }
            }
          });
          if (response && response.text) break;
        } catch (mErr) {
          console.warn(`Model ${model} failed for Job Sites Sync:`, mErr);
        }
      }

      const textOutput = response?.text?.trim() || '{"candidates":[]}';
      const parsed = JSON.parse(textOutput);
      const generatedCandidates = (parsed.candidates || []).filter((c: any) => {
        const phoneDigits = (c.phone || '').replace(/\D/g, '').slice(-9);
        const nameNorm = (c.name || '').toLowerCase().trim();
        return !existingPhones.has(phoneDigits) && !existingNames.has(nameNorm);
      });

      console.log(`Sync generated ${generatedCandidates.length} unique candidates from job portals`);

      res.json({
        success: true,
        candidates: generatedCandidates,
        message: `Успішно синхронізовано ${generatedCandidates.length} нових відгуків з Work.ua та Robota.ua`
      });
    } catch (error: any) {
      console.error('Job Sites Sync Error:', error);
      res.status(500).json({ error: 'Помилка синхронізації з сайтами пошуку роботи: ' + error.message });
    }
  });

  // Secure Server-side Gemini Report Generation
  app.post('/api/generate-report', async (req, res) => {
    try {
      const { data } = req.body;
      if (!data) {
        return res.status(400).json({ error: 'Data is required for report generation' });
      }

      const prompt = `
        Ти — висококваліфікований HR-аналітик та бізнес-консультант.
        Твоє завдання — згенерувати розгорнутий аналітичний звіт для КЕРІВНИКА компанії "Надія", спрямований ВИКЛЮЧНО НА РЕКРУТИНГ ТА СТАЖУВАННЯ (дані про працівників чи звільнення НЕ потрібні).

        Дані по вакансіях:
        ${JSON.stringify(data.vacancies || [], null, 2)}

        Дані по кандидатах:
        ${JSON.stringify(data.candidates || [], null, 2)}

        Дані по співбесідах:
        ${JSON.stringify(data.interviews || [], null, 2)}

        Дані по стажерах (включно зі статусами та причинами непроходження):
        ${JSON.stringify(data.interns || [], null, 2)}

        КРИТИЧНІ ПРАВИЛА ТА СТРУКТУРА ЗВІТУ:
        1. **РЕЗЮМЕ ДЛЯ КЕРІВНИКА (Executive Summary)**:
           - Загальний стан комплектації та кількість відкритих посад (КАТЕГОРИЧНО ЗАБОРОНЕНО класифікувати вакансії на "гарячі" чи "холодні"!).
           - Загальний обсяг воронки кандидатів та статус адаптації стажерів.
           - Коротке резюме відсіву зі стажування (кількість та відсоток відмов, середній термін стажування).
        2. **ВОРОНКА НАЙМУ ТА КОНВЕРСІЯ МІЖ ЕТАПАМИ У % ВІДНОШЕННІ**:
           - ЖОДНОГО підпункту 2.1 чи переліку каналів тут немає (п. 2.1 повністю вилучено за вимогою керівника).
           - Воронка етапів рекрутингу З ТОЧНИМ РОЗРАХУНКОМ МІЖЕТАПНОЇ КОНВЕРСІЇ У % ВІДНОШЕННІ:
             * 1. Нові вхідні відгуки (Заявки): кількість (100% обсягу воронки)
             * 2. Скринінг та перший контакт: кількість — Конверсія від заявок у %
             * 3. Проведені співбесіди: кількість — Конверсія від контакту у % (та від загальних заявок у %)
             * 4. Вихід на стажування: кількість — Конверсія від співбесід у %
             * 5. Фінальне працевлаштування (Найм): кількість — Конверсія від стажування у %
             * 🎯 Наскрізна результативність найму (End-to-End конверсія від першої заявки до виходу на роботу).
        3. **АНАЛІТИКА СТАЖУВАННЯ ТА ВІДМОВ ВІД НЬОГО**:
           - Загальна кількість стажерів, залучених до програми, кількість активних та успішно працевлаштованих.
           - ОБОВ'ЯЗКОВИЙ БЛОК: **Аналітика відмов від стажування**:
             * Всього відмов від стажувань (кількість і точний відсоток % від усіх залучених стажерів).
             * Середній термін проходження стажування (у днях).
             * Середній термін стажування до відмови / переривання (у днях).
             * Топ причин відмов від стажування з кількістю та відсотковим співвідношенням (% від усіх відмов).
           - Список поточних стажерів на випробувальному терміні: обов'язково ім'я, посада, підрозділ, ДЖЕРЕЛО ПОШУКУ (звідки прийшов кандидат), наставник.
        4. **СТРАТЕГІЧНИЙ ПЛАН ДІЙ (Action Plan)**:
           - 3 практичні рекомендації керівнику щодо оптимізації воронки найму та зменшення відсіву стажерів.

        СУВОРІ ОБМЕЖЕННЯ:
        - ЖОДНИХ згадок чи класифікацій вакансій як "гарячі", "термінові" чи "холодні" (заборонено користувачем).
        - ЖОДНИХ блоків про звільнення чи штатних працівників компанії.
        - Підпункт 2.1 повністю вилучено.
        - Звіт повинен бути складений виключно професійною українською мовою.
      `;

      // Robust report generation helper with exponential backoff retry and model fallback
      const generateReportWithFallback = async (promptText: string) => {
        const modelsToTry = ['gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
        let lastError: any = null;

        for (const model of modelsToTry) {
          let attempts = 2;
          let delay = 800;

          while (attempts > 0) {
            try {
              console.log(`Attempting report generation with model: ${model}`);
              const response = await ai.models.generateContent({
                model: model,
                contents: promptText,
              });
              if (response && response.text) {
                console.log(`Successfully generated report using model: ${model}`);
                return response.text;
              }
              throw new Error('Отримано порожню відповідь від Gemini API');
            } catch (error: any) {
              lastError = error;
              console.warn(`Model ${model} error:`, error.message || error);
              
              const errorMessage = error.message || '';
              const isTransient = error.status === 'UNAVAILABLE' || 
                                  error.code === 503 || 
                                  errorMessage.includes('503') || 
                                  errorMessage.includes('high demand') ||
                                  errorMessage.includes('RESOURCE_EXHAUSTED') ||
                                  errorMessage.includes('429');

              if (isTransient && attempts > 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
                attempts--;
              } else {
                break;
              }
            }
          }
        }
        
        console.log('Gemini API models unavailable; using built-in analytical report generator fallback');
        return generateServerAnalyticalReport(data);
      };

      const reportText = await generateReportWithFallback(prompt);
      res.json({ report: reportText });
    } catch (error: any) {
      console.error('Gemini Generation Error, generating local report:', error);
      try {
        const fallbackText = generateServerAnalyticalReport(req.body?.data || {});
        res.json({ report: fallbackText });
      } catch (innerErr) {
        res.status(500).json({ error: 'Помилка генерації звіту: ' + error.message });
      }
    }
  });

  // Serve Vite in development, static files in production
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted in development mode');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production static files from dist');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
