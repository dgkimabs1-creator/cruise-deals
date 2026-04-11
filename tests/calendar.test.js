const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildMonthMatrix,
  groupCruisesByDate,
  getPriceTier,
} = require('../js/calendar.js');

test('buildMonthMatrix returns a 6-week calendar grid', () => {
  const matrix = buildMonthMatrix(2026, 3);

  assert.equal(matrix.length, 6);
  assert.equal(matrix[0].length, 7);
  assert.equal(matrix[0][0].date, '2026-03-01');
  assert.equal(matrix[5][6].date, '2026-04-11');
});

test('groupCruisesByDate groups cruises and tags them by price tier', () => {
  const grouped = groupCruisesByDate([
    { num: 1, departureDate: '2026-03-14', cabinPrices: { inside: 800 } },
    { num: 2, departureDate: '2026-03-14', cabinPrices: { inside: 1700 } },
    { num: 3, departureDate: '2026-03-15', cabinPrices: { inside: 3200 } },
  ]);

  assert.equal(grouped['2026-03-14'].length, 2);
  assert.equal(grouped['2026-03-14'][0].priceTier, 'low');
  assert.equal(grouped['2026-03-14'][1].priceTier, 'mid');
  assert.equal(grouped['2026-03-15'][0].priceTier, 'high');
});

test('getPriceTier uses stable thresholds', () => {
  assert.equal(getPriceTier(999), 'low');
  assert.equal(getPriceTier(1800), 'mid');
  assert.equal(getPriceTier(2600), 'high');
});
