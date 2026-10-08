/**
 * Formats any date string (including ISO formats like YYYY-MM-DD) into Ukrainian DD.MM.YYYY format.
 */
export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  const trimmed = dateStr.trim();
  if (!trimmed) return '-';
  
  // If it's already in DD.MM.YYYY format, return it
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  
  try {
    // If it has a date-time separator, take only the date part
    const datePart = trimmed.split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    
    // Check if it's YYYY-MM-DD
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[0]}`;
    }
    
    // Try native Date parsing as fallback
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    }
  } catch (e) {
    // fallback to returning original trimmed string
  }
  
  return trimmed;
}

/**
 * Formats a date-time string into DD.MM.YYYY HH:mm format.
 */
export function formatDateTime(dateTimeStr: string | undefined | null): string {
  if (!dateTimeStr) return '-';
  const trimmed = dateTimeStr.trim();
  if (!trimmed) return '-';

  try {
    // Check if already in DD.MM.YYYY HH:mm format
    if (/^\d{2}\.\d{2}\.\d{4}\s\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const tIndex = trimmed.indexOf('T');
    const spaceIndex = trimmed.indexOf(' ');
    const sepIndex = tIndex !== -1 ? tIndex : spaceIndex;

    let datePart = trimmed;
    let timePart = '';

    if (sepIndex !== -1) {
      datePart = trimmed.substring(0, sepIndex);
      timePart = trimmed.substring(sepIndex + 1);
    }

    const formattedDate = formatDate(datePart);
    
    if (timePart) {
      // Clean up time part to HH:mm
      const timeClean = timePart.split('.')[0].split('+')[0]; // strip ms/timezone if present
      const timeParts = timeClean.split(':');
      if (timeParts.length >= 2) {
        return `${formattedDate} ${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
      }
    }

    return formattedDate;
  } catch (e) {
    // fallback to returning original trimmed string
  }

  return trimmed;
}

/**
 * Returns detailed tenure breakdown (years, months, days, total months) between start and end dates.
 * End date is treated as inclusive (the employee's last working day).
 */
export interface TenureDetails {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
  totalDays: number;
  formatted: string;
}

