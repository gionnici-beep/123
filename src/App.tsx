/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { RulesBanner } from './components/RulesBanner';
import { ExcelColumnView } from './components/ExcelColumnView';
import { MonthlyReportView } from './components/MonthlyReportView';
import { CalendarView } from './components/CalendarView';
import { ShiftsTableView } from './components/ShiftsTableView';
import { MonthlyMatrixView } from './components/MonthlyMatrixView';
import { OperatorsView } from './components/OperatorsView';
import { ShiftDetailModal } from './components/ShiftDetailModal';
import { SwapShiftModal } from './components/SwapShiftModal';
import { ExportModal } from './components/ExportModal';
import { HolidaysModal } from './components/HolidaysModal';
import { PrintableView } from './components/PrintableView';
import { DEFAULT_OPERATORS } from './data/defaultOperators';
import { Operator, Shift, ItalianHoliday } from './types';
import { generateTurniSchedule, validateSchedule } from './utils/shiftLogic';
import { setCustomHolidaysRegistry } from './utils/holidays';

const OPERATORS_STORAGE_KEY = 'turni_reperibilita_operators_v3';
const SHIFTS_STORAGE_KEY = 'turni_reperibilita_shifts_v3';
const HOLIDAYS_STORAGE_KEY = 'turni_reperibilita_holidays_v3';

