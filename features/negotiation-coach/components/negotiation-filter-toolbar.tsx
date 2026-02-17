"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type NegotiationLever,
  type PrioritizeBy,
  type SupplierLeverOverride
} from "@/features/negotiation-coach/lib/model";
import { NONE_SENTINEL, type NegotiationPeriodOption } from "@/features/negotiation-coach/lib/filters";

type MultiSelectOption = {
  value: string;
  label: string;
};

type DropdownKey = "department" | "supplier" | "store" | "year" | "month" | "lever" | null;

type NegotiationFilterToolbarProps = {
  departments: string[];
  suppliers: string[];
  overrideSuppliers: string[];
  stores: string[];
  years: string[];
  monthNumbers: number[];
  periods: NegotiationPeriodOption[];
  selectedDepartments: string[];
  selectedSuppliers: string[];
  selectedStores: string[];
  selectedYears: string[];
  selectedMonthNumbers: number[];
  selectedLevers: NegotiationLever[];
  prioritizeBy: PrioritizeBy;
  searchText: string;
  tbMin: number | null;
  tbMax: number | null;
  netMin: number | null;
  netMax: number | null;
  stockSalesMin: number | null;
  stockSalesMax: number | null;
  returnRateMin: number | null;
  returnRateMax: number | null;
  supplierOverrides: SupplierLeverOverride[];
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

function monthLabel(value: string): string {
  const monthNumber = Number(value);
  if (!Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return value;
  }
  return `${String(monthNumber).padStart(2, "0")} ${MONTH_NAMES[monthNumber - 1]}`;
}

function encodeHiddenInputs(name: string, selectedValues: string[]) {
  if (selectedValues.length === 0) {
    return <input type="hidden" name={name} value={NONE_SENTINEL} />;
  }
  return selectedValues.map((value) => <input key={`${name}-${value}`} type="hidden" name={name} value={value} />);
}

function normalizeSelection(options: MultiSelectOption[], selectedValues: string[]): string[] {
  const selectedSet = new Set(selectedValues);
  return options.filter((option) => selectedSet.has(option.value)).map((option) => option.value);
}

function formatOptionalNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  const isInteger = Math.abs(value - Math.round(value)) < 0.000001;
  return isInteger ? String(Math.round(value)) : value.toFixed(1).replace(".", ",");
}

function findSupplierOverride(supplier: string, overrides: SupplierLeverOverride[]): SupplierLeverOverride | null {
  return overrides.find((row) => row.supplier === supplier) ?? null;
}

type SupplierOverrideDraft = {
  supplier: string;
  purchaseCostImprovementPct: string;
  priceLiftPct: string;
  apDaysGain: string;
  stockReleasePct: string;
  returnReductionPct: string;
};

function buildSupplierOverrideDrafts(
  options: MultiSelectOption[],
  overrides: SupplierLeverOverride[]
): SupplierOverrideDraft[] {
  return options.map((option) => {
    const override = findSupplierOverride(option.value, overrides);
    return {
      supplier: option.value,
      purchaseCostImprovementPct: formatOptionalNumber(override?.purchaseCostImprovementPct ?? null),
      priceLiftPct: formatOptionalNumber(override?.priceLiftPct ?? null),
      apDaysGain: formatOptionalNumber(override?.apDaysGain ?? null),
      stockReleasePct: formatOptionalNumber(override?.stockReleasePct ?? null),
      returnReductionPct: formatOptionalNumber(override?.returnReductionPct ?? null)
    };
  });
}

function isDraftActive(draft: SupplierOverrideDraft): boolean {
  return (
    draft.purchaseCostImprovementPct.trim().length > 0 ||
    draft.priceLiftPct.trim().length > 0 ||
    draft.apDaysGain.trim().length > 0 ||
    draft.stockReleasePct.trim().length > 0 ||
    draft.returnReductionPct.trim().length > 0
  );
}

function buildDemoDrafts(source: SupplierOverrideDraft[]): SupplierOverrideDraft[] {
  return source.map((draft) => ({
    ...draft,
    purchaseCostImprovementPct: "5,0",
    priceLiftPct: "1,8",
    apDaysGain: "14",
    stockReleasePct: "15",
    returnReductionPct: "30"
  }));
}

