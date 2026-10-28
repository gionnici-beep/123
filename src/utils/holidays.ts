import { ItalianHoliday } from '../types';

/**
 * Calculates Easter Sunday for a given year using the Anonymous Gregorian algorithm.
 */
export function getEasterDate(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Returns all national Italian holidays for a given year.
 */
export function getItalianHolidays(year: number): ItalianHoliday[] {
  const holidays: ItalianHoliday[] = [
    { date: `${year}-01-01`, name: 'Capodanno' },
    { date: `${year}-01-06`, name: 'Epifania' },
    { date: `${year}-04-25`, name: 'Festa della Liberazione' },
    { date: `${year}-05-01`, name: 'Festa dei Lavoratori' },
    { date: `${year}-06-02`, name: 'Festa della Repubblica' },
    { date: `${year}-08-15`, name: 'Assunzione / Ferragosto' },
    { date: `${year}-11-01`, name: 'Tutti i Santi (Ognissanti)' },
    { date: `${year}-12-08`, name: 'Immacolata Concezione' },
    { date: `${year}-12-25`, name: 'Natale' },
    { date: `${year}-12-26`, name: 'Santo Stefano' },
  ];

  // Easter & Pasquetta
  const easter = getEasterDate(year);
  const easterDate = new Date(Date.UTC(year, easter.month - 1, easter.day));
  const pasquettaDate = new Date(Date.UTC(year, easter.month - 1, easter.day + 1));

  const formatIso = (d: Date) => d.toISOString().split('T')[0];

  holidays.push({
    date: formatIso(easterDate),
    name: 'Pasqua',
  });
  holidays.push({
    date: formatIso(pasquettaDate),
    name: "Lunedì dell'Angelo (Pasquetta)",
  });

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

// Pre-computed map for fast lookup across 2026, 2027, 2028
const nationalHolidayCache: Map<string, string> = new Map();

[2026, 2027, 2028, 2029].forEach((y) => {
  const hList = getItalianHolidays(y);
  hList.forEach((h) => {
    nationalHolidayCache.set(h.date, h.name);
  });
});

// Custom holidays store (e.g. Santo Patrono, feste locali, ponti aziendali)
let customHolidaysCache: ItalianHoliday[] = [];

export function setCustomHolidaysRegistry(holidays: ItalianHoliday[]) {
  customHolidaysCache = [...holidays];
}

export function getCustomHolidaysRegistry(): ItalianHoliday[] {
  return customHolidaysCache;
}

export function getHolidayForDateStr(dateStr: string, customList?: ItalianHoliday[]): string | null {
  const key = dateStr.slice(0, 10);
  // Check custom holidays first
  const list = customList || customHolidaysCache;
  const custom = list.find((h) => h.date === key);
  if (custom) return custom.name;

  return nationalHolidayCache.get(key) || null;
}

export function isHoliday(date: Date, customList?: ItalianHoliday[]): boolean {
  const pad = (n: number) => String(n).padStart(2, '0');
  const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return getHolidayForDateStr(key, customList) !== null;
}

/**
 * Checks if a date is Monday-Friday.
 */
export function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Checks if a date is a working day (giornata feriale: Mon-Fri and NOT a holiday or patron saint).
 */
export function isFeriale(date: Date, customList?: ItalianHoliday[]): boolean {
  return isWeekday(date) && !isHoliday(date, customList);
}

/**
 * Common Italian Patron Saints presets
 */
export const COMMON_PATRON_SAINTS = [
  { city: 'Roma', name: 'Santi Pietro e Paolo (Patrono di Roma)', month: 6, day: 29 },
  { city: 'Milano', name: "Sant'Ambrogio (Patrono di Milano)", month: 12, day: 7 },
  { city: 'Napoli', name: 'San Gennaro (Patrono di Napoli)', month: 9, day: 19 },
  { city: 'Torino / Firenze / Genova', name: 'San Giovanni Battista (Patrono)', month: 6, day: 24 },
  { city: 'Bologna', name: 'San Petronio (Patrono di Bologna)', month: 10, day: 4 },
  { city: 'Venezia', name: 'San Marco Evangelista (Patrono di Venezia)', month: 4, day: 25 },
  { city: 'Palermo', name: 'Santa Rosalia (Patrona di Palermo)', month: 7, day: 15 },
  { city: 'Bari', name: 'San Nicola (Patrono di Bari)', month: 12, day: 6 },
  { city: 'Catania', name: "Sant'Agata (Patrona di Catania)", month: 2, day: 5 },
  { city: 'Trieste', name: 'San Giusto (Patrono di Trieste)', month: 11, day: 3 },
  { city: 'Padova', name: "Sant'Antonio di Padova (Patrono)", month: 6, day: 13 },
  { city: 'Verona', name: 'San Zeno (Patrono di Verona)', month: 5, day: 21 },
  { city: 'Cagliari', name: 'San Saturnino (Patrono di Cagliari)', month: 10, day: 30 },
];
