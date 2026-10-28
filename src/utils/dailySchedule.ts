import { Operator, Shift, AmbitoType } from '../types';
import { isFeriale, getHolidayForDateStr } from './holidays';
import { formatItalianDate, formatShortDate } from './shiftLogic';

export interface DailyCalendarRow {
  dateStr: string; // 'YYYY-MM-DD'
  formattedDate: string; // 'DD/MM/YYYY'
  dayNumber: number;
  monthNumber: number; // 1-12
  yearNumber: number;
  monthLabel: string;
  dayOfWeekName: string;
  dayOfWeekShort: string;
  dayOfWeekIndex: number; // 0=Dom, 1=Lun, ..., 6=Sab
  isSaturday: boolean;
  isSunday: boolean;
  isHoliday: boolean;
  isOtherHoliday: boolean; // Holiday that is NOT Sunday and NOT Saturday (feriale festivo)
  holidayName: string | null;
  isFerialeDay: boolean; // Mon-Fri and not holiday
  isHandoverDay: boolean; // Has handover at 09:00
  handoverIncomingShift?: Shift;
  handoverOutgoingShift?: Shift;
  handoverText?: string;
  activeShift?: Shift;
  activeOperator?: Operator; // Primary (SOR)
  titularOperator?: Operator;
  isSubstitution?: boolean;
  substitutionReason?: string;
  backupOperator?: Operator;
  // Multi-ambito operators on duty today
  ambitoOperators?: Partial<Record<AmbitoType, Operator | undefined>>;
}

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const DAY_NAMES = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const DAY_SHORTS = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];

/**
 * Builds the complete day-by-day columnar calendar from 2027-01-05 to 2028-01-31 inclusive.
 */
