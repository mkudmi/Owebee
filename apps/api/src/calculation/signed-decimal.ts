const SIGNED_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.(\d+))?$/;

type ParsedSignedDecimal = {
  units: bigint;
  scale: number;
};

export class SignedDecimalError extends Error {}

export function addDecimals(left: string, right: string): string {
  const parsedLeft = parseSignedDecimal(left);
  const parsedRight = parseSignedDecimal(right);
  const scale = Math.max(parsedLeft.scale, parsedRight.scale, 8);
  const units =
    align(parsedLeft, scale) +
    align(parsedRight, scale);
  return formatSignedDecimal(units, scale);
}

export function negateDecimal(value: string): string {
  const parsed = parseSignedDecimal(value);
  if (parsed.units === 0n) return value.startsWith("-") ? value.slice(1) : value;
  return value.startsWith("-") ? value.slice(1) : `-${value}`;
}

export function isZeroDecimal(value: string): boolean {
  return parseSignedDecimal(value).units === 0n;
}

function parseSignedDecimal(value: string): ParsedSignedDecimal {
  const match = SIGNED_DECIMAL.exec(value);
  if (!match) {
    throw new SignedDecimalError("Value must be a decimal string");
  }
  const negative = value.startsWith("-");
  const digits = (negative ? value.slice(1) : value).replace(".", "");
  const coefficient = BigInt(digits);
  return {
    units: negative ? -coefficient : coefficient,
    scale: match[1]?.length ?? 0
  };
}

function align(value: ParsedSignedDecimal, scale: number): bigint {
  return value.units * 10n ** BigInt(scale - value.scale);
}

function formatSignedDecimal(units: bigint, scale: number): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units)
    .toString()
    .padStart(scale + 1, "0");
  const value =
    scale === 0
      ? digits
      : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return negative ? `-${value}` : value;
}
