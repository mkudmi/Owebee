import { describe, expect, it } from "vitest";
import {
  DecimalAllocationError,
  allocateDecimalByWeights
} from "./decimal-ratio.js";

describe("allocateDecimalByWeights", () => {
  it("allocates exact units and preserves at least eight decimal places", () => {
    expect(
      allocateDecimalByWeights("120", [
        { key: "member:a", weight: "1" },
        { key: "member:b", weight: "1" },
        { key: "family:c", weight: "2" }
      ])
    ).toEqual({
      scale: 8,
      allocations: new Map([
        ["family:c", "60.00000000"],
        ["member:a", "30.00000000"],
        ["member:b", "30.00000000"]
      ])
    });
  });

  it("assigns repeating-fraction residuals by sorted key", () => {
    expect(
      allocateDecimalByWeights("1", [
        { key: "member:c", weight: "1" },
        { key: "member:a", weight: "1" },
        { key: "member:b", weight: "1" }
      ]).allocations
    ).toEqual(
      new Map([
        ["member:a", "0.33333334"],
        ["member:b", "0.33333333"],
        ["member:c", "0.33333333"]
      ])
    );
  });

  it("uses the converted amount scale when it exceeds eight", () => {
    expect(
      allocateDecimalByWeights("1.0000000001", [
        { key: "member:a", weight: "1" }
      ])
    ).toEqual({
      scale: 10,
      allocations: new Map([["member:a", "1.0000000001"]])
    });
  });

  it("supports fractional weights while preserving the exact total", () => {
    expect(
      allocateDecimalByWeights("100", [
        { key: "member:a", weight: "1" },
        { key: "family:b", weight: "2.5" }
      ])
    ).toEqual({
      scale: 8,
      allocations: new Map([
        ["family:b", "71.42857143"],
        ["member:a", "28.57142857"]
      ])
    });
  });

  it("rejects duplicate allocation keys", () => {
    expect(() =>
      allocateDecimalByWeights("10", [
        { key: "member:a", weight: "1" },
        { key: "member:a", weight: "1" }
      ])
    ).toThrow(DecimalAllocationError);
  });

  it.each([
    ["0", [{ key: "member:a", weight: "1" }]],
    ["-1", [{ key: "member:a", weight: "1" }]],
    ["1.2.3", [{ key: "member:a", weight: "1" }]],
    ["1", []],
    ["1", [{ key: "member:a", weight: "0" }]],
    ["1", [{ key: "member:a", weight: "-1" }]]
  ])("rejects invalid amount or weights", (amount, weights) => {
    expect(() => allocateDecimalByWeights(amount, weights)).toThrow(
      DecimalAllocationError
    );
  });
});
