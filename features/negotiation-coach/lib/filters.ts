import {
  ALL_NEGOTIATION_LEVERS,
  type NegotiationLever,
  type NegotiationSourceRow,
  type PrioritizeBy,
  type SupplierLeverOverride
} from "@/features/negotiation-coach/lib/model";

export type SearchParams = Record<string, string | string[] | undefined>;

export const NONE_SENTINEL = "__none__";

export type NegotiationPeriodOption = {
  reportMonth: string;
  reportYear: string;
  reportMonthNumber: number;
};

export type NegotiationFilterOptions = {
  stores: string[];
  departments: string[];
  suppliers: string[];
  years: string[];
  monthNumbers: number[];
  periods: NegotiationPeriodOption[];
};

export type NegotiationFilters = {
  selectedStores: string[];
  selectedDepartments: string[];
  selectedSuppliers: string[];
  selectedYears: string[];
  selectedMonthNumbers: number[];
  searchText: string;
  tbMin: number | null;
  tbMax: number | null;
  netMin: number | null;
  netMax: number | null;
  stockSalesMin: number | null;
  stockSalesMax: number | null;
  returnRateMin: number | null;
  returnRateMax: number | null;
  selectedLevers: NegotiationLever[];
  prioritizeBy: PrioritizeBy;
  supplierOverrides: SupplierLeverOverride[];
};

function asArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  return [];
}

function asArrayPreserveEmpty(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim());
  }
  if (typeof value === "string") {
    return [value.trim()];
  }
  return [];
}

function firstValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value) && value.length > 0) return value[0]?.trim() || null;
  return null;
}

function uniqueSortedStrings(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "sv-SE"));
}

function uniqueSortedNumbers(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function parseLocalizedNumber(value: string | null): number | null {
  if (!value) return null;
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampNullable(value: number | null, min: number, max: number): number | null {
  if (value === null) return null;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function parseLocalizedNumberValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    return parseLocalizedNumber(value);
  }
  return null;
}

function hasOverrideValues(override: SupplierLeverOverride): boolean {
  return (
    override.purchaseCostImprovementPct !== null ||
    override.priceLiftPct !== null ||
    override.apDaysGain !== null ||
    override.stockReleasePct !== null ||
    override.returnReductionPct !== null
  );
}

function parseSupplierOverridesFromJson(
  searchParams: SearchParams,
  availableSuppliers: string[]
): SupplierLeverOverride[] | null {
  const rawJson = firstValue(searchParams.supplier_overrides_json);
  if (rawJson === null) {
    return null;
  }

  const availableSet = new Set(availableSuppliers);
  const seenSuppliers = new Set<string>();

  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const overrides: SupplierLeverOverride[] = [];
    parsed.forEach((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return;
      const supplier = typeof item.supplier === "string" ? item.supplier.trim() : "";
      if (!supplier || !availableSet.has(supplier) || seenSuppliers.has(supplier)) return;

      const normalized: SupplierLeverOverride = {
        supplier,
        purchaseCostImprovementPct: clampNullable(parseLocalizedNumberValue(item.purchaseCostImprovementPct), 0, 20),
        priceLiftPct: clampNullable(parseLocalizedNumberValue(item.priceLiftPct), -10, 20),
        apDaysGain: clampNullable(parseLocalizedNumberValue(item.apDaysGain), 0, 120),
        stockReleasePct: clampNullable(parseLocalizedNumberValue(item.stockReleasePct), 0, 80),
        returnReductionPct: clampNullable(parseLocalizedNumberValue(item.returnReductionPct), 0, 90)
      };

      if (!hasOverrideValues(normalized)) return;
      seenSuppliers.add(supplier);
      overrides.push(normalized);
    });

    return overrides;
  } catch {
    return [];
  }
}

