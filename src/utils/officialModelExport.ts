import { Operator, Shift } from '../types';
import { getHolidayForDateStr } from './holidays';

export interface OfficialReportData {
  year: number;
  month: number;
  monthLabel: string;
  reportCode: string; // e.g. '2027_01 - dal 05_01_2027 al 01_02_2027'
  startDateStr: string;
  endDateStr: string;
  shifts: Shift[];
  operators: Operator[];
}

const SHORT_DAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const SHORT_MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export function formatOfficialDayLabel(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dayName = SHORT_DAYS[d.getDay()];
  const dayNum = pad(d.getDate());
  const monthName = SHORT_MONTHS[d.getMonth()];
  const year2 = String(d.getFullYear()).slice(2);
  return `${dayName}, ${dayNum} ${monthName} ${year2}`;
}

export function formatShortOfficialDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dayName = SHORT_DAYS[d.getDay()];
  const dayNum = pad(d.getDate());
  const monthName = SHORT_MONTHS[d.getMonth()];
  return `${dayName}, ${dayNum} ${monthName}`;
}

/**
 * Builds the official reporting code: e.g. '2027_01 - dal 05_01_2027 al 01_02_2027'
 */
export function getOfficialReportCode(shifts: Shift[], year: number, month: number): string {
  if (shifts.length === 0) return `${year}_${String(month).padStart(2, '0')}`;
  const first = new Date(shifts[0].startDate);
  const last = new Date(shifts[shifts.length - 1].endDate);
  const pad = (n: number) => String(n).padStart(2, '0');
  const d1 = `${pad(first.getDate())}_${pad(first.getMonth() + 1)}_${first.getFullYear()}`;
  const d2 = `${pad(last.getDate())}_${pad(last.getMonth() + 1)}_${last.getFullYear()}`;
  return `${year}_${pad(month)} - dal ${d1} al ${d2}`;
}

/**
 * Generates the official Regione Umbria / Protezione Civile Excel sheet (.xls)
 * matching the model in 2026_08 - dal 04_08_2026 al 01_09_2026.xlsx
 * with user specifications:
 * - Le caselle contenenti i nomi dei reperibili (SOR, CF, VAL, CT, LV) sono BIANCHE (background-color:#FFFFFF)
 * - La riga dell'ultimo giorno del report è evidenziata con DOPPIO BORDO ROSSO superiore e inferiore (3px double #DC2626)
 * - Il testo della data dei giorni con cambio turno (09:00) è evidenziato in VERDE BOLD (color:#15803D; font-weight:bold;)
 * - Feriali in verde chiaro (#DCFCE7), Sabato in giallo (#FEF08A), Domenica in rosso chiaro (#FEE2E2), Festività in celeste (#BAE6FD)
 */
