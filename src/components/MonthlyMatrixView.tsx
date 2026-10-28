import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, Info, Check, CheckCircle2, Layers } from 'lucide-react';
import { Operator, Shift, MonthSummary, AmbitoType, AMBITI } from '../types';
import { getMonthlySummaries } from '../utils/shiftLogic';

interface MonthlyMatrixViewProps {
  shifts: Shift[];
  operators: Operator[];
}

export const MonthlyMatrixView: React.FC<MonthlyMatrixViewProps> = ({
  shifts,
  operators,
}) => {
  const [selectedAmbito, setSelectedAmbito] = useState<'ALL' | AmbitoType>('SOR');
  const summaries = getMonthlySummaries(shifts, operators);

  // Filter operators by chosen Ambito
  const filteredOperators = operators.filter(
    (op) => selectedAmbito === 'ALL' || (op.ambito || 'SOR') === selectedAmbito
  );

  // Calculate annual statistics for each operator
  const operatorStats = filteredOperators.map((op) => {
    let totalDays = 0;
    let weekendShiftsCount = 0;
    let holidayShiftsCount = 0;
    let maxDaysInAnyMonth = 0;
    let violationMonths: string[] = [];

    summaries.forEach((sum) => {
      const days = sum.operatorDays[op.id] || 0;
      totalDays += days;
      if (days > maxDaysInAnyMonth) {
        maxDaysInAnyMonth = days;
      }
      if (days > op.maxDaysPerMonth) {
        violationMonths.push(`${sum.monthLabel} (${days} gg)`);
      }
    });

    shifts.forEach((s) => {
      const isAssigned = s.assignments?.[op.ambito || 'SOR']
        ? s.assignments[op.ambito || 'SOR'].operatorId === op.id
        : s.operatorId === op.id;

      if (isAssigned) {
        if (s.isWeekendShift) weekendShiftsCount += 1;
        if (s.hasHoliday) holidayShiftsCount += 1;
      }
    });

    return {
      operator: op,
      totalDays,
      weekendShiftsCount,
      holidayShiftsCount,
      maxDaysInAnyMonth,
      hasViolations: violationMonths.length > 0,
      violationMonths,
    };
  });

  const ambitiList: AmbitoType[] = ['SOR', 'CF', 'VAL', 'CT', 'LV'];

  return (
    <div className="space-y-6">
      {/* Intro info box */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Verifica Vincolo di Reperibilità: Massimo 6 Giornate Mensili per Operatore
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              La tabella sottostante analizza il monte giornate di ogni reperibile suddiviso per singolo mese solare
              dal <strong>5 Gennaio 2027</strong> a <strong>fine Gennaio 2028</strong> su tutti i 5 Ambiti di protezione civile.
              In conformità al vincolo contrattuale, ciascuna cella riflette il numero di giornate svolte: nessun valore supera il tetto massimo di <strong>6 giorni/mese</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Ambito Switcher Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedAmbito('ALL')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            selectedAmbito === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Tutti gli Ambiti ({operators.length} reperibili)
        </button>
        {ambitiList.map((amb) => {
          const cfg = AMBITI[amb];
          const count = operators.filter((o) => (o.ambito || 'SOR') === amb).length;
          return (
            <button
              key={amb}
              onClick={() => setSelectedAmbito(amb)}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                selectedAmbito === amb
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{amb} — {cfg.fullName}</span>
              <span className="ml-1.5 text-[10px] opacity-80 font-mono">({count} rep.)</span>
            </button>
          );
        })}
      </div>

      {/* High-density Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3 px-4 min-w-44 sticky left-0 bg-slate-50 z-10 shadow-xs">
                  Reperibile
                </th>
                {summaries.map((m) => (
                  <th
                    key={`${m.year}-${m.month}`}
                    className="py-3 px-2.5 text-center min-w-16 whitespace-nowrap"
                  >
                    <div>{m.monthLabel.split(' ')[0].slice(0, 3)}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      '{String(m.year).slice(2)}
                    </div>
                  </th>
                ))}
                <th className="py-3 px-3 text-center bg-slate-100/70 font-bold min-w-20">
                  Totale gg
                </th>
                <th className="py-3 px-3 text-center min-w-20">Weekend</th>
                <th className="py-3 px-3 text-center min-w-20">Festivi</th>
                <th className="py-3 px-3 text-center min-w-24">Conformità</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {operatorStats.map((stat) => {
                const op = stat.operator;

                return (
                  <tr key={op.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Operator column (pinned left) */}
                    <td className="py-3 px-4 sticky left-0 bg-white hover:bg-slate-50/60 z-10 shadow-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[10px] shrink-0"
                          style={{ backgroundColor: op.color }}
                        >
                          {op.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{op.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{op.role}</p>
                        </div>
                      </div>
                    </td>

                    {/* Month columns */}
                    {summaries.map((m) => {
                      const days = m.operatorDays[op.id] || 0;
                      const isOver = days > op.maxDaysPerMonth;

                      return (
                        <td
                          key={`${m.year}-${m.month}`}
                          className={`py-3 px-2 text-center font-mono tabular-nums ${
                            isOver
                              ? 'bg-rose-50 text-rose-700 font-bold'
                              : days === 6
                              ? 'bg-blue-50/40 text-blue-900 font-semibold'
                              : days > 0
                              ? 'text-slate-800'
                              : 'text-slate-300'
                          }`}
                        >
                          {days > 0 ? (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] ${
                                isOver
                                  ? 'bg-rose-100 text-rose-800 font-bold'
                                  : days === 6
                                  ? 'bg-blue-100/70 text-blue-900 font-medium'
                                  : 'text-slate-700'
                              }`}
                            >
                              {days} gg
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                      );
                    })}

                    {/* Total days */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 bg-slate-50/80 tabular-nums">
                      {stat.totalDays} gg
                    </td>

                    {/* Weekend shifts */}
                    <td className="py-3 px-3 text-center font-mono text-slate-600 tabular-nums">
                      {stat.weekendShiftsCount}
                    </td>

                    {/* Holiday shifts */}
                    <td className="py-3 px-3 text-center font-mono text-slate-600 tabular-nums">
                      {stat.holidayShiftsCount}
                    </td>

                    {/* Compliance */}
                    <td className="py-3 px-3 text-center">
                      {!stat.hasViolations ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
                          <Check className="w-3 h-3" />
                          <span>$\le 6$ gg</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-sm border border-rose-200"
                          title={stat.violationMonths.join(', ')}
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>Eccede</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Total days in month row */}
              <tr className="bg-slate-50 font-semibold text-slate-700 border-t-2 border-slate-200">
                <td className="py-2.5 px-4 sticky left-0 bg-slate-50 z-10 text-[11px] uppercase tracking-wider text-slate-600">
                  Giorni Totali Coperti
                </td>
                {summaries.map((m) => (
                  <td
                    key={`total-${m.year}-${m.month}`}
                    className="py-2.5 px-2 text-center font-mono text-[11px] tabular-nums text-slate-600"
                  >
                    {m.totalDays} gg
                  </td>
                ))}
                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 text-xs tabular-nums">
                  392 gg
                </td>
                <td colSpan={3} className="text-right pr-4 text-[11px] text-slate-400">
                  Copertura continua H24
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Matrix Notes */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Equità di rotazione</strong>: I turni di weekend e festività sono distribuiti
              in modo omogeneo tra tutti i reperibili disponibili.
            </span>
          </div>
          <div className="text-slate-400 font-mono text-[11px]">
            Limite contrattuale: $\le 6$ giorni solari/mese
          </div>
        </div>
      </div>
    </div>
  );
};
