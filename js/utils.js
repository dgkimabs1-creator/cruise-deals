(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.CruiseUtils = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EXCHANGE_RATE = 1480;
  var CABIN_TYPES = ['inside', 'oceanview', 'balcony', 'suite'];
  var PORT_ALIASES = {
    busan: ['busan', '부산', 'pus', 'pusan'],
    '부산': ['busan', '부산', 'pus', 'pusan'],
    tokyo: ['tokyo', '도쿄', '東京', 'koto city'],
    '도쿄': ['tokyo', '도쿄', '東京', 'koto city'],
    osaka: ['osaka', '오사카', '大阪'],
    '오사카': ['osaka', '오사카', '大阪'],
    jeju: ['jeju', '제주', 'gangjeong'],
    '제주': ['jeju', '제주', 'gangjeong'],
    shanghai: ['shanghai', '상하이', '上海'],
    '상하이': ['shanghai', '상하이', '上海'],
    fukuoka: ['fukuoka', '후쿠오카'],
    '후쿠오카': ['fukuoka', '후쿠오카'],
    incheon: ['incheon', '인천'],
    '인천': ['incheon', '인천'],
    seoul: ['seoul', '서울', 'incheon', '인천'],
    sasebo: ['sasebo', '사세보'],
    '사세보': ['sasebo', '사세보']
  };

  function getCabinTypes() {
    return CABIN_TYPES.slice();
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) {
      return '';
    }

    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(url) {
    if (!url) {
      return '#';
    }

    try {
      var parsed = new URL(String(url));
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? String(url) : '#';
    } catch (error) {
      return '#';
    }
  }

  function truncateText(str, len) {
    if (str === null || str === undefined) {
      return '';
    }

    var text = String(str);
    var maxLength = Number(len);

    if (!Number.isFinite(maxLength) || maxLength < 0) {
      return text;
    }

    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === '' || value === false) {
      return null;
    }

    var amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  }

  function convertPrice(value, currencyMode) {
    var amount = toNumber(value);

    if (amount === null) {
      return null;
    }

    return currencyMode === 'KRW' ? Math.round(amount * EXCHANGE_RATE) : Math.round(amount);
  }

  function formatPrice(value, currencyMode) {
    var converted = convertPrice(value, currencyMode);

    if (converted === null) {
      return '-';
    }

    return (currencyMode === 'KRW' ? '₩' : '$') + converted.toLocaleString();
  }

  function formatPerNight(value, currencyMode) {
    var formatted = formatPrice(value, currencyMode);
    return formatted === '-' ? formatted : formatted + ' / night';
  }

  function getLowestPrice(cruise) {
    var cabinPrices = cruise && cruise.cabinPrices ? cruise.cabinPrices : {};
    var prices = getCabinTypes()
      .map(function (type) {
        return toNumber(cabinPrices[type]);
      })
      .filter(function (price) {
        return price !== null && price > 0;
      });

    return prices.length ? Math.min.apply(Math, prices) : Infinity;
  }

  function getInsidePerNight(cruise) {
    if (!cruise || !Number.isFinite(Number(cruise.nights)) || Number(cruise.nights) <= 0) {
      return Infinity;
    }

    var insidePrice = cruise.cabinPrices ? toNumber(cruise.cabinPrices.inside) : null;
    var nightlyBase = insidePrice && insidePrice > 0 ? insidePrice : getLowestPrice(cruise);

    return nightlyBase === Infinity ? Infinity : nightlyBase / Number(cruise.nights);
  }

  function getBestScore(scores) {
    if (!scores || typeof scores !== 'object') {
      return 0;
    }

    var values = Object.values(scores).filter(function (value) {
      return Number.isFinite(Number(value));
    });

    return values.length ? Math.max.apply(Math, values.map(Number)) : 0;
  }

  function matchText(text, query) {
    if (!query) {
      return true;
    }

    var lowerText = String(text || '').toLowerCase();
    var normalizedQuery = String(query).toLowerCase().trim();

    if (!normalizedQuery) {
      return true;
    }

    if (lowerText.indexOf(normalizedQuery) !== -1) {
      return true;
    }

    var aliases = PORT_ALIASES[normalizedQuery];
    return !!aliases && aliases.some(function (alias) {
      return lowerText.indexOf(alias) !== -1;
    });
  }

  function getLowestPerNight(cruise) {
    var nights = cruise && Number(cruise.nights);
    if (!Number.isFinite(nights) || nights <= 0) {
      return Infinity;
    }

    var lowestPrice = getLowestPrice(cruise);
    return lowestPrice === Infinity ? Infinity : lowestPrice / nights;
  }

  function buildCruiseLineStats(cruises) {
    var statsByLine = Object.create(null);

    (Array.isArray(cruises) ? cruises : []).forEach(function (cruise) {
      var cruiseLine = cruise && cruise.cruiseLine ? String(cruise.cruiseLine) : '';
      if (!cruiseLine) {
        return;
      }

      if (!statsByLine[cruiseLine]) {
        statsByLine[cruiseLine] = {
          cruiseLine: cruiseLine,
          count: 0,
          minPrice: Infinity,
          totalPerNight: 0,
          perNightCount: 0
        };
      }

      var entry = statsByLine[cruiseLine];
      var lowestPrice = getLowestPrice(cruise);
      var lowestPerNight = getLowestPerNight(cruise);

      entry.count += 1;
      if (lowestPrice < entry.minPrice) {
        entry.minPrice = lowestPrice;
      }
      if (lowestPerNight !== Infinity) {
        entry.totalPerNight += lowestPerNight;
        entry.perNightCount += 1;
      }
    });

    return Object.keys(statsByLine)
      .map(function (cruiseLine) {
        var entry = statsByLine[cruiseLine];
        return {
          cruiseLine: entry.cruiseLine,
          count: entry.count,
          minPrice: entry.minPrice,
          avgPerNight: entry.perNightCount ? Math.round(entry.totalPerNight / entry.perNightCount) : Infinity
        };
      })
      .sort(function (a, b) {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.cruiseLine.localeCompare(b.cruiseLine);
      });
  }

  return {
    EXCHANGE_RATE: EXCHANGE_RATE,
    PORT_ALIASES: PORT_ALIASES,
    escapeHtml: escapeHtml,
    safeUrl: safeUrl,
    truncateText: truncateText,
    convertPrice: convertPrice,
    formatPrice: formatPrice,
    formatPerNight: formatPerNight,
    getLowestPrice: getLowestPrice,
    getInsidePerNight: getInsidePerNight,
    getBestScore: getBestScore,
    matchText: matchText,
    buildCruiseLineStats: buildCruiseLineStats,
    getCabinTypes: getCabinTypes
  };
});