export function generateOfficialReportExcel(data: OfficialReportData): string {
  const { year, month, monthLabel, reportCode, shifts, operators } = data;
  const opMap = new Map(operators.map((o) => [o.id, o]));

  if (shifts.length === 0) return '';

  const firstShift = shifts[0];
  const lastShift = shifts[shifts.length - 1];
  const startD = new Date(firstShift.startDate);
  const endD = new Date(lastShift.endDate);

  // Collect all calendar days in this reporting window
  const days: { date: Date; dateStr: string; isStart: boolean; isEnd: boolean; holiday: string | null }[] = [];
  const cur = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate());
  const endLimit = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate());
  const pad = (n: number) => String(n).padStart(2, '0');

  while (cur <= endLimit) {
    const y = cur.getFullYear();
    const m = pad(cur.getMonth() + 1);
    const d = pad(cur.getDate());
    const dateStr = `${y}-${m}-${d}`;
    const holiday = getHolidayForDateStr(dateStr);

    // check if this is a handover date (09:00)
    const isHandover = shifts.some((s) => {
      const sStart = s.startDate.slice(0, 10);
      const sEnd = s.endDate.slice(0, 10);
      return sStart === dateStr || sEnd === dateStr;
    });

    days.push({
      date: new Date(cur.getTime()),
      dateStr,
      isStart: isHandover,
      isEnd: false,
      holiday,
    });
    cur.setDate(cur.getDate() + 1);
  }

  const lastDayIndex = days.length - 1;

  // Build the main table rows with merged cells for shifts
  let tableRows = '';

  shifts.forEach((shift) => {
    const sStart = new Date(shift.startDate);
    const sEnd = new Date(shift.endDate);

    // Dynamic operators across all 5 Ambiti
    const sorOp = shift.assignments?.SOR ? opMap.get(shift.assignments.SOR.operatorId) : opMap.get(shift.operatorId);
    const cfOp = shift.assignments?.CF ? opMap.get(shift.assignments.CF.operatorId) : null;
    const valOp = shift.assignments?.VAL ? opMap.get(shift.assignments.VAL.operatorId) : null;
    const ctOp = shift.assignments?.CT ? opMap.get(shift.assignments.CT.operatorId) : null;
    const lvOp = shift.assignments?.LV ? opMap.get(shift.assignments.LV.operatorId) : null;

    // Filter days belonging to this shift
    const shiftDayRows = days.filter((d) => {
      const dTime = d.date.getTime();
      const stTime = new Date(sStart.getFullYear(), sStart.getMonth(), sStart.getDate()).getTime();
      const endTime = new Date(sEnd.getFullYear(), sEnd.getMonth(), sEnd.getDate()).getTime();
      return dTime >= stTime && dTime <= endTime;
    });

    // Check if shift has daily overrides (e.g. sickness split)
    const hasOverrides = shift.dailyOverrides && Object.keys(shift.dailyOverrides).length > 0;

    // Free text note if defined by user, or calculated default
    let noteText = '';
    if (shift.notes && shift.notes.trim().length > 0) {
      noteText = shift.notes.replace(/\n/g, '<br/>');
    } else {
      noteText = `SOR: ${sorOp?.name.split(' ')[0] || ''} rep. da ore 9 del ${formatShortOfficialDate(sStart)} fino ore 9.00 del ${formatShortOfficialDate(sEnd)}`;
      if (hasOverrides) {
        const parts = Object.entries(shift.dailyOverrides!).map(([dt, ov]) => {
          const subOp = opMap.get(ov.operatorId);
          return `${dt.slice(8)}/${dt.slice(5, 7)}: ${subOp?.name} (${ov.reason || 'sostituisce titolare'})`;
        });
        noteText += `<br/><span style="color:#B45309; font-weight:bold;">Variazione interna: ${parts.join('; ')}</span>`;
      }
    }

    // Check if this shift contains the final calendar day of the report
    const lastDayStr = days[days.length - 1].dateStr;
    const hasLastDay = shiftDayRows.some((d) => d.dateStr === lastDayStr);
    const regularDays = hasLastDay ? shiftDayRows.filter((d) => d.dateStr !== lastDayStr) : shiftDayRows;
    const lastDayObj = hasLastDay ? shiftDayRows.find((d) => d.dateStr === lastDayStr) : null;
    const regRowSpan = regularDays.length;

    // Content for the 5 Ambiti: CASIS BIANCHE (background-color:#FFFFFF)
    const sorContent = `<strong>${sorOp?.name || ''}</strong>${
      hasOverrides ? '<div style="font-size:7.5pt; color:#DC2626;">(frazionato / variazioni)</div>' : ''
    }`;
    const cfContent = cfOp?.name || 'Laureti Barbara';
    const valContent = valOp?.name || 'Canonico Andrea';
    const ctContent = ctOp?.name || 'Motti Andrea';
    const lvContent = lvOp?.name || 'Pasquetti Michele';

    // 1. Render regular days of this shift
    regularDays.forEach((dayObj, dIdx) => {
      const isBoundaryBeforeLast = hasLastDay && dIdx === regularDays.length - 1;
      const dayOfWeek = dayObj.date.getDay();
      const isSunday = dayOfWeek === 0;
      const isSaturday = dayOfWeek === 6;
      const isHandover = dayObj.isStart;

      let rowBg = '#DCFCE7'; // Feriale verde chiaro
      let textColor = '#14532D';

      if (dayObj.holiday) {
        rowBg = '#BAE6FD'; // Festività celeste
        textColor = '#0C4A6E';
      } else if (isSunday) {
        rowBg = '#FEE2E2'; // Domenica rosso chiaro
        textColor = '#991B1B';
      } else if (isSaturday) {
        rowBg = '#FEF08A'; // Sabato giallo
        textColor = '#713F12';
      }

      let dateTextStyle = '';
      if (isHandover) {
        dateTextStyle = 'color:#15803D; font-weight:bold;';
      } else if (isSunday || isSaturday || dayObj.holiday) {
        dateTextStyle = `color:${textColor}; font-weight:bold;`;
      } else {
        dateTextStyle = `color:${textColor};`;
      }

      const bottomBorder = isBoundaryBeforeLast ? 'border-bottom:3px double #DC2626;' : 'border-bottom:1px solid #000;';
      const dateStyle = `border-top:1px solid #000; ${bottomBorder} border-left:1px solid #000; border-right:1px solid #000; padding:4px 6px; font-size:9pt; background-color:${rowBg}; ${dateTextStyle}`;
      const festStyle = `border-top:1px solid #000; ${bottomBorder} border-left:1px solid #000; border-right:1px solid #000; padding:4px; font-size:8pt; background-color:${dayObj.holiday ? '#BAE6FD' : rowBg}; ${
        dayObj.holiday ? 'color:#0C4A6E; font-weight:bold;' : ''
      }`;

      const festCell = `<td style="${festStyle}">${dayObj.holiday || ''}</td>`;

      if (dIdx === 0) {
        // First day of shift: render merged operator cells for all 5 Ambiti
        const reperibiliBottom = hasLastDay ? 'border-bottom:3px double #DC2626;' : 'border-bottom:1px solid #000;';
        const reperibiliCellStyle = `border-top:1px solid #000; ${reperibiliBottom} border-left:1px solid #000; border-right:1px solid #000; padding:8px; text-align:center; vertical-align:middle; background-color:#FFFFFF; color:#0F172A; font-size:9.5pt;`;

        tableRows += `
          <tr>
            <td style="${dateStyle}">${formatOfficialDayLabel(dayObj.date)}</td>
            ${festCell}
            <td rowspan="${regRowSpan}" style="${reperibiliCellStyle} font-weight:bold;">
              ${sorContent}
            </td>
            <td rowspan="${regRowSpan}" style="${reperibiliCellStyle}">
              ${cfContent}
            </td>
            <td rowspan="${regRowSpan}" style="${reperibiliCellStyle}">
              ${valContent}
            </td>
            <td rowspan="${regRowSpan}" style="${reperibiliCellStyle}">
              ${ctContent}
            </td>
            <td rowspan="${regRowSpan}" style="${reperibiliCellStyle}">
              ${lvContent}
            </td>
            <td rowspan="${regRowSpan}" style="border-top:1px solid #000; ${reperibiliBottom} border-left:1px solid #000; border-right:1px solid #000; padding:6px 8px; vertical-align:middle; font-size:8.5pt; background-color:#FFFFFF;">
              ${noteText}
            </td>
          </tr>
        `;
      } else {
        tableRows += `
          <tr>
            <td style="${dateStyle}">${formatOfficialDayLabel(dayObj.date)}</td>
            ${festCell}
          </tr>
        `;
      }
    });

    // 2. Render dedicated row for the last day: all 8 cells framed with double red border top and bottom
    if (lastDayObj) {
      const dayOfWeek = lastDayObj.date.getDay();
      const isSunday = dayOfWeek === 0;
      const isSaturday = dayOfWeek === 6;

      let rowBg = '#DCFCE7';
      let textColor = '#14532D';

      if (lastDayObj.holiday) {
        rowBg = '#BAE6FD';
        textColor = '#0C4A6E';
      } else if (isSunday) {
        rowBg = '#FEE2E2';
        textColor = '#991B1B';
      } else if (isSaturday) {
        rowBg = '#FEF08A';
        textColor = '#713F12';
      }

      const doubleRedCell = 'border-top:3px double #DC2626; border-bottom:3px double #DC2626; border-left:1px solid #000; border-right:1px solid #000;';
      const lastDateStyle = `${doubleRedCell} padding:4px 6px; font-size:9pt; background-color:${rowBg}; color:#15803D; font-weight:bold;`;
      const lastFestStyle = `${doubleRedCell} padding:4px; font-size:8pt; background-color:${lastDayObj.holiday ? '#BAE6FD' : rowBg}; ${
        lastDayObj.holiday ? 'color:#0C4A6E; font-weight:bold;' : ''
      }`;
      const lastWhiteCell = `${doubleRedCell} padding:6px 8px; text-align:center; vertical-align:middle; background-color:#FFFFFF; color:#0F172A; font-size:9pt;`;

      tableRows += `
        <tr>
          <td style="${lastDateStyle}">${formatOfficialDayLabel(lastDayObj.date)}</td>
          <td style="${lastFestStyle}">${lastDayObj.holiday || ''}</td>
          <td style="${lastWhiteCell} font-weight:bold;">
            <div>${sorOp?.name || ''}</div>
            <div style="font-size:7.5pt; color:#64748B; font-weight:normal;">fino ore 09:00</div>
          </td>
          <td style="${lastWhiteCell}">
            <div>${cfContent}</div>
            <div style="font-size:7.5pt; color:#64748B;">fino ore 09:00</div>
          </td>
          <td style="${lastWhiteCell}">
            <div>${valContent}</div>
            <div style="font-size:7.5pt; color:#64748B;">fino ore 09:00</div>
          </td>
          <td style="${lastWhiteCell}">
            <div>${ctContent}</div>
            <div style="font-size:7.5pt; color:#64748B;">fino ore 09:00</div>
          </td>
          <td style="${lastWhiteCell}">
            <div>${lvContent}</div>
            <div style="font-size:7.5pt; color:#64748B;">fino ore 09:00</div>
          </td>
          <td style="${doubleRedCell} padding:6px 8px; vertical-align:middle; font-size:8.5pt; background-color:#FFFFFF;">
            Passaggio consegne ore 09:00 — Fine periodo rendicontazione
          </td>
        </tr>
      `;
    }
  });

  // Build bottom table: "Turni reperibilità mese di [mese anno]"
  const bottomRows = shifts.map((s) => {
    const sStart = new Date(s.startDate);
    const sEnd = new Date(s.endDate);
    return `
      <tr>
        <td style="border:1px solid #000; padding:4px 8px; text-align:center; font-weight:bold;">9:00 di</td>
        <td style="border:1px solid #000; padding:4px 8px; color:#15803D; font-weight:bold;">${formatShortOfficialDate(sStart)}</td>
        <td style="border:1px solid #000; padding:4px 8px; text-align:center; font-weight:bold;">9:00 di</td>
        <td style="border:1px solid #000; padding:4px 8px; color:#15803D; font-weight:bold;">${formatShortOfficialDate(sEnd)}</td>
      </tr>
    `;
  }).join('');

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; font-size: 9pt; }
        table { border-collapse: collapse; }
      </style>
    </head>
    <body>
      <div style="text-align:center; margin-bottom:12px;">
        <h3 style="margin:2px; font-size:14pt; font-weight:bold; color:#1E293B;">Regione Umbria</h3>
        <p style="margin:2px; font-size:8pt; font-weight:bold; color:#334155;">
          DIREZIONE REGIONALE: GOVERNO DEL TERRITORIO, AMBIENTE, PROTEZIONE CIVILE, RIQUALIFICAZIONE URBANA, COORDINAMENTO PNRR
        </p>
        <p style="margin:2px; font-size:9pt; font-weight:bold; color:#0F172A;">
          Servizio: Protezione civile ed emergenze
        </p>
      </div>

      <div style="background-color:#991B1B; color:#FFFFFF; text-align:center; padding:6px; font-weight:bold; font-size:11pt; border:2px solid #000; margin-bottom:10px;">
        Turni di reperibilità: ${reportCode}
      </div>

      <table style="width:100%; border:2px solid #000; margin-bottom:20px;">
        <thead>
          <tr style="background-color:#F8FAFC; text-align:center; font-weight:bold;">
            <th style="border:1px solid #000; width:110px; padding:6px;">Data</th>
            <th style="border:1px solid #000; width:130px; padding:6px;">Festività</th>
            <th style="border:1px solid #000; width:160px; padding:6px; background-color:#FFEDD5;">
              SOR<br/><span style="font-size:7.5pt; font-weight:normal;">Sala Operativa<br/>Regionale</span>
            </th>
            <th style="border:1px solid #000; width:140px; padding:6px; background-color:#FEF9C3;">
              CF<br/><span style="font-size:7.5pt; font-weight:normal;">Centro<br/>Funzionale</span>
            </th>
            <th style="border:1px solid #000; width:180px; padding:6px; background-color:#FFEDD5;">
              VAL<br/><span style="font-size:7.5pt; font-weight:normal;">Valutazioni Tecniche<br/>per Pubblica Incolumità / Danno</span>
            </th>
            <th style="border:1px solid #000; width:160px; padding:6px; background-color:#E0F2FE;">
              CT<br/><span style="font-size:7.5pt; font-weight:normal;">Servizi Tecnici Regionali /<br/>Controllo Territoriale</span>
            </th>
            <th style="border:1px solid #000; width:140px; padding:6px; background-color:#FEF08A;">
              LV<br/><span style="font-size:7.5pt; font-weight:normal;">Logistica e<br/>Volontariato</span>
            </th>
            <th style="border:1px solid #000; width:280px; padding:6px;">NOTE</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <!-- Bottom Box matching official PDF -->
      <table style="margin-top:20px; width:100%;">
        <tr>
          <td style="width:50%; vertical-align:top; border:1px solid #000; padding:10px; background-color:#F8FAFC; font-size:8.5pt;">
            <p style="font-weight:bold; margin-top:0;">
              NB: il turno di reperibilità, salvo diversa indicazione, inizia/termina alle ore 09:00 delle giornate evidenziate.<br/>
              Si riportano di seguito i turni del periodo.
            </p>
          </td>
          <td style="width:50%; vertical-align:top; padding-left:15px;">
            <div style="font-weight:bold; font-size:9pt; margin-bottom:4px; text-align:center; background-color:#F1F5F9; border:1px solid #000; padding:3px;">
              Turni reperibilità mese di ${monthLabel.toLowerCase()}
            </div>
            <table style="width:100%; border:1px solid #000; font-size:8.5pt;">
              <thead>
                <tr style="background-color:#E2E8F0; text-align:center;">
                  <th colspan="2" style="border:1px solid #000; padding:3px;">Dalle ore</th>
                  <th colspan="2" style="border:1px solid #000; padding:3px;">Alle ore</th>
                </tr>
              </thead>
              <tbody>
                ${bottomRows}
              </tbody>
            </table>
          </td>
        </tr>
      </table>

      <div style="text-align:right; font-size:7pt; color:#64748B; margin-top:25px;">
        ${reportCode.replace(/\s+/g, '_')}.xlsx &nbsp;&nbsp;&nbsp; CG/gc
      </div>
    </body>
    </html>
  `;
}
