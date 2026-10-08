import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, Eye, FileText, Maximize2, Minimize2 } from 'lucide-react';

interface CvPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  fileName?: string;
  fileContent?: string;
  cvLink?: string;
}

export const CvPreviewModal: React.FC<CvPreviewModalProps> = ({
  isOpen,
  onClose,
  candidateName,
  fileName = 'Резюме.pdf',
  fileContent,
  cvLink,
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !fileContent) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      return;
    }

    // Convert data URL to Blob URL for iframe rendering if it's base64 data
    if (fileContent.startsWith('data:')) {
      try {
        const parts = fileContent.split(';base64,');
        const contentType = parts[0].replace('data:', '');
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);

        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }

        const blob = new Blob([uInt8Array], { type: contentType });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (e) {
        console.error('Failed to parse data URL to Blob URL:', e);
      }
    }
  }, [isOpen, fileContent]);

  if (!isOpen) return null;

  const isPdf = (fileContent && (fileContent.includes('application/pdf') || fileContent.includes('%PDF'))) || fileName.endsWith('.pdf');
  const isImage = fileContent && fileContent.startsWith('data:image/');
  const previewSource = blobUrl || fileContent;

  const handleOpenNewTab = () => {
    if (previewSource) {
      const win = window.open();
      if (win) {
        win.document.write(
          `<html style="margin:0"><head><title>${fileName}</title></head><body style="margin:0;background:#1e293b;display:flex;justify-content:center;align-items:center;min-height:100vh;"><iframe src="${previewSource}" style="border:none;width:100%;height:100vh;"></iframe></body></html>`
        );
      }
    } else if (cvLink) {
      window.open(cvLink, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 border border-slate-200/80 ${
          isFullScreen ? 'w-full h-full rounded-none' : 'w-full max-w-4xl h-[88vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3 truncate mr-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <FileText className="h-5 w-5" />
            </div>
            <div className="truncate">
              <h3 className="font-bold text-sm text-slate-100 truncate">
                {candidateName} — <span className="text-emerald-400">{fileName || 'Резюме'}</span>
              </h3>
              <p className="text-[11px] text-slate-400">Перегляд електронного резюме кандидата</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {fileContent && (
              <a
                href={fileContent}
                download={fileName || 'resume.pdf'}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Скачати</span>
              </a>
            )}

            {(previewSource || cvLink) && (
              <button
                type="button"
                onClick={handleOpenNewTab}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition"
                title="Відкрити у новій вкладці"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden md:inline">У новій вкладці</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
              title={isFullScreen ? 'Згорнути' : 'На весь екран'}
            >
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition"
              title="Закрити"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-slate-950/5 relative overflow-auto flex items-center justify-center p-2 sm:p-4">
          {previewSource ? (
            isImage ? (
              <div className="max-h-full max-w-full overflow-auto flex items-center justify-center p-4">
                <img src={previewSource} alt={fileName} className="max-h-[78vh] object-contain rounded-lg shadow-md" />
              </div>
            ) : isPdf || previewSource.startsWith('data:') ? (
              <iframe
                src={previewSource}
                title={fileName}
                className="w-full h-full rounded-xl border border-slate-200 bg-white shadow-inner"
              />
            ) : (
              <div className="bg-white p-6 rounded-xl border border-slate-200 max-w-2xl w-full text-slate-800 font-mono text-sm whitespace-pre-wrap overflow-auto max-h-[70vh] shadow-sm">
                {previewSource}
              </div>
            )
          ) : cvLink ? (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-4 p-8 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
              <div className="p-4 bg-teal-50 text-teal-700 rounded-2xl">
                <ExternalLink className="h-10 w-10" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-slate-800">Зовнішнє посилання на резюме</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md break-all">{cvLink}</p>
              </div>
              <a
                href={cvLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow transition inline-flex items-center space-x-2"
              >
                <Eye className="h-4 w-4" />
                <span>Переглянути на зовнішньому сайті ↗</span>
              </a>
            </div>
          ) : (
            <div className="text-center p-8 text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">Файл резюме відсутній або не завантажений.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
