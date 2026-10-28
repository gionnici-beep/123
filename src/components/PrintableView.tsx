import React from 'react';
import { Operator, Shift } from '../types';
import { formatItalianDate, formatShortDate } from '../utils/shiftLogic';

interface PrintableViewProps {
  shifts: Shift[];
  operators: Operator[];
}

export const PrintableView: React.FC<PrintableViewProps> = ({ shifts, operators }) => {
  const opMap = new Map(operators.map((o) => [o.id, o]));

  return (
    <div className="hidden print:block p-8 bg-white text-black font-sans text-xs">
      <div className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-xl font-bold uppercase tracking-wide">
          Piano Turnazioni Servizio di Reperibilità H24
        </h1>
        <p className="text-sm text-slate-700 mt-1">
          Periodo di validità: <strong>5 Gennaio 2027 (ore 09:00) – 31 Gennaio 2028 (ore 09:00)</strong>
        </p>
        <div className="mt-2 text-xs text-slate-600 flex gap-6">
          <span><strong>Cambio turno:</strong> Feriale alle ore 09:00</span>
          <span><strong>Vincolo:</strong> Massimo 6 giornate mensili per operatore</span>
          <span><strong>Organico:</strong> {operators.length} reperibili</span>
        </div>
      </div>

      <table className="w-full border-collapse border border-slate-300 text-[10px] mb-8">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-300 text-left font-bold">
            <th className="p-1.5 border border-slate-300 w-12 text-center">N°</th>
            <th className="p-1.5 border border-slate-300">Inizio (ore 09:00 feriale)</th>
            <th className="p-1.5 border border-slate-300">Fine / Cambio (ore 09:00 feriale)</th>
            <th className="p-1.5 border border-slate-300 text-center w-16">Durata</th>
            <th className="p-1.5 border border-slate-300">Reperibile Titolare</th>
            <th className="p-1.5 border border-slate-300">Recapito Emergenza</th>
            <th className="p-1.5 border border-slate-300">Sostituto</th>
            <th className="p-1.5 border border-slate-300">Festivi / Note</th>
          </tr>
        </thead>
        <tbody>
          {shifts.map((s) => {
            const op = opMap.get(s.operatorId);
            const backup = s.backupOperatorId ? opMap.get(s.backupOperatorId) : null;

            return (
              <tr key={s.id} className="border-b border-slate-200">
                <td className="p-1 border border-slate-300 text-center font-mono">
                  #{s.shiftNumber}
                </td>
                <td className="p-1 border border-slate-300 font-medium">
                  {formatShortDate(s.startDate)} ({formatItalianDate(s.startDate).split(' ')[0]})
                </td>
                <td className="p-1 border border-slate-300 font-medium">
                  {formatShortDate(s.endDate)} ({formatItalianDate(s.endDate).split(' ')[0]})
                </td>
                <td className="p-1 border border-slate-300 text-center font-mono font-bold">
                  {s.durationDays} gg
                </td>
                <td className="p-1 border border-slate-300 font-bold">
                  {op?.name || 'N/D'}
                </td>
                <td className="p-1 border border-slate-300 font-mono">
                  {op?.phone || ''}
                </td>
                <td className="p-1 border border-slate-300">
                  {backup?.name || '—'}
                </td>
                <td className="p-1 border border-slate-300 text-slate-600">
                  {s.holidayNames.join(', ') || (s.isWeekendShift ? 'Weekend' : '')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Signatures block */}
      <div className="grid grid-cols-2 gap-12 mt-12 pt-8 border-t border-slate-300 text-xs">
        <div>
          <p className="font-bold text-slate-700">Il Responsabile del Servizio Tecnico</p>
          <div className="mt-8 border-b border-dashed border-slate-400 w-48"></div>
          <p className="text-[10px] text-slate-500 mt-1">Firma e Timbro</p>
        </div>
        <div>
          <p className="font-bold text-slate-700">Per Presa Visione ed Accettazione Operatori</p>
          <div className="mt-8 border-b border-dashed border-slate-400 w-48"></div>
          <p className="text-[10px] text-slate-500 mt-1">Firma Rappresentante Reperibili</p>
        </div>
      </div>
    </div>
  );
};
