import { HRSystemData, Vacancy, Candidate, Interview, Intern, FiredEmployee, InterviewResult, CalendarEvent } from '../types';

const DATABASE_FILE_NAME = 'HR_System_Database_Nadiya';

// Cache for verified spreadsheets to prevent redundant metadata checks on every save
const verifiedSheetsCache = new Set<string>();

// Fetch wrapper with automatic retry logic for transient errors (503 Service Unavailable, 429 Rate Limit, 500, 502, 504) and network drops
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 4): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(url, options);
      const isTransient = res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504;
      if (isTransient && attempt < maxRetries) {
        attempt++;
        const delay = Math.min(10000, Math.pow(2, attempt) * 1200 + Math.floor(Math.random() * 600));
        console.warn(`Google Sheets API returned ${res.status}. Retrying attempt ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      return res;
    } catch (networkErr: any) {
      if (attempt < maxRetries) {
        attempt++;
        const delay = Math.min(10000, Math.pow(2, attempt) * 1200 + Math.floor(Math.random() * 600));
        console.warn(`Network error during Google Sheets request: ${networkErr?.message || networkErr}. Retrying attempt ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw networkErr;
    }
  }
}

// Helper to translate and enrich Google API fetch errors
async function handleResponseError(res: Response, defaultMsg: string): Promise<never> {
  if (res.status === 401) {
    localStorage.removeItem('oauth_access_token');
    throw new Error('Термін дії сесії Google закінчився. Будь ласка, вийдіть зі свого Google-акаунту праворуч вгорі та увійдіть знову, щоб оновити підключення.');
  }
  if (res.status === 403) {
    throw new Error('Доступ заборонено. Будь ласка, переконайтеся, що ви надали додатку повні дозволи на редагування файлів у Google Drive / Sheets під час авторизації.');
  }
  if (res.status === 404) {
    throw new Error(`Не вдалося знайти потрібний файл Google Таблиці. Можливо, його було видалено або перейменовано.`);
  }
  if (res.status === 429) {
    throw new Error('Перевищено ліміт запитів Google Sheets API (429 Quota Exceeded). Зачекайте 10–15 секунд і зачекайтеавтоматичного збереження.');
  }

  let detail = '';
  try {
    const errBody = await res.json();
    if (errBody && errBody.error && errBody.error.message) {
      detail = errBody.error.message;
    }
  } catch {
    // Не вдалося розпарсити JSON
  }

  throw new Error(`${defaultMsg} (Код помилки: ${res.status}${detail ? `, деталі: ${detail}` : ''})`);
}

// Find the spreadsheet in the user's Google Drive
export async function findSpreadsheet(accessToken: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`name = '${DATABASE_FILE_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
    const res = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 404) {
        console.warn(`Drive search returned ${res.status}. Falling back to automatic spreadsheet creation via Sheets API.`);
        return null;
      }
      await handleResponseError(res, 'Drive search failed');
    }
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (error: any) {
    console.warn('Error finding spreadsheet in Google Drive:', error);
    // If permission or 403 error during search, return null to proceed with Sheets API creation
    if (error?.message?.includes('403') || error?.message?.includes('Доступ заборонено') || error?.message?.includes('Drive search failed')) {
      return null;
    }
    throw error;
  }
}

// Get the sheet web view link
export async function getSpreadsheetLink(accessToken: string, spreadsheetId: string): Promise<string> {
  try {
    const res = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=webViewLink`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.webViewLink) return data.webViewLink;
    }
  } catch {
    // ignore
  }
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

// Create a new spreadsheet
export async function createSpreadsheet(accessToken: string): Promise<string> {
  const res = await fetchWithRetry('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: DATABASE_FILE_NAME,
      },
      sheets: [
        { properties: { title: 'Вакансії' } },
        { properties: { title: 'Кандидати' } },
        { properties: { title: 'Співбесіди' } },
        { properties: { title: 'Стажери' } },
        { properties: { title: 'Звільнені' } }
      ]
    }),
  });
  if (!res.ok) {
    await handleResponseError(res, 'Не вдалося створити Google Таблицю');
  }
  const data = await res.json();
  return data.spreadsheetId;
}

