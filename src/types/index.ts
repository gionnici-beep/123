export type AmbitoType = 'SOR' | 'CF' | 'VAL' | 'CT' | 'LV';

export interface AmbitoConfig {
  id: AmbitoType;
  code: AmbitoType;
  name: string;
  fullName: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  headerBg: string;
}

export const AMBITI: Record<AmbitoType, AmbitoConfig> = {
  SOR: {
    id: 'SOR',
    code: 'SOR',
    name: 'SOR',
    fullName: 'Sala Operativa Regionale',
    description: 'Gestione H24 delle emergenze di protezione civile e coordinamento operativo',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-900',
    headerBg: '#FFEDD5',
  },
  CF: {
    id: 'CF',
    code: 'CF',
    name: 'CF',
    fullName: 'Centro Funzionale',
    description: 'Monitoraggio meteo-idrogeologico, emissione bollettini e allerte',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    headerBg: '#FEF9C3',
  },
  VAL: {
    id: 'VAL',
    code: 'VAL',
    name: 'VAL',
    fullName: 'Valutazioni Tecniche',
    description: 'Valutazioni tecniche per pubblica incolumità, stabilità e rilievo del danno',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-900',
    headerBg: '#FFEDD5',
  },
  CT: {
    id: 'CT',
    code: 'CT',
    name: 'CT',
    fullName: 'Controllo Territoriale',
    description: 'Servizi tecnici regionali, presidio delle infrastrutture e controllo del territorio',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-900',
    headerBg: '#E0F2FE',
  },
  LV: {
    id: 'LV',
    code: 'LV',
    name: 'LV',
    fullName: 'Logistica e Volontariato',
    description: 'Coordinamento colonna mobile, mezzi, attrezzature e organizzazioni di volontariato',
    badgeBg: 'bg-yellow-100',
    badgeText: 'text-yellow-900',
    headerBg: '#FEF08A',
  },
};

export interface Operator {
  id: string;
  name: string;
  role: string;
  ambito: AmbitoType; // 'SOR' | 'CF' | 'VAL' | 'CT' | 'LV'
  email: string;
  phone: string;
  color: string; // Tailwind hex color
  bgColor: string; // Subtle background hex
  textColor: string;
  active: boolean;
  maxDaysPerMonth: number;
}

export interface DailyOverride {
  operatorId: string;
  reason?: string; // es. 'Malattia del titolare', 'Ferie', 'Permesso', 'Sostituzione concordata'
}

export interface AmbitoShiftAssignment {
  operatorId: string;
  backupOperatorId?: string;
  dailyOverrides?: Record<string, DailyOverride>; // 'YYYY-MM-DD' -> { operatorId, reason }
}

export interface Shift {
  id: string;
  shiftNumber: number;
  startDate: string; // ISO string '2027-01-05T09:00:00'
  endDate: string;   // ISO string '2027-01-11T09:00:00'
  durationDays: number;
  // Primary (SOR) operatorId for backwards compatibility
  operatorId: string;
  backupOperatorId?: string;
  dailyOverrides?: Record<string, DailyOverride>; // 'YYYY-MM-DD' -> { operatorId, reason }
  // Multi-ambito assignments for SOR, CF, VAL, CT, LV
  assignments?: Record<AmbitoType, AmbitoShiftAssignment>;
  notes?: string;
  isWeekendShift: boolean;
  hasHoliday: boolean;
  holidayNames: string[];
}

export interface ItalianHoliday {
  date: string; // 'YYYY-MM-DD'
  name: string;
  isCustom?: boolean;
  city?: string;
}

export interface MonthSummary {
  year: number;
  month: number; // 1-12
  monthLabel: string;
  totalDays: number;
  operatorDays: Record<string, number>; // operatorId -> days in this month
  hasViolations: boolean;
}
