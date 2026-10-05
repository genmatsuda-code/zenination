#!/usr/bin/env node
/**
 * 善意観測所の写しを焼く(2026-10-05)
 *
 * ★ なぜ在るか(実測): 頁がブラウザから直接 Solana の公開 RPC を叩く作りにしていたが、
 *   **ブラウザからの呼び出しは三つとも断られる**(api.mainnet-beta 403 / publicnode 403 / drpc 400)。
 *   本番を 375 幅の頭なし Chrome で開くと、**NYAN の段が全部「読めませんでした」**だった。
 *   OP の方はブラウザからでも通る(実測で数字が出ていた)——つまり鎖ごとに違う。
 *   私の門番は偽のチェーンの上で緑だったので、**この道を一度も見ていなかった**。
 *   → サーバ(この段)が読んで**写しの紙**を置き、頁はその紙だけを読む。鍵は要らない。
 *
 * ★ 線: 読めなかった物は **null** にする(0 にしない)。頁は null を「読めなかった」と出す。
 *
 * 使い方: node tools/kansokujo-snapshot.js [--out data/kansokujo.json]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const NL = String.fromCharCode(10);
const NYAN_MINT = 'FpECzw6x8RG4VBXfnVg3UJd8pq9CCxJUSWCKb4gebq8B';
const WWB = '0x03cc5feF38896537c10Fcb30A53A1B12be101da6';
const SOL_EPS = ['https://api.mainnet-beta.solana.com', 'https://solana.drpc.org', 'https://solana-rpc.publicnode.com'];
const OP_EP = 'https://mainnet.optimism.io';

/* 頁と同じ並び。ここを直したら頁の表も直す(名札の文は頁が持つ・ここは住所だけ) */
const NYAN_WALLETS = [
  'Abt54GpGwR4rnFzrSiCnKhLf1Hj1GJ9qCCfZAz7Jknyv',
  'D6T8HzLGHU4K2mgpSsRZHbYXwZ7RUQFmF8aeNeRyeyjT',
  'AZN2KdS2TLy4g49XSaYF3rwnhDtQhsDNAsAMSGix2yhM',
  'EZsS49ApgjxcCbu7eufiFnfupSHJqP8JaRnXoYqUqjKB',
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
  'CgH6BbwFanjEaNrn3dBqRKXVhcDYDsKCvUEPw6eGCHWw',
];
const WWB_WALLETS = [
  '0x029972f6c9baf23ae0bf60bf666fd290257cd5e8',
  '0x152327f9fa1ccb7eced95a2973830dc9e2206ec2',
  '0x28b3e7dac5322c081b26b1436a04936b6393330d',
  '0x363bded187554f69102a6360d82a62ebebac444d',
  '0x92433de259e47c4c7b8fc1b08c9a70d22cb30a45',
  '0xeec825b330f579f958551bd0f4e40f07d3b38e31',
  '0x16e9020336088604b67a9e1af7f63508cec237da',
  '0xa90a6dd6af99767b29013414c5d1d7f3993f1bc5',
  '0x03cc5feF38896537c10Fcb30A53A1B12be101da6',
  '0x5db284D904f0e5F477433E6132e30fa939C72849',
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (a) => String(a).toLowerCase().replace(/^0x/, '').padStart(64, '0');
function from18(hex) {
  const v = BigInt(!hex || hex === '0x' ? '0x0' : hex);
  const b = BigInt('1000000000000000000');
  const f = (v % b).toString().padStart(18, '0').slice(0, 3).replace(/0+$/, '');
  return Number(v / b) + (f ? Number('0.' + f) : 0);
}

async function post(ep, body, tries) {
  for (let t = 0; t < (tries || 3); t++) {
    try {
      const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
      if (r.status === 200) { const j = await r.json(); if (!j.error) return j.result; }
    } catch (e) { /* もう一度 */ }
    await wait(1200);
  }
  return undefined;
}
async function sol(method, params) {
  for (const ep of SOL_EPS) {
    const r = await post(ep, { jsonrpc: '2.0', id: 1, method: method, params: params }, 1);
    if (r !== undefined) return r;
  }
  return undefined;
}

async function main() {
  const i = process.argv.indexOf('--out');
  const out = i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : path.join(__dirname, '..', 'data', 'kansokujo.json');
  const snap = { asOf: new Date().toISOString(), nyan: { wallets: {} }, wwb: { wallets: {} }, failed: [] };

  const sup = await sol('getTokenSupply', [NYAN_MINT]);
  snap.nyan.supply = sup ? Number(sup.value.uiAmountString) : null;
  if (snap.nyan.supply === null) snap.failed.push('NYAN の総数');
  for (const w of NYAN_WALLETS) {
    const r = await sol('getTokenAccountsByOwner', [w, { mint: NYAN_MINT }, { encoding: 'jsonParsed' }]);
    if (r === undefined) { snap.nyan.wallets[w] = null; snap.failed.push('NYAN ' + w.slice(0, 8)); }
    else {
      let total = 0;
      for (const acc of r.value) total += Number(acc.account.data.parsed.info.tokenAmount.uiAmountString || 0);
      snap.nyan.wallets[w] = total;
    }
    process.stdout.write('  NYAN ' + w.slice(0, 10) + '… ' + (snap.nyan.wallets[w] === null ? '読めない' : Math.round(snap.nyan.wallets[w]).toLocaleString()) + NL);
    await wait(700);
  }

  const ts = await post(OP_EP, { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: WWB, data: '0x18160ddd' }, 'latest'] });
  snap.wwb.supply = ts === undefined ? null : from18(ts);
  if (snap.wwb.supply === null) snap.failed.push('WWB の総数');
  for (const w of WWB_WALLETS) {
    const r = await post(OP_EP, { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: WWB, data: '0x70a08231' + pad(w) }, 'latest'] });
    snap.wwb.wallets[w.toLowerCase()] = r === undefined ? null : from18(r);
    if (r === undefined) snap.failed.push('WWB ' + w.slice(0, 8));
    process.stdout.write('  WWB ' + w.slice(0, 10) + '… ' + (r === undefined ? '読めない' : Math.round(from18(r)).toLocaleString()) + NL);
  }

  /* ★ 一つも読めなかった回は、**紙を書き替えない**(前の正しい写しを、空の写しで潰さない) */
  const got = Object.values(snap.nyan.wallets).filter((x) => x !== null).length
    + Object.values(snap.wwb.wallets).filter((x) => x !== null).length;
  if (!got) { process.stdout.write(NL + '★ 一つも読めませんでした。紙は書き替えません(前の写しを残します)' + NL); return 1; }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(snap, null, 1) + NL);
  process.stdout.write(NL + '書いた: ' + out + '(読めた ' + got + ' 件・読めなかった ' + snap.failed.length + ' 件)' + NL);
  return 0;
}

if (require.main === module) main().then((c) => { process.exitCode = c; });
module.exports = { from18 };