export default function App() {
  // Initialize custom holidays (e.g. Santo Patrono)
  const [customHolidays, setCustomHolidays] = useState<ItalianHoliday[]>(() => {
    try {
      const saved = localStorage.getItem(HOLIDAYS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load holidays from localStorage', e);
    }
    return [
      { date: '2027-06-29', name: 'Santi Pietro e Paolo (Patrono di Roma)', isCustom: true },
      { date: '2028-06-29', name: 'Santi Pietro e Paolo (Patrono di Roma)', isCustom: true },
    ];
  });

  // Sync custom holidays to registry
  useEffect(() => {
    setCustomHolidaysRegistry(customHolidays);
    try {
      localStorage.setItem(HOLIDAYS_STORAGE_KEY, JSON.stringify(customHolidays));
    } catch (e) {
      console.error('Failed to save holidays', e);
    }
  }, [customHolidays]);

  // Initialize operators from localStorage or default dataset with all 5 Ambiti (SOR, CF, VAL, CT, LV)
  const [operators, setOperators] = useState<Operator[]>(() => {
    try {
      const saved = localStorage.getItem(OPERATORS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 20) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load operators from localStorage', e);
    }
    return DEFAULT_OPERATORS;
  });

  // Initialize shifts
  const [shifts, setShifts] = useState<Shift[]>(() => {
    try {
      const saved = localStorage.getItem(SHIFTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].assignments) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load shifts from localStorage', e);
    }
    return generateTurniSchedule(DEFAULT_OPERATORS);
  });

  // Navigation tab: 'excel' (default) | 'report' | 'calendar' | 'table' | 'matrix' | 'operators'
  const [activeTab, setActiveTab] = useState<'excel' | 'report' | 'calendar' | 'table' | 'matrix' | 'operators'>('excel');

  // Modals state
  const [selectedShiftForDetail, setSelectedShiftForDetail] = useState<Shift | null>(null);
  const [selectedShiftForSwap, setSelectedShiftForSwap] = useState<Shift | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isHolidaysOpen, setIsHolidaysOpen] = useState(false);

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(OPERATORS_STORAGE_KEY, JSON.stringify(operators));
    } catch (e) {
      console.error('Failed to save operators', e);
    }
  }, [operators]);

  useEffect(() => {
    try {
      localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));
    } catch (e) {
      console.error('Failed to save shifts', e);
    }
  }, [shifts]);

  // Real-time validation of current schedule against constraints
  const validationResult = useMemo(() => {
    return validateSchedule(shifts, operators);
  }, [shifts, operators]);

  // Re-generate schedule automatically
  const handleRegenerate = () => {
    const newShifts = generateTurniSchedule(operators);
    setShifts(newShifts);
  };

  // Add new operator
  const handleAddOperator = (newOpData: Omit<Operator, 'id'>) => {
    const newOp: Operator = {
      ...newOpData,
      id: `op-${Date.now()}`,
    };
    const updated = [...operators, newOp];
    setOperators(updated);
  };

  // Update operator
  const handleUpdateOperator = (updatedOp: Operator) => {
    const updated = operators.map((o) => (o.id === updatedOp.id ? updatedOp : o));
    setOperators(updated);
  };

  // Delete operator
  const handleDeleteOperator = (id: string) => {
    if (operators.length <= 2) {
      alert('Non è possibile avere meno di 2 reperibili.');
      return;
    }
    const updated = operators.filter((o) => o.id !== id);
    setOperators(updated);
    const nextAvailable = updated.find((o) => o.active) || updated[0];
    const reassignedShifts = shifts.map((s) => {
      if (s.operatorId === id) {
        return { ...s, operatorId: nextAvailable.id };
      }
      if (s.backupOperatorId === id) {
        return { ...s, backupOperatorId: undefined };
      }
      return s;
    });
    setShifts(reassignedShifts);
  };

  // Save updated shift
  const handleSaveShift = (updatedShift: Shift) => {
    const updated = shifts.map((s) => (s.id === updatedShift.id ? updatedShift : s));
    setShifts(updated);
  };

  // Swap shifts
  const handleConfirmSwap = (shiftAId: string, shiftBId: string) => {
    const shiftA = shifts.find((s) => s.id === shiftAId);
    const shiftB = shifts.find((s) => s.id === shiftBId);
    if (!shiftA || !shiftB) return;

    const opA = shiftA.operatorId;
    const opB = shiftB.operatorId;

    const updated = shifts.map((s) => {
      if (s.id === shiftAId) {
        return { ...s, operatorId: opB };
      }
      if (s.id === shiftBId) {
        return { ...s, operatorId: opA };
      }
      return s;
    });

    setShifts(updated);
  };

  // Add custom holiday (Santo Patrono)
  const handleAddCustomHoliday = (holiday: ItalianHoliday, applyBothYears: boolean) => {
    const newHolidays = [...customHolidays.filter((h) => h.date !== holiday.date), holiday];

    if (applyBothYears) {
      const year = holiday.date.slice(0, 4);
      const otherYear = year === '2027' ? '2028' : '2027';
      const otherDate = `${otherYear}${holiday.date.slice(4)}`;
      if (!newHolidays.some((h) => h.date === otherDate)) {
        newHolidays.push({
          date: otherDate,
          name: holiday.name,
          isCustom: true,
        });
      }
    }

    setCustomHolidays(newHolidays);
    setCustomHolidaysRegistry(newHolidays);
  };

  // Remove custom holiday
  const handleRemoveCustomHoliday = (date: string) => {
    const updated = customHolidays.filter((h) => h.date !== date);
    setCustomHolidays(updated);
    setCustomHolidaysRegistry(updated);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenHolidays={() => setIsHolidaysOpen(true)}
        onRegenerate={handleRegenerate}
        totalShifts={shifts.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Rules & Live Compliance Banner */}
        <RulesBanner
          isValid={validationResult.isValid}
          violationsCount={validationResult.violations.length}
          totalShifts={shifts.length}
          activeOperatorsCount={operators.filter((o) => o.active).length}
        />

        {/* Tab Views */}
        {activeTab === 'excel' && (
          <ExcelColumnView
            shifts={shifts}
            operators={operators}
            onSelectShift={(shift) => setSelectedShiftForDetail(shift)}
            onOpenSwap={(shift) => setSelectedShiftForSwap(shift)}
          />
        )}

        {activeTab === 'report' && (
          <MonthlyReportView
            shifts={shifts}
            operators={operators}
            onSelectShift={(shift) => setSelectedShiftForDetail(shift)}
            onUpdateShift={handleSaveShift}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            shifts={shifts}
            operators={operators}
            onSelectShift={(shift) => setSelectedShiftForDetail(shift)}
            onOpenSwap={(shift) => setSelectedShiftForSwap(shift)}
          />
        )}

        {activeTab === 'table' && (
          <ShiftsTableView
            shifts={shifts}
            operators={operators}
            onSelectShift={(shift) => setSelectedShiftForDetail(shift)}
            onOpenSwap={(shift) => setSelectedShiftForSwap(shift)}
          />
        )}

        {activeTab === 'matrix' && (
          <MonthlyMatrixView
            shifts={shifts}
            operators={operators}
          />
        )}

        {activeTab === 'operators' && (
          <OperatorsView
            operators={operators}
            shifts={shifts}
            onAddOperator={handleAddOperator}
            onUpdateOperator={handleUpdateOperator}
            onDeleteOperator={handleDeleteOperator}
            onBulkSetOperators={(newOps) => setOperators(newOps)}
          />
        )}
      </main>

      {/* Print View (Visible only during window.print()) */}
      <PrintableView shifts={shifts} operators={operators} />

      {/* Modals */}
      {selectedShiftForDetail && (
        <ShiftDetailModal
          shift={selectedShiftForDetail}
          operators={operators}
          shifts={shifts}
          onClose={() => setSelectedShiftForDetail(null)}
          onSaveShift={handleSaveShift}
        />
      )}

      {selectedShiftForSwap && (
        <SwapShiftModal
          sourceShift={selectedShiftForSwap}
          allShifts={shifts}
          operators={operators}
          onClose={() => setSelectedShiftForSwap(null)}
          onConfirmSwap={handleConfirmSwap}
        />
      )}

      {isExportOpen && (
        <ExportModal
          shifts={shifts}
          operators={operators}
          onClose={() => setIsExportOpen(false)}
        />
      )}

      {isHolidaysOpen && (
        <HolidaysModal
          customHolidays={customHolidays}
          onAddCustomHoliday={handleAddCustomHoliday}
          onRemoveCustomHoliday={handleRemoveCustomHoliday}
          onClose={() => setIsHolidaysOpen(false)}
        />
      )}
    </div>
  );
}
