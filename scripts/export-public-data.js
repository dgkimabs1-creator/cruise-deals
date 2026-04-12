#!/usr/bin/env node
/**
 * 크루즈 공개용 데이터 export
 * zmfnwm cruises.json → cruise-web/data/cruises-public.json
 * 민감 정보 제거, 공개 필드만 추출
 */

const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(__dirname, '../../zmfnwm/src/storage/data/cruises.json');
const LINE_PRICES = path.resolve(__dirname, '../../zmfnwm/src/storage/data/lineprices.json');
const SHIP_PHOTOS = path.resolve(__dirname, '../../zmfnwm/cruise_ship_photos.json');
const DEST = path.resolve(__dirname, '../data/cruises-public.json');

async function run() {
  const raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const cruises = raw.cruises || {};

  // lineprices for deal scores
  let linePrices = {};
  try { linePrices = JSON.parse(fs.readFileSync(LINE_PRICES, 'utf8')); } catch (e) {}

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
  let exchangeRate = 1480;
  try {
    const { getUsdToKrw } = require(path.resolve(__dirname, '../../zmfnwm/src/utils/exchange'));
    exchangeRate = await getUsdToKrw();
  } catch (e) {}

  const output = {
    exportedAt: new Date().toISOString(),
    exchangeRate,
    count: publicList.length,
    cruises: publicList,
  };

  fs.writeFileSync(DEST, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Exported ${publicList.length} cruises → ${DEST}`);
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

run();
