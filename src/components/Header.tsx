import React from 'react';
import { Calendar, Users, List, BarChart3, Download, RefreshCw, FileText, Sparkles, Bell } from 'lucide-react';

interface HeaderProps {
  activeTab: 'excel' | 'calendar' | 'table' | 'matrix' | 'operators' | 'report' | 'notifications';
  setActiveTab: (tab: 'excel' | 'calendar' | 'table' | 'matrix' | 'operators' | 'report' | 'notifications') => void;
  onOpenExport: () => void;
  onOpenHolidays: () => void;
  onRegenerate: () => void;
  totalShifts: number;
  dueNotificationsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenExport,
  onOpenHolidays,
  onRegenerate,
  totalShifts,
  dueNotificationsCount = 0,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          {/* Zone 1: Single text wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              TR
            </div>
            <div>
              <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
                Turni Reperibilità
              </span>
              <span className="hidden xl:inline-block ml-2 text-xs font-mono text-slate-500 tabular-nums">
                2027–2028 · Dal 5 Gen (Ciccotti)
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links / Segmented Tabs */}
          <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1">
            <button
              onClick={() => setActiveTab('excel')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'excel'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-emerald-300" />
              <span>Foglio Excel (Colonna)</span>
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'report'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4 text-blue-300" />
              <span>Report Dirigenti</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap relative ${
                activeTab === 'notifications'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Bell className="w-4 h-4 text-rose-300" />
              <span>Notifiche 48h</span>
              {dueNotificationsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-black rounded-full bg-amber-400 text-slate-950">
                  {dueNotificationsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'calendar'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Calendario Mensile</span>
            </button>

            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'table'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Elenco Turni</span>
            </button>

            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'matrix'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Matrice 6 gg</span>
            </button>

            <button
              onClick={() => setActiveTab('operators')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'operators'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Reperibili (A-Z)</span>
            </button>
          </nav>

          {/* Zone 3: Primary Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenHolidays}
              title="Aggiungi Santo Patrono e gestisci festività locali"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span className="hidden sm:inline">Santo Patrono</span>
            </button>

            <button
              onClick={onRegenerate}
              title="Ricalcola turni secondo i vincoli"
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Ricalcola</span>
            </button>

            <button
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Esporta</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
