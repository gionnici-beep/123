import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  ShieldCheck,
  User,
  Phone,
  AlertTriangle,
  FileText,
  ArrowRightLeft,
  Sparkles,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { Operator, Shift, DailyOverride, AmbitoType, AMBITI, AmbitoShiftAssignment } from '../types';
import { formatItalianDate, formatShortDate } from '../utils/shiftLogic';

interface ShiftDetailModalProps {
  shift: Shift;
  operators: Operator[];
  shifts: Shift[];
  onClose: () => void;
  onSaveShift: (updatedShift: Shift) => void;
}

export const ShiftDetailModal: React.FC<ShiftDetailModalProps> = ({
  shift,
  operators,
  shifts,
  onClose,
  onSaveShift,
}) => {
  const [currentAmbito, setCurrentAmbito] = useState<AmbitoType>('SOR');

  const [assignments, setAssignments] = useState<Record<AmbitoType, AmbitoShiftAssignment>>(() => {
    const defaultAssignment = (amb: AmbitoType) => {
      const ambOps = operators.filter((o) => (o.ambito || 'SOR') === amb);
      return { operatorId: ambOps[0]?.id || operators[0]?.id || '' };
    };

    return {
      SOR: shift.assignments?.SOR || {
        operatorId: shift.operatorId,
        backupOperatorId: shift.backupOperatorId,
        dailyOverrides: shift.dailyOverrides,
      },
      CF: shift.assignments?.CF || defaultAssignment('CF'),
      VAL: shift.assignments?.VAL || defaultAssignment('VAL'),
      CT: shift.assignments?.CT || defaultAssignment('CT'),
      LV: shift.assignments?.LV || defaultAssignment('LV'),
    };
  });

  const [notes, setNotes] = useState(shift.notes || '');

  const opMap = useMemo(() => new Map(operators.map((o) => [o.id, o])), [operators]);

  // Current active assignment for the selected Ambito
  const activeAssignment = assignments[currentAmbito] || { operatorId: '' };
  const currentOp = opMap.get(activeAssignment.operatorId);

  // Filter operators by current Ambito
  const ambitoOperators = useMemo(() => {
    return operators.filter((o) => (o.ambito || 'SOR') === currentAmbito);
  }, [operators, currentAmbito]);

  // Build the list of individual 24h days belonging to this shift
  const shiftDays = useMemo(() => {
    const days: { dateStr: string; label: string; dayIndex: number; formattedDate: string }[] = [];
    const start = new Date(shift.startDate);
    const end = new Date(shift.endDate);
    const cur = new Date(start.getTime());
    const weekdays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const pad = (n: number) => String(n).padStart(2, '0');
    let idx = 1;

    while (cur < end) {
      const y = cur.getFullYear();
      const m = pad(cur.getMonth() + 1);
      const d = pad(cur.getDate());
      const dateStr = `${y}-${m}-${d}`;
      const wd = weekdays[cur.getDay()];
      days.push({
        dateStr,
        label: `Giorno ${idx} · ${wd} ${d}/${m}/${y}`,
        formattedDate: `${d}/${m}/${y}`,
        dayIndex: idx,
      });
      idx += 1;
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [shift]);

  // Set titular operator for current Ambito
  const handleSetTitular = (newOpId: string) => {
    setAssignments((prev) => ({
      ...prev,
      [currentAmbito]: {
        ...prev[currentAmbito],
        operatorId: newOpId,
      },
    }));
  };

  // Set backup operator for current Ambito
  const handleSetBackup = (newBackupId: string) => {
    setAssignments((prev) => ({
      ...prev,
      [currentAmbito]: {
        ...prev[currentAmbito],
        backupOperatorId: newBackupId || undefined,
      },
    }));
  };

  // Update override for a single day in current Ambito
  const handleSetDayOperator = (dateStr: string, newOpId: string, reason?: string) => {
    const curOverrides = { ...(activeAssignment.dailyOverrides || {}) };
    if (newOpId === activeAssignment.operatorId) {
      delete curOverrides[dateStr];
    } else {
      curOverrides[dateStr] = {
        operatorId: newOpId,
        reason: reason || curOverrides[dateStr]?.reason || 'Sostituzione per malattia',
      };
    }

    setAssignments((prev) => ({
      ...prev,
      [currentAmbito]: {
        ...prev[currentAmbito],
        dailyOverrides: Object.keys(curOverrides).length > 0 ? curOverrides : undefined,
      },
    }));
  };

  const handleSetDayReason = (dateStr: string, reason: string) => {
    const curOverrides = { ...(activeAssignment.dailyOverrides || {}) };
    if (curOverrides[dateStr]) {
      curOverrides[dateStr] = {
        ...curOverrides[dateStr],
        reason,
      };
      setAssignments((prev) => ({
        ...prev,
        [currentAmbito]: {
          ...prev[currentAmbito],
          dailyOverrides: curOverrides,
        },
      }));
    }
  };

  // Quick 3-person split in current Ambito
  const handleApply3PersonSplit = () => {
    const ambOps = ambitoOperators.length >= 3 ? ambitoOperators : operators;
    if (ambOps.length < 3 || shiftDays.length < 3) return;
    const op1 = activeAssignment.operatorId || ambOps[0].id;
    const op2 = ambOps.find((o) => o.id !== op1)?.id || ambOps[1].id;
    const op3 = ambOps.find((o) => o.id !== op1 && o.id !== op2)?.id || ambOps[2].id;

    const newOverrides: Record<string, DailyOverride> = {};
    shiftDays.forEach((day, idx) => {
      if (idx === 0) {
        // Day 1: Op 1
      } else if (idx === 1 || idx === 2) {
        newOverrides[day.dateStr] = {
          operatorId: op2,
          reason: 'Malattia titolare (copertura gg 2-3)',
        };
      } else {
        newOverrides[day.dateStr] = {
          operatorId: op3,
          reason: 'Sostituzione (completamento turno gg rimanenti)',
        };
      }
    });

    setAssignments((prev) => ({
      ...prev,
      [currentAmbito]: {
        ...prev[currentAmbito],
        dailyOverrides: newOverrides,
      },
    }));
  };

  const handleResetOverrides = () => {
    setAssignments((prev) => ({
      ...prev,
      [currentAmbito]: {
        ...prev[currentAmbito],
        dailyOverrides: undefined,
      },
    }));
  };

  const currentOverrides = activeAssignment.dailyOverrides || {};
  const hasOverrides = Object.keys(currentOverrides).length > 0;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveShift({
      ...shift,
      operatorId: assignments.SOR?.operatorId || shift.operatorId,
      backupOperatorId: assignments.SOR?.backupOperatorId,
      dailyOverrides: assignments.SOR?.dailyOverrides,
      assignments,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const ambitiList: AmbitoType[] = ['SOR', 'CF', 'VAL', 'CT', 'LV'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Gestione Turno #{shift.shiftNumber} & Variazioni per Ambito
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              {formatShortDate(shift.startDate)} ore 09:00 → {formatShortDate(shift.endDate)} ore 09:00 ({shift.durationDays} giorni)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ambito Switcher Tabs */}
        <div className="flex items-center gap-1.5 pt-4 pb-2 border-b border-slate-200 overflow-x-auto">
          {ambitiList.map((amb) => {
            const isSel = currentAmbito === amb;
            const asg = assignments[amb];
            const op = asg ? opMap.get(asg.operatorId) : null;
            return (
              <button
                key={amb}
                type="button"
                onClick={() => setCurrentAmbito(amb)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  isSel
                    ? 'bg-red-800 text-white shadow-xs'
                    : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{amb}</span>
                <span className="text-[10px] font-normal opacity-90 truncate max-w-[120px]">
                  {op?.name.split(' ')[0] || '—'}
                </span>
                {asg?.dailyOverrides && Object.keys(asg.dailyOverrides).length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                )}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSave} className="space-y-4 pt-4 text-xs">
          {/* Ambito Info Banner */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-red-800" />
              <div>
                <span className="font-bold text-slate-900">
                  Ambito {AMBITI[currentAmbito].code} — {AMBITI[currentAmbito].fullName}
                </span>
                <p className="text-[11px] text-slate-500">
                  Configura il reperibile titolare e le eventuali sostituzioni interne per questo ambito.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
              {shift.durationDays} gg
            </span>
          </div>

          {/* Primary Operator Assignment for current Ambito */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reperibile Titolare in {currentAmbito} *
              </label>
              <select
                value={activeAssignment.operatorId}
                onChange={(e) => handleSetTitular(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white font-bold focus:outline-hidden focus:ring-2 focus:ring-red-500 cursor-pointer"
              >
                {ambitoOperators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name} ({op.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Riserva / Secondo Reperibile {currentAmbito}
              </label>
              <select
                value={activeAssignment.backupOperatorId || ''}
                onChange={(e) => handleSetBackup(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500 cursor-pointer"
              >
                <option value="">Nessuna riserva assegnata</option>
                {ambitoOperators
                  .filter((op) => op.id !== activeAssignment.operatorId)
                  .map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Sickness / Subdivision Panel for current Ambito */}
          <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-200/80">
              <div>
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-amber-700" />
                  <span>Frazionamento del Turno in {currentAmbito} (es. Malattia / Sostituzioni)</span>
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Assegna singoli giorni a reperibili diversi se il titolare è indisponibile
                </p>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleApply3PersonSplit}
                  className="px-2.5 py-1 text-[11px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md transition-colors cursor-pointer"
                >
                  Fraziona a 3 persone
                </button>
                {hasOverrides && (
                  <button
                    type="button"
                    onClick={handleResetOverrides}
                    className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    Azzera variazioni
                  </button>
                )}
              </div>
            </div>

            {/* Day-by-day override list */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {shiftDays.map((day) => {
                const override = currentOverrides[day.dateStr];
                const isOverridden = !!override;
                const effectiveOpId = override?.operatorId || activeAssignment.operatorId;
                const currentReason = override?.reason || '';

                return (
                  <div
                    key={day.dateStr}
                    className={`p-2 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                      isOverridden
                        ? 'border-amber-300 bg-amber-50/90'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="min-w-44">
                      <span className="font-semibold text-slate-800">{day.label}</span>
                      {isOverridden && (
                        <span className="ml-2 text-[10px] font-bold text-amber-800 bg-amber-200/80 px-1.5 py-0.2 rounded">
                          Sostituzione
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-1">
                      <select
                        value={effectiveOpId}
                        onChange={(e) => handleSetDayOperator(day.dateStr, e.target.value)}
                        className={`text-xs px-2.5 py-1.5 rounded-md border font-medium cursor-pointer ${
                          isOverridden
                            ? 'border-amber-400 bg-amber-100/60 text-amber-950 font-bold'
                            : 'border-slate-200 bg-white text-slate-800'
                        }`}
                      >
                        {ambitoOperators.map((op) => (
                          <option key={op.id} value={op.id}>
                            {op.name} {op.id === activeAssignment.operatorId ? '(Titolare)' : ''}
                          </option>
                        ))}
                      </select>

                      {isOverridden && (
                        <input
                          type="text"
                          value={currentReason}
                          onChange={(e) => handleSetDayReason(day.dateStr, e.target.value)}
                          placeholder="Motivo (es. Malattia del titolare)"
                          className="flex-1 text-xs px-2.5 py-1.5 border border-amber-300 rounded-md bg-white text-slate-800"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Note operative</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Es. Turno frazionato causa indisponibilità per malattia..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Salva Turno e Variazioni
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