function parseSupplierOverrides(searchParams: SearchParams, availableSuppliers: string[]): SupplierLeverOverride[] {
  const jsonOverrides = parseSupplierOverridesFromJson(searchParams, availableSuppliers);
  if (jsonOverrides !== null) {
    return jsonOverrides;
  }

  const names = asArrayPreserveEmpty(searchParams.supplier_override_name);
  const purchase = asArrayPreserveEmpty(searchParams.supplier_override_purchase_cost);
  const price = asArrayPreserveEmpty(searchParams.supplier_override_price_lift);
  const ap = asArrayPreserveEmpty(searchParams.supplier_override_ap_days);
  const stock = asArrayPreserveEmpty(searchParams.supplier_override_stock_release);
  const returns = asArrayPreserveEmpty(searchParams.supplier_override_return_reduction);
  const availableSet = new Set(availableSuppliers);
  const overrides: SupplierLeverOverride[] = [];

  names.forEach((name, index) => {
    if (!availableSet.has(name)) return;
    const parsed: SupplierLeverOverride = {
      supplier: name,
      purchaseCostImprovementPct: clampNullable(parseLocalizedNumber(purchase[index] ?? null), 0, 20),
      priceLiftPct: clampNullable(parseLocalizedNumber(price[index] ?? null), -10, 20),
      apDaysGain: clampNullable(parseLocalizedNumber(ap[index] ?? null), 0, 120),
      stockReleasePct: clampNullable(parseLocalizedNumber(stock[index] ?? null), 0, 80),
      returnReductionPct: clampNullable(parseLocalizedNumber(returns[index] ?? null), 0, 90)
    };

    if (!hasOverrideValues(parsed)) {
      return;
    }

    overrides.push(parsed);
  });

  return overrides;
}

function parseStringSelection(rawValues: string[], availableValues: string[]): string[] {
  if (rawValues.includes(NONE_SENTINEL)) {
    return [];
  }
  const selected = uniqueSortedStrings(rawValues.filter((value) => availableValues.includes(value)));
  return selected.length > 0 ? selected : [...availableValues];
}

function parseMonthSelection(rawValues: string[], availableValues: number[]): number[] {
  if (rawValues.includes(NONE_SENTINEL)) {
    return [];
  }
  const availableSet = new Set(availableValues);
  const selected = uniqueSortedNumbers(
    rawValues
      .map((value) => Number(value.replace(",", ".")))
      .filter((value) => Number.isFinite(value) && availableSet.has(value))
  );
  return selected.length > 0 ? selected : [...availableValues];
}

export function getNegotiationFilterOptions(rows: NegotiationSourceRow[]): NegotiationFilterOptions {
  const periodsMap = new Map<string, NegotiationPeriodOption>();
  rows.forEach((row) => {
    periodsMap.set(row.reportMonth, {
      reportMonth: row.reportMonth,
      reportYear: row.reportYear,
      reportMonthNumber: row.reportMonthNumber
    });
  });

  return {
    stores: uniqueSortedStrings(rows.map((row) => row.store)),
    departments: uniqueSortedStrings(rows.map((row) => row.department)),
    suppliers: uniqueSortedStrings(rows.map((row) => row.supplier)),
    years: uniqueSortedStrings(rows.map((row) => row.reportYear)),
    monthNumbers: uniqueSortedNumbers(rows.map((row) => row.reportMonthNumber)),
    periods: [...periodsMap.values()].sort((a, b) => a.reportMonth.localeCompare(b.reportMonth))
  };
}

function clampNullableRange(min: number | null, max: number | null): { min: number | null; max: number | null } {
  if (min === null || max === null) {
    return { min, max };
  }
  if (min <= max) {
    return { min, max };
  }
  return { min: max, max: min };
}

