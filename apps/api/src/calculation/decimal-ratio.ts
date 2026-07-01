const UNSIGNED_DECIMAL = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/;

type ParsedDecimal = {
  coefficient: bigint;
  scale: number;
};

export class DecimalAllocationError extends Error {}

export function allocateDecimalByWeights(
  amount: string,
  weightedKeys: Array<{ key: string; weight: string }>
): { scale: number; allocations: Map<string, string> } {
  const parsedAmount = parsePositiveDecimal(amount, "amount");
  if (weightedKeys.length === 0) {
    throw new DecimalAllocationError("At least one weight is required");
  }
  if (new Set(weightedKeys.map(({ key }) => key)).size !== weightedKeys.length) {
    throw new DecimalAllocationError("Allocation keys must be unique");
  }

  const parsedWeights = weightedKeys
    .map(({ key, weight }) => ({
      key,
      value: parsePositiveDecimal(weight, "weight")
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
  const weightScale = Math.max(...parsedWeights.map(({ value }) => value.scale));
  const integerWeights = parsedWeights.map(({ key, value }) => ({
    key,
    units: value.coefficient * powerOfTen(weightScale - value.scale)
  }));
  const totalWeight = integerWeights.reduce(
    (sum, { units }) => sum + units,
    0n
  );
  const outputScale = Math.max(parsedAmount.scale, 8);
  const amountUnits =
    parsedAmount.coefficient * powerOfTen(outputScale - parsedAmount.scale);
  const allocatedUnits = integerWeights.map(({ key, units }) => ({
    key,
    units: (amountUnits * units) / totalWeight
  }));
  const allocatedTotal = allocatedUnits.reduce(
    (sum, allocation) => sum + allocation.units,
    0n
  );
  let residual = amountUnits - allocatedTotal;

  for (const allocation of allocatedUnits) {
    if (residual === 0n) break;
    allocation.units += 1n;
    residual -= 1n;
  }
  const finalTotal = allocatedUnits.reduce(
    (sum, allocation) => sum + allocation.units,
    0n
  );
  if (finalTotal !== amountUnits) {
    throw new DecimalAllocationError("Allocated units must equal amount units");
  }

  return {
    scale: outputScale,
    allocations: new Map(
      allocatedUnits.map(({ key, units }) => [
        key,
        formatDecimalUnits(units, outputScale)
      ])
    )
  };
}

function parsePositiveDecimal(value: string, label: string): ParsedDecimal {
  const match = UNSIGNED_DECIMAL.exec(value);
  if (!match || !/[1-9]/.test(value)) {
    throw new DecimalAllocationError(`${label} must be a positive decimal`);
  }
  return {
    coefficient: BigInt(value.replace(".", "")),
    scale: match[1]?.length ?? 0
  };
}

function powerOfTen(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function formatDecimalUnits(units: bigint, scale: number): string {
  if (scale === 0) return units.toString();
  const digits = units.toString().padStart(scale + 1, "0");
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}