// Helper to convert sheet values to objects, filtering out empty rows and ensuring unique IDs
function parseRows<T extends { id: string }>(rows: string[][], mapper: (row: string[]) => T): T[] {
  if (!rows || rows.length <= 1) return [];
  const parsed = rows.slice(1)
    .filter(row => row && row.length > 0 && row[0] && row[0].trim() !== '')
    .map(mapper);

  const seen = new Set<string>();
  return parsed.filter(item => {
    if (!item.id || seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

// Read data from a specific sheet tab
export async function readSheetRange(accessToken: string, spreadsheetId: string, range: string): Promise<string[][]> {
  const encodedRange = encodeURIComponent(range);
  const res = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    await handleResponseError(res, `Не вдалося прочитати дані з вкладки ${range}`);
  }
  const data = await res.json();
  return data.values || [];
}

// Write (overwrite) a range
export async function writeSheetRange(accessToken: string, spreadsheetId: string, range: string, values: string[][]) {
  const encodedRange = encodeURIComponent(range);
  const res = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values,
    }),
  });
  if (!res.ok) {
    await handleResponseError(res, `Не вдалося записати дані у вкладку ${range}`);
  }
}

// Load entire system data from Google Sheets
export async function loadDataFromSheets(accessToken: string, spreadsheetId: string): Promise<HRSystemData | null> {
  try {
    // Ensure required tabs exist before attempting to read them
    await ensureSheetsExist(accessToken, spreadsheetId);

    const sheetRanges = [
      "'Вакансії'!A:Z",
      "'Кандидати'!A:Z",
      "'Співбесіди'!A:Z",
      "'Стажери'!A:Z",
      "'Звільнені'!A:Z",
      "'Посади'!A:Z",
      "'Підрозділи'!A:Z",
      "'Календар'!A:Z",
      "'Етапи підбору'!A:Z",
      "'Джерела кандидатів'!A:Z",
      "'Статуси співбесід'!A:Z",
      "'Результати співбесід'!A:Z",
      "'Статуси стажування'!A:Z"
    ];

    let vacancyRows: string[][] = [];
    let candidateRows: string[][] = [];
    let interviewRows: string[][] = [];
    let internRows: string[][] = [];
    let firedRows: string[][] = [];
    let positionRows: string[][] = [];
    let departmentRows: string[][] = [];
    let calendarRows: string[][] = [];
    let stageRows: string[][] = [];
    let sourceRows: string[][] = [];
    let interviewStatusRows: string[][] = [];
    let interviewResultRows: string[][] = [];
    let internStatusRows: string[][] = [];

    // Use single batchGet call for fast, atomic, quota-friendly retrieval
    const queryParams = sheetRanges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const batchRes = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${queryParams}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (batchRes.ok) {
      const batchData = await batchRes.json();
      const valueRanges: { range: string; values?: string[][] }[] = batchData.valueRanges || [];

      valueRanges.forEach((vr, index) => {
        const rangeName = vr.range || sheetRanges[index] || '';
        const vals = vr.values || [];
        if (rangeName.includes('Вакансії')) vacancyRows = vals;
        else if (rangeName.includes('Кандидати')) candidateRows = vals;
        else if (rangeName.includes('Співбесіди')) interviewRows = vals;
        else if (rangeName.includes('Стажери')) internRows = vals;
        else if (rangeName.includes('Звільнені')) firedRows = vals;
        else if (rangeName.includes('Посади')) positionRows = vals;
        else if (rangeName.includes('Підрозділи')) departmentRows = vals;
        else if (rangeName.includes('Календар')) calendarRows = vals;
        else if (rangeName.includes('Етапи підбору')) stageRows = vals;
        else if (rangeName.includes('Джерела кандидатів')) sourceRows = vals;
        else if (rangeName.includes('Статуси співбесід')) interviewStatusRows = vals;
        else if (rangeName.includes('Результати співбесід')) interviewResultRows = vals;
        else if (rangeName.includes('Статуси стажування')) internStatusRows = vals;
      });
    } else {
      console.warn('batchGet returned non-ok status, falling back to readSheetRange');
      // Fallback in case batchGet failed
      const results: string[][][] = [];
      for (const range of sheetRanges) {
        try {
          const rows = await readSheetRange(accessToken, spreadsheetId, range);
          results.push(rows);
        } catch (e) {
          console.warn(`Could not read ${range}, using empty array`, e);
          results.push([]);
        }
      }
      [
        vacancyRows, candidateRows, interviewRows, internRows, firedRows,
        positionRows, departmentRows, calendarRows,
        stageRows, sourceRows, interviewStatusRows, interviewResultRows, internStatusRows
      ] = results;
    }

    const vacancies: Vacancy[] = parseRows(vacancyRows, (row) => ({
      id: row[0] || '',
      title: row[1] || '',
      department: row[2] || '',
      status: (row[3] as any) || 'Активна',
      salary: row[4] || '',
      createdAt: row[5] || '',
      closeDate: row[6] || undefined,
      schedule: row[7] || '',
      requirements: row[8] || '',
      duties: row[9] || '',
      isAlwaysOpen: row[10] === 'Так',
      priority: (row[11] === 'Холодна' ? 'Холодна' : (row[11] === 'Гаряча' || row[11] === 'Термінова' || row[11] === 'Критична' || row[11] === 'Висока' ? 'Гаряча' : 'Звичайна')),
    }));

    const candidates: Candidate[] = parseRows(candidateRows, (row) => ({
      id: row[0] || '',
      name: row[1] || '',
      birthDate: row[2] || '',
      contactDate: row[3] || '',
      callType: (row[4] as any) || 'Гарячий',
      source: (row[5] || '').includes('(') ? (row[5] || '').replace(/\s*\([^)]*\)\s*$/, '').trim() : (row[5] || ''),
      sourceDetails: (row[5] || '').includes('(') ? (row[5] || '').match(/\(([^)]+)\)/)?.[1]?.trim() : undefined,
      vacancyId: row[6] || '',
      status: (row[7] as any) || 'Новий',
      phone: row[8] || '',
      comment: row[9] || '',
      rating: Number(row[10]) || 3,
      appliedAt: row[11] || '',
      rejectionReason: row[12] || '',
      hasDocuments: row[13] === 'Так',
      cvLink: row[14] || undefined,
      cvFileName: row[15] || undefined,
      cvFileContent: row[16] || undefined,
    }));

    const interviews: Interview[] = parseRows(interviewRows, (row) => ({
      id: row[0] || '',
      candidateId: row[1] || '',
      candidateName: row[2] || '',
      dateTime: row[3] || '',
      interviewer: row[4] || '',
      feedback: row[5] || '',
      rating: Number(row[6]) || 3,
      status: (row[7] as any) || 'Заплановано',
      result: (row[8] as InterviewResult) || 'Очікує рішення',
      rejectionReason: row[9] || undefined,
      feedbackGiven: row[10] === 'Так' || row[10] === 'true',
      feedbackGivenAt: row[11] || undefined,
      feedbackChannel: (row[12] as any) || undefined,
      feedbackOutcome: row[13] || undefined,
      feedbackComment: row[14] || undefined,
      feedbackAttempts: Number(row[15]) || undefined,
      lastAttemptAt: row[16] || undefined,
    }));

    const interns: Intern[] = parseRows(internRows, (row) => ({
      id: row[0] || '',
      candidateId: row[1] || '',
      candidateName: row[2] || '',
      birthDate: row[3] || '',
      phone: row[4] || '',
      position: row[5] || '',
      department: row[6] || '',
      startDate: row[7] || '',
      endDate: row[8] || '',
      mentor: row[9] || '',
      project: row[10] || '',
      progress: Number(row[11]) || 0,
      status: (row[12] as any) || 'Триває',
      rating: Number(row[13]) || 3,
      comment: row[14] || '',
      rejectionReason: row[15] || undefined,
      hasDocuments: row[16] === 'Так',
    }));

    const firedEmployees: FiredEmployee[] = parseRows(firedRows, (row) => ({
      id: row[0] || '',
      name: row[1] || '',
      position: row[2] || '',
      department: row[3] || '',
      startDate: row[4] || '',
      endDate: row[5] || '',
      tenureMonths: Number(row[6]) || 0,
      reason: row[7] || '',
      exitNotes: row[8] || '',
      phone: row[9] || '',
      email: row[10] || '',
      hasDocumentsReturned: row[11] === 'Так',
      transferCaseNotes: row[12] || '',
      fileLink: row[13] || '',
    }));

    const positionsList: string[] = positionRows && positionRows.length > 1
      ? positionRows.slice(1).map(r => r[0]).filter(Boolean)
      : [];

    const departmentsList: string[] = departmentRows && departmentRows.length > 1
      ? departmentRows.slice(1).map(r => r[0]).filter(Boolean)
      : [];

    const stagesList: string[] = stageRows && stageRows.length > 1
      ? stageRows.slice(1).map(r => r[0]).filter(Boolean)
      : [];

    const sourcesList: string[] = sourceRows && sourceRows.length > 1
      ? sourceRows.slice(1).map(r => r[0]).filter(Boolean)
      : [];

    const interviewStatusesList: string[] = interviewStatusRows && interviewStatusRows.length > 1
      ? interviewStatusRows.slice(1).map(r => r[0]).filter(Boolean)
      : [];

    const interviewResultsList: string[] = interviewResultRows && interviewResultRows.length > 1
      ? interviewResultRows.slice(1).map(r => r[0]).filter(Boolean)
      : [];

    const internStatusesList: string[] = internStatusRows && internStatusRows.length > 1
      ? internStatusRows.slice(1).map(r => r[0]).filter(Boolean)
      : [];

    const calendarEvents: CalendarEvent[] = parseRows(calendarRows, (row) => ({
      id: row[0] || '',
      title: row[1] || '',
      dateTime: row[2] || '',
      description: row[3] || '',
      candidateId: row[4] || undefined,
      isNotificationSent: row[5] === 'Так',
    }));

    return { 
      vacancies, 
      candidates, 
      interviews, 
      interns, 
      firedEmployees,
      positionsList: positionsList.length > 0 ? positionsList : undefined,
      departmentsList: departmentsList.length > 0 ? departmentsList : undefined,
      stagesList: stagesList.length > 0 ? stagesList : undefined,
      sourcesList: sourcesList.length > 0 ? sourcesList : undefined,
      interviewStatusesList: interviewStatusesList.length > 0 ? interviewStatusesList : undefined,
      interviewResultsList: interviewResultsList.length > 0 ? interviewResultsList : undefined,
      internStatusesList: internStatusesList.length > 0 ? internStatusesList : undefined,
      calendarEvents: calendarEvents.length > 0 ? calendarEvents : []
    };
  } catch (error) {
    console.error('Error loading data from Google Sheets:', error);
    throw error;
  }
}

