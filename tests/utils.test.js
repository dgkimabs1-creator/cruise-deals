const test = require('node:test');
const assert = require('node:assert/strict');

const {
  escapeHtml,
  safeUrl,
  formatPrice,
  getLowestPrice,
  buildCruiseLineStats,
} = require('../js/utils.js');

test('escapeHtml sanitizes dangerous characters', () => {
  assert.equal(
    escapeHtml('<script>alert("x")</script> & more'),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more'
  );
});

test('safeUrl only allows http and https URLs', () => {
  assert.equal(safeUrl('https://example.com/deal'), 'https://example.com/deal');
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl('data:text/html,test'), '#');
});

test('formatPrice switches between USD and KRW using the fixed rate', () => {
  assert.equal(formatPrice(1234, 'USD'), '$1,234');
  assert.equal(formatPrice(1000, 'KRW'), '\u20a91,480,000');
  assert.equal(formatPrice(null, 'USD'), '-');
});

test('getLowestPrice finds the cheapest available cabin', () => {
  assert.equal(
    getLowestPrice({
      cabinPrices: {
        inside: 1900,
        oceanview: 2400,
        balcony: 2200,
      },
    }),
    1900
  );

  assert.equal(getLowestPrice({ cabinPrices: {} }), Infinity);
});

test('buildCruiseLineStats aggregates count, min price, and avg per-night price', () => {
  const stats = buildCruiseLineStats([
    {
      cruiseLine: 'Alpha',
      nights: 4,
      cabinPrices: { inside: 1200 },
    },
    {
      cruiseLine: 'Alpha',
      nights: 5,
      cabinPrices: { inside: 2000, balcony: 2600 },
    },
    {
      cruiseLine: 'Beta',
      nights: 3,
      cabinPrices: { balcony: 900 },
    },
  ]);

  assert.deepEqual(stats.map((item) => item.cruiseLine), ['Alpha', 'Beta']);
  assert.equal(stats[0].count, 2);
  assert.equal(stats[0].minPrice, 1200);
  assert.equal(stats[0].avgPerNight, 350);
  assert.equal(stats[1].avgPerNight, 300);
});
