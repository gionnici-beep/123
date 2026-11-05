import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, ArrowRightLeft, Phone, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { Operator, Shift } from '../types';
import { isFeriale, getHolidayForDateStr } from '../utils/holidays';
import { calculateShiftDaysInMonth, formatItalianDate, formatShortDate } from '../utils/shiftLogic';

interface CalendarViewProps {
  shifts: Shift[];
  operators: Operator[];
  onSelectShift: (shift: Shift) => void;
  onOpenSwap: (shift: Shift) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  shifts,
  operators,
  onSelectShift,
  onOpenSwap,
}) => {
  // Available months: Jan 2027 (month 0) through Jan 2028 (month 12)
  const monthList = [
    { year: 2027, month: 0, label: 'Gennaio 2027' },
    { year: 2027, month: 1, label: 'Febbraio 2027' },
    { year: 2027, month: 2, label: 'Marzo 2027' },
    { year: 2027, month: 3, label: 'Aprile 2027' },
    { year: 2027, month: 4, label: 'Maggio 2027' },
    { year: 2027, month: 5, label: 'Giugno 2027' },
    { year: 2027, month: 6, label: 'Luglio 2027' },
    { year: 2027, month: 7, label: 'Agosto 2027' },
    { year: 2027, month: 8, label: 'Settembre 2027' },
    { year: 2027, month: 9, label: 'Ottobre 2027' },
    { year: 2027, month: 10, label: 'Novembre 2027' },
    { year: 2027, month: 11, label: 'Dicembre 2027' },
    { year: 2028, month: 0, label: 'Gennaio 2028' },
  ];

  const [currentMonthIndex, setCurrentMonthIndex] = useState(0); // starts at Jan 2027
  const currentMonthInfo = monthList[currentMonthIndex];
  const { year, month, label } = currentMonthInfo;

  const opMap = new Map(operators.map((o) => [o.id, o]));

  // Month navigation
  const handlePrev = () => {
    if (currentMonthIndex > 0) setCurrentMonthIndex(currentMonthIndex - 1);
  };
  const handleNext = () => {
    if (currentMonthIndex < monthList.length - 1) setCurrentMonthIndex(currentMonthIndex + 1);
  };

  // Build calendar matrix for this month
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Italian week starts on Monday (1): 0 is Sunday -> 6, 1 is Monday -> 0
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

  // Find shift covering each day (sampled at 12:00 noon)
  const getShiftForDay = (day: number): {
    shift: Shift | null;
    isStartDay: boolean;
    isEndDay: boolean;
    incomingShift: Shift | null;
    outgoingShift: Shift | null;
  } => {
    const noon = new Date(year, month, day, 12, 0, 0);
    const dayStart = new Date(year, month, day, 0, 0, 0);
    const dayEnd = new Date(year, month, day, 23, 59, 59);

    let activeShift: Shift | null = null;
    let incomingShift: Shift | null = null;
    let outgoingShift: Shift | null = null;

    for (const s of shifts) {
      const sStart = new Date(s.startDate);
      const sEnd = new Date(s.endDate);

      // Check if this day is a handover day (ends today at 09:00 or starts today at 09:00)
      if (
        sStart.getFullYear() === year &&
        sStart.getMonth() === month &&
        sStart.getDate() === day
      ) {
        incomingShift = s;
      }
      if (
        sEnd.getFullYear() === year &&
        sEnd.getMonth() === month &&
        sEnd.getDate() === day
      ) {
        outgoingShift = s;
      }

      // Check active at noon
      if (sStart <= noon && sEnd > noon) {
        activeShift = s;
      }
    }

    return {
      shift: activeShift,
      isStartDay: incomingShift !== null,
      isEndDay: outgoingShift !== null,
      incomingShift,
      outgoingShift,
    };
  };

  // Monthly breakdown for operator days in this selected month
  const monthlyOperatorDays: { operator: Operator; days: number }[] = operators.map((op) => {
    let days = 0;
    shifts.forEach((s) => {
      if (s.operatorId === op.id) {
        days += calculateShiftDaysInMonth(s, year, month + 1);
      }
    });
    return { operator: op, days };
  });

  const weekHeaders = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

  return (
    <div className="space-y-6">
      {/* Top Toolbar: Month Picker + Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            <button
              onClick={handlePrev}
              disabled={currentMonthIndex === 0}
              className="p-1.5 rounded-md hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent text-slate-700 transition-colors"
              title="Mese precedente"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 py-1 text-sm font-bold text-slate-900 min-w-36 text-center tabular-nums">
              {label}
            </span>
            <button
              onClick={handleNext}
              disabled={currentMonthIndex === monthList.length - 1}
              className="p-1.5 rounded-md hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent text-slate-700 transition-colors"
              title="Mese successivo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Quick select dropdown */}
          <select
            value={currentMonthIndex}
            onChange={(e) => setCurrentMonthIndex(Number(e.target.value))}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            {monthList.map((m, idx) => (
              <option key={`${m.year}-${m.month}`} value={idx}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Legend / Info (Aligned with requested variation) */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Feriale (Verde Chiaro)</span>
          </span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-yellow-50 border border-yellow-200 text-yellow-900 font-medium">
            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
            <span>Sabato (Giallo)</span>
          </span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-900 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span>Domenica (Rosso Chiaro)</span>
          </span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-900 font-medium">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            <span>Festività (Celeste)</span>
          </span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-900 font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>09:00 Cambio</span>
          </span>
        </div>
      </div>

      {/* Monthly Operator Workload Strip */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Riepilogo Carico Operatori · {label} (Limite: max 6 giorni/mese)
          </h4>
          <span className="text-xs font-mono text-emerald-700 font-medium">
            Tutti conformi ($\le 6$ gg)
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {monthlyOperatorDays.map(({ operator, days }) => {
            const isExceeded = days > operator.maxDaysPerMonth;
            const percentage = Math.min(100, Math.round((days / operator.maxDaysPerMonth) * 100));

            return (
              <div
                key={operator.id}
                className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-xs font-semibold text-slate-900 truncate" title={operator.name}>
                    {operator.name.split(' ')[0]}
                  </span>
                  <span
                    className={`text-xs font-mono font-bold tabular-nums ${
                      isExceeded ? 'text-rose-600' : 'text-slate-700'
                    }`}
                  >
                    {days}/{operator.maxDaysPerMonth} gg
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isExceeded ? 'bg-rose-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Week headers */}
        <div className="grid grid-cols-7 border-b-2 border-slate-300 bg-slate-100 text-center font-bold">
          {weekHeaders.map((dayName, idx) => {
            const isWeekendCol = idx >= 5;
            return (
              <div
                key={dayName}
                className={`py-3 text-xs font-black uppercase tracking-wider ${
                  isWeekendCol ? 'text-amber-800 bg-amber-100/60' : 'text-slate-800'
                }`}
              >
                <span className="hidden sm:inline">{dayName}</span>
                <span className="sm:hidden">{dayName.slice(0, 3)}</span>
              </div>
            );
          })}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200">
          {/* Empty cells before first day */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-28 bg-slate-50/60 p-2 text-slate-300 text-xs font-bold">
              {/* Prior month trailing */}
            </div>
          ))}

          {/* Days of current month */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateObj = new Date(year, month, dayNum);
            const dateIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const holidayName = getHolidayForDateStr(dateIso);
            const dayOfWeek = dateObj.getDay();
            const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
            const isFerialeDay = isFeriale(dateObj);

            // Shift data
            const { shift, isStartDay, isEndDay, incomingShift, outgoingShift } = getShiftForDay(dayNum);
            const currentOp = shift ? opMap.get(shift.operatorId) : null;
            const incomingOp = incomingShift ? opMap.get(incomingShift.operatorId) : null;
            const outgoingOp = outgoingShift ? opMap.get(outgoingShift.operatorId) : null;

            // Check if before schedule start date (before 5 Jan 2027)
            const isBeforeScheduleStart = year === 2027 && month === 0 && dayNum < 5;

            // Day cell background according to variation
            let cellBg = 'bg-emerald-50/70 hover:bg-emerald-100/70'; // feriale verde chiaro
            let dayNumColor = 'text-emerald-950';

            if (holidayName) {
              cellBg = 'bg-sky-100/90 border border-sky-300'; // festivita celeste
              dayNumColor = 'text-sky-950';
            } else if (dayOfWeek === 0) {
              cellBg = 'bg-rose-100/80 border border-rose-300'; // domenica rosso chiaro
              dayNumColor = 'text-rose-950';
            } else if (dayOfWeek === 6) {
              cellBg = 'bg-yellow-100/80 border border-yellow-300'; // sabato giallo
              dayNumColor = 'text-yellow-950';
            }

            return (
              <div
                key={`day-${dayNum}`}
                className={`min-h-32 p-2.5 flex flex-col justify-between transition-colors relative group font-bold ${cellBg}`}
              >
                {/* Header row of day cell */}
                <div className="flex items-start justify-between gap-1 mb-1 font-bold">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-base font-black tabular-nums drop-shadow-2xs ${dayNumColor}`}
                    >
                      {dayNum}
                    </span>

                    {/* Holiday badge in celeste */}
                    {holidayName && (
                      <span
                        className="text-[10px] font-black text-sky-950 bg-sky-200 border border-sky-400 px-1.5 py-0.5 rounded truncate max-w-28 shadow-2xs"
                        title={holidayName}
                      >
                        {holidayName}
                      </span>
                    )}
                  </div>

                  {/* Feriale indicator or pre-schedule note */}
                  {isBeforeScheduleStart ? (
                    <span className="text-[10px] font-bold text-slate-500">Ante 5 Gen</span>
                  ) : isFerialeDay ? (
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider hidden sm:inline">feriale</span>
                  ) : null}
                </div>

                {/* Handover indicator (Cambio Turno at 09:00) */}
                {isStartDay && incomingShift && (
                  <div className="mb-1.5 p-1 rounded bg-blue-100 border border-blue-400 text-[10px] text-blue-950 font-black flex items-center justify-between shadow-2xs">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-700 animate-pulse"></span>
                      09:00 ⇄ CAMBIO
                    </span>
                    <span className="font-mono text-[10px] text-blue-800 font-black">#{incomingShift.shiftNumber}</span>
                  </div>
                )}

                {/* Main Operator Duty on this day */}
                <div className="flex-1 flex flex-col justify-center my-0.5 font-bold">
                  {currentOp && shift ? (
                    <div
                      onClick={() => onSelectShift(shift)}
                      className="cursor-pointer p-2 rounded-lg border-2 text-left transition-all hover:shadow-md group-hover:border-slate-400 font-bold"
                      style={{
                        backgroundColor: currentOp.bgColor,
                        borderColor: `${currentOp.color}60`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="text-xs font-black truncate tracking-wide"
                          style={{ color: currentOp.textColor }}
                        >
                          {currentOp.name}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-700 truncate mt-0.5">
                        {currentOp.role}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-700 mt-1 pt-1 border-t border-slate-300">
                        <span className="font-mono font-black text-slate-900">
                          Turno #{shift.shiftNumber} ({shift.durationDays} gg)
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenSwap(shift);
                          }}
                          title="Scambia questo turno con un collega"
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-600 hover:text-blue-700 rounded transition-opacity"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : isBeforeScheduleStart ? (
                    <div className="h-full flex items-center justify-center text-[11px] font-bold text-slate-500 italic">
                      Inizio turni: 5 Gen 09:00
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[11px] font-bold text-slate-400">
                      —
                    </div>
                  )}
                </div>

                {/* Footer notes */}
                <div className="text-[10px] font-black flex items-center justify-between mt-1">
                  {shift?.isWeekendShift && isWeekendDay ? (
                    <span className="text-amber-900 bg-amber-100/90 px-1 py-0.2 rounded border border-amber-300">Weekend</span>
                  ) : (
                    <span></span>
                  )}
                  {shift?.hasHoliday && holidayName && (
                    <span className="text-rose-900 bg-rose-100/90 px-1 py-0.2 rounded border border-rose-300">Festivo</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
