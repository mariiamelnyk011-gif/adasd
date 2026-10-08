import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HRSystemData } from '../types';
import IframePrintModal from './IframePrintModal';
import { generateLocalExecutiveReport } from '../lib/reportUtils';
import { exportReportToWord, exportReportToPdf } from '../lib/executiveReportExporter';
import { 
  FileText, 
  Sparkles, 
  RefreshCw, 
  Download, 
  ArrowRight, 
  CheckCircle, 
  Info, 
  Briefcase, 
  Users, 
  Award, 
  Printer,
  FileDown,
  Calendar,
  Layers,
  AlertCircle
} from 'lucide-react';

interface ReportGeneratorProps {
  data: HRSystemData;
  accessToken: string | null;
  spreadsheetId: string | null;
}

export default function ReportGenerator({ data, accessToken, spreadsheetId }: ReportGeneratorProps) {
  const [report, setReport] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  const printableRef = useRef<HTMLDivElement>(null);

  // Filter open vacancies
  const openVacancies = useMemo(() => {
    return (data.vacancies || []).filter(v => v.status === 'Активна');
  }, [data.vacancies]);

  // Total count of needed positions across active vacancies
  const totalOpenPositionsCount = useMemo(() => {
    return openVacancies.reduce((sum, v) => sum + (v.openPositions && v.openPositions > 0 ? v.openPositions : 1), 0);
  }, [openVacancies]);

  // Filter active interns
  const activeInterns = useMemo(() => {
    return (data.interns || []).filter(i => i.status === 'Триває');
  }, [data.interns]);

  // Interns failure metrics
  const failedInterns = useMemo(() => {
    return (data.interns || []).filter(i => i.status === 'Не пройшов');
  }, [data.interns]);

  const internFailureRate = data.interns && data.interns.length > 0
    ? Math.round((failedInterns.length / data.interns.length) * 100)
    : 0;

  // Candidates source lookup map
  const candidateSourceMap = useMemo(() => {
    const map = new Map<string, string>();
    (data.candidates || []).forEach(c => {
      if (c.id) map.set(c.id, c.source || 'Не вказано');
      if (c.name) map.set(c.name.trim().toLowerCase(), c.source || 'Не вказано');
    });
    return map;
  }, [data.candidates]);

  const getInternSource = (i: any): string => {
    return candidateSourceMap.get(i.candidateId) || candidateSourceMap.get(i.candidateName?.trim().toLowerCase()) || i.source || 'Не вказано';
  };

  // Automatically trigger report generation on tab load if empty
  useEffect(() => {
    if (!report && !loading) {
      handleGenerate();
    }
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setExportSuccess(null);
    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.report && resData.report.trim()) {
          setReport(resData.report);
          return;
        }
      }

      // If server returned error or empty report, fallback to local high-precision analytical report
      const fallbackReport = generateLocalExecutiveReport(data);
      setReport(fallbackReport);
    } catch (err: any) {
      console.warn('Server report generation failed, using local analytical engine:', err);
      const fallbackReport = generateLocalExecutiveReport(data);
      setReport(fallbackReport);
    } finally {
      setLoading(false);
    }
  };

  // Export to Microsoft Word (.docx)
  const handleExportWord = async () => {
    setExportingWord(true);
    setExportSuccess(null);
    try {
      await exportReportToWord(data, report);
      setExportSuccess('Звіт успішно збережено у форматі Word (.docx)!');
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err: any) {
      console.error('Word export error:', err);
      setError('Помилка формування Word документа: ' + (err.message || err));
    } finally {
      setExportingWord(false);
    }
  };

  // Export to PDF (.pdf)
  const handleExportPdf = async () => {
    if (!printableRef.current) return;
    setExportingPdf(true);
    setExportSuccess(null);
    try {
      const todayStr = new Date().toLocaleDateString('uk-UA').replace(/\./g, '_');
      await exportReportToPdf(printableRef.current, `Zvit_Dlia_Kerivnyka_Nadiya_${todayStr}.pdf`);
      setExportSuccess('Звіт успішно згенеровано та збережено у форматі PDF!');
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err: any) {
      console.error('PDF export error:', err);
      setError('Помилка формування PDF файлу: ' + (err.message || err));
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePrint = () => {
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) {
      setShowPrintModal(true);
    } else {
      window.print();
    }
  };

  // Export report to Google Sheet as a new tab
  const handleExportToSheet = async () => {
    if (!accessToken || !spreadsheetId || !report) return;
    setExporting(true);
    setExportSuccess(null);
    try {
      const lines = report.split('\n').map(line => [line]);
      const sheetTitle = 'AI_HR_Executive_Report';

      // 1. Create tab
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetTitle,
                },
              },
            },
          ],
        }),
      });

      // 2. Write data
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle + '!A1')}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [
            ['ІНТЕЛЕКТУАЛЬНИЙ ЗВІТ ДЛЯ КЕРІВНИЦТВА (ГЕНЕРАЦІЯ GEMINI AI)'],
            [`Дата формування: ${new Date().toLocaleDateString('uk-UA')}`],
            ['--------------------------------------------------'],
            ...lines
          ]
        }),
      });

      if (!res.ok) throw new Error('Помилка запису даних у Google Sheet');
      setExportSuccess('Звіт успішно експортовано в окрему вкладку вашої Google Таблиці!');
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err: any) {
      console.error(err);
      try {
        const sheetTitle = 'AI_HR_Executive_Report';
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle + '!A1')}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: report.split('\n').map(line => [line])
          }),
        });
        setExportSuccess('Звіт успішно оновлено у вашій Google Таблиці!');
        setTimeout(() => setExportSuccess(null), 5000);
      } catch (overwriteErr: any) {
        setError('Не вдалося створити вкладку або записати дані в Google Sheets.');
      }
    } finally {
      setExporting(false);
    }
  };

  // Export report to Google Drive as a text document
  const handleExportToDrive = async () => {
    if (!accessToken || !report) return;
    setExporting(true);
    setExportSuccess(null);
    try {
      const metadata = {
        name: `HR_Executive_Report_${new Date().toISOString().slice(0, 10)}.txt`,
        mimeType: 'text/plain',
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([report], { type: 'text/plain' }));

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });

      if (!res.ok) throw new Error('Помилка збереження файлу в Google Drive');
      const fileData = await res.json();
      setExportSuccess(`Звіт успішно збережено у Google Диск як текстовий документ! ID: ${fileData.id}`);
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err: any) {
      console.error(err);
      setError('Не вдалося експортувати звіт у Google Drive.');
    } finally {
      setExporting(false);
    }
  };

  const renderMarkdown = (text: string) => {
    if (!text) return null;

    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let trimmed = line.trim();

      if (trimmed.startsWith('# ')) {
        return <h1 key={idx} className="text-xl font-black text-slate-800 border-b border-slate-200 pb-2 mt-6 mb-3 tracking-tight">{trimmed.replace('# ', '')}</h1>;
      }
      if (trimmed.startsWith('## ')) {
        return <h2 key={idx} className="text-lg font-bold text-teal-900 mt-5 mb-2.5 flex items-center">{trimmed.replace('## ', '')}</h2>;
      }
      if (trimmed.startsWith('### ')) {
        return <h3 key={idx} className="text-sm font-bold text-slate-800 mt-4 mb-2">{trimmed.replace('### ', '')}</h3>;
      }
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const content = trimmed.substring(2);
        return (
          <li key={idx} className="list-disc list-inside text-xs text-slate-700 ml-4 mb-1.5 leading-relaxed font-medium">
            {parseBoldText(content)}
          </li>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const content = trimmed.replace(/^\d+\.\s/, '');
        return (
          <li key={idx} className="list-decimal list-inside text-xs text-slate-700 ml-4 mb-1.5 leading-relaxed font-medium">
            {parseBoldText(content)}
          </li>
        );
      }
      if (trimmed === '') {
        return <div key={idx} className="h-2" />;
      }
      return <p key={idx} className="text-xs text-slate-700 mb-2.5 leading-relaxed font-normal">{parseBoldText(trimmed)}</p>;
    });
  };

  const parseBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-6">
      {/* Print CSS injection for crisp, clean executive document printout */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-report-area, #printable-report-area * {
            visibility: visible !important;
          }
          #printable-report-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Description & Action Bar */}
      <div className="no-print bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200">
              Мережа маркетів «Надія»
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Експорт: Word / PDF / Друк
            </span>
          </div>
          <h4 className="font-bold text-slate-800 text-lg flex items-center pt-1">
            <Sparkles className="h-5 w-5 text-teal-600 mr-2" />
            Офіційний звіт для керівника
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl font-medium">
            Сформовано читабельний структурований звіт із даними про вакансії (із вказівкою кількості посад) та стажерів (без шкали прогресу). Доступний миттєвий експорт у Microsoft Word, PDF та прямий друк.
          </p>
        </div>

        {/* Primary Export Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportWord}
            disabled={exportingWord || loading}
            className="flex items-center justify-center space-x-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Завантажити звіт у форматі Microsoft Word (.docx)"
          >
            <FileDown className={`h-4 w-4 text-blue-600 ${exportingWord ? 'animate-bounce' : ''}`} />
            <span>{exportingWord ? 'Формуємо Word...' : 'Word (.docx)'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf || loading}
            className="flex items-center justify-center space-x-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/80 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Завантажити звіт у форматі PDF"
          >
            <Download className={`h-4 w-4 text-rose-600 ${exportingPdf ? 'animate-bounce' : ''}`} />
            <span>{exportingPdf ? 'Формуємо PDF...' : 'PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Надрукувати звітність"
          >
            <Printer className="h-4 w-4 text-slate-600" />
            <span>Друк</span>
          </button>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center justify-center space-x-1.5 bg-teal-700 hover:bg-teal-800 text-white disabled:bg-slate-300 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Оновити аналітику</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {exportSuccess && (
        <div className="no-print p-4 bg-emerald-50 rounded-2xl flex items-center space-x-2 text-xs text-emerald-800 border border-emerald-200 shadow-xs animate-in fade-in">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{exportSuccess}</span>
        </div>
      )}

      {error && (
        <div className="no-print p-4 bg-rose-50 rounded-2xl flex items-center space-x-2 text-xs text-rose-800 border border-rose-200 shadow-xs animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Layout Grid: Left Sidebar for Storage Exports + Right Area for Printable Report */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Cloud Actions & Secondary Tools */}
        <div className="no-print lg:col-span-3 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4 sticky top-4">
            <div>
              <h5 className="font-bold text-slate-800 text-sm">Швидкий експорт</h5>
              <p className="text-[11px] text-slate-400 mt-1 font-medium leading-relaxed">
                Сформуйте файл для керівництва в один клік у потрібному форматі:
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf || loading}
                className="w-full flex items-center justify-between bg-rose-50/70 hover:bg-rose-100/80 text-rose-800 border border-rose-200/60 p-3 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <Download className="h-4 w-4 text-rose-600" />
                  <span>Звіт у PDF</span>
                </div>
                <span className="text-[10px] bg-rose-200/60 text-rose-900 px-1.5 py-0.5 rounded font-bold">.pdf</span>
              </button>

              <button
                type="button"
                onClick={handleExportWord}
                disabled={exportingWord || loading}
                className="w-full flex items-center justify-between bg-blue-50/70 hover:bg-blue-100/80 text-blue-800 border border-blue-200/60 p-3 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <FileDown className="h-4 w-4 text-blue-600" />
                  <span>Документ Word</span>
                </div>
                <span className="text-[10px] bg-blue-200/60 text-blue-900 px-1.5 py-0.5 rounded font-bold">.docx</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 p-3 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <Printer className="h-4 w-4 text-slate-600" />
                  <span>Друк на принтер</span>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">A4</span>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Хмарне збереження (Google)
              </span>

              <button
                onClick={handleExportToSheet}
                disabled={!accessToken || !spreadsheetId || !report || exporting || loading}
                className="w-full flex items-center justify-between bg-emerald-50 hover:bg-emerald-100 disabled:bg-slate-50 disabled:text-slate-300 text-emerald-800 px-3 py-2.5 rounded-xl text-xs font-bold border border-emerald-200/50 transition cursor-pointer"
              >
                <span className="truncate">Вкладка у Google Sheets</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={handleExportToDrive}
                disabled={!accessToken || !report || exporting || loading}
                className="w-full flex items-center justify-between bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-50 disabled:text-slate-300 text-indigo-800 px-3 py-2.5 rounded-xl text-xs font-bold border border-indigo-200/50 transition cursor-pointer"
              >
                <span>Файл у Google Drive</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {!accessToken && (
              <div className="p-3 bg-amber-50 rounded-xl flex items-start space-x-2 text-[11px] text-amber-700 border border-amber-100">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Увійдіть через Google в меню зверху, щоб зберігати прямо у Google Таблицю чи Диск.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: The Official Styled Document Container (Printable & Exportable) */}
        <div className="lg:col-span-9">
          <div 
            ref={printableRef}
            id="printable-report-area"
            className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-xs space-y-8 print:p-0 print:border-none print:shadow-none"
          >
            {/* Document Header */}
            <div className="border-b-2 border-teal-800 pb-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-black text-teal-800 uppercase tracking-widest">
                    МЕРЕЖА МАРКЕТІВ «НАДІЯ» • ВІДДІЛ КАДРІВ ТА ПІДБОРУ
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                    ЗВІТ З РЕКРУТИНГУ ТА СТАЖУВАННЯ ДЛЯ КЕРІВНИКА
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Оперативна аналітика воронки підбору, відкритих позицій, ефективності джерел та результатів стажування
                  </p>
                </div>
                <div className="text-left sm:text-right text-xs text-slate-500 bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                  <div className="font-bold text-slate-700">
                    Дата формування: {new Date().toLocaleDateString('uk-UA')}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Час: {new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Key Indicators Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3">
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Вакансій відкрито</span>
                  <span className="text-lg font-black text-teal-800">{openVacancies.length}</span>
                </div>
                <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">Потреба (посад)</span>
                  <span className="text-lg font-black text-teal-900">{totalOpenPositionsCount}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Кандидатів у базі</span>
                  <span className="text-lg font-black text-slate-800">{data.candidates.length}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Активних стажерів</span>
                  <span className="text-lg font-black text-slate-800">{activeInterns.length}</span>
                </div>
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Відмов зі стажувань</span>
                  <span className="text-lg font-black text-amber-900">{failedInterns.length} <span className="text-xs font-semibold text-amber-700">({internFailureRate}%)</span></span>
                </div>
              </div>
            </div>

            {/* SECTION 1: Vacancies Table (No 'постійна', includes 'кількість посад') */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="font-black text-slate-800 text-sm flex items-center space-x-2">
                  <Briefcase className="h-4 w-4 text-teal-700" />
                  <span>1. ВІДКРИТІ ВАКАНСІЇ ТА ПОТРЕБА В ПЕРСОНАЛІ</span>
                </h3>
                <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                  Всього: {totalOpenPositionsCount} {totalOpenPositionsCount === 1 ? 'посада' : totalOpenPositionsCount < 5 ? 'посади' : 'посад'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-teal-800 text-white text-xs font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3 border border-teal-700">Посада</th>
                      <th className="py-2.5 px-3 border border-teal-700">Підрозділ / Маркет</th>
                      <th className="py-2.5 px-3 border border-teal-700 text-center">Кількість посад</th>
                      <th className="py-2.5 px-3 border border-teal-700">Заробітна плата</th>
                      <th className="py-2.5 px-3 border border-teal-700">Графік роботи</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                    {openVacancies.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400 font-medium">
                          Активних відкритих вакансій немає
                        </td>
                      </tr>
                    ) : (
                      openVacancies.map((vacancy) => (
                        <tr key={vacancy.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-900 border border-slate-200">
                            {vacancy.title}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-600 border border-slate-200">
                            {vacancy.department}
                          </td>
                          <td className="py-2.5 px-3 text-center border border-slate-200">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-teal-50 text-teal-800 border border-teal-200">
                              {vacancy.openPositions || 1}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium border border-slate-200">
                            {vacancy.salary || 'За домовленістю'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium border border-slate-200">
                            {vacancy.schedule || 'Стандартний'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 2: Interns Table (WITH SEARCH SOURCE, WITHOUT PROGRESS) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="font-black text-slate-800 text-sm flex items-center space-x-2">
                  <Award className="h-4 w-4 text-teal-700" />
                  <span>2. СТАЖЕРИ НА ВИПРОБУВАЛЬНОМУ ТЕРМІНІ</span>
                </h3>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  Активних: {activeInterns.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-800 text-white text-xs font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3 border border-slate-700">ПІБ Стажера</th>
                      <th className="py-2.5 px-3 border border-slate-700">Цільова Посада</th>
                      <th className="py-2.5 px-3 border border-slate-700">Підрозділ</th>
                      <th className="py-2.5 px-3 border border-slate-700">Джерело пошуку</th>
                      <th className="py-2.5 px-3 border border-slate-700">Куратор / Наставник</th>
                      <th className="py-2.5 px-3 border border-slate-700">Дата початку</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                    {activeInterns.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-400 font-medium">
                          Стажерів на випробувальному терміні немає
                        </td>
                      </tr>
                    ) : (
                      activeInterns.map((intern) => (
                        <tr key={intern.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-900 border border-slate-200">
                            {intern.candidateName}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-700 border border-slate-200">
                            {intern.position || 'Стажер'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 border border-slate-200">
                            {intern.department || 'Не вказано'}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-200">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                              {getInternSource(intern)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-700 border border-slate-200">
                            {intern.mentor || 'Не призначено'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 border border-slate-200">
                            {intern.startDate || 'Не вказано'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 3: Analytical Conclusions & Recommendations (AI & Local Engine) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="font-black text-slate-800 text-sm flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-teal-700" />
                  <span>3. АНАЛІТИЧНИЙ ЗВІТ ТА РЕКОМЕНДАЦІЇ ДЛЯ КЕРІВНИКА</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-400">
                  Аналітичний модуль HR
                </span>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3 bg-slate-50 rounded-xl border border-slate-100">
                  <RefreshCw className="h-7 w-7 text-teal-700 animate-spin" />
                  <p className="text-xs text-slate-500 font-bold">Збираємо поточні дані та формуємо аналітику для керівника...</p>
                </div>
              ) : report ? (
                <div className="bg-slate-50/40 p-5 sm:p-6 rounded-xl border border-slate-200/80 leading-relaxed font-sans">
                  {renderMarkdown(report)}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Натисніть кнопку «Оновити аналітику», щоб згенерувати рекомендації
                </div>
              )}
            </div>

            {/* Document Footer */}
            <div className="pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                Звіт підготовлено HRIS-системою «Надія» для керівника мережі
              </div>
              <div className="font-semibold text-slate-700">
                Підпис керівника HR: ____________________
              </div>
            </div>
          </div>
        </div>

      </div>

      <IframePrintModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} />
    </div>
  );
}