// Helper to verify and auto-create required tabs if they are missing
export async function ensureSheetsExist(accessToken: string, spreadsheetId: string): Promise<void> {
  if (verifiedSheetsCache.has(spreadsheetId)) {
    return; // Already verified in this session
  }

  try {
    const res = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(title)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      await handleResponseError(res, 'Не вдалося отримати метадані Google Таблиці');
    }
    const data = await res.json();
    const existingTitles = data.sheets?.map((s: any) => s.properties.title) || [];
    const requiredTitles = [
      'Вакансії', 'Кандидати', 'Співбесіди', 'Стажери', 'Звільнені', 
      'Посади', 'Підрозділи', 'Календар',
      'Етапи підбору', 'Джерела кандидатів', 'Статуси співбесід', 'Результати співбесід', 'Статуси стажування'
    ];
    const missing = requiredTitles.filter(title => !existingTitles.includes(title));

    if (missing.length > 0) {
      const requests = missing.map(title => ({
        addSheet: {
          properties: { title }
        }
      }));
      const updateRes = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });
      if (!updateRes.ok) {
        await handleResponseError(updateRes, 'Не вдалося створити відсутні вкладки таблиці');
      }
    }

    verifiedSheetsCache.add(spreadsheetId);
  } catch (error) {
    console.error('Error in ensureSheetsExist:', error);
    throw error;
  }
}

