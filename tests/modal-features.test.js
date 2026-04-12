const test = require('node:test');
const assert = require('node:assert/strict');

const { getOfficialWebsiteUrl } = require('../js/modal.js');

test('getOfficialWebsiteUrl resolves official cruise line domains', () => {
  assert.equal(getOfficialWebsiteUrl('Princess'), 'https://www.princess.com');
  assert.equal(getOfficialWebsiteUrl('Norwegian'), 'https://www.ncl.com');
  assert.equal(getOfficialWebsiteUrl('Unknown Line'), '');
});