export function buildDailyCalendar(shifts: Shift[], operators: Operator[]): DailyCalendarRow[] {
  const rows: DailyCalendarRow[] = [];
  const opMap = new Map(operators.map((o) => [o.id, o]));

  const startDate = new Date(2027, 0, 5); // 5 Jan 2027
  const endDate = new Date(2028, 0, 31);   // 31 Jan 2028

  const cur = new Date(startDate.getTime());

  while (cur <= endDate) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const d = cur.getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${y}-${pad(m + 1)}-${pad(d)}`;
    const formattedDate = `${pad(d)}/${pad(m + 1)}/${y}`;

    const dayOfWeekIndex = cur.getDay();
    const isSaturday = dayOfWeekIndex === 6;
    const isSunday = dayOfWeekIndex === 0;

    const holidayName = getHolidayForDateStr(dateStr);
    const isHoliday = holidayName !== null;
    const isOtherHoliday = isHoliday && !isSunday && !isSaturday;
    const isFerialeDay = dayOfWeekIndex >= 1 && dayOfWeekIndex <= 5 && !isHoliday;

    // Check shifts for this day:
    // Handover occurs at 09:00
    let incomingShift: Shift | undefined;
    let outgoingShift: Shift | undefined;

    // Check shift active at 12:00 noon on this day
    const noon = new Date(y, m, d, 12, 0, 0);
    let activeShift: Shift | undefined;

    for (const s of shifts) {
      const sStart = new Date(s.startDate);
      const sEnd = new Date(s.endDate);

      if (
        sStart.getFullYear() === y &&
        sStart.getMonth() === m &&
        sStart.getDate() === d
      ) {
        incomingShift = s;
      }

      if (
        sEnd.getFullYear() === y &&
        sEnd.getMonth() === m &&
        sEnd.getDate() === d
      ) {
        outgoingShift = s;
      }

      if (sStart <= noon && sEnd > noon) {
        activeShift = s;
      }
    }

    const isHandoverDay = !!incomingShift;
    let handoverText = '';
    if (incomingShift && outgoingShift) {
      const outOp = opMap.get(outgoingShift.operatorId);
      const inOp = opMap.get(incomingShift.operatorId);
      handoverText = `Ore 09:00: ${outOp?.name.split(' ')[0] || ''} ➔ ${inOp?.name || ''}`;
    } else if (incomingShift && y === 2027 && m === 0 && d === 5) {
      const inOp = opMap.get(incomingShift.operatorId);
      handoverText = `Ore 09:00: Inizio servizio con ${inOp?.name || ''}`;
    }

    const titularOp = activeShift ? opMap.get(activeShift.operatorId) : undefined;
    const dailyOverride = activeShift?.dailyOverrides?.[dateStr];
    const activeOp = dailyOverride
      ? opMap.get(dailyOverride.operatorId)
      : titularOp;
    const isSubstitution = !!dailyOverride && dailyOverride.operatorId !== activeShift?.operatorId;
    const substitutionReason = dailyOverride?.reason;

    const backupOp = activeShift?.backupOperatorId ? opMap.get(activeShift.backupOperatorId) : undefined;

    const ambitoOperators: Partial<Record<AmbitoType, Operator | undefined>> = {
      SOR: activeOp,
      CF: activeShift?.assignments?.CF ? opMap.get(activeShift.assignments.CF.operatorId) : undefined,
      VAL: activeShift?.assignments?.VAL ? opMap.get(activeShift.assignments.VAL.operatorId) : undefined,
      CT: activeShift?.assignments?.CT ? opMap.get(activeShift.assignments.CT.operatorId) : undefined,
      LV: activeShift?.assignments?.LV ? opMap.get(activeShift.assignments.LV.operatorId) : undefined,
    };

    rows.push({
      dateStr,
      formattedDate,
      dayNumber: d,
      monthNumber: m + 1,
      yearNumber: y,
      monthLabel: `${MONTH_NAMES[m]} ${y}`,
      dayOfWeekName: DAY_NAMES[dayOfWeekIndex],
      dayOfWeekShort: DAY_SHORTS[dayOfWeekIndex],
      dayOfWeekIndex,
      isSaturday,
      isSunday,
      isHoliday,
      isOtherHoliday,
      holidayName,
      isFerialeDay,
      isHandoverDay,
      handoverIncomingShift: incomingShift,
      handoverOutgoingShift: outgoingShift,
      handoverText,
      activeShift,
      activeOperator: activeOp,
      titularOperator: titularOp,
      isSubstitution,
      substitutionReason,
      backupOperator: backupOp,
      ambitoOperators,
    });

    cur.setDate(cur.getDate() + 1);
  }

  return rows;
}

/**
 * Generates an Excel-compatible HTML spreadsheet (.xls)
 * with the exact required color highlighting:
 * - Giorni feriali in VERDE CHIARO (#DCFCE7)
 * - Sabato in GIALLO (#FEF08A)
 * - Domeniche in ROSSO CHIARO (#FEE2E2)
 * - Festività in CELESTE (#BAE6FD)
 */
export function generateExcelHtmlWithColors(rows: DailyCalendarRow[]): string {
  const tableRows = rows.map((row) => {
    let rowBgColor = '#DCFCE7'; // Verde chiaro per giorni feriali
    let textColor = '#14532D';
    let dayType = 'Feriale';

    if (row.isHoliday) {
      rowBgColor = '#BAE6FD';
      textColor = '#0C4A6E';
      dayType = row.holidayName ? `Festivo (${row.holidayName})` : 'Festivo';
    } else if (row.isSunday) {
      rowBgColor = '#FEE2E2';
      textColor = '#991B1B';
      dayType = 'Domenica';
    } else if (row.isSaturday) {
      rowBgColor = '#FEF08A';
      textColor = '#713F12';
      dayType = 'Sabato';
    }

    let opDisplay = row.activeOperator?.name || '—';
    if (row.isSubstitution) {
      opDisplay = `<span style="color:#B45309; font-weight:bold;">${row.activeOperator?.name}</span> <span style="font-size:9pt; color:#64748B;">[Sostituz. per ${row.titularOperator?.name.split(' ')[0]}: ${row.substitutionReason || 'Malattia'}]</span>`;
    }

    const cfName = row.ambitoOperators?.CF?.name || '—';
    const valName = row.ambitoOperators?.VAL?.name || '—';
    const ctName = row.ambitoOperators?.CT?.name || '—';
    const lvName = row.ambitoOperators?.LV?.name || '—';

    const handoverCol = row.isHandoverDay
      ? `<span style="font-weight:bold; color:#15803D;">ORE 09:00: CAMBIO TURNO (${row.handoverText || ''})</span>`
      : 'Continuazione';

    return `
      <tr style="background-color: ${rowBgColor}; color: ${textColor};">
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px; font-weight: bold; text-align: center;">${row.formattedDate}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px; font-weight: bold;">${row.dayOfWeekName}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px;">${dayType}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px;">${handoverCol}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px; font-weight: bold;">${opDisplay}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px;">${cfName}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px;">${valName}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px;">${ctName}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px;">${lvName}</td>
      </tr>
    `;
  }).join('');

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; }
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #0F172A; color: #FFFFFF; font-weight: bold; border: 1px solid #475569; padding: 8px 10px; text-align: left; }
        td { border: 1px solid #CBD5E1; padding: 6px 10px; vertical-align: middle; }
      </style>
    </head>
    <body>
      <h2>CALENDARIO TURNAZIONI REPERIBILITÀ (5 GENNAIO 2027 - 31 GENNAIO 2028)</h2>
      <p>
        <strong>Regole di turnazione applicate:</strong><br/>
        1. Cambio turno sempre in giornata feriale alle ore 09:00.<br/>
        2. Tetto massimo di 6 giornate mensili per ciascun reperibile.<br/>
        3. Copertura per tutti i 5 Ambiti: SOR, CF, VAL, CT, LV.<br/>
        4. Feriali in verde chiaro, Sabato in giallo, Domeniche in rosso chiaro, Festività in celeste.
      </p>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Giorno</th>
            <th>Tipologia</th>
            <th>Cambio Turno (ore 09:00)</th>
            <th>SOR (Sala Operativa)</th>
            <th>CF (Centro Funzionale)</th>
            <th>VAL (Valutazioni Tecniche)</th>
            <th>CT (Controllo Territoriale)</th>
            <th>LV (Logistica e Volontariato)</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </body>
    </html>
  `;
}