function buildSerializedSupplierOverrides(drafts: SupplierOverrideDraft[]): string {
  const payload = drafts
    .filter((draft) => isDraftActive(draft))
    .map((draft) => ({
      supplier: draft.supplier,
      purchaseCostImprovementPct: draft.purchaseCostImprovementPct.trim(),
      priceLiftPct: draft.priceLiftPct.trim(),
      apDaysGain: draft.apDaysGain.trim(),
      stockReleasePct: draft.stockReleasePct.trim(),
      returnReductionPct: draft.returnReductionPct.trim()
    }));
  return payload.length > 0 ? JSON.stringify(payload) : "";
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

export function NegotiationFilterToolbar(props: NegotiationFilterToolbarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [openKey, setOpenKey] = useState<DropdownKey>(null);
  const previousDraftsRef = useRef<SupplierOverrideDraft[] | null>(null);

  const departmentOptions = useMemo(
    () => props.departments.map((department) => ({ value: department, label: department })),
    [props.departments]
  );
  const supplierOptions = useMemo(
    () => props.suppliers.map((supplier) => ({ value: supplier, label: supplier })),
    [props.suppliers]
  );
  const overrideSupplierOptions = useMemo(
    () => props.overrideSuppliers.map((supplier) => ({ value: supplier, label: supplier })),
    [props.overrideSuppliers]
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
  const leverOptions = useMemo<MultiSelectOption[]>(
    () => [
      { value: "purchase_cost", label: "Inköpspris" },
      { value: "price_lift", label: "Prislyft" },
      { value: "payment_terms", label: "AP-dagar" },
      { value: "moq_stock", label: "MOQ / lager" },
      { value: "returns", label: "Returvillkor" }
    ],
    []
  );

  const [selectedDepartments, setSelectedDepartments] = useState(() =>
    normalizeSelection(departmentOptions, props.selectedDepartments)
  );
  const [selectedSuppliers, setSelectedSuppliers] = useState(() =>
    normalizeSelection(supplierOptions, props.selectedSuppliers)
  );
  const [selectedStores, setSelectedStores] = useState(() => normalizeSelection(storeOptions, props.selectedStores));
  const [selectedYears, setSelectedYears] = useState(() => normalizeSelection(yearOptions, props.selectedYears));
  const [selectedMonths, setSelectedMonths] = useState(() =>
    normalizeSelection(
      monthOptions,
      props.selectedMonthNumbers.map((monthNumber) => String(monthNumber))
    )
  );
  const [selectedLevers, setSelectedLevers] = useState(() => normalizeSelection(leverOptions, props.selectedLevers));
  const initialOverrideDrafts = useMemo(
    () => buildSupplierOverrideDrafts(overrideSupplierOptions, props.supplierOverrides),
    [overrideSupplierOptions, props.supplierOverrides]
  );
  const [overrideDrafts, setOverrideDrafts] = useState<SupplierOverrideDraft[]>(() => initialOverrideDrafts);
  const [demoModeActive, setDemoModeActive] = useState(false);

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

  useEffect(() => {
    setOverrideDrafts(initialOverrideDrafts);
    setDemoModeActive(false);
    previousDraftsRef.current = null;
  }, [initialOverrideDrafts]);

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

  const activeOverrideCount = useMemo(
    () => overrideDrafts.filter((draft) => isDraftActive(draft)).length,
    [overrideDrafts]
  );
  const serializedSupplierOverrides = useMemo(
    () => buildSerializedSupplierOverrides(overrideDrafts),
    [overrideDrafts]
  );

  function updateOverrideDraft(supplier: string, field: keyof Omit<SupplierOverrideDraft, "supplier">, value: string) {
    setOverrideDrafts((current) =>
      current.map((draft) => (draft.supplier === supplier ? { ...draft, [field]: value } : draft))
    );
  }

  function toggleDemoMode() {
    if (!demoModeActive) {
      previousDraftsRef.current = overrideDrafts.map((draft) => ({ ...draft }));
      setOverrideDrafts(buildDemoDrafts(overrideDrafts));
      setDemoModeActive(true);
      return;
    }

    const restoreRows = previousDraftsRef.current ?? initialOverrideDrafts;
    setOverrideDrafts(restoreRows.map((draft) => ({ ...draft })));
    setDemoModeActive(false);
    previousDraftsRef.current = null;
  }

  return (
    <form method="get" acceptCharset="UTF-8" className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Steg 1: filter och prioritering</p>
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
          id="supplier"
          openKey={openKey}
          setOpenKey={setOpenKey}
          label="Leverantörer"
          options={supplierOptions}
          selectedValues={selectedSuppliers}
          setSelectedValues={setSelectedSuppliers}
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
          id="lever"
          openKey={openKey}
          setOpenKey={setOpenKey}
          label="Förhandlingsspakar"
          options={leverOptions}
          selectedValues={selectedLevers}
          setSelectedValues={setSelectedLevers}
        />
        <span className="text-sm text-slate-600">
          {selectedDepartments.length}/{departmentOptions.length} avd, {selectedSuppliers.length}/{supplierOptions.length} leverantörer,{" "}
          {selectedStores.length}/{storeOptions.length} butiker, {selectedMonths.length}/{monthOptions.length} månader, {selectedPeriodCount} perioder
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Artikelsök (artnr/EAN/namn)</span>
          <input
            type="text"
            name="search"
            defaultValue={props.searchText}
            placeholder="Ex: 8398590 eller Damtröja"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Prioritera efter</span>
          <select
            name="prioritize"
            defaultValue={props.prioritizeBy}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          >
            <option value="balanced">Balans (TB + kassaflöde + risk)</option>
            <option value="tb">Högst TB-effekt</option>
            <option value="cash">Störst kassaflöde</option>
            <option value="low_risk">Lägst risk</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm text-slate-700">
          <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">TB % (min/max)</span>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              name="tb_min"
              defaultValue={formatOptionalNumber(props.tbMin)}
              placeholder="min"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
            <input
              type="text"
              name="tb_max"
              defaultValue={formatOptionalNumber(props.tbMax)}
              placeholder="max"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Nettoförsäljning (min/max)</span>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              name="net_min"
              defaultValue={formatOptionalNumber(props.netMin)}
              placeholder="min"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
            <input
              type="text"
              name="net_max"
              defaultValue={formatOptionalNumber(props.netMax)}
              placeholder="max"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Lager/försäljning (min/max)</span>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              name="stock_sales_min"
              defaultValue={formatOptionalNumber(props.stockSalesMin)}
              placeholder="min"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
            <input
              type="text"
              name="stock_sales_max"
              defaultValue={formatOptionalNumber(props.stockSalesMax)}
              placeholder="max"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Returgrad % (min/max)</span>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              name="return_min"
              defaultValue={formatOptionalNumber(props.returnRateMin)}
              placeholder="min"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
            <input
              type="text"
              name="return_max"
              defaultValue={formatOptionalNumber(props.returnRateMax)}
              placeholder="max"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-800"
        >
          Uppdatera kandidater
        </button>
      </div>

      <details open={activeOverrideCount > 0} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          Steg 2: manuella spakar per leverantör (Mål-nivå) - {activeOverrideCount} aktiva
        </summary>
        <p className="mt-2 text-xs text-slate-600">
          Ange egna målvärden per leverantör. Bas och Aggressiv skalas automatiskt runt dessa värden.
          Lämna tomt för att använda standardprofiler.
        </p>
        <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="sticky top-0 z-20 bg-slate-100 text-left text-xs uppercase tracking-[0.08em] text-slate-600">
              <tr>
                <th className="px-2 py-2">Leverantör</th>
                <th className="px-2 py-2">Inköpspris -%</th>
                <th className="px-2 py-2">Utpris +%</th>
                <th className="px-2 py-2">AP +dagar</th>
                <th className="px-2 py-2">Lager -%</th>
                <th className="px-2 py-2">Retur -%</th>
              </tr>
            </thead>
            <tbody>
              {overrideDrafts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-sm text-slate-600">
                    Inga leverantörer i aktuellt urval. Justera filter ovan.
                  </td>
                </tr>
              ) : null}
              {overrideDrafts.map((draft) => {
                const overrideActive = isDraftActive(draft);
                return (
                  <tr
                    key={draft.supplier}
                    className={overrideActive ? "border-t border-slate-200 bg-sky-50/60" : "border-t border-slate-200"}
                  >
                    <td className="px-2 py-2 text-slate-700">
                      <span className="font-medium">{draft.supplier}</span>
                      {overrideActive ? (
                        <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700">
                          Aktiv
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={draft.purchaseCostImprovementPct}
                        onChange={(event) =>
                          updateOverrideDraft(draft.supplier, "purchaseCostImprovementPct", event.target.value)
                        }
                        placeholder="2,5"
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={draft.priceLiftPct}
                        onChange={(event) => updateOverrideDraft(draft.supplier, "priceLiftPct", event.target.value)}
                        placeholder="0,9"
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={draft.apDaysGain}
                        onChange={(event) => updateOverrideDraft(draft.supplier, "apDaysGain", event.target.value)}
                        placeholder="7"
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={draft.stockReleasePct}
                        onChange={(event) => updateOverrideDraft(draft.supplier, "stockReleasePct", event.target.value)}
                        placeholder="9"
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={draft.returnReductionPct}
                        onChange={(event) => updateOverrideDraft(draft.supplier, "returnReductionPct", event.target.value)}
                        placeholder="18"
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <p className="text-xs text-slate-600">Steg 3: välj demo eller uppdatera resultatet med dina värden.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleDemoMode}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              {demoModeActive ? "Återställ" : "Demo"}
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800"
            >
              Använd leverantörsspakar
            </button>
          </div>
        </div>
        {demoModeActive ? (
          <p className="mt-2 text-xs font-semibold text-amber-700">
            Demo-värden är ifyllda. Klicka "Använd leverantörsspakar" för att se effekt i resultatet.
          </p>
        ) : null}
      </details>

      {encodeHiddenInputs("department", selectedDepartments)}
      {encodeHiddenInputs("supplier", selectedSuppliers)}
      {encodeHiddenInputs("store", selectedStores)}
      {encodeHiddenInputs("year", selectedYears)}
      {encodeHiddenInputs("month_number", selectedMonths)}
      {encodeHiddenInputs("lever", selectedLevers)}
      <input type="hidden" name="supplier_overrides_json" value={serializedSupplierOverrides} />
    </form>
  );
}

