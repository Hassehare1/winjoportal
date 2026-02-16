"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NONE_SENTINEL, type RiskLevel, type RiskRadarPeriodOption } from "@/features/risk-radar/lib/filters";

type MultiSelectOption = {
  value: string;
  label: string;
};

type DropdownKey = "department" | "store" | "year" | "month" | "risk" | null;

type RiskRadarFilterToolbarProps = {
  departments: string[];
  stores: string[];
  years: string[];
  monthNumbers: number[];
  periods: RiskRadarPeriodOption[];
  selectedDepartments: string[];
  selectedStores: string[];
  selectedYears: string[];
  selectedMonthNumbers: number[];
  selectedRiskLevels: RiskLevel[];
  riskTbThreshold: number;
  defaultRiskTbThreshold: number;
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

function monthLabel(value: string): string {
  const monthNumber = Number(value);
  if (!Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return value;
  }
  return `${String(monthNumber).padStart(2, "0")} ${MONTH_NAMES[monthNumber - 1]}`;
}

function normalizeSelection(options: MultiSelectOption[], selectedValues: string[]): string[] {
  const selectedSet = new Set(selectedValues);
  return options.filter((option) => selectedSet.has(option.value)).map((option) => option.value);
}

function encodeHiddenInputs(name: string, selectedValues: string[]) {
  if (selectedValues.length === 0) {
    return <input type="hidden" name={name} value={NONE_SENTINEL} />;
  }
  return selectedValues.map((value) => <input key={`${name}-${value}`} type="hidden" name={name} value={value} />);
}

type MultiSelectDropdownProps = {
  id: Exclude<DropdownKey, null>;
  openKey: DropdownKey;
  setOpenKey: (key: DropdownKey) => void;
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  setSelectedValues: (values: string[]) => void;
};

function MultiSelectDropdown(props: MultiSelectDropdownProps) {
  const selectedSet = useMemo(() => new Set(props.selectedValues), [props.selectedValues]);
  const isOpen = props.openKey === props.id;

  function toggleValue(value: string) {
    props.setSelectedValues(
      props.options
        .filter((option) => {
          if (option.value === value) {
            return !selectedSet.has(value);
          }
          return selectedSet.has(option.value);
        })
        .map((option) => option.value)
    );
  }

  function selectAll() {
    props.setSelectedValues(props.options.map((option) => option.value));
  }

  function clearAll() {
    props.setSelectedValues([]);
  }

  return (
    <div className="relative" data-filter-root>
      <button
        type="button"
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 transition hover:bg-slate-50"
        onClick={() => props.setOpenKey(isOpen ? null : props.id)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {props.label}
      </button>
      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 min-w-[280px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={selectAll}
            >
              Markera alla
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={clearAll}
            >
              Rensa
            </button>
          </div>
          <div className="max-h-[260px] space-y-1 overflow-auto pr-1">
            {props.options.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-slate-800 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedSet.has(option.value)}
                  onChange={() => toggleValue(option.value)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RiskRadarFilterToolbar(props: RiskRadarFilterToolbarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [openKey, setOpenKey] = useState<DropdownKey>(null);
  const [riskTbThreshold, setRiskTbThreshold] = useState(props.riskTbThreshold.toString().replace(".", ","));

  const departmentOptions = useMemo(
    () => props.departments.map((department) => ({ value: department, label: department })),
    [props.departments]
  );
  const storeOptions = useMemo(() => props.stores.map((store) => ({ value: store, label: store })), [props.stores]);
  const yearOptions = useMemo(() => props.years.map((year) => ({ value: year, label: year })), [props.years]);
  const monthOptions = useMemo(
    () =>
      props.monthNumbers.map((monthNumber) => {
        const value = String(monthNumber);
        return { value, label: monthLabel(value) };
      }),
    [props.monthNumbers]
  );
  const riskOptions = useMemo<MultiSelectOption[]>(
    () => [
      { value: "High", label: "High (röd)" },
      { value: "Medium", label: "Medium (gul)" },
      { value: "Low", label: "Low (grön)" }
    ],
    []
  );

  const [selectedDepartments, setSelectedDepartments] = useState(() =>
    normalizeSelection(departmentOptions, props.selectedDepartments)
  );
  const [selectedStores, setSelectedStores] = useState(() => normalizeSelection(storeOptions, props.selectedStores));
  const [selectedYears, setSelectedYears] = useState(() => normalizeSelection(yearOptions, props.selectedYears));
  const [selectedMonths, setSelectedMonths] = useState(() =>
    normalizeSelection(
      monthOptions,
      props.selectedMonthNumbers.map((monthNumber) => String(monthNumber))
    )
  );
  const [selectedRiskLevels, setSelectedRiskLevels] = useState(() =>
    normalizeSelection(riskOptions, props.selectedRiskLevels)
  );

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (event.target instanceof Node && !containerRef.current.contains(event.target)) {
        setOpenKey(null);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenKey(null);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const selectedPeriodCount = useMemo(() => {
    if (selectedYears.length === 0 || selectedMonths.length === 0) {
      return 0;
    }
    const years = new Set(selectedYears);
    const monthNumbers = new Set(selectedMonths.map((value) => Number(value)));
    return props.periods.filter(
      (period) => years.has(period.reportYear) && monthNumbers.has(period.reportMonthNumber)
    ).length;
  }, [props.periods, selectedMonths, selectedYears]);

  return (
    <form method="get" className="rounded-2xl border border-slate-200 bg-white p-4">
      <div ref={containerRef} className="flex flex-wrap items-center gap-2">
        <MultiSelectDropdown
          id="department"
          openKey={openKey}
          setOpenKey={setOpenKey}
          label="Avdelningar"
          options={departmentOptions}
          selectedValues={selectedDepartments}
          setSelectedValues={setSelectedDepartments}
        />
        <MultiSelectDropdown
          id="store"
          openKey={openKey}
          setOpenKey={setOpenKey}
          label="Butiker"
          options={storeOptions}
          selectedValues={selectedStores}
          setSelectedValues={setSelectedStores}
        />
        <MultiSelectDropdown
          id="year"
          openKey={openKey}
          setOpenKey={setOpenKey}
          label="År"
          options={yearOptions}
          selectedValues={selectedYears}
          setSelectedValues={setSelectedYears}
        />
        <MultiSelectDropdown
          id="month"
          openKey={openKey}
          setOpenKey={setOpenKey}
          label="Månader"
          options={monthOptions}
          selectedValues={selectedMonths}
          setSelectedValues={setSelectedMonths}
        />
        <MultiSelectDropdown
          id="risk"
          openKey={openKey}
          setOpenKey={setOpenKey}
          label="Risknivå"
          options={riskOptions}
          selectedValues={selectedRiskLevels}
          setSelectedValues={setSelectedRiskLevels}
        />
        <span className="text-sm text-slate-600">
          {selectedDepartments.length}/{departmentOptions.length} avd, {selectedStores.length}/{storeOptions.length} butiker,{" "}
          {selectedMonths.length}/{monthOptions.length} månader, {selectedPeriodCount} perioder
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="space-y-1 text-sm text-slate-700">
          <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Risk TB% tröskel</span>
          <input
            name="risk_tb_threshold"
            value={riskTbThreshold}
            onChange={(event) => setRiskTbThreshold(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
          <p className="text-xs text-slate-500">
            Default: {props.defaultRiskTbThreshold.toString().replace(".", ",")} (max(30, min(50, total TB% - 10))).
          </p>
          <p className="text-xs text-slate-500">
            Motivering: 10 p.e. under total-TB fångar tidig marginalrisk utan att normal variation blir överkänslig.
          </p>
        </label>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-800"
        >
          Visa
        </button>
      </div>

      {encodeHiddenInputs("department", selectedDepartments)}
      {encodeHiddenInputs("store", selectedStores)}
      {encodeHiddenInputs("year", selectedYears)}
      {encodeHiddenInputs("month_number", selectedMonths)}
      {encodeHiddenInputs("risk_level", selectedRiskLevels)}
    </form>
  );
}
