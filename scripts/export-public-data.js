#!/usr/bin/env node
/**
 * 크루즈 공개용 데이터 export
 * zmfnwm cruises.json → cruise-web/data/cruises-public.json
 * 민감 정보 제거, 공개 필드만 추출
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const SOURCE = path.resolve(__dirname, '../../zmfnwm/src/storage/data/cruises.json');
const LINE_PRICES = path.resolve(__dirname, '../../zmfnwm/src/storage/data/lineprices.json');
const SHIP_DB = path.resolve(__dirname, '../../zmfnwm/src/storage/data/shipdb.json');
const SHIP_PHOTOS = path.resolve(__dirname, '../../zmfnwm/cruise_ship_photos.json');
const DEST = path.resolve(__dirname, '../data/cruises-public.json');
const CABIN_IMAGES_DIR = path.resolve(__dirname, '../images/cabins');
const CABIN_TYPES = ['inside', 'oceanview', 'balcony', 'suite'];

async function run() {
  // 2026-04-26 P1 fix audit (cruise): SOURCE 손상 시 fail-closed — 이전 데이터 보존.
  // 이전엔 throw 가 발생하긴 했지만 process exit code 가 0 인 경로가 있어 silent skip 가능.
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  } catch (e) {
    console.error(`[FATAL] SOURCE JSON parse 실패: ${SOURCE} — ${e.message}. 이전 ${path.basename(DEST)} 보존하고 종료.`);
    process.exit(2);
  }
  if (!raw || typeof raw !== 'object') {
    console.error(`[FATAL] SOURCE schema 비정상 (root not object) — 이전 ${path.basename(DEST)} 보존하고 종료.`);
    process.exit(2);
  }
  const cruises = raw.cruises || {};

  // lineprices for deal scores
  let linePrices = {};
  try { linePrices = JSON.parse(fs.readFileSync(LINE_PRICES, 'utf8')); } catch (e) {}

  let shipDb = {};
  try { shipDb = JSON.parse(fs.readFileSync(SHIP_DB, 'utf8')); } catch (e) {}
  const shipInfoIndex = buildShipInfoIndex(shipDb);

  // ship photos — 로컬 이미지 매핑 우선
  // 2026-04-26 P1 fix audit (cruise codex follow-up): photo-mapping.json parse 실패 시 명시 경고
  // 이전: silent ignore → 손상된 매핑이 빈 객체로 fallback → 공개 JSON 에 사진 누락된 채 배포
  let localPhotoMap = {};
  const _photoMappingPath = path.resolve(__dirname, '../images/photo-mapping.json');
  if (fs.existsSync(_photoMappingPath)) {
    try {
      localPhotoMap = JSON.parse(fs.readFileSync(_photoMappingPath, 'utf8'));
    } catch (e) {
      console.error(`[FATAL] photo-mapping.json parse 실패 (${e.message}) — 손상된 매핑으로 빈 사진 데이터 배포 방지 위해 종료.`);
      process.exit(2);
    }
  }
  localPhotoMap = buildLocalPhotoIndex(localPhotoMap);

  let shipPhotos = [];
  try { shipPhotos = JSON.parse(fs.readFileSync(SHIP_PHOTOS, 'utf8')); } catch (e) {}
  const shipPhotoMap = {};
  for (const sp of shipPhotos) {
    shipPhotoMap[normalizeShipName(sp.shipName)] = sp;
  }

  const publicList = [];

  for (const [id, c] of Object.entries(cruises)) {
    // expired cruises skip
    if (c.departureDate) {
      const dep = new Date(c.departureDate + 'T23:59:59+09:00');
      if (dep < new Date()) continue;
    }

    const perNight = {};
    if (c.cabinPrices && c.nights > 0) {
      for (const type of CABIN_TYPES) {
        if (c.cabinPrices[type] > 0) {
          perNight[type] = Math.round(c.cabinPrices[type] / c.nights);
        }
      }
    }

    // deal scores (simplified)
    const dealScores = calcDealScores(c, linePrices);
    const valueScores = calcValueScores(c, linePrices);

    // 출발지/도착지 분리
    const ports = (c.itinerary || '').split('→').map(s => s.trim());
    const departurePort = ports[0] || c.departurePort || '';
    const arrivalPort = ports.length > 1 ? ports[ports.length - 1] : (c.arrivalPort || departurePort);

    // 경유지 (detailedItinerary에서 추출, 출발/도착 제외)
    let stopPorts = [];
    if (c.detailedItinerary && c.detailedItinerary.length > 0) {
      stopPorts = c.detailedItinerary
        .map(p => ({ port: p.port, date: p.date, arrive: p.arrive || '', depart: p.depart || '' }))
        .filter(p => p.port);
    } else if (ports.length > 2) {
      stopPorts = ports.slice(1, -1).map(p => ({ port: p, date: '', arrive: '', depart: '' }));
    }

    publicList.push({
      num: c.num,
      cruiseLine: c.cruiseLine || '',
      shipName: c.shipName || '',
      shipRating: c.shipRating || null,
      shipInfo: getShipInfoForCruise(c, shipInfoIndex),
      itinerary: c.itinerary || '',
      departurePort,
      arrivalPort,
      stopPorts,
      departureDate: c.departureDate || '',
      nights: c.nights || 0,
      days: c.days || 0,
      cabinPrices: sanitizePrices(c.cabinPrices),
      perNight,
      origPrice: c.origPrice || null,
      salePrice: c.salePrice || null,
      discountPct: c.discountPct || 0,
      bookingUrl: c.bookingUrl || '',
      itineraryImageUrl: c.itineraryImageUrl || null,
      shipPhotos: getShipPhotos(c.shipName, localPhotoMap, shipPhotoMap),
      itineraryUncertain: !c.detailedItinerary && (c.itinerary || '').split('→').length <= 2 && (c.nights || 0) > 1,
      listPriceOnly: !!c._listPriceOnly,
      isBusanRelated: !!c.isBusanRelated,
      isAsia: c.isAsia !== false,
      luxuryTier: c._luxuryTier || null,
      source: c.source || '',
      dealScores,
      valueScores,
      priceHistory: (c.priceHistory || []).map(h => ({
        date: h.date,
        prices: sanitizePrices(h.prices),
      })),
    });
  }

  // 추천 점수 계산 — 아시아/럭셔리/초럭셔리 3그룹 따로 정규화
  const asiaCruises = publicList.filter(c => !c.luxuryTier);
  const luxuryCruises = publicList.filter(c => c.luxuryTier === 'luxury');
  const ultraCruises = publicList.filter(c => c.luxuryTier === 'ultra');
  calcRecommendScores(asiaCruises);
  calcRecommendScores(luxuryCruises);
  calcRecommendScores(ultraCruises);

  // 럭셔리/초럭셔리: 내측/바다뷰 추천점수 제거 (발코니/스위트만)
  for (const c of [...luxuryCruises, ...ultraCruises]) {
    if (c.recommendScores) {
      c.recommendScores.inside = null;
      c.recommendScores.oceanview = null;
    }
  }

  // sort by num
  publicList.sort((a, b) => (a.num || 9999) - (b.num || 9999));

  // 환율
  const exchangeRate = await getExchangeRate(readExistingExchangeRate());

  // TMK 시크릿딜 수집
  let secretDeals = [];
  try {
    const https = require('https');
    // 2026-04-26 P1 fix audit (cruise): timeout handler 추가 — 이전엔 timeout option 만 있고 실제 abort 가
    // 없어 PM2 cron 경로에서 무기한 hung 가능. timeout 이벤트 발생 시 socket 명시적 destroy + reject.
    const sdHtml = await new Promise((resolve, reject) => {
      const req = https.get('https://cruisetmk.kr/wv/secretdeal/list', { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, (res) => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); res.on('error', reject);
      });
      req.on('timeout', () => { req.destroy(new Error('TMK request timeout')); });
      req.on('error', reject);
    });
    const sdRegex = /class="glc([^"]*)"[^>]*data-sunsa="([^"]*)"[^>]*data-nights="(\d+)"[^>]*data-price="([\d.]+)"[^>]*data-saildate="([^"]*)"[^>]*>([\s\S]*?)(?=<div class="glc[ "]|$)/g;
    let sm;
    while ((sm = sdRegex.exec(sdHtml)) !== null) {
      const classes = sm[1], nights = parseInt(sm[3]), price = parseFloat(sm[4]), sailDate = sm[5], body = sm[6];
      const idM = body.match(/detail\?id=(\d+)/);
      const itinM = body.match(/일정명<\/strong>([^<]+)/);
      const remainM = body.match(/잔여\s*(\d+)/);
      secretDeals.push({
        id: idM ? parseInt(idM[1]) : 0,
        price, currency: 'USD', sailDate, nights, days: nights + 1,
        itinerary: itinM ? `부산 → ${itinM[1].trim()} → 부산` : '',
        remaining: remainM ? parseInt(remainM[1]) : 0,
        soldOut: classes.includes('is-soldout'),
        shipName: 'MSC Bellissima', cruiseLine: 'MSC', departurePort: '부산',
        detailUrl: `https://cruisetmk.kr/wv/secretdeal/detail?id=${idM ? idM[1] : 0}`,
        source: 'tmk_secret',
      });
    }
    console.log(`TMK 시크릿딜: ${secretDeals.length}개`);
  } catch (e) {
    console.log(`TMK 시크릿딜 수집 실패: ${e.message}`);
  }

  const output = {
    exportedAt: new Date().toISOString(),
    exchangeRate,
    count: publicList.length,
    cruises: publicList,
    secretDeals,
  };

  // 2026-04-26 P2 fix audit (cruise): atomic write — tmp + rename. 이전엔 direct write 라
  // 부분쓰기 발생 시 손상된 JSON 이 그대로 배포될 위험.
  const tmpDest = DEST + '.tmp.' + process.pid;
  fs.writeFileSync(tmpDest, JSON.stringify(output, null, 2), 'utf8');
  fs.renameSync(tmpDest, DEST);
  console.log(`Exported ${publicList.length} cruises + ${secretDeals.length} secret deals → ${DEST}`);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value).replace(/,/g, '').trim();
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function normalizeShipName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function buildShipInfoIndex(shipDb) {
  const index = Object.create(null);

  for (const [key, ship] of Object.entries(shipDb || {})) {
    const passengers = toNumber(ship && ship.passengerCapacity);
    const crew = toNumber(ship && ship.crewSize);
    const hasCapacity = passengers !== null && crew !== null && crew > 0;
    const hasKidsInfo = !!(ship.kidsLevel || ship.kidsNotes || ship.kidsFriendly != null);

    if (!hasCapacity && !hasKidsInfo) {
      continue;
    }

    const yearBuilt = toNumber(ship && ship.yearBuilt);
    const lastRefurbished = toNumber(ship && ship.lastRefurbished);
    const tonnageRaw = (ship && ship.tonnage) || '';
    const tonnageNum = toNumber(tonnageRaw.replace(/[^0-9]/g, ''));
    const shipInfo = {
      passengers: passengers || null,
      crew: crew || null,
      ratio: hasCapacity ? Math.round((passengers / crew) * 10) / 10 : null,
      tonnage: tonnageNum || null,
      yearBuilt: yearBuilt || null,
      lastRefurbished: lastRefurbished || null,
      refurbishmentCost: (ship && ship.refurbishmentCost) || null,
      kidsFriendly: !!ship.kidsFriendly,
      kidsLevel: ship.kidsLevel || (ship.kidsFriendly ? 'mid' : 'none'),
      kidsNotes: ship.kidsNotes || null,
    };
    const aliases = [ship && ship.name, key && key.replace(/_/g, ' ')];

    for (const alias of aliases) {
      const normalized = normalizeShipName(alias);
      if (normalized) {
        index[normalized] = shipInfo;
      }
    }
  }

  return index;
}

function getShipInfoForCruise(cruise, shipInfoIndex) {
  const normalizedName = normalizeShipName(cruise && cruise.shipName);
  return normalizedName && shipInfoIndex && shipInfoIndex[normalizedName] ? shipInfoIndex[normalizedName] : null;
}

function buildLocalPhotoIndex(photoMap) {
  const index = Object.create(null);

  for (const [shipName, photos] of Object.entries(photoMap || {})) {
    const normalized = normalizeShipName(shipName);
    if (normalized) {
      index[normalized] = photos;
    }
  }

  return index;
}

function buildShipAssetStem(shipName) {
  return normalizeShipName(shipName).replace(/\s+/g, '_');
}

function getLocalCabinAssetPath(fileName) {
  if (!fileName) {
    return null;
  }

  return fs.existsSync(path.resolve(CABIN_IMAGES_DIR, fileName))
    ? `images/cabins/${fileName}`
    : null;
}

// 2026-04-26 P1 fix audit (cruise codex follow-up): photo-mapping path 검증
//  - allow only paths under images/cabins/ (no ../, no absolute, no scheme)
function _isSafeCabinPath(p) {
  if (typeof p !== 'string' || !p) return false;
  if (p.includes('..') || p.startsWith('/') || /^[a-z]+:\/\//i.test(p)) return false;
  return p.startsWith('images/cabins/');
}
function _filterSafePathArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(_isSafeCabinPath);
}
function _safeOrNull(v) {
  return _isSafeCabinPath(v) ? v : null;
}

function getShipPhotos(shipName, localMap, remoteMap) {
  const normalizedName = normalizeShipName(shipName);
  const local = localMap
    ? (normalizedName ? localMap[normalizedName] : null) || localMap[shipName] || null
    : null;
  const remote = remoteMap
    ? (normalizedName ? remoteMap[normalizedName] : null) || remoteMap[(shipName || '').toLowerCase()] || null
    : null;

  const assetStem = buildShipAssetStem(shipName);
  const result = { exterior: null, cabins: {}, floorPlans: {} };
  if (local) {
    result.exterior = _safeOrNull(local.exterior);
    for (const type of CABIN_TYPES) {
      const safe = _filterSafePathArray(local[type]);
      if (safe.length > 0) result.cabins[type] = safe;
    }
  }

  if (!result.exterior) {
    result.exterior = getLocalCabinAssetPath(`${assetStem}_exterior.jpg`);
  }

  for (const type of CABIN_TYPES) {
    const floorPlanPath = getLocalCabinAssetPath(`${assetStem}_${type}_floor.webp`);
    if (floorPlanPath) {
      result.floorPlans[type] = floorPlanPath;
    }
  }

  // 로컬 없으면 원격 URL 폴백
  if (!result.exterior && remote) result.exterior = remote.exteriorImage || null;
  if (remote && remote.cabinImages) {
    for (const type of CABIN_TYPES) {
      if (!result.cabins[type] && remote.cabinImages[type]) result.cabins[type] = remote.cabinImages[type];
    }
  }

  if (!result.exterior && Object.keys(result.cabins).length === 0 && Object.keys(result.floorPlans).length === 0) {
    return null;
  }

  return result;
}

function sanitizePrices(prices) {
  if (!prices) return {};
  const result = {};
  for (const type of CABIN_TYPES) {
    if (prices[type] > 0) result[type] = prices[type];
  }
  result.currency = prices.currency || 'USD';
  return result;
}

function calcRecommendScores(cruises) {
  const rawScoresByCabin = Object.create(null);
  for (const type of CABIN_TYPES) {
    rawScoresByCabin[type] = [];
  }

  for (const c of cruises) {
    c.recommendScores = {
      inside: null,
      oceanview: null,
      balcony: null,
      suite: null,
    };
    c.recommendScore = null;

    if (!c.shipInfo || !c.perNight || !c.nights || c.nights <= 0 || c.listPriceOnly) continue;

    const ratio = c.shipInfo.ratio;
    if (!ratio || ratio <= 0) continue;

    const stopCount = (c.stopPorts || []).filter(p =>
      p.port && !p.port.toLowerCase().includes('at sea')
      && p.port !== c.departurePort && p.port !== c.arrivalPort
    ).length;
    if (stopCount === 0) continue;

    const density = stopCount / c.nights;
    c._rawRecommendScores = {};

    for (const type of CABIN_TYPES) {
      const perNight = c.perNight[type];
      if (!perNight || perNight <= 0) continue;

      const rawScore = density / (ratio * ratio * perNight);
      c._rawRecommendScores[type] = rawScore;
      rawScoresByCabin[type].push(rawScore);
    }
  }

  for (const type of CABIN_TYPES) {
    const rawScores = rawScoresByCabin[type];
    if (rawScores.length === 0) continue;

    const maxS = Math.max(...rawScores);
    const minS = Math.min(...rawScores);
    const range = maxS - minS || 1;

    for (const c of cruises) {
      const rawScore = c._rawRecommendScores && c._rawRecommendScores[type];
      if (rawScore == null) continue;

      c.recommendScores[type] = Math.round(((rawScore - minS) / range) * 100);
    }
  }

  for (const c of cruises) {
    let bestScore = null;

    for (const type of CABIN_TYPES) {
      const score = c.recommendScores[type];
      if (score == null) continue;
      bestScore = bestScore === null ? score : Math.max(bestScore, score);
    }

    c.recommendScore = bestScore;
    delete c._rawRecommendScores;
  }
}

function calcDealScores(cruise, linePrices) {
  const scores = {};
  if (!cruise.nights || cruise.nights <= 0) return scores;
  const line = cruise.cruiseLine;
  if (!line) return scores;

  for (const type of CABIN_TYPES) {
    const price = cruise.cabinPrices && cruise.cabinPrices[type];
    if (!price || price <= 0) continue;
    const perNight = price / cruise.nights;
    const key = `_line_${line.toLowerCase().replace(/\s+/g, '_')}_${type}`;
    const data = linePrices[key];
    if (!data || !data.prices || data.prices.length < 3) continue;
    const sorted = [...data.prices].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    if (max <= min) continue;
    const score = Math.round(((max - perNight) / (max - min)) * 100);
    scores[type] = Math.max(0, Math.min(100, score));
  }
  return scores;
}

function calcValueScores(cruise, linePrices) {
  const scores = {};
  if (!cruise.nights || cruise.nights <= 0) return scores;

  for (const type of CABIN_TYPES) {
    const price = cruise.cabinPrices && cruise.cabinPrices[type];
    if (!price || price <= 0) continue;
    const perNight = price / cruise.nights;
    const key = `_market_all_${type}`;
    const data = linePrices[key];
    if (!data || !data.prices || data.prices.length < 5) continue;
    const sorted = [...data.prices].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    if (max <= min) continue;
    const score = Math.round(((max - perNight) / (max - min)) * 100);
    scores[type] = Math.max(0, Math.min(100, score));
  }
  return scores;
}

function readExistingExchangeRate() {
  try {
    const existing = JSON.parse(fs.readFileSync(DEST, 'utf8'));
    const rate = toNumber(existing && existing.exchangeRate);
    return rate !== null && rate > 0 ? rate : 1480;
  } catch (error) {
    return 1480;
  }
}

function getExchangeRate(fallbackRate) {
  return fetchUsdToKrwRate().catch(() => {
    return fallbackRate && fallbackRate > 0 ? fallbackRate : 1480;
  });
}

function fetchUsdToKrwRate() {
  return new Promise((resolve, reject) => {
    const request = https.get('https://open.er-api.com/v6/latest/USD', { timeout: 3000 }, (response) => {
      let body = '';

      response.on('data', (chunk) => {
        body += chunk;
      });

      response.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const rate = toNumber(parsed && parsed.rates ? parsed.rates.KRW : null);
          if (rate !== null && rate > 0) {
            resolve(rate);
            return;
          }
          reject(new Error('KRW rate not found'));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy(new Error('exchange rate request timed out'));
    });
  });
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildShipInfoIndex,
  getShipInfoForCruise,
  getShipPhotos,
  normalizeShipName,
  run,
};
