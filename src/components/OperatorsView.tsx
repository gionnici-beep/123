import React, { useState, useRef } from 'react';
import {
  UserPlus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Layers,
  Sparkles,
  Download,
  Upload,
  FileSpreadsheet,
  FileJson,
  FileDown,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Operator, Shift, AmbitoType, AMBITI } from '../types';

interface OperatorsViewProps {
  operators: Operator[];
  shifts: Shift[];
  onAddOperator: (newOp: Omit<Operator, 'id'>) => void;
  onUpdateOperator: (op: Operator) => void;
  onDeleteOperator: (id: string) => void;
  onBulkSetOperators?: (newOps: Operator[]) => void;
}

// Helpers for CSV parsing and formatting
function parseCSVLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delim && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseOperatorsCSV(text: string): Partial<Operator>[] {
  const clean = text.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  const delim = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';

  const headers = parseCSVLine(firstLine, delim).map((h) => h.toLowerCase().trim());
  const nameIdx = headers.findIndex((h) => h.includes('nome') || h.includes('name'));
  const roleIdx = headers.findIndex((h) => h.includes('ruolo') || h.includes('role') || h.includes('qualifica'));
  const ambIdx = headers.findIndex((h) => h.includes('ambito') || h.includes('settore') || h.includes('area'));
  const emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('mail'));
  const phoneIdx = headers.findIndex((h) => h.includes('tel') || h.includes('phone') || h.includes('cell'));
  const activeIdx = headers.findIndex((h) => h.includes('attivo') || h.includes('active') || h.includes('stato'));
  const maxDaysIdx = headers.findIndex((h) => h.includes('max') || h.includes('giorni') || h.includes('tetto'));

  const parsed: Partial<Operator>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], delim);
    const rawName = nameIdx >= 0 ? cols[nameIdx]?.trim() : cols[0]?.trim();
    if (!rawName) continue;

    const rawRole = roleIdx >= 0 ? cols[roleIdx]?.trim() : '';
    let rawAmb = ambIdx >= 0 ? cols[ambIdx]?.trim().toUpperCase() : 'SOR';
    const validAmbiti: AmbitoType[] = ['SOR', 'CF', 'VAL', 'CT', 'LV'];
    if (!validAmbiti.includes(rawAmb as AmbitoType)) {
      rawAmb = 'SOR';
    }

    const rawEmail = emailIdx >= 0 ? cols[emailIdx]?.trim() : '';
    const rawPhone = phoneIdx >= 0 ? cols[phoneIdx]?.trim() : '';
    const rawActive = activeIdx >= 0 ? cols[activeIdx]?.trim().toLowerCase() : 'true';
    const isActive = rawActive === 'true' || rawActive === 'si' || rawActive === 'sì' || rawActive === '1' || rawActive === 'attivo';
    const maxDays = maxDaysIdx >= 0 ? parseInt(cols[maxDaysIdx], 10) || 6 : 6;

    parsed.push({
      name: rawName,
      role: rawRole || `Operatore ${rawAmb}`,
      ambito: rawAmb as AmbitoType,
      email: rawEmail || `${rawName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@protezionecivile.umbria.it`,
      phone: rawPhone || '+39 3',
      active: isActive,
      maxDaysPerMonth: maxDays,
    });
  }

  return parsed;
}

const AMBITO_COLORS: Record<AmbitoType, string> = {
  SOR: '#2563eb',
  CF: '#d97706',
  VAL: '#ea580c',
  CT: '#0284c7',
  LV: '#059669',
};

