import type {
Plan,
PlanCode
} from "../../types";

export const planOrder: PlanCode[] = [
  "personal_start",
  "personal_plus",
  "personal_pro",
  "business_start",
  "business_plus",
  "business_pro"
];

export const analysisLevelLabels: Record<string, string> = {
  basic: "Базовый",
  plus: "Plus",
  pro: "Pro",
  priority: "Приоритетный"
};

export const planGradients: Record<PlanCode, string> = {
  personal_start: "linear-gradient(145deg, rgba(96, 165, 250, 0.42), rgba(250, 204, 21, 0.24))",
  personal_plus: "linear-gradient(145deg, rgba(45, 212, 191, 0.38), rgba(255, 122, 89, 0.28))",
  personal_pro: "linear-gradient(145deg, rgba(129, 140, 248, 0.4), rgba(236, 72, 153, 0.28))",
  business_start: "linear-gradient(145deg, rgba(52, 211, 153, 0.38), rgba(14, 165, 233, 0.26))",
  business_plus: "linear-gradient(145deg, rgba(251, 146, 60, 0.36), rgba(168, 85, 247, 0.28))",
  business_pro: "linear-gradient(145deg, rgba(244, 63, 94, 0.34), rgba(59, 130, 246, 0.3))"
};

export function comparePlans(left: Plan, right: Plan) {
  const leftIndex = planOrder.indexOf(left.code);
  const rightIndex = planOrder.indexOf(right.code);
  return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
    (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
}

export function formatMinutesLimit(value: number) {
  return `${value} минут`;
}

export function formatInstructionLimit(value: number) {
  return `${value}`;
}

export function formatHistoryDays(value: number) {
  return `${value} ${pluralizeRu(value, "день", "дня", "дней")}`;
}

export function formatNullableLimit(value: number | null) {
  return value === null ? "Не применяется" : String(value);
}

export function availabilityLabel(value: boolean) {
  return value ? "Доступно" : "Недоступно";
}

export function analysisLevelLabel(value: string) {
  return analysisLevelLabels[value] ?? (value || "Не указано");
}

export function pluralizeRu(value: number, one: string, few: string, many: string) {
  const lastTwo = Math.abs(value) % 100;
  const last = Math.abs(value) % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
