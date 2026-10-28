import React from 'react';
import { X, Download, FileSpreadsheet, Calendar, Printer, CheckCircle2 } from 'lucide-react';
import { Operator, Shift } from '../types';
import { generateIcs, generateCsv, getShiftsForMonthlyReport } from '../utils/shiftLogic';
import { buildDailyCalendar, generateExcelHtmlWithColors } from '../utils/dailySchedule';
import { generateOfficialReportExcel, getOfficialReportCode } from '../utils/officialModelExport';

interface ExportModalProps {
  shifts: Shift[];
  operators: Operator[];
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  shifts,
  operators,
  onClose,
}) => {
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadFormattedExcel = () => {
    const dailyRows = buildDailyCalendar(shifts, operators);
    const htmlContent = generateExcelHtmlWithColors(dailyRows);
    downloadFile(
      htmlContent,
      'Calendario_Reperibilita_2027_2028_Formattato.xls',
      'application/vnd.ms-excel;charset=utf-8'
    );
  };

  const handleDownloadOfficialMonthlyModel = () => {
    // Default to Gennaio 2027 (first month)
    const reportShifts = getShiftsForMonthlyReport(shifts, 2027, 1);
    const code = getOfficialReportCode(reportShifts, 2027, 1);
    const excelContent = generateOfficialReportExcel({
      year: 2027,
      month: 1,
      monthLabel: 'Gennaio 2027',
      reportCode: code,
      startDateStr: reportShifts[0]?.startDate || '2027-01-05T09:00:00',
      endDateStr: reportShifts[reportShifts.length - 1]?.endDate || '2027-02-01T09:00:00',
      shifts: reportShifts,
      operators,
    });
    downloadFile(
      excelContent,
      `${code.replace(/\s+/g, '_')}.xls`,
      'application/vnd.ms-excel;charset=utf-8'
    );
  };

  const handleDownloadIcs = () => {
    const icsContent = generateIcs(shifts, operators);
    downloadFile(icsContent, 'Turni_Reperibilita_2027_2028.ics', 'text/calendar;charset=utf-8');
  };

  const handleDownloadCsv = () => {
    const csvContent = generateCsv(shifts, operators);
    downloadFile(csvContent, 'Turni_Reperibilita_2027_2028.csv', 'text/csv;charset=utf-8');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-600" />
              <span>Esportazione Calendario Reperibilità</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              392 giorni dal 5 Gen 2027 al 31 Gen 2028
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 pt-4 text-xs">
          {/* Format 1: Excel a colori (.xls) */}
          <div className="p-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 transition-colors flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5 shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-sm">Excel Formattato a Colori (.XLS)</h4>
                  <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">Richiesto</span>
                </div>
                <p className="text-slate-600 mt-1 leading-relaxed text-[11px]">
                  Tutti i 392 giorni in colonna con <strong>feriali in verde chiaro</strong>, <strong>sabato in giallo</strong>, <strong>domeniche in rosso chiaro</strong> e <strong>festività in celeste</strong>. Include orari di cambio alle 09:00 e recapiti H24.
                </p>
              </div>
            </div>
            <button
              onClick={handleDownloadFormattedExcel}
              className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors whitespace-nowrap self-center cursor-pointer"
            >
              Scarica Excel
            </button>
          </div>

          {/* Format 1B: Modello Ufficiale Regione Umbria Protezione Civile */}
          <div className="p-3 rounded-xl border border-red-300 bg-red-50/40 hover:bg-red-50/70 transition-colors flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-red-800 text-white shrink-0 mt-0.5 shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-xs">Modello Ufficiale Protezione Civile (.XLS)</h4>
                  <span className="text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 px-1.5 py-0.2 rounded">Dirigenti</span>
                </div>
                <p className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">
                  Modello conforme al file allegato (Regione Umbria / SOUR / CF / VAL / CT / LV / NOTE) con celle unite per turno e orari di cambio.
                </p>
              </div>
            </div>
            <button
              onClick={handleDownloadOfficialMonthlyModel}
              className="px-3 py-1.5 text-xs font-bold text-white bg-red-800 hover:bg-red-900 rounded-lg shadow-2xs transition-colors whitespace-nowrap self-center cursor-pointer"
            >
              Scarica .XLS
            </button>
          </div>

          {/* Format 2: iCalendar (.ics) */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Calendario per Smartphone & Outlook (.ICS)</h4>
                <p className="text-slate-500 mt-0.5 text-[11px]">
                  Compatibile con Google Calendar, Apple iCal e Microsoft Outlook.
                </p>
              </div>
            </div>
            <button
              onClick={handleDownloadIcs}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors whitespace-nowrap self-center"
            >
              Scarica .ICS
            </button>
          </div>

          {/* Format 3: CSV */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-200 text-slate-700 shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Foglio CSV Semplice (.CSV)</h4>
                <p className="text-slate-500 mt-0.5 text-[11px]">
                  Tabella con separatore punto e virgola (<code>;</code>) e codifica UTF-8 BOM.
                </p>
              </div>
            </div>
            <button
              onClick={handleDownloadCsv}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors whitespace-nowrap self-center"
            >
              Scarica .CSV
            </button>
          </div>

          {/* Format 4: Stampa */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Stampa / Salva in PDF</h4>
                <p className="text-slate-500 mt-0.5 text-[11px]">
                  Impaginazione con spazi per firme di servizio e timbro del responsabile.
                </p>
              </div>
            </div>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors whitespace-nowrap self-center"
            >
              Stampa / PDF
            </button>
          </div>

          <div className="flex items-center gap-2 pt-2 text-[11px] text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Tutti i cambi turno sono sincronizzati alle ore 09:00 nei soli giorni feriali (Lunedì–Venerdì).
            </span>
          </div>

          {/* Close */}
          <div className="flex items-center justify-end pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
