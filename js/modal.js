(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else if (typeof define === 'function' && define.amd) {
    define([], function () {
      return factory(root);
    });
  } else {
    root.CruiseModal = factory(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var DEFAULT_CABIN_TYPES = ['inside', 'oceanview', 'balcony', 'suite'];
  var CABIN_LABELS = {
    inside: '내측',
    oceanview: '오션뷰',
    balcony: '발코니',
    suite: '스위트'
  };
  var CHART_COLORS = {
    inside: '#4f8cff',
    oceanview: '#22c55e',
    balcony: '#f59e0b',
    suite: '#ef4444'
  };
  var OFFICIAL_WEBSITE_URLS = {
    'royal caribbean': 'https://www.royalcaribbean.com',
    disney: 'https://disneycruise.disney.go.com',
    msc: 'https://www.msccruises.com',
    'msc크루즈': 'https://www.msccruises.com',
    princess: 'https://www.princess.com',
    costa: 'https://www.costacruises.com',
    celebrity: 'https://www.celebritycruises.com',
    norwegian: 'https://www.ncl.com',
    'holland america': 'https://www.hollandamerica.com',
    carnival: 'https://www.carnival.com',
    viking: 'https://www.vikingcruises.com',
    oceania: 'https://www.oceaniacruises.com',
    silversea: 'https://www.silversea.com',
    seabourn: 'https://www.seabourn.com',
    ponant: 'https://www.ponant.com',
    windstar: 'https://www.windstarcruises.com',
    azamara: 'https://www.azamara.com',
    cunard: 'https://www.cunard.com',
    regent: 'https://www.rssc.com',
    crystal: 'https://www.crystalcruises.com',
    explora: 'https://www.explorajourneys.com',
    'explora journeys': 'https://www.explorajourneys.com',
    'p&o': 'https://www.pocruises.com'
  };
  var internalState = {
    cruises: [],
    filteredCruises: [],
    currencyMode: 'USD',
    exchangeRate: null,
    exportedAt: '',
    activeView: '',
    compareSelection: []
  };
  var hooks = {
    getState: null,
    onFavoriteChange: null
  };
  var runtime = {
    initialized: false,
    chart: null,
    currentView: null,
    favoritesStore: null,
    previousFocus: null,
    previousBodyOverflow: '',
    carouselPositions: Object.create(null)
  };

  function fallbackEscapeHtml(value) {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fallbackSafeUrl(url) {
    if (!url) {
      return '#';
    }

    try {
      var parsed = new URL(String(url));
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '#';
    } catch (error) {
      return '#';
    }
  }

  function fallbackFormatPrice(value, currencyMode) {
    var amount = toNumber(value);

    if (amount === null) {
      return '-';
    }

    return (currencyMode === 'KRW' ? '₩' : '$') + Math.round(amount).toLocaleString();
  }

  function getUtils() {
    var utils = root.CruiseUtils || {};

    return {
      escapeHtml: typeof utils.escapeHtml === 'function' ? utils.escapeHtml : fallbackEscapeHtml,
      safeUrl: typeof utils.safeUrl === 'function' ? utils.safeUrl : fallbackSafeUrl,
      formatPrice: typeof utils.formatPrice === 'function' ? utils.formatPrice : fallbackFormatPrice,
      getLowestPrice: typeof utils.getLowestPrice === 'function' ? utils.getLowestPrice : fallbackGetLowestPrice,
      getCabinTypes: typeof utils.getCabinTypes === 'function'
        ? utils.getCabinTypes
        : function () {
            return DEFAULT_CABIN_TYPES.slice();
          },
      fixedExchangeRate: Number.isFinite(Number(utils.EXCHANGE_RATE)) ? Number(utils.EXCHANGE_RATE) : 1480
    };
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === '' || value === false) {
      return null;
    }

    var amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  }

  function normalizeCurrencyMode(value) {
    return String(value || '').toUpperCase() === 'KRW' ? 'KRW' : 'USD';
  }

  function normalizeCruiseLineKey(value) {
    return String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  function normalizeCruiseId(value) {
    var numericId = Number(value);
    return Number.isFinite(numericId) ? numericId : null;
  }

  function normalizeCruiseIds(values) {
    var list;

    if (Array.isArray(values)) {
      list = values;
    } else if (typeof values === 'string') {
      list = values.split(',');
    } else if (values === null || values === undefined) {
      list = [];
    } else {
      list = [values];
    }

    return Array.from(
      new Set(
        list
          .map(normalizeCruiseId)
          .filter(function (id) {
            return id !== null;
          })
      )
    );
  }

  function escapeHtml(value) {
    return getUtils().escapeHtml(value);
  }

  function safeUrl(value) {
    return getUtils().safeUrl(value);
  }

  function safeAssetUrl(value) {
    if (!value) return '';
    var str = String(value);
    // 상대경로 (images/...) 허용
    if (str.indexOf('images/') === 0 || str.indexOf('./images/') === 0) return str;
    var resolved = safeUrl(str);
    return resolved === '#' ? '' : resolved;
  }

  function getCabinTypes() {
    return getUtils().getCabinTypes().filter(function (type) {
      return Object.prototype.hasOwnProperty.call(CABIN_LABELS, type);
    });
  }

  function fallbackGetLowestPrice(cruise) {
    var cabinTypes = getCabinTypes();
    var prices = cabinTypes
      .map(function (type) {
        return toNumber(cruise && cruise.cabinPrices ? cruise.cabinPrices[type] : null);
      })
      .filter(function (value) {
        return value !== null && value > 0;
      });

    return prices.length ? Math.min.apply(Math, prices) : Infinity;
  }

  function getElements() {
    if (typeof document === 'undefined') {
      return {};
    }

    return {
      overlay: document.getElementById('modalOverlay'),
      content: document.getElementById('modalContent'),
      close: document.getElementById('modalClose')
    };
  }

  function createNoopFavoritesStore() {
    return {
      isFavorite: function () {
        return false;
      },
      toggle: function () {
        return false;
      },
      getAll: function () {
        return [];
      }
    };
  }

  function getFavoritesStore() {
    if (runtime.favoritesStore) {
      return runtime.favoritesStore;
    }

    var api = root.CruiseFavorites;

    if (api && typeof api.isFavorite === 'function' && typeof api.toggle === 'function' && typeof api.getAll === 'function') {
      runtime.favoritesStore = api;
      return runtime.favoritesStore;
    }

    if (api && typeof api.createFavoritesStore === 'function') {
      try {
        var store = api.createFavoritesStore();
        runtime.favoritesStore = {
          isFavorite: function (id) {
            return typeof store.has === 'function' ? store.has(id) : false;
          },
          toggle: function (id) {
            return typeof store.toggle === 'function' ? store.toggle(id) : false;
          },
          getAll: function () {
            return typeof store.getAll === 'function' ? store.getAll() : [];
          }
        };
        return runtime.favoritesStore;
      } catch (error) {
        runtime.favoritesStore = createNoopFavoritesStore();
        return runtime.favoritesStore;
      }
    }

    runtime.favoritesStore = createNoopFavoritesStore();
    return runtime.favoritesStore;
  }

  function readExternalState() {
    var state = null;

    if (typeof hooks.getState === 'function') {
      try {
        state = hooks.getState();
      } catch (error) {
        state = null;
      }
    } else if (root.CruiseApp && typeof root.CruiseApp.getState === 'function') {
      try {
        state = root.CruiseApp.getState();
      } catch (error) {
        state = null;
      }
    }

    return state && typeof state === 'object' ? state : null;
  }

  function firstArray(candidates) {
    var index;

    for (index = 0; index < candidates.length; index += 1) {
      if (Array.isArray(candidates[index])) {
        return candidates[index];
      }
    }

    return null;
  }

  function firstValue(candidates) {
    var index;

    for (index = 0; index < candidates.length; index += 1) {
      if (candidates[index] !== null && candidates[index] !== undefined && candidates[index] !== '') {
        return candidates[index];
      }
    }

    return null;
  }

  function getResolvedState() {
    var externalState = readExternalState() || {};
    var cruises = firstArray([externalState.cruises, internalState.cruises]) || [];
    var filteredCruises = firstArray([externalState.filteredCruises, internalState.filteredCruises, cruises]) || cruises;
    var currencyMode = normalizeCurrencyMode(
      firstValue([externalState.currencyMode, internalState.currencyMode, 'USD'])
    );
    var exchangeRate = toNumber(firstValue([externalState.exchangeRate, internalState.exchangeRate]));

    return {
      cruises: cruises,
      filteredCruises: filteredCruises,
      currencyMode: currencyMode,
      exchangeRate: exchangeRate,
      exportedAt: firstValue([externalState.exportedAt, internalState.exportedAt, '']) || '',
      activeView: firstValue([externalState.activeView, internalState.activeView, '']) || '',
      compareSelection: normalizeCruiseIds(
        firstValue([externalState.compareSelection, internalState.compareSelection, []])
      )
    };
  }

  function formatPrice(value, state) {
    var amount = toNumber(value);
    var resolvedState = state || getResolvedState();
    var utils = getUtils();

    if (amount === null) {
      return '-';
    }

    if (
      resolvedState.currencyMode !== 'KRW' ||
      !Number.isFinite(resolvedState.exchangeRate) ||
      resolvedState.exchangeRate === utils.fixedExchangeRate
    ) {
      return utils.formatPrice(amount, resolvedState.currencyMode);
    }

    return '₩' + Math.round(amount * resolvedState.exchangeRate).toLocaleString();
  }

  function formatPerNight(value, state) {
    var formatted = formatPrice(value, state);
    return formatted === '-' ? formatted : formatted + ' / 박';
  }

  function formatCabinLabel(type) {
    return CABIN_LABELS[type] || type;
  }

  function formatScore(value) {
    var amount = toNumber(value);
    return amount === null ? '-' : Math.round(amount) + '점';
  }

  function formatStarRating(value) {
    var amount = toNumber(value);
    return amount === null ? '-' : amount.toFixed(1) + '★';
  }

  function formatShipInfoSummary(shipInfo) {
    var passengers = toNumber(shipInfo && shipInfo.passengers);
    var ratio = toNumber(shipInfo && shipInfo.ratio);

    if (passengers === null) {
      return '';
    }

    return '정원 ' + Math.round(passengers).toLocaleString('ko-KR') + '명' + (ratio === null ? '' : ' (1:' + ratio.toFixed(1) + ')');
  }

  function getOfficialWebsiteUrl(cruiseLine) {
    return OFFICIAL_WEBSITE_URLS[normalizeCruiseLineKey(cruiseLine)] || '';
  }

  function formatBoolean(value) {
    return value ? '예' : '아니오';
  }

  function formatDate(value) {
    if (!value) {
      return '-';
    }

    try {
      var date = new Date(value);

      if (!Number.isFinite(date.getTime())) {
        return String(value);
      }

      return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    } catch (error) {
      return String(value);
    }
  }

  function formatDateTime(value) {
    if (!value) {
      return '-';
    }

    try {
      var date = new Date(value);

      if (!Number.isFinite(date.getTime())) {
        return String(value);
      }

      return new Intl.DateTimeFormat('ko-KR', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      return String(value);
    }
  }

  function buildInfoRows(items) {
    return items
      .map(function (item) {
        return (
          '<div class="modal-row">' +
            '<span class="modal-row-label">' + escapeHtml(item.label) + '</span>' +
            '<span>' + escapeHtml(item.value) + '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  function buildCruiseLookup(cruises) {
    var lookup = Object.create(null);

    (Array.isArray(cruises) ? cruises : []).forEach(function (cruise) {
      var id = normalizeCruiseId(cruise && cruise.num);
      if (id !== null) {
        lookup[id] = cruise;
      }
    });

    return lookup;
  }

  function findCruiseById(id) {
    var resolvedId = normalizeCruiseId(id);
    var state = getResolvedState();
    var lookup = buildCruiseLookup(state.cruises);

    return resolvedId !== null ? lookup[resolvedId] || null : null;
  }

  function getAvailableCabins(cruise) {
    return getCabinTypes().filter(function (type) {
      return toNumber(cruise && cruise.cabinPrices ? cruise.cabinPrices[type] : null) !== null;
    });
  }

  function getLowestCabin(cruise) {
    var lowestType = null;
    var lowestPrice = Infinity;

    getAvailableCabins(cruise).forEach(function (type) {
      var amount = toNumber(cruise.cabinPrices[type]);
      if (amount !== null && amount < lowestPrice) {
        lowestPrice = amount;
        lowestType = type;
      }
    });

    return lowestType ? { type: lowestType, price: lowestPrice } : null;
  }

  function buildTelegramAlertUrl(cruise, state) {
    var bookingLink = safeUrl(cruise && cruise.bookingUrl);
    var shareTarget = bookingLink !== '#'
      ? bookingLink
      : (root.location && root.location.href ? String(root.location.href) : 'https://example.com');
    var lowestCabin = getLowestCabin(cruise);
    var message = [
      '가격 알림 후보',
      '#' + escapePlainText(cruise && cruise.num),
      escapePlainText(cruise && cruise.shipName),
      escapePlainText(formatDate(cruise && cruise.departureDate)),
      lowestCabin ? escapePlainText(formatCabinLabel(lowestCabin.type) + ' ' + formatPrice(lowestCabin.price, state)) : '가격 미확인'
    ].join(' | ');

    return safeUrl(
      'https://t.me/share/url?url=' + encodeURIComponent(shareTarget) + '&text=' + encodeURIComponent(message)
    );
  }

  function escapePlainText(value) {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).replace(/\s+/g, ' ').trim();
  }

  function buildFavoriteButton(id) {
    var store = getFavoritesStore();
    var active = store.isFavorite(id);
    var label = active ? '즐겨찾기 해제' : '즐겨찾기 추가';

    return (
      '<button type="button" class="modal-chip' + (active ? ' primary' : '') + '"' +
        ' data-modal-action="toggle-favorite"' +
        ' data-num="' + escapeHtml(id) + '"' +
        ' aria-pressed="' + escapeHtml(active ? 'true' : 'false') + '">' +
        escapeHtml(label) +
      '</button>'
    );
  }

  function buildActionLink(url, label, primary) {
    var resolvedUrl = safeUrl(url);

    if (resolvedUrl === '#') {
      return (
        '<button type="button" class="modal-chip' + (primary ? ' primary' : '') + '" disabled>' +
          escapeHtml(label + ' 없음') +
        '</button>'
      );
    }

    return (
      '<a class="modal-chip' + (primary ? ' primary' : '') + '"' +
        ' href="' + escapeHtml(resolvedUrl) + '"' +
        ' target="_blank" rel="noopener noreferrer">' +
        escapeHtml(label) +
      '</a>'
    );
  }

  function buildStaticChip(label, primary) {
    return '<span class="modal-chip' + (primary ? ' primary' : '') + '">' + escapeHtml(label) + '</span>';
  }

  function buildHeaderActions(cruise, state) {
    var lowestCabin = getLowestCabin(cruise);
    var alertUrl = buildTelegramAlertUrl(cruise, state);
    var actions = [];

    if (lowestCabin) {
      actions.push(
        buildStaticChip('최저가 ' + formatCabinLabel(lowestCabin.type) + ' ' + formatPrice(lowestCabin.price, state), false)
      );
    }

    actions.push(buildFavoriteButton(cruise.num));
    var bookingSite = '예약하기';
    if (cruise.bookingUrl) {
      if (cruise.bookingUrl.indexOf('vacationstogo') !== -1) bookingSite = '🔗 VacationsToGo에서 예약';
      else if (cruise.bookingUrl.indexOf('cruisetmk') !== -1) bookingSite = '🔗 크루즈TMK에서 예약';
      else if (cruise.bookingUrl.indexOf('cruisebooking') !== -1) bookingSite = '🔗 크루즈부킹에서 예약';
    }
    actions.push(buildActionLink(cruise.bookingUrl, bookingSite, true));
    actions.push(buildActionLink(getOfficialWebsiteUrl(cruise.cruiseLine), '🌐 공식 사이트', false));
    actions.push(buildActionLink('https://www.cruisecompete.com/', '💡 CruiseCompete 견적 비교', true));
    actions.push('<button type="button" class="modal-chip" data-modal-action="copy-link" data-num="' + escapeHtml(cruise.num) + '">🔗 링크 복사</button>');
    // 참고 사이트 링크
    actions.push('<div class="modal-ref-links">' +
      '<span style="color:var(--muted);font-size:0.8rem;">참고: </span>' +
      '<a href="https://www.cruisetmk.kr" target="_blank" rel="noopener" style="font-size:0.8rem;">크루즈TMK</a> · ' +
      '<a href="https://www.cruisebooking.co.kr" target="_blank" rel="noopener" style="font-size:0.8rem;">크루즈부킹</a> · ' +
      '<a href="https://www.vacationstogo.com" target="_blank" rel="noopener" style="font-size:0.8rem;">VTG</a> · ' +
      '<a href="https://www.cruisedirect.com" target="_blank" rel="noopener" style="font-size:0.8rem;">CruiseDirect</a>' +
      '</div>');

    return actions.join('');
  }

  function buildHeroCard(cruise) {
    var exteriorUrl = safeAssetUrl(cruise && cruise.shipPhotos ? cruise.shipPhotos.exterior : '');

    if (!exteriorUrl) {
      return (
        '<section class="modal-card">' +
          '<h3>선박 외관</h3>' +
          '<p>등록된 외관 사진이 없습니다.</p>' +
        '</section>'
      );
    }

    return (
      '<section class="modal-card">' +
        '<h3>선박 외관</h3>' +
        '<img class="modal-hero-image" src="' + escapeHtml(exteriorUrl) + '"' +
          ' alt="' + escapeHtml((cruise.shipName || '크루즈') + ' 외관 사진') + '"' +
          ' loading="lazy" onerror="this.style.display=\'none\'">' +
      '</section>'
    );
  }

  function buildItineraryImageCard(cruise) {
    var itineraryUrl = safeAssetUrl(cruise && cruise.itineraryImageUrl);

    if (!itineraryUrl) {
      return '';
    }

    return (
      '<section class="modal-card">' +
        '<h3>항로 이미지</h3>' +
        '<img class="modal-itinerary-image" src="' + escapeHtml(itineraryUrl) + '"' +
          ' alt="' + escapeHtml((cruise.shipName || '크루즈') + ' 항로 이미지') + '"' +
          ' loading="lazy">' +
      '</section>'
    );
  }

  function buildOverviewCard(cruise) {
    return (
      '<section class="modal-card">' +
        '<h3>기본 정보</h3>' +
        buildInfoRows([
          { label: '선사', value: cruise.cruiseLine || '-' },
          { label: '선박', value: cruise.shipName || '-' },
          { label: '평점', value: formatStarRating(cruise.shipRating) },
          { label: '출발일', value: formatDate(cruise.departureDate) },
          { label: '출발지', value: cruise.departurePort || '-' },
          { label: '도착지', value: cruise.arrivalPort || '-' },
          { label: '박수', value: toNumber(cruise.nights) === null ? '-' : Math.round(Number(cruise.nights)) + '박' },
          { label: '할인율', value: toNumber(cruise.discountPct) === null ? '-' : Math.round(Number(cruise.discountPct)) + '%' },
          { label: '부산 연관', value: formatBoolean(!!cruise.isBusanRelated) },
          { label: '키즈', value: cruise.shipInfo && cruise.shipInfo.kidsFriendly ? '👶 ' + (cruise.shipInfo.kidsNotes || '가능') : '🚫 성인 전용' }
        ]) +
      '</section>'
    );
  }

  function buildCabinPriceRows(cruise, state) {
    var cabins = getAvailableCabins(cruise);

    if (!cabins.length) {
      return '<p>객실 가격 데이터가 없습니다.</p>';
    }

    return cabins
      .map(function (type) {
        var perNight = cruise && cruise.perNight ? cruise.perNight[type] : null;
        var dealScore = cruise && cruise.dealScores ? cruise.dealScores[type] : null;
        var valueScore = cruise && cruise.valueScores ? cruise.valueScores[type] : null;
        var metaText = '딜 ' + formatScore(dealScore) + ' · 가치 ' + formatScore(valueScore);

        return (
          '<div class="modal-row">' +
            '<div>' +
              '<div>' + escapeHtml(formatCabinLabel(type)) + '</div>' +
              '<div class="modal-row-label">' + escapeHtml(metaText) + '</div>' +
            '</div>' +
            '<div>' +
              '<div>' + escapeHtml(formatPrice(cruise.cabinPrices[type], state)) + '</div>' +
              '<div class="modal-row-label">' + escapeHtml(formatPerNight(perNight, state)) + '</div>' +
            '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function buildCabinPricesCard(cruise, state) {
    return (
      '<section class="modal-card">' +
        '<h3>객실 가격 및 점수</h3>' +
        buildCabinPriceRows(cruise, state) +
      '</section>'
    );
  }

  function normalizePhotoList(value) {
    if (Array.isArray(value)) {
      return value
        .map(safeAssetUrl)
        .filter(Boolean);
    }

    if (typeof value === 'string') {
      var resolved = safeAssetUrl(value);
      return resolved ? [resolved] : [];
    }

    return [];
  }

  function buildCarousel(id, title, photos, altPrefix) {
    var disabled = photos.length <= 1;
    var slides = photos
      .map(function (url, index) {
        return (
          '<div class="carousel-slide">' +
            '<img src="' + escapeHtml(url) + '"' +
              ' alt="' + escapeHtml(altPrefix + ' ' + (index + 1)) + '"' +
              ' loading="lazy">' +
          '</div>'
        );
      })
      .join('');

    return (
      '<div class="carousel" data-carousel-id="' + escapeHtml(id) + '" data-carousel-count="' + escapeHtml(photos.length) + '">' +
        '<div class="carousel-stage">' +
          '<div class="carousel-track">' + slides + '</div>' +
        '</div>' +
        '<div class="carousel-controls">' +
          '<button type="button" class="carousel-button"' +
            ' data-modal-action="carousel-prev"' +
            ' data-carousel="' + escapeHtml(id) + '"' +
            ' aria-label="' + escapeHtml(title + ' 이전 사진') + '"' +
            (disabled ? ' disabled' : '') + '>‹</button>' +
          '<div class="carousel-meta" data-carousel-meta="' + escapeHtml(id) + '">1 / ' + escapeHtml(photos.length) + '</div>' +
          '<button type="button" class="carousel-button"' +
            ' data-modal-action="carousel-next"' +
            ' data-carousel="' + escapeHtml(id) + '"' +
            ' aria-label="' + escapeHtml(title + ' 다음 사진') + '"' +
            (disabled ? ' disabled' : '') + '>›</button>' +
        '</div>' +
      '</div>'
    );
  }

  function buildCabinPhotosCard(cruise) {
    var cabins = cruise && cruise.shipPhotos && cruise.shipPhotos.cabins ? cruise.shipPhotos.cabins : {};
    var cabinCards = getCabinTypes()
      .map(function (type) {
        var photos = normalizePhotoList(cabins[type]);

        if (!photos.length) {
          return '';
        }

        return (
          '<article class="compare-card">' +
            '<h3>' + escapeHtml(formatCabinLabel(type)) + '</h3>' +
            buildCarousel(
              'detail-' + escapePlainText(cruise.num) + '-' + type,
              formatCabinLabel(type),
              photos,
              (cruise.shipName || '크루즈') + ' ' + formatCabinLabel(type) + ' 객실 사진'
            ) +
          '</article>'
        );
      })
      .filter(Boolean)
      .join('');

    if (!cabinCards) {
      return (
        '<section class="modal-card">' +
          '<h3>객실 사진</h3>' +
          '<p>등록된 객실 사진이 없습니다.</p>' +
        '</section>'
      );
    }

    return (
      '<section class="modal-card">' +
        '<h3>객실 사진</h3>' +
        '<div class="compare-grid">' + cabinCards + '</div>' +
      '</section>'
    );
  }

  function hasStructuredItinerary(stopPorts) {
    return (Array.isArray(stopPorts) ? stopPorts : []).some(function (stop) {
      return !!(stop && (stop.date || stop.arrive || stop.depart));
    });
  }

  function buildItineraryCard(cruise) {
    var stopPorts = Array.isArray(cruise && cruise.stopPorts) ? cruise.stopPorts : [];

    if (!stopPorts.length || !hasStructuredItinerary(stopPorts)) {
      var stopText = stopPorts
        .map(function (stop) {
          return stop && stop.port ? String(stop.port) : '';
        })
        .filter(Boolean)
        .join(' → ');

      return (
        '<section class="modal-card">' +
          '<h3>일정표</h3>' +
          '<p>' + escapeHtml(stopText || cruise.itinerary || '상세 일정표 데이터가 없습니다.') + '</p>' +
          '<p class="modal-subtitle">세부 기항 시간 데이터가 없는 일정입니다.</p>' +
        '</section>'
      );
    }

    var rows = stopPorts
      .map(function (stop) {
        return (
          '<tr>' +
            '<td>' + escapeHtml(stop && stop.date ? stop.date : '-') + '</td>' +
            '<td>' + escapeHtml(stop && stop.port ? stop.port : '-') + '</td>' +
            '<td>' + escapeHtml(stop && stop.arrive ? stop.arrive : '-') + '</td>' +
            '<td>' + escapeHtml(stop && stop.depart ? stop.depart : '-') + '</td>' +
          '</tr>'
        );
      })
      .join('');

    return (
      '<section class="modal-card">' +
        '<h3>일정표</h3>' +
        '<table class="itinerary-table">' +
          '<thead><tr><th>날짜</th><th>항구</th><th>도착</th><th>출항</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</section>'
    );
  }

  function buildHistorySummary(prices, state) {
    var summary = getCabinTypes()
      .map(function (type) {
        var amount = prices ? prices[type] : null;
        if (toNumber(amount) === null) {
          return '';
        }

        return formatCabinLabel(type) + ' ' + formatPrice(amount, state);
      })
      .filter(Boolean)
      .join(' · ');

    return summary || '가격 정보 없음';
  }

  function buildPriceHistoryCard(cruise, state) {
    var history = Array.isArray(cruise && cruise.priceHistory) ? cruise.priceHistory : [];

    if (!history.length) {
      return (
        '<section class="modal-card">' +
          '<h3>가격 추이</h3>' +
          '<p>가격 이력이 아직 없습니다.</p>' +
        '</section>'
      );
    }

    var latestEntries = history.slice(-12).reverse();
    var rows = latestEntries
      .map(function (entry) {
        return (
          '<div class="modal-row">' +
            '<span class="modal-row-label">' + escapeHtml(formatDateTime(entry && entry.date)) + '</span>' +
            '<span>' + escapeHtml(buildHistorySummary(entry && entry.prices, state)) + '</span>' +
          '</div>'
        );
      })
      .join('');
    var countMessage = history.length > latestEntries.length
      ? '<p class="modal-subtitle">전체 ' + escapeHtml(history.length) + '건 중 최근 ' + escapeHtml(latestEntries.length) + '건만 표시합니다.</p>'
      : '';

    return (
      '<section class="modal-card">' +
        '<h3>가격 추이</h3>' +
        '<div class="history-chart-wrap">' +
          '<canvas id="cruiseModalHistoryChart" aria-label="가격 추이 차트"></canvas>' +
        '</div>' +
        countMessage +
        rows +
      '</section>'
    );
  }

  function buildDetailHtml(cruise, state) {
    var shipMeta = [formatStarRating(cruise.shipRating), formatShipInfoSummary(cruise.shipInfo)]
      .filter(Boolean)
      .join(' · ');

    return (
      '<div class="modal-header">' +
        '<div>' +
          '<p class="modal-subtitle">#' + escapeHtml(cruise.num) + ' · ' + escapeHtml(cruise.cruiseLine || '-') + '</p>' +
          '<h2 class="modal-title">' + escapeHtml(cruise.shipName || '크루즈 상세') + '</h2>' +
          (shipMeta ? '<p class="modal-subtitle">' + escapeHtml(shipMeta) + '</p>' : '') +
          '<p class="modal-subtitle">' +
            escapeHtml((cruise.departurePort || '-') + ' → ' + (cruise.arrivalPort || '-')) +
            ' · ' + escapeHtml(formatDate(cruise.departureDate)) +
            ' · ' + escapeHtml(toNumber(cruise.nights) === null ? '-' : Math.round(Number(cruise.nights)) + '박') +
          '</p>' +
        '</div>' +
        '<div class="modal-actions">' + buildHeaderActions(cruise, state) + '</div>' +
      '</div>' +
      '<div class="modal-grid">' +
        '<div class="modal-column">' +
          buildHeroCard(cruise) +
          buildItineraryImageCard(cruise) +
          buildCabinPhotosCard(cruise) +
        '</div>' +
        '<div class="modal-column">' +
          buildOverviewCard(cruise) +
          buildCabinPricesCard(cruise, state) +
          buildItineraryCard(cruise) +
          buildPriceHistoryCard(cruise, state) +
        '</div>' +
      '</div>'
    );
  }

  function buildCompareMetaRows(cruise) {
    return (
      '<div class="compare-meta-item"><span class="modal-row-label">일정</span><span>' + escapeHtml(cruise.itinerary || '-') + '</span></div>' +
      '<div class="compare-meta-item"><span class="modal-row-label">출발일</span><span>' + escapeHtml(formatDate(cruise.departureDate)) + '</span></div>' +
      '<div class="compare-meta-item"><span class="modal-row-label">박수</span><span>' +
        escapeHtml(toNumber(cruise.nights) === null ? '-' : Math.round(Number(cruise.nights)) + '박') + '</span></div>' +
      '<div class="compare-meta-item"><span class="modal-row-label">평점</span><span>' + escapeHtml(formatStarRating(cruise.shipRating)) + '</span></div>' +
      '<div class="compare-meta-item"><span class="modal-row-label">할인율</span><span>' +
        escapeHtml(toNumber(cruise.discountPct) === null ? '-' : Math.round(Number(cruise.discountPct)) + '%') + '</span></div>'
    );
  }

  function buildComparePriceRows(cruise, state) {
    var cabins = getAvailableCabins(cruise);

    if (!cabins.length) {
      return '<div class="compare-price-item"><span class="modal-row-label">가격</span><span>정보 없음</span></div>';
    }

    return cabins
      .map(function (type) {
        var detail = [
          formatPrice(cruise.cabinPrices[type], state),
          formatPerNight(cruise && cruise.perNight ? cruise.perNight[type] : null, state),
          '딜 ' + formatScore(cruise && cruise.dealScores ? cruise.dealScores[type] : null),
          '가치 ' + formatScore(cruise && cruise.valueScores ? cruise.valueScores[type] : null)
        ].join(' · ');

        return (
          '<div class="compare-price-item">' +
            '<span class="modal-row-label">' + escapeHtml(formatCabinLabel(type)) + '</span>' +
            '<span>' + escapeHtml(detail) + '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  function buildCompareActions(cruise) {
    return (
      '<div class="modal-actions">' +
        buildFavoriteButton(cruise.num) +
        '<button type="button" class="modal-chip" data-modal-action="show-detail" data-num="' + escapeHtml(cruise.num) + '">상세 보기</button>' +
        buildActionLink(cruise.bookingUrl, '예약하기', true) +
      '</div>'
    );
  }

  function buildCompareCard(cruise, state) {
    var exteriorUrl = safeAssetUrl(cruise && cruise.shipPhotos ? cruise.shipPhotos.exterior : '');
    var hero = exteriorUrl
      ? '<img class="modal-hero-image" src="' + escapeHtml(exteriorUrl) + '" alt="' + escapeHtml((cruise.shipName || '크루즈') + ' 외관 사진') + '" loading="lazy">'
      : '<div class="modal-card"><p>외관 사진 없음</p></div>';

    return (
      '<article class="compare-card">' +
        hero +
        '<div>' +
          '<p class="modal-subtitle">#' + escapeHtml(cruise.num) + ' · ' + escapeHtml(cruise.cruiseLine || '-') + '</p>' +
          '<h3>' + escapeHtml(cruise.shipName || '-') + '</h3>' +
        '</div>' +
        '<div>' + buildCompareMetaRows(cruise) + '</div>' +
        '<div class="compare-price-list">' + buildComparePriceRows(cruise, state) + '</div>' +
        buildCompareActions(cruise) +
      '</article>'
    );
  }

  function buildCompareHtml(cruises, state) {
    return (
      '<div class="modal-header">' +
        '<div>' +
          '<p class="modal-subtitle">비교 대상 ' + escapeHtml(cruises.length) + '개</p>' +
          '<h2 class="modal-title">크루즈 비교</h2>' +
          '<p class="modal-subtitle">같은 화면에서 일정, 가격, 점수를 나란히 확인하세요.</p>' +
        '</div>' +
        '<div class="modal-actions">' + buildStaticChip('최대 3개 비교', false) + '</div>' +
      '</div>' +
      '<div class="compare-grid">' +
        cruises.map(function (cruise) {
          return buildCompareCard(cruise, state);
        }).join('') +
      '</div>'
    );
  }

  function buildEmptyStateHtml(title, message) {
    return (
      '<section class="modal-card">' +
        '<h3>' + escapeHtml(title) + '</h3>' +
        '<p>' + escapeHtml(message) + '</p>' +
      '</section>'
    );
  }

  function destroyHistoryChart() {
    if (runtime.chart && typeof runtime.chart.destroy === 'function') {
      runtime.chart.destroy();
    }

    runtime.chart = null;
  }

  function buildHistoryDatasets(history) {
    return getCabinTypes()
      .map(function (type) {
        var hasValue = history.some(function (entry) {
          return toNumber(entry && entry.prices ? entry.prices[type] : null) !== null;
        });

        if (!hasValue) {
          return null;
        }

        return {
          label: formatCabinLabel(type),
          data: history.map(function (entry) {
            var amount = toNumber(entry && entry.prices ? entry.prices[type] : null);
            return amount === null ? null : amount;
          }),
          borderColor: CHART_COLORS[type] || '#94a3b8',
          backgroundColor: CHART_COLORS[type] || '#94a3b8',
          tension: 0.25,
          spanGaps: true
        };
      })
      .filter(Boolean);
  }

  function renderHistoryChart(cruise, state) {
    var history = Array.isArray(cruise && cruise.priceHistory) ? cruise.priceHistory : [];
    var chartRoot = typeof document !== 'undefined' ? document.getElementById('cruiseModalHistoryChart') : null;

    destroyHistoryChart();

    if (!chartRoot || !history.length || !root.Chart) {
      return;
    }

    runtime.chart = new root.Chart(chartRoot, {
      type: 'line',
      data: {
        labels: history.map(function (entry) {
          return formatDateTime(entry && entry.date);
        }),
        datasets: buildHistoryDatasets(history)
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                return context.dataset.label + ': ' + formatPrice(context.parsed.y, state);
              }
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: function (value) {
                return formatPrice(value, state);
              }
            }
          }
        }
      }
    });
  }

  function updateCarousel(id) {
    var carousel = typeof document !== 'undefined'
      ? document.querySelector('[data-carousel-id="' + id + '"]')
      : null;

    if (!carousel) {
      return;
    }

    var count = Number(carousel.getAttribute('data-carousel-count')) || 0;
    var index = runtime.carouselPositions[id] || 0;
    var track = carousel.querySelector('.carousel-track');
    var meta = typeof document !== 'undefined'
      ? document.querySelector('[data-carousel-meta="' + id + '"]')
      : null;

    if (!count || !track) {
      return;
    }

    if (index < 0) {
      index = count - 1;
    }
    if (index >= count) {
      index = 0;
    }

    runtime.carouselPositions[id] = index;
    track.style.transform = 'translateX(-' + index * 100 + '%)';

    if (meta) {
      meta.textContent = String(index + 1) + ' / ' + String(count);
    }
  }

  function syncCarousels() {
    if (typeof document === 'undefined') {
      return;
    }

    Array.prototype.slice.call(document.querySelectorAll('[data-carousel-id]')).forEach(function (element) {
      var id = element.getAttribute('data-carousel-id');
      if (runtime.carouselPositions[id] === undefined) {
        runtime.carouselPositions[id] = 0;
      }
      updateCarousel(id);
    });
  }

  function queueFrame(callback) {
    if (typeof root.requestAnimationFrame === 'function') {
      root.requestAnimationFrame(callback);
      return;
    }

    root.setTimeout(callback, 0);
  }

  function isOpen() {
    var elements = getElements();
    return !!(elements.overlay && elements.overlay.classList.contains('show'));
  }

  function openModal() {
    var elements = getElements();

    if (!elements.overlay) {
      return;
    }

    if (!isOpen()) {
      runtime.previousFocus = typeof document !== 'undefined' ? document.activeElement : null;
      runtime.previousBodyOverflow = typeof document !== 'undefined' && document.body ? document.body.style.overflow : '';
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.overflow = 'hidden';
      }
    }

    elements.overlay.classList.add('show');
    elements.overlay.setAttribute('aria-hidden', 'false');

    if (elements.close && typeof elements.close.focus === 'function') {
      elements.close.focus();
    }
  }

  function closeModal() {
    var elements = getElements();

    destroyHistoryChart();
    runtime.carouselPositions = Object.create(null);
    runtime.currentView = null;

    if (elements.overlay) {
      elements.overlay.classList.remove('show');
      elements.overlay.setAttribute('aria-hidden', 'true');
    }

    if (elements.content) {
      elements.content.innerHTML = '';
    }

    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = runtime.previousBodyOverflow || '';
    }

    if (runtime.previousFocus && typeof runtime.previousFocus.focus === 'function') {
      runtime.previousFocus.focus();
    }
  }

  function renderIntoModal(html) {
    var elements = getElements();

    if (!elements.content) {
      return false;
    }

    destroyHistoryChart();
    runtime.carouselPositions = Object.create(null);
    elements.content.innerHTML = html;
    openModal();
    syncCarousels();
    return true;
  }

  function ensureInitialized() {
    var elements = getElements();

    if (runtime.initialized) {
      return !!(elements.overlay && elements.content && elements.close);
    }

    if (!elements.overlay || !elements.content || !elements.close) {
      return false;
    }

    elements.overlay.addEventListener('click', function (event) {
      if (event.target === elements.overlay) {
        closeModal();
      }
    });

    elements.close.addEventListener('click', function () {
      closeModal();
    });

    elements.content.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-modal-action]');

      if (!trigger) {
        return;
      }

      var action = trigger.getAttribute('data-modal-action');
      var id = trigger.getAttribute('data-num');
      var carouselId = trigger.getAttribute('data-carousel');

      if (action === 'toggle-favorite') {
        event.preventDefault();
        toggleFavorite(id);
      } else if (action === 'show-detail') {
        event.preventDefault();
        showDetail(id);
      } else if (action === 'carousel-prev') {
        event.preventDefault();
        moveCarousel(carouselId, -1);
      } else if (action === 'carousel-next') {
        event.preventDefault();
        moveCarousel(carouselId, 1);
      } else if (action === 'copy-link') {
        event.preventDefault();
        var shareUrl = location.origin + location.pathname + '#cruise=' + id;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl).then(function () {
            trigger.textContent = '✅ 복사됨!';
            setTimeout(function () { trigger.textContent = '🔗 링크 복사'; }, 2000);
          });
        }
      }
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && isOpen()) {
          closeModal();
        }
      });
    }

    runtime.initialized = true;
    return true;
  }

  function emitFavoriteChange(payload) {
    if (typeof hooks.onFavoriteChange === 'function') {
      try {
        hooks.onFavoriteChange(payload);
      } catch (error) {
        return;
      }
      return;
    }

    if (root.CruiseApp && typeof root.CruiseApp.refresh === 'function') {
      try {
        root.CruiseApp.refresh();
      } catch (error) {
        return;
      }
    }
  }

  function refreshCurrentView() {
    if (!runtime.currentView) {
      return;
    }

    if (runtime.currentView.type === 'detail') {
      showDetail(runtime.currentView.payload);
    } else if (runtime.currentView.type === 'compare') {
      showCompare(runtime.currentView.payload);
    }
  }

  function toggleFavorite(id) {
    var resolvedId = normalizeCruiseId(id);
    var store = getFavoritesStore();
    var isFavorite;

    if (resolvedId === null) {
      return;
    }

    isFavorite = store.toggle(resolvedId);
    emitFavoriteChange({
      id: resolvedId,
      isFavorite: isFavorite,
      favorites: store.getAll()
    });
    refreshCurrentView();
  }

  function moveCarousel(id, direction) {
    var resolvedId = String(id || '');

    if (!resolvedId) {
      return;
    }

    runtime.carouselPositions[resolvedId] = (runtime.carouselPositions[resolvedId] || 0) + Number(direction || 0);
    updateCarousel(resolvedId);
  }

  function showDetail(id) {
    var resolvedId = normalizeCruiseId(id);
    var state;
    var cruise;

    if (!ensureInitialized()) {
      return null;
    }

    state = getResolvedState();
    cruise = findCruiseById(resolvedId);
    runtime.currentView = {
      type: 'detail',
      payload: resolvedId
    };

    if (!cruise) {
      renderIntoModal(buildEmptyStateHtml('상세 정보 없음', '선택한 크루즈 데이터를 찾지 못했습니다.'));
      return null;
    }

    renderIntoModal(buildDetailHtml(cruise, state));
    queueFrame(function () {
      renderHistoryChart(cruise, state);
    });
    return cruise;
  }

  function showCompare(ids) {
    var state;
    var compareIds;
    var cruises;

    if (!ensureInitialized()) {
      return [];
    }

    state = getResolvedState();
    compareIds = normalizeCruiseIds(ids);

    if (!compareIds.length) {
      compareIds = state.compareSelection.slice();
    }

    compareIds = compareIds.slice(0, 3);
    runtime.currentView = {
      type: 'compare',
      payload: compareIds.slice()
    };

    cruises = compareIds
      .map(findCruiseById)
      .filter(Boolean);

    if (cruises.length < 2) {
      renderIntoModal(buildEmptyStateHtml('비교 대상 부족', '비교하려면 크루즈를 2개 이상 선택해주세요.'));
      return cruises;
    }

    renderIntoModal(buildCompareHtml(cruises, state));
    return cruises;
  }

  function configure(options) {
    var nextOptions = options && typeof options === 'object' ? options : {};

    if (Object.prototype.hasOwnProperty.call(nextOptions, 'cruises') && Array.isArray(nextOptions.cruises)) {
      internalState.cruises = nextOptions.cruises.slice();
    }

    if (Object.prototype.hasOwnProperty.call(nextOptions, 'filteredCruises') && Array.isArray(nextOptions.filteredCruises)) {
      internalState.filteredCruises = nextOptions.filteredCruises.slice();
    }

    if (Object.prototype.hasOwnProperty.call(nextOptions, 'currencyMode')) {
      internalState.currencyMode = normalizeCurrencyMode(nextOptions.currencyMode);
    }

    if (Object.prototype.hasOwnProperty.call(nextOptions, 'exchangeRate')) {
      internalState.exchangeRate = toNumber(nextOptions.exchangeRate);
    }

    if (Object.prototype.hasOwnProperty.call(nextOptions, 'exportedAt')) {
      internalState.exportedAt = nextOptions.exportedAt || '';
    }

    if (Object.prototype.hasOwnProperty.call(nextOptions, 'activeView')) {
      internalState.activeView = nextOptions.activeView || '';
    }

    if (Object.prototype.hasOwnProperty.call(nextOptions, 'compareSelection')) {
      internalState.compareSelection = normalizeCruiseIds(nextOptions.compareSelection);
    }

    hooks.getState = typeof nextOptions.getState === 'function' ? nextOptions.getState : hooks.getState;
    hooks.onFavoriteChange = typeof nextOptions.onFavoriteChange === 'function'
      ? nextOptions.onFavoriteChange
      : hooks.onFavoriteChange;

    if (isOpen()) {
      refreshCurrentView();
    }

    return api;
  }

  function bootstrap() {
    if (typeof document === 'undefined') {
      return;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureInitialized);
      return;
    }

    ensureInitialized();
  }

  var api = {
    configure: configure,
    showDetail: showDetail,
    showCompare: showCompare,
    closeModal: closeModal,
    getOfficialWebsiteUrl: getOfficialWebsiteUrl
  };

  bootstrap();

  return api;
});
