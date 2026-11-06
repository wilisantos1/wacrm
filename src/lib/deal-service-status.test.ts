import { describe, expect, it } from "vitest";
import { getDealServiceStatus } from "./deal-service-status";

describe("getDealServiceStatus", () => {
  it("marks arrival before or at the service time as on time", () => {
    expect(
      getDealServiceStatus({
        service_at: "2026-11-06T09:00:00-03:00",
        customer_arrival_at: "2026-11-06T09:00:00-03:00",
      }),
    ).toBe("on-time");
    expect(
      getDealServiceStatus({
        service_at: "2026-11-06T09:00:00-03:00",
        customer_arrival_at: "2026-11-06T08:59:00-03:00",
      }),
    ).toBe("on-time");
  });

  it("marks arrival after the service time as late", () => {
    expect(
      getDealServiceStatus({
        service_at: "2026-11-06T09:00:00-03:00",
        customer_arrival_at: "2026-11-06T09:01:00-03:00",
      }),
    ).toBe("late");
  });

  it("does not assign a status until both valid times are available", () => {
    expect(
      getDealServiceStatus({
        service_at: "2026-11-06T09:00:00-03:00",
        customer_arrival_at: null,
      }),
    ).toBeNull();
    expect(
      getDealServiceStatus({
        service_at: "invalid",
        customer_arrival_at: "2026-11-06T09:00:00-03:00",
      }),
    ).toBeNull();
  });
});
