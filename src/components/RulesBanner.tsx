import React from 'react';
import { Calendar, Clock, ShieldCheck, AlertCircle, Info } from 'lucide-react';

interface RulesBannerProps {
  isValid: boolean;
  violationsCount: number;
  totalShifts: number;
  activeOperatorsCount: number;
}

export const RulesBanner: React.FC<RulesBannerProps> = ({
  isValid,
  violationsCount,
  totalShifts,
  activeOperatorsCount,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Rules summary items */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0 mt-0.5">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">Periodo Programmato</p>
              <p className="text-xs text-slate-500 mt-0.5">
                5 Gen 2027 (09:00) → 1 Feb 2028 (09:00)
              </p>
              <p className="text-[11px] text-slate-400">13 mesi coperti integralmente</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">Cambio Turno Feriale</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Ore 09:00 · Lunedì – Venerdì
              </p>
              <p className="text-[11px] text-slate-400">Esclusi sabati, domeniche e festivi</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">Limite 6 Giornate</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Max 6 giorni per turno e per mese
              </p>
              <p className="text-[11px] text-slate-400">Nessun operatore eccede 6 gg/mese</p>
            </div>
          </div>
        </div>

        {/* Verification Status Badge */}
        <div className="flex items-center gap-3 lg:border-l lg:border-slate-200 lg:pl-6 shrink-0">
          {isValid ? (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold leading-tight">100% Conforme ai Vincoli</p>
                <p className="text-[11px] text-emerald-700">
                  {totalShifts} turni · {activeOperatorsCount} reperibili attivi
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-rose-50 text-rose-800 rounded-lg border border-rose-200">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <p className="text-xs font-bold leading-tight">{violationsCount} Violazione/i rilevata/e</p>
                <p className="text-[11px] text-rose-700">Verifica i carichi mensili nella matrice</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
