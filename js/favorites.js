(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.CruiseFavorites = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'cruise-favorites';

  function createMemoryStorage() {
    var values = Object.create(null);

    return {
      getItem: function (key) {
        return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
      },
      setItem: function (key, value) {
        values[key] = String(value);
      },
      removeItem: function (key) {
        delete values[key];
      }
    };
  }

  function resolveStorage(storage) {
    if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
      return storage;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }

    return createMemoryStorage();
  }

  function normalizeId(id) {
    var numericId = Number(id);
    return Number.isFinite(numericId) ? numericId : null;
  }

  function normalizeIds(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return Array.from(
      new Set(
        value
          .map(normalizeId)
          .filter(function (id) {
            return id !== null;
          })
      )
    ).sort(function (a, b) {
      return a - b;
    });
  }

  function createFavoritesStore(storage, key) {
    var resolvedStorage = resolveStorage(storage);
    var resolvedKey = key || STORAGE_KEY;
    var favorites = loadFavorites();

    function persist() {
      resolvedStorage.setItem(resolvedKey, JSON.stringify(favorites));
    }

    function loadFavorites() {
      try {
        var raw = resolvedStorage.getItem(resolvedKey);
        if (raw === null || raw === undefined || raw === '') {
          return [];
        }

        var parsed = JSON.parse(raw);
        var normalized = normalizeIds(parsed);

        if (!Array.isArray(parsed) || normalized.length !== parsed.length) {
          resolvedStorage.setItem(resolvedKey, JSON.stringify(normalized));
        }

        return normalized;
      } catch (error) {
        resolvedStorage.setItem(resolvedKey, JSON.stringify([]));
        return [];
      }
    }

    function getAll() {
      return favorites.slice();
    }

    function has(id) {
      var normalizedId = normalizeId(id);
      return normalizedId !== null && favorites.indexOf(normalizedId) !== -1;
    }

    function add(id) {
      var normalizedId = normalizeId(id);
      if (normalizedId === null || has(normalizedId)) {
        return;
      }

      favorites.push(normalizedId);
      favorites.sort(function (a, b) {
        return a - b;
      });
      persist();
    }

    function remove(id) {
      var normalizedId = normalizeId(id);
      if (normalizedId === null) {
        return;
      }

      favorites = favorites.filter(function (favoriteId) {
        return favoriteId !== normalizedId;
      });
      persist();
    }

    function toggle(id) {
      if (has(id)) {
        remove(id);
        return false;
      }

      add(id);
      return has(id);
    }

    function clear() {
      favorites = [];
      persist();
    }

    return {
      getAll: getAll,
      has: has,
      toggle: toggle,
      add: add,
      remove: remove,
      clear: clear
    };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    createFavoritesStore: createFavoritesStore
  };
});
