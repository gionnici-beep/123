import React, { useState, useMemo } from 'react';
import { Search, Filter, ArrowRightLeft, Eye, ShieldCheck, Calendar, Phone, Sparkles } from 'lucide-react';
import { Operator, Shift } from '../types';
import { formatItalianDate, formatShortDate } from '../utils/shiftLogic';

interface ShiftsTableViewProps {
  shifts: Shift[];
  operators: Operator[];
  onSelectShift: (shift: Shift) => void;
  onOpenSwap: (shift: Shift) => void;
}

export const ShiftsTableView: React.FC<ShiftsTableViewProps> = ({
  shifts,
  operators,
  onSelectShift,
  onOpenSwap,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [filterWeekendOnly, setFilterWeekendOnly] = useState(false);
  const [filterHolidayOnly, setFilterHolidayOnly] = useState(false);

  const opMap = useMemo(() => new Map(operators.map((o) => [o.id, o])), [operators]);

  // Unique months present in shifts
  const months = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    const seen = new Set<string>();

    shifts.forEach((s) => {
      const d = new Date(s.startDate);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!seen.has(key)) {
        seen.add(key);
        const monthNames = [
          'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
          'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
        ];
        list.push({
          key,
          label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        });
      }
    });

    return list;
  }, [shifts]);

  // Filtered shifts
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      const op = opMap.get(s.operatorId);
      const backup = s.backupOperatorId ? opMap.get(s.backupOperatorId) : null;

      // Operator filter
      if (selectedOperatorId !== 'all' && s.operatorId !== selectedOperatorId) {
        return false;
      }

      // Month filter
      if (selectedMonth !== 'all') {
        const d = new Date(s.startDate);
        const shiftMonthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (shiftMonthKey !== selectedMonth) {
          return false;
        }
      }

      // Weekend filter
      if (filterWeekendOnly && !s.isWeekendShift) {
        return false;
      }

      // Holiday filter
      if (filterHolidayOnly && !s.hasHoliday) {
        return false;
      }

      // Search term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchesOp = op?.name.toLowerCase().includes(term);
        const matchesBackup = backup?.name.toLowerCase().includes(term);
        const matchesDate = s.startDate.includes(term) || s.endDate.includes(term);
        const matchesHolidays = s.holidayNames.some((h) => h.toLowerCase().includes(term));
        const matchesShiftNum = `turno #${s.shiftNumber}`.includes(term) || String(s.shiftNumber).includes(term);

        if (!matchesOp && !matchesBackup && !matchesDate && !matchesHolidays && !matchesShiftNum) {
          return false;
        }
      }

      return true;
    });
  }, [shifts, opMap, selectedOperatorId, selectedMonth, filterWeekendOnly, filterHolidayOnly, searchTerm]);

  return (
    <div className="space-y-4">
      {/* Search and Filters Strip */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca per nome operatore, festività, data o n° turno..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
          />
        </div>

        {/* Filter selectors */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Operator filter */}
          <select
            value={selectedOperatorId}
            onChange={(e) => setSelectedOperatorId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tutti i Reperibili ({operators.length})</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>
                {op.name}
              </option>
            ))}
          </select>

          {/* Month filter */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tutti i 13 Mesi</option>
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Quick toggle chips */}
          <button
            onClick={() => setFilterWeekendOnly(!filterWeekendOnly)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              filterWeekendOnly
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Solo Weekend
          </button>

          <button
            onClick={() => setFilterHolidayOnly(!filterHolidayOnly)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              filterHolidayOnly
                ? 'bg-rose-100 text-rose-900 border-rose-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Solo Festivi
          </button>

          {(searchTerm || selectedOperatorId !== 'all' || selectedMonth !== 'all' || filterWeekendOnly || filterHolidayOnly) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedOperatorId('all');
                setSelectedMonth('all');
                setFilterWeekendOnly(false);
                setFilterHolidayOnly(false);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1"
            >
              Azzera filtri
            </button>
          )}
        </div>
      </div>

      {/* Table Results */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-16">Turno</th>
                <th className="py-3 px-4">Inizio Turno (feriale ore 09:00)</th>
                <th className="py-3 px-4">Fine / Cambio (feriale ore 09:00)</th>
                <th className="py-3 px-4 text-center">Durata</th>
                <th className="py-3 px-4">Reperibile Titolare</th>
                <th className="py-3 px-4">Sostituto / Backup</th>
                <th className="py-3 px-4">Caratteristiche</th>
                <th className="py-3 px-4 text-center">Conformità</th>
                <th className="py-3 px-4 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Nessun turno corrisponde ai filtri selezionati.
                  </td>
                </tr>
              ) : (
                filteredShifts.map((s) => {
                  const op = opMap.get(s.operatorId);
                  const backup = s.backupOperatorId ? opMap.get(s.backupOperatorId) : null;

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => onSelectShift(s)}
                    >
                      {/* N. Turno */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        #{String(s.shiftNumber).padStart(2, '0')}
                      </td>

                      {/* Inizio */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {formatItalianDate(s.startDate)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatShortDate(s.startDate)} · 09:00
                        </div>
                      </td>

                      {/* Fine */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {formatItalianDate(s.endDate)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatShortDate(s.endDate)} · 09:00
                        </div>
                      </td>

                      {/* Durata */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md">
                          {s.durationDays} gg
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {s.durationDays * 24} ore
                        </p>
                      </td>

                      {/* Reperibile Titolare */}
                      <td className="py-3 px-4">
                        {op ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[11px] shrink-0"
                              style={{ backgroundColor: op.color }}
                            >
                              {op.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{op.name}</p>
                              <p className="text-[10px] text-slate-500">{op.phone}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Non assegnato</span>
                        )}
                      </td>

                      {/* Sostituto */}
                      <td className="py-3 px-4">
                        {backup ? (
                          <div>
                            <p className="font-medium text-slate-700">{backup.name}</p>
                            <p className="text-[10px] text-slate-400">{backup.phone}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Caratteristiche (Weekend / Festivi) */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          {s.isWeekendShift && (
                            <span className="text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm inline-block w-fit">
                              Include Weekend (Sab/Dom)
                            </span>
                          )}
                          {s.hasHoliday && (
                            <span className="text-[10px] font-medium text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-sm inline-block w-fit">
                              Festivo: {s.holidayNames.join(', ')}
                            </span>
                          )}
                          {!s.isWeekendShift && !s.hasHoliday && (
                            <span className="text-[10px] text-slate-400">
                              Solo feriali infrasettimanali
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Conforme */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>$\le 6$ gg</span>
                        </span>
                      </td>

                      {/* Azioni */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenSwap(s);
                            }}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Scambia questo turno"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectShift(s);
                            }}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            title="Visualizza dettagli"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info strip */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Visualizzati <strong className="font-mono text-slate-700">{filteredShifts.length}</strong> su {shifts.length} turni totali
          </span>
          <span className="font-mono">
            Copertura continua 24/7 dal 05/01/2027 09:00 al 01/02/2028 09:00
          </span>
        </div>
      </div>
    </div>
  );
};