function safeCell(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.length > 40000) {
    if (str.startsWith('data:')) {
      return '[Файл занадто великий для комірки Google Таблиць]';
    }
    return str.slice(0, 40000) + '... [обрізано]';
  }
  return str;
}

function sanitizeRows(rows: any[][]): string[][] {
  return (rows || []).map(row => (row || []).map(cell => safeCell(cell)));
}

// Write entire system data to Google Sheets using a single batchUpdate API call
export async function saveDataToSheets(accessToken: string, spreadsheetId: string, data: HRSystemData): Promise<void> {
  // Ensure required tabs are present in the sheet
  await ensureSheetsExist(accessToken, spreadsheetId);

  const vacancyRows = [
    ['ID', 'Назва вакансії', 'Департамент', 'Статус', 'Оклад', 'Дата відкриття', 'Дата закриття', 'Графік роботи', 'Вимоги', 'Обов\'язки', 'Постійно відкрита (на перспективу)', 'Терміновість'],
    ...data.vacancies.map(v => [
      v.id, 
      v.title, 
      v.department, 
      v.status, 
      v.salary, 
      v.createdAt, 
      v.closeDate || '', 
      v.schedule || '', 
      v.requirements || '', 
      v.duties || '', 
      v.isAlwaysOpen ? 'Так' : 'Ні',
      v.priority || 'Звичайна'
    ])
  ];

  const candidateRows = [
    ['ID', 'ПІБ', 'Дата народження', 'Дата контакту', 'Тип дзвінка', 'Джерело', 'ID вакансії', 'Статус', 'Телефон', 'Коментар', 'Оцінка', 'Дата подачі', 'Причина відхилення', 'Наявність документів', 'Посилання на резюме', 'Назва файлу резюме', 'Файл резюме'],
    ...data.candidates.map(c => [
      c.id, 
      c.name, 
      c.birthDate || '', 
      c.contactDate || '', 
      c.callType || 'Гарячий', 
      c.source ? (c.sourceDetails ? `${c.source} (${c.sourceDetails})` : c.source) : '', 
      c.vacancyId, 
      c.status, 
      c.phone || '', 
      c.comment || '', 
      String(c.rating), 
      c.appliedAt,
      c.rejectionReason || '',
      c.hasDocuments ? 'Так' : 'Ні',
      c.cvLink || '',
      c.cvFileName || '',
      (c.cvFileContent && c.cvFileContent.length > 30000)
        ? `[Файл завантажено локально: ${c.cvFileName || 'resume.pdf'}]`
        : (c.cvFileContent || '')
    ])
  ];

  const interviewRows = [
    ['ID', 'Кандидат ID', 'Кандидат ПІБ', 'Дата та час', 'Інтерв\'юер', 'Коментар/Фідбек', 'Оцінка', 'Статус співбесіди', 'Результат', 'Причина відмови', 'Зворотний зв\'язок надано', 'Дата зворотного зв\'язку', 'Канал зв\'язку', 'Результат розмови', 'Коментар дзвінка', 'Спроби зв\'язку', 'Остання спроба'],
    ...data.interviews.map(i => [
      i.id, 
      i.candidateId, 
      i.candidateName, 
      i.dateTime, 
      i.interviewer, 
      i.feedback || '', 
      String(i.rating), 
      i.status, 
      i.result || 'Очікує рішення',
      i.rejectionReason || '',
      i.feedbackGiven ? 'Так' : 'Ні',
      i.feedbackGivenAt || '',
      i.feedbackChannel || '',
      i.feedbackOutcome || '',
      i.feedbackComment || '',
      i.feedbackAttempts ? String(i.feedbackAttempts) : '',
      i.lastAttemptAt || ''
    ])
  ];

  const internRows = [
    ['ID', 'Кандидат ID', 'Кандидат ПІБ', 'Дата народження', 'Контактний номер', 'Посада де стажується', 'Підрозділ', 'Дата початку', 'Дата завершення', 'Ментор', 'Проект', 'Прогрес (%)', 'Статус стажування', 'Оцінка стажера', 'Коментар стажера', 'Причина чому не пройшов', 'Наявність документів'],
    ...data.interns.map(in_ => [
      in_.id, 
      in_.candidateId, 
      in_.candidateName, 
      in_.birthDate || '', 
      in_.phone || '', 
      in_.position || '', 
      in_.department || '', 
      in_.startDate, 
      in_.endDate, 
      in_.mentor, 
      in_.project || '', 
      String(in_.progress), 
      in_.status, 
      String(in_.rating || 3),
      in_.comment || '',
      in_.rejectionReason || '',
      in_.hasDocuments ? 'Так' : 'Ні'
    ])
  ];

  const firedRows = [
    ['ID', 'Ім\'я', 'Посада', 'Департамент', 'Дата початку', 'Дата завершення', 'Термін роботи (міс)', 'Причина звільнення', 'Нотатки вихідного інтерв\'ю', 'Телефон', 'Email', 'Обхідний лист/Майно', 'Передача справ', 'Наказ/Заява'],
    ...data.firedEmployees.map(f => [
      f.id, 
      f.name, 
      f.position, 
      f.department, 
      f.startDate, 
      f.endDate, 
      String(f.tenureMonths), 
      f.reason, 
      f.exitNotes || '',
      f.phone || '',
      f.email || '',
      f.hasDocumentsReturned ? 'Так' : 'Ні',
      f.transferCaseNotes || '',
      f.fileLink || ''
    ])
  ];

  const positionRows = [
    ['Назва'],
    ...(data.positionsList || []).map(p => [p])
  ];

  const departmentRows = [
    ['Назва'],
    ...(data.departmentsList || []).map(d => [d])
  ];

  const calendarRows = [
    ['ID', 'Заголовок', 'Дата та час', 'Опис', 'Кандидат ID', 'Сповіщено'],
    ...(data.calendarEvents || []).map(e => [
      e.id,
      e.title,
      e.dateTime,
      e.description || '',
      e.candidateId || '',
      e.isNotificationSent ? 'Так' : 'Ні'
    ])
  ];

  const stageRows = [
    ['Назва'],
    ...(data.stagesList || []).map(s => [s])
  ];

  const sourceRows = [
    ['Назва'],
    ...(data.sourcesList || []).map(s => [s])
  ];

  const interviewStatusRows = [
    ['Назва'],
    ...(data.interviewStatusesList || []).map(s => [s])
  ];

  const interviewResultRows = [
    ['Назва'],
    ...(data.interviewResultsList || []).map(r => [r])
  ];

  const internStatusRows = [
    ['Назва'],
    ...(data.internStatusesList || []).map(s => [s])
  ];

  const rangesToClear = [
    "'Вакансії'!A:Z",
    "'Кандидати'!A:Z",
    "'Співбесіди'!A:Z",
    "'Стажери'!A:Z",
    "'Звільнені'!A:Z",
    "'Посади'!A:Z",
    "'Підрозділи'!A:Z",
    "'Календар'!A:Z",
    "'Етапи підбору'!A:Z",
    "'Джерела кандидатів'!A:Z",
    "'Статуси співбесід'!A:Z",
    "'Результати співбесід'!A:Z",
    "'Статуси стажування'!A:Z"
  ];

  const dataRanges = [
    { range: "'Вакансії'!A1", values: sanitizeRows(vacancyRows) },
    { range: "'Кандидати'!A1", values: sanitizeRows(candidateRows) },
    { range: "'Співбесіди'!A1", values: sanitizeRows(interviewRows) },
    { range: "'Стажери'!A1", values: sanitizeRows(internRows) },
    { range: "'Звільнені'!A1", values: sanitizeRows(firedRows) },
    { range: "'Посади'!A1", values: sanitizeRows(positionRows) },
    { range: "'Підрозділи'!A1", values: sanitizeRows(departmentRows) },
    { range: "'Календар'!A1", values: sanitizeRows(calendarRows) },
    { range: "'Етапи підбору'!A1", values: sanitizeRows(stageRows) },
    { range: "'Джерела кандидатів'!A1", values: sanitizeRows(sourceRows) },
    { range: "'Статуси співбесід'!A1", values: sanitizeRows(interviewStatusRows) },
    { range: "'Результати співбесід'!A1", values: sanitizeRows(interviewResultRows) },
    { range: "'Статуси стажування'!A1", values: sanitizeRows(internStatusRows) },
  ].map(item => ({
    range: item.range,
    values: item.values || []
  }));

  try {
    // 1. Clear previous ranges so deleted entries don't leave phantom rows
    try {
      await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ranges: rangesToClear }),
      });
    } catch (clearErr) {
      console.warn('Non-fatal clear error before batchUpdate:', clearErr);
    }

    // 2. Single batchUpdate call for all sheets with dynamic unbounded row sizes
    const res = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: dataRanges,
      }),
    });

    if (!res.ok) {
      await handleResponseError(res, 'Не вдалося зберегти дані в Google Таблицю');
    }
  } catch (error) {
    console.error('Error saving data to Google Sheets:', error);
    throw error;
  }
}

