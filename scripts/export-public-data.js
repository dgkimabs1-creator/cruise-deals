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

async function run() {
  const raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const cruises = raw.cruises || {};

  // lineprices for deal scores
  let linePrices = {};
  try { linePrices = JSON.parse(fs.readFileSync(LINE_PRICES, 'utf8')); } catch (e) {}

  let shipDb = {};
  try { shipDb = JSON.parse(fs.readFileSync(SHIP_DB, 'utf8')); } catch (e) {}
  const shipInfoIndex = buildShipInfoIndex(shipDb);

  // ship photos
  let shipPhotos = [];
  try { shipPhotos = JSON.parse(fs.readFileSync(SHIP_PHOTOS, 'utf8')); } catch (e) {}
  const shipPhotoMap = {};
  for (const sp of shipPhotos) {
    shipPhotoMap[sp.shipName.toLowerCase()] = sp;
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
      for (const type of ['inside', 'oceanview', 'balcony', 'suite']) {
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
      shipPhotos: shipPhotoMap[(c.shipName || '').toLowerCase()] ? {
        exterior: shipPhotoMap[(c.shipName || '').toLowerCase()].exteriorImage || null,
        cabins: shipPhotoMap[(c.shipName || '').toLowerCase()].cabinImages || {},
      } : null,
      itineraryUncertain: !c.detailedItinerary && (c.itinerary || '').split('→').length <= 2 && (c.nights || 0) > 1,
      isBusanRelated: !!c.isBusanRelated,
      source: c.source || '',
      dealScores,
      valueScores,
      priceHistory: (c.priceHistory || []).map(h => ({
        date: h.date,
        prices: sanitizePrices(h.prices),
      })),
    });
  }

  // sort by num
  publicList.sort((a, b) => (a.num || 9999) - (b.num || 9999));

  // 환율
  const exchangeRate = await getExchangeRate(readExistingExchangeRate());

  const output = {
    exportedAt: new Date().toISOString(),
    exchangeRate,
    count: publicList.length,
    cruises: publicList,
  };

  fs.writeFileSync(DEST, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Exported ${publicList.length} cruises → ${DEST}`);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
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

    if (passengers === null || crew === null || crew <= 0) {
      continue;
    }

    const shipInfo = {
      passengers,
      crew,
      ratio: Math.round((passengers / crew) * 10) / 10,
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

function sanitizePrices(prices) {
  if (!prices) return {};
  const result = {};
  for (const type of ['inside', 'oceanview', 'balcony', 'suite']) {
    if (prices[type] > 0) result[type] = prices[type];
  }
  result.currency = prices.currency || 'USD';
  return result;
}

function calcDealScores(cruise, linePrices) {
  const scores = {};
  if (!cruise.nights || cruise.nights <= 0) return scores;
  const line = cruise.cruiseLine;
  if (!line) return scores;

  for (const type of ['inside', 'oceanview', 'balcony', 'suite']) {
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

  for (const type of ['inside', 'oceanview', 'balcony', 'suite']) {
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
  normalizeShipName,
  run,
};
