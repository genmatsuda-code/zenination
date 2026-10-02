'use strict';
/**
 * verify-no-orphan — 公開面に「どこからも辿れない頁」が**増えて**いないか
 *
 * ★なぜ(2026-10-02): 佐藤が `git add -A` で、未公開の下書きをこの公開面へ出した。
 *   その頁は**どこからもリンクされていなかった**——孤児の頁は、漏れの一番 分かりやすい形。
 *
 * ★的を決め打ちの一覧にしない(§6)。`git ls-files` で**毎回 数え直す**。
 *   「足した人が門番にも足す」を要求しない——忘れるから。
 *
 * ★今 在る孤児(5本)は tools/known-standalone.txt に理由つきで控える。
 *   全部 赤にすると生まれた日から赤で、赤が風景になる。**増えた時だけ鳴らす。**
 *
 *   node tools/verify-no-orphan.js
 *   node tools/verify-no-orphan.js --mutants
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const KNOWN_FILE = path.join(__dirname, 'known-standalone.txt');

function known() {
  let t = '';
  try { t = fs.readFileSync(KNOWN_FILE, 'utf8'); } catch (_) { return []; }
  return t.split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean);
}

/** 追跡下の html を数え直す(決め打ちしない)。 */
function pages() {
  return execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter((s) => /\.html$/.test(s));
}

function orphansOf(list, read) {
  const bodies = list.map((f) => ({ f, body: read(f) }));
  const out = [];
  for (const { f } of bodies) {
    /* 根の index.html は入口そのもの。辿られる側ではない */
    if (f === 'index.html') continue;
    const base = f.split('/').pop();
    const linked = bodies.some((o) => o.f !== f && (o.body.indexOf(base) >= 0 || o.body.indexOf(f) >= 0));
    if (!linked) out.push(f);
  }
  return out;
}

function check(list, read, allow) {
  const orphans = orphansOf(list, read);
  const New = orphans.filter((f) => allow.indexOf(f) < 0);
  const gone = allow.filter((f) => list.indexOf(f) >= 0 && orphans.indexOf(f) < 0);
  console.log('追跡下の html ' + list.length + ' 本 / どこからも辿れない ' + orphans.length + ' 本'
    + '(控え済み ' + (orphans.length - New.length) + ' 本)');
  if (gone.length) {
    /* 控えに在るのに辿れるようになった=控えを掃除してよい。赤にはしない(良い変化) */
    console.log('  - 控えに在るが、もう辿れる(控えから外してよい): ' + gone.join(', '));
  }
  if (New.length) {
    console.log('  ✗ **控えに無い孤児の頁** ' + New.length + ' 本:');
    for (const f of New) console.log('      ' + f);
    console.log('    → 公開する頁なら、棚(dougu.html など)から辿れるようにする。');
    console.log('    → 出す気のない下書きなら、**この木の外へ置く**(公開リポに下書きを置かない)。');
    console.log('    → 直に開く正規の頁なら、tools/known-standalone.txt へ**理由つきで**足す。');
    return 1;
  }
  console.log('  ✓ 控えに無い孤児の頁は 0 本');
  return 0;
}

const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (_) { return ''; } };

if (process.argv.includes('--mutants')) {
  const list = pages(), allow = known();
  let red = 0, total = 0;
  const seeds = [
    ['下書きが公開面に増えた', () => check(list.concat(['下書き_leaked.html']),
      (f) => (f === '下書き_leaked.html' ? '<html>まだ出していない頁</html>' : read(f)), allow)],
    ['控えを空にした(既存の孤児が見える)', () => check(list, read, [])],
    ['棚から道具へのリンクが消えた', () => check(list,
      (f) => (f === 'dougu.html' ? read(f).split('yuugen.html').join('x.html') : read(f)), allow)],
  ];
  for (const [name, run] of seeds) {
    total++;
    console.log('\n=== mutant ' + name);
    const r = run();
    if (r) red++; else console.log('  ★GREEN=門番の穴');
  }
  console.log('\nmutants: ' + red + '/' + total + ' RED');
  process.exit(red === total ? 0 : 1);
}
process.exit(check(pages(), read, known()));
