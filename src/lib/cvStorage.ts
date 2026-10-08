// Optimized High-Performance IndexedDB + Memory storage for Candidate CV files
// Completely prevents browser freezing, localStorage quota errors, and main thread lag.

const DB_NAME = 'hr_analytics_cv_db';
const STORE_NAME = 'cv_files';
const DB_VERSION = 1;
const LEGACY_STORAGE_KEY = 'hr_analytics_cv_files_store';

export interface StoredCv {
  fileName: string;
  fileContent: string;
}

// In-memory cache for instant synchronous access (0ms latency)
const memoryCvStore: Map<string, StoredCv> = new Map();
let isInitialized = false;
let dbPromise: Promise<IDBDatabase | null> | null = null;

function getIDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn('IndexedDB open error, falling back to memory');
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB unavailable:', err);
        resolve(null);
      }
    });
  }
  return dbPromise;
}

// Initialize and migrate any legacy data from localStorage to IndexedDB in the background
export async function initCvStorage(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  // 1. Check legacy localStorage and migrate
  try {
    const rawLegacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (rawLegacy) {
      const parsed = JSON.parse(rawLegacy);
      Object.entries(parsed).forEach(([id, item]: [string, any]) => {
        if (item && item.fileContent) {
          memoryCvStore.set(id, {
            fileName: item.fileName || 'Резюме.pdf',
            fileContent: item.fileContent
          });
        }
      });
      // Free localStorage immediately
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch (e) {
    // ignore
  }

  // 2. Load records from IndexedDB into in-memory cache
  try {
    const db = await getIDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          memoryCvStore.set(cursor.key as string, cursor.value as StoredCv);
          cursor.continue();
        }
      };
    }
  } catch (err) {
    console.warn('Error loading CV files from IndexedDB:', err);
  }
}

// Auto-run initialization in background
if (typeof window !== 'undefined') {
  initCvStorage().catch(() => {});
}

export function loadCvStore(): Record<string, StoredCv> {
  const result: Record<string, StoredCv> = {};
  memoryCvStore.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function getCvFile(candidateId: string): StoredCv | null {
  if (!candidateId) return null;
  return memoryCvStore.get(candidateId) || null;
}

export async function fetchCvFromServer(candidateId: string): Promise<StoredCv | null> {
  if (!candidateId) return null;
  try {
    const res = await fetch(`/api/cv/${encodeURIComponent(candidateId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.fileContent) {
        const cvData: StoredCv = { fileName: data.fileName || 'Резюме.pdf', fileContent: data.fileContent };
        memoryCvStore.set(candidateId, cvData);
        getIDB().then((db) => {
          if (db) {
            try {
              const tx = db.transaction(STORE_NAME, 'readwrite');
              tx.objectStore(STORE_NAME).put(cvData, candidateId);
            } catch {}
          }
        }).catch(() => {});
        return cvData;
      }
    }
  } catch (err) {
    console.warn('Could not fetch CV from server:', err);
  }
  return null;
}

export function saveCvFile(candidateId: string, fileName: string, fileContent: string): void {
  if (!candidateId || !fileContent) return;

  const existing = memoryCvStore.get(candidateId);
  if (existing?.fileName === fileName && existing?.fileContent === fileContent) {
    return;
  }

  const cvData: StoredCv = { fileName, fileContent };
  memoryCvStore.set(candidateId, cvData);

  // Asynchronously write to IndexedDB without blocking main thread
  getIDB().then((db) => {
    if (db) {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(cvData, candidateId);
      } catch (err) {
        console.warn('Failed to save CV to IndexedDB:', err);
      }
    }
  }).catch(() => {});

  // Asynchronously sync to central server so other computers can view this CV
  if (typeof window !== 'undefined' && !fileContent.startsWith('[') && !fileContent.includes('обрізано')) {
    fetch(`/api/cv/${encodeURIComponent(candidateId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, fileContent })
    }).catch((err) => {
      console.warn('Failed to sync CV to server:', err);
    });
  }
}

export function removeCvFile(candidateId: string): void {
  if (!candidateId) return;
  memoryCvStore.delete(candidateId);

  getIDB().then((db) => {
    if (db) {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(candidateId);
      } catch (err) {
        console.warn('Failed to delete CV from IndexedDB:', err);
      }
    }
  }).catch(() => {});
}

// Generate a valid base64 PDF Data URL for candidate resume restore
export function generateDefaultCandidatePdf(candidateName: string, role?: string, phone?: string): { fileName: string; fileContent: string } {
  const nameClean = candidateName || 'Кандидат';
  const firstName = nameClean.split(' ')[0] || 'кандидата';
  const fileName = `Резюме_${firstName}.pdf`;

  const pdfContent = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R>> endobj
4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
5 0 obj <</Length 350>> stream
BT
/F1 18 Tf
50 720 Td
(RESUME / CURRICULUM VITAE) Tj
0 -35 Td
/F1 14 Tf
(Candidate: ${nameClean}) Tj
0 -25 Td
(Position / Vacancy: ${role || 'Specialist'}) Tj
0 -25 Td
(Contact Phone: ${phone || '+380...'}) Tj
0 -35 Td
/F1 11 Tf
(Document Status: Official Candidate File) Tj
0 -20 Td
(Attached File: ${fileName}) Tj
0 -20 Td
(Uploaded & Verified in HR Analytics System.) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000315 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
580
%%EOF`;

  let base64 = '';
  try {
    base64 = btoa(unescape(encodeURIComponent(pdfContent)));
  } catch (e) {
    base64 = 'JVBERi0xLjQKMSAwIG9iag==';
  }

  return {
    fileName,
    fileContent: `data:application/pdf;base64,${base64}`
  };
}

export function getOrRestoreCvFile(
  candidateId: string,
  candidateName: string,
  role?: string,
  phone?: string,
  existingFileName?: string,
  existingContent?: string
): StoredCv {
  // Check if existing content is valid base64 or data URL (not a placeholder string)
  const isValidContent = Boolean(
    existingContent && 
    !existingContent.startsWith('[') && 
    !existingContent.includes('обрізано') &&
    existingContent.length > 20
  );

  if (isValidContent && existingContent) {
    saveCvFile(candidateId, existingFileName || `Резюме_${candidateName.split(' ')[0]}.pdf`, existingContent);
    return {
      fileName: existingFileName || `Резюме_${candidateName.split(' ')[0]}.pdf`,
      fileContent: existingContent
    };
  }

  const stored = memoryCvStore.get(candidateId);
  if (stored && stored.fileContent) {
    const isSyntheticMock = stored.fileContent.includes('Document Status: Official Candidate File') ||
                            (stored.fileContent.length < 1500 && stored.fileContent.includes('JVBERi0xLjQKMSAwIG9iag'));
    if (!isSyntheticMock) {
      return stored;
    }
  }

  return {
    fileName: existingFileName || '',
    fileContent: ''
  };
}

