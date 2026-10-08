import { Candidate } from '../types';

/**
 * Normalizes phone numbers by stripping non-digit characters and returning the core digits.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 9) {
    return digits.slice(-9); // Use last 9 digits (e.g. 971234567) for consistent country-code-agnostic comparison
  }
  return digits;
}

/**
 * Normalizes names by converting to lower case and simplifying whitespace.
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Checks whether typedName and candidateName match both First Name and Surname.
 * Requires at least 2 words (Surname + First Name) in typedName or candidateName,
 * ensuring single first names (e.g. "Олена") do not falsely match existing candidates.
 */
export function areNamesMatching(typedName: string, candidateName: string): boolean {
  const normTyped = normalizeName(typedName);
  const normCand = normalizeName(candidateName);

  if (!normTyped || !normCand) return false;

  // Exact full name match
  if (normTyped === normCand) return true;

  // Split into individual words (length >= 2)
  const typedWords = normTyped.split(' ').filter(w => w.length >= 2);
  const candWords = normCand.split(' ').filter(w => w.length >= 2);

  // Require at least 2 words (First name + Surname) in typedName or candidateName
  if (typedWords.length < 2 || candWords.length < 2) {
    return false;
  }

  // 1. Check if all words in typedWords match distinct words in candWords
  const matchedCandIndices = new Set<number>();
  let allTypedMatched = true;

  for (const tWord of typedWords) {
    let foundMatch = false;
    for (let i = 0; i < candWords.length; i++) {
      if (matchedCandIndices.has(i)) continue;
      const cWord = candWords[i];

      if (
        tWord === cWord ||
        (tWord.length >= 3 && cWord.length >= 3 && (cWord.startsWith(tWord) || tWord.startsWith(cWord)))
      ) {
        matchedCandIndices.add(i);
        foundMatch = true;
        break;
      }
    }
    if (!foundMatch) {
      allTypedMatched = false;
      break;
    }
  }

  if (allTypedMatched) return true;

  // 2. Check if all words in candWords match distinct words in typedWords
  const matchedTypedIndices = new Set<number>();
  let allCandMatched = true;

  for (const cWord of candWords) {
    let foundMatch = false;
    for (let j = 0; j < typedWords.length; j++) {
      if (matchedTypedIndices.has(j)) continue;
      const tWord = typedWords[j];

      if (
        cWord === tWord ||
        (cWord.length >= 3 && tWord.length >= 3 && (tWord.startsWith(cWord) || cWord.startsWith(tWord)))
      ) {
        matchedTypedIndices.add(j);
        foundMatch = true;
        break;
      }
    }
    if (!foundMatch) {
      allCandMatched = false;
      break;
    }
  }

  return allCandMatched;
}

/**
 * Searches the candidate database for an existing candidate with matching phone or full name.
 * Name matching strictly requires matching both first name and surname.
 */
