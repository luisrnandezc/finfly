import cds from '@sap/cds';

import { masterDataIDs } from '../support/ids';

const { GET, expect } = cds.test('serve', 'all', '--in-memory');

const baseUrl = '/expenses';

describe('ExpenseService master data', () => {
  it('exposes the seeded expense categories', async () => {
    const { data, status } = await GET(`${baseUrl}/ExpenseCategories`);

    expect(status).to.equal(200);
    expect(data.value).to.have.length(10);

    const fuelCategory = data.value.find(
      (category: { code: string }) => category.code === 'FUEL',
    );

    if (!fuelCategory) {
      throw new Error('FUEL expense category was not loaded');
    }

    expect(fuelCategory.ID).to.equal(masterDataIDs.fuelCategory);
    expect(fuelCategory.name).to.equal('Fuel');
    expect(fuelCategory.description).to.equal('Aircraft fuel');
    expect(fuelCategory.active).to.equal(true);
  });
});
