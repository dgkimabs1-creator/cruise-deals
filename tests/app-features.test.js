const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getCruiseLineBadge,
  matchesDepartureDateRange,
  getPriceChangeSummary,
  isCruiseActive,
  summarizeCruiseActivity,
  serializeHashState,
  parseHashState,
  getRecentViewCruises,
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

test('isCruiseActive hides departures before today and summarizeCruiseActivity counts both buckets', () => {
  const referenceDate = new Date('2026-04-13T12:00:00Z');

  assert.equal(isCruiseActive({ departureDate: '2026-04-13' }, referenceDate), true);
  assert.equal(isCruiseActive({ departureDate: '2026-04-12' }, referenceDate), false);
  assert.deepEqual(
    summarizeCruiseActivity([
      { departureDate: '2026-04-12' },
      { departureDate: '2026-04-13' },
      { departureDate: '2026-04-20' },
    ], referenceDate),
    {
      activeCount: 2,
      expiredCount: 1,
    }
  );
});

test('serializeHashState and parseHashState round-trip filter state through the URL hash', () => {
  const hash = serializeHashState({
    activeView: 'favorites',
    quickFilter: 'deal50',
    sortKey: 'date',
    sortDir: 'desc',
    cruiseId: 77,
    filters: {
      num: '',
      search: '부산',
      line: 'MSC',
      month: '2026-05',
      departureStart: '2026-05-01',
      departureEnd: '',
      departure: '',
      arrival: '오사카',
      destination: '',
      nightsMin: '3',
      nightsMax: '',
      priceMin: '',
      priceMax: '',
      starMin: '',
      cabinType: 'balcony',
      perNightMax: '',
      recommendMin: '80',
    },
  });

  assert.deepEqual(parseHashState('#' + hash), {
    activeView: 'favorites',
    quickFilter: 'deal50',
    sortKey: 'date',
    sortDir: 'desc',
    cruiseId: 77,
    filters: {
      num: '',
      search: '부산',
      line: 'MSC',
      month: '2026-05',
      departureStart: '2026-05-01',
      departureEnd: '',
      departure: '',
      arrival: '오사카',
      destination: '',
      nightsMin: '3',
      nightsMax: '',
      priceMin: '',
      priceMax: '',
      starMin: '',
      cabinType: 'balcony',
      perNightMax: '',
      recommendMin: '80',
    },
  });
});

test('getRecentViewCruises resolves the latest existing cruises in stored order', () => {
  const recentCruises = getRecentViewCruises(
    [
      { num: 1, shipName: 'A' },
      { num: 2, shipName: 'B' },
      { num: 3, shipName: 'C' },
    ],
    [3, 99, 2, 1],
    10
  );

  assert.deepEqual(
    recentCruises.map(function (cruise) {
      return cruise.num;
    }),
    [3, 2, 1]
  );
});
