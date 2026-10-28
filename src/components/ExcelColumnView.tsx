import React, { useState, useMemo } from 'react';
import { Download, FileSpreadsheet, Search, Filter, ArrowRightLeft, Calendar, ShieldCheck, Check } from 'lucide-react';
import { Operator, Shift, AmbitoType, AMBITI } from '../types';
import { buildDailyCalendar, DailyCalendarRow, generateExcelHtmlWithColors } from '../utils/dailySchedule';

interface ExcelColumnViewProps {
  shifts: Shift[];
  operators: Operator[];
  onSelectShift: (shift: Shift) => void;
  onOpenSwap: (shift: Shift) => void;
}

export const ExcelColumnView: React.FC<ExcelColumnViewProps> = ({
  shifts,
  operators,
  onSelectShift,
  onOpenSwap,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedAmbito, setSelectedAmbito] = useState<'ALL' | AmbitoType>('SOR');
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'weekend' | 'holidays' | 'handovers'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Precompute 392 day rows
  const allRows = useMemo(() => {
    return buildDailyCalendar(shifts, operators);
  }, [shifts, operators]);

  // Months list for quick selector
  const monthOptions = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    const seen = new Set<string>();

    allRows.forEach((r) => {
      const key = `${r.yearNumber}-${r.monthNumber}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ key, label: r.monthLabel });
      }
    });

    return list;
  }, [allRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      // Month filter
      if (selectedMonth !== 'all') {
        const key = `${row.yearNumber}-${row.monthNumber}`;
        if (key !== selectedMonth) return false;
      }

      // Operator filter
      if (selectedOperator !== 'all') {
        if (row.activeOperator?.id !== selectedOperator) return false;
      }

      // Type filter
      if (filterType === 'weekend' && !row.isSaturday && !row.isSunday) return false;
      if (filterType === 'holidays' && !row.isOtherHoliday) return false;
      if (filterType === 'handovers' && !row.isHandoverDay) return false;

      // Text search
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchesDate = row.formattedDate.includes(term) || row.dateStr.includes(term);
        const matchesDay = row.dayOfWeekName.toLowerCase().includes(term);
        const matchesOp = row.activeOperator?.name.toLowerCase().includes(term);
        const matchesHoliday = row.holidayName?.toLowerCase().includes(term);
        const matchesShift = row.activeShift && `turno #${row.activeShift.shiftNumber}`.includes(term);

        if (!matchesDate && !matchesDay && !matchesOp && !matchesHoliday && !matchesShift) {
          return false;
        }
      }

      return true;
    });
  }, [allRows, selectedMonth, selectedOperator, filterType, searchTerm]);

  // Download Excel with colors
  const handleDownloadExcel = () => {
    const htmlContent = generateExcelHtmlWithColors(allRows);
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Calendario_Reperibilita_2027_2028_Formattato.xls';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Visual Legend & Download Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>Calendario in Colonna (Stile Excel Formattato)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualizzazione riga per riga di tutti i 392 giorni con evidenziazione cromatica richiesta
            </p>
          </div>

          {/* Color Legend (Exact user requirement variation) */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-950 font-semibold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              Feriali (Verde Chiaro)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-yellow-100 border border-yellow-300 text-yellow-950 font-semibold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
              Sabato (Giallo)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-rose-100 border border-rose-300 text-rose-950 font-semibold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
              Domeniche (Rosso Chiaro)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-sky-100 border border-sky-300 text-sky-950 font-semibold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
              Festività (Celeste)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-blue-100 border border-blue-300 text-blue-900 font-bold">
              09:00 Cambio Turno
            </span>
          </div>

          {/* Direct Download Button */}
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors whitespace-nowrap self-start lg:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>Scarica Excel a Colori (.xls)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca per data (es. 15/01/2027), operatore, festività..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Ambito selector */}
          <select
            value={selectedAmbito}
            onChange={(e) => {
              setSelectedAmbito(e.target.value as 'ALL' | AmbitoType);
              setSelectedOperator('all');
            }}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">Tutti gli Ambiti</option>
            <option value="SOR">SOR (Sala Operativa)</option>
            <option value="CF">CF (Centro Funzionale)</option>
            <option value="VAL">VAL (Valutazioni Tecniche)</option>
            <option value="CT">CT (Controllo Territoriale)</option>
            <option value="LV">LV (Logistica e Volontariato)</option>
          </select>

          {/* Month selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Tutti i 13 Mesi (392 gg)</option>
            {monthOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Operator selector */}
          <select
            value={selectedOperator}
            onChange={(e) => setSelectedOperator(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">
              {selectedAmbito === 'ALL' ? 'Tutti i Reperibili' : `Tutti in ${selectedAmbito}`}
            </option>
            {operators
              .filter((op) => selectedAmbito === 'ALL' || (op.ambito || 'SOR') === selectedAmbito)
              .map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name} ({op.ambito || 'SOR'})
                </option>
              ))}
          </select>

          {/* Quick type filters */}
          <button
            onClick={() => setFilterType(filterType === 'weekend' ? 'all' : 'weekend')}
            className={`px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              filterType === 'weekend'
                ? 'bg-yellow-200 border-yellow-400 text-yellow-950 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Sab / Dom
          </button>

          <button
            onClick={() => setFilterType(filterType === 'holidays' ? 'all' : 'holidays')}
            className={`px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              filterType === 'holidays'
                ? 'bg-sky-200 border-sky-400 text-sky-950 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Solo Festivi (Celeste)
          </button>

          <button
            onClick={() => setFilterType(filterType === 'handovers' ? 'all' : 'handovers')}
            className={`px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              filterType === 'handovers'
                ? 'bg-blue-200 border-blue-400 text-blue-950 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Cambi Turno (09:00)
          </button>

          {(searchTerm || selectedMonth !== 'all' || selectedOperator !== 'all' || filterType !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedMonth('all');
                setSelectedOperator('all');
                setFilterType('all');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1"
            >
              Azzera
            </button>
          )}
        </div>
      </div>

      {/* Excel Styled Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 shadow-xs">
              <tr className="bg-slate-900 text-white font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3.5 w-28 text-center border-r border-slate-800">Data</th>
                <th className="py-3 px-3.5 w-28 border-r border-slate-800">Giorno</th>
                <th className="py-3 px-3.5 w-44 border-r border-slate-800">Tipologia Giorno</th>
                <th className="py-3 px-3.5 min-w-56 border-r border-slate-800">
                  Cambi Turno Ore 09:00 Feriale
                </th>
                <th className="py-3 px-3 text-center w-20 border-r border-slate-800">Turno</th>
                <th className="py-3 px-3 text-center w-20 border-r border-slate-800">Durata</th>
                <th className="py-3 px-3.5 min-w-44 border-r border-slate-800">
                  Reperibile in Servizio
                </th>
                <th className="py-3 px-3.5 w-36 border-r border-slate-800">Recapito H24</th>
                <th className="py-3 px-3.5 min-w-40 border-r border-slate-800">Sostituto</th>
                <th className="py-3 px-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Nessun giorno corrisponde ai filtri selezionati.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  // Determine background color based on user variation:
                  // - Giorni feriali in verde chiaro
                  // - Sabato in giallo
                  // - Domeniche in rosso chiaro
                  // - Festività in celeste
                  let rowClasses = 'bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-950 font-medium';
                  let dayTypeLabel = 'Feriale';
                  let dayTypeClasses = 'text-emerald-900 font-semibold';

                  if (row.isHoliday) {
                    // Festività in celeste
                    rowClasses = 'bg-sky-100/90 hover:bg-sky-200/80 text-sky-950 font-medium';
                    dayTypeLabel = row.holidayName ? `Festivo · ${row.holidayName}` : 'Festività';
                    dayTypeClasses = 'text-sky-900 font-bold';
                  } else if (row.isSunday) {
                    // Domeniche in rosso chiaro
                    rowClasses = 'bg-rose-100/85 hover:bg-rose-200/80 text-rose-950 font-medium';
                    dayTypeLabel = 'Domenica';
                    dayTypeClasses = 'text-rose-900 font-bold';
                  } else if (row.isSaturday) {
                    // Sabato in giallo
                    rowClasses = 'bg-yellow-100/90 hover:bg-yellow-200/80 text-yellow-950 font-medium';
                    dayTypeLabel = 'Sabato';
                    dayTypeClasses = 'text-yellow-900 font-bold';
                  }

                  return (
                    <tr
                      key={row.dateStr}
                      className={`transition-colors border-b border-slate-200/70 ${rowClasses}`}
                    >
                      {/* Data */}
                      <td className="py-2.5 px-3.5 text-center font-mono font-bold border-r border-slate-200/60 tabular-nums">
                        {row.formattedDate}
                      </td>

                      {/* Giorno della settimana */}
                      <td className="py-2.5 px-3.5 font-bold border-r border-slate-200/60">
                        <span>{row.dayOfWeekName}</span>
                      </td>

                      {/* Tipologia Giorno */}
                      <td className={`py-2.5 px-3.5 border-r border-slate-200/60 ${dayTypeClasses}`}>
                        {dayTypeLabel}
                      </td>

                      {/* Cambio Turno alle ore 09:00 */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200/60">
                        {row.isHandoverDay ? (
                          <div className="flex items-center gap-1.5 bg-blue-600 text-white font-bold px-2.5 py-1 rounded-md text-[11px] shadow-2xs w-fit">
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                            <span>{row.handoverText}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Continuazione turno</span>
                        )}
                      </td>

                      {/* N. Turno */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold border-r border-slate-200/60">
                        {row.activeShift ? `#${row.activeShift.shiftNumber}` : '—'}
                      </td>

                      {/* Durata Turno */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-200/60">
                        {row.activeShift ? (
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 font-semibold">
                            {row.activeShift.durationDays} gg
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Reperibile Titolare */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200/60">
                        {(() => {
                          const displayOp =
                            selectedAmbito !== 'ALL' && row.ambitoOperators?.[selectedAmbito]
                              ? row.ambitoOperators[selectedAmbito]
                              : row.activeOperator;

                          if (!displayOp) {
                            return <span className="opacity-50 italic">Non assegnato</span>;
                          }

                          return (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[10px] shrink-0"
                                style={{ backgroundColor: displayOp.color }}
                              >
                                {displayOp.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold truncate">{displayOp.name}</p>
                                  <span className="text-[9px] font-mono px-1 py-0.2 bg-black/5 rounded">
                                    {displayOp.ambito || 'SOR'}
                                  </span>
                                </div>
                                <p className="text-[10px] opacity-75 truncate">
                                  {displayOp.role}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Telefono */}
                      <td className="py-2.5 px-3.5 font-mono text-[11px] border-r border-slate-200/60">
                        {row.activeOperator?.phone || '—'}
                      </td>

                      {/* Sostituto */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200/60">
                        {row.backupOperator ? (
                          <div>
                            <p className="font-medium text-[11px]">{row.backupOperator.name}</p>
                            <p className="text-[10px] opacity-70 font-mono">
                              {row.backupOperator.phone}
                            </p>
                          </div>
                        ) : (
                          <span className="opacity-40">—</span>
                        )}
                      </td>

                      {/* Azioni */}
                      <td className="py-2.5 px-3 text-right">
                        {row.activeShift && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onOpenSwap(row.activeShift!)}
                              className="p-1 text-slate-600 hover:text-blue-600 hover:bg-white rounded transition-colors"
                              title="Scambia questo turno"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onSelectShift(row.activeShift!)}
                              className="px-2 py-0.5 text-[11px] font-semibold text-slate-700 bg-white/80 hover:bg-white rounded border border-slate-300 transition-colors"
                            >
                              Dettagli
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Visualizzati <strong className="font-mono text-slate-800">{filteredRows.length}</strong> giorni su 392 giorni totali
          </span>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Tutti i cambi turno feriali alle ore 09:00 · Durata turni $\le 6$ giorni</span>
          </div>
        </div>
      </div>
    </div>
  );
};
