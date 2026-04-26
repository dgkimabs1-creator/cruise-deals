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
  return String(name).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

// 2026-04-26 P1 fix audit (cruise codex follow-up): redirect handling 보강
//  - dest stream 을 redirect 결정 후 (200 OK 일 때만) 열기 → FD leak 방지
//  - depth 제한 (maxRedirects=5) 으로 redirect loop 방지
//  - tmp + rename atomic write
function download(url, dest, depth = 0) {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) { resolve(false); return; }
    if (depth > 5) { console.log('  ❌ redirect depth > 5'); resolve(false); return; }
    const mod = url.startsWith('https') ? https : http;
    const tmp = dest + '.dl.tmp';
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }, timeout: 15000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        res.resume(); // drain
        if (!loc) { resolve(false); return; }
        download(loc, dest, depth + 1).then(resolve);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); resolve(false); return; }
      const file = fs.createWriteStream(tmp);
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          try { fs.renameSync(tmp, dest); resolve(true); }
          catch(e) { try { fs.unlinkSync(tmp); } catch(_){} resolve(false); }
        });
      });
      file.on('error', () => { try { fs.unlinkSync(tmp); } catch(_){} resolve(false); });
      res.on('error', () => { try { fs.unlinkSync(tmp); } catch(_){} resolve(false); });
    });
    req.on('error', () => { try { fs.unlinkSync(tmp); } catch(_){} resolve(false); });
    req.on('timeout', () => { req.destroy(); try { fs.unlinkSync(tmp); } catch(_){} resolve(false); });
  });
}

// 2026-04-26 P1 fix audit (cruise codex follow-up): atomic JSON write
function writeJsonAtomic(filePath, obj) {
  const tmp = filePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, filePath);
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
    for (const [typeRaw, urls] of Object.entries(ship.cabinImages || {})) {
      if (!Array.isArray(urls)) continue;
      // 2026-04-26 P1 fix audit (cruise codex follow-up): type 키 sanitize — path traversal 방지
      const type = sanitize(typeRaw);
      if (!type) continue;
      mapping[ship.shipName][type] = [];
      for (let i = 0; i < urls.length; i++) {
        const fname = `${shipKey}_${type}_${i}.jpg`;
        const dest = path.join(outDir, fname);
        // 추가 방어: dest 가 outDir 밖으로 빠지지 않는지 확인
        if (!path.resolve(dest).startsWith(path.resolve(outDir) + path.sep)) {
          console.log('  ❌ path traversal blocked:', fname);
          continue;
        }
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

  // 매핑 저장 (atomic)
  writeJsonAtomic(path.resolve(__dirname, '../images/photo-mapping.json'), mapping);
  console.log(`\n완료: ✅${ok} ❌${fail} / ${total}`);
}

run().catch(e => { console.error(e); process.exit(1); });
