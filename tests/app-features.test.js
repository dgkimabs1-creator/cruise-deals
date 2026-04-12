const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getCruiseLineBadge,
  matchesDepartureDateRange,
  getPriceChangeSummary,
} = require('../js/app.js');

test('getCruiseLineBadge returns the configured emoji badges', () => {
  assert.equal(getCruiseLineBadge('Royal Caribbean'), '👑');
  assert.equal(getCruiseLineBadge('MSC'), '⚓');
  assert.equal(getCruiseLineBadge('Unknown Line'), '');
});

test('matchesDepartureDateRange accepts cruises inside the selected date window', () => {
  const cruise = { departureDate: '2026-05-10' };

  assert.equal(
    matchesDepartureDateRange(cruise, { departureStart: '2026-05-01', departureEnd: '2026-05-31' }),
    true
  );
  assert.equal(
    matchesDepartureDateRange(cruise, { departureStart: '2026-05-11', departureEnd: '' }),
    false
  );
  assert.equal(
    matchesDepartureDateRange(cruise, { departureStart: '', departureEnd: '2026-05-09' }),
    false
  );
});

test('getPriceChangeSummary compares the latest and previous prices', () => {
  const cruise = {
    priceHistory: [
      { prices: { inside: 1000 } },
      { prices: { inside: 1200 } },
      { prices: { inside: 900 } },
    ],
  };

  assert.deepEqual(getPriceChangeSummary(cruise, ''), {
    direction: 'down',
    amount: 300,
    latest: 900,
    previous: 1200,
  });
  assert.deepEqual(getPriceChangeSummary(cruise, 'inside'), {
    direction: 'down',
    amount: 300,
    latest: 900,
    previous: 1200,
  });
});