export function parseNegotiationFilters(
  searchParams: SearchParams,
  options: NegotiationFilterOptions
): NegotiationFilters {
  const selectedStores = parseStringSelection(asArray(searchParams.store), options.stores);
  const selectedDepartments = parseStringSelection(asArray(searchParams.department), options.departments);
  const selectedSuppliers = parseStringSelection(asArray(searchParams.supplier), options.suppliers);
  const selectedYears = parseStringSelection(asArray(searchParams.year), options.years);
  const selectedMonthNumbers = parseMonthSelection(asArray(searchParams.month_number), options.monthNumbers);

  const searchText = firstValue(searchParams.search) ?? "";

  const tbRange = clampNullableRange(
    parseLocalizedNumber(firstValue(searchParams.tb_min)),
    parseLocalizedNumber(firstValue(searchParams.tb_max))
  );
  const netRange = clampNullableRange(
    parseLocalizedNumber(firstValue(searchParams.net_min)),
    parseLocalizedNumber(firstValue(searchParams.net_max))
  );
  const stockSalesRange = clampNullableRange(
    parseLocalizedNumber(firstValue(searchParams.stock_sales_min)),
    parseLocalizedNumber(firstValue(searchParams.stock_sales_max))
  );
  const returnRateRange = clampNullableRange(
    parseLocalizedNumber(firstValue(searchParams.return_min)),
    parseLocalizedNumber(firstValue(searchParams.return_max))
  );

  const rawLevers = asArray(searchParams.lever);
  const selectedLevers = rawLevers.includes(NONE_SENTINEL)
    ? []
    : (uniqueSortedStrings(
        rawLevers.filter((lever): lever is NegotiationLever =>
          ALL_NEGOTIATION_LEVERS.includes(lever as NegotiationLever)
        )
      ) as NegotiationLever[]);

  const prioritizeRaw = firstValue(searchParams.prioritize);
  const prioritizeBy: PrioritizeBy =
    prioritizeRaw === "tb" || prioritizeRaw === "cash" || prioritizeRaw === "low_risk" || prioritizeRaw === "balanced"
      ? prioritizeRaw
      : "balanced";
  const supplierOverrides = parseSupplierOverrides(searchParams, options.suppliers);

  return {
    selectedStores,
    selectedDepartments,
    selectedSuppliers,
    selectedYears,
    selectedMonthNumbers,
    searchText,
    tbMin: tbRange.min,
    tbMax: tbRange.max,
    netMin: netRange.min,
    netMax: netRange.max,
    stockSalesMin: stockSalesRange.min,
    stockSalesMax: stockSalesRange.max,
    returnRateMin: returnRateRange.min,
    returnRateMax: returnRateRange.max,
    selectedLevers: selectedLevers.length > 0 ? selectedLevers : [...ALL_NEGOTIATION_LEVERS],
    prioritizeBy,
    supplierOverrides
  };
}

function withinRange(value: number, min: number | null, max: number | null): boolean {
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

export function applyNegotiationFilters(rows: NegotiationSourceRow[], filters: NegotiationFilters): NegotiationSourceRow[] {
  if (
    filters.selectedStores.length === 0 ||
    filters.selectedDepartments.length === 0 ||
    filters.selectedSuppliers.length === 0 ||
    filters.selectedYears.length === 0 ||
    filters.selectedMonthNumbers.length === 0
  ) {
    return [];
  }

  const storeSet = new Set(filters.selectedStores);
  const departmentSet = new Set(filters.selectedDepartments);
  const supplierSet = new Set(filters.selectedSuppliers);
  const yearSet = new Set(filters.selectedYears);
  const monthSet = new Set(filters.selectedMonthNumbers);
  const searchTextNormalized = filters.searchText.toLocaleLowerCase("sv-SE");

  return rows.filter((row) => {
    if (!storeSet.has(row.store)) return false;
    if (!departmentSet.has(row.department)) return false;
    if (!supplierSet.has(row.supplier)) return false;
    if (!yearSet.has(row.reportYear)) return false;
    if (!monthSet.has(row.reportMonthNumber)) return false;

    if (
      searchTextNormalized &&
      !`${row.articleNumber} ${row.ean} ${row.articleText} ${row.supplier}`
        .toLocaleLowerCase("sv-SE")
        .includes(searchTextNormalized)
    ) {
      return false;
    }

    if (!withinRange(row.grossMarginPercent, filters.tbMin, filters.tbMax)) return false;
    if (!withinRange(row.netSales, filters.netMin, filters.netMax)) return false;
    if (!withinRange(row.stockToSalesRatio, filters.stockSalesMin, filters.stockSalesMax)) return false;
    if (!withinRange(row.returnRatePercent, filters.returnRateMin, filters.returnRateMax)) return false;

    return true;
  });
}
