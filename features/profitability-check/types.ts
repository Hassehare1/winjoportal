export type BusinessModel = "consulting" | "retail" | "subscription" | "project" | "manufacturing";
export type Bottleneck = "pricing" | "utilization" | "cashflow" | "overhead" | "sales";

export type ProfitabilityInput = {
  industry: string;
  businessModel: BusinessModel;
  annualRevenueSek: number;
  grossMarginPercent: number;
  payrollCostSek: number;
  fixedCostsSek: number;
  arDays: number;
  inventoryDays: number;
  topCustomerSharePercent: number;
  target12m: string;
  bottleneck: Bottleneck;
};

export type ProfitabilityRiskDriver = {
  id: string;
  label: string;
  points: number;
  detail: string;
};

export type ImprovementAction = {
  title: string;
  why: string;
  firstStep: string;
  impactHintSek: number;
  priority: "High" | "Medium";
};

export type ProfitabilityAssessment = {
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  riskDrivers: ProfitabilityRiskDriver[];
  operatingMarginPercent: number;
  cashConversionDays: number;
  potentialRangeSek: {
    min: number;
    max: number;
    midpoint: number;
  };
  summary: string;
  ruleActions: ImprovementAction[];
};
