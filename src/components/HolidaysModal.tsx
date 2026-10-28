import React, { useState } from 'react';
import { X, Plus, Trash2, Calendar, ShieldCheck, MapPin, Sparkles, CheckCircle2 } from 'lucide-react';
import { ItalianHoliday } from '../types';
import { COMMON_PATRON_SAINTS, getItalianHolidays } from '../utils/holidays';
import { formatShortDate } from '../utils/shiftLogic';

interface HolidaysModalProps {
  customHolidays: ItalianHoliday[];
  onAddCustomHoliday: (holiday: ItalianHoliday, applyBothYears: boolean) => void;
  onRemoveCustomHoliday: (date: string) => void;
  onClose: () => void;
}

export const HolidaysModal: React.FC<HolidaysModalProps> = ({
  customHolidays,
  onAddCustomHoliday,
  onRemoveCustomHoliday,
  onClose,
}) => {
  const [selectedPresetCity, setSelectedPresetCity] = useState('');
  const [customName, setCustomName] = useState('');
  const [customDate, setCustomDate] = useState('2027-06-29'); // default Roma
  const [applyBothYears, setApplyBothYears] = useState(true);

  const national2027 = getItalianHolidays(2027);

  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityName = e.target.value;
    setSelectedPresetCity(cityName);
    if (!cityName) return;

    const preset = COMMON_PATRON_SAINTS.find((p) => p.city === cityName);
    if (preset) {
      const pad = (n: number) => String(n).padStart(2, '0');
      setCustomDate(`2027-${pad(preset.month)}-${pad(preset.day)}`);
      setCustomName(preset.name);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDate || !customName.trim()) return;

    onAddCustomHoliday(
      {
        date: customDate,
        name: customName.trim(),
        isCustom: true,
      },
      applyBothYears
    );

    // Reset input
    setCustomName('');
    setSelectedPresetCity('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-600" />
              <span>Gestione Festività & Santo Patrono</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggiungi il Santo Patrono della tua sede per escluderlo dai cambi turno feriali
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
          {/* Add Patron / Holiday form */}
          <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl space-y-3">
            <h4 className="font-bold text-sky-950 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-sky-700" />
              <span>Aggiungi Santo Patrono o Nuova Festività Locale</span>
            </h4>

            {/* Quick preset selector */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Seleziona Santo Patrono da città predefinita (opzionale):
              </label>
              <select
                value={selectedPresetCity}
                onChange={handleSelectPreset}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value="">-- Seleziona una città (es. Roma, Milano, Napoli...) o inserisci manualmente --</option>
                {COMMON_PATRON_SAINTS.map((p) => (
                  <option key={p.city} value={p.city}>
                    {p.city} — {p.name} ({String(p.day).padStart(2, '0')}/{String(p.month).padStart(2, '0')})
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Data Festività *
                  </label>
                  <input
                    type="date"
                    required
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nome della Festività *
                  </label>
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Es. Santo Patrono (SS. Pietro e Paolo)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={applyBothYears}
                    onChange={(e) => setApplyBothYears(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                  />
                  <span>Applica automaticamente sia al 2027 che al 2028</span>
                </label>

                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs transition-colors whitespace-nowrap"
                >
                  Aggiungi al Calendario
                </button>
              </div>
            </form>
          </div>

          {/* List of Custom Holidays */}
          <div>
            <h4 className="font-bold text-slate-900 mb-2 flex items-center justify-between">
              <span>Festività e Patroni Personalizzati Aggiunti ({customHolidays.length})</span>
              <span className="text-[11px] font-normal text-slate-500">
                Evidenziati in celeste
              </span>
            </h4>

            {customHolidays.length === 0 ? (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-400 text-center italic">
                Nessun patrono o festività locale personalizzata inserita. Aggiungine una sopra.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {customHolidays.map((h) => (
                  <div
                    key={h.date}
                    className="flex items-center justify-between p-2.5 bg-sky-50/70 border border-sky-200 rounded-lg text-sky-950 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-900 bg-sky-100 px-2 py-0.5 rounded">
                        {formatShortDate(h.date)}
                      </span>
                      <span>{h.name}</span>
                    </div>

                    <button
                      onClick={() => onRemoveCustomHoliday(h.date)}
                      className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors"
                      title="Rimuovi festività"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* National Holidays reference */}
          <div className="pt-2 border-t border-slate-200">
            <h4 className="font-bold text-slate-700 mb-1.5 text-[11px]">
              Festività Nazionali Ufficiali Precaricate (Automatiche):
            </h4>
            <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-600">
              {national2027.map((h) => (
                <span key={h.date} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {formatShortDate(h.date)}: {h.name}
                </span>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2 text-[11px] text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Qualsiasi festività inserita viene considerata non feriale: i cambi turno del calendario eviteranno tale data e la visualizzeranno in celeste.
            </span>
          </div>

          {/* Close button */}
          <div className="flex items-center justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
