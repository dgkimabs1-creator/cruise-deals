(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./utils.js'), root && root.CruiseFavorites);
  } else if (typeof define === 'function' && define.amd) {
    define(['./utils'], function (utils) {
      return factory(utils, root && root.CruiseFavorites);
    });
  } else {
    root.CruiseCalendar = factory(root.CruiseUtils, root.CruiseFavorites);
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function (CruiseUtils, CruiseFavorites) {
  'use strict';

  var WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
  var DEFAULT_VISIBLE_CRUISES = 3;
  var CALENDAR_STATES = typeof WeakMap === 'function' ? new WeakMap() : null;
  var MONTH_FORMATTER = typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function'
    ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', timeZone: 'UTC' })
    : null;

  function escapeHtml(value) {
    if (CruiseUtils && typeof CruiseUtils.escapeHtml === 'function') {
      return CruiseUtils.escapeHtml(value);
    }

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

  function safeUrl(value) {
    if (CruiseUtils && typeof CruiseUtils.safeUrl === 'function') {
      return CruiseUtils.safeUrl(value);
    }

    if (!value) {
      return '#';
    }

    try {
      var parsed = new URL(String(value));
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? String(value) : '#';
    } catch (error) {
      return '#';
    }
  }

  function formatPrice(value, currencyMode) {
    if (CruiseUtils && typeof CruiseUtils.formatPrice === 'function') {
      return CruiseUtils.formatPrice(value, currencyMode || 'USD');
    }

    if (!Number.isFinite(Number(value))) {
      return '-';
    }

    return (currencyMode === 'KRW' ? '₩' : '$') + Math.round(Number(value)).toLocaleString();
  }

  function getLowestPrice(cruise) {
    if (CruiseUtils && typeof CruiseUtils.getLowestPrice === 'function') {
      return CruiseUtils.getLowestPrice(cruise);
    }

    var cabinPrices = cruise && cruise.cabinPrices ? cruise.cabinPrices : {};
    var values = Object.keys(cabinPrices)
      .map(function (key) {
        return Number(cabinPrices[key]);
      })
      .filter(function (value) {
        return Number.isFinite(value) && value > 0;
      });

    return values.length ? Math.min.apply(Math, values) : Infinity;
  }

  function getInsidePerNight(cruise) {
    if (CruiseUtils && typeof CruiseUtils.getInsidePerNight === 'function') {
      return CruiseUtils.getInsidePerNight(cruise);
    }

    var nights = cruise && Number(cruise.nights);
    var lowestPrice = getLowestPrice(cruise);

    if (!Number.isFinite(nights) || nights <= 0 || lowestPrice === Infinity) {
      return Infinity;
    }

    return lowestPrice / nights;
  }

  function padNumber(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function parseDateString(dateString) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || '').trim());

    if (!match) {
      return null;
    }

    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function formatIsoDate(date) {
    return [
      date.getUTCFullYear(),
      padNumber(date.getUTCMonth() + 1),
      padNumber(date.getUTCDate())
    ].join('-');
  }

  function addUtcDays(date, days) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
  }

  function shiftMonth(year, month, offset) {
    var shifted = new Date(Date.UTC(year, month - 1 + offset, 1));

    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1
    };
  }

  function buildMonthMatrix(year, month) {
    var firstDay = new Date(Date.UTC(year, month - 1, 1));
    var gridStart = addUtcDays(firstDay, -firstDay.getUTCDay());
    var matrix = [];
    var weekIndex;
    var dayIndex;

    for (weekIndex = 0; weekIndex < 6; weekIndex += 1) {
      var row = [];

      for (dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        var current = addUtcDays(gridStart, weekIndex * 7 + dayIndex);
        row.push({
          date: formatIsoDate(current),
          year: current.getUTCFullYear(),
          month: current.getUTCMonth() + 1,
          day: current.getUTCDate(),
          isCurrentMonth: current.getUTCFullYear() === year && current.getUTCMonth() === month - 1
        });
      }

      matrix.push(row);
    }

    return matrix;
  }

  function getPriceTier(price) {
    var numericPrice = Number(price);

    if (!Number.isFinite(numericPrice)) {
      return 'mid';
    }

    if (numericPrice < 1000) {
      return 'low';
    }

    if (numericPrice < 2600) {
      return 'mid';
    }

    return 'high';
  }

  function normalizeRoute(cruise) {
    if (!cruise || typeof cruise !== 'object') {
      return '노선 정보 없음';
    }

    if (cruise.itinerary) {
      return String(cruise.itinerary);
    }

    if (cruise.departurePort || cruise.arrivalPort) {
      return [cruise.departurePort || '출발지 미정', cruise.arrivalPort || '도착지 미정'].join(' → ');
    }

    return '노선 정보 없음';
  }

  function buildCruiseKey(cruise) {
    var baseId = cruise && (cruise.num !== null && cruise.num !== undefined) ? cruise.num : 'x';
    return String(baseId) + '::' + String(cruise && cruise.departureDate ? cruise.departureDate : '');
  }

  function normalizeCruise(cruise) {
    if (!cruise || typeof cruise !== 'object') {
      return null;
    }

    if (
      cruise.cruise &&
      cruise.key &&
      typeof cruise.priceTier === 'string' &&
      typeof cruise.route === 'string'
    ) {
      return cruise;
    }

    var departureDate = parseDateString(cruise.departureDate);

    if (!departureDate) {
      return null;
    }

    var lowestPrice = getLowestPrice(cruise);
    var perNight = getInsidePerNight(cruise);

    return {
      arrivalPort: cruise.arrivalPort || '',
      bookingUrl: safeUrl(cruise.bookingUrl),
      cruiseLine: cruise.cruiseLine || '',
      departureDate: formatIsoDate(departureDate),
      departurePort: cruise.departurePort || '',
      discountPct: Number(cruise.discountPct) || 0,
      isFavorite: isFavoriteCruise(cruise),
      key: buildCruiseKey(cruise),
      lowestPrice: lowestPrice,
      nights: Number(cruise.nights) || 0,
      num: cruise.num,
      perNight: perNight,
      priceTier: getPriceTier(lowestPrice),
      route: normalizeRoute(cruise),
      shipName: cruise.shipName || '',
      source: cruise.source || '',
      stopPorts: Array.isArray(cruise.stopPorts) ? cruise.stopPorts.slice() : [],
      title: [cruise.cruiseLine || '', cruise.shipName || '']
        .filter(Boolean)
        .join(' · ') || '크루즈 일정',
      cruise: cruise
    };
  }

  function groupCruisesByDate(cruises) {
    var grouped = Object.create(null);

    (Array.isArray(cruises) ? cruises : []).forEach(function (cruise) {
      var normalized = normalizeCruise(cruise);

      if (!normalized) {
        return;
      }

      if (!grouped[normalized.departureDate]) {
        grouped[normalized.departureDate] = [];
      }

      grouped[normalized.departureDate].push(normalized);
    });

    Object.keys(grouped).forEach(function (dateKey) {
      grouped[dateKey].sort(function (left, right) {
        if (left.lowestPrice !== right.lowestPrice) {
          return left.lowestPrice - right.lowestPrice;
        }

        return left.title.localeCompare(right.title, 'ko');
      });
    });

    return grouped;
  }

  function isFavoriteCruise(cruise) {
    if (!CruiseFavorites || typeof CruiseFavorites.createFavoritesStore !== 'function') {
      return false;
    }

    if (isFavoriteCruise.store === undefined) {
      isFavoriteCruise.store = CruiseFavorites.createFavoritesStore();
    }

    return !!(isFavoriteCruise.store && typeof isFavoriteCruise.store.has === 'function' && isFavoriteCruise.store.has(cruise.num));
  }

  function resolveContainer(container) {
    if (container && typeof container === 'object' && container.nodeType === 1) {
      return container;
    }

    if (typeof document !== 'undefined') {
      return document.getElementById('calendarRoot');
    }

    return null;
  }

  function getStoredState(container) {
    if (!container) {
      return null;
    }

    if (CALENDAR_STATES) {
      return CALENDAR_STATES.get(container) || null;
    }

    return container.__cruiseCalendarState || null;
  }

  function setStoredState(container, state) {
    if (!container) {
      return state;
    }

    if (CALENDAR_STATES) {
      CALENDAR_STATES.set(container, state);
    } else {
      container.__cruiseCalendarState = state;
    }

    return state;
  }

  function resolveCurrencyMode(options) {
    var mode = options && typeof options.currencyMode === 'string' ? options.currencyMode : null;

    if (mode === 'KRW' || mode === 'USD') {
      return mode;
    }

    if (CruiseCalendar.currencyMode === 'KRW' || CruiseCalendar.currencyMode === 'USD') {
      return CruiseCalendar.currencyMode;
    }

    var globalObject = typeof globalThis !== 'undefined'
      ? globalThis
      : typeof window !== 'undefined'
        ? window
        : null;

    if (
      globalObject &&
      globalObject.CruiseApp &&
      typeof globalObject.CruiseApp.getState === 'function'
    ) {
      try {
        var appState = globalObject.CruiseApp.getState();

        if (appState && (appState.currencyMode === 'KRW' || appState.currencyMode === 'USD')) {
          return appState.currencyMode;
        }
      } catch (error) {
        // Ignore app state errors and fall through to local defaults.
      }
    }

    if (typeof document !== 'undefined') {
      var rootNode = document.documentElement;
      var bodyNode = document.body;

      if (rootNode && (rootNode.getAttribute('data-currency-mode') === 'KRW' || rootNode.dataset.currencyMode === 'KRW')) {
        return 'KRW';
      }

      if (bodyNode && (bodyNode.getAttribute('data-currency-mode') === 'KRW' || bodyNode.dataset.currencyMode === 'KRW')) {
        return 'KRW';
      }
    }

    return 'USD';
  }

  function findInitialMonth(cruises, previousState) {
    if (previousState && Number.isFinite(previousState.year) && Number.isFinite(previousState.month)) {
      return {
        year: previousState.year,
        month: previousState.month
      };
    }

    var sortedCruises = (Array.isArray(cruises) ? cruises : []).slice().sort(function (left, right) {
      return left.departureDate.localeCompare(right.departureDate);
    });

    if (sortedCruises.length) {
      var firstDate = parseDateString(sortedCruises[0].departureDate);

      if (firstDate) {
        return {
          year: firstDate.getUTCFullYear(),
          month: firstDate.getUTCMonth() + 1
        };
      }
    }

    var now = new Date();
    return {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1
    };
  }

  function buildState(cruises, container, options) {
    var previousState = getStoredState(container);
    var normalizedCruises = (Array.isArray(cruises) ? cruises : [])
      .map(normalizeCruise)
      .filter(Boolean);
    var initialMonth = findInitialMonth(normalizedCruises, previousState);
    var selectedCruiseKey = previousState && previousState.selectedCruiseKey ? previousState.selectedCruiseKey : '';
    var cruiseIndex = Object.create(null);

    normalizedCruises.forEach(function (cruise) {
      cruiseIndex[cruise.key] = cruise;
    });

    if (!selectedCruiseKey || !cruiseIndex[selectedCruiseKey]) {
      selectedCruiseKey = normalizedCruises.length ? normalizedCruises[0].key : '';
    }

    return {
      cruises: normalizedCruises,
      currencyMode: resolveCurrencyMode(options),
      expandedDates: previousState && previousState.expandedDates ? cloneFlatObject(previousState.expandedDates) : Object.create(null),
      groupedCruises: groupCruisesByDate(normalizedCruises),
      selectedCruiseKey: selectedCruiseKey,
      cruiseIndex: cruiseIndex,
      year: initialMonth.year,
      month: initialMonth.month
    };
  }

  function cloneFlatObject(source) {
    var clone = Object.create(null);

    if (!source || typeof source !== 'object') {
      return clone;
    }

    Object.keys(source).forEach(function (key) {
      clone[key] = source[key];
    });

    return clone;
  }

  function render(cruises, container, options) {
    var target = resolveContainer(container);

    if (!target) {
      return null;
    }

    var state = buildState(cruises, target, options);
    setStoredState(target, state);
    ensureDelegatedEvents(target);
    renderState(target, state);
    return state;
  }

  function ensureDelegatedEvents(container) {
    if (container.__cruiseCalendarBound) {
      return;
    }

    container.addEventListener('click', function (event) {
      var actionTarget = findClosestByAttribute(event.target, 'data-calendar-action');
      var cruiseTarget = findClosestByAttribute(event.target, 'data-cruise-key');
      var state = getStoredState(container);

      if (!state) {
        return;
      }

      if (actionTarget && actionTarget.getAttribute('data-calendar-action') === 'navigate') {
        var offset = Number(actionTarget.getAttribute('data-offset')) || 0;
        var shifted = shiftMonth(state.year, state.month, offset);

        state.year = shifted.year;
        state.month = shifted.month;
        setStoredState(container, state);
        renderState(container, state);
        return;
      }

      if (actionTarget && actionTarget.getAttribute('data-calendar-action') === 'toggle-more') {
        var dateKey = actionTarget.getAttribute('data-date') || '';
        state.expandedDates[dateKey] = !state.expandedDates[dateKey];
        setStoredState(container, state);
        renderState(container, state);
        return;
      }

      if (cruiseTarget) {
        state.selectedCruiseKey = cruiseTarget.getAttribute('data-cruise-key') || '';
        setStoredState(container, state);
        updateDetailPanel(container, state, state.selectedCruiseKey);
      }
    });

    container.addEventListener('mouseover', function (event) {
      var cruiseTarget = findClosestByAttribute(event.target, 'data-cruise-key');
      var state = getStoredState(container);

      if (state && cruiseTarget) {
        updateDetailPanel(container, state, cruiseTarget.getAttribute('data-cruise-key') || '');
      }
    });

    container.addEventListener('focusin', function (event) {
      var cruiseTarget = findClosestByAttribute(event.target, 'data-cruise-key');
      var state = getStoredState(container);

      if (state && cruiseTarget) {
        updateDetailPanel(container, state, cruiseTarget.getAttribute('data-cruise-key') || '');
      }
    });

    container.addEventListener('mouseleave', function () {
      var state = getStoredState(container);

      if (state) {
        updateDetailPanel(container, state, state.selectedCruiseKey);
      }
    });

    container.__cruiseCalendarBound = true;
  }

  function findClosestByAttribute(node, attributeName) {
    var current = node;

    while (current && current !== document && current.nodeType === 1) {
      if (current.hasAttribute(attributeName)) {
        return current;
      }

      current = current.parentNode;
    }

    return null;
  }

  function renderState(container, state) {
    container.innerHTML = buildCalendarMarkup(state);
    updateDetailPanel(container, state, state.selectedCruiseKey);
  }

  function buildCalendarMarkup(state) {
    var monthLabel = formatMonthLabel(state.year, state.month);
    var rows = buildMonthMatrix(state.year, state.month);

    return '' +
      '<div class="calendar-shell">' +
        '<div class="calendar-toolbar">' +
          '<div>' +
            '<p style="margin:0 0 4px;font-size:0.86rem;color:var(--muted);">출발 캘린더</p>' +
            '<h3 style="margin:0;">' + escapeHtml(monthLabel) + '</h3>' +
          '</div>' +
          '<div class="calendar-nav" aria-label="월 이동">' +
            '<button type="button" data-calendar-action="navigate" data-offset="-1" aria-label="이전 달">이전</button>' +
            '<button type="button" data-calendar-action="navigate" data-offset="1" aria-label="다음 달">다음</button>' +
          '</div>' +
          '<div class="calendar-legend" aria-label="가격 범례">' +
            '<span class="calendar-pill low">저가</span>' +
            '<span class="calendar-pill mid">중간가</span>' +
            '<span class="calendar-pill high">고가</span>' +
          '</div>' +
        '</div>' +
        '<div class="calendar-empty" data-calendar-detail>일정을 올리거나 누르면 상세 정보를 보여줍니다.</div>' +
        buildGridMarkup(rows, state) +
      '</div>';
  }

  function buildGridMarkup(rows, state) {
    var weekdayMarkup = WEEKDAY_LABELS.map(function (label) {
      return '<div class="calendar-weekday">' + escapeHtml(label) + '</div>';
    }).join('');

    var cellMarkup = rows.map(function (row) {
      return row.map(function (cell) {
        return buildCellMarkup(cell, state);
      }).join('');
    }).join('');

    return '<div class="calendar-grid">' + weekdayMarkup + cellMarkup + '</div>';
  }

  function buildCellMarkup(cell, state) {
    var cruises = state.groupedCruises[cell.date] || [];
    var isExpanded = !!state.expandedDates[cell.date];
    var visibleCruises = isExpanded ? cruises : cruises.slice(0, DEFAULT_VISIBLE_CRUISES);
    var countLabel = cruises.length ? cruises.length + '개' : '';
    var itemMarkup = visibleCruises.length
      ? visibleCruises.map(function (cruise) {
          return buildCruiseItemMarkup(cruise, state.currencyMode);
        }).join('')
      : '<div class="calendar-empty">출발 일정 없음</div>';
    var moreMarkup = '';

    if (cruises.length > DEFAULT_VISIBLE_CRUISES) {
      moreMarkup = '' +
        '<button' +
          ' type="button"' +
          ' class="calendar-more"' +
          ' data-calendar-action="toggle-more"' +
          ' data-date="' + escapeHtml(cell.date) + '"' +
          ' style="padding:0;border:0;background:none;cursor:pointer;text-align:left;"' +
        '>' +
          escapeHtml(isExpanded ? '접기' : '+' + (cruises.length - DEFAULT_VISIBLE_CRUISES) + '개 더 보기') +
        '</button>';
    }

    return '' +
      '<div class="calendar-cell' + (cell.isCurrentMonth ? '' : ' is-outside') + '">' +
        '<div class="calendar-cell-header">' +
          '<span class="calendar-cell-date">' + escapeHtml(String(cell.day)) + '</span>' +
          '<span>' + escapeHtml(countLabel) + '</span>' +
        '</div>' +
        '<div class="calendar-cruise-list">' +
          itemMarkup +
          moreMarkup +
        '</div>' +
      '</div>';
  }

  function buildCruiseItemMarkup(cruise, currencyMode) {
    var priceText = cruise.lowestPrice === Infinity ? '가격 문의' : formatPrice(cruise.lowestPrice, currencyMode);
    var routeText = cruise.departurePort || cruise.arrivalPort
      ? [cruise.departurePort || '출발지 미정', cruise.arrivalPort || '도착지 미정'].join(' → ')
      : cruise.route;
    var hoverText = [
      cruise.title,
      routeText,
      '최저가 ' + priceText
    ].join(' | ');

    return '' +
      '<button' +
        ' type="button"' +
        ' class="calendar-cruise ' + escapeHtml(cruise.priceTier) + '"' +
        ' data-cruise-key="' + escapeHtml(cruise.key) + '"' +
        ' title="' + escapeHtml(hoverText) + '"' +
        ' aria-label="' + escapeHtml(hoverText) + '"' +
        ' style="width:100%;border-width:1px;cursor:pointer;"' +
      '>' +
        '<strong>' + escapeHtml(cruise.shipName || cruise.cruiseLine || '크루즈 일정') + '</strong>' +
        '<span>' + escapeHtml(priceText) + '</span>' +
        '<span style="font-size:0.82rem;color:var(--muted);">' + escapeHtml(routeText) + '</span>' +
      '</button>';
  }

  function updateDetailPanel(container, state, cruiseKey) {
    var detailNode = container.querySelector('[data-calendar-detail]');

    if (!detailNode) {
      return;
    }

    var cruise = cruiseKey && state.cruiseIndex ? state.cruiseIndex[cruiseKey] : null;

    if (!cruise) {
      detailNode.innerHTML = '일정을 올리거나 누르면 상세 정보를 보여줍니다.';
      return;
    }

    var priceText = cruise.lowestPrice === Infinity ? '가격 문의' : formatPrice(cruise.lowestPrice, state.currencyMode);
    var perNightText = cruise.perNight === Infinity ? '' : ' · 박당 ' + formatPrice(cruise.perNight, state.currencyMode);
    var badgeText = cruise.discountPct > 0 ? ' · 할인 ' + cruise.discountPct + '%' : '';
    var favoriteText = cruise.isFavorite ? ' · 관심 일정' : '';
    var bookingLink = cruise.bookingUrl && cruise.bookingUrl !== '#'
      ? ' <a href="' + escapeHtml(cruise.bookingUrl) + '" target="_blank" rel="noopener noreferrer">예약 보기</a>'
      : '';

    detailNode.innerHTML = '' +
      '<strong>' + escapeHtml(cruise.title) + '</strong>' +
      '<div style="margin-top:6px;">' +
        escapeHtml(cruise.departureDate) +
        ' · ' +
        escapeHtml((cruise.nights || 0) + '박') +
        ' · ' +
        escapeHtml(priceText) +
        escapeHtml(perNightText) +
        escapeHtml(badgeText) +
        escapeHtml(favoriteText) +
      '</div>' +
      '<div style="margin-top:6px;">' + escapeHtml(cruise.route) + '</div>' +
      (bookingLink ? '<div style="margin-top:8px;">' + bookingLink + '</div>' : '');
  }

  function formatMonthLabel(year, month) {
    var date = new Date(Date.UTC(year, month - 1, 1));

    if (MONTH_FORMATTER) {
      return MONTH_FORMATTER.format(date);
    }

    return year + '년 ' + month + '월';
  }

  var CruiseCalendar = {
    buildMonthMatrix: buildMonthMatrix,
    getPriceTier: getPriceTier,
    groupCruisesByDate: groupCruisesByDate,
    render: render,
    currencyMode: null
  };

  return CruiseCalendar;
});