export function calculateTenureDetails(
  startDateStr: string | undefined | null,
  endDateStr: string | undefined | null
): TenureDetails {
  if (!startDateStr || !endDateStr) {
    return { years: 0, months: 0, days: 0, totalMonths: 0, totalDays: 0, formatted: '0 міс.' };
  }

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return { years: 0, months: 0, days: 0, totalMonths: 0, totalDays: 0, formatted: '0 міс.' };
  }

  // Effective end date is end date + 1 day (since the end date is inclusive last day worked)
  const effEnd = new Date(end);
  effEnd.setDate(effEnd.getDate() + 1);

  let years = effEnd.getFullYear() - start.getFullYear();
  let months = effEnd.getMonth() - start.getMonth();
  let days = effEnd.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    // Get total days in the month prior to effEnd
    const prevMonthLastDay = new Date(effEnd.getFullYear(), effEnd.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  // Calculate total months (if remaining days >= 15, round up 1 month)
  let totalMonths = years * 12 + months + (days >= 15 ? 1 : 0);
  
  // If total duration is less than 15 days but at least 1 day, ensure totalMonths is at least 1 if rounded
  if (totalMonths === 0 && (years > 0 || months > 0 || days > 0)) {
    totalMonths = 1;
  }

  const totalDays = Math.max(0, Math.round((effEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  // Build human readable formatted string in Ukrainian
  const parts: string[] = [];

  if (years > 0) {
    if (years === 1) parts.push('1 рік');
    else if (years >= 2 && years <= 4) parts.push(`${years} роки`);
    else parts.push(`${years} років`);
  }

  if (months > 0) {
    if (months === 1) parts.push('1 міс.');
    else if (months >= 2 && months <= 4) parts.push(`${months} міс.`);
    else parts.push(`${months} міс.`);
  }

  if (days > 0 && years === 0 && months === 0) {
    if (days === 1) parts.push('1 день');
    else if (days >= 2 && days <= 4) parts.push(`${days} дні`);
    else parts.push(`${days} днів`);
  } else if (days > 0 && years === 0 && months < 3) {
    parts.push(`${days} дн.`);
  }

  let formatted = parts.join(' ');
  if (!formatted) {
    formatted = '0 днів';
  }

  return {
    years,
    months,
    days,
    totalMonths: Math.max(0, totalMonths),
    totalDays: Math.max(0, totalDays),
    formatted
  };
}

/**
 * Calculates total tenure months between start and end dates.
 */
export function calculateTenureMonths(
  startDateStr: string | undefined | null,
  endDateStr: string | undefined | null
): number {
  return calculateTenureDetails(startDateStr, endDateStr).totalMonths;
}

/**
 * Formats tenure between start and end dates into a readable Ukrainian string e.g. "1 рік 5 міс." or "12 днів".
 */
export function formatTenure(
  startDateStr: string | undefined | null,
  endDateStr: string | undefined | null,
  fallbackMonths?: number
): string {
  if (startDateStr && endDateStr) {
    const details = calculateTenureDetails(startDateStr, endDateStr);
    if (details.formatted && details.formatted !== '0 днів') {
      return details.formatted;
    }
  }

  if (fallbackMonths && fallbackMonths > 0) {
    const y = Math.floor(fallbackMonths / 12);
    const m = fallbackMonths % 12;
    if (y > 0 && m > 0) return `${y} р. ${m} міс.`;
    if (y > 0) return `${y} р.`;
    return `${m} міс.`;
  }

  return '0 міс.';
}

/**
 * Returns today's date in YYYY-MM-DD format (local timezone).
 */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date and time in YYYY-MM-DDTHH:mm format (local timezone).
 */
export function getTodayDateTimeString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export interface ParsedDateComponents {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hours: number; // 0-23
  minutes: number; // 0-59
  hasTime: boolean;
  dateKey: string; // 'YYYY-MM-DD'
  monthKey: string; // 'YYYY-MM'
  timestamp: number;
  isValid: boolean;
}

/**
 * Universal date parser that handles ISO (YYYY-MM-DD), Ukrainian (DD.MM.YYYY),
 * date-times with T or space separators, and time offsets.
 */
export function parseDateComponents(dateStr: string | undefined | null): ParsedDateComponents {
  if (!dateStr) {
    return { year: 0, month: 0, day: 0, hours: 0, minutes: 0, hasTime: false, dateKey: '', monthKey: '', timestamp: 0, isValid: false };
  }

  const clean = dateStr.trim();
  if (!clean) {
    return { year: 0, month: 0, day: 0, hours: 0, minutes: 0, hasTime: false, dateKey: '', monthKey: '', timestamp: 0, isValid: false };
  }

  let y = 0, m = 0, d = 0, hh = 0, mm = 0;
  let hasTime = false;

  // 1. Format: YYYY-MM-DD...
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const datePart = clean.substring(0, 10);
    const [year, month, day] = datePart.split('-').map(Number);
    y = year; m = month; d = day;

    if (clean.includes('T') || clean.includes(' ')) {
      const timePart = clean.includes('T') ? clean.split('T')[1] : clean.split(' ')[1];
      if (timePart) {
        const cleanTime = timePart.split('.')[0].split('+')[0].split('Z')[0];
        const tParts = cleanTime.split(':').map(Number);
        if (tParts.length >= 1 && !isNaN(tParts[0])) {
          hh = tParts[0];
          mm = tParts.length >= 2 && !isNaN(tParts[1]) ? tParts[1] : 0;
          hasTime = true;
        }
      }
    }
  }
  // 2. Format: DD.MM.YYYY...
  else if (/^\d{2}\.\d{2}\.\d{4}/.test(clean)) {
    const datePart = clean.substring(0, 10);
    const [day, month, year] = datePart.split('.').map(Number);
    y = year; m = month; d = day;

    if (clean.includes(' ') || clean.includes('T')) {
      const timePart = clean.includes(' ') ? clean.split(' ')[1] : clean.split('T')[1];
      if (timePart) {
        const cleanTime = timePart.split('.')[0].split('+')[0].split('Z')[0];
        const tParts = cleanTime.split(':').map(Number);
        if (tParts.length >= 1 && !isNaN(tParts[0])) {
          hh = tParts[0];
          mm = tParts.length >= 2 && !isNaN(tParts[1]) ? tParts[1] : 0;
          hasTime = true;
        }
      }
    }
  }
  // 3. Fallback standard Date parse
  else {
    const parsed = new Date(clean.replace(' ', 'T'));
    if (!isNaN(parsed.getTime())) {
      y = parsed.getFullYear();
      m = parsed.getMonth() + 1;
      d = parsed.getDate();
      hh = parsed.getHours();
      mm = parsed.getMinutes();
      hasTime = clean.includes(':');
    } else {
      return { year: 0, month: 0, day: 0, hours: 0, minutes: 0, hasTime: false, dateKey: '', monthKey: '', timestamp: 0, isValid: false };
    }
  }

  if (y <= 1900 || m < 1 || m > 12 || d < 1 || d > 31) {
    return { year: 0, month: 0, day: 0, hours: 0, minutes: 0, hasTime: false, dateKey: '', monthKey: '', timestamp: 0, isValid: false };
  }

  const itemDate = new Date(y, m - 1, d, hasTime ? hh : 12, hasTime ? mm : 0, 0);
  const timestamp = itemDate.getTime();
  const dateKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const monthKey = `${y}-${String(m).padStart(2, '0')}`;

  return {
    year: y,
    month: m,
    day: d,
    hours: hh,
    minutes: mm,
    hasTime,
    dateKey,
    monthKey,
    timestamp,
    isValid: true
  };
}

/**
 * Normalizes any date string (ISO, Ukrainian DD.MM.YYYY, timestamp) into YYYY-MM-DD for HTML <input type="date">
 */
export function formatDateForInput(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';
  
  // If already strict YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  const parsed = parseDateComponents(trimmed);
  if (parsed.isValid && parsed.dateKey) {
    return parsed.dateKey;
  }
  
  return '';
}

/**
 * Calculates full age in years given a birthDate string.
 */
export function calculateAge(birthDate: string | undefined | null): number | null {
  if (!birthDate) return null;
  const trimmed = birthDate.trim();
  if (!trimmed) return null;
  
  const parsed = parseDateComponents(trimmed);
  if (parsed.isValid && parsed.year > 1900) {
    const today = new Date();
    let age = today.getFullYear() - parsed.year;
    const m = (today.getMonth() + 1) - parsed.month;
    if (m < 0 || (m === 0 && today.getDate() < parsed.day)) {
      age--;
    }
    return age >= 0 && age < 120 ? age : null;
  }
  
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
      age--;
    }
    return age >= 0 && age < 120 ? age : null;
  }
  return null;
}
