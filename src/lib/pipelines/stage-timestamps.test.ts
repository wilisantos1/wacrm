import { describe, expect, it } from "vitest";
import { getStageTimestampUpdate } from "./stage-timestamps";

const EMPTY_TIMESTAMPS = {
  base_departure_at: null,
  customer_arrival_at: null,
  customer_departure_at: null,
  base_arrival_at: null,
};

describe("getStageTimestampUpdate", () => {
  it.each([
    ["A caminho", "base_departure_at"],
    ["No cliente", "customer_arrival_at"],
    ["Retornando", "customer_departure_at"],
    ["Concluído", "base_arrival_at"],
  ] as const)("sets the timestamp for %s", (stageName, field) => {
    expect(
      getStageTimestampUpdate(stageName, EMPTY_TIMESTAMPS, "2026-11-09T15:00:00.000Z"),
    ).toEqual({ field, value: "2026-11-09T15:00:00.000Z" });
  });

  it("matches stage names without case or accent differences", () => {
    expect(
      getStageTimestampUpdate("  CONCLUIDO  ", EMPTY_TIMESTAMPS, "now"),
    ).toEqual({ field: "base_arrival_at", value: "now" });
  });

  it("does not replace a timestamp that is already set", () => {
    expect(
      getStageTimestampUpdate(
        "A caminho",
        { ...EMPTY_TIMESTAMPS, base_departure_at: "existing" },
        "new",
      ),
    ).toBeNull();
  });

  it("ignores stages without a transport timestamp", () => {
    expect(
      getStageTimestampUpdate("Em aberto", EMPTY_TIMESTAMPS, "now"),
    ).toBeNull();
  });
});
