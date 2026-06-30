const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/;

export function isPositiveDecimal(value: string, maxScale: number): boolean {
  const match = DECIMAL_PATTERN.exec(value);
  return Boolean(match && (match[1]?.length ?? 0) <= maxScale && /[1-9]/.test(value));
}

export function multiplyDecimals(left: string, right: string): string {
  const leftScale = left.split(".")[1]?.length ?? 0;
  const rightScale = right.split(".")[1]?.length ?? 0;
  const scale = leftScale + rightScale;
  const product =
    BigInt(left.replace(".", "")) * BigInt(right.replace(".", ""));
  const digits = product.toString().padStart(scale + 1, "0");

  if (scale === 0) {
    return digits;
  }

  const integer = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer;
}

export function divideDecimals(
  dividend: string,
  divisor: string,
  scale = 14
): string {
  const leftScale = dividend.split(".")[1]?.length ?? 0;
  const rightScale = divisor.split(".")[1]?.length ?? 0;
  const numerator =
    BigInt(dividend.replace(".", "")) * 10n ** BigInt(rightScale + scale);
  const denominator =
    BigInt(divisor.replace(".", "")) * 10n ** BigInt(leftScale);
  if (denominator === 0n) {
    throw new Error("Cannot divide by zero");
  }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  const digits = rounded.toString().padStart(scale + 1, "0");
  const integer = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer;
}
