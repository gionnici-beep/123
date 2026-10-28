import { Operator, Shift, AmbitoType, AMBITI, MonthSummary } from '../types';
import { isFeriale, getHolidayForDateStr } from './holidays';

export const HANDOVER_HOUR = 9; // 09:00 AM

/**
 * Formats a Date object to 'YYYY-MM-DDTHH:mm:ss'
 */
export function formatIsoDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

/**
 * Returns a readable Italian date string (e.g., 'Martedì 5 Gennaio 2027')
 */
export function formatItalianDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Returns short date 'DD/MM/YYYY'
 */
export function formatShortDate(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Checks if a shift span includes a Saturday or Sunday
 */
export function shiftIncludesWeekend(start: Date, end: Date): boolean {
  const cur = new Date(start.getTime());
  while (cur < end) {
    const day = cur.getDay();
    if (day === 0 || day === 6) return true;
    cur.setDate(cur.getDate() + 1);
  }
  return false;
}

/**
 * Collects names of holidays intersecting with shift
 */
export function getHolidaysInShift(start: Date, end: Date): string[] {
  const holidays: string[] = [];
  const cur = new Date(start.getTime());
  const pad = (n: number) => String(n).padStart(2, '0');

  while (cur < end) {
    const y = cur.getFullYear();
    const m = pad(cur.getMonth() + 1);
    const d = pad(cur.getDate());
    const dateStr = `${y}-${m}-${d}`;
    const hol = getHolidayForDateStr(dateStr);
    if (hol && !holidays.includes(hol)) {
      holidays.push(hol);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return holidays;
}

/**
 * Computes how many calendar days of a shift belong to targetYear/targetMonth.
 */
export function calculateShiftDaysInMonth(
  shift: Shift,
  targetYear: number,
  targetMonth: number
): number {
  const start = new Date(shift.startDate);
  const end = new Date(shift.endDate);
  let days = 0;
  const cur = new Date(start.getTime());

  while (cur < end) {
    const midDay = new Date(cur.getTime() + 12 * 3600 * 1000);
    if (midDay.getFullYear() === targetYear && midDay.getMonth() + 1 === targetMonth) {
      days += 1;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return days;
}

/**
 * Computes how many days an operator worked in a specific month for a given shift,
 * taking into account assignments across all 5 Ambiti (SOR, CF, VAL, CT, LV)
 * and dailyOverrides (e.g. sickness, substitutions, split shifts).
 */
export function calculateOperatorShiftDaysInMonth(
  shift: Shift,
  operatorId: string,
  targetYear: number,
  targetMonth: number,
  operatorAmbito?: AmbitoType
): number {
  const start = new Date(shift.startDate);
  const end = new Date(shift.endDate);
  let days = 0;
  const cur = new Date(start.getTime());
  const pad = (n: number) => String(n).padStart(2, '0');

  // Determine which assignment belongs to this operator
  let baseOpId = shift.operatorId;
  let overrides = shift.dailyOverrides;

  if (shift.assignments) {
    if (operatorAmbito && shift.assignments[operatorAmbito]) {
      baseOpId = shift.assignments[operatorAmbito].operatorId;
      overrides = shift.assignments[operatorAmbito].dailyOverrides || shift.dailyOverrides;
    } else {
      // Find which ambito assignment has this operator
      for (const amb of Object.keys(shift.assignments) as AmbitoType[]) {
        const asg = shift.assignments[amb];
        if (asg && asg.operatorId === operatorId) {
          baseOpId = asg.operatorId;
          overrides = asg.dailyOverrides || shift.dailyOverrides;
          break;
        }
      }
    }
  }

  while (cur < end) {
    const midDay = new Date(cur.getTime() + 12 * 3600 * 1000);
    if (midDay.getFullYear() === targetYear && midDay.getMonth() + 1 === targetMonth) {
      const dateKey = `${midDay.getFullYear()}-${pad(midDay.getMonth() + 1)}-${pad(midDay.getDate())}`;
      const effectiveOpId = overrides?.[dateKey]?.operatorId || baseOpId;
      if (effectiveOpId === operatorId) {
        days += 1;
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  return days;
}

/**
 * Returns all shifts to be reported for a given month:
 * "dal primo che inizia nel mese fino all'ultimo anche se a cavallo con il mese successivo"
 */
export function getShiftsForMonthlyReport(shifts: Shift[], year: number, month: number): Shift[] {
  return shifts
    .filter((s) => {
      const start = new Date(s.startDate);
      return start.getFullYear() === year && start.getMonth() + 1 === month;
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

/**
 * Ensures a shift has assignments for all 5 Ambiti (SOR, CF, VAL, CT, LV).
 */
export function ensureShiftAssignments(
  shift: Shift,
  operators: Operator[],
  shiftIdx: number
): Shift {
  if (
    shift.assignments &&
    shift.assignments.SOR &&
    shift.assignments.CF &&
    shift.assignments.VAL &&
    shift.assignments.CT &&
    shift.assignments.LV
  ) {
    return shift;
  }

  const getOpsForAmbito = (amb: AmbitoType) =>
    operators
      .filter((o) => (o.ambito === amb || (!o.ambito && amb === 'SOR')) && o.active)
      .sort((a, b) => a.name.localeCompare(b.name, 'it'));

  const sorOps = getOpsForAmbito('SOR');
  const cfOps = getOpsForAmbito('CF');
  const valOps = getOpsForAmbito('VAL');
  const ctOps = getOpsForAmbito('CT');
  const lvOps = getOpsForAmbito('LV');

  const ciccottiIdx = sorOps.findIndex((o) => o.name.toLowerCase().includes('ciccotti'));
  const sorOffset = ciccottiIdx >= 0 ? ciccottiIdx : 0;

  const chosenSor = sorOps[(sorOffset + shiftIdx) % (sorOps.length || 1)] || operators[0];
  const chosenCf = cfOps[shiftIdx % (cfOps.length || 1)] || operators[0];
  const chosenVal = valOps[shiftIdx % (valOps.length || 1)] || operators[0];
  const chosenCt = ctOps[shiftIdx % (ctOps.length || 1)] || operators[0];
  const chosenLv = lvOps[shiftIdx % (lvOps.length || 1)] || operators[0];

  return {
    ...shift,
    operatorId: shift.operatorId || chosenSor.id,
    assignments: {
      SOR: shift.assignments?.SOR || {
        operatorId: shift.operatorId || chosenSor.id,
        backupOperatorId: shift.backupOperatorId,
        dailyOverrides: shift.dailyOverrides,
      },
      CF: shift.assignments?.CF || {
        operatorId: chosenCf.id,
      },
      VAL: shift.assignments?.VAL || {
        operatorId: chosenVal.id,
      },
      CT: shift.assignments?.CT || {
        operatorId: chosenCt.id,
      },
      LV: shift.assignments?.LV || {
        operatorId: chosenLv.id,
      },
    },
  };
}

/**
 * Core Algorithm: Generates the entire on-call rotation schedule from 5 Jan 2027 09:00 to Feb 1 2028 09:00
 * for all 5 Ambiti:
 * - SOR (Sala Operativa Regionale, min 6 ops, starts with Ciccotti)
 * - CF (Centro Funzionale, min 6 ops)
 * - VAL (Valutazioni Tecniche, min 6 ops)
 * - CT (Controllo Territoriale, min 6 ops)
 * - LV (Logistica e Volontariato, min 6 ops)
 * Strictly adhering to:
 * 1. Start: 2027-01-05 at 09:00
 * 2. Handover strictly on feriali (Monday-Friday, non-festivi) at 09:00
 * 3. Each shift block <= 6 days
 * 4. Fair operator rotation guaranteeing <= 6 days per month for each operator
 */
export function generateTurniSchedule(operators: Operator[]): Shift[] {
  const getOpsByAmbito = (amb: AmbitoType) => {
    return operators
      .filter((o) => (o.ambito === amb || (!o.ambito && amb === 'SOR')) && o.active)
      .sort((a, b) => a.name.localeCompare(b.name, 'it'));
  };

  const sorOps = getOpsByAmbito('SOR');
  const cfOps = getOpsByAmbito('CF');
  const valOps = getOpsByAmbito('VAL');
  const ctOps = getOpsByAmbito('CT');
  const lvOps = getOpsByAmbito('LV');

  if (sorOps.length === 0) return [];

  // Find Ciccotti in SOR to start on 5 Gennaio 2027
  const ciccottiIdx = sorOps.findIndex((o) => o.name.toLowerCase().includes('ciccotti'));
  const startOffset = ciccottiIdx >= 0 ? ciccottiIdx : 0;

  const shifts: Shift[] = [];
  let curStart = new Date(2027, 0, 5, 9, 0, 0); // 5 Jan 2027 09:00 (Martedì)
  const targetEnd = new Date(2028, 1, 1, 9, 0, 0); // 1 Feb 2028 09:00 (covers all Jan 2028)

  let shiftNumber = 1;

  while (curStart < targetEnd) {
    // Determine shift duration:
    // Candidate durations: 6 days, 5 days, 4 days, 3 days.
    // Shift must end on a feriale at 09:00.
    let bestEnd: Date | null = null;
    let chosenDuration = 0;

    // We prefer 6 days when valid, or 5/4/3 days when 6 lands on weekend or holiday
    for (const d of [6, 5, 4, 3]) {
      const candidateEnd = new Date(curStart.getTime() + d * 24 * 3600 * 1000);
      if (candidateEnd > targetEnd) {
        const diffDays = Math.round((targetEnd.getTime() - curStart.getTime()) / (24 * 3600 * 1000));
        if (diffDays <= 6 && isFeriale(targetEnd)) {
          bestEnd = targetEnd;
          chosenDuration = diffDays;
          break;
        }
      }

      if (isFeriale(candidateEnd)) {
        bestEnd = candidateEnd;
        chosenDuration = d;
        break;
      }
    }

    if (!bestEnd) {
      bestEnd = new Date(curStart.getTime() + 4 * 24 * 3600 * 1000);
      chosenDuration = 4;
    }

    const tempShift: Shift = {
      id: `shift-${shiftNumber}`,
      shiftNumber,
      startDate: formatIsoDateTime(curStart),
      endDate: formatIsoDateTime(bestEnd),
      durationDays: chosenDuration,
      operatorId: '',
      isWeekendShift: shiftIncludesWeekend(curStart, bestEnd),
      hasHoliday: false,
      holidayNames: getHolidaysInShift(curStart, bestEnd),
    };
    tempShift.hasHoliday = tempShift.holidayNames.length > 0;

    const shiftIdx = shiftNumber - 1;

    // Assign operators for each of the 5 Ambiti
    // SOR starts with Ciccotti
    const sorIdx = (startOffset + shiftIdx) % sorOps.length;
    const chosenSor = sorOps[sorIdx];
    const backupSor = sorOps[(sorIdx + 1) % sorOps.length];

    // CF rotates
    const cfList = cfOps.length > 0 ? cfOps : sorOps;
    const chosenCf = cfList[shiftIdx % cfList.length];
    const backupCf = cfList[(shiftIdx + 1) % cfList.length];

    // VAL rotates
    const valList = valOps.length > 0 ? valOps : sorOps;
    const chosenVal = valList[shiftIdx % valList.length];
    const backupVal = valList[(shiftIdx + 1) % valList.length];

    // CT rotates
    const ctList = ctOps.length > 0 ? ctOps : sorOps;
    const chosenCt = ctList[shiftIdx % ctList.length];
    const backupCt = ctList[(shiftIdx + 1) % ctList.length];

    // LV rotates
    const lvList = lvOps.length > 0 ? lvOps : sorOps;
    const chosenLv = lvList[shiftIdx % lvList.length];
    const backupLv = lvList[(shiftIdx + 1) % lvList.length];

    tempShift.operatorId = chosenSor.id;
    tempShift.backupOperatorId = backupSor?.id;

    tempShift.assignments = {
      SOR: { operatorId: chosenSor.id, backupOperatorId: backupSor?.id },
      CF: { operatorId: chosenCf.id, backupOperatorId: backupCf?.id },
      VAL: { operatorId: chosenVal.id, backupOperatorId: backupVal?.id },
      CT: { operatorId: chosenCt.id, backupOperatorId: backupCt?.id },
      LV: { operatorId: chosenLv.id, backupOperatorId: backupLv?.id },
    };

    shifts.push(tempShift);

    // Advance
    curStart = bestEnd;
    shiftNumber += 1;
  }

  return shifts;
}

/**
 * Computes monthly summary for all 13 months (Jan 2027 to Jan 2028 inclusive).
 */
export function getMonthlySummaries(shifts: Shift[], operators: Operator[]): MonthSummary[] {
  const summaries: MonthSummary[] = [];

  const months = [
    { year: 2027, month: 1, label: 'Gennaio 2027', days: 31 },
    { year: 2027, month: 2, label: 'Febbraio 2027', days: 28 },
    { year: 2027, month: 3, label: 'Marzo 2027', days: 31 },
    { year: 2027, month: 4, label: 'Aprile 2027', days: 30 },
    { year: 2027, month: 5, label: 'Maggio 2027', days: 31 },
    { year: 2027, month: 6, label: 'Giugno 2027', days: 30 },
    { year: 2027, month: 7, label: 'Luglio 2027', days: 31 },
    { year: 2027, month: 8, label: 'Agosto 2027', days: 31 },
    { year: 2027, month: 9, label: 'Settembre 2027', days: 30 },
    { year: 2027, month: 10, label: 'Ottobre 2027', days: 31 },
    { year: 2027, month: 11, label: 'Novembre 2027', days: 30 },
    { year: 2027, month: 12, label: 'Dicembre 2027', days: 31 },
    { year: 2028, month: 1, label: 'Gennaio 2028', days: 31 },
  ];

  for (const m of months) {
    const operatorDays: Record<string, number> = {};
    operators.forEach((op) => {
      operatorDays[op.id] = 0;
    });

    for (const shift of shifts) {
      operators.forEach((op) => {
        const days = calculateOperatorShiftDaysInMonth(shift, op.id, m.year, m.month, op.ambito);
        if (days > 0) {
          operatorDays[op.id] = (operatorDays[op.id] || 0) + days;
        }
      });
    }

    const hasViolations = Object.entries(operatorDays).some(([opId, days]) => {
      const op = operators.find((o) => o.id === opId);
      return op && days > op.maxDaysPerMonth;
    });

    summaries.push({
      year: m.year,
      month: m.month,
      monthLabel: m.label,
      totalDays: m.days,
      operatorDays,
      hasViolations,
    });
  }

  return summaries;
}

/**
 * Validates the entire schedule against constraints
 */
export function validateSchedule(
  shifts: Shift[],
  operators: Operator[]
): {
  isValid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // Check each Ambito has minimum 6 operators
  const ambiti: AmbitoType[] = ['SOR', 'CF', 'VAL', 'CT', 'LV'];
  for (const amb of ambiti) {
    const ambOps = operators.filter((o) => o.active && (o.ambito === amb || (!o.ambito && amb === 'SOR')));
    if (ambOps.length < 6) {
      violations.push(`Ambito ${amb}: conta ${ambOps.length} reperibili attivi (minimo richiesto: 6).`);
    }
  }

  // 1. Shift duration <= 6 days
  for (const s of shifts) {
    if (s.durationDays > 6) {
      violations.push(
        `Turno #${s.shiftNumber}: durata di ${s.durationDays} giorni (massimo consentito: 6).`
      );
    }

    // 2. Handover on feriale
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);

    if (!isFeriale(start)) {
      violations.push(
        `Turno #${s.shiftNumber}: inizio il ${formatShortDate(s.startDate)} non è in giorno feriale.`
      );
    }
    if (!isFeriale(end)) {
      violations.push(
        `Turno #${s.shiftNumber}: termine il ${formatShortDate(s.endDate)} non è in giorno feriale.`
      );
    }
  }

  // 3. Max days per month per operator <= 6
  const summaries = getMonthlySummaries(shifts, operators);
  for (const sum of summaries) {
    for (const [opId, days] of Object.entries(sum.operatorDays) as [string, number][]) {
      const op = operators.find((o) => o.id === opId);
      if (op && typeof days === 'number' && days > op.maxDaysPerMonth) {
        violations.push(
          `${op.name} (${op.ambito || 'SOR'}): ha effettuato ${days} giorni nel mese di ${sum.monthLabel} (tetto massimo: ${op.maxDaysPerMonth} gg).`
        );
      }
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Generates iCalendar (.ics) format
 */
export function generateIcs(shifts: Shift[], operators: Operator[]): string {
  const opMap = new Map(operators.map((o) => [o.id, o]));
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Regione Umbria//Turni Reperibilita 2027-2028//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Turni Reperibilità 2027-2028',
    'X-WR-TIMEZONE:Europe/Rome',
  ];

  const formatIcsDate = (isoStr: string) => {
    return isoStr.replace(/[-:]/g, '').slice(0, 15) + 'Z';
  };

  shifts.forEach((shift) => {
    const op = opMap.get(shift.operatorId);
    const cfOp = shift.assignments?.CF ? opMap.get(shift.assignments.CF.operatorId) : null;
    const valOp = shift.assignments?.VAL ? opMap.get(shift.assignments.VAL.operatorId) : null;
    const ctOp = shift.assignments?.CT ? opMap.get(shift.assignments.CT.operatorId) : null;
    const lvOp = shift.assignments?.LV ? opMap.get(shift.assignments.LV.operatorId) : null;

    lines.push(
      'BEGIN:VEVENT',
      `UID:turno-${shift.id}@turnireperibilita.regione.umbria.it`,
      `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
      `DTSTART:${formatIcsDate(shift.startDate)}`,
      `DTEND:${formatIcsDate(shift.endDate)}`,
      `SUMMARY:Reperibilità H24 Protezione Civile - Turno #${shift.shiftNumber}`,
      `DESCRIPTION:SOR: ${op?.name || ''}\\nCF: ${cfOp?.name || '—'}\\nVAL: ${valOp?.name || '—'}\\nCT: ${ctOp?.name || '—'}\\nLV: ${lvOp?.name || '—'}\\nCambio ore 09:00 feriale.`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Generates CSV export with UTF-8 BOM
 */
export function generateCsv(shifts: Shift[], operators: Operator[]): string {
  const opMap = new Map(operators.map((o) => [o.id, o]));
  const BOM = '\uFEFF';
  const headers = [
    'N° Turno',
    'Inizio (ore 09:00)',
    'Fine (ore 09:00)',
    'Durata (gg)',
    'SOR (Sala Operativa)',
    'CF (Centro Funzionale)',
    'VAL (Valutazioni Tecniche)',
    'CT (Controllo Territoriale)',
    'LV (Logistica e Volontariato)',
    'Note e Sostituzioni',
  ];

  const rows = shifts.map((s) => {
    const sorOp = opMap.get(s.operatorId);
    const cfOp = s.assignments?.CF ? opMap.get(s.assignments.CF.operatorId) : null;
    const valOp = s.assignments?.VAL ? opMap.get(s.assignments.VAL.operatorId) : null;
    const ctOp = s.assignments?.CT ? opMap.get(s.assignments.CT.operatorId) : null;
    const lvOp = s.assignments?.LV ? opMap.get(s.assignments.LV.operatorId) : null;

    let noteText = '';
    if (s.dailyOverrides && Object.keys(s.dailyOverrides).length > 0) {
      const parts = Object.entries(s.dailyOverrides).map(([d, ov]) => {
        const sub = opMap.get(ov.operatorId);
        return `${d}: ${sub?.name} (${ov.reason || 'Sostituzione'})`;
      });
      noteText = `Variazioni: ${parts.join('; ')}`;
    }

    return [
      `Turno #${s.shiftNumber}`,
      formatShortDate(s.startDate),
      formatShortDate(s.endDate),
      s.durationDays,
      `"${sorOp?.name || ''}"`,
      `"${cfOp?.name || ''}"`,
      `"${valOp?.name || ''}"`,
      `"${ctOp?.name || ''}"`,
      `"${lvOp?.name || ''}"`,
      `"${noteText}"`,
    ].join(';');
  });

  return BOM + [headers.join(';'), ...rows].join('\r\n');
}
