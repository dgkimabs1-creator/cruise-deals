#!/usr/bin/env node
/**
 * 모든 배 객실+외관 사진을 다운로드해서 images/ 에 저장
 * 파일명: shipname_type_N.jpg
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const photos = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../zmfnwm/cruise_ship_photos.json'), 'utf8'));
const outDir = path.resolve(__dirname, '../images/cabins');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

function download(url, dest) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith('http')) { resolve(false); return; }
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }, timeout: 15000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // follow redirect
        download(res.headers.location, dest).then(resolve);
        return;
      }
      if (res.statusCode !== 200) { file.close(); fs.unlinkSync(dest); resolve(false); return; }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
    });
    req.on('error', () => { file.close(); try { fs.unlinkSync(dest); } catch(e) {} resolve(false); });
    req.on('timeout', () => { req.destroy(); file.close(); try { fs.unlinkSync(dest); } catch(e) {} resolve(false); });
  });
}

async function run() {
  let total = 0, ok = 0, fail = 0;
  const mapping = {}; // shipName → { exterior, inside: [paths], ... }

  for (const ship of photos) {
    const shipKey = sanitize(ship.shipName);
    mapping[ship.shipName] = {};

    // Exterior
    if (ship.exteriorImage) {
      const ext = path.extname(new URL(ship.exteriorImage).pathname).split('?')[0] || '.jpg';
      const fname = `${shipKey}_exterior${ext}`;
      const dest = path.join(outDir, fname);
      total++;
      const result = await download(ship.exteriorImage, dest);
      if (result && fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
        mapping[ship.shipName].exterior = `images/cabins/${fname}`;
        ok++;
      } else {
        console.log('❌ exterior', ship.shipName);
        fail++;
      }
    }

    // Cabins
    for (const [type, urls] of Object.entries(ship.cabinImages || {})) {
      if (!Array.isArray(urls)) continue;
      mapping[ship.shipName][type] = [];
      for (let i = 0; i < urls.length; i++) {
        const fname = `${shipKey}_${type}_${i}.jpg`;
        const dest = path.join(outDir, fname);
        total++;
        const result = await download(urls[i], dest);
        if (result && fs.existsSync(dest) && fs.statSync(dest).size > 500) {
          mapping[ship.shipName][type].push(`images/cabins/${fname}`);
          ok++;
        } else {
          console.log('❌', ship.shipName, type, i);
          fail++;
        }
        // 딜레이
        await new Promise(r => setTimeout(r, 200));
      }
    }

    console.log(`✅ ${ship.shipName} (${ok}/${total})`);
  }

  // 매핑 저장
  fs.writeFileSync(path.resolve(__dirname, '../images/photo-mapping.json'), JSON.stringify(mapping, null, 2));
  console.log(`\n완료: ✅${ok} ❌${fail} / ${total}`);
}

run().catch(e => { console.error(e); process.exit(1); });
