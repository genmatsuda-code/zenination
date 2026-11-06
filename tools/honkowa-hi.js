#!/usr/bin/env node
'use strict';
/**
 * 本怖のサイトの数の紙 data/honkowa-hi.json を、OP の鎖から書く(2026-11-06)。読むのは公開の口だけ・鍵なし。
 * 数の正=燃やす口(BurnRouterV2)の VoluntaryBurn / Burned のうち、理由 honkowa.post の物。人の数は書かない。
 * 形は honkowa.html が読む {unit, mult, reasonHash, from, fires:[{day,amount,tx}]}。day は燃えた日(JST)・一日一行・tx はその日の最後の一本。
 * 一つでも読めなければ紙を書き替えない。次の回は lastBlock の続きから。
 *
 *   node tools/honkowa-hi.js --self-test
 *   node tools/honkowa-hi.js [--file data/honkowa-hi.json]
 */
const fs = require('fs');
const path = require('path');

const RPC = process.env.OP_RPC_URL || 'https://mainnet.optimism.io';
const ROUTER = '0x152327f9fa1ccb7eced95a2973830dc9e2206ec2';
const REASON = '0x000e99555034b0e8cd1d7a9669d6c400672bfc464ff0eccc64d69173f77210a1';   // keccak256("honkowa.post")
const THANKS = '0x17349140922dc5aef670150edaec07bc1beb3a63eebfbbb7719dbceb4fe664c8';   // keccak256("thanksmap.thanks")
const T_VOLUNTARY = '0x36fc147909e2d39d2869658e709abb98a16dded50082d2b4980de891b6a5405b';
const T_BURNED = '0xdbc2fc2d062a47c7856889e04b4f0b4f58867d3c24b759551ad5681669fc9ffa';
const SEL = { windowBudget: '0xcd3bd815', baselineDemand: '0xa8831751', weightOf: '0x4c108d6d' };
const MULT = 2;              // ⚖️2026-11-01 15:3x 重み 2
const KEY = '0xba36505bd59bc8676bda84f84ce8c8dff7d61f36';               // 燃やす鍵の住所(小文字)。recordVoluntaryBurn は誰でも呼べるので、この鍵の物だけ数える。空の間は一本も数えない
const KEEP_BLOCKS = 300000;   // 見える物が変わらなくても、これだけ進んだら lastBlock を残す(約一週間)
const FIRST_BLOCK = 159170000;   // 燃やし始めより前(2026-11-06)
const STEP = 9000;           // 公開の口の eth_getLogs は 10,000 ブロックまで

const WEI = 10n ** 18n;
const toWWB = (wei) => Number(wei / 10n ** 12n) / 1e6;    // 小数 6 桁まで
const jstDay = (sec) => new Date((Number(sec) + 9 * 3600) * 1000).toISOString().slice(0, 10);

/** 純粋な判断: 新しいログを紙に足す。logs は {topics,data,transactionHash,blockNumber(10 進)}、ts はブロック→秒。 */
function applyLogs(prev, logs, ts, { unit, head, key = KEY }) {
  const fires = new Map((prev.fires || []).map((f) => [f.day, { ...f }]));
  let from = prev.from || '';
  const sorted = logs.slice().sort((a, b) => a.blockNumber - b.blockNumber);
  for (const l of sorted) {
    if (l.topics[1] !== REASON) continue;
    let amount;
    if (l.topics[0] === T_VOLUNTARY) { if (!key || '0x' + l.topics[2].slice(26) !== key) continue; amount = BigInt('0x' + l.data.slice(2, 66)); from = key; }
    else if (l.topics[0] === T_BURNED) { amount = BigInt('0x' + l.data.slice(2 + 64 * 2, 2 + 64 * 3)); from = from || ROUTER; }
    else continue;
    const day = jstDay(ts[l.blockNumber]);
    const cell = fires.get(day) || { day, amount: 0, tx: '' };
    cell.amount = Math.round((cell.amount + toWWB(amount)) * 1e6) / 1e6;
    cell.tx = l.transactionHash;
    fires.set(day, cell);
  }
  return {
    day: prev.day, unit, mult: MULT, reasonHash: REASON, from,
    fires: [...fires.values()].sort((a, b) => (a.day < b.day ? -1 : 1)),
    lastBlock: head,
    note: 'unit=THANKS Map の感謝一件で燃える量(ブロックチェーンから読む)。mult=本怖は 2 倍。fires は燃えた日ごとに一行(day,amount,tx)。会員の人数は書かない。',
  };
}

