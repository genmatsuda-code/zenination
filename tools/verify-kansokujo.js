#!/usr/bin/env node
/**
 * 善意観測所の門番(2026-10-05 新設)
 *
 * この頁は**お金の動きを人に見せる**頁なので、間違いの害が大きい。だから機械で見張る:
 *   ① 数を焼き込んでいないか(残高はその場でチェーンから読んだ物か)
 *   ② 読めなかった日に「最後に読めた時刻」を出すか(古い数を新しいと見せない)
 *   ③ 人の名前が頁に出ないか(名誉毀損の線・名札は事実だけ)
 *   ④ 値段・値動き・買う売るの語が無いか(憲法1)
 *   ⑤ 頁に出る住所が、全部 名札の表に載っている物か(拾った住所を黙って出さない)
 *   ⑥ 出せていない物を「出せていない」と書いてあるか(0 件とも書かない)
 *   ⑦ 内輪の符丁が無いか
 *
 * ★ 本物のブラウザは使わない。頁の script をそのまま**実際に動かして**、
 *   出来上がった HTML を見る(「その行が在る」ではなく「その振る舞いが成り立つ」を測る)。
 * ★ 変異は、読み込んだ**写しの文字列**だけを壊す。追跡下のファイルには一指も触れない。
 *
 * 使い方: node tools/verify-kansokujo.js [--mutants]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const NL = String.fromCharCode(10);
const PAGE = path.join(__dirname, '..', 'kansokujo.html');

/* ── 試料。チェーンがこう返したことにする(本物の形に合わせてある) ── */
const SUPPLY_NYAN = '49331401970.134';
const BAL_SHOWN = 2599777777;          // この数が頁に出たら「読んだ数を出している」
const FIXTURES = {
  getTokenSupply: { value: { uiAmountString: SUPPLY_NYAN, decimals: 6 } },
  getTokenAccountsByOwner: {
    value: [{
      pubkey: '3BRB7DnnSiRzj98FW7kb7bMhDZ27o15jto7vRWAhT6qq',
      account: { data: { parsed: { info: { tokenAmount: { uiAmountString: String(BAL_SHOWN) } } } } },
    }],
  },
  getSignaturesForAddress: [{ signature: 'SIGaaaaaaaaaaaaaaaaaa', blockTime: 1780000000 }],
  getTransaction: {
    meta: {
      preTokenBalances: [
        { owner: 'Abt54GpGwR4rnFzrSiCnKhLf1Hj1GJ9qCCfZAz7Jknyv', uiTokenAmount: { uiAmountString: String(BAL_SHOWN) } },
        { owner: 'EZsS49ApgjxcCbu7eufiFnfupSHJqP8JaRnXoYqUqjKB', uiTokenAmount: { uiAmountString: '0' } },
      ],
      postTokenBalances: [
        { owner: 'Abt54GpGwR4rnFzrSiCnKhLf1Hj1GJ9qCCfZAz7Jknyv', uiTokenAmount: { uiAmountString: '0' } },
        { owner: 'EZsS49ApgjxcCbu7eufiFnfupSHJqP8JaRnXoYqUqjKB', uiTokenAmount: { uiAmountString: String(BAL_SHOWN) } },
      ],
    },
  },
};
/* OP の eth_call は 32 バイトの 16 進。1 WWB(18 桁)を返す */
const OP_HEX = '0x' + BigInt('1000000000000000000').toString(16).padStart(64, '0');

/** 最小の DOM。頁が触る物だけ持つ */
function makeDom() {
  const nodes = {};
  const mk = (id) => (nodes[id] = { id, innerHTML: '', _text: '',
    set textContent(v) { this._text = String(v); this.innerHTML = String(v); },
    get textContent() { return this._text; },
    addEventListener() {} });
  ['asof', 'reload', 'nyanSupply', 'nyanCards', 'wwbSupply', 'wwbCards'].forEach(mk);
  return {
    nodes,
    document: { getElementById: (id) => nodes[id] || mk(id) },
    html: () => Object.keys(nodes).map((k) => nodes[k].innerHTML).join(NL),
  };
}

/** 頁の script を、偽のチェーンの上で本当に動かす */
async function run(source, opt) {
  const o = opt || {};
  const dom = makeDom();
  const store = Object.assign({}, o.storage || {});
  const ctx = {
    document: dom.document,
    localStorage: {
      getItem: (k) => (o.noStorage ? (function () { throw new Error('使えない端末'); })() : (k in store ? store[k] : null)),
      setItem: (k, v) => { if (o.noStorage) throw new Error('使えない端末'); store[k] = v; },
    },
    BigInt, Number, String, Object, Date, JSON, Math, Array, Error, isNaN,
    console: { log() {}, error() {} },
    setTimeout, clearTimeout,
    fetch: async function (url, init) {
      if (o.dead) throw new Error('チェーンへ届かない');
      const body = JSON.parse(init.body);
      if (body.method === 'eth_call') return { ok: true, json: async () => ({ result: OP_HEX }) };
      const r = FIXTURES[body.method];
      if (r === undefined) return { ok: false, json: async () => ({ error: 'unknown' }) };
      return { ok: true, json: async () => ({ result: r }) };
    },
  };
  const m = source.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('頁に script が無い');
  vm.runInNewContext(m[1], ctx, { timeout: 8000 });
  for (let i = 0; i < 400; i++) await new Promise((r) => setImmediate(r));   // 読み終わるのを待つ
  return { dom, store, html: dom.html(), asof: dom.nodes.asof.innerHTML };
}

