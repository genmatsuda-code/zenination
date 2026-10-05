#!/usr/bin/env node
/**
 * 善意観測所の門番(2026-10-05 新設 / 同日 作り直し)
 *
 * ★ 作り直した理由(これがこの門番の一番 大事な記録):
 *   初版は**偽のチェーンの上で 20 項 緑・変異 9/9 RED** を出していたのに、
 *   本番を 375 幅の頭なし Chrome で開くと **NYAN の段が全部「読めませんでした」**だった。
 *   ブラウザからの Solana の公開 RPC は三つとも断られる(403/403/400)——
 *   **門番は、その道を一度も通っていなかった。**(CLAUDE.md §6「門番の緑は、見た範囲が一致しているだけ」)
 *   だから今は:
 *     ①頁が**チェーンを直接 叩いていない**ことを見る(叩いていたら赤)
 *     ②頁が**写しの紙を読む**ことを、実際に動かして見る
 *     ③写しが古い時に「古い」と言うか / 紙に届かない時に控えを出すか / 控えも無い時に数を出さないか
 *     ④本物の写しの紙(data/kansokujo.json)に、NYAN の総数と受領ウォレットの枚数が**数で**在るか
 *   そのうえで CI は、**本物のブラウザで本番の頁**を開いて数字が出ることを別の段で見る。
 *
 * 使い方: node tools/verify-kansokujo.js [--mutants]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const NL = String.fromCharCode(10);
const PAGE = path.join(__dirname, '..', 'kansokujo.html');
const DATA = path.join(__dirname, '..', 'data', 'kansokujo.json');

const SUPPLY = 49331401970.134;
const SHOWN = 1300000100;   // この数が頁に出たら「写しから出している」
const SNAP = {
  asOf: new Date().toISOString(),
  nyan: { supply: SUPPLY, wallets: { 'CgH6BbwFanjEaNrn3dBqRKXVhcDYDsKCvUEPw6eGCHWw': SHOWN, 'Abt54GpGwR4rnFzrSiCnKhLf1Hj1GJ9qCCfZAz7Jknyv': 0 } },
  wwb: { supply: 1110394294.764, wallets: { '0x029972f6c9baf23ae0bf60bf666fd290257cd5e8': 8874000 } },
};

function makeDom() {
  const nodes = {};
  const mk = (id) => (nodes[id] = { id, innerHTML: '', className: '', _t: '',
    set textContent(v) { this._t = String(v); this.innerHTML = String(v); },
    get textContent() { return this._t; },
    addEventListener() {} });
  ['asof', 'reload', 'nyanSupply', 'nyanCards', 'wwbSupply', 'wwbCards'].forEach(mk);
  return { nodes, document: { getElementById: (id) => nodes[id] || mk(id) },
    html: () => Object.keys(nodes).map((k) => nodes[k].innerHTML).join(NL) };
}

/** 頁の script を、偽の紙置き場の上で本当に動かす */
async function run(source, opt) {
  const o = opt || {};
  const dom = makeDom();
  const store = Object.assign({}, o.storage || {});
  let rpcHits = 0;
  const ctx = {
    document: dom.document,
    localStorage: {
      getItem: (k) => (o.noStorage ? (function () { throw new Error('使えない端末'); })() : (k in store ? store[k] : null)),
      setItem: (k, v) => { if (o.noStorage) throw new Error('使えない端末'); store[k] = v; },
    },
    Number, String, Object, Date, JSON, Math, Array, Error, isFinite, isNaN, BigInt,
    console: { log() {}, error() {} },
    setTimeout, clearTimeout,
    fetch: async function (url) {
      const u = String(url);
      /* ★ チェーンを直接 叩いたら、ここで数える(叩かないのが正しい) */
      if (/mainnet-beta|publicnode|drpc\.org|mainnet\.optimism\.io|solana/.test(u)) { rpcHits++; throw new Error('チェーンは断ります'); }
      if (o.noSnapshot) throw new Error('紙に届かない');
      if (o.badSnapshot) return { ok: true, json: async () => ({ nope: 1 }) };
      return { ok: true, json: async () => (o.snap || SNAP) };
    },
  };
  const m = source.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('頁に script が無い');
  /* ★ 頁の中で落ちた時に、**この門番ごと死なせない**(変異を一つ当てた時に実際に死んだ)。
     落ちた事は「落ちた」として持ち帰り、赤として数える。 */
  let crashed = '';
  const onRej = (e) => { crashed = String((e && e.message) || e); };
  process.on('unhandledRejection', onRej);
  process.on('uncaughtException', onRej);
  try {
    vm.runInNewContext(m[1], ctx, { timeout: 8000 });
    for (let i = 0; i < 300; i++) await new Promise((r) => setImmediate(r));
  } catch (e) { crashed = String((e && e.message) || e); }
  process.off('unhandledRejection', onRej);
  process.off('uncaughtException', onRej);
  return { html: dom.html(), asof: dom.nodes.asof.innerHTML, store, rpcHits, crashed };
}

