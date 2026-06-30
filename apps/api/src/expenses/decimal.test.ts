import { describe, expect, it } from "vitest";
import { divideDecimals, isPositiveDecimal, multiplyDecimals } from "./decimal.js";

describe("expense decimal helpers", () => {
  it("validates positive decimals without accepting exponent or excess scale", () => {
    expect(isPositiveDecimal("0.000000000001", 12)).toBe(true);
    expect(isPositiveDecimal("10.2500", 12)).toBe(true);
    expect(isPositiveDecimal("0", 12)).toBe(false);
    expect(isPositiveDecimal("-1", 12)).toBe(false);
    expect(isPositiveDecimal("1e3", 12)).toBe(false);
    expect(isPositiveDecimal("0.0000000000001", 12)).toBe(false);
  });

  it("multiplies decimal strings without floating-point loss", () => {
    expect(multiplyDecimals("100.00", "90.125")).toBe("9012.5");
    expect(multiplyDecimals("0.00000001", "0.00000001")).toBe("0.0000000000000001");
    expect(multiplyDecimals("1250.7500", "1")).toBe("1250.75");
  });

  it("divides decimal strings with deterministic half-up precision", () => {
    expect(divideDecimals("90", "1")).toBe("90");
    expect(divideDecimals("100", "90", 6)).toBe("1.111111");
    expect(divideDecimals("90", "100", 6)).toBe("0.9");
  });
});