/**
 * 禁止語を見る前に、**見てはいけない所**を落とす。
 *   ・HTML のコメント … 「値段は書かない」と書いてある所。ここを数えると、
 *     正しい注意書きのせいで永久に赤くなり、人が門番を無視し始める。
 *   ・#honestNote … 「何をしないか」を読む人に伝える段。ここでだけ、その語を使ってよい。
 * ★ 外して良い理由は、**その段が在ることを別に確かめているから**(落ちていれば赤)。
 */
function visible(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<div class="note" id="honestNote">[\s\S]*?<\/div>/, ' ');
}

async function check(source) {
  const bad = [];
  const vis = visible(source);
  const t = (name, ok, detail) => {
    if (!ok) bad.push(name);
    process.stdout.write((ok ? '✅ ' : '❌ ') + name + (!ok && detail !== undefined ? '  → ' + String(detail).slice(0, 160) : '') + NL);
  };

  // ── 頁の文字列そのものを見る ──
  t('① 残高の数を焼き込んでいない(三桁区切りの数が頁に無い)',
    !/[0-9]{1,3}(,[0-9]{3})+/.test(source),
    (source.match(/[0-9]{1,3}(,[0-9]{3})+/) || [])[0]);
  t('③ 人の名前の印(さん・氏)が頁に無い',
    !/さん|[^電博士]氏(?![名])/.test(vis),
    (vis.match(/.{12}(さん|氏)/) || [])[0]);
  t('④ 値段・値動き・買う売るの語が無い',
    !/価格|値段|値上|値下|時価|儲|急騰|暴落|買い時|売り時|投資すべき|円相当|ドル相当/.test(vis),
    (vis.match(/価格|値段|値上|値下|時価|儲|急騰|暴落|買い時|売り時|投資すべき|円相当|ドル相当/) || [])[0]);
  t('④-2 「売った」「逃げた」と書いていない',
    !/売った|逃げた|裏切/.test(vis),
    (vis.match(/.{10}(売った|逃げた|裏切)/) || [])[0]);
  /* ★ 外して見る所が在る門番は、**その所が在ること**も測らなければ嘘になる */
  t('④-3 「何をしないか」の段が在る(これが落ちたら④の外しは効かない)',
    /id="honestNote"/.test(source) && /投資の助言ではありません/.test(source) && /値動きの見通し/.test(source));
  t('⑥ 出せていない物を「出せていない」と書いてある(二つとも)',
    (source.match(/まだ出せていません|まだ始まっていません/g) || []).length >= 2,
    (source.match(/まだ出せていません|まだ始まっていません/g) || []).length);
  t('⑥-2 出せていない所に、数を書いていない',
    !/[0-9]{1,3}(,[0-9]{3})+/.test(vis));
  t('⑦ 内輪の符丁が無い', !/☆3|☆未確定|作業名|ベータ版|β/.test(vis));

  // ⑤ 頁に出る住所が、全部 名札の表に載っているか
  const declared = new Set();
  for (const m of source.matchAll(/addr: '([^']+)'/g)) declared.add(m[1].toLowerCase());
  for (const m of source.matchAll(/^var (?:NYAN_MINT|WWB) = '([^']+)'/gm)) declared.add(m[1].toLowerCase());
  const evm = [...source.matchAll(/0x[0-9a-fA-F]{40}/g)].map((x) => x[0].toLowerCase());
  const b58 = [...source.matchAll(/[1-9A-HJ-NP-Za-km-z]{32,44}/g)].map((x) => x[0]).filter((s) => /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s));
  const strayEvm = evm.filter((a) => !declared.has(a));
  const strayB58 = b58.filter((a) => !declared.has(a.toLowerCase()));
  /* ★ いちばん危ない嘘=「開示に書かれている」を、書かれていない住所に付けること。
     印を付けるには出所(src・日付つき)が要る。印の数と出所の数を突き合わせる。 */
  const entries = source.split(/\{ addr: /).slice(1);
  const marked = entries.filter((e) => /disclosed: true/.test(e.split(/\n\s*\{/)[0] || e));
  const sourced = marked.filter((e) => /src: '[^']*[0-9]{4}-[0-9]{2}-[0-9]{2}[^']*'/.test(e));
  t('⑤-3 「開示に書かれている」の印は、日付つきの出所が在る物だけ',
    marked.length > 0 && marked.length === sourced.length,
    '印 ' + marked.length + ' 件 / 出所つき ' + sourced.length + ' 件');
  t('⑤-4 その出所が、読む人にも見える', /出所: '/.test(source) || /出所: ' \+/.test(source) || /'出所: '/.test(source));
  t('⑤ 頁に出る住所が全部 名札の表に在る(EVM)', strayEvm.length === 0, strayEvm[0]);
  t('⑤-2 頁に出る住所が全部 名札の表に在る(Solana)', strayB58.length === 0, strayB58[0]);

  // ── 本当に動かして振る舞いを見る ──
  const live = await run(source, {});
  t('② 読めた時は、読んだ数を出す', live.html.indexOf(BAL_SHOWN.toLocaleString('ja-JP')) >= 0, live.html.slice(0, 160));
  t('② 読めた時は「チェーンから読んだ時刻」を出す', /読んだ時刻/.test(live.asof), live.asof);
  t('② 控えを残す', Object.keys(live.store).length > 0);

  /* ★ 控えが一時間 以内だと、頁は**読みに行かない**(それが正しい振る舞い)。
     「読めなかった日」を測るには、控えを一時間より古くしてから当てる
     ——ここを古くせずに測っていて、最初は頁のせいだと読み違えた(2026-10-05)。 */
  const aged = {};
  for (const k of Object.keys(live.store)) {
    const s = JSON.parse(live.store[k]);
    s.at = Date.now() - 3 * 3600 * 1000;
    aged[k] = JSON.stringify(s);
  }
  const dead = await run(source, { dead: true, storage: aged });
  t('② 読めない時は「最後に読めた」と言う', /最後に読めた/.test(dead.asof), dead.asof);
  t('② 読めない時も、控えの数は出す(空にしない)', dead.html.indexOf(BAL_SHOWN.toLocaleString('ja-JP')) >= 0);

  const naked = await run(source, { dead: true });
  t('② 読めず控えも無い時は、数を一つも出さない', !/[0-9]{1,3}(,[0-9]{3})+/.test(naked.html), naked.html.slice(0, 140));
  t('② 読めず控えも無い時は、その事を言う', /読めず|控えもありません/.test(naked.asof), naked.asof);

  const nostore = await run(source, { noStorage: true });
  t('② 控えが使えない端末でも頁は出る', nostore.html.indexOf(BAL_SHOWN.toLocaleString('ja-JP')) >= 0);

  return bad;
}

/* ── 変異。守りを外したら赤くなることを見る(写しだけを壊す) ── */
const MUTANTS = [
  ['最後に読めた、を言わなくする', (s) => s.replace(/最後に読めた /g, '')],
  ['残高を一つ焼き込む', (s) => s.replace('<div id="nyanCards"></div>', '<div id="nyanCards">2,599,777,777 NYAN</div>')],
  ['値段の語を一つ混ぜる', (s) => s.replace('名札のある財布の、いまの残高と動き。', '名札のある財布の、いまの価格と動き。')],
  ['表に無い住所を一つ混ぜる', (s) => s.replace('</body>', '<p>0x1111111111111111111111111111111111111111</p></body>')],
  ['出せていない物の段を消す', (s) => s.replace(/まだ出せていません/g, '0 件')],
  ['人の名前の印を混ぜる', (s) => s.replace('この頁は、チェーンの', 'この頁は、だれかさんの')],
  ['読んだ数でなく控えだけを見る', (s) => s.replace('if (got) { saveCache(snap); draw(snap, true); return; }', 'if (got) { return; }')],
  /* ★ 外して見る所を消したら赤になるか=「外し」が抜け道にならないことの証明 */
  ['「何をしないか」の段を丸ごと消す', (s) => s.replace(/<div class="note" id="honestNote">[\s\S]*?<\/div>/, '')],
  ['開示に書かれている印を、根拠なく全部に付ける', (s) => s.replace(/disclosed: true,/, 'disclosed: true,').replace(/nm: '上の財布へ、送った側の財布',/, "nm: '上の財布へ、送った側の財布', disclosed: true,")],
];

(async () => {
  const source = fs.readFileSync(PAGE, 'utf8');
  if (!process.argv.includes('--mutants')) {
    const bad = await check(source);
    process.stdout.write(NL + (bad.length ? '★ 赤 ' + bad.length + ' 件: ' + bad.join(' / ') : '緑(見た項目は上の一覧の全部)') + NL);
    process.exit(bad.length ? 1 : 0);
  }
  let holes = 0;
  for (const [name, f] of MUTANTS) {
    let bad = [];
    const mute = { write() {} };
    const real = process.stdout.write.bind(process.stdout);
    process.stdout.write = mute.write;
    try { bad = await check(f(source)); } catch (e) { bad = ['落ちた: ' + String(e.message).slice(0, 60)]; }
    process.stdout.write = real;
    const red = bad.length > 0;
    if (!red) holes++;
    process.stdout.write((red ? '🔴 RED ' : '🟢 緑のまま(穴) ') + name + (red ? '  (' + bad[0] + ')' : '') + NL);
  }
  process.stdout.write(NL + (MUTANTS.length - holes) + '/' + MUTANTS.length + ' の変異で赤を見た' + NL);
  process.exit(holes ? 1 : 0);
})();
