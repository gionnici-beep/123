import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  ShieldCheck,
  AlertCircle,
  UserCheck,
  ArrowRightLeft,
  Building2,
  Clock,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Layers,
  Edit3,
  MessageSquare,
  RotateCcw,
  Check,
} from 'lucide-react';
import { Operator, Shift, AmbitoType, AMBITI } from '../types';
import {
  formatItalianDate,
  formatShortDate,
  getShiftsForMonthlyReport,
  ensureShiftAssignments,
} from '../utils/shiftLogic';
import { getHolidayForDateStr } from '../utils/holidays';
import {
  generateOfficialReportExcel,
  getOfficialReportCode,
  formatOfficialDayLabel,
  formatShortOfficialDate,
} from '../utils/officialModelExport';

interface MonthlyReportViewProps {
  shifts: Shift[];
  operators: Operator[];
  onSelectShift?: (shift: Shift) => void;
  onUpdateShift?: (updatedShift: Shift) => void;
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  shifts,
  operators,
  onSelectShift,
  onUpdateShift,
}) => {
  const opMap = useMemo(() => new Map(operators.map((o) => [o.id, o])), [operators]);

  // Months available in the schedule: Gennaio 2027 to Gennaio 2028
  const months = useMemo(() => [
    { year: 2027, month: 1, label: 'Gennaio 2027' },
    { year: 2027, month: 2, label: 'Febbraio 2027' },
    { year: 2027, month: 3, label: 'Marzo 2027' },
    { year: 2027, month: 4, label: 'Aprile 2027' },
    { year: 2027, month: 5, label: 'Maggio 2027' },
    { year: 2027, month: 6, label: 'Giugno 2027' },
    { year: 2027, month: 7, label: 'Luglio 2027' },
    { year: 2027, month: 8, label: 'Agosto 2027' },
    { year: 2027, month: 9, label: 'Settembre 2027' },
    { year: 2027, month: 10, label: 'Ottobre 2027' },
    { year: 2027, month: 11, label: 'Novembre 2027' },
    { year: 2027, month: 12, label: 'Dicembre 2027' },
    { year: 2028, month: 1, label: 'Gennaio 2028' },
  ], []);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('2027-1');
  const [reportTab, setReportTab] = useState<'official' | 'summary'>('official');
  const [selectedAmbitoFilter, setSelectedAmbitoFilter] = useState<'ALL' | AmbitoType>('ALL');

  // Modal for editing free text note on a shift
  const [editingShiftNote, setEditingShiftNote] = useState<{
    shiftId: string;
    shiftNumber: number;
    autoFormula: string;
  } | null>(null);
  const [customNoteInput, setCustomNoteInput] = useState('');

  const [selYear, selMonth] = selectedMonthKey.split('-').map(Number);
  const currentMonthObj = months.find((m) => m.year === selYear && m.month === selMonth) || months[0];

  // Specific rule:
  // "i turni da rendicontare sono dal primo che inizia nel mese fino all'ultimo anche se a cavallo con il mese successivo"
  const rawMonthlyShifts = useMemo(() => {
    return getShiftsForMonthlyReport(shifts, selYear, selMonth);
  }, [shifts, selYear, selMonth]);

  // Ensure shifts have complete assignments for all 5 Ambiti (SOR, CF, VAL, CT, LV)
  const monthlyReportShifts = useMemo(() => {
    return rawMonthlyShifts.map((s, idx) => ensureShiftAssignments(s, operators, idx));
  }, [rawMonthlyShifts, operators]);

  // Build official report code: e.g. 2027_01 - dal 05_01_2027 al 01_02_2027
  const officialReportCode = useMemo(() => {
    return getOfficialReportCode(monthlyReportShifts, selYear, selMonth);
  }, [monthlyReportShifts, selYear, selMonth]);

  // Build calendar days array for the official template
  const officialDays = useMemo(() => {
    if (monthlyReportShifts.length === 0) return [];
    const firstShift = monthlyReportShifts[0];
    const lastShift = monthlyReportShifts[monthlyReportShifts.length - 1];
    const startD = new Date(firstShift.startDate);
    const endD = new Date(lastShift.endDate);

    const result: {
      date: Date;
      dateStr: string;
      isSaturday: boolean;
      isSunday: boolean;
      holiday: string | null;
      isHandover: boolean;
    }[] = [];

    const cur = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate());
    const endLimit = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate());
    const pad = (n: number) => String(n).padStart(2, '0');

    while (cur <= endLimit) {
      const y = cur.getFullYear();
      const m = pad(cur.getMonth() + 1);
      const d = pad(cur.getDate());
      const dateStr = `${y}-${m}-${d}`;
      const holiday = getHolidayForDateStr(dateStr);
      const dayOfWeek = cur.getDay();

      const isHandover = monthlyReportShifts.some((s) => {
        const sStart = s.startDate.slice(0, 10);
        const sEnd = s.endDate.slice(0, 10);
        return sStart === dateStr || sEnd === dateStr;
      });

      result.push({
        date: new Date(cur.getTime()),
        dateStr,
        isSaturday: dayOfWeek === 6,
        isSunday: dayOfWeek === 0,
        holiday,
        isHandover,
      });

      cur.setDate(cur.getDate() + 1);
    }

    return result;
  }, [monthlyReportShifts]);

  const lastOfficialDayStr = useMemo(() => {
    if (officialDays.length === 0) return '';
    return officialDays[officialDays.length - 1].dateStr;
  }, [officialDays]);

  // Pre-calculate shift spans for table rendering
  const shiftGroups = useMemo(() => {
    return monthlyReportShifts.map((shift) => {
      const sStart = new Date(shift.startDate);
      const sEnd = new Date(shift.endDate);
      const stTime = new Date(sStart.getFullYear(), sStart.getMonth(), sStart.getDate()).getTime();
      const endTime = new Date(sEnd.getFullYear(), sEnd.getMonth(), sEnd.getDate()).getTime();

      const daysInShift = officialDays.filter((d) => {
        const dTime = d.date.getTime();
        return dTime >= stTime && dTime <= endTime;
      });

      // Retrieve dynamic operators for all 5 Ambiti
      const sorOp = shift.assignments?.SOR
        ? opMap.get(shift.assignments.SOR.operatorId)
        : opMap.get(shift.operatorId);
      const cfOp = shift.assignments?.CF ? opMap.get(shift.assignments.CF.operatorId) : null;
      const valOp = shift.assignments?.VAL ? opMap.get(shift.assignments.VAL.operatorId) : null;
      const ctOp = shift.assignments?.CT ? opMap.get(shift.assignments.CT.operatorId) : null;
      const lvOp = shift.assignments?.LV ? opMap.get(shift.assignments.LV.operatorId) : null;

      const hasOverrides = shift.dailyOverrides && Object.keys(shift.dailyOverrides).length > 0;

      let autoFormula = `SOR: ${sorOp?.name.split(' ')[0] || ''} rep. da ore 9 del ${formatShortOfficialDate(sStart)} fino ore 9.00 del ${formatShortOfficialDate(sEnd)}`;
      if (hasOverrides) {
        const parts = Object.entries(shift.dailyOverrides!).map(([dt, ov]) => {
          const subOp = opMap.get(ov.operatorId);
          return `${dt.slice(8)}/${dt.slice(5, 7)}: ${subOp?.name} (${ov.reason || 'sostituisce titolare'})`;
        });
        autoFormula += ` — Sostituzioni: ${parts.join('; ')}`;
      }

      const hasCustomNote = Boolean(shift.notes && shift.notes.trim().length > 0);
      const noteText = hasCustomNote ? shift.notes! : autoFormula;

      return {
        shift,
        sorOp,
        cfOp,
        valOp,
        ctOp,
        lvOp,
        hasOverrides,
        hasCustomNote,
        autoFormula,
        noteText,
        days: daysInShift,
        rowSpan: daysInShift.length,
      };
    });
  }, [monthlyReportShifts, officialDays, opMap]);

  // Calculate statistics per operator for this monthly report across all 5 Ambiti
  const operatorBreakdown = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');

    return operators
      .filter((op) => selectedAmbitoFilter === 'ALL' || op.ambito === selectedAmbitoFilter)
      .map((op) => {
        let titularDays = 0;
        let substitutionDays = 0;

        monthlyReportShifts.forEach((s) => {
          const start = new Date(s.startDate);
          const end = new Date(s.endDate);
          const cur = new Date(start.getTime());

          const asg = s.assignments?.[op.ambito || 'SOR'];
          const baseOpId = asg?.operatorId || (op.ambito === 'SOR' || !op.ambito ? s.operatorId : '');
          const overrides = asg?.dailyOverrides || s.dailyOverrides;

          while (cur < end) {
            const mid = new Date(cur.getTime() + 12 * 3600 * 1000);
            const dateKey = `${mid.getFullYear()}-${pad(mid.getMonth() + 1)}-${pad(mid.getDate())}`;
            const override = overrides?.[dateKey];

            if (override) {
              if (override.operatorId === op.id) {
                substitutionDays += 1;
              }
            } else if (baseOpId === op.id) {
              titularDays += 1;
            }

            cur.setDate(cur.getDate() + 1);
          }
        });

        const totalDays = titularDays + substitutionDays;
        const exceeds = totalDays > op.maxDaysPerMonth;

        return {
          operator: op,
          titularDays,
          substitutionDays,
          totalDays,
          exceeds,
        };
      })
      .filter((item) => item.totalDays > 0 || item.operator.active)
      .sort((a, b) => {
        if (a.operator.ambito !== b.operator.ambito) {
          return (a.operator.ambito || '').localeCompare(b.operator.ambito || '');
        }
        return a.operator.name.localeCompare(b.operator.name, 'it');
      });
  }, [monthlyReportShifts, operators, selectedAmbitoFilter]);

  const totalReportDays = useMemo(() => {
    return monthlyReportShifts.reduce((acc, s) => acc + s.durationDays, 0);
  }, [monthlyReportShifts]);

  // Export official model to Excel matching the exact PDF template
  const handleDownloadOfficialExcel = () => {
    if (monthlyReportShifts.length === 0) return;
    const excelContent = generateOfficialReportExcel({
      year: selYear,
      month: selMonth,
      monthLabel: currentMonthObj.label,
      reportCode: officialReportCode,
      startDateStr: monthlyReportShifts[0].startDate,
      endDateStr: monthlyReportShifts[monthlyReportShifts.length - 1].endDate,
      shifts: monthlyReportShifts,
      operators,
    });

    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${officialReportCode.replace(/\s+/g, '_')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Controls */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-100 text-red-800">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Rendicontazione Mensile Reperibilità — Modello Dirigenti</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-semibold">
                  5 Ambiti: SOR · CF · VAL · CT · LV
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Conforme al modello ufficiale della Regione Umbria (con caselle reperibili bianche, doppio bordo rosso su ultimo giorno e cambio turno in verde bold)
              </p>
            </div>
          </div>
        </div>

        {/* Month Selector and Download Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <select
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-red-500 shadow-xs cursor-pointer"
          >
            {months.map((m) => (
              <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Download Official Excel button */}
          <button
            onClick={handleDownloadOfficialExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer"
            title="Scarica il file Excel (.xls) impaginato con caselle bianche e doppio bordo rosso sull'ultimo giorno"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Scarica Excel Ufficiale (.xls)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Stampa / PDF</span>
          </button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setReportTab('official')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            reportTab === 'official'
              ? 'bg-red-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Modello Ufficiale Protezione Civile (PDF / XLSX)</span>
        </button>

        <button
          onClick={() => setReportTab('summary')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            reportTab === 'summary'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Prospetto Amministrativo & Liquidazione CCNL (Tetto 6 gg per Ambito)</span>
        </button>
      </div>

      {/* TAB 1: MODELLO UFFICIALE REGIONE UMBRIA */}
      {reportTab === 'official' && (
        <div className="space-y-6">
          {/* Official Document Container */}
          <div className="bg-white border-2 border-slate-800 rounded-xl shadow-md p-6 sm:p-8 overflow-hidden print:p-0 print:border-none print:shadow-none">
            {/* Header Block matching PDF */}
            <div className="text-center mb-6 space-y-1">
              <div className="inline-block border-b-2 border-slate-900 pb-1 mb-1">
                <h1 className="text-2xl font-serif font-black text-slate-900 uppercase tracking-widest">
                  Regione Umbria
                </h1>
              </div>
              <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                Direzione Regionale: Governo del Territorio, Ambiente, Protezione Civile, Riqualificazione Urbana, Coordinamento PNRR
              </p>
              <p className="text-xs font-bold text-slate-900">
                Servizio: Protezione civile ed emergenze
              </p>
            </div>

            {/* Official Crimson Red Banner */}
            <div className="bg-red-800 text-white font-bold text-center py-2 px-4 text-sm sm:text-base border border-slate-900 shadow-xs mb-6 uppercase tracking-wider font-mono">
              Turni di reperibilità: {officialReportCode}
            </div>

            {/* Official Table */}
            <div className="overflow-x-auto border border-slate-900">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold text-[11px] text-center border-b-2 border-slate-900 divide-x divide-slate-800">
                    <th className="py-2.5 px-3 w-32">Data</th>
                    <th className="py-2.5 px-3 w-36">Festività</th>
                    <th className="py-2.5 px-4 w-48 bg-orange-100 text-orange-950">
                      <div>SOR</div>
                      <div className="text-[9px] font-normal text-orange-900 leading-tight">
                        Sala Operativa Regionale
                      </div>
                    </th>
                    <th className="py-2.5 px-3 w-36 bg-amber-50 text-amber-950">
                      <div>CF</div>
                      <div className="text-[9px] font-normal text-amber-900 leading-tight">
                        Centro Funzionale
                      </div>
                    </th>
                    <th className="py-2.5 px-3 w-40 bg-orange-50 text-orange-950">
                      <div>VAL</div>
                      <div className="text-[9px] font-normal text-orange-900 leading-tight">
                        Valutazioni Tecniche
                      </div>
                    </th>
                    <th className="py-2.5 px-3 w-36 bg-sky-50 text-sky-950">
                      <div>CT</div>
                      <div className="text-[9px] font-normal text-sky-900 leading-tight">
                        Controllo Territoriale
                      </div>
                    </th>
                    <th className="py-2.5 px-3 w-32 bg-yellow-50 text-yellow-950">
                      <div>LV</div>
                      <div className="text-[9px] font-normal text-yellow-900 leading-tight">
                        Logistica e Volontariato
                      </div>
                    </th>
                    <th className="py-2.5 px-4 min-w-64">NOTE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {shiftGroups.map((group) => {
                    const { shift, sorOp, cfOp, valOp, ctOp, lvOp, hasOverrides, hasCustomNote, autoFormula, noteText, days } = group;

                    // Does this shift contain the final calendar day of the report?
                    const hasLastDay = days.some((d) => d.dateStr === lastOfficialDayStr);
                    const regularDays = hasLastDay
                      ? days.filter((d) => d.dateStr !== lastOfficialDayStr)
                      : days;
                    const lastDayObj = hasLastDay
                      ? days.find((d) => d.dateStr === lastOfficialDayStr)
                      : null;
                    const regRowSpan = regularDays.length;

                    return (
                      <React.Fragment key={shift.id}>
                        {/* 1. Regular days of this shift */}
                        {regularDays.map((dayObj, dIdx) => {
                          const isBoundaryBeforeLast = hasLastDay && dIdx === regularDays.length - 1;

                          // User mandated color scheme:
                          // Feriali: Verde chiaro (#DCFCE7)
                          // Sabato: Giallo (#FEF08A)
                          // Domenica: Rosso chiaro (#FEE2E2)
                          // Festività: Celeste (#BAE6FD)
                          let dateBgClass = 'bg-[#DCFCE7] text-[#14532D]'; // Feriale
                          let festBgClass = 'bg-[#DCFCE7]';

                          if (dayObj.holiday) {
                            dateBgClass = 'bg-[#BAE6FD] text-[#0C4A6E] font-bold';
                            festBgClass = 'bg-[#BAE6FD] text-[#0C4A6E] font-bold';
                          } else if (dayObj.isSunday) {
                            dateBgClass = 'bg-[#FEE2E2] text-[#991B1B] font-bold';
                            festBgClass = 'bg-[#FEE2E2]';
                          } else if (dayObj.isSaturday) {
                            dateBgClass = 'bg-[#FEF08A] text-[#713F12] font-bold';
                            festBgClass = 'bg-[#FEF08A]';
                          }

                          // Border separating from the last day: double red border
                          const borderBottomStyle: React.CSSProperties | undefined = isBoundaryBeforeLast
                            ? { borderBottom: '3px double #DC2626' }
                            : undefined;

                          return (
                            <tr
                              key={dayObj.dateStr}
                              className="divide-x divide-slate-800"
                            >
                              {/* Colonna Data: cambio turno verde bold */}
                              <td
                                style={borderBottomStyle}
                                className={`py-1.5 px-2.5 text-[11px] whitespace-nowrap border-b border-slate-400 ${dateBgClass}`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span
                                    className={
                                      dayObj.isHandover
                                        ? 'text-emerald-700 font-bold underline decoration-emerald-600'
                                        : ''
                                    }
                                  >
                                    {formatOfficialDayLabel(dayObj.date)}
                                  </span>
                                  {dayObj.isHandover && (
                                    <span className="text-[9px] font-mono px-1 py-0.2 bg-emerald-700 text-white rounded font-bold">
                                      09:00
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Colonna Festività */}
                              <td
                                style={borderBottomStyle}
                                className={`py-1.5 px-2.5 text-[10px] border-b border-slate-400 ${festBgClass}`}
                              >
                                {dayObj.holiday || ''}
                              </td>

                              {/* Colonne Ambiti (SOR, CF, VAL, CT, LV, NOTE) - CASIS BIANCHE */}
                              {dIdx === 0 && (
                                <>
                                  {/* SOR (Sala Operativa Regionale) - BIANCA */}
                                  <td
                                    rowSpan={regRowSpan}
                                    onClick={() => onSelectShift?.(shift)}
                                    style={hasLastDay ? { borderBottom: '3px double #DC2626' } : undefined}
                                    className={`py-2 px-3 text-center align-middle font-bold text-xs bg-white text-slate-900 border-b border-slate-800 transition-colors ${
                                      onSelectShift ? 'cursor-pointer hover:bg-slate-50' : ''
                                    }`}
                                    title={
                                      onSelectShift
                                        ? 'Clicca per modificare o inserire variazioni/sostituzioni su questo turno'
                                        : undefined
                                    }
                                  >
                                    <div className="space-y-1">
                                      <div className="font-bold text-sm tracking-wide text-slate-950 uppercase">
                                        {sorOp?.name || ''}
                                      </div>
                                      <div className="text-[10px] text-slate-500 font-mono">
                                        Turno #{String(shift.shiftNumber).padStart(2, '0')} ({shift.durationDays} gg)
                                      </div>
                                      {hasOverrides && (
                                        <div className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded">
                                          <ArrowRightLeft className="w-2.5 h-2.5 text-amber-700" />
                                          <span>Variazione</span>
                                        </div>
                                      )}
                                    </div>
                                  </td>

                                  {/* CF (Centro Funzionale) - BIANCA */}
                                  <td
                                    rowSpan={regRowSpan}
                                    style={hasLastDay ? { borderBottom: '3px double #DC2626' } : undefined}
                                    className="py-2 px-3 text-center align-middle text-xs bg-white text-slate-900 font-medium border-b border-slate-800"
                                  >
                                    {cfOp?.name || 'Laureti Barbara'}
                                  </td>

                                  {/* VAL (Valutazioni Tecniche) - BIANCA */}
                                  <td
                                    rowSpan={regRowSpan}
                                    style={hasLastDay ? { borderBottom: '3px double #DC2626' } : undefined}
                                    className="py-2 px-3 text-center align-middle text-xs bg-white text-slate-900 font-medium border-b border-slate-800"
                                  >
                                    {valOp?.name || 'Canonico Andrea'}
                                  </td>

                                  {/* CT (Controllo Territoriale) - BIANCA */}
                                  <td
                                    rowSpan={regRowSpan}
                                    style={hasLastDay ? { borderBottom: '3px double #DC2626' } : undefined}
                                    className="py-2 px-3 text-center align-middle text-xs bg-white text-slate-900 font-medium border-b border-slate-800"
                                  >
                                    {ctOp?.name || 'Motti Andrea'}
                                  </td>

                                  {/* LV (Logistica e Volontariato) - BIANCA */}
                                  <td
                                    rowSpan={regRowSpan}
                                    style={hasLastDay ? { borderBottom: '3px double #DC2626' } : undefined}
                                    className="py-2 px-3 text-center align-middle text-xs bg-white text-slate-900 font-medium border-b border-slate-800"
                                  >
                                    {lvOp?.name || 'Pasquetti Michele'}
                                  </td>

                                  {/* NOTE - BIANCA CON POSSIBILITA DI INSERIRE TESTO LIBERO */}
                                  <td
                                    rowSpan={regRowSpan}
                                    style={hasLastDay ? { borderBottom: '3px double #DC2626' } : undefined}
                                    className="py-2 px-3.5 align-middle text-[11px] text-slate-800 bg-white border-b border-slate-800 leading-snug group/note"
                                  >
                                    <div className="space-y-1.5">
                                      <div className="flex items-start justify-between gap-1.5">
                                        <div className="font-mono text-[11px] font-semibold text-slate-900 whitespace-pre-line flex-1">
                                          {noteText}
                                        </div>
                                        {onUpdateShift && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingShiftNote({
                                                shiftId: shift.id,
                                                shiftNumber: shift.shiftNumber,
                                                autoFormula,
                                              });
                                              setCustomNoteInput(shift.notes || '');
                                            }}
                                            className="shrink-0 p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                                            title="Inserisci o modifica testo libero per questa nota"
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>

                                      {hasCustomNote ? (
                                        <div className="flex items-center gap-1.5 pt-0.5">
                                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-sans">
                                            <MessageSquare className="w-2.5 h-2.5" />
                                            Testo libero
                                          </span>
                                          {onUpdateShift && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onUpdateShift({ ...shift, notes: undefined });
                                              }}
                                              className="text-[9px] text-slate-400 hover:text-red-600 underline cursor-pointer"
                                              title="Ripristina formula predefinita"
                                            >
                                              Ripristina formula
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        onUpdateShift && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingShiftNote({
                                                shiftId: shift.id,
                                                shiftNumber: shift.shiftNumber,
                                                autoFormula,
                                              });
                                              setCustomNoteInput(noteText);
                                            }}
                                            className="text-[10px] text-slate-500 hover:text-red-700 font-sans inline-flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                                          >
                                            <Edit3 className="w-2.5 h-2.5" />
                                            <span>Inserisci testo libero</span>
                                          </button>
                                        )
                                      )}

                                      {hasOverrides && shift.dailyOverrides && !hasCustomNote && (
                                        <div className="mt-1 pt-1 border-t border-amber-200 text-[10px] text-amber-950 bg-amber-50 p-1.5 rounded">
                                          <strong className="text-amber-900 block font-semibold mb-0.5">
                                            Dettaglio sostituzioni:
                                          </strong>
                                          {Object.entries(shift.dailyOverrides).map(([dt, ov]) => {
                                            const subOp = opMap.get(ov.operatorId);
                                            return (
                                              <div key={dt} className="flex items-center justify-between py-0.5">
                                                <span>
                                                  {dt.slice(8)}/{dt.slice(5, 7)}: <strong>{subOp?.name}</strong>
                                                </span>
                                                <span className="italic text-amber-800">
                                                  ({ov.reason || 'Malattia'})
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}

                        {/* 2. DEDICATO ALL'ULTIMA GIORNATA DEL REPORT:
                            "Report dirigenti: tutta la riga (tutte le celle) dell'ultima giornata va evidenziata sopra la data e sotto la data con doppio bordo rosso, non solo sotto ma anche sopra"
                            "ad esempio:la data del 02/02/27 è una RIGA da evidenziare con doppio bordo rosso, sia sotto che con il confine con quella del 01/02/27" */}
                        {lastDayObj && (
                          <tr
                            key={lastDayObj.dateStr}
                            className="divide-x divide-slate-800"
                          >
                            {/* Cella 1: Data (con doppio bordo rosso superiore e inferiore) */}
                            <td
                              style={{
                                borderTop: '3px double #DC2626',
                                borderBottom: '3px double #DC2626',
                              }}
                              className={`py-2 px-2.5 text-[11px] whitespace-nowrap ${
                                lastDayObj.holiday
                                  ? 'bg-[#BAE6FD] text-[#0C4A6E] font-bold'
                                  : lastDayObj.isSunday
                                  ? 'bg-[#FEE2E2] text-[#991B1B] font-bold'
                                  : lastDayObj.isSaturday
                                  ? 'bg-[#FEF08A] text-[#713F12] font-bold'
                                  : 'bg-[#DCFCE7] text-[#14532D]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-emerald-700 font-bold underline decoration-emerald-600">
                                  {formatOfficialDayLabel(lastDayObj.date)}
                                </span>
                                <span className="text-[9px] font-mono px-1 py-0.2 bg-emerald-700 text-white rounded font-bold">
                                  09:00
                                </span>
                              </div>
                            </td>

                            {/* Cella 2: Festività (con doppio bordo rosso superiore e inferiore) */}
                            <td
                              style={{
                                borderTop: '3px double #DC2626',
                                borderBottom: '3px double #DC2626',
                              }}
                              className={`py-2 px-2.5 text-[10px] ${
                                lastDayObj.holiday
                                  ? 'bg-[#BAE6FD] text-[#0C4A6E] font-bold'
                                  : lastDayObj.isSunday
                                  ? 'bg-[#FEE2E2]'
                                  : lastDayObj.isSaturday
                                  ? 'bg-[#FEF08A]'
                                  : 'bg-[#DCFCE7]'
                              }`}
                            >
                              {lastDayObj.holiday || ''}
                            </td>

                            {/* Cella 3: SOR - BIANCA (con doppio bordo rosso superiore e inferiore) */}
                            <td
                              style={{
                                borderTop: '3px double #DC2626',
                                borderBottom: '3px double #DC2626',
                                backgroundColor: '#FFFFFF',
                              }}
                              onClick={() => onSelectShift?.(shift)}
                              className={`py-2 px-3 text-center align-middle font-bold text-xs bg-white text-slate-900 ${
                                onSelectShift ? 'cursor-pointer hover:bg-slate-50' : ''
                              }`}
                              title={
                                onSelectShift
                                  ? 'Clicca per modificare o inserire variazioni/sostituzioni su questo turno'
                                  : undefined
                              }
                            >
                              <div className="space-y-0.5">
                                <div className="font-bold text-xs uppercase text-slate-950">
                                  {sorOp?.name || ''}
                                </div>
                                <div className="text-[9.5px] text-slate-500 font-mono">
                                  fino ore 09:00 (fine turno #{String(shift.shiftNumber).padStart(2, '0')})
                                </div>
                              </div>
                            </td>

                            {/* Cella 4: CF - BIANCA (con doppio bordo rosso superiore e inferiore) */}
                            <td
                              style={{
                                borderTop: '3px double #DC2626',
                                borderBottom: '3px double #DC2626',
                                backgroundColor: '#FFFFFF',
                              }}
                              className="py-2 px-3 text-center align-middle text-xs bg-white text-slate-900 font-medium"
                            >
                              <div className="font-semibold text-xs text-slate-900">
                                {cfOp?.name || 'Laureti Barbara'}
                              </div>
                              <div className="text-[9.5px] text-slate-500">fino ore 09:00</div>
                            </td>

                            {/* Cella 5: VAL - BIANCA (con doppio bordo rosso superiore e inferiore) */}
                            <td
                              style={{
                                borderTop: '3px double #DC2626',
                                borderBottom: '3px double #DC2626',
                                backgroundColor: '#FFFFFF',
                              }}
                              className="py-2 px-3 text-center align-middle text-xs bg-white text-slate-900 font-medium"
                            >
                              <div className="font-semibold text-xs text-slate-900">
                                {valOp?.name || 'Canonico Andrea'}
                              </div>
                              <div className="text-[9.5px] text-slate-500">fino ore 09:00</div>
                            </td>

                            {/* Cella 6: CT - BIANCA (con doppio bordo rosso superiore e inferiore) */}
                            <td
                              style={{
                                borderTop: '3px double #DC2626',
                                borderBottom: '3px double #DC2626',
                                backgroundColor: '#FFFFFF',
                              }}
                              className="py-2 px-3 text-center align-middle text-xs bg-white text-slate-900 font-medium"
                            >
                              <div className="font-semibold text-xs text-slate-900">
                                {ctOp?.name || 'Motti Andrea'}
                              </div>
                              <div className="text-[9.5px] text-slate-500">fino ore 09:00</div>
                            </td>

                            {/* Cella 7: LV - BIANCA (con doppio bordo rosso superiore e inferiore) */}
                            <td
                              style={{
                                borderTop: '3px double #DC2626',
                                borderBottom: '3px double #DC2626',
                                backgroundColor: '#FFFFFF',
                              }}
                              className="py-2 px-3 text-center align-middle text-xs bg-white text-slate-900 font-medium"
                            >
                              <div className="font-semibold text-xs text-slate-900">
                                {lvOp?.name || 'Pasquetti Michele'}
                              </div>
                              <div className="text-[9.5px] text-slate-500">fino ore 09:00</div>
                            </td>

                            {/* Cella 8: NOTE - BIANCA (con doppio bordo rosso superiore e inferiore) */}
                            <td
                              style={{
                                borderTop: '3px double #DC2626',
                                borderBottom: '3px double #DC2626',
                                backgroundColor: '#FFFFFF',
                              }}
                              className="py-2 px-3.5 align-middle text-[11px] text-slate-800 bg-white leading-snug"
                            >
                              <div className="space-y-1">
                                <span className="font-mono text-[11px] font-semibold text-slate-900 block">
                                  {hasCustomNote
                                    ? noteText
                                    : 'Passaggio consegne ore 09:00 — Fine periodo rendicontazione'}
                                </span>
                                {hasCustomNote && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-sans">
                                    <MessageSquare className="w-2.5 h-2.5" />
                                    Testo libero
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom section matching the official PDF */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left Box: NB instructions */}
              <div className="border border-slate-900 p-4 bg-slate-50 text-xs text-slate-800 space-y-2">
                <p className="font-bold text-slate-950 uppercase tracking-wide text-[11px]">
                  Nota Operativa di Servizio (NB):
                </p>
                <p className="leading-relaxed">
                  Il turno di reperibilità, salvo diversa indicazione, <strong>inizia e termina alle ore 09:00 delle giornate evidenziate</strong>.
                </p>
                <p className="text-[11px] text-slate-600">
                  I cambi turno avvengono rigorosamente nei giorni feriali lavorativi. Non sono ammessi cambi turno in giornate di sabato, domenica o festività infrasettimanali. Copertura garantita per tutti e 5 gli Ambiti (SOR, CF, VAL, CT, LV).
                </p>
              </div>

              {/* Right Box: Sub-table Turni reperibilità mese */}
              <div className="border border-slate-900 overflow-hidden">
                <div className="bg-slate-200 text-slate-900 font-bold text-center py-1.5 px-3 text-xs border-b border-slate-900">
                  Turni reperibilità mese di {currentMonthObj.label.toLowerCase()}
                </div>
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[11px] text-slate-700 border-b border-slate-800 divide-x divide-slate-800">
                      <th colSpan={2} className="py-1 px-3 text-center">Dalle ore</th>
                      <th colSpan={2} className="py-1 px-3 text-center">Alle ore</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {monthlyReportShifts.map((s) => {
                      const sStart = new Date(s.startDate);
                      const sEnd = new Date(s.endDate);
                      return (
                        <tr key={s.id} className="divide-x divide-slate-300 text-[11px]">
                          <td className="py-1 px-2.5 text-center font-bold text-slate-600 w-16">
                            9:00 di
                          </td>
                          <td className="py-1 px-3 font-semibold text-emerald-800">
                            {formatShortOfficialDate(sStart)}
                          </td>
                          <td className="py-1 px-2.5 text-center font-bold text-slate-600 w-16">
                            9:00 di
                          </td>
                          <td className="py-1 px-3 font-semibold text-emerald-800">
                            {formatShortOfficialDate(sEnd)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Official Footer matching PDF */}
            <div className="mt-8 pt-4 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <div>
                Rendicontazione turno: primo turno avviato fino all'ultimo a cavallo · Ambiti: SOR, CF, VAL, CT, LV
              </div>
              <div>
                {officialReportCode.replace(/\s+/g, '_')}.xlsx &nbsp;&nbsp;&nbsp;&nbsp; CG/gc
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROSPETTO AMMINISTRATIVO & LIQUIDAZIONE CCNL (5 AMBITI) */}
      {reportTab === 'summary' && (
        <div className="space-y-6">
          {/* Corporate Scope Specification Banner */}
          <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-red-400 font-semibold block">
                  Criterio di Rendicontazione Amministrativa e Vincolo 6 Giornate
                </span>
                <p className="text-sm font-bold text-slate-100">
                  Periodo di competenza: {currentMonthObj.label} ({officialReportCode})
                </p>
                <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                  Inclusi tutti i turni dal primo avviato a inizio mese fino all'ultimo a cavallo con il mese successivo per tutti i <strong>5 Ambiti di Reperibilità</strong> (SOR, CF, VAL, CT, LV).
                </p>
              </div>

              <div className="text-right shrink-0 bg-slate-800 p-3.5 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Turni Avviati</span>
                <span className="text-2xl font-mono font-bold text-white tabular-nums">
                  {monthlyReportShifts.length}
                </span>
                <span className="text-[11px] text-emerald-400 block mt-0.5 font-medium">
                  {totalReportDays} giornate totali
                </span>
              </div>
            </div>
          </div>

          {/* Ambito Filter Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedAmbitoFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                selectedAmbitoFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Tutti gli Ambiti ({operatorBreakdown.length})
            </button>
            {(['SOR', 'CF', 'VAL', 'CT', 'LV'] as AmbitoType[]).map((amb) => {
              const cfg = AMBITI[amb];
              const count = operators.filter((o) => (o.ambito === amb || (!o.ambito && amb === 'SOR')) && o.active).length;
              return (
                <button
                  key={amb}
                  onClick={() => setSelectedAmbitoFilter(amb)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    selectedAmbitoFilter === amb
                      ? 'bg-red-800 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{amb} - {cfg.fullName}</span>
                  <span className="ml-1.5 text-[10px] opacity-80 font-mono">({count} rep.)</span>
                </button>
              );
            })}
          </div>

          {/* TABLE: Riepilogo Presenze e Competenze per Reperibile */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Riepilogo Presenze e Competenze per Reperibile ({currentMonthObj.label})</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Tetto massimo: 6 giornate mensili per reperibile
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                    <th className="py-3 px-4">Nominativo Reperibile</th>
                    <th className="py-3 px-3">Ambito</th>
                    <th className="py-3 px-4">Ruolo Tecnico</th>
                    <th className="py-3 px-3 text-center">Giornate Titolare</th>
                    <th className="py-3 px-3 text-center">Giornate in Sostituzione</th>
                    <th className="py-3 px-3 text-center font-bold">Totale Giornate</th>
                    <th className="py-3 px-4">Recapito Telefonico H24</th>
                    <th className="py-3 px-4 text-center">Conformità CCNL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {operatorBreakdown.map((item) => (
                    <tr key={item.operator.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[10px]"
                            style={{ backgroundColor: item.operator.color }}
                          >
                            {item.operator.name.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <span>{item.operator.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                          {item.operator.ambito || 'SOR'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{item.operator.role}</td>
                      <td className="py-3 px-3 text-center font-mono tabular-nums">{item.titularDays} gg</td>
                      <td className="py-3 px-3 text-center font-mono tabular-nums text-amber-800">
                        {item.substitutionDays > 0 ? `${item.substitutionDays} gg` : '0'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 bg-slate-50 tabular-nums">
                        {item.totalDays} gg
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{item.operator.phone}</td>
                      <td className="py-3 px-4 text-center">
                        {!item.exceeds ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Conforme (≤6 gg)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Eccede tetto</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures Block for Department Directors */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-6">
              Approvazione Dirigenziale per Ambito e Liquidazione Competenze
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs text-slate-700 pt-2 border-t border-slate-100">
              <div>
                <p className="font-semibold text-slate-900">Il Responsabile della Gestione Turni (SOR / Ambiti)</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Si attesta la regolarità delle prestazioni svolte</p>
                <div className="mt-8 border-b border-dashed border-slate-300 w-60"></div>
                <p className="text-[10px] text-slate-400 mt-1">Firma e data di trasmissione</p>
              </div>

              <div>
                <p className="font-semibold text-slate-900">Il Dirigente Competente per Ambito</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Visto per approvazione e inoltro all'Ufficio Stipendi/HR</p>
                <div className="mt-8 border-b border-dashed border-slate-300 w-60"></div>
                <p className="text-[10px] text-slate-400 mt-1">Firma per visto e data di approvazione</p>
              </div>
            </div>
          </div>
      {/* Modal: Inserimento Testo Libero per Campo NOTE */}
      {editingShiftNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-red-100 text-red-800 rounded-lg">
                  <Edit3 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Modifica Campo NOTE · Testo Libero
                  </h3>
                  <p className="text-xs text-slate-500">
                    Turno #{editingShiftNote.shiftNumber} (Report Dirigenti)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingShiftNote(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Inserisci testo libero da riportare nel report:
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomNoteInput(editingShiftNote.autoFormula)}
                    className="text-[11px] font-medium text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Copia formula predefinita</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={customNoteInput}
                  onChange={(e) => setCustomNoteInput(e.target.value)}
                  placeholder="Scrivi qui il testo libero della nota (es. VAL: Canonico sostituisce Tarozzi con autorizzazione Dirigente...)"
                  className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600 leading-relaxed"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Questo testo apparirà esattamente nella colonna <strong>NOTE</strong> del Report Dirigenti e nel file Excel esportato.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                <span className="font-semibold text-slate-700 block mb-0.5">Formula automatica di sistema:</span>
                <span className="font-mono text-[11px] text-slate-800 break-words">{editingShiftNote.autoFormula}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (onUpdateShift) {
                    const targetShift = shifts.find((s) => s.id === editingShiftNote.shiftId);
                    if (targetShift) {
                      onUpdateShift({ ...targetShift, notes: undefined });
                    }
                  }
                  setEditingShiftNote(null);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-red-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Svuota (ripristina automatica)
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingShiftNote(null)}
                  className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateShift) {
                      const targetShift = shifts.find((s) => s.id === editingShiftNote.shiftId);
                      if (targetShift) {
                        const trimmed = customNoteInput.trim();
                        onUpdateShift({ ...targetShift, notes: trimmed.length > 0 ? trimmed : undefined });
                      }
                    }
                    setEditingShiftNote(null);
                  }}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Salva Nota Libera</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
