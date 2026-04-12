(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root || globalThis);
  } else if (typeof define === 'function' && define.amd) {
    define([], function () {
      return factory(root);
    });
  } else {
    root.CruiseApp = factory(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var CruiseUtils = root.CruiseUtils || {};
  var STORAGE_KEYS = {
    currency: 'cruise-currency-mode',
    theme: 'cruise-theme-mode'
  };
  var CRUISE_LINE_BADGES = {
    'royal caribbean': '👑',
    disney: '🏰',
    msc: '⚓',
    'msc크루즈': '⚓',
    princess: '👸',
    costa: '🌊',
    celebrity: '⭐',
    norwegian: '🚢',
    'holland america': '🌷',
    carnival: '🎪',
    viking: '⚔️',
    oceania: '🌍',
    silversea: '🥈',
    seabourn: '💎',
    ponant: '🇫🇷',
    windstar: '🌬️',
    azamara: '🔵',
    cunard: '🎩',
    regent: '👑',
    crystal: '💠',
    explora: '🧭',
    'explora journeys': '🧭',
    'p&o': '🇬🇧'
  };
  var VIEW_PANEL_MAP = {
    list: 'listPanel',
    favorites: 'listPanel',
    calendar: 'calendarPanel',
    lines: 'lineAnalysisPanel'
  };
  var SORT_OPTION_MAP = {
    'price-asc': { key: 'price', dir: 'asc' },
    'price-desc': { key: 'price', dir: 'desc' },
    'inside-asc': { key: 'inside', dir: 'asc' },
    'inside-desc': { key: 'inside', dir: 'desc' },
    'oceanview-asc': { key: 'oceanview', dir: 'asc' },
    'oceanview-desc': { key: 'oceanview', dir: 'desc' },
    'balcony-asc': { key: 'balcony', dir: 'asc' },
    'balcony-desc': { key: 'balcony', dir: 'desc' },
    'suite-asc': { key: 'suite', dir: 'asc' },
    'suite-desc': { key: 'suite', dir: 'desc' },
    'date-asc': { key: 'date', dir: 'asc' },
    'date-desc': { key: 'date', dir: 'desc' },
    'discount-desc': { key: 'discount', dir: 'desc' },
    'deal-desc': { key: 'deal', dir: 'desc' },
    'value-desc': { key: 'value', dir: 'desc' },
    'pernight-asc': { key: 'pernight', dir: 'asc' },
    'nights-asc': { key: 'nights', dir: 'asc' },
    'nights-desc': { key: 'nights', dir: 'desc' },
    'rating-desc': { key: 'rating', dir: 'desc' }
  };
  var SORT_OPTION_REVERSE_MAP = {
    'price:asc': 'price-asc',
    'price:desc': 'price-desc',
    'inside:asc': 'inside-asc',
    'inside:desc': 'inside-desc',
    'oceanview:asc': 'oceanview-asc',
    'oceanview:desc': 'oceanview-desc',
    'balcony:asc': 'balcony-asc',
    'balcony:desc': 'balcony-desc',
    'suite:asc': 'suite-asc',
    'suite:desc': 'suite-desc',
    'date:asc': 'date-asc',
    'date:desc': 'date-desc',
    'discount:desc': 'discount-desc',
    'deal:desc': 'deal-desc',
    'value:desc': 'value-desc',
    'pernight:asc': 'pernight-asc',
    'nights:asc': 'nights-asc',
    'nights:desc': 'nights-desc',
    'rating:desc': 'rating-desc'
  };
  var HEADER_DEFAULT_DIR = {
    num: 'asc',
    line: 'asc',
    ship: 'asc',
    rating: 'desc',
    recommend: 'desc',
    date: 'asc',
    nights: 'asc',
    departure: 'asc',
    arrival: 'asc',
    inside: 'asc',
    oceanview: 'asc',
    balcony: 'asc',
    suite: 'asc',
    pernight: 'asc',
    discount: 'desc',
    deal: 'desc',
    value: 'desc'
  };
  var DEFAULT_FILTERS = {
    num: '',
    search: '',
    line: '',
    month: '',
    departureStart: '',
    departureEnd: '',
    departure: '',
    arrival: '',
    destination: '',
    nightsMin: '',
    nightsMax: '',
    priceMin: '',
    priceMax: '',
    starMin: '',
    cabinType: '',
    perNightMax: '',
    recommendMin: ''
  };
  var EMPTY_TABLE_COLSPAN = 22;

  var dom = {};
  var distributionChart = null;
  var favoritesApi = null;
  var state = {
    cruises: [],
    filteredCruises: [],
    exportedAt: '',
    exchangeRate: Number(CruiseUtils.EXCHANGE_RATE) || 1480,
    activeView: 'list',
    quickFilter: 'all',
    sortKey: 'price',
    sortDir: 'asc',
    currencyMode: 'USD',
    theme: 'dark',
    compareSelection: [],
    page: 1,
    pageSize: 50,
    expandedGroups: {},
    filtersCollapsed: false,
    filters: cloneFilters(DEFAULT_FILTERS),
    initialized: false,
    loadError: false
  };

  function init() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;
    cacheDom();
    favoritesApi = ensureFavoritesApi();
    initializeStoredPreferences();
    initializeSortSelect();
    bindEvents();
    initializeTipsAccordion();
    setLoadingState();
    loadData();
  }

  function cacheDom() {
    dom.totalCount = root.document.getElementById('totalCount');
    dom.busanCount = root.document.getElementById('busanCount');
    dom.dealCount = root.document.getElementById('dealCount');
    dom.favoriteCount = root.document.getElementById('favoriteCount');
    dom.updateTime = root.document.getElementById('updateTime');
    dom.viewTabs = root.document.getElementById('viewTabs');
    dom.quickTabs = root.document.getElementById('quickTabs');
    dom.filterToggle = root.document.getElementById('filterToggle');
    dom.filterPanel = root.document.getElementById('filterPanel');
    dom.filterNum = root.document.getElementById('filterNum');
    dom.searchInput = root.document.getElementById('searchInput');
    dom.filterLine = root.document.getElementById('filterLine');
    dom.filterMonth = root.document.getElementById('filterMonth');
    dom.filterDepartureStart = root.document.getElementById('filterDepartureStart');
    dom.filterDepartureEnd = root.document.getElementById('filterDepartureEnd');
    dom.filterDeparture = root.document.getElementById('filterDeparture');
    dom.filterArrival = root.document.getElementById('filterArrival');
    dom.filterDestination = root.document.getElementById('filterDestination');
    dom.filterNightsMin = root.document.getElementById('filterNightsMin');
    dom.filterNightsMax = root.document.getElementById('filterNightsMax');
    dom.filterPriceMin = root.document.getElementById('filterPriceMin');
    dom.filterPriceMax = root.document.getElementById('filterPriceMax');
    dom.filterStarMin = root.document.getElementById('filterStarMin');
    dom.filterCabinType = root.document.getElementById('filterCabinType');
    dom.filterPerNightMax = root.document.getElementById('filterPerNightMax');
    dom.filterRecommendMin = root.document.getElementById('filterRecommendMin');
    dom.resetFiltersButton = root.document.getElementById('resetFiltersButton');
    dom.sortSelect = root.document.getElementById('sortSelect');
    dom.compareButton = root.document.getElementById('compareButton');
    dom.resultCount = root.document.getElementById('resultCount');
    dom.selectedCount = root.document.getElementById('selectedCount');
    dom.currencyLabel = root.document.getElementById('currencyLabel');
    dom.currencyToggle = root.document.getElementById('currencyToggle');
    dom.themeToggle = root.document.getElementById('themeToggle');
    dom.distributionPanel = root.document.getElementById('distributionPanel');
    dom.distributionChart = root.document.getElementById('distributionChart');
    dom.listPanel = root.document.getElementById('listPanel');
    dom.calendarPanel = root.document.getElementById('calendarPanel');
    dom.lineAnalysisPanel = root.document.getElementById('lineAnalysisPanel');
    dom.cruiseTable = root.document.getElementById('cruiseTable');
    dom.cruiseCards = root.document.getElementById('cruiseCards');
    dom.calendarRoot = root.document.getElementById('calendarRoot');
    dom.lineAnalysisGrid = root.document.getElementById('lineAnalysisGrid');
    dom.tipsAccordion = root.document.getElementById('tipsAccordion');
    dom.sortHeaders = Array.prototype.slice.call(root.document.querySelectorAll('.cruise-table th[data-sort], .cruise-table .th-btn[data-sort]'));
  }

  function initializeStoredPreferences() {
    state.currencyMode = getStoredValue(STORAGE_KEYS.currency, 'USD') === 'KRW' ? 'KRW' : 'USD';
    state.theme = getStoredValue(STORAGE_KEYS.theme, root.document.documentElement.getAttribute('data-theme') || 'dark') === 'light' ? 'light' : 'dark';
    applyTheme(state.theme, true);
    applyCurrencyMode(state.currencyMode, true);
  }

  function initializeSortSelect() {
    if (!dom.sortSelect) {
      return;
    }

    if (!dom.sortSelect.querySelector('option[value="custom"]')) {
      dom.sortSelect.appendChild(new root.Option('직접 정렬', 'custom'));
    }

    syncSortSelect();
  }

  function bindEvents() {
    if (dom.viewTabs) {
      dom.viewTabs.addEventListener('click', handleViewTabClick);
    }

    if (dom.quickTabs) {
      dom.quickTabs.addEventListener('click', handleQuickTabClick);
    }

    if (dom.filterToggle) {
      dom.filterToggle.addEventListener('click', toggleFilterPanel);
    }

    bindFilterInput(dom.filterNum, 'num', 'input');
    bindFilterInput(dom.searchInput, 'search', 'input');
    bindFilterInput(dom.filterLine, 'line', 'change');
    bindFilterInput(dom.filterMonth, 'month', 'change');
    bindFilterInput(dom.filterDepartureStart, 'departureStart', 'change');
    bindFilterInput(dom.filterDepartureEnd, 'departureEnd', 'change');
    bindFilterInput(dom.filterDeparture, 'departure', 'input');
    bindFilterInput(dom.filterArrival, 'arrival', 'input');
    bindFilterInput(dom.filterDestination, 'destination', 'input');
    bindFilterInput(dom.filterNightsMin, 'nightsMin', 'input');
    bindFilterInput(dom.filterNightsMax, 'nightsMax', 'input');
    bindFilterInput(dom.filterPriceMin, 'priceMin', 'input');
    bindFilterInput(dom.filterPriceMax, 'priceMax', 'input');
    bindFilterInput(dom.filterStarMin, 'starMin', 'change');
    bindFilterInput(dom.filterCabinType, 'cabinType', 'change');
    bindFilterInput(dom.filterPerNightMax, 'perNightMax', 'input');
    bindFilterInput(dom.filterRecommendMin, 'recommendMin', 'input');

    if (dom.resetFiltersButton) {
      dom.resetFiltersButton.addEventListener('click', resetFilters);
    }

    if (dom.sortSelect) {
      dom.sortSelect.addEventListener('change', handleSortSelectChange);
    }

    dom.sortHeaders.forEach(function (header) {
      header.addEventListener('click', handleSortHeaderClick);
    });

    if (dom.compareButton) {
      dom.compareButton.addEventListener('click', handleCompareClick);
    }

    if (dom.currencyToggle) {
      dom.currencyToggle.addEventListener('click', handleCurrencyToggle);
    }

    if (dom.themeToggle) {
      dom.themeToggle.addEventListener('click', handleThemeToggle);
    }

    if (dom.cruiseTable) {
      dom.cruiseTable.addEventListener('click', handleGroupToggle);
      dom.cruiseTable.addEventListener('click', handleListActionClick);
      dom.cruiseTable.addEventListener('change', handleCompareCheckboxChange);
    }

    if (dom.cruiseCards) {
      dom.cruiseCards.addEventListener('click', handleListActionClick);
      dom.cruiseCards.addEventListener('change', handleCompareCheckboxChange);
    }

    if (dom.lineAnalysisGrid) {
      dom.lineAnalysisGrid.addEventListener('click', handleLineCardClick);
    }
  }

  function bindFilterInput(element, key, eventName) {
    if (!element) {
      return;
    }

    element.addEventListener(eventName, function (event) {
      state.filters[key] = normalizeFilterValue(event.target.value);
      state.page = 1;
      applyStateAndRender();
    });
  }

  function initializeTipsAccordion() {
    if (!dom.tipsAccordion) {
      return;
    }

    dom.tipsAccordion.addEventListener('click', function (event) {
      var trigger = event.target.closest('.tips-trigger');
      if (!trigger) {
        return;
      }

      var item = trigger.closest('.tips-item');
      var isOpen = item && item.classList.contains('is-open');

      Array.prototype.slice.call(dom.tipsAccordion.querySelectorAll('.tips-item')).forEach(function (entry) {
        var button = entry.querySelector('.tips-trigger');
        entry.classList.remove('is-open');
        if (button) {
          button.setAttribute('aria-expanded', 'false');
        }
      });

      if (item && !isOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  }

  function setLoadingState() {
    renderEmptyTable('데이터를 불러오는 중입니다.');
    renderCardEmptyState('데이터를 불러오는 중입니다.');
    renderLineAnalysisEmptyState('선사 데이터를 준비하는 중입니다.');
    renderCalendarFallback('캘린더를 불러오는 중입니다.');
    updateToolbarMeta(0);
    updateStats();
    updateCompareUi();
    updateViewVisibility();
  }

  function loadData() {
    root.fetch('data/cruises-public.json', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (payload) {
        state.loadError = false;
        state.cruises = Array.isArray(payload.cruises) ? payload.cruises.slice() : [];
        state.exportedAt = payload.exportedAt || '';
        installExchangeRate(payload.exchangeRate);
        populateFilterOptions();
        syncFilterInputs();
        syncExternalModules();
        applyStateAndRender();
        checkHashNavigation();
      })
      .catch(function () {
        state.loadError = true;
        state.cruises = [];
        state.filteredCruises = [];
        destroyDistributionChart();
        renderEmptyTable('데이터를 불러오지 못했습니다.');
        renderCardEmptyState('데이터를 불러오지 못했습니다.');
        renderLineAnalysisEmptyState('선사 데이터를 불러오지 못했습니다.');
        renderCalendarFallback('캘린더 데이터를 불러오지 못했습니다.');
        updateToolbarMeta(0);
        updateStats();
      });
  }

  function installExchangeRate(exchangeRate) {
    var resolvedRate = toNumber(exchangeRate);

    if (resolvedRate === null || resolvedRate <= 0) {
      resolvedRate = Number(CruiseUtils.EXCHANGE_RATE) || 1480;
    }

    state.exchangeRate = resolvedRate;
    CruiseUtils.EXCHANGE_RATE = resolvedRate;
    CruiseUtils.convertPrice = function (value, currencyMode) {
      var amount = toNumber(value);

      if (amount === null) {
        return null;
      }

      return String(currencyMode).toUpperCase() === 'KRW' ? Math.round(amount * state.exchangeRate) : Math.round(amount);
    };
    CruiseUtils.formatPrice = function (value, currencyMode) {
      var converted = CruiseUtils.convertPrice(value, currencyMode);

      if (converted === null) {
        return '-';
      }

      return (String(currencyMode).toUpperCase() === 'KRW' ? '₩' : '$') + converted.toLocaleString('ko-KR');
    };
    CruiseUtils.formatPerNight = function (value, currencyMode) {
      var formatted = CruiseUtils.formatPrice(value, currencyMode);
      return formatted === '-' ? formatted : formatted + ' / 박';
    };
  }

  function ensureFavoritesApi() {
    if (!root.CruiseFavorites || typeof root.CruiseFavorites.createFavoritesStore !== 'function') {
      return {
        getAll: function () {
          return [];
        },
        isFavorite: function () {
          return false;
        },
        toggle: function () {
          return false;
        }
      };
    }

    if (!root.CruiseFavorites.__store) {
      root.CruiseFavorites.__store = root.CruiseFavorites.createFavoritesStore(root.localStorage, root.CruiseFavorites.STORAGE_KEY);
    }

    root.CruiseFavorites.getAll = function () {
      return root.CruiseFavorites.__store.getAll();
    };
    root.CruiseFavorites.isFavorite = function (id) {
      return root.CruiseFavorites.__store.has(id);
    };
    root.CruiseFavorites.toggle = function (id) {
      return root.CruiseFavorites.__store.toggle(id);
    };
    root.CruiseFavorites.add = function (id) {
      return root.CruiseFavorites.__store.add(id);
    };
    root.CruiseFavorites.remove = function (id) {
      return root.CruiseFavorites.__store.remove(id);
    };

    return root.CruiseFavorites;
  }

  function populateFilterOptions() {
    var lines = Array.from(new Set(state.cruises.map(function (cruise) {
      return cruise && cruise.cruiseLine ? String(cruise.cruiseLine) : '';
    }).filter(Boolean))).sort(function (left, right) {
      return left.localeCompare(right, 'ko');
    });

    var months = Array.from(new Set(state.cruises.map(function (cruise) {
      return cruise && cruise.departureDate ? String(cruise.departureDate).slice(0, 7) : '';
    }).filter(Boolean))).sort();

    replaceSelectOptions(dom.filterLine, '전체 선사', lines.map(function (line) {
      return {
        value: line,
        label: line
      };
    }));

    replaceSelectOptions(dom.filterMonth, '전체 월', months.map(function (month) {
      return {
        value: month,
        label: formatMonthLabel(month)
      };
    }));
  }

  function replaceSelectOptions(selectElement, placeholder, options) {
    var selectedValue;

    if (!selectElement) {
      return;
    }

    selectedValue = selectElement.value;
    selectElement.innerHTML = '';
    selectElement.appendChild(new root.Option(placeholder, ''));
    (options || []).forEach(function (entry) {
      selectElement.appendChild(new root.Option(entry.label, entry.value));
    });
    selectElement.value = selectedValue || '';
  }

  function handleViewTabClick(event) {
    var button = event.target.closest('[data-view]');

    if (!button) {
      return;
    }

    state.activeView = button.getAttribute('data-view') || 'list';
    updateViewTabState();
    applyStateAndRender();
  }

  function handleQuickTabClick(event) {
    var button = event.target.closest('[data-filter]');

    if (!button) {
      return;
    }

    state.quickFilter = button.getAttribute('data-filter') || 'all';
    updateQuickTabState();
    applyStateAndRender();
  }

  function handleSortSelectChange(event) {
    var selection = SORT_OPTION_MAP[event.target.value];

    if (!selection) {
      return;
    }

    state.sortKey = selection.key;
    state.sortDir = selection.dir;
    applyStateAndRender();
  }

  function handleSortHeaderClick(event) {
    var header = event.currentTarget;
    var key = header.getAttribute('data-sort');

    if (!key) {
      return;
    }

    if (state.sortKey === key) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = key;
      state.sortDir = HEADER_DEFAULT_DIR[key] || 'asc';
    }

    applyStateAndRender();
  }

  function handleCompareClick() {
    if (!root.CruiseModal || typeof root.CruiseModal.showCompare !== 'function') {
      return;
    }

    if (state.compareSelection.length < 2 || state.compareSelection.length > 3) {
      return;
    }

    root.CruiseModal.showCompare(state.compareSelection.slice());
  }

  function handleCurrencyToggle() {
    applyCurrencyMode(state.currencyMode === 'USD' ? 'KRW' : 'USD');
    applyStateAndRender();
  }

  function handleThemeToggle() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  function handleListActionClick(event) {
    var target = event.target.closest('[data-action]');
    var action;
    var num;

    if (!target) {
      return;
    }

    action = target.getAttribute('data-action');
    num = Number(target.getAttribute('data-num'));

    if (action === 'favorite') {
      event.preventDefault();
      toggleFavorite(num);
      return;
    }

    if (action === 'detail') {
      event.preventDefault();
      openCruiseDetail(num);
    }
  }

  function handleCompareCheckboxChange(event) {
    var checkbox = event.target.closest('.compare-checkbox');
    var num;
    var index;

    if (!checkbox) {
      return;
    }

    num = Number(checkbox.getAttribute('data-num'));
    index = state.compareSelection.indexOf(num);

    if (checkbox.checked) {
      if (state.compareSelection.length >= 3) {
        checkbox.checked = false;
        root.alert('비교는 최대 3개까지 선택할 수 있습니다.');
        return;
      }

      if (index === -1) {
        state.compareSelection.push(num);
      }
    } else if (index !== -1) {
      state.compareSelection.splice(index, 1);
    }

    state.compareSelection.sort(function (left, right) {
      return left - right;
    });
    updateToolbarMeta(state.filteredCruises.length);
    updateCompareUi();
    syncCompareCheckboxes();
  }

  function handleLineCardClick(event) {
    var trigger = event.target.closest('[data-line]');
    var line;

    if (!trigger) {
      return;
    }

    line = trigger.getAttribute('data-line') || '';
    state.filters.line = line;
    state.activeView = 'list';
    syncFilterInputs();
    updateViewTabState();
    applyStateAndRender();
  }

  function toggleFilterPanel() {
    state.filtersCollapsed = !state.filtersCollapsed;
    updateFilterPanelState();
  }

  function resetFilters() {
    state.filters = cloneFilters(DEFAULT_FILTERS);
    state.quickFilter = 'all';
    syncFilterInputs();
    updateQuickTabState();
    applyStateAndRender();
  }

  function applyTheme(theme, skipPersistence) {
    state.theme = theme === 'light' ? 'light' : 'dark';
    root.document.documentElement.setAttribute('data-theme', state.theme);

    if (!skipPersistence) {
      setStoredValue(STORAGE_KEYS.theme, state.theme);
    }

    if (dom.themeToggle) {
      dom.themeToggle.textContent = state.theme === 'dark' ? '라이트 모드' : '다크 모드';
    }
  }

  function applyCurrencyMode(currencyMode, skipPersistence) {
    state.currencyMode = currencyMode === 'KRW' ? 'KRW' : 'USD';

    if (!skipPersistence) {
      setStoredValue(STORAGE_KEYS.currency, state.currencyMode);
    }

    if (dom.currencyToggle) {
      dom.currencyToggle.textContent = state.currencyMode === 'USD' ? '원화 보기' : '달러 보기';
    }

    if (dom.currencyLabel) {
      dom.currencyLabel.textContent = '현재 통화: ' + state.currencyMode;
    }

    syncExternalModules();
  }

  function applyStateAndRender() {
    state.filteredCruises = buildFilteredCruises();
    updateStats();
    updateToolbarMeta(state.filteredCruises.length);
    updateViewTabState();
    updateQuickTabState();
    updateFilterPanelState();
    syncSortSelect();
    updateSortHeaderState();
    updateViewVisibility();
    renderCruiseList(state.filteredCruises);
    renderDistributionChart(state.filteredCruises);
    renderLineAnalysis(state.filteredCruises);
    renderCalendar(state.filteredCruises);
    updateCompareUi();
    syncCompareCheckboxes();
    syncExternalModules();
  }

  function updateStats() {
    var busanCount = state.cruises.filter(function (cruise) {
      return !!(cruise && cruise.isBusanRelated);
    }).length;
    var dealCount = state.cruises.filter(function (cruise) {
      return Number(cruise && cruise.discountPct) >= 50;
    }).length;
    var favoriteCount = favoritesApi && typeof favoritesApi.getAll === 'function' ? favoritesApi.getAll().length : 0;

    setText(dom.totalCount, state.cruises.length ? state.cruises.length.toLocaleString('ko-KR') : (state.loadError ? '0' : '-'));
    setText(dom.busanCount, state.cruises.length ? busanCount.toLocaleString('ko-KR') : (state.loadError ? '0' : '-'));
    setText(dom.dealCount, state.cruises.length ? dealCount.toLocaleString('ko-KR') : (state.loadError ? '0' : '-'));
    setText(dom.favoriteCount, favoriteCount.toLocaleString('ko-KR'));
    setText(dom.updateTime, state.exportedAt ? formatUpdatedAt(state.exportedAt) : '-');
  }

  function updateToolbarMeta(resultCount) {
    if (dom.resultCount) {
      dom.resultCount.textContent = resultCount.toLocaleString('ko-KR') + '개 크루즈';
    }

    if (dom.selectedCount) {
      dom.selectedCount.textContent = '비교 선택 ' + state.compareSelection.length + '개';
    }

    if (dom.currencyLabel) {
      dom.currencyLabel.textContent = '현재 통화: ' + state.currencyMode;
    }
  }

  function updateCompareUi() {
    if (!dom.compareButton) {
      return;
    }

    dom.compareButton.disabled = state.compareSelection.length < 2 || state.compareSelection.length > 3;
  }

  function updateViewTabState() {
    if (!dom.viewTabs) {
      return;
    }

    Array.prototype.slice.call(dom.viewTabs.querySelectorAll('[data-view]')).forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-view') === state.activeView);
    });
  }

  function updateQuickTabState() {
    if (!dom.quickTabs) {
      return;
    }

    var cruises = state.cruises;
    Array.prototype.slice.call(dom.quickTabs.querySelectorAll('[data-filter]')).forEach(function (button) {
      var filter = button.getAttribute('data-filter');
      button.classList.toggle('active', filter === state.quickFilter);
      // 탭에 개수 표시
      var label = button.getAttribute('data-label');
      if (!label) {
        label = button.textContent.replace(/\s*\d+$/, '');
        button.setAttribute('data-label', label);
      }
      if (filter !== 'all' && cruises.length > 0) {
        var savedQuick = state.quickFilter;
        state.quickFilter = filter;
        var count = cruises.filter(function (c) { return matchesQuickFilter(c); }).length;
        state.quickFilter = savedQuick;
        button.textContent = label + ' ' + count;
      }
    });
  }

  function updateFilterPanelState() {
    if (!dom.filterPanel || !dom.filterToggle) {
      return;
    }

    dom.filterPanel.classList.toggle('is-collapsed', state.filtersCollapsed);
    dom.filterToggle.setAttribute('aria-expanded', state.filtersCollapsed ? 'false' : 'true');
    dom.filterToggle.textContent = state.filtersCollapsed ? '필터 펼치기' : '필터 접기';
  }

  function updateViewVisibility() {
    var showListPanel = state.activeView === 'list' || state.activeView === 'favorites';

    if (dom.listPanel) {
      dom.listPanel.classList.toggle('active', showListPanel);
    }

    if (dom.calendarPanel) {
      dom.calendarPanel.classList.toggle('active', state.activeView === 'calendar');
    }

    if (dom.lineAnalysisPanel) {
      dom.lineAnalysisPanel.classList.toggle('active', state.activeView === 'lines');
    }

    if (dom.distributionPanel) {
      dom.distributionPanel.classList.toggle('hidden', !showListPanel);
    }
  }

  function syncFilterInputs() {
    if (dom.filterNum) {
      dom.filterNum.value = state.filters.num;
    }
    if (dom.searchInput) {
      dom.searchInput.value = state.filters.search;
    }
    if (dom.filterLine) {
      dom.filterLine.value = state.filters.line;
    }
    if (dom.filterMonth) {
      dom.filterMonth.value = state.filters.month;
    }
    if (dom.filterDepartureStart) {
      dom.filterDepartureStart.value = state.filters.departureStart;
    }
    if (dom.filterDepartureEnd) {
      dom.filterDepartureEnd.value = state.filters.departureEnd;
    }
    if (dom.filterDeparture) {
      dom.filterDeparture.value = state.filters.departure;
    }
    if (dom.filterArrival) {
      dom.filterArrival.value = state.filters.arrival;
    }
    if (dom.filterDestination) {
      dom.filterDestination.value = state.filters.destination;
    }
    if (dom.filterNightsMin) {
      dom.filterNightsMin.value = state.filters.nightsMin;
    }
    if (dom.filterNightsMax) {
      dom.filterNightsMax.value = state.filters.nightsMax;
    }
    if (dom.filterPriceMin) {
      dom.filterPriceMin.value = state.filters.priceMin;
    }
    if (dom.filterPriceMax) {
      dom.filterPriceMax.value = state.filters.priceMax;
    }
    if (dom.filterStarMin) {
      dom.filterStarMin.value = state.filters.starMin;
    }
    if (dom.filterCabinType) {
      dom.filterCabinType.value = state.filters.cabinType;
    }
    if (dom.filterPerNightMax) {
      dom.filterPerNightMax.value = state.filters.perNightMax;
    }
    if (dom.filterRecommendMin) {
      dom.filterRecommendMin.value = state.filters.recommendMin;
    }
  }

  function syncSortSelect() {
    var mappedValue;

    if (!dom.sortSelect) {
      return;
    }

    mappedValue = SORT_OPTION_REVERSE_MAP[state.sortKey + ':' + state.sortDir] || 'custom';
    dom.sortSelect.value = mappedValue;
  }

  function updateSortHeaderState() {
    dom.sortHeaders.forEach(function (header) {
      var isActive = header.getAttribute('data-sort') === state.sortKey;
      header.classList.toggle('sorted-asc', isActive && state.sortDir === 'asc');
      header.classList.toggle('sorted-desc', isActive && state.sortDir === 'desc');
    });
  }

  function buildFilteredCruises() {
    var cruises = state.cruises.slice();

    cruises = cruises.filter(function (cruise) {
      return matchesViewFilter(cruise) && matchesQuickFilter(cruise) && matchesManualFilters(cruise);
    });

    cruises.sort(compareCruises);
    return cruises;
  }

  function matchesViewFilter(cruise) {
    if (state.activeView !== 'favorites') {
      return true;
    }

    return !!(favoritesApi && favoritesApi.isFavorite && favoritesApi.isFavorite(cruise && cruise.num));
  }

  function matchesQuickFilter(cruise) {
    var discountPct = Number(cruise && cruise.discountPct) || 0;
    var perNight = getCabinFilteredPerNight(cruise);
    var rating = toNumber(cruise && cruise.shipRating) || 0;

    switch (state.quickFilter) {
      case 'busan':
        return !!(cruise && cruise.isBusanRelated);
      case 'deal80':
        return discountPct >= 80;
      case 'deal50':
        return discountPct >= 50;
      case 'cheap':
        return Number.isFinite(perNight) && perNight <= 100;
      case 'luxury':
        return rating >= 5;
      case 'new3d':
        return isNewCruise(cruise, 3);
      case 'drop1d':
        return hasPriceDrop(cruise, 1);
      case 'drop3d':
        return hasPriceDrop(cruise, 3);
      case 'drop7d':
        return hasPriceDrop(cruise, 7);
      default:
        return true;
    }
  }

  function isNewCruise(cruise, days) {
    if (!cruise || !cruise.priceHistory || cruise.priceHistory.length === 0) return false;
    var firstSeen = new Date(cruise.priceHistory[0].date).getTime();
    return Date.now() - firstSeen < days * 24 * 60 * 60 * 1000;
  }

  function hasPriceDrop(cruise, days) {
    if (!cruise || !cruise.priceHistory || cruise.priceHistory.length < 2) return false;
    var now = Date.now();
    var cutoff = now - (days * 24 * 60 * 60 * 1000);
    var history = cruise.priceHistory;
    var cabinType = state.filters.cabinType || '';
    var latest = history[history.length - 1];
    var latestPrice = getHistoricalSnapshotPrice(latest, cabinType);
    if (latestPrice === null || latestPrice <= 0) return false;

    for (var i = history.length - 2; i >= 0; i--) {
      var entry = history[i];
      var entryTime = new Date(entry.date).getTime();
      if (entryTime < cutoff) break;
      var entryPrice = getHistoricalSnapshotPrice(entry, cabinType);
      if (entryPrice !== null && entryPrice > latestPrice) return true;
    }
    return false;
  }

  function matchesDepartureDateRange(cruise, filters) {
    var departureDate = String(cruise && cruise.departureDate || '');
    var departureStart = String(filters && filters.departureStart || '');
    var departureEnd = String(filters && filters.departureEnd || '');

    if (!departureStart && !departureEnd) {
      return true;
    }

    if (!departureDate) {
      return false;
    }

    if (departureStart && departureDate < departureStart) {
      return false;
    }

    if (departureEnd && departureDate > departureEnd) {
      return false;
    }

    return true;
  }

  function matchesManualFilters(cruise) {
    var filters = state.filters;
    var filterNum = toNumber(filters.num);
    var nightsMin = toNumber(filters.nightsMin);
    var nightsMax = toNumber(filters.nightsMax);
    var priceMin = toNumber(filters.priceMin);
    var priceMax = toNumber(filters.priceMax);
    var starMin = toNumber(filters.starMin);
    var filteredPrice = getCabinFilteredPrice(cruise);
    var destinationText = buildDestinationText(cruise);
    var searchableText = [
      cruise && cruise.cruiseLine,
      cruise && cruise.shipName,
      cruise && cruise.itinerary,
      cruise && cruise.departurePort,
      cruise && cruise.arrivalPort,
      destinationText
    ].join(' ');

    if (filterNum !== null && Number(cruise && cruise.num) !== filterNum) {
      return false;
    }

    if (filters.search && !matchText(searchableText, filters.search)) {
      return false;
    }

    if (filters.line && String(cruise && cruise.cruiseLine || '') !== filters.line) {
      return false;
    }

    if (filters.month && String(cruise && cruise.departureDate || '').slice(0, 7) !== filters.month) {
      return false;
    }

    if (!matchesDepartureDateRange(cruise, filters)) {
      return false;
    }

    if (filters.departure && !matchText(cruise && cruise.departurePort, filters.departure)) {
      return false;
    }

    if (filters.arrival && !matchText(cruise && cruise.arrivalPort, filters.arrival)) {
      return false;
    }

    if (filters.destination && !matchText(destinationText, filters.destination)) {
      return false;
    }

    if (nightsMin !== null && Number(cruise && cruise.nights) < nightsMin) {
      return false;
    }

    if (nightsMax !== null && Number(cruise && cruise.nights) > nightsMax) {
      return false;
    }

    if (priceMin !== null && (!Number.isFinite(filteredPrice) || filteredPrice < priceMin)) {
      return false;
    }

    if (priceMax !== null && (!Number.isFinite(filteredPrice) || filteredPrice > priceMax)) {
      return false;
    }

    if (starMin !== null && Number(cruise && cruise.shipRating) < starMin) {
      return false;
    }

    if (filters.cabinType && cruise && cruise.cabinPrices) {
      var cabinPrice = cruise.cabinPrices[filters.cabinType];
      if (!cabinPrice || cabinPrice <= 0) {
        return false;
      }
    }

    var perNightMax = toNumber(filters.perNightMax);
    if (perNightMax !== null) {
      var pn = getCabinFilteredPerNight(cruise);
      if (!Number.isFinite(pn) || pn > perNightMax) {
        return false;
      }
    }

    var recommendMin = toNumber(filters.recommendMin);
    if (recommendMin !== null) {
      var recScore = Number(cruise && cruise.recommendScore) || 0;
      if (recScore < recommendMin) {
        return false;
      }
    }

    return true;
  }

  function compareCruises(left, right) {
    var comparison = compareValues(getSortValue(left, state.sortKey), getSortValue(right, state.sortKey), state.sortKey);

    if (comparison === 0) {
      comparison = compareValues(getSortValue(left, 'date'), getSortValue(right, 'date'), 'date');
    }

    if (comparison === 0) {
      comparison = compareValues(Number(left && left.num), Number(right && right.num), 'num');
    }

    return state.sortDir === 'desc' ? comparison * -1 : comparison;
  }

  function getSortValue(cruise, key) {
    switch (key) {
      case 'price':
        return getCabinFilteredPrice(cruise);
      case 'num':
        return Number(cruise && cruise.num);
      case 'line':
        return String(cruise && cruise.cruiseLine || '');
      case 'ship':
        return String(cruise && cruise.shipName || '');
      case 'rating':
        return Number(cruise && cruise.shipRating);
      case 'date':
        return getDateValue(cruise && cruise.departureDate);
      case 'nights':
        return Number(cruise && cruise.nights);
      case 'departure':
        return String(cruise && cruise.departurePort || '');
      case 'arrival':
        return String(cruise && cruise.arrivalPort || '');
      case 'inside':
        return getCabinPrice(cruise, 'inside');
      case 'oceanview':
        return getCabinPrice(cruise, 'oceanview');
      case 'balcony':
        return getCabinPrice(cruise, 'balcony');
      case 'suite':
        return getCabinPrice(cruise, 'suite');
      case 'inside-rec':
        return cruise && cruise.recommendScores ? Number(cruise.recommendScores.inside) || 0 : 0;
      case 'oceanview-rec':
        return cruise && cruise.recommendScores ? Number(cruise.recommendScores.oceanview) || 0 : 0;
      case 'balcony-rec':
        return cruise && cruise.recommendScores ? Number(cruise.recommendScores.balcony) || 0 : 0;
      case 'suite-rec':
        return cruise && cruise.recommendScores ? Number(cruise.recommendScores.suite) || 0 : 0;
      case 'recommend':
        return getBestRecommendScore(cruise);
      case 'pernight':
        return getCabinFilteredPerNight(cruise);
      case 'discount':
        return Number(cruise && cruise.discountPct) || 0;
      case 'deal':
        return getBestScore(cruise && cruise.dealScores);
      case 'value':
        return getBestScore(cruise && cruise.valueScores);
      default:
        return getLowestPrice(cruise);
    }
  }

  function compareValues(left, right, key) {
    var leftMissing = isMissingValue(left);
    var rightMissing = isMissingValue(right);

    if (leftMissing && rightMissing) {
      return 0;
    }

    if (leftMissing) {
      return 1;
    }

    if (rightMissing) {
      return -1;
    }

    if (typeof left === 'string' || typeof right === 'string' || key === 'line' || key === 'ship' || key === 'departure' || key === 'arrival') {
      return String(left).localeCompare(String(right), 'ko');
    }

    if (left === right) {
      return 0;
    }

    return left > right ? 1 : -1;
  }

  function getRouteKey(cruise) {
    if (!cruise) return '';
    var ports = (cruise.stopPorts || []).map(function (p) { return p.port || ''; }).join(',');
    return (cruise.shipName || '') + '|' + (cruise.nights || 0) + '|' + (cruise.departurePort || '') + '|' + (cruise.arrivalPort || '') + '|' + ports;
  }

  function groupCruises(cruises) {
    var groups = [];
    var seen = {};
    for (var i = 0; i < cruises.length; i++) {
      var key = getRouteKey(cruises[i]);
      if (seen[key] !== undefined) {
        groups[seen[key]].all.push(cruises[i]);
      } else {
        seen[key] = groups.length;
        groups.push({ all: [cruises[i]] });
      }
    }
    // lead = 첫 번째 (정렬 유지), children = 나머지 날짜순
    return groups.map(function (g) {
      var sorted = g.all.slice();
      return {
        lead: sorted[0],
        children: sorted.slice(1).sort(function (a, b) {
          return (a.departureDate || '').localeCompare(b.departureDate || '');
        })
      };
    });
  }

  function renderCruiseList(cruises) {
    if (!cruises.length) {
      renderEmptyTable(state.loadError ? '데이터를 불러오지 못했습니다.' : '조건에 맞는 크루즈가 없습니다.');
      renderCardEmptyState(state.loadError ? '데이터를 불러오지 못했습니다.' : '조건에 맞는 크루즈가 없습니다.');
      renderPagination(0);
      return;
    }

    var groups = groupCruises(cruises);
    var totalPages = Math.ceil(groups.length / state.pageSize);
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
    var start = (state.page - 1) * state.pageSize;
    var pageGroups = groups.slice(start, start + state.pageSize);

    var tableHtml = '';
    var cardHtml = '';
    for (var i = 0; i < pageGroups.length; i++) {
      var g = pageGroups[i];
      tableHtml += renderTableRow(g.lead);
      cardHtml += renderCruiseCard(g.lead);
      if (g.children.length > 0) {
        var groupId = 'group-' + (g.lead.num || i);
        var isExpanded = !!state.expandedGroups[groupId];
        var hiddenClass = isExpanded ? '' : ' hidden';
        var toggleText = isExpanded
          ? '같은 일정 ' + g.children.length + '개 접기 ▲'
          : '같은 일정 ' + g.children.length + '개 더보기 ▼';
        tableHtml += '<tr class="group-toggle-row"><td colspan="' + EMPTY_TABLE_COLSPAN + '">' +
          '<button type="button" class="group-toggle-btn" data-group="' + groupId + '">' + toggleText + '</button></td></tr>';
        for (var j = 0; j < g.children.length; j++) {
          var childRow = renderTableRow(g.children[j]);
          var posClass = (j === 0 ? ' group-first' : '') + (j === g.children.length - 1 ? ' group-last' : '');
          tableHtml += childRow.replace('<tr class="cruise-row">', '<tr class="cruise-row group-child-row' + posClass + hiddenClass + '" data-group="' + groupId + '">');
          cardHtml += '<div class="group-child' + hiddenClass + '" data-group-card="' + groupId + '">' + renderCruiseCard(g.children[j]) + '</div>';
        }
      }
    }

    dom.cruiseTable.innerHTML = tableHtml;
    dom.cruiseCards.innerHTML = cardHtml;
    renderPagination(groups.length);
    bindGroupToggles();
  }

  function bindGroupToggles() {
    // 이벤트 위임은 initializeEventListeners에서 처리
  }

  function handleGroupToggle(event) {
    var btn = event.target.closest('.group-toggle-btn');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();

    var groupId = btn.getAttribute('data-group');
    var rows = root.document.querySelectorAll('.group-child-row[data-group="' + groupId + '"]');
    var cards = root.document.querySelectorAll('[data-group-card="' + groupId + '"]');
    var isHidden = rows.length > 0 && rows[0].classList.contains('hidden');
    var count = rows.length;

    Array.prototype.slice.call(rows).forEach(function (r) {
      if (isHidden) r.classList.remove('hidden');
      else r.classList.add('hidden');
    });
    Array.prototype.slice.call(cards).forEach(function (c) {
      if (isHidden) c.classList.remove('hidden');
      else c.classList.add('hidden');
    });

    state.expandedGroups[groupId] = isHidden;
    btn.textContent = isHidden
      ? '같은 일정 ' + count + '개 접기 ▲'
      : '같은 일정 ' + count + '개 더보기 ▼';
  }

  function renderPagination(total) {
    var existing = root.document.getElementById('paginationBar');
    if (existing) existing.remove();
    if (total <= state.pageSize) return;

    var totalPages = Math.ceil(total / state.pageSize);
    var html = '<div id="paginationBar" class="pagination-bar">';
    html += '<button type="button" class="page-btn" data-page="prev"' + (state.page <= 1 ? ' disabled' : '') + '>◀ 이전</button>';
    html += '<span class="page-info">' + state.page + ' / ' + totalPages + ' (' + total + '개)</span>';
    html += '<button type="button" class="page-btn" data-page="next"' + (state.page >= totalPages ? ' disabled' : '') + '>다음 ▶</button>';
    html += '</div>';

    var listPanel = root.document.getElementById('listPanel');
    if (listPanel) listPanel.insertAdjacentHTML('beforeend', html);

    var bar = root.document.getElementById('paginationBar');
    if (bar) {
      bar.addEventListener('click', function (e) {
        var btn = e.target.closest('.page-btn');
        if (!btn || btn.disabled) return;
        var action = btn.getAttribute('data-page');
        if (action === 'prev' && state.page > 1) state.page--;
        else if (action === 'next' && state.page < totalPages) state.page++;
        applyStateAndRender();
        root.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  var CABIN_TYPES = ['inside', 'oceanview', 'balcony', 'suite'];
  var CABIN_LABELS = { inside: '내', oceanview: '바', balcony: '발', suite: '스' };

  function getCabinPrice(cruise, cabinType) {
    var price = toNumber(cruise && cruise.cabinPrices ? cruise.cabinPrices[cabinType] : null);
    return price !== null && price > 0 ? price : null;
  }

  function getCabinPerNight(cruise, cabinType) {
    var storedPerNight = toNumber(cruise && cruise.perNight ? cruise.perNight[cabinType] : null);
    var price = getCabinPrice(cruise, cabinType);
    var nights = toNumber(cruise && cruise.nights);

    if (storedPerNight !== null && storedPerNight > 0) {
      return storedPerNight;
    }

    return price !== null && nights !== null && nights > 0 ? price / nights : null;
  }

  function getCabinFilteredPrice(cruise) {
    var cabinType = state.filters.cabinType;
    if (cabinType) {
      return getCabinPrice(cruise, cabinType) === null ? Infinity : getCabinPrice(cruise, cabinType);
    }
    return getLowestPrice(cruise);
  }

  function getCabinLabel(cruise) {
    var cabinType = state.filters.cabinType;
    if (cabinType) return CABIN_LABELS[cabinType] || '';
    if (!cruise || !cruise.cabinPrices) return '';
    var lowest = Infinity;
    var label = '';
    for (var i = 0; i < CABIN_TYPES.length; i++) {
      var type = CABIN_TYPES[i];
      var p = cruise.cabinPrices[type];
      if (p > 0 && p < lowest) { lowest = p; label = CABIN_LABELS[type]; }
    }
    return label;
  }

  function getRecommendScoreForCabin(cruise, cabinType) {
    return toNumber(cruise && cruise.recommendScores ? cruise.recommendScores[cabinType] : null);
  }

  function getBestRecommendScoreWithLabel(cruise) {
    var bestScore = null;
    var label = '';

    for (var i = 0; i < CABIN_TYPES.length; i++) {
      var cabinType = CABIN_TYPES[i];
      var score = getRecommendScoreForCabin(cruise, cabinType);
      if (score === null) {
        continue;
      }
      if (bestScore === null || score > bestScore) {
        bestScore = score;
        label = CABIN_LABELS[cabinType] || '';
      }
    }

    if (bestScore !== null) {
      return {
        score: Math.round(bestScore),
        label: label
      };
    }

    bestScore = toNumber(cruise && cruise.recommendScore);
    return {
      score: bestScore === null ? null : Math.round(bestScore),
      label: bestScore === null ? '' : getCabinLabel(cruise)
    };
  }

  function getBestRecommendScore(cruise) {
    var result = getBestRecommendScoreWithLabel(cruise);
    return result.score;
  }

  function getBestScoreWithLabel(scores) {
    if (!scores || typeof scores !== 'object') return { score: 0, label: '' };
    var best = 0, label = '';
    for (var type in CABIN_LABELS) {
      var s = Number(scores[type]);
      if (s > best) { best = s; label = CABIN_LABELS[type]; }
    }
    return { score: best, label: label };
  }

  function getCabinFilteredPerNight(cruise) {
    var cabinType = state.filters.cabinType;
    if (cabinType) {
      var perNight = getCabinPerNight(cruise, cabinType);
      return perNight === null ? Infinity : perNight;
    }
    return getPerNight(cruise);
  }

  function getDropPercent(cruise, days) {
    if (!cruise || !cruise.priceHistory || cruise.priceHistory.length < 2) return 0;
    var now = Date.now();
    var cutoff = now - (days * 24 * 60 * 60 * 1000);
    var history = cruise.priceHistory;
    var cabinType = state.filters.cabinType || '';
    var latest = history[history.length - 1];
    var latestPrice = getHistoricalSnapshotPrice(latest, cabinType);
    if (latestPrice === null || latestPrice <= 0) return 0;
    var maxPrice = 0;
    for (var i = history.length - 2; i >= 0; i--) {
      var entry = history[i];
      if (new Date(entry.date).getTime() < cutoff) break;
      var p = getHistoricalSnapshotPrice(entry, cabinType) || 0;
      if (p > maxPrice) maxPrice = p;
    }
    if (maxPrice <= latestPrice) return 0;
    return Math.round(((maxPrice - latestPrice) / maxPrice) * 100);
  }

  function getCruiseBadges(cruise) {
    var badges = '';
    if (!cruise) return badges;
    var now = Date.now();
    // 신규: 24시간 이내 첫 등록
    if (cruise.priceHistory && cruise.priceHistory.length > 0) {
      var firstSeen = new Date(cruise.priceHistory[0].date).getTime();
      if (now - firstSeen < 24 * 60 * 60 * 1000) {
        badges += ' <span class="badge badge-new">NEW</span>';
      }
    }
    // 딜 90+: 🔥
    var dealScore = getBestScore(cruise.dealScores);
    if (dealScore >= 90) {
      badges += ' <span class="badge badge-fire">🔥' + dealScore + '</span>';
    }
    // 하락: 7일 이내 하락률
    var dropPct = getDropPercent(cruise, 7);
    if (dropPct > 0) {
      badges += ' <span class="badge badge-drop">▼' + dropPct + '%</span>';
    }
    // 일정 불확실
    if (cruise.itineraryUncertain) {
      badges += ' <span class="badge badge-warn" title="일정이 불확실합니다. 예약 페이지에서 확인하세요.">⚠️일정확인</span>';
    }
    return badges;
  }

  function normalizeCruiseLineKey(value) {
    return String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  function getCruiseLineBadge(cruiseLine) {
    return CRUISE_LINE_BADGES[normalizeCruiseLineKey(cruiseLine)] || '';
  }

  function formatCruiseLineDisplay(cruiseLine) {
    var lineName = String(cruiseLine || '');
    var badge = getCruiseLineBadge(lineName);
    return badge ? badge + ' ' + lineName : lineName;
  }

  function formatShipInfoSummary(shipInfo) {
    var passengers = toNumber(shipInfo && shipInfo.passengers);
    var ratio = toNumber(shipInfo && shipInfo.ratio);

    if (passengers === null) {
      return '';
    }

    var parts = [];
    var tonnage = shipInfo && shipInfo.tonnage;
    if (tonnage) parts.push(Math.round(tonnage / 10000) + '만GT');
    parts.push(Math.round(passengers).toLocaleString('ko-KR') + '명');
    if (ratio !== null) parts.push('1:' + ratio.toFixed(1));
    var yearBuilt = shipInfo && shipInfo.yearBuilt;
    var lastRefurb = shipInfo && shipInfo.lastRefurbished;
    if (lastRefurb) parts.push('리뉴얼' + lastRefurb);
    else if (yearBuilt) parts.push('건조' + yearBuilt);
    return parts.join(' · ');
  }

  function getHistoricalSnapshotPrice(entry, cabinType) {
    var prices = entry && entry.prices ? entry.prices : {};

    if (cabinType) {
      var preferred = toNumber(prices[cabinType]);
      return preferred !== null && preferred > 0 ? preferred : null;
    }

    return Object.keys(prices).reduce(function (lowest, key) {
      var amount = toNumber(prices[key]);
      if (amount === null || amount <= 0) {
        return lowest;
      }
      return lowest === null || amount < lowest ? amount : lowest;
    }, null);
  }

  function getPriceChangeSummary(cruise, cabinType) {
    var history = Array.isArray(cruise && cruise.priceHistory) ? cruise.priceHistory : [];
    var latestEntry;
    var previousEntry;
    var latestPrice;
    var previousPrice;

    if (history.length < 2) {
      return null;
    }

    latestEntry = history[history.length - 1];
    previousEntry = history[history.length - 2];
    latestPrice = getHistoricalSnapshotPrice(latestEntry, cabinType);
    previousPrice = getHistoricalSnapshotPrice(previousEntry, cabinType);

    if (latestPrice === null || previousPrice === null || latestPrice === previousPrice) {
      return null;
    }

    return {
      direction: latestPrice > previousPrice ? 'up' : 'down',
      amount: Math.abs(latestPrice - previousPrice),
      latest: latestPrice,
      previous: previousPrice
    };
  }

  function renderPriceChangeMarkup(summary) {
    if (!summary) {
      return '';
    }

    return [
      '<span class="price-change price-change-', escapeHtml(summary.direction), '">',
      escapeHtml(summary.direction === 'up' ? '↑ ' : '↓ '),
      escapeHtml(formatPrice(summary.amount)),
      '</span>'
    ].join('');
  }

  function renderCompactScoreBadge(label, score) {
    var numericScore = toNumber(score);
    var text = label || '';

    if (numericScore === null) {
      return '<span class="score normal">' + escapeHtml(text ? text + '-' : '-') + '</span>';
    }

    return '<span class="score ' + getScoreClass(numericScore) + '">' + escapeHtml(text + Math.round(numericScore)) + '</span>';
  }

  function renderCabinRecommendBadge(cabinType, cruise) {
    return renderCompactScoreBadge(CABIN_LABELS[cabinType] || '', getRecommendScoreForCabin(cruise, cabinType));
  }

  function renderBestRecommendBadge(cruise) {
    var result = getBestRecommendScoreWithLabel(cruise);
    return renderCompactScoreBadge(result.label, result.score);
  }

  function renderCabinPriceCell(cruise, cabinType) {
    var price = getCabinPrice(cruise, cabinType);
    var priceChangeSummary = getPriceChangeSummary(cruise, cabinType);
    var priceClass = price === null ? 'muted-text' : 'price-text';

    return [
      '<td><div>',
      '<span class="', escapeHtml(priceClass), '">', escapeHtml(formatPrice(price)), '</span>',
      renderPriceChangeMarkup(priceChangeSummary),
      '</div>',
      '<div class="cell-meta">', renderCabinRecommendBadge(cabinType, cruise), '</div>',
      '</td>'
    ].join('');
  }

  function renderCardCabinPriceSummary(cruise) {
    return [
      '<div class="card-meta">',
      CABIN_TYPES.map(function (cabinType) {
        var score = getRecommendScoreForCabin(cruise, cabinType);
        var text = (CABIN_LABELS[cabinType] || '') + ' ' + formatPrice(getCabinPrice(cruise, cabinType));
        if (score !== null) {
          text += ' · ' + Math.round(score);
        }
        return '<span class="price-pill">' + escapeHtml(text) + '</span>';
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderTableRow(cruise) {
    var num = Number(cruise && cruise.num) || 0;
    var isFavorite = favoritesApi && favoritesApi.isFavorite && favoritesApi.isFavorite(num);
    var isCompared = state.compareSelection.indexOf(num) !== -1;
    var perNight = getCabinFilteredPerNight(cruise);
    var itineraryMarkup = renderItineraryMarkup(cruise);
    var badges = getCruiseBadges(cruise);
    var shipInfoSummary = formatShipInfoSummary(cruise && cruise.shipInfo);
    var lineDisplay = formatCruiseLineDisplay(cruise && cruise.cruiseLine || '-');

    return [
      '<tr class="cruise-row">',
      '<td><input type="checkbox" class="compare-checkbox" data-num="', escapeHtml(num), '"', isCompared ? ' checked' : '', ' aria-label="비교 선택"></td>',
      '<td><button type="button" class="favorite-btn', isFavorite ? ' is-active' : '', '" data-action="favorite" data-num="', escapeHtml(num), '" aria-pressed="', isFavorite ? 'true' : 'false', '" aria-label="즐겨찾기 토글">', isFavorite ? '★' : '☆', '</button></td>',
      '<td><a href="#" class="row-link" data-action="detail" data-num="', escapeHtml(num), '">#', escapeHtml(num), '</a>', badges, '</td>',
      '<td>', escapeHtml(lineDisplay), '</td>',
      '<td><div class="cell-primary"><a href="#" class="row-link" data-action="detail" data-num="', escapeHtml(num), '">', escapeHtml(cruise && cruise.shipName || '-'), '</a></div>',
      shipInfoSummary ? '<div class="cell-meta">' + escapeHtml(shipInfoSummary) + '</div>' : '',
      '</td>',
      '<td>', escapeHtml(formatStar(cruise && cruise.shipRating)),
      cruise && cruise.shipInfo ? '<div class="cell-meta">1:' + escapeHtml(cruise.shipInfo.ratio) + '</div>' : '',
      '</td>',
      '<td>', renderBestRecommendBadge(cruise), '</td>',
      '<td>', escapeHtml(formatDepartureDate(cruise && cruise.departureDate)), '</td>',
      '<td>', escapeHtml(formatNights(cruise && cruise.nights)), '</td>',
      '<td>', escapeHtml(cruise && cruise.departurePort || '-'), '</td>',
      '<td>', escapeHtml(cruise && cruise.arrivalPort || '-'), '</td>',
      itineraryMarkup,
      renderCabinPriceCell(cruise, 'inside'),
      renderCabinPriceCell(cruise, 'oceanview'),
      renderCabinPriceCell(cruise, 'balcony'),
      renderCabinPriceCell(cruise, 'suite'),
      '<td><span class="per-night-text">', escapeHtml(formatPerNight(perNight)), '</span></td>',
      '<td>', renderDiscountMarkup(Number(cruise && cruise.discountPct) || 0), '</td>',
      '<td>', renderScoreBadgeWithLabel(cruise && cruise.dealScores), '</td>',
      '<td>', renderScoreBadgeWithLabel(cruise && cruise.valueScores), '</td>',
      '<td><a href="', escapeHtml(safeUrl(cruise && cruise.bookingUrl)), '" target="_blank" rel="noopener noreferrer">예약</a></td>',
      '</tr>'
    ].join('');
  }

  function renderCruiseCard(cruise) {
    var num = Number(cruise && cruise.num) || 0;
    var isFavorite = favoritesApi && favoritesApi.isFavorite && favoritesApi.isFavorite(num);
    var isCompared = state.compareSelection.indexOf(num) !== -1;
    var lowestPrice = getCabinFilteredPrice(cruise);
    var perNight = getCabinFilteredPerNight(cruise);
    var discountPct = Number(cruise && cruise.discountPct) || 0;
    var dealScore = getBestScore(cruise && cruise.dealScores);
    var valueScore = getBestScore(cruise && cruise.valueScores);
    var busanTag = cruise && cruise.isBusanRelated ? '<span class="busan-tag">부산 관련</span>' : '';
    var scoreRow = [busanTag, renderBestRecommendBadge(cruise), renderScoreBadge(dealScore), renderScoreBadge(valueScore)].filter(Boolean).join('');
    var stopCountText = Array.isArray(cruise && cruise.stopPorts) && cruise.stopPorts.length ? cruise.stopPorts.length + '개 기항 정보' : '세부 기항 정보 없음';
    var lineDisplay = formatCruiseLineDisplay(cruise && cruise.cruiseLine || '-');

    return [
      '<article class="cruise-card">',
      '<div class="card-head">',
      '<div>',
      '<div class="card-subtitle">#', escapeHtml(num), getCruiseBadges(cruise), ' · ', escapeHtml(lineDisplay), '</div>',
      '<h3 class="card-title"><a href="#" class="row-link" data-action="detail" data-num="', escapeHtml(num), '">', escapeHtml(cruise && cruise.shipName || '-'), '</a></h3>',
      '<div class="card-subtitle">', escapeHtml(formatDepartureDate(cruise && cruise.departureDate)), ' · ', escapeHtml(formatNights(cruise && cruise.nights)), ' · ', escapeHtml(formatStar(cruise && cruise.shipRating)), '</div>',
      '</div>',
      '<button type="button" class="favorite-btn', isFavorite ? ' is-active' : '', '" data-action="favorite" data-num="', escapeHtml(num), '" aria-pressed="', isFavorite ? 'true' : 'false', '" aria-label="즐겨찾기 토글">', isFavorite ? '★' : '☆', '</button>',
      '</div>',
      scoreRow ? '<div class="card-meta">' + scoreRow + '</div>' : '',
      '<div class="card-grid">',
      renderCardStat('출발지', cruise && cruise.departurePort || '-'),
      renderCardStat('도착지', cruise && cruise.arrivalPort || '-'),
      renderCardStat('최저가', formatPrice(lowestPrice)),
      renderCardStat('박당가', formatPerNight(perNight)),
      renderCardStat('할인율', discountPct > 0 ? discountPct + '%' : '-'),
      renderCardStat('일정', stopCountText),
      '</div>',
      renderCardCabinPriceSummary(cruise),
      '<div class="card-subtitle">', escapeHtml(CruiseUtils.truncateText ? CruiseUtils.truncateText(cruise && cruise.itinerary || '-', 88) : cruise && cruise.itinerary || '-'), '</div>',
      '<div class="card-actions">',
      '<label class="ghost-button table-meta"><input type="checkbox" class="compare-checkbox" data-num="', escapeHtml(num), '"', isCompared ? ' checked' : '', '> 비교 선택</label>',
      '<button type="button" class="ghost-button" data-action="detail" data-num="', escapeHtml(num), '">상세 보기</button>',
      '<a class="action-button" href="', escapeHtml(safeUrl(cruise && cruise.bookingUrl)), '" target="_blank" rel="noopener noreferrer">예약하기</a>',
      '</div>',
      '</article>'
    ].join('');
  }

  function renderCardStat(label, value) {
    return [
      '<div class="card-stat">',
      '<div class="card-stat-label">', escapeHtml(label), '</div>',
      '<div class="card-stat-value">', escapeHtml(value), '</div>',
      '</div>'
    ].join('');
  }

  var COUNTRY_MAP = {
    'south korea': '한', 'korea': '한', '대한민국': '한', '한국': '한',
    'japan': '일', '일본': '일',
    'china': '중', '중국': '중',
    'taiwan': '대', '대만': '대',
    'singapore': '싱', '싱가포르': '싱',
    'hong kong': '홍', '홍콩': '홍',
    'malaysia': '말', '말레이시아': '말',
    'thailand': '태', '태국': '태',
    'vietnam': '베', '베트남': '베',
    'philippines': '필', '필리핀': '필',
    'indonesia': '인니',
    'india': '인',
    'australia': '호',
    'at sea': '바'
  };

  function getCountryCode(portName) {
    if (!portName) return '?';
    var lower = portName.toLowerCase();
    if (lower === 'at sea' || lower === '해상') return '바';
    for (var key in COUNTRY_MAP) {
      if (lower.indexOf(key) !== -1) return COUNTRY_MAP[key];
    }
    // 한글 포트면 국가 추측
    if (/부산|제주|인천|서울|강정|속초/.test(portName)) return '한';
    if (/상하이|홍콩/.test(portName)) return '중';
    if (/후쿠오카|오사카|도쿄|나가사키|가고시마|사세보/.test(portName)) return '일';
    return '?';
  }

  function summarizeRoute(cruise) {
    var ports = [];
    if (cruise && cruise.stopPorts && cruise.stopPorts.length > 0) {
      ports = cruise.stopPorts.map(function (p) { return p.port || ''; });
    } else if (cruise && cruise.itinerary) {
      ports = cruise.itinerary.split('→').map(function (s) { return s.trim(); });
    }
    if (ports.length === 0) return '-';

    // 국가별 카운트
    var counts = {};
    var order = [];
    for (var i = 0; i < ports.length; i++) {
      var code = getCountryCode(ports[i]);
      if (!counts[code]) { counts[code] = 0; order.push(code); }
      counts[code]++;
    }
    // "한1,일2,바3" 형태
    var parts = order.map(function (code) { return code + counts[code]; });
    var result = parts.join(',');
    return result.length > 20 ? result.substring(0, 20) + '..' : result;
  }

  function renderItineraryMarkup(cruise) {
    var itinerary = cruise && cruise.itinerary ? String(cruise.itinerary) : '-';
    var stopPorts = Array.isArray(cruise && cruise.stopPorts) ? cruise.stopPorts : [];
    var previewText = summarizeRoute(cruise);
    var tooltipMarkup;

    if (!stopPorts.length) {
      tooltipMarkup = '<p class="muted-text">세부 기항 시간 정보가 없습니다.</p>';
    } else {
      tooltipMarkup = [
        '<ul class="tooltip-list">',
        stopPorts.map(function (entry) {
          return renderTooltipItem(entry);
        }).join(''),
        '</ul>'
      ].join('');
    }

    return [
      '<td class="itinerary-cell">',
      '<div class="itinerary-preview">',
      '<span>', escapeHtml(previewText), '</span>',
      '</div>',
      '<div class="itinerary-tooltip">',
      '<h4>기항 일정</h4>',
      tooltipMarkup,
      '</div>',
      '</td>'
    ].join('');
  }

  function renderTooltipItem(entry) {
    var port = entry && entry.port ? String(entry.port) : '미상';
    var isSeaDay = /at sea/i.test(port);
    var timeParts = [];

    if (entry && entry.arrive) {
      timeParts.push('도착 ' + entry.arrive);
    }

    if (entry && entry.depart) {
      timeParts.push('출발 ' + entry.depart);
    }

    return [
      '<li>',
      '<span class="tooltip-port', isSeaDay ? ' sea-day' : '', '">', escapeHtml(port), '</span>',
      '<span class="tooltip-date">', escapeHtml([entry && entry.date || '', timeParts.join(' · ')].filter(Boolean).join(' · ')), '</span>',
      '</li>'
    ].join('');
  }

  function renderDiscountMarkup(discountPct) {
    if (!discountPct) {
      return '<span class="muted-text">-</span>';
    }

    return '<span class="discount-text">' + escapeHtml(discountPct + '%') + '</span>';
  }

  function renderScoreBadge(score) {
    var numericScore = Number(score) || 0;
    return '<span class="score ' + getScoreClass(numericScore) + '">' + escapeHtml(numericScore ? numericScore + '점' : '0점') + '</span>';
  }

  function renderScoreBadgeWithLabel(scores) {
    var result = getBestScoreWithLabel(scores);
    var numericScore = result.score;
    var label = result.label;
    var scoreClass = getScoreClass(numericScore);
    var text = label ? label + numericScore : (numericScore || '0');
    return '<span class="score ' + scoreClass + '">' + escapeHtml(text) + '</span>';
  }

  function renderDistributionChart(cruises) {
    var prices = cruises.map(function (cruise) {
      return convertPriceForDisplay(getCabinFilteredPrice(cruise));
    }).filter(function (value) {
      return Number.isFinite(value);
    });
    var histogram;

    if (!dom.distributionChart || !root.Chart || !prices.length) {
      destroyDistributionChart();
      return;
    }

    histogram = buildHistogram(prices);
    destroyDistributionChart();
    distributionChart = new root.Chart(dom.distributionChart, {
      type: 'bar',
      data: {
        labels: histogram.labels,
        datasets: [
          {
            label: '크루즈 수',
            data: histogram.counts,
            backgroundColor: ['rgba(114, 212, 255, 0.85)', 'rgba(38, 184, 243, 0.8)', 'rgba(243, 210, 123, 0.82)', 'rgba(116, 209, 145, 0.82)', 'rgba(255, 141, 141, 0.82)', 'rgba(114, 212, 255, 0.7)', 'rgba(38, 184, 243, 0.65)', 'rgba(243, 210, 123, 0.68)']
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                return ' ' + context.raw + '개';
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 0,
              autoSkip: false
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  }

  function buildHistogram(prices) {
    var minPrice = Math.min.apply(Math, prices);
    var maxPrice = Math.max.apply(Math, prices);
    var binCount = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(prices.length))));
    var span = Math.max(1, maxPrice - minPrice);
    var step = Math.max(1, Math.ceil(span / binCount));
    var labels = [];
    var counts = [];
    var index;

    for (index = 0; index < binCount; index += 1) {
      labels.push(formatPriceLabel(minPrice + step * index, minPrice + step * (index + 1) - 1));
      counts.push(0);
    }

    prices.forEach(function (price) {
      var targetIndex = Math.min(binCount - 1, Math.floor((price - minPrice) / step));
      counts[targetIndex] += 1;
    });

    return {
      labels: labels,
      counts: counts
    };
  }

  function formatPriceLabel(start, end) {
    var prefix = state.currencyMode === 'KRW' ? '₩' : '$';

    return prefix + Number(start).toLocaleString('ko-KR') + ' - ' + prefix + Number(end).toLocaleString('ko-KR');
  }

  function destroyDistributionChart() {
    if (distributionChart && typeof distributionChart.destroy === 'function') {
      distributionChart.destroy();
    }

    distributionChart = null;
  }

  function renderLineAnalysis(cruises) {
    var stats = CruiseUtils.buildCruiseLineStats ? CruiseUtils.buildCruiseLineStats(cruises) : [];
    var extrasByLine = Object.create(null);

    if (!dom.lineAnalysisGrid) {
      return;
    }

    if (!stats.length) {
      renderLineAnalysisEmptyState(state.loadError ? '선사 데이터를 불러오지 못했습니다.' : '조건에 맞는 선사 데이터가 없습니다.');
      return;
    }

    cruises.forEach(function (cruise) {
      var line = cruise && cruise.cruiseLine ? String(cruise.cruiseLine) : '';

      if (!line) {
        return;
      }

      if (!extrasByLine[line]) {
        extrasByLine[line] = {
          busanCount: 0,
          hotDeals: 0,
          bestRating: 0
        };
      }

      if (cruise.isBusanRelated) {
        extrasByLine[line].busanCount += 1;
      }

      if (Number(cruise.discountPct) >= 50) {
        extrasByLine[line].hotDeals += 1;
      }

      extrasByLine[line].bestRating = Math.max(extrasByLine[line].bestRating, Number(cruise.shipRating) || 0);
    });

    dom.lineAnalysisGrid.innerHTML = stats.map(function (entry) {
      var extra = extrasByLine[entry.cruiseLine] || { busanCount: 0, hotDeals: 0, bestRating: 0 };

      return [
        '<button type="button" class="line-card" data-line="', escapeHtml(entry.cruiseLine), '">',
        '<div class="card-head">',
        '<div>',
        '<h3>', escapeHtml(entry.cruiseLine), '</h3>',
        '<div class="card-subtitle">카드를 누르면 목록으로 필터링합니다.</div>',
        '</div>',
        '<span class="line-chip">', escapeHtml(entry.count + '개 일정'), '</span>',
        '</div>',
        '<div class="line-stats">',
        renderLineStat('최저가', formatPrice(entry.minPrice)),
        renderLineStat('평균 박당가', formatPerNight(entry.avgPerNight)),
        renderLineStat('부산 관련', extra.busanCount + '개'),
        renderLineStat('50%+ 특가', extra.hotDeals + '개'),
        renderLineStat('최고 별점', formatStar(extra.bestRating)),
        '</div>',
        '</button>'
      ].join('');
    }).join('');
  }

  function renderLineStat(label, value) {
    return [
      '<div class="line-stat">',
      '<span class="muted-text">', escapeHtml(label), '</span>',
      '<strong>', escapeHtml(value), '</strong>',
      '</div>'
    ].join('');
  }

  function renderCalendar(cruises) {
    if (!dom.calendarRoot) {
      return;
    }

    if (root.CruiseCalendar && typeof root.CruiseCalendar.render === 'function') {
      root.CruiseCalendar.render(cruises, dom.calendarRoot);
      return;
    }

    renderCalendarFallback('캘린더 모듈을 불러오지 못했습니다.');
  }

  function renderCalendarFallback(message) {
    if (dom.calendarRoot) {
      dom.calendarRoot.innerHTML = '<div class="calendar-empty">' + escapeHtml(message) + '</div>';
    }
  }

  function renderEmptyTable(message) {
    if (dom.cruiseTable) {
      dom.cruiseTable.innerHTML = '<tr><td colspan="' + EMPTY_TABLE_COLSPAN + '"><div class="empty-state">' + escapeHtml(message) + '</div></td></tr>';
    }
  }

  function renderCardEmptyState(message) {
    if (dom.cruiseCards) {
      dom.cruiseCards.innerHTML = '<div class="empty-state">' + escapeHtml(message) + '</div>';
    }
  }

  function renderLineAnalysisEmptyState(message) {
    if (dom.lineAnalysisGrid) {
      dom.lineAnalysisGrid.innerHTML = '<div class="empty-state">' + escapeHtml(message) + '</div>';
    }
  }

  function syncCompareCheckboxes() {
    Array.prototype.slice.call(root.document.querySelectorAll('.compare-checkbox[data-num]')).forEach(function (checkbox) {
      var num = Number(checkbox.getAttribute('data-num'));
      checkbox.checked = state.compareSelection.indexOf(num) !== -1;
    });
  }

  function toggleFavorite(num) {
    if (!favoritesApi || typeof favoritesApi.toggle !== 'function') {
      return;
    }

    favoritesApi.toggle(num);
    updateStats();
    applyStateAndRender();
  }

  function openCruiseDetail(num) {
    if (!root.CruiseModal || typeof root.CruiseModal.showDetail !== 'function') {
      return;
    }

    root.CruiseModal.showDetail(num);
    trackRecentView(num);
  }

  function checkHashNavigation() {
    var hash = location.hash || '';
    var match = hash.match(/cruise=(\d+)/);
    if (match) {
      var num = parseInt(match[1]);
      if (num > 0) openCruiseDetail(num);
    }
  }

  function trackRecentView(num) {
    try {
      var key = 'cruise_recent_views';
      var recent = JSON.parse(localStorage.getItem(key) || '[]');
      recent = recent.filter(function (n) { return n !== num; });
      recent.unshift(num);
      if (recent.length > 20) recent = recent.slice(0, 20);
      localStorage.setItem(key, JSON.stringify(recent));
    } catch (e) {}
  }

  function syncExternalModules() {
    if (root.CruiseModal && typeof root.CruiseModal.configure === 'function') {
      root.CruiseModal.configure({
        getState: getState,
        cruises: state.cruises.slice(),
        currencyMode: state.currencyMode,
        exchangeRate: state.exchangeRate,
        onFavoriteChange: function () {
          updateStats();
          applyStateAndRender();
        }
      });
    }
  }

  function getState() {
    return {
      cruises: state.cruises.slice(),
      filteredCruises: state.filteredCruises.slice(),
      exportedAt: state.exportedAt,
      exchangeRate: state.exchangeRate,
      activeView: state.activeView,
      currencyMode: state.currencyMode,
      compareSelection: state.compareSelection.slice()
    };
  }

  function refresh() {
    applyStateAndRender();
  }

  function getStoredValue(key, fallback) {
    try {
      return root.localStorage.getItem(key) || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function setStoredValue(key, value) {
    try {
      root.localStorage.setItem(key, value);
    } catch (error) {
      return;
    }
  }

  function cloneFilters(filters) {
    return {
      num: filters.num,
      search: filters.search,
      line: filters.line,
      month: filters.month,
      departureStart: filters.departureStart,
      departureEnd: filters.departureEnd,
      departure: filters.departure,
      arrival: filters.arrival,
      destination: filters.destination,
      nightsMin: filters.nightsMin,
      nightsMax: filters.nightsMax,
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
      starMin: filters.starMin,
      cabinType: filters.cabinType,
      perNightMax: filters.perNightMax,
      recommendMin: filters.recommendMin
    };
  }

  function normalizeFilterValue(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function buildDestinationText(cruise) {
    var ports = Array.isArray(cruise && cruise.stopPorts) ? cruise.stopPorts.map(function (entry) {
      return entry && entry.port ? entry.port : '';
    }) : [];

    return [cruise && cruise.itinerary, cruise && cruise.arrivalPort].concat(ports).join(' ');
  }

  function formatMonthLabel(monthValue) {
    var parts = String(monthValue).split('-');
    var year = parts[0];
    var month = parts[1];

    if (!year || !month) {
      return monthValue;
    }

    return year + '년 ' + month + '월';
  }

  function formatDepartureDate(dateValue) {
    var date = createDate(dateValue);

    if (!date) {
      return '-';
    }

    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  function formatUpdatedAt(dateValue) {
    var date = createDate(dateValue);

    if (!date) {
      return '-';
    }

    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatNights(value) {
    var nights = Number(value);
    return Number.isFinite(nights) ? nights + '박' : '-';
  }

  function formatStar(value) {
    var rating = toNumber(value);
    return rating === null ? '-' : rating + '⭐';
  }

  function formatPrice(value) {
    if (CruiseUtils.formatPrice) {
      return CruiseUtils.formatPrice(value, state.currencyMode);
    }

    var converted = convertPriceForDisplay(value);
    return converted === null ? '-' : (state.currencyMode === 'KRW' ? '₩' : '$') + converted.toLocaleString('ko-KR');
  }

  function formatPerNight(value) {
    if (CruiseUtils.formatPerNight) {
      return CruiseUtils.formatPerNight(value, state.currencyMode);
    }

    var priceText = formatPrice(value);
    return priceText === '-' ? priceText : priceText + ' / 박';
  }

  function convertPriceForDisplay(value) {
    if (CruiseUtils.convertPrice) {
      return CruiseUtils.convertPrice(value, state.currencyMode);
    }

    var amount = toNumber(value);
    if (amount === null) {
      return null;
    }

    return state.currencyMode === 'KRW' ? Math.round(amount * state.exchangeRate) : Math.round(amount);
  }

  function getLowestPrice(cruise) {
    if (CruiseUtils.getLowestPrice) {
      return CruiseUtils.getLowestPrice(cruise);
    }

    var prices = Object.keys(cruise && cruise.cabinPrices || {}).map(function (key) {
      return toNumber(cruise.cabinPrices[key]);
    }).filter(function (price) {
      return price !== null && price > 0;
    });

    return prices.length ? Math.min.apply(Math, prices) : Infinity;
  }

  function getPerNight(cruise) {
    if (CruiseUtils.getInsidePerNight) {
      return CruiseUtils.getInsidePerNight(cruise);
    }

    var lowestPrice = getLowestPrice(cruise);
    var nights = Number(cruise && cruise.nights);
    return Number.isFinite(lowestPrice) && Number.isFinite(nights) && nights > 0 ? lowestPrice / nights : Infinity;
  }

  function getScoreClass(score) {
    var numericScore = Number(score) || 0;
    var scoreClass = 'normal';

    if (numericScore >= 80) {
      scoreClass = 'hot3';
    } else if (numericScore >= 50) {
      scoreClass = 'hot2';
    } else if (numericScore >= 20) {
      scoreClass = 'hot1';
    }

    return scoreClass;
  }

  function getBestScore(scores) {
    if (CruiseUtils.getBestScore) {
      return CruiseUtils.getBestScore(scores);
    }

    return Object.keys(scores || {}).reduce(function (best, key) {
      return Math.max(best, Number(scores[key]) || 0);
    }, 0);
  }

  function matchText(text, query) {
    if (CruiseUtils.matchText) {
      return CruiseUtils.matchText(text, query);
    }

    return String(text || '').toLowerCase().indexOf(String(query || '').toLowerCase()) !== -1;
  }

  function getDateValue(dateValue) {
    var date = createDate(dateValue);
    return date ? date.getTime() : Infinity;
  }

  function createDate(dateValue) {
    var date;

    if (!dateValue) {
      return null;
    }

    date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function toNumber(value) {
    var amount;

    if (value === null || value === undefined || value === '') {
      return null;
    }

    amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  }

  function isMissingValue(value) {
    return value === null || value === undefined || value === '' || !Number.isFinite(value) && typeof value !== 'string';
  }

  function setText(element, text) {
    if (element) {
      element.textContent = text;
    }
  }

  function escapeHtml(value) {
    if (CruiseUtils.escapeHtml) {
      return CruiseUtils.escapeHtml(value);
    }

    return String(value === null || value === undefined ? '' : value);
  }

  function safeUrl(url) {
    if (CruiseUtils.safeUrl) {
      return CruiseUtils.safeUrl(url);
    }

    return String(url || '#');
  }

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', init);
  } else if (root.document) {
    init();
  }

  return {
    init: init,
    getState: getState,
    refresh: refresh,
    getCruiseLineBadge: getCruiseLineBadge,
    getPriceChangeSummary: getPriceChangeSummary,
    matchesDepartureDateRange: matchesDepartureDateRange
  };
});
