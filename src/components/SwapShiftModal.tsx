import React, { useState } from 'react';
import { X, ArrowRightLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Operator, Shift } from '../types';
import { formatItalianDate, formatShortDate, calculateShiftDaysInMonth } from '../utils/shiftLogic';

interface SwapShiftModalProps {
  sourceShift: Shift;
  allShifts: Shift[];
  operators: Operator[];
  onClose: () => void;
  onConfirmSwap: (shiftAId: string, shiftBId: string) => void;
}

export const SwapShiftModal: React.FC<SwapShiftModalProps> = ({
  sourceShift,
  allShifts,
  operators,
  onClose,
  onConfirmSwap,
}) => {
  const [selectedTargetShiftId, setSelectedTargetShiftId] = useState<string>('');

  const opMap = new Map(operators.map((o) => [o.id, o]));
  const sourceOp = opMap.get(sourceShift.operatorId);

  // Eligible target shifts: shifts assigned to different operators
  const eligibleTargetShifts = allShifts.filter(
    (s) => s.id !== sourceShift.id && s.operatorId !== sourceShift.operatorId
  );

  const selectedTargetShift = allShifts.find((s) => s.id === selectedTargetShiftId);
  const targetOp = selectedTargetShift ? opMap.get(selectedTargetShift.operatorId) : null;

  const handleConfirm = () => {
    if (!selectedTargetShiftId) return;
    onConfirmSwap(sourceShift.id, selectedTargetShiftId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-600" />
              <span>Scambio Turno di Reperibilità</span>
            </h3>
            <p className="text-xs text-slate-500">
              Scambia la titolarità di due turni verificando i carichi di lavoro
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 pt-4 text-xs">
          {/* Source Shift Card */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Turno di Partenza (Turno #{sourceShift.shiftNumber})
            </span>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">{sourceOp?.name}</p>
                <p className="text-[11px] text-slate-500">
                  {formatShortDate(sourceShift.startDate)} → {formatShortDate(sourceShift.endDate)} ({sourceShift.durationDays} gg)
                </p>
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                {sourceShift.durationDays} giorni
              </span>
            </div>
          </div>

          {/* Select Target Shift */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Seleziona il turno con cui effettuare lo scambio:
            </label>
            <select
              value={selectedTargetShiftId}
              onChange={(e) => setSelectedTargetShiftId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Seleziona un turno tra quelli disponibili --</option>
              {eligibleTargetShifts.map((s) => {
                const op = opMap.get(s.operatorId);
                return (
                  <option key={s.id} value={s.id}>
                    Turno #{s.shiftNumber} ({formatShortDate(s.startDate)} - {s.durationDays} gg) — {op?.name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Selected Target Shift Details */}
          {selectedTargetShift && targetOp && (
            <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                Turno Destinatario (Turno #{selectedTargetShift.shiftNumber})
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{targetOp.name}</p>
                  <p className="text-[11px] text-slate-600">
                    {formatShortDate(selectedTargetShift.startDate)} → {formatShortDate(selectedTargetShift.endDate)} ({selectedTargetShift.durationDays} gg)
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  {selectedTargetShift.durationDays} giorni
                </span>
              </div>

              <div className="pt-2 border-t border-emerald-200/60 flex items-center gap-1.5 text-[11px] text-emerald-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  Dopo lo scambio, <strong>{targetOp.name}</strong> subentrerà nel Turno #{sourceShift.shiftNumber} e{' '}
                  <strong>{sourceOp?.name}</strong> assumerà il Turno #{selectedTargetShift.shiftNumber}.
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={!selectedTargetShiftId}
              onClick={handleConfirm}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 rounded-lg shadow-xs transition-colors"
            >
              Conferma Scambio Turno
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