/* 禁止語を見る前に、見てはいけない所を落とす(注意書きの段とコメント) */
function visible(source) {
  return source.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<div class="note" id="honestNote">[\s\S]*?<\/div>/, ' ');
}

async function check(source) {
  const bad = [];
  const vis = visible(source);
  const t = (n, ok, d) => { if (!ok) bad.push(n); process.stdout.write((ok ? '✅ ' : '❌ ') + n + (!ok && d !== undefined ? '  → ' + String(d).slice(0, 170) : '') + NL); };

  t('① 残高の数を焼き込んでいない', !/[0-9]{1,3}(,[0-9]{3})+/.test(source), (source.match(/[0-9]{1,3}(,[0-9]{3})+/) || [])[0]);
  t('③ 人の名前の印(さん・氏)が頁に無い', !/さん|[^電博士]氏(?![名])/.test(vis), (vis.match(/.{12}(さん|氏)/) || [])[0]);
  t('④ 値段・値動き・買う売るの語が無い',
    !/価格|値段|値上|値下|時価|儲|急騰|暴落|買い時|売り時|投資すべき|円相当|ドル相当/.test(vis),
    (vis.match(/価格|値段|値上|値下|時価|儲|急騰|暴落|買い時|売り時|投資すべき|円相当|ドル相当/) || [])[0]);
  t('④-2 「売った」「逃げた」と書いていない', !/売った|逃げた|裏切/.test(vis), (vis.match(/.{10}(売った|逃げた|裏切)/) || [])[0]);
  t('④-3 「何をしないか」の段が在る(これが落ちたら④の外しは効かない)',
    /id="honestNote"/.test(source) && /投資の助言ではありません/.test(source) && /値動きの見通し/.test(source));
  t('⑥ 出せていない物を「出せていない」と書いてある(二つとも)',
    (source.match(/まだ出せていません|まだ始まっていません/g) || []).length >= 2);
  t('⑥-2 出せていない所に、数を書いていない', !/[0-9]{1,3}(,[0-9]{3})+/.test(vis));
  t('⑦ 内輪の符丁が無い', !/☆3|☆未確定|作業名|ベータ版|β/.test(vis));

  /* ★★ ここが作り直しの芯: 頁がチェーンを直接 叩いていないか */
  t('⑧ 頁の中にチェーンの口の住所を書いていない',
    !/mainnet-beta|publicnode|drpc\.org|mainnet\.optimism\.io/.test(source),
    (source.match(/mainnet-beta|publicnode|drpc\.org|mainnet\.optimism\.io/) || [])[0]);
  t('⑧-2 写しの紙を読む形になっている', /data\/kansokujo\.json/.test(source));

  const declared = new Set();
  for (const m of source.matchAll(/addr: '([^']+)'/g)) declared.add(m[1].toLowerCase());
  const evm = [...source.matchAll(/0x[0-9a-fA-F]{40}/g)].map((x) => x[0].toLowerCase());
  const b58 = [...source.matchAll(/[1-9A-HJ-NP-Za-km-z]{32,44}/g)].map((x) => x[0]).filter((s) => /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s));
  t('⑤ 頁に出る住所が全部 名札の表に在る(EVM)', evm.every((a) => declared.has(a)), evm.find((a) => !declared.has(a)));
  t('⑤-2 頁に出る住所が全部 名札の表に在る(Solana)', b58.every((a) => declared.has(a.toLowerCase())), b58.find((a) => !declared.has(a.toLowerCase())));

  const entries = source.split(/\{ addr: /).slice(1);
  const marked = entries.filter((e) => /disclosed: true/.test(e.split(/\n\s*\{/)[0] || e));
  const sourced = marked.filter((e) => /src: '[^']*[0-9]{4}-[0-9]{2}-[0-9]{2}[^']*'/.test(e));
  t('⑤-3 「開示に書かれている」の印は、日付つきの出所が在る物だけ',
    marked.length > 0 && marked.length === sourced.length, '印 ' + marked.length + ' / 出所つき ' + sourced.length);

  /* ── 本当に動かして見る ── */
  const live = await run(source, {});
  t('② 写しの紙から数を出す', live.html.indexOf(SHOWN.toLocaleString('ja-JP')) >= 0, live.html.slice(0, 160));
  t('② チェーンを直接 叩かない(叩いたら赤)', live.rpcHits === 0, 'チェーンを ' + live.rpcHits + ' 回 叩いた');
  t('② 写しの時刻を出す', /読んだ時刻/.test(live.asof), live.asof);
  t('② 控えを残す', Object.keys(live.store).length > 0);

  const old = await run(source, { snap: Object.assign({}, SNAP, { asOf: new Date(Date.now() - 5 * 3600 * 1000).toISOString() }) });
  t('② 写しが三時間より古ければ、古いと言う', /古い/.test(old.asof), old.asof);
  t('② 古くても、数は出す(空にしない)', old.html.indexOf(SHOWN.toLocaleString('ja-JP')) >= 0);

  const dead = await run(source, { noSnapshot: true, storage: live.store });
  t('② 紙に届かない時は、控えを出して そう言う', /控え|残っていた/.test(dead.asof) && dead.html.indexOf(SHOWN.toLocaleString('ja-JP')) >= 0, dead.asof);

  const naked = await run(source, { noSnapshot: true });
  t('② 紙も控えも無い時は、数を一つも出さない', !/[0-9]{1,3}(,[0-9]{3})+/.test(naked.html), naked.html.slice(0, 140));
  t('② 紙も控えも無い時は、その事を言う', /届かず|控えもありません/.test(naked.asof), naked.asof);

  const broken = await run(source, { badSnapshot: true });
  t('② 形の違う紙を、読めたことにしない', !/[0-9]{1,3}(,[0-9]{3})+/.test(broken.html), broken.html.slice(0, 140));
  t('② 形の違う紙で、頁が落ちない(白い画面を出さない)', !broken.crashed, broken.crashed);
  /* ★ 形の違う紙を受けた時、時刻の行に意味の無い語を出さない。
     検分を外すと「読んだ時刻: undefined」と出る——数は出ないので害は小さいが、
     **読む人には「読めた」ように見える**。ここを測って初めて、検分の変異が赤になる。 */
  t('② 形の違う紙で、時刻の行に意味の無い語を出さない',
    !/undefined|NaN|Invalid/.test(broken.asof), broken.asof);
  const half = await run(source, { snap: { asOf: new Date().toISOString(), nyan: { supply: SUPPLY, wallets: {} } } });
  t('② 片側しか無い紙でも、頁が落ちない', !half.crashed, half.crashed);

  const nostore = await run(source, { noStorage: true });
  t('② 控えが使えない端末でも、数は出る', nostore.html.indexOf(SHOWN.toLocaleString('ja-JP')) >= 0);

  /* ── 本物の写しの紙 ── */
  let snap = null;
  try { snap = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) { /* 無い */ }
  t('⑨ 写しの紙が在る', !!snap, DATA);
  if (snap) {
    t('⑨-2 写しに NYAN の総数が数で在る', typeof snap.nyan.supply === 'number' && snap.nyan.supply > 0, snap.nyan && snap.nyan.supply);
    const disclosed = 'Abt54GpGwR4rnFzrSiCnKhLf1Hj1GJ9qCCfZAz7Jknyv';
    t('⑨-3 写しに受領ウォレットの枚数が数で在る(0 でもよい・null は駄目)',
      typeof (snap.nyan.wallets || {})[disclosed] === 'number', (snap.nyan.wallets || {})[disclosed]);
    t('⑨-4 写しに WWB の総数が数で在る', typeof snap.wwb.supply === 'number' && snap.wwb.supply > 0);
    t('⑨-5 写しに時刻が在る', !!snap.asOf && isFinite(Date.parse(snap.asOf)), snap.asOf);
  }
  return bad;
}

const MUTANTS = [
  ['写しでなくチェーンを直接 叩く形に戻す', (s) => s.replace("var SNAPSHOT_URL = './data/kansokujo.json';", "var SNAPSHOT_URL = 'https://api.mainnet-beta.solana.com';")],
  ['古い写しを「古い」と言わなくする', (s) => s.replace(/この写しは三時間より古いです。/g, '')],
  ['紙に届かない時に、控えの事を言わなくする', (s) => s.replace(/いま写しの紙に届かなかったので、この端末に残っていた分を出しています。/g, '')],
  ['残高を一つ焼き込む', (s) => s.replace('<div id="nyanCards"></div>', '<div id="nyanCards">1,300,000,100 NYAN</div>')],
  ['値段の語を一つ混ぜる', (s) => s.replace('名札のある財布の、いまの残高と動き。', '名札のある財布の、いまの価格と動き。')],
  ['表に無い住所を一つ混ぜる', (s) => s.replace('</body>', '<p>0x1111111111111111111111111111111111111111</p></body>')],
  ['出せていない物の段を消す', (s) => s.replace(/まだ出せていません/g, '0 件').replace(/まだ始まっていません/g, '0 件')],
  ['人の名前の印を混ぜる', (s) => s.replace('この頁は、チェーンの', 'この頁は、だれかさんの')],
  ['「何をしないか」の段を丸ごと消す', (s) => s.replace(/<div class="note" id="honestNote">[\s\S]*?<\/div>/, '')],
  ['開示の印を、出所なしで足す', (s) => s.replace("nm: '上の財布へ、送った側の財布',", "nm: '上の財布へ、送った側の財布', disclosed: true,")],
  /* ★ 守りが二枚になったので、一行だけ消しても振る舞いが変わらない(緑のまま=穴ではない)。
     §6⑤「変異が緑なら、まず『その変異が振る舞いを変えていない』を疑う」。
     だから**形の検分を丸ごと**外して、本当にその性質を測る。 */
  ['紙の形の検分を丸ごと外す', (s) => s
    .replace("if (!j || typeof j !== 'object' || !j.asOf) return { ok: false };", '')
    .replace("if (!j.nyan || typeof j.nyan !== 'object' || !j.wwb || typeof j.wwb !== 'object') return { ok: false };", '')],
];

(async () => {
  const source = fs.readFileSync(PAGE, 'utf8');
  if (!process.argv.includes('--mutants')) {
    const bad = await check(source);
    process.stdout.write(NL + (bad.length ? '★ 赤 ' + bad.length + ' 件: ' + bad.join(' / ') : '緑(見た項目は上の一覧の全部。本物のブラウザの道は、CI の別の段が見る)') + NL);
    process.exit(bad.length ? 1 : 0);
  }
  let holes = 0;
  for (const [name, f] of MUTANTS) {
    let bad = [];
    const real = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { bad = await check(f(source)); } catch (e) { bad = ['落ちた: ' + String(e.message).slice(0, 60)]; }
    process.stdout.write = real;
    if (!bad.length) holes++;
    process.stdout.write((bad.length ? '🔴 RED ' : '🟢 緑のまま(穴) ') + name + (bad.length ? '  (' + bad[0] + ')' : '') + NL);
  }
  process.stdout.write(NL + (MUTANTS.length - holes) + '/' + MUTANTS.length + ' の変異で赤を見た' + NL);
  process.exit(holes ? 1 : 0);
})();
