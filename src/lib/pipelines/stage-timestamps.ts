import type { Deal } from "@/types";

export type DealTransportTimestampField =
  | "base_departure_at"
  | "customer_arrival_at"
  | "customer_departure_at"
  | "base_arrival_at";

export interface StageTimestampUpdate {
  field: DealTransportTimestampField;
  value: string;
}

export function getStageTimestampUpdate(
  stageName: string,
  deal: Pick<Deal, DealTransportTimestampField>,
  changedAt: string,
): StageTimestampUpdate | null {
  const normalizedName = stageName
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

  let field: DealTransportTimestampField | null = null;
  switch (normalizedName) {
    case "a caminho":
      field = "base_departure_at";
      break;
    case "no cliente":
      field = "customer_arrival_at";
      break;
    case "retornando":
      field = "customer_departure_at";
      break;
    case "concluido":
      field = "base_arrival_at";
      break;
  }

  if (!field || deal[field]) return null;
  return { field, value: changedAt };
}
