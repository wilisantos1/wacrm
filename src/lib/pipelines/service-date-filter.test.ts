import { describe, expect, it } from "vitest";
import { matchesServiceDateFilter } from "./service-date-filter";

describe("matchesServiceDateFilter", () => {
  const now = new Date(2026, 4, 15, 12);

  it("matches the selected local day", () => {
    expect(
      matchesServiceDateFilter(
        new Date(2026, 4, 15, 9).toISOString(),
        { type: "day", value: "2026-05-15" },
        now,
      ),
    ).toBe(true);
    expect(
      matchesServiceDateFilter(
        new Date(2026, 4, 14, 9).toISOString(),
        { type: "day", value: "2026-05-15" },
        now,
      ),
    ).toBe(false);
  });

  it("matches this month but not a neighboring month", () => {
    expect(
      matchesServiceDateFilter(
        new Date(2026, 4, 1, 12).toISOString(),
        { type: "this-month" },
        now,
      ),
    ).toBe(true);
    expect(
      matchesServiceDateFilter(
        new Date(2026, 3, 30, 12).toISOString(),
        { type: "this-month" },
        now,
      ),
    ).toBe(false);
  });

  it("matches the previous month across a year boundary", () => {
    const january = new Date(2026, 0, 15, 12);
    expect(
      matchesServiceDateFilter(
        new Date(2025, 11, 15, 12).toISOString(),
        { type: "previous-month" },
        january,
      ),
    ).toBe(true);
    expect(
      matchesServiceDateFilter(
        new Date(2026, 0, 15, 12).toISOString(),
        { type: "previous-month" },
        january,
      ),
    ).toBe(false);
  });

  it("excludes undated services from an active filter", () => {
    expect(matchesServiceDateFilter(null, { type: "this-month" }, now)).toBe(
      false,
    );
    expect(matchesServiceDateFilter(null, null, now)).toBe(true);
  });
});