export const OperatorsView: React.FC<OperatorsViewProps> = ({
  operators,
  shifts,
  onAddOperator,
  onUpdateOperator,
  onDeleteOperator,
  onBulkSetOperators,
}) => {
  const [selectedAmbito, setSelectedAmbito] = useState<'ALL' | AmbitoType>('SOR');
  const [isEditing, setIsEditing] = useState(false);
  const [currentEditOp, setCurrentEditOp] = useState<Operator | null>(null);

  // Import / Export state
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importedPreview, setImportedPreview] = useState<Partial<Operator>[] | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importFileName, setImportFileName] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [ambito, setAmbito] = useState<AmbitoType>('SOR');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [maxDaysPerMonth, setMaxDaysPerMonth] = useState(6);
  const [active, setActive] = useState(true);

  const filteredOperators = operators.filter(
    (op) => selectedAmbito === 'ALL' || (op.ambito || 'SOR') === selectedAmbito
  );

  const getAmbitoStats = (amb: AmbitoType) => {
    const list = operators.filter((o) => (o.ambito || 'SOR') === amb);
    const active = list.filter((o) => o.active);
    return {
      total: list.length,
      active: active.length,
      hasMinimum: active.length >= 6,
    };
  };

  const handleOpenAdd = (targetAmbito?: AmbitoType) => {
    const defaultAmb = targetAmbito || (selectedAmbito === 'ALL' ? 'SOR' : selectedAmbito);
    setCurrentEditOp(null);
    setName('');
    setRole(
      defaultAmb === 'SOR'
        ? 'Tecnico Sala Operativa SOR'
        : defaultAmb === 'CF'
        ? 'Meteorologo / Idrologo CF'
        : defaultAmb === 'VAL'
        ? 'Ingegnere / Geologo Rilievo Danno VAL'
        : defaultAmb === 'CT'
        ? 'Tecnico Controllo Territoriale CT'
        : 'Coordinatore Logistica & Mezzi LV'
    );
    setAmbito(defaultAmb);
    setEmail('');
    setPhone('+39 3');
    setColor(
      defaultAmb === 'SOR'
        ? '#2563eb'
        : defaultAmb === 'CF'
        ? '#d97706'
        : defaultAmb === 'VAL'
        ? '#ea580c'
        : defaultAmb === 'CT'
        ? '#0284c7'
        : '#059669'
    );
    setMaxDaysPerMonth(6);
    setActive(true);
    setIsEditing(true);
  };

  const handleOpenEdit = (op: Operator) => {
    setCurrentEditOp(op);
    setName(op.name);
    setRole(op.role);
    setAmbito(op.ambito || 'SOR');
    setEmail(op.email);
    setPhone(op.phone);
    setColor(op.color);
    setMaxDaysPerMonth(op.maxDaysPerMonth);
    setActive(op.active);
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (currentEditOp) {
      onUpdateOperator({
        ...currentEditOp,
        name,
        role,
        ambito,
        email,
        phone,
        color,
        maxDaysPerMonth: Number(maxDaysPerMonth) || 6,
        active,
      });
    } else {
      onAddOperator({
        name,
        role,
        ambito,
        email,
        phone,
        color,
        bgColor: `${color}15`,
        textColor: color,
        maxDaysPerMonth: Number(maxDaysPerMonth) || 6,
        active,
      });
    }
    setIsEditing(false);
  };

  // Export handlers
  const handleExportCSV = () => {
    const headers = ['Nome', 'Ruolo', 'Ambito', 'Email', 'Telefono', 'MaxGiorniMese', 'Attivo'];
    const rows = operators.map((o) => [
      `"${o.name.replace(/"/g, '""')}"`,
      `"${o.role.replace(/"/g, '""')}"`,
      `"${o.ambito || 'SOR'}"`,
      `"${o.email}"`,
      `"${o.phone}"`,
      o.maxDaysPerMonth,
      o.active ? 'Sì' : 'No',
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Reperibili_Protezione_Civile_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
    setNotificationMsg('Dati reperibili esportati con successo in CSV!');
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(operators, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Reperibili_Protezione_Civile_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
    setNotificationMsg('Dati reperibili esportati con successo in JSON!');
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  // Import handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        if (file.name.endsWith('.json') || content.trim().startsWith('[')) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setImportedPreview(parsed);
            setIsImportModalOpen(true);
          } else {
            setImportError('Il file JSON non contiene un array valido di reperibili.');
          }
        } else {
          // Parse CSV
          const parsed = parseOperatorsCSV(content);
          if (parsed.length > 0) {
            setImportedPreview(parsed);
            setIsImportModalOpen(true);
          } else {
            setImportError('Nessun record valido trovato nel file CSV. Assicurarsi che ci sia una riga di intestazione (Nome, Ruolo, Ambito, Email, Telefono).');
          }
        }
      } catch (err: any) {
        setImportError(`Errore durante la lettura del file: ${err.message || 'formato non supportato'}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImport = () => {
    if (!importedPreview || importedPreview.length === 0) return;

    const validAmbiti: AmbitoType[] = ['SOR', 'CF', 'VAL', 'CT', 'LV'];
    const formatted: Operator[] = importedPreview.map((item, idx) => {
      const amb: AmbitoType = validAmbiti.includes(item.ambito as AmbitoType) ? (item.ambito as AmbitoType) : 'SOR';
      const c = AMBITO_COLORS[amb] || '#2563eb';
      return {
        id: item.id || `op-${Date.now()}-${idx}`,
        name: item.name || `Operatore ${idx + 1}`,
        role: item.role || `Operatore ${amb}`,
        ambito: amb,
        email: item.email || `${item.name?.toLowerCase().replace(/[^a-z0-9]/g, '.') || 'operatore'}@protezionecivile.umbria.it`,
        phone: item.phone || '+39 3',
        color: item.color || c,
        bgColor: item.bgColor || `${c}15`,
        textColor: item.textColor || c,
        active: item.active !== undefined ? Boolean(item.active) : true,
        maxDaysPerMonth: item.maxDaysPerMonth || 6,
      };
    });

    if (importMode === 'replace') {
      if (onBulkSetOperators) {
        onBulkSetOperators(formatted);
      } else {
        formatted.forEach((op) => onAddOperator(op));
      }
      setNotificationMsg(`Importazione completata: ${formatted.length} reperibili caricati.`);
    } else {
      // Merge mode
      if (onBulkSetOperators) {
        const existingNames = new Set(operators.map((o) => o.name.toLowerCase().trim()));
        const toAdd = formatted.filter((f) => !existingNames.has(f.name.toLowerCase().trim()));
        onBulkSetOperators([...operators, ...toAdd]);
        setNotificationMsg(`Importazione completata: ${toAdd.length} nuovi reperibili aggiunti all'organico esistente.`);
      } else {
        formatted.forEach((op) => onAddOperator(op));
        setNotificationMsg(`Importazione completata: ${formatted.length} reperibili inseriti.`);
      }
    }

    setIsImportModalOpen(false);
    setImportedPreview(null);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const ambitiList: AmbitoType[] = ['SOR', 'CF', 'VAL', 'CT', 'LV'];

  return (
    <div className="space-y-6">
      {/* Hidden File Input for CSV/JSON Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Notification Toast */}
      {notificationMsg && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-md text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notificationMsg}</span>
          </div>
          <button onClick={() => setNotificationMsg(null)} className="text-white/80 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Header and Add / Import / Export buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
              <Layers className="w-5 h-5" />
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Organico Reperibili per Ambito di Protezione Civile
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestione squadre per i 5 Ambiti: <strong>SOR</strong>, <strong>CF</strong>, <strong>VAL</strong>, <strong>CT</strong>, <strong>LV</strong> · Minimo 6 reperibili per ambito · Tetto max 6 giorni mensili
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Import Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="Importa reperibili da file CSV o JSON"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Importa</span>
          </button>

          {/* Export Dropdown / Menu */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="Esporta elenco reperibili"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Esporta</span>
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={handleExportCSV}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Esporta CSV (Excel)</span>
                </button>
                <button
                  onClick={handleExportJSON}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <FileJson className="w-4 h-4 text-blue-600" />
                  <span>Esporta JSON</span>
                </button>
              </div>
            )}
          </div>

          {/* Add Operator Button */}
          <button
            onClick={() => handleOpenAdd()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Aggiungi Reperibile</span>
          </button>
        </div>
      </div>

      {/* Ambito Navigation Tabs */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        <button
          onClick={() => setSelectedAmbito('ALL')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            selectedAmbito === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Tutti gli Ambiti</span>
          <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
            {operators.length}
          </span>
        </button>

        {ambitiList.map((ambKey) => {
          const cfg = AMBITI[ambKey];
          const stats = getAmbitoStats(ambKey);
          const isSelected = selectedAmbito === ambKey;

          return (
            <button
              key={ambKey}
              onClick={() => setSelectedAmbito(ambKey)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{cfg.code}</span>
              <span className="text-[11px] font-normal opacity-90 hidden sm:inline">
                ({cfg.fullName})
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isSelected
                    ? 'bg-blue-700 text-white'
                    : stats.hasMinimum
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {stats.active} rep.
              </span>
            </button>
          );
        })}
      </div>

      {/* Ambito Description Card */}
      {selectedAmbito !== 'ALL' && (
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 text-xs text-blue-900 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-blue-950">
                  Ambito {AMBITI[selectedAmbito].code} — {AMBITI[selectedAmbito].fullName}
                </h3>
                {getAmbitoStats(selectedAmbito).hasMinimum ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Minimo 6 Reperibili Rispettato</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Richiesti almeno 6 reperibili</span>
                  </span>
                )}
              </div>
              <p className="text-blue-800 leading-relaxed">
                {AMBITI[selectedAmbito].description}. In rotazione alfabetica continua (A-Z) con cambio turno nei giorni feriali alle ore 09:00 e tetto massimo di 6 giorni al mese per ciascun operatore.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenAdd(selectedAmbito)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-300 hover:bg-blue-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Nuovo in {selectedAmbito}</span>
          </button>
        </div>
      )}

      {/* Operators Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOperators.map((op) => {
          const assignedShifts = shifts.filter((s) => {
            if (s.assignments && op.ambito) {
              return s.assignments[op.ambito]?.operatorId === op.id;
            }
            return s.operatorId === op.id;
          });

          const opAmbito = op.ambito || 'SOR';
          const cfg = AMBITI[opAmbito];

          return (
            <div
              key={op.id}
              className={`bg-white rounded-xl border p-4 shadow-xs flex flex-col justify-between transition-all ${
                op.active ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200 opacity-60 bg-slate-50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-xs"
                      style={{ backgroundColor: op.color }}
                    >
                      {op.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{op.name}</h3>
                      <p className="text-xs text-slate-500">{op.role}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                      {opAmbito}
                    </span>
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full ${
                        op.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {op.active ? 'Attivo' : 'Inattivo'}
                    </span>
                  </div>
                </div>

                {/* Contact details */}
                <div className="space-y-1.5 text-xs text-slate-600 my-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <a
                      href={`tel:${op.phone}`}
                      className="hover:text-blue-600 font-mono text-slate-700"
                    >
                      {op.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate text-slate-600">{op.email}</span>
                  </div>
                </div>

                {/* Duty metrics */}
                <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-slate-50 text-[11px] text-slate-600 font-medium">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Turni assegnati</span>
                    <span className="font-mono font-bold text-slate-900">{assignedShifts.length}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Tetto mensile</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {op.maxDaysPerMonth} gg/mese
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions footer */}
              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleOpenEdit(op)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Modifica</span>
                </button>
                {operators.length > 2 && (
                  <button
                    onClick={() => onDeleteOperator(op.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Rimuovi</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Add Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              <span>{currentEditOp ? 'Modifica Reperibile' : 'Nuovo Reperibile'}</span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ambito di Competenza *
                </label>
                <select
                  value={ambito}
                  onChange={(e) => setAmbito(e.target.value as AmbitoType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {ambitiList.map((a) => (
                    <option key={a} value={a}>
                      {a} — {AMBITI[a].fullName}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Ogni ambito gestisce una propria rotazione di almeno 6 reperibili
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome e Cognome *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Es. Mario Rossi"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ruolo Tecnico & Specialità</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Es. Ingegnere Strutturista Rilievo Danno"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefono H24 *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+39 3xx xxx xxxx"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Istituzionale</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@regione.umbria.it"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Max Giorni / Mese
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={maxDaysPerMonth}
                    onChange={(e) => setMaxDaysPerMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Tetto massimo: 6 giorni</p>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Colore Badge</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-10 h-9 p-0.5 border border-slate-200 rounded-md cursor-pointer"
                    />
                    <span className="font-mono text-slate-600">{color}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeOp"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="activeOp" className="font-medium text-slate-700 cursor-pointer">
                  Attivo nella pianificazione automatica dei turni
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {currentEditOp ? 'Salva Modifiche' : 'Aggiungi Reperibile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {isImportModalOpen && importedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Upload className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Anteprima Importazione Reperibili
                  </h3>
                  <p className="text-xs text-slate-500">
                    File: <strong>{importFileName}</strong> · {importedPreview.length} record rilevati
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportedPreview(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Import Mode Options */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
              <span className="font-semibold text-slate-800 block">Modalità di importazione:</span>
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="text-blue-600"
                  />
                  <span>
                    <strong>Unisci (Merge)</strong>: aggiunge solo i nominativi non ancora presenti
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="text-red-600"
                  />
                  <span>
                    <strong className="text-rose-700">Sostituisci Tutto</strong>: sovrascrive l'intero organico
                  </span>
                </label>
              </div>
            </div>

            {/* Preview table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Nome</th>
                    <th className="py-2 px-3">Ambito</th>
                    <th className="py-2 px-3">Ruolo</th>
                    <th className="py-2 px-3">Telefono</th>
                    <th className="py-2 px-3">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importedPreview.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-900">{item.name || '—'}</td>
                      <td className="py-2 px-3 font-mono font-bold text-blue-700">{item.ambito || 'SOR'}</td>
                      <td className="py-2 px-3 text-slate-600">{item.role || '—'}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{item.phone || '—'}</td>
                      <td className="py-2 px-3 text-slate-600">{item.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportedPreview(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Conferma e Importa ({importedPreview.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
