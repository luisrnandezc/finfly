export type FuelUnit = 'L' | 'US_GAL';

const LITERS_PER_US_GALLON = 3.785411784;

export function normalizeFuelQuantity(
  categoryCode: string,
  quantity: number | string | null | undefined,
  unit: string | null | undefined,
): number | null {
  const hasQuantity = quantity !== null && quantity !== undefined;
  const hasUnit = unit !== null && unit !== undefined && unit !== '';

  if (categoryCode !== 'FUEL') {
    if (hasQuantity || hasUnit) {
      throw new Error('Fuel quantity can only be recorded for fuel expenses');
    }
    return null;
  }

  if (!hasQuantity && !hasUnit) return null;
  if (!hasQuantity || !hasUnit) {
    throw new Error('Fuel quantity and unit must be provided together');
  }

  const numericQuantity = Number(quantity);
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    throw new Error('Fuel quantity must be greater than zero');
  }
  if (unit !== 'L' && unit !== 'US_GAL') {
    throw new Error('Select a valid fuel unit');
  }

  const liters =
    unit === 'US_GAL' ? numericQuantity * LITERS_PER_US_GALLON : numericQuantity;
  return Number(liters.toFixed(2));
}
