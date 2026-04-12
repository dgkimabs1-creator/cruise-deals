const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getOfficialWebsiteUrl,
  buildKidsPricingNote,
  getCabinMedia,
} = require('../js/modal.js');

test('getOfficialWebsiteUrl resolves official cruise line domains', () => {
  assert.equal(getOfficialWebsiteUrl('Princess'), 'https://www.princess.com');
  assert.equal(getOfficialWebsiteUrl('Norwegian'), 'https://www.ncl.com');
  assert.equal(getOfficialWebsiteUrl('Unknown Line'), '');
});

test('buildKidsPricingNote only renders the infant pricing note for kids-friendly ships', () => {
  assert.equal(
    buildKidsPricingNote({ shipInfo: { kidsFriendly: true } }),
    '💰 2세 미만 무료 가능 (선사별 상이)'
  );
  assert.equal(buildKidsPricingNote({ shipInfo: { kidsFriendly: false } }), '');
  assert.equal(buildKidsPricingNote({}), '');
});

test('getCabinMedia returns both cabin photos and a floor plan when present', () => {
  const media = getCabinMedia(
    {
      shipPhotos: {
        cabins: {
          balcony: ['images/cabins/example_balcony_0.jpg'],
        },
        floorPlans: {
          balcony: 'images/cabins/example_balcony_floor.webp',
        },
      },
    },
    'balcony'
  );

  assert.deepEqual(media, {
    photos: ['images/cabins/example_balcony_0.jpg'],
    floorPlan: 'images/cabins/example_balcony_floor.webp',
  });
});
