import { describe, expect, it } from 'vitest';

import { normalizeFuelQuantity } from '../../srv/domain/fuel-quantity.ts';

describe('fuel quantity normalization', () => {
  it('keeps liters unchanged', () => {
    expect(normalizeFuelQuantity('FUEL', 125.5, 'L')).to.equal(125.5);
  });

  it('converts US gallons to liters', () => {
    expect(normalizeFuelQuantity('FUEL', 100, 'US_GAL')).to.equal(378.54);
  });

  it('allows fuel expenses without a quantity', () => {
    expect(normalizeFuelQuantity('FUEL', null, null)).to.equal(null);
  });

  it('requires quantity and unit together', () => {
    expect(() => normalizeFuelQuantity('FUEL', 100, null)).to.throw(
      'Fuel quantity and unit must be provided together',
    );
    expect(() => normalizeFuelQuantity('FUEL', null, 'L')).to.throw(
      'Fuel quantity and unit must be provided together',
    );
  });

  it('rejects fuel data for non-fuel expenses', () => {
    expect(() => normalizeFuelQuantity('FBO', 100, 'L')).to.throw(
      'Fuel quantity can only be recorded for fuel expenses',
    );
  });
});
