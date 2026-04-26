#!/usr/bin/env node
/**
 * CruiseDeckPlans에서 45척 고화질 캐빈 사진 + 도면 다운로드
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const SHIPS = [
  { name: 'Spectrum of the Seas', cdpName: 'Spectrum-of-the-Seas' },
  { name: 'Costa Serena', cdpName: 'Costa-Serena' },
  { name: 'MSC Bellissima', cdpName: 'MSC-Bellissima' },
  { name: 'Diamond Princess', cdpName: 'Diamond-Princess' },
  { name: 'Le Soleal', cdpName: 'Le-Soleal' },
  { name: 'Celebrity Millennium', cdpName: 'Celebrity-Millennium' },
  { name: 'Azamara Pursuit', cdpName: 'Azamara-Pursuit' },
  { name: 'Norwegian Jade', cdpName: 'Norwegian-Jade' },
  { name: 'Westerdam', cdpName: 'Westerdam' },
  { name: 'Seabourn Sojourn', cdpName: 'Seabourn-Sojourn' },
  { name: 'Star Seeker', cdpName: 'Star-Seeker' },
  { name: 'Noordam', cdpName: 'Noordam' },
  { name: 'Disney Adventure', cdpName: 'Disney-Adventure' },
  { name: 'Quantum of the Seas', cdpName: 'Quantum-of-the-Seas' },
  { name: 'Navigator of the Seas', cdpName: 'Navigator-of-the-Seas' },
  { name: 'Sapphire Princess', cdpName: 'Sapphire-Princess' },
  { name: 'Riviera', cdpName: 'Riviera' },
  { name: 'EXPLORA III', cdpName: 'Explora-III' },
  { name: 'Nautica', cdpName: 'Nautica' },
  { name: 'Celebrity Solstice', cdpName: 'Celebrity-Solstice' },
  { name: 'Viking Orion', cdpName: 'Viking-Orion' },
  { name: 'Silver Muse', cdpName: 'Silver-Muse' },
  { name: 'Silver Moon', cdpName: 'Silver-Moon' },
  { name: 'Crystal Serenity', cdpName: 'Crystal-Serenity' },
  { name: 'Royal Princess', cdpName: 'Royal-Princess' },
  { name: 'Vista', cdpName: 'Vista' },
  { name: 'Seven Seas Navigator', cdpName: 'Seven-Seas-Navigator' },
  { name: 'Seven Seas Explorer', cdpName: 'Seven-Seas-Explorer' },
  { name: 'Viking Venus', cdpName: 'Viking-Venus' },
  { name: 'Azamara Quest', cdpName: 'Azamara-Quest' },
  { name: 'Queen Elizabeth', cdpName: 'Queen-Elizabeth' },
  { name: 'Seabourn Encore', cdpName: 'Seabourn-Encore' },
  { name: 'Arcadia', cdpName: 'Arcadia' },
  { name: 'Queen Victoria', cdpName: 'Queen-Victoria' },
  { name: 'Volendam', cdpName: 'Volendam' },
  { name: 'Ovation of the Seas', cdpName: 'Ovation-of-the-Seas' },
  { name: 'Le Jacques Cartier', cdpName: 'Le-Jacques-Cartier' },
  { name: 'Coral Princess', cdpName: 'Coral-Princess' },
  { name: 'Grand Princess', cdpName: 'Grand-Princess' },
  { name: 'Queen Anne', cdpName: 'Queen-Anne' },
  { name: 'Azamara Onward', cdpName: 'Azamara-Onward' },
  { name: 'Carnival Luminosa', cdpName: 'Carnival-Luminosa' },
  { name: 'Regatta', cdpName: 'Regatta' },
  { name: 'Carnival Adventure', cdpName: 'Carnival-Adventure' },
  { name: 'Star Breeze', cdpName: 'Star-Breeze' },
];

const OUT_DIR = path.resolve(__dirname, '../images/cabins');
const MAPPING_FILE = path.resolve(__dirname, '../images/photo-mapping.json');

// CDP 카테고리 키워드 → 표준 타입
const TYPE_KEYWORDS = {
  inside: ['inside', 'interior', 'inner'],
  oceanview: ['oceanview', 'ocean view', 'ocean-view', 'vista', 'porthole', 'window', 'panorama'],
  balcony: ['balcony', 'verandah', 'veranda', 'terrace', 'french'],
  suite: ['suite', 'penthouse', 'concierge', 'royal', 'owner', 'grand suite'],
};

function classifyCategory(name) {
  const lower = (name || '').toLowerCase();
  // suite 먼저 (concierge balcony 같은 거 잡기)
  if (TYPE_KEYWORDS.suite.some(k => lower.includes(k))) return 'suite';
  if (TYPE_KEYWORDS.balcony.some(k => lower.includes(k))) return 'balcony';
  if (TYPE_KEYWORDS.oceanview.some(k => lower.includes(k))) return 'oceanview';
  if (TYPE_KEYWORDS.inside.some(k => lower.includes(k))) return 'inside';
  return null;
}

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

function fetchPage(url) {
  // 2026-04-26 P2 fix audit (cruise): timeout handler 추가 — 이전엔 timeout option 만 있고 abort 없음.
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }, timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) { resolve(''); return; }
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(data));
      res.on('error', () => resolve(''));
    });
    req.on('timeout', () => { req.destroy(); resolve(''); });
    req.on('error', () => resolve(''));
  });
}

function download(url, dest) {
  // 2026-04-26 P2 fix audit (cruise): timeout handler + atomic write (tmp + rename) + dir 생성 보장.
  return new Promise((resolve) => {
    if (!url || !url.startsWith('http')) { resolve(false); return; }
    try { fs.mkdirSync(path.dirname(dest), { recursive: true }); } catch(_) {}
    const tmp = dest + '.dl.tmp';
    const file = fs.createWriteStream(tmp);
    const _cleanup = (ok) => {
      try { file.close(); } catch(_) {}
      if (ok) {
        try { fs.renameSync(tmp, dest); } catch(_) { ok = false; }
      } else {
        try { fs.unlinkSync(tmp); } catch(_) {}
      }
      resolve(ok);
    };
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }, timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) { _cleanup(false); return; }
      res.pipe(file);
      file.on('finish', () => _cleanup(true));
      file.on('error', () => _cleanup(false));
      res.on('error', () => _cleanup(false));
    });
    req.on('timeout', () => { req.destroy(); _cleanup(false); });
    req.on('error', () => _cleanup(false));
  });
}

async function processShip(ship) {
  const shipKey = sanitize(ship.name);
  const result = {};

  // 1. 캐빈 카테고리 목록 가져오기
  const cabinsUrl = `https://www.cruisedeckplans.com/ships/cabins.php?ship=${ship.cdpName}`;
  const html = await fetchPage(cabinsUrl);
  if (!html) { console.log('❌ 페이지 없음:', ship.name); return result; }

  // 카테고리 링크 추출
  const catRegex = /category-detail\.php\?c=(\d+)["'][^>]*>([^<]+)/g;
  const categories = {};
  let match;
  while ((match = catRegex.exec(html)) !== null) {
    const catId = match[1];
    const catName = match[2].trim();
    const type = classifyCategory(catName);
    if (type && !categories[type]) {
      categories[type] = { id: catId, name: catName };
    }
  }

  // 2. 각 카테고리에서 첫 번째 풀사이즈 사진 + 도면 가져오기
  for (const [type, cat] of Object.entries(categories)) {
    const catUrl = `https://www.cruisedeckplans.com/ships/category-detail.php?c=${cat.id}`;
    const catHtml = await fetchPage(catUrl);
    if (!catHtml) continue;

    // 풀사이즈 사진 URL
    const photoRegex = /cabinpics\/\d+\/org\/[^"'\s]+\.jpg/g;
    const photos = [];
    let pm;
    while ((pm = photoRegex.exec(catHtml)) !== null) {
      photos.push('https://www.cruisedeckplans.com/DP/' + pm[0]);
    }

    // 도면 URL
    const floorRegex = /assets\/floors\/\d+\/web\/[^"'\s]+\.webp/g;
    const floors = [];
    let fm;
    while ((fm = floorRegex.exec(catHtml)) !== null) {
      floors.push('https://www.cruisedeckplans.com/' + fm[0]);
    }

    // 다운로드 (사진 최대 2장 + 도면 1장)
    const downloaded = [];
    for (let i = 0; i < Math.min(2, photos.length); i++) {
      const fname = `${shipKey}_${type}_${i}.jpg`;
      const dest = path.join(OUT_DIR, fname);
      const ok = await download(photos[i], dest);
      if (ok && fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
        downloaded.push(`images/cabins/${fname}`);
      } else {
        console.log('  ❌ 다운로드 실패:', type, i);
      }
      await new Promise(r => setTimeout(r, 500));
    }

    // 도면 다운로드
    if (floors.length > 0) {
      const floorFname = `${shipKey}_${type}_floor.webp`;
      const floorDest = path.join(OUT_DIR, floorFname);
      const ok = await download(floors[0], floorDest);
      if (ok && fs.existsSync(floorDest) && fs.statSync(floorDest).size > 1000) {
        downloaded.push(`images/cabins/${floorFname}`);
      }
    }

    if (downloaded.length > 0) {
      result[type] = downloaded;
    }

    await new Promise(r => setTimeout(r, 1000)); // 카테고리간 딜레이
  }

  return result;
}

async function run() {
  console.log('CruiseDeckPlans 고화질 사진 다운로드 시작');
  console.log('대상:', SHIPS.length, '척');

  const mapping = {};
  // 2026-04-26 P2 fix audit (cruise): JSON parse 실패 시 fail-closed.
  // 이전엔 silent ignore → 손상 매핑이 빈 객체로 덮어쓰여 기존 매핑 유실.
  if (fs.existsSync(MAPPING_FILE)) {
    try {
      Object.assign(mapping, JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8')));
    } catch(e) {
      console.error(`[FATAL] photo-mapping.json parse 실패 (${e.message}) — 기존 데이터 보호 위해 종료.`);
      process.exit(2);
    }
  }

  let total = 0, ok = 0;

  for (let i = 0; i < SHIPS.length; i++) {
    const ship = SHIPS[i];
    console.log(`[${i+1}/${SHIPS.length}] ${ship.name}...`);

    const result = await processShip(ship);
    const types = Object.keys(result);

    if (types.length > 0) {
      if (!mapping[ship.name]) mapping[ship.name] = {};
      for (const [type, files] of Object.entries(result)) {
        mapping[ship.name][type] = files.filter(f => !f.includes('_floor'));
      }
      ok++;
      console.log(`  ✅ ${types.join(', ')} (${types.length}타입)`);
    } else {
      console.log('  ⚠️ CDP에 없음');
    }
    total++;

    // 배 사이 딜레이 (CDP 부하 방지)
    await new Promise(r => setTimeout(r, 2000));
  }

  fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
  console.log(`\n완료: ${ok}/${total}척 다운로드`);
}

run().catch(e => { console.error(e); process.exit(1); });
