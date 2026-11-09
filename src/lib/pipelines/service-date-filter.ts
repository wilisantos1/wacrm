import { localDayKey } from "@/lib/dashboard/date-utils";

export type ServiceDateFilter =
  | { type: "day"; value: string }
  | { type: "this-month" }
  | { type: "previous-month" }
  | null;

export function matchesServiceDateFilter(
  serviceAt: string | null | undefined,
  filter: ServiceDateFilter,
  now: Date = new Date(),
): boolean {
  if (!filter) return true;
  if (!serviceAt) return false;

  const serviceDate = new Date(serviceAt);
  if (Number.isNaN(serviceDate.getTime())) return false;

  const serviceDay = localDayKey(serviceDate);
  if (filter.type === "day") return serviceDay === filter.value;

  const targetMonth = new Date(
    now.getFullYear(),
    now.getMonth() + (filter.type === "previous-month" ? -1 : 0),
    1,
  );
  return serviceDay.slice(0, 7) === localDayKey(targetMonth).slice(0, 7);
}
