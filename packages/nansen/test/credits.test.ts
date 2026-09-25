import { describe, expect, it } from "vitest";
import { CreditCap, UNKNOWN_ENDPOINT_COST, estimateCredits } from "../src/credits";
import { CreditCapExceededError } from "../src/errors";
import { CREDIT_COSTS } from "../src/generated/credits";

describe("estimateCredits", () => {
  it("reads the generated table", () => {
    expect(estimateCredits("/api/v1/smart-money/netflow")).toBe(5);
    expect(estimateCredits("/api/v1/profiler/address/pnl-summary")).toBe(1);
    expect(estimateCredits("/api/v1/profiler/address/labels")).toBe(100);
    expect(estimateCredits("/api/v1/agent/expert")).toBe(750);
    expect(estimateCredits("/api/v1/account")).toBe(0);
    expect(estimateCredits("/api/v1beta1/tgm/historical-top-holders")).toBe(25);
  });
  it("charges 150 for premium labels on the four affected endpoints only", () => {
    expect(estimateCredits("/api/v1/tgm/holders", { premium_labels: true })).toBe(150);
    expect(estimateCredits("/api/v1/tgm/holders", { premium_labels: false })).toBe(5);
    expect(estimateCredits("/api/v1/perp-leaderboard", { premium_labels: true })).toBe(150);
    expect(estimateCredits("/api/v1/smart-money/netflow", { premium_labels: true })).toBe(5);
  });
  it("falls back for unknown endpoints", () => {
    expect(estimateCredits("/api/v1/does-not-exist")).toBe(UNKNOWN_ENDPOINT_COST);
  });
  it("covers every documented metered endpoint family", () => {
    const paths = Object.keys(CREDIT_COSTS);
    expect(paths.length).toBeGreaterThan(60);
    expect(paths.some((p) => p.startsWith("/api/v1/prediction-market/"))).toBe(true);
  });
});

describe("CreditCap", () => {
  it("reserves, commits with the real cost, and releases", () => {
    const cap = new CreditCap(20);
    cap.reserve(5, "/a");
    expect(cap.reserved).toBe(5);
    expect(cap.remaining).toBe(15);
    cap.commit(5, 7);
    expect(cap.spent).toBe(7);
    expect(cap.reserved).toBe(0);
    cap.reserve(5, "/b");
    cap.release(5);
    expect(cap.spent).toBe(7);
    expect(cap.reserved).toBe(0);
    expect(cap.calls).toBe(1);
  });
  it("throws before the call when the cap would be exceeded, counting in-flight reservations", () => {
    const cap = new CreditCap(12);
    cap.reserve(5, "/a");
    cap.reserve(5, "/b");
    expect(() => cap.reserve(5, "/c")).toThrow(CreditCapExceededError);
    expect(cap.canAfford(2)).toBe(true);
    expect(cap.canAfford(3)).toBe(false);
  });
  it("null cap is unlimited", () => {
    const cap = new CreditCap(null);
    cap.reserve(10_000, "/a");
    expect(cap.remaining).toBe(Number.POSITIVE_INFINITY);
  });
});
