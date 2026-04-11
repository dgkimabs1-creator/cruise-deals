const test = require('node:test');
const assert = require('node:assert/strict');

const { createFavoritesStore } = require('../js/favorites.js');

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test('favorites store toggles ids and persists them to storage', () => {
  const storage = createMemoryStorage();
  const store = createFavoritesStore(storage, 'favorites-test');

  assert.deepEqual(store.getAll(), []);

  assert.equal(store.toggle(101), true);
  assert.equal(store.toggle(202), true);
  assert.deepEqual(store.getAll(), [101, 202]);

  const secondStore = createFavoritesStore(storage, 'favorites-test');
  assert.equal(secondStore.has(101), true);
  assert.equal(secondStore.toggle(101), false);
  assert.deepEqual(secondStore.getAll(), [202]);
});

test('favorites store ignores invalid values from storage', () => {
  const storage = createMemoryStorage();
  storage.setItem('favorites-test', '{"bad":true}');

  const store = createFavoritesStore(storage, 'favorites-test');
  assert.deepEqual(store.getAll(), []);
});
