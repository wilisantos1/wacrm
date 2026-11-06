import type { Deal } from "@/types";

export type DealServiceStatus = "on-time" | "late";

export function getDealServiceStatus(
  deal: Pick<Deal, "service_at" | "customer_arrival_at">,
): DealServiceStatus | null {
  if (!deal.service_at || !deal.customer_arrival_at) return null;

  const serviceTime = Date.parse(deal.service_at);
  const arrivalTime = Date.parse(deal.customer_arrival_at);
  if (!Number.isFinite(serviceTime) || !Number.isFinite(arrivalTime)) return null;

  return arrivalTime <= serviceTime ? "on-time" : "late";
}
