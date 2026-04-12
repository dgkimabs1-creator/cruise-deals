const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildShipInfoIndex,
  getShipInfoForCruise,
  getShipPhotos,
} = require('../scripts/export-public-data.js');

test('buildShipInfoIndex normalizes ship names and calculates crew ratio', () => {
  const index = buildShipInfoIndex({
    Example_Key: {
      name: 'Example Ship',
      passengerCapacity: '2500',
      crewSize: '1000',
    },
  });

  assert.deepEqual(index['example ship'], {
    passengers: 2500,
    crew: 1000,
    ratio: 2.5,
    tonnage: null,
    yearBuilt: null,
    lastRefurbished: null,
    refurbishmentCost: null,
    kidsFriendly: false,
    kidsNotes: null,
  });
});

test('getShipInfoForCruise matches cruise ship names to shipdb data', () => {
  const shipInfoIndex = buildShipInfoIndex({
    Example_Key: {
      name: 'Example Ship',
      passengerCapacity: '2500',
      crewSize: '1000',
    },
  });

  assert.deepEqual(getShipInfoForCruise({ shipName: 'Example Ship' }, shipInfoIndex), {
    passengers: 2500,
    crew: 1000,
    ratio: 2.5,
    tonnage: null,
    yearBuilt: null,
    lastRefurbished: null,
    refurbishmentCost: null,
    kidsFriendly: false,
    kidsNotes: null,
  });
  assert.equal(getShipInfoForCruise({ shipName: 'Missing Ship' }, shipInfoIndex), null);
});

test('getShipPhotos prefers local exterior files and adds cabin floor plan assets', () => {
  const result = getShipPhotos(
    'Spectrum of the Seas',
    {
      'Spectrum of the Seas': {
        inside: ['images/cabins/spectrum_of_the_seas_inside_0.jpg'],
      },
    },
    {
      'spectrum of the seas': {
        exteriorImage: 'https://example.com/wikipedia-fallback.jpg',
      },
    }
  );

  assert.equal(result.exterior, 'images/cabins/spectrum_of_the_seas_exterior.jpg');
  assert.deepEqual(result.cabins.inside, ['images/cabins/spectrum_of_the_seas_inside_0.jpg']);
  assert.equal(result.floorPlans.inside, 'images/cabins/spectrum_of_the_seas_inside_floor.webp');
  assert.equal(result.floorPlans.balcony, 'images/cabins/spectrum_of_the_seas_balcony_floor.webp');
});