/** 見える物(単位・倍率・住所・火)が変わった時だけ書く=毎日 同じ紙で commit しない。lastBlock だけの差では書かない。 */
function changed(prev, next) {
  if (Number.isInteger(next.lastBlock) && next.lastBlock - (prev.lastBlock || 0) > KEEP_BLOCKS) return true;
  const face = (j) => JSON.stringify({ unit: j.unit, mult: j.mult, reasonHash: j.reasonHash, from: j.from, fires: j.fires });
  return face(prev) !== face(next);
}

async function rpc(method, params) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) { if (i === 4) throw e; await new Promise((x) => setTimeout(x, 800 * (i + 1))); }
  }
}
const call = (data) => rpc('eth_call', [{ to: ROUTER, data }, 'latest']);

async function main() {
  const file = process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : path.join(__dirname, '..', 'data', 'honkowa-hi.json');
  const prev = JSON.parse(fs.readFileSync(file, 'utf8'));
  const head = parseInt(await rpc('eth_blockNumber', []), 16);
  if (!Number.isInteger(head) || head <= 0) throw new Error('ブロックの番号が読めない');
  const start = (Number.isInteger(prev.lastBlock) ? prev.lastBlock : FIRST_BLOCK - 1) + 1;
  const logs = [];
  for (let f = start; f <= head; f += STEP) {
    const to = Math.min(head, f + STEP - 1);
    const got = await rpc('eth_getLogs', [{ address: ROUTER, topics: [[T_VOLUNTARY, T_BURNED], REASON], fromBlock: '0x' + f.toString(16), toBlock: '0x' + to.toString(16) }]);
    for (const l of got) logs.push({ topics: l.topics, data: l.data, transactionHash: l.transactionHash, blockNumber: parseInt(l.blockNumber, 16) });
  }
  const ts = {};
  for (const b of new Set(logs.map((l) => l.blockNumber))) ts[b] = parseInt((await rpc('eth_getBlockByNumber', ['0x' + b.toString(16), false])).timestamp, 16);
  const B = BigInt(await call(SEL.windowBudget + '0'.repeat(64)));
  const base = BigInt(await call(SEL.baselineDemand));
  const w = BigInt(await call(SEL.weightOf + THANKS.slice(2)));
  // 一件×2 の表示が実際と合うよう 0.5 刻み(1,609.26 → unit 804.5 → 1,609)。細かく動いても毎回は書かない
  const unit = Math.round((Number((B * w) / base / 10n ** 12n) / 1e6) * 2) / 2;
  if (!(unit > 0)) throw new Error('一件の火が読めない');
  const next = applyLogs(prev, logs, ts, { unit, head });
  console.log('見たブロック ' + start + '〜' + head + '・本怖の火 ' + logs.length + ' 本・一件 ' + unit + ' WWB');
  if (!changed(prev, next)) { console.log('見える物に変わりなし=書かない'); return; }
  next.day = jstDay(Math.floor(Date.now() / 1000));
  fs.writeFileSync(file, JSON.stringify(next) + '\n');
  console.log('書いた ' + file);
}

