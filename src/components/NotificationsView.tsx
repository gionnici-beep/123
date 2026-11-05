import React, { useState, useMemo, useEffect } from 'react';
import {
  Bell,
  Mail,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Phone,
  Calendar,
  Send,
  Copy,
  Check,
  Filter,
  Info,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { Operator, Shift, AmbitoType, AMBITI } from '../types';
import { formatItalianDate, formatShortDate } from '../utils/shiftLogic';

export interface NotificationRecord {
  id: string;
  shiftId: string;
  shiftNumber: number;
  ambito: AmbitoType;
  handoverDate: string; // ISO string '2027-01-05T09:00:00'
  incomingOperator: Operator;
  outgoingOperator?: Operator;
  durationDays: number;
  endDate: string;
  status: 'pending' | 'due' | 'sent';
  sentAt?: string;
  sentChannel?: 'email' | 'sms' | 'both';
}

interface NotificationsViewProps {
  shifts: Shift[];
  operators: Operator[];
}

const NOTIFICATIONS_STORAGE_KEY = 'turni_reperibilita_notifications_log_v1';
const INSTRUCTIONS_STORAGE_KEY = 'turni_reperibilita_instructions_custom_v1';

const DEFAULT_INSTRUCTIONS = `ISTRUZIONI GENERALI DI REPERIBILITÀ (REGIONE UMBRIA - PROTEZIONE CIVILE):
1. ORARIO: Il turno decorre dalle ore 09:00 del primo giorno alle ore 09:00 del termine.
2. PASSAGGIO CONSEGNE: Contattare il collega uscente prima delle ore 09:00 per il briefing operativo, verifica apparati e diario eventi.
3. PRONTEZZA: Mantenere gli apparati (cellulare di servizio e radio) sempre carichi, accesi e raggiungibili. Obbligo di risposta immediata alle chiamate della SOR/CF.
4. SOSTITUZIONI: Eventuali indisponibilità o cambi devono essere comunicati tempestivamente al Responsabile di Servizio.`;

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  shifts,
  operators,
}) => {
  const opMap = useMemo(() => new Map(operators.map((o) => [o.id, o])), [operators]);

  // Saved sent logs: map shiftId_ambito -> { sentAt, channel }
  const [sentLogs, setSentLogs] = useState<Record<string, { sentAt: string; channel: 'email' | 'sms' | 'both' }>>(() => {
    try {
      const saved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load notification logs', e);
    }
    return {};
  });

  const [customInstructions, setCustomInstructions] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(INSTRUCTIONS_STORAGE_KEY);
      if (saved) return saved;
    } catch (e) {
      console.error('Failed to load instructions', e);
    }
    return DEFAULT_INSTRUCTIONS;
  });

  // Simulated reference date (defaults to 48 hours before shift 1, or real current date)
  // Shift 1 begins 2027-01-05 09:00, so 2027-01-03 09:00 is exactly 48h before!
  const [simulatedDateStr, setSimulatedDateStr] = useState<string>('2027-01-03T09:00:00');
  const [useRealDate, setUseRealDate] = useState<boolean>(false);

  // Filters
  const [selectedAmbito, setSelectedAmbito] = useState<'ALL' | AmbitoType>('ALL');
  const [filterDueOnly, setFilterDueOnly] = useState<'all' | 'due' | 'sent'>('all');

  // Preview modal
  const [previewNotification, setPreviewNotification] = useState<NotificationRecord | null>(null);
  const [copiedType, setCopiedType] = useState<'email' | 'sms' | null>(null);
  const [isEditingInstructions, setIsEditingInstructions] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(sentLogs));
    } catch (e) {
      console.error('Failed to save sent logs', e);
    }
  }, [sentLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(INSTRUCTIONS_STORAGE_KEY, customInstructions);
    } catch (e) {
      console.error('Failed to save instructions', e);
    }
  }, [customInstructions]);

  const nowRef = useMemo(() => {
    if (useRealDate) return new Date();
    return new Date(simulatedDateStr);
  }, [useRealDate, simulatedDateStr]);

  // Build the complete list of handover notifications across all shifts and Ambiti
  const allNotifications: NotificationRecord[] = useMemo(() => {
    const ambitiList: AmbitoType[] = ['SOR', 'CF', 'VAL', 'CT', 'LV'];
    const list: NotificationRecord[] = [];

    shifts.forEach((shift, shiftIndex) => {
      const prevShift = shiftIndex > 0 ? shifts[shiftIndex - 1] : null;
      const handoverTime = new Date(shift.startDate).getTime();
      const diffMs = handoverTime - nowRef.getTime();
      const diffHours = diffMs / (1000 * 3600);

      ambitiList.forEach((amb) => {
        // Incoming operator
        const incomingOpId = shift.assignments?.[amb]?.operatorId || (amb === 'SOR' ? shift.operatorId : '');
        const incomingOp = opMap.get(incomingOpId);
        if (!incomingOp) return;

        // Outgoing operator from previous shift
        let outgoingOp: Operator | undefined = undefined;
        if (prevShift) {
          const prevOpId = prevShift.assignments?.[amb]?.operatorId || (amb === 'SOR' ? prevShift.operatorId : '');
          outgoingOp = opMap.get(prevOpId);
        }

        const logKey = `${shift.id}_${amb}`;
        const existingLog = sentLogs[logKey];

        let status: 'pending' | 'due' | 'sent' = 'pending';
        if (existingLog) {
          status = 'sent';
        } else if (diffHours <= 48 && diffHours >= -24) {
          // Handover is within 48h from now (or up to 24h past)
          status = 'due';
        }

        list.push({
          id: logKey,
          shiftId: shift.id,
          shiftNumber: shift.shiftNumber,
          ambito: amb,
          handoverDate: shift.startDate,
          incomingOperator: incomingOp,
          outgoingOperator: outgoingOp,
          durationDays: shift.durationDays,
          endDate: shift.endDate,
          status,
          sentAt: existingLog?.sentAt,
          sentChannel: existingLog?.channel,
        });
      });
    });

    return list;
  }, [shifts, opMap, nowRef, sentLogs]);

  // Filtered list
  const filteredNotifications = useMemo(() => {
    return allNotifications.filter((n) => {
      if (selectedAmbito !== 'ALL' && n.ambito !== selectedAmbito) return false;
      if (filterDueOnly === 'due' && n.status !== 'due') return false;
      if (filterDueOnly === 'sent' && n.status !== 'sent') return false;
      return true;
    });
  }, [allNotifications, selectedAmbito, filterDueOnly]);

  const dueCount = useMemo(() => {
    return allNotifications.filter((n) => n.status === 'due').length;
  }, [allNotifications]);

  const sentCount = useMemo(() => {
    return allNotifications.filter((n) => n.status === 'sent').length;
  }, [allNotifications]);

  // Mark notification as sent
  const markAsSent = (id: string, channel: 'email' | 'sms' | 'both') => {
    setSentLogs((prev) => ({
      ...prev,
      [id]: {
        sentAt: new Date().toISOString(),
        channel,
      },
    }));
  };

  const markAsUnsent = (id: string) => {
    setSentLogs((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  // Generate Email Text
  const generateEmailContent = (n: NotificationRecord) => {
    const ambConfig = AMBITI[n.ambito];
    const incoming = n.incomingOperator;
    const outgoing = n.outgoingOperator;

    const startDateStr = formatItalianDate(n.handoverDate);
    const endDateStr = formatItalianDate(n.endDate);

    const subject = `[PROTEZIONE CIVILE UMBRIA] Notifica Cambio Turno Reperibilità - Ambito ${n.ambito} (Turno #${n.shiftNumber})`;

    const body = `Gentile ${incoming.name},

Si comunica l'assegnazione del prossimo turno di reperibilità per il Servizio di Protezione Civile ed Emergenze della Regione Umbria.

=== DETTAGLI NUOVO TURNO ASSEGNATO ===
- Ambito: ${ambConfig.fullName} (${n.ambito})
- Turno Numero: #${String(n.shiftNumber).padStart(2, '0')}
- Inizio Turno (Presa in carico): ${startDateStr} ore 09:00
- Fine Turno (Cessione consegne): ${endDateStr} ore 09:00
- Durata: ${n.durationDays} giorni

=== CONTATTI COLLEGA SMONTANTE (PASSAGGIO CONSEGNE) ===
${
  outgoing
    ? `- Collega uscente: ${outgoing.name}
- Ruolo: ${outgoing.role}
- Telefono / Cellulare: ${outgoing.phone}
- Email: ${outgoing.email}
Si richiede di contattare il collega uscente prima delle ore 09:00 del giorno di cambio turno per verificare lo stato della sala, le comunicazioni in corso e il diario degli eventi.`
    : `- Primo turno del piano annuale: inizio decorrenza servizio concordato ore 09:00.`
}

=== ISTRUZIONI GENERALI DI REPERIBILITÀ ===
${customInstructions}

In caso di assoluto impedimento o sopraggiunta indisponibilità (es. malattia), provvedere a dare immediato avviso al Responsabile di Servizio per la tempestiva rimodulazione del turno.

Cordiali saluti,
Regione Umbria - Direzione Governo del Territorio e Protezione Civile
Servizio: Protezione Civile ed Emergenze`;

    return { subject, body };
  };

  // Generate SMS Text
  const generateSmsContent = (n: NotificationRecord) => {
    const outgoing = n.outgoingOperator;
    const shortStart = formatShortDate(n.handoverDate);
    const shortEnd = formatShortDate(n.endDate);

    let text = `PC UMBRIA: Notifica Turno #${n.shiftNumber} (${n.ambito}) dal ${shortStart} 09:00 al ${shortEnd} 09:00 (${n.durationDays}gg). `;
    if (outgoing) {
      text += `Passaggio consegne da: ${outgoing.name} (Tel: ${outgoing.phone}). `;
    }
    text += `Reperibilita H24 attiva. Istruzioni: risposta immediata e rispetto orari.`;
    return text;
  };

  const handleSendEmail = (n: NotificationRecord) => {
    const { subject, body } = generateEmailContent(n);
    const mailtoUrl = `mailto:${encodeURIComponent(n.incomingOperator.email)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    markAsSent(n.id, 'email');
  };

  const handleSendSms = (n: NotificationRecord) => {
    const smsText = generateSmsContent(n);
    const smsUrl = `sms:${encodeURIComponent(n.incomingOperator.phone)}?body=${encodeURIComponent(smsText)}`;
    window.location.href = smsUrl;
    markAsSent(n.id, 'sms');
  };

  const copyToClipboard = (text: string, type: 'email' | 'sms') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-rose-100 text-rose-700 rounded-lg">
              <Bell className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Sistema Notifiche Cambi Turno (Avviso 48h)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Avvisi tempestivi ai reperibili per i 5 Ambiti (SOR, CF, VAL, CT, LV) con dettagli nuovo turno, contatti del collega uscente e istruzioni generali.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Metrics */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>In scadenza (≤48h): <strong>{dueCount}</strong></span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Inviate: <strong>{sentCount}</strong></span>
            </div>
          </div>

          <button
            onClick={() => setIsEditingInstructions(!isEditingInstructions)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            <span>Personalizza Istruzioni</span>
          </button>
        </div>
      </div>

      {/* Reference Date Simulator (To simulate 48h before turn 1 or live date) */}
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs">
          <span className="p-1.5 rounded bg-slate-800 text-amber-400">
            <Clock className="w-4 h-4" />
          </span>
          <div>
            <span className="font-semibold text-slate-200 block">
              Data di Riferimento Notifiche:
            </span>
            <span className="text-[11px] text-slate-400">
              {useRealDate
                ? `Data Reale Sistema: ${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : `Simulazione: ${new Date(simulatedDateStr).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} (48h prima del 5 Gennaio 2027)`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!useRealDate ? (
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={simulatedDateStr.slice(0, 16)}
                onChange={(e) => setSimulatedDateStr(`${e.target.value}:00`)}
                className="text-xs bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-slate-200 font-mono"
              />
              <button
                onClick={() => setUseRealDate(true)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors cursor-pointer"
              >
                Usa Data Odierna Reale
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setUseRealDate(false);
                setSimulatedDateStr('2027-01-03T09:00:00');
              }}
              className="px-2.5 py-1 text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors cursor-pointer"
            >
              Simula 3 Gennaio 2027 (48h prima turno 1)
            </button>
          )}
        </div>
      </div>

      {/* Customizable General Instructions Box (Collapsible) */}
      {isEditingInstructions && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Modello Istruzioni Generali di Reperibilità</span>
            </div>
            <button
              onClick={() => setCustomInstructions(DEFAULT_INSTRUCTIONS)}
              className="text-xs text-blue-600 hover:underline cursor-pointer"
            >
              Ripristina predefinite
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Questo testo viene automaticamente inserito nel corpo di tutte le notifiche inviate tramite Email o allegato informativo.
          </p>
          <textarea
            rows={5}
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-end">
            <button
              onClick={() => setIsEditingInstructions(false)}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Salva e Chiudi
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Ambito Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setSelectedAmbito('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              selectedAmbito === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Tutti gli Ambiti
          </button>
          {(['SOR', 'CF', 'VAL', 'CT', 'LV'] as AmbitoType[]).map((amb) => {
            const isSel = selectedAmbito === amb;
            return (
              <button
                key={amb}
                onClick={() => setSelectedAmbito(amb)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  isSel
                    ? 'bg-rose-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {amb}
              </button>
            );
          })}
        </div>

        {/* Due / Sent status filter */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto text-xs">
          <button
            onClick={() => setFilterDueOnly('all')}
            className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
              filterDueOnly === 'all' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
            }`}
          >
            Tutti ({allNotifications.length})
          </button>
          <button
            onClick={() => setFilterDueOnly('due')}
            className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
              filterDueOnly === 'due' ? 'bg-amber-500 text-white shadow-xs font-bold' : 'text-slate-600'
            }`}
          >
            In Scadenza ≤48h ({dueCount})
          </button>
          <button
            onClick={() => setFilterDueOnly('sent')}
            className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
              filterDueOnly === 'sent' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-600'
            }`}
          >
            Inviate ({sentCount})
          </button>
        </div>
      </div>

      {/* Notifications Cards Grid */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-500 text-xs">
            Nessuna notifica corrisponde ai filtri selezionati.
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const ambConfig = AMBITI[n.ambito];
            const startDate = new Date(n.handoverDate);
            const isDue = n.status === 'due';
            const isSent = n.status === 'sent';

            return (
              <div
                key={n.id}
                className={`p-4 rounded-xl border transition-all ${
                  isDue
                    ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                    : isSent
                    ? 'bg-slate-50/60 border-slate-200 opacity-90'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Shift & Ambito Details */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${ambConfig.badgeBg} ${ambConfig.badgeText}`}>
                        {n.ambito} · {ambConfig.fullName}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        Turno #{String(n.shiftNumber).padStart(2, '0')} ({n.durationDays} gg)
                      </span>

                      {isDue && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-200/90 px-2 py-0.5 rounded animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                          <span>Da Inviare (≤ 48 ore)</span>
                        </span>
                      )}

                      {isSent && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Inviata ({n.sentChannel?.toUpperCase()})</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-bold text-slate-900">
                      Cambio turno: <span className="text-blue-800 underline decoration-blue-500">{formatItalianDate(n.handoverDate)} ore 09:00</span> fino al {formatItalianDate(n.endDate)} ore 09:00
                    </div>

                    {/* People involved in handover */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                      {/* Incoming operator */}
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-emerald-700 block mb-0.5">
                          Destinatario Avviso (Reperibile Entrante):
                        </span>
                        <div className="font-bold text-slate-900 text-sm">
                          {n.incomingOperator.name}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-1 font-mono">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {n.incomingOperator.phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {n.incomingOperator.email}
                          </span>
                        </div>
                      </div>

                      {/* Outgoing operator */}
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-600 block mb-0.5">
                          Collega Uscente (Passaggio Consegne):
                        </span>
                        {n.outgoingOperator ? (
                          <>
                            <div className="font-bold text-slate-800 text-sm">
                              {n.outgoingOperator.name}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-1 font-mono">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {n.outgoingOperator.phone}
                              </span>
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                {n.outgoingOperator.email}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-slate-400 italic">
                            Primo turno del ciclo annuale
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Email, SMS, Preview */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
                    <button
                      onClick={() => setPreviewNotification(n)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5 text-slate-500" />
                      <span>Anteprima Testo</span>
                    </button>

                    <button
                      onClick={() => handleSendEmail(n)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Apri client email con oggetto e corpo precompilato"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Invia Email</span>
                    </button>

                    <button
                      onClick={() => handleSendSms(n)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Invia SMS rapido"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Invia SMS</span>
                    </button>

                    {isSent && (
                      <button
                        onClick={() => markAsUnsent(n.id)}
                        className="text-[10px] text-slate-400 hover:text-red-600 underline cursor-pointer mt-0.5"
                      >
                        Ripristina stato
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Preview Modal for Complete Notification Text */}
      {previewNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-100 text-blue-800 rounded-lg">
                  <Mail className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Dettaglio Notifica Cambio Turno #{previewNotification.shiftNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Destinatario: <strong>{previewNotification.incomingOperator.name}</strong> ({previewNotification.ambito})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewNotification(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Email Preview Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>Testo Ufficiale Email:</span>
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(generateEmailContent(previewNotification).body, 'email')}
                  className="text-xs text-blue-700 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  {copiedType === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'email' ? 'Copiato!' : 'Copia Testo Email'}</span>
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                <div className="font-bold text-slate-900 pb-2 mb-2 border-b border-slate-200">
                  Oggetto: {generateEmailContent(previewNotification).subject}
                </div>
                {generateEmailContent(previewNotification).body}
              </div>
            </div>

            {/* SMS Preview Section */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Testo Sintetico SMS:</span>
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(generateSmsContent(previewNotification), 'sms')}
                  className="text-xs text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  {copiedType === 'sms' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'sms' ? 'Copiato!' : 'Copia Testo SMS'}</span>
                </button>
              </div>

              <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs font-mono text-emerald-950 whitespace-pre-wrap leading-relaxed">
                {generateSmsContent(previewNotification)}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewNotification(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Chiudi
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSendSms(previewNotification);
                  setPreviewNotification(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Invia SMS</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSendEmail(previewNotification);
                  setPreviewNotification(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Invia Email</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