export function findMatchingCandidate(
  candidates: Candidate[],
  typedName: string,
  typedPhone: string,
  excludeId?: string
): Candidate | null {
  const normTypedName = normalizeName(typedName);
  const normTypedPhone = normalizePhone(typedPhone);

  if ((!normTypedName || normTypedName.length < 3) && (!normTypedPhone || normTypedPhone.length < 7)) {
    return null;
  }

  for (const candidate of candidates) {
    if (excludeId && candidate.id === excludeId) continue;

    // 1. Check phone match (highest priority match)
    if (normTypedPhone && normTypedPhone.length >= 7) {
      const candPhoneNorm = normalizePhone(candidate.phone || '');
      if (candPhoneNorm && (candPhoneNorm === normTypedPhone || candPhoneNorm.includes(normTypedPhone) || normTypedPhone.includes(candPhoneNorm))) {
        return candidate;
      }
    }

    // 2. Check full name match (requires both first name and surname)
    if (normTypedName && normTypedName.length >= 3) {
      if (areNamesMatching(typedName, candidate.name)) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * Robust local parser for CVs and responses from Work.ua, Robota.ua, OLX, Djinni, and other portals.
 */
export function parseResumeTextLocally(
  text: string,
  vacancies: Array<{ id: string; title: string; department?: string }> = []
): {
  name: string;
  birthDate: string;
  phone: string;
  source: string;
  callType: 'Гарячий' | 'Холодний';
  comment: string;
  rating: number;
  matchedVacancyId: string;
  cvLink: string;
} {
  const trimmed = text.trim();
  
  // 1. Detect Source
  let source = 'work.ua';
  if (/work\.ua/i.test(trimmed)) {
    source = 'work.ua';
  } else if (/robota\.ua/i.test(trimmed)) {
    source = 'robota.ua';
  } else if (/olx/i.test(trimmed)) {
    source = 'olx';
  } else if (/linkedin/i.test(trimmed)) {
    source = 'linkedin';
  } else if (/djinni/i.test(trimmed)) {
    source = 'djinni';
  } else if (/facebook/i.test(trimmed)) {
    source = 'facebook';
  } else if (/instagram/i.test(trimmed)) {
    source = 'instagram';
  } else if (/telegram/i.test(trimmed) || /t\.me/i.test(trimmed)) {
    source = 'telegram';
  }

  // 2. Detect Call Type (Гарячий if response to vacancy, Холодний if resume base search)
  const isApplication = /відгук|вакансі|response|apply|подав заявку|відгукнувся|кандидат на посаду/i.test(trimmed);
  const callType: 'Гарячий' | 'Холодний' = isApplication ? 'Гарячий' : 'Гарячий';

  // 3. Extract CV URL / Link
  let cvLink = '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urlMatches = trimmed.match(urlRegex);
  if (urlMatches && urlMatches.length > 0) {
    cvLink = urlMatches[0].replace(/[,\.;)]$/, '');
  }

  // 4. Extract Phone Number
  let phone = '';
  const phoneRegex = /(?:\+?38)?\s?\(?0\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\b0\d{9}\b/g;
  const phoneMatches = trimmed.match(phoneRegex);
  if (phoneMatches && phoneMatches.length > 0) {
    let rawPhone = phoneMatches[0].replace(/[^\d+]/g, '');
    if (rawPhone.startsWith('0')) {
      rawPhone = '+38' + rawPhone;
    } else if (rawPhone.startsWith('380')) {
      rawPhone = '+' + rawPhone;
    } else if (rawPhone.length === 10 && rawPhone.startsWith('0')) {
      rawPhone = '+38' + rawPhone;
    }
    phone = rawPhone;
  }

  // 5. Extract Birth Date or Calculate from Age
  let birthDate = '';
  const dateRegex = /\b(\d{2})\.(\d{2})\.(\d{4})\b/;
  const dateMatch = trimmed.match(dateRegex);
  if (dateMatch) {
    birthDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  } else {
    // Check for age patterns: "28 років", "34 роки", "вік 25", "25 y.o."
    const ageRegex = /(\d{2})\s*(?:років|роки|року|р\.|y\.o\.|years)/i;
    const ageMatch = trimmed.match(ageRegex);
    if (ageMatch) {
      const age = parseInt(ageMatch[1], 10);
      if (age >= 16 && age <= 75) {
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - age;
        birthDate = `${birthYear}-01-01`;
      }
    }
  }

  // 6. Extract Name (ПІБ)
  const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let name = '';

  // Look for label prefixes like "ПІБ:", "Кандидат:", "Ім'я:", "Name:"
  for (const line of lines) {
    const labelMatch = line.match(/(?:ПІБ|Прізвище|Кандидат|Ім'я|Шукач|Name):\s*([А-Яа-яA-Za-zІіЇїЄєҐґ'\s-]+)/i);
    if (labelMatch && labelMatch[1].trim().length >= 3) {
      name = labelMatch[1].trim();
      break;
    }
  }

  if (!name) {
    for (const line of lines) {
      const words = line.split(/\s+/);
      const isWordMatch = words.length >= 2 && words.length <= 4;
      const hasNumbers = /\d/.test(line);
      const hasEmail = /@/.test(line);
      const hasUrl = /http|www/i.test(line);
      const hasKeywords = /резюме|resume|cv|контакти|телефон|вік|досвід|відгук|вакансі|робота|київ|львів|івано/i.test(line);

      if (isWordMatch && !hasNumbers && !hasEmail && !hasUrl && !hasKeywords) {
        const allWordsValid = words.every(w => w.length >= 2 && /^[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ'-]+$/.test(w));
        if (allWordsValid) {
          name = line;
          break;
        }
      }
    }
  }

  if (!name && lines.length > 0) {
    const firstLine = lines[0];
    if (firstLine.length < 50 && !firstLine.includes('@') && !firstLine.includes('http')) {
      name = firstLine;
    }
  }

  // 7. Match Vacancy from provided list
  let matchedVacancyId = '';
  if (vacancies.length > 0) {
    const lowerText = trimmed.toLowerCase();
    for (const v of vacancies) {
      const vTitle = v.title.toLowerCase();
      const vWords = vTitle.split(/\s+/).filter(w => w.length >= 3);
      if (lowerText.includes(vTitle) || vWords.some(w => lowerText.includes(w))) {
        matchedVacancyId = v.id;
        break;
      }
    }
    if (!matchedVacancyId && vacancies.length > 0) {
      matchedVacancyId = vacancies[0].id;
    }
  }

  // 8. Generate Summary Comment
  const excerpt = trimmed.length > 350 ? trimmed.substring(0, 350) + '...' : trimmed;
  const comment = `[Імпортовано з ${source.toUpperCase()}]:\n${excerpt}`;

  return {
    name: name.trim() || 'Кандидат з ' + source,
    birthDate,
    phone,
    source,
    callType,
    comment,
    rating: 4,
    matchedVacancyId,
    cvLink
  };
}
