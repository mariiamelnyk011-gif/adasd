import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  HeadingLevel, 
  BorderStyle,
  Header,
  Footer
} from 'docx';
import { HRSystemData, Vacancy, Intern } from '../types';

/**
 * Downloads a Blob directly to the user's browser.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a rich Microsoft Word (.docx) document for the Executive HR Report.
 */
export async function exportReportToWord(data: HRSystemData, reportMarkdown: string) {
  const todayStr = new Date().toLocaleDateString('uk-UA', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
  const filename = `Zvit_Dlia_Kerivnyka_Nadiya_${todayStr.replace(/\./g, '_')}.docx`;

  const activeVacancies = (data.vacancies || []).filter(v => v.status === 'Активна');
  const activeInterns = (data.interns || []).filter(i => i.status === 'Триває');

  // Corporate Styling Constants
  const COLOR_PRIMARY = '0F766E'; // Teal 700
  const COLOR_TEXT = '1E293B'; // Slate 800
  const COLOR_MUTED = '64748B'; // Slate 500
  const COLOR_BG_HEADER = 'F1F5F9'; // Slate 100
  const COLOR_BORDER = 'CBD5E1'; // Slate 300

  // 1. Vacancies Table
  const vacancyHeaderCells = [
    'Посада',
    'Підрозділ',
    'Кількість посад',
    'Заробітна плата',
    'Графік'
  ].map(text => 
    new TableCell({
      shading: { fill: '0F766E' },
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text,
              bold: true,
              color: 'FFFFFF',
              size: 20, // 10pt
              font: 'Calibri'
            })
          ]
        })
      ]
    })
  );

  const vacancyRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: vacancyHeaderCells
    })
  ];

  if (activeVacancies.length === 0) {
    vacancyRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 5,
            margins: { top: 140, bottom: 140, left: 140, right: 140 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'На даний момент усі посади укомплектовані або закриті.',
                    italics: true,
                    color: COLOR_MUTED,
                    font: 'Calibri'
                  })
                ]
              })
            ]
          })
        ]
      })
    );
  } else {
    activeVacancies.forEach((v: Vacancy, index: number) => {
      const isEven = index % 2 === 0;
      const rowShading = isEven ? 'FFFFFF' : 'F8FAFC';
      const count = v.openPositions && v.openPositions > 0 ? v.openPositions : 1;

      vacancyRows.push(
        new TableRow({
          children: [
            // Посада
            new TableCell({
              shading: { fill: rowShading },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: v.title, bold: true, color: COLOR_TEXT, size: 20, font: 'Calibri' })]
                })
              ]
            }),
            // Підрозділ
            new TableCell({
              shading: { fill: rowShading },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: v.department || '—', color: COLOR_TEXT, size: 20, font: 'Calibri' })]
                })
              ]
            }),
            // Кількість посад
            new TableCell({
              shading: { fill: rowShading },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${count}`, bold: true, color: COLOR_PRIMARY, size: 20, font: 'Calibri' })]
                })
              ]
            }),
            // Заробітна плата
            new TableCell({
              shading: { fill: rowShading },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: v.salary || 'Не вказано', color: COLOR_TEXT, size: 20, font: 'Calibri' })]
                })
              ]
            }),
            // Графік
            new TableCell({
              shading: { fill: rowShading },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: v.schedule || 'Не вказано', color: COLOR_TEXT, size: 20, font: 'Calibri' })]
                })
              ]
            }),
          ]
        })
      );
    });
  }

  const vacanciesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: vacancyRows
  });

  // Candidate Source Lookup Map
  const candidateSourceMap = new Map<string, string>();
  (data.candidates || []).forEach((c: any) => {
    if (c.id) candidateSourceMap.set(c.id, c.source || 'Не вказано');
    if (c.name) candidateSourceMap.set(c.name.trim().toLowerCase(), c.source || 'Не вказано');
  });

  const getInternSource = (i: Intern): string => {
    return candidateSourceMap.get(i.candidateId) || candidateSourceMap.get(i.candidateName?.trim().toLowerCase()) || (i as any).source || 'Не вказано';
  };

  // 2. Interns Table (WITH SEARCH SOURCE, WITHOUT PROGRESS)
  const internHeaderCells = [
    'Стажер',
    'Цільова посада',
    'Підрозділ',
    'Джерело пошуку',
    'Куратор / Ментор',
    'Дата початку'
  ].map(text => 
    new TableCell({
      shading: { fill: '0F766E' },
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text,
              bold: true,
              color: 'FFFFFF',
              size: 20,
              font: 'Calibri'
            })
          ]
        })
      ]
    })
  );

  const internRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: internHeaderCells
    })
  ];

  if (activeInterns.length === 0) {
    internRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 6,
            margins: { top: 140, bottom: 140, left: 140, right: 140 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Активних стажерів на даний момент немає.',
                    italics: true,
                    color: COLOR_MUTED,
                    font: 'Calibri'
                  })
                ]
              })
            ]
          })
        ]
      })
    );
  } else {
    activeInterns.forEach((intern: Intern, index: number) => {
      const isEven = index % 2 === 0;
      const rowShading = isEven ? 'FFFFFF' : 'F8FAFC';
      const source = getInternSource(intern);

      internRows.push(
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: rowShading },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: intern.candidateName, bold: true, color: COLOR_TEXT, size: 20, font: 'Calibri' })]
                })
              ]
            }),
            new TableCell({
              shading: { fill: rowShading },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: intern.position || 'Стажер', color: COLOR_TEXT, size: 20, font: 'Calibri' })]
                })
              ]
            }),
            new TableCell({
              shading: { fill: rowShading },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: intern.department || '—', color: COLOR_TEXT, size: 20, font: 'Calibri' })]
                })
              ]
            }),
            new TableCell({
              shading: { fill: rowShading },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: source, bold: true, color: COLOR_PRIMARY, size: 20, font: 'Calibri' })]
                })
              ]
            }),
            new TableCell({
              shading: { fill: rowShading },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: intern.mentor || 'Не призначено', color: COLOR_TEXT, size: 20, font: 'Calibri' })]
                })
              ]
            }),
            new TableCell({
              shading: { fill: rowShading },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: intern.startDate || '—', color: COLOR_MUTED, size: 20, font: 'Calibri' })]
                })
              ]
            })
          ]
        })
      );
    });
  }

  const internsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: internRows
  });

  // 3. Parse report markdown into structured Word paragraphs
  const contentParagraphs: Paragraph[] = [];
  const lines = reportMarkdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) {
      contentParagraphs.push(new Paragraph({ spacing: { before: 80, after: 80 } }));
      continue;
    }

    if (rawLine.startsWith('# ')) {
      // Main title already at top, skip or format
      continue;
    } else if (rawLine.startsWith('## ')) {
      contentParagraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: rawLine.replace('## ', ''),
              bold: true,
              color: COLOR_PRIMARY,
              size: 26, // 13pt
              font: 'Calibri'
            })
          ]
        })
      );
    } else if (rawLine.startsWith('### ')) {
      contentParagraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 180, after: 80 },
          children: [
            new TextRun({
              text: rawLine.replace('### ', ''),
              bold: true,
              color: COLOR_TEXT,
              size: 22, // 11pt
              font: 'Calibri'
            })
          ]
        })
      );
    } else if (rawLine.startsWith('* ') || rawLine.startsWith('- ')) {
      const textContent = rawLine.slice(2);
      // Parse inline bold: **word**
      const parts = textContent.split(/(\*\*.*?\*\*)/g);
      const runs = parts.map(part => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return new TextRun({
            text: part.slice(2, -2),
            bold: true,
            color: COLOR_TEXT,
            size: 21,
            font: 'Calibri'
          });
        }
        return new TextRun({
          text: part,
          color: COLOR_TEXT,
          size: 21,
          font: 'Calibri'
        });
      });

      contentParagraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 40, after: 40 },
          children: runs
        })
      );
    } else if (/^\d+\.\s/.test(rawLine)) {
      const numMatch = rawLine.match(/^(\d+\.)\s(.*)$/);
      const numPrefix = numMatch ? numMatch[1] : '';
      const textContent = numMatch ? numMatch[2] : rawLine;
      const parts = textContent.split(/(\*\*.*?\*\*)/g);
      const runs = [
        new TextRun({ text: `${numPrefix} `, bold: true, color: COLOR_PRIMARY, size: 21, font: 'Calibri' }),
        ...parts.map(part => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return new TextRun({
              text: part.slice(2, -2),
              bold: true,
              color: COLOR_TEXT,
              size: 21,
              font: 'Calibri'
            });
          }
          return new TextRun({
            text: part,
            color: COLOR_TEXT,
            size: 21,
            font: 'Calibri'
          });
        })
      ];

      contentParagraphs.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: runs
        })
      );
    } else if (rawLine === '---') {
      // Horizontal rule / spacing
      contentParagraphs.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: { bottom: { color: COLOR_BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 } },
          children: []
        })
      );
    } else {
      const parts = rawLine.split(/(\*\*.*?\*\*)/g);
      const runs = parts.map(part => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return new TextRun({
            text: part.slice(2, -2),
            bold: true,
            color: COLOR_TEXT,
            size: 21,
            font: 'Calibri'
          });
        }
        return new TextRun({
          text: part,
          color: COLOR_TEXT,
          size: 21,
          font: 'Calibri'
        });
      });

      contentParagraphs.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: runs
        })
      );
    }
  }

  // 4. Construct complete Word Document
  const doc = new Document({
    title: 'Звіт для керівника — Компанія Надія',
    description: 'Офіційний аналітичний HR-звіт стану штату, відкритих вакансій та стажування',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              bottom: 1000,
              left: 1000,
              right: 1000
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `КОМПАНІЯ «НАДІЯ» • ОФІЦІЙНИЙ HR-ЗВІТ • ${todayStr}`,
                    size: 16,
                    color: COLOR_MUTED,
                    font: 'Calibri'
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Звіт сформовано автоматизованою системою HR-аналітики. Конфіденційно для внутрішнього використання.',
                    size: 16,
                    color: COLOR_MUTED,
                    font: 'Calibri'
                  })
                ]
              })
            ]
          })
        },
        children: [
          // Header Block
          new Paragraph({
            spacing: { before: 0, after: 60 },
            children: [
              new TextRun({
                text: 'КОМПАНІЯ «НАДІЯ»',
                bold: true,
                size: 22,
                color: COLOR_PRIMARY,
                font: 'Calibri'
              })
            ]
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 0, after: 100 },
            children: [
              new TextRun({
                text: 'ЗВІТ З РЕКРУТИНГУ ТА СТАЖУВАННЯ ДЛЯ КЕРІВНИКА',
                bold: true,
                size: 32, // 16pt
                color: COLOR_TEXT,
                font: 'Calibri'
              })
            ]
          }),
          new Paragraph({
            spacing: { before: 0, after: 200 },
            border: { bottom: { color: COLOR_PRIMARY, space: 1, style: BorderStyle.SINGLE, size: 12 } },
            children: [
              new TextRun({
                text: `Дата формування: ${todayStr} | Відділ управління та підбору персоналу | Статус: Актуальні дані`,
                color: COLOR_MUTED,
                size: 19,
                font: 'Calibri'
              })
            ]
          }),

          // Section: Tables
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 120 },
            children: [
              new TextRun({
                text: `1. АКТУАЛЬНІ ВІДКРИТІ ВАКАНСІЇ (${activeVacancies.length} посад)`,
                bold: true,
                size: 26,
                color: COLOR_PRIMARY,
                font: 'Calibri'
              })
            ]
          }),
          vacanciesTable,

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 120 },
            children: [
              new TextRun({
                text: `2. АКТИВНІ СТАЖЕРИ ТА РОЗМІЩЕННЯ (${activeInterns.length} осіб)`,
                bold: true,
                size: 26,
                color: COLOR_PRIMARY,
                font: 'Calibri'
              })
            ]
          }),
          internsTable,

          new Paragraph({
            spacing: { before: 250, after: 120 },
            border: { bottom: { color: COLOR_BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 } },
            children: []
          }),

          // Section: Analytical Report from AI / Engine
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 120 },
            children: [
              new TextRun({
                text: '3. АНАЛІТИЧНИЙ ЗВІТ ТА РЕКОМЕНДАЦІЇ ДЛЯ КЕРІВНИКА',
                bold: true,
                size: 26,
                color: COLOR_PRIMARY,
                font: 'Calibri'
              })
            ]
          }),
          ...contentParagraphs
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, filename);
}

/**
 * Exports a given DOM element to a professional PDF file using html2pdf.js.
 */
export async function exportReportToPdf(element: HTMLElement, customFilename?: string) {
  const todayStr = new Date().toLocaleDateString('uk-UA', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
  const filename = customFilename || `Zvit_Dlia_Kerivnyka_Nadiya_${todayStr.replace(/\./g, '_')}.pdf`;

  // Dynamically import html2pdf to ensure clean browser bundle
  const html2pdfModule: any = await import('html2pdf.js');
  const html2pdfFn = html2pdfModule.default || html2pdfModule;

  const opt = {
    margin: [10, 10, 10, 10], // top, left, bottom, right in mm
    filename: filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      logging: false,
      windowWidth: 1024
    },
    jsPDF: { 
      unit: 'mm' as const, 
      format: 'a4' as const, 
      orientation: 'portrait' as const 
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  await (html2pdfFn as any)().set(opt).from(element).save();
}