function selfTest() {
  const pad = (n) => BigInt(n).toString(16).padStart(64, '0');
  const w = (n) => BigInt(n) * WEI;
  const FROM = '0x' + '00'.repeat(12) + 'ab'.repeat(20);
  const vol = (amt, b, tx) => ({ topics: [T_VOLUNTARY, REASON, FROM], data: '0x' + pad(w(amt)), blockNumber: b, transactionHash: tx });
  const brn = (amt, b, tx) => ({ topics: [T_BURNED, REASON], data: '0x' + pad(1) + pad(2) + pad(w(amt)) + pad(0) + pad(w(9)), blockNumber: b, transactionHash: tx });
  const other = { topics: [T_VOLUNTARY, THANKS, FROM], data: '0x' + pad(w(7)), blockNumber: 1, transactionHash: '0xo' };
  const day1 = Date.parse('2026-11-24T14:00:00Z') / 1000, day2 = Date.parse('2026-11-24T16:00:00Z') / 1000;   // JST 23 時と翌 1 時
  const ts = { 1: day1, 2: day1 + 60, 3: day2 };
  const base = { day: '2026-11-01', unit: 804, mult: 2, reasonHash: REASON, from: '', fires: [] };
  const K = '0x' + 'ab'.repeat(20);
  const a = applyLogs(base, [vol(1609, 1, '0xa'), vol(1, 2, '0xb'), brn(100, 3, '0xc'), other], ts, { unit: 846, head: 9, key: K });
  const stranger = applyLogs(base, [{ ...vol(5, 1, '0xs'), topics: [T_VOLUNTARY, REASON, '0x' + '00'.repeat(12) + 'cd'.repeat(20)] }], ts, { unit: 846, head: 9, key: K });
  const nokey = applyLogs(base, [vol(5, 1, '0xs')], ts, { unit: 846, head: 9, key: '' });
  const fresh = applyLogs(a, [], {}, { unit: 846, head: 10, key: K });
  const moved = applyLogs(a, [], {}, { unit: 900, head: 10, key: K });
  const cont = applyLogs(a, [vol(5, 3, '0xd')], ts, { unit: 846, head: 11, key: K });
  const big = applyLogs(base, [vol(1000000, 1, '0xe')], ts, { unit: 846, head: 11, key: K });
  const cases = [
    ['同じ日は一行に足す・tx は最後の一本', a.fires[0].day === '2026-11-24' && a.fires[0].amount === 1610 && a.fires[0].tx === '0xb'],
    ['日は JST で切る', a.fires[1].day === '2026-11-25'],
    ['他の理由は足さない', a.fires.reduce((s, f) => s + f.amount, 0) === 1710],
    ['Burned は 3 つ目の語が量', a.fires[1].amount === 100],
    ['住所は燃やした人', a.from === '0x' + 'ab'.repeat(20)],
    ['新しい日が後', a.fires[0].day < a.fires[1].day],
    ['続きの回は前の火に足す', cont.fires[1].amount === 105 && cont.fires[1].tx === '0xd'],
    ['大きな量も桁が落ちない', big.fires[0].amount === 1000000],
    ['見える物が同じなら書かない', !changed(a, fresh)],
    ['鍵でない人の燃やしは数えない', stranger.fires.length === 0 && stranger.from === ''],
    ['鍵が決まるまで一本も数えない', nokey.fires.length === 0],
    ['止まっていても一週間で番号を残す', changed({ ...a, lastBlock: 1 }, { ...a, lastBlock: 300002 })],
    ['一件の火が変われば書く', changed(a, moved)],
    ['火が増えれば書く', changed(a, cont)],
    ['会員の数の欄が無い', !/members|people|人数":/.test(JSON.stringify(a))],
    ['倍率は決めの 2', a.mult === 2],
  ];
  let bad = 0;
  for (const [n, ok] of cases) { if (!ok) { bad++; console.log('赤 ' + n); } }
  console.log((bad ? '赤 ' : '緑 ') + (cases.length - bad) + '/' + cases.length);
  process.exit(bad ? 1 : 0);
}

if (process.argv.includes('--self-test')) selfTest();
else main().catch((e) => { console.error('読めなかった(紙は書き替えない): ' + e.message); process.exit(1); });
