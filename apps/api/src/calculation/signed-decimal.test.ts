import { describe, expect, it } from "vitest";
import {
  addDecimals,
  negateDecimal,
  SignedDecimalError
} from "./signed-decimal.js";

describe("signed decimal arithmetic", () => {
  it("adds values exactly while aligning scale", () => {
    expect(addDecimals("100", "-66.66666667")).toBe("33.33333333");
    expect(addDecimals("0.1", "0.02")).toBe("0.12000000");
    expect(addDecimals("-1.000000001", "1")).toBe("-0.000000001");
  });

  it("negates canonical decimal strings", () => {
    expect(negateDecimal("12.50")).toBe("-12.50");
    expect(negateDecimal("-12.50")).toBe("12.50");
    expect(negateDecimal("0.00")).toBe("0.00");
  });

  it.each(["", "1.2.3", "NaN", "--1"])("rejects malformed decimals", (value) => {
    expect(() => addDecimals(value, "1")).toThrow(SignedDecimalError);
  });
});
