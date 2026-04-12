const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildShipInfoIndex,
  getShipInfoForCruise,
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
  });
  assert.equal(getShipInfoForCruise({ shipName: 'Missing Ship' }, shipInfoIndex), null);
});
