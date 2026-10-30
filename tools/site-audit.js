// site-audit.js — 善意立国の頁の SEO・AIO・計測の点検(毎週・自動)。2026-10-30
//   目的: 頁ごとに、検索と AI に読まれるための決まり事と、計測の札が抜けていないかを機械で見て、前の週と比べる。
//   見る物(頁ごと): title / meta description(長さ)/ og:title・og:description・og:image / h1 の数 / html の lang / viewport /
//                    GA の札 / 構造化データ(要る頁だけ)/ alt の無い画像 / 頁の中の相対リンクの死に(HEAD)
//   見る物(場所ごと): sitemap.xml と llms.txt が在るか・sitemap の頁が全部 200 か
//   出す物: reports/audit/latest.json・reports/audit/<日付>.md(前の週より悪くなった所を先頭に)
//   使い方: node tools/site-audit.js [--base https://genmatsuda-code.github.io/zenination/] [--lh <lighthouse の json を集めた dir>]
//   鍵は使わない。読むのは公開の頁だけ。
"use strict";
const fs = require("fs"), path = require("path");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "https://genmatsuda-code.github.io/zenination/");
const LH = arg("--lh", null);
const OUT = path.join(__dirname, "..", "reports", "audit");
const GA = "G-V14PVPLDK9";
const NEED_LD = new Set(["oni.html", "index.html"]);
const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

async function get(url) {
  const r = await fetch(url, { headers: { "User-Agent": "zenination-site-audit" }, signal: AbortSignal.timeout(20000) });
  return { status: r.status, text: r.status === 200 ? await r.text() : "" };
}
const one = (s, re) => { const m = s.match(re); return m ? m[1].trim() : null; };
const meta = (s, attr, name) => one(s, new RegExp('<meta[^>]+' + attr + '="' + name + '"[^>]+content="([^"]*)"', "i")) || one(s, new RegExp('<meta[^>]+content="([^"]*)"[^>]+' + attr + '="' + name + '"', "i"));

async function checkPage(file) {
  const url = BASE + (file === "index.html" ? "" : file);
  const { status, text: s } = await get(url);
  const p = { file, url, status, issues: [] };
  if (status !== 200) { p.issues.push("開けない(" + status + ")"); return p; }
  const title = one(s, /<title>([^<]*)<\/title>/i);
  const desc = meta(s, "name", "description");
  if (!title) p.issues.push("title が無い"); else if (title.length > 60) p.issues.push("title が長い(" + title.length + " 字・検索の見出しで切れる)");
  if (!desc) p.issues.push("meta description が無い"); else if (desc.length < 50 || desc.length > 160) p.issues.push("meta description の長さ " + desc.length + " 字(50〜160 が目安)");
  for (const k of ["og:title", "og:description", "og:image"]) if (!meta(s, "property", k)) p.issues.push(k + " が無い(X や LINE で貼った時の顔)");
  const h1 = (s.match(/<h1[\s>]/gi) || []).length; if (h1 !== 1) p.issues.push("h1 が " + h1 + " 個(1 個が目安)");
  if (!/<html[^>]+lang="/i.test(s)) p.issues.push("html の lang が無い");
  if (!/<meta[^>]+name="viewport"/i.test(s)) p.issues.push("viewport が無い(スマホで崩れる)");
  if (!s.includes("googletagmanager.com/gtag/js?id=" + GA)) p.issues.push("GA の札が無い");
  if (NEED_LD.has(file) && !/application\/ld\+json/.test(s)) p.issues.push("構造化データが無い(AI と検索に、何の頁かを機械の言葉で渡す札)");
  const noAlt = (s.match(/<img(?![^>]*\balt=)[^>]*>/gi) || []).length; if (noAlt) p.issues.push("alt の無い画像 " + noAlt + " 枚");
  const links = [...new Set((s.match(/href="([^"#:]+\.html)(?:#[^"]*)?"/gi) || []).map((x) => x.replace(/^href="|"$/g, "").replace(/#.*$/, "")))].filter((h) => !/^https?:/i.test(h));
  for (const h of links) { const u = new URL(h, url).href; try { const r = await fetch(u, { method: "HEAD", signal: AbortSignal.timeout(15000) }); if (r.status !== 200) p.issues.push("死んだリンク " + h + "(" + r.status + ")"); } catch (_) { p.issues.push("死んだリンク " + h + "(届かない)"); } }
  p.title = title; p.descLen = desc ? desc.length : 0;
  return p;
}

function lhScores() {
  if (!LH || !fs.existsSync(LH)) return {};
  const out = {};
  for (const f of fs.readdirSync(LH).filter((x) => x.endsWith(".json"))) {
    try { const j = JSON.parse(fs.readFileSync(path.join(LH, f), "utf8")); const c = j.categories || {}; out[f.replace(/\.json$/, "")] = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round((v.score || 0) * 100)])); } catch (_) {}
  }
  return out;
}

(async () => {
  const sm = await get(BASE + "sitemap.xml"), llms = await get(BASE + "llms.txt");
  const site = { sitemap: sm.status, llms: llms.status, issues: [] };
  if (sm.status !== 200) site.issues.push("sitemap.xml が開けない(" + sm.status + ")");
  if (llms.status !== 200) site.issues.push("llms.txt が開けない(" + llms.status + ")");
  const files = (sm.text.match(/<loc>([^<]+)<\/loc>/g) || []).map((x) => x.replace(/<\/?loc>/g, "").replace(BASE, "") || "index.html");
  const pages = []; for (const f of files) pages.push(await checkPage(f));
  const lh = lhScores();
  const prevFile = path.join(OUT, "latest.json");
  const prev = fs.existsSync(prevFile) ? JSON.parse(fs.readFileSync(prevFile, "utf8")) : null;
  const worse = [];
  if (prev) {
    const pi = Object.fromEntries((prev.pages || []).map((p) => [p.file, new Set(p.issues)]));
    for (const p of pages) for (const i of p.issues) if (pi[p.file] && !pi[p.file].has(i)) worse.push(p.file + ": " + i);
    for (const [pg, sc] of Object.entries(lh)) for (const [k, v] of Object.entries(sc)) { const b = prev.lighthouse && prev.lighthouse[pg] && prev.lighthouse[pg][k]; if (b != null && v < b - 5) worse.push(pg + " の " + k + " " + b + "→" + v); }
  }
  const total = pages.reduce((n, p) => n + p.issues.length, 0) + site.issues.length;
  const res = { day, base: BASE, site, pages, lighthouse: lh, total, worse };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(prevFile, JSON.stringify(res, null, 2));
  const NL = "\n"; const L = [];
  L.push("# 善意立国の頁の点検 " + day, "", "見た頁 " + pages.length + "・見つけた所 " + total + "・前の週より悪くなった所 " + worse.length, "");
  if (worse.length) { L.push("## 前の週より悪くなった所", ""); worse.forEach((w) => L.push("- " + w)); L.push(""); }
  if (Object.keys(lh).length) { L.push("## Lighthouse(スマホ幅)", "", "| 頁 | 速さ | 使いやすさ | 作法 | SEO |", "|---|---|---|---|---|"); for (const [pg, sc] of Object.entries(lh)) L.push("| " + pg + " | " + (sc.performance ?? "-") + " | " + (sc.accessibility ?? "-") + " | " + (sc["best-practices"] ?? "-") + " | " + (sc.seo ?? "-") + " |"); L.push(""); }
  L.push("## 場所", "", "- sitemap.xml " + site.sitemap + "・llms.txt " + site.llms); site.issues.forEach((i) => L.push("- " + i)); L.push("");
  L.push("## 頁ごと", ""); for (const p of pages) { if (!p.issues.length) continue; L.push("### " + p.file); p.issues.forEach((i) => L.push("- " + i)); L.push(""); }
  const clean = pages.filter((p) => !p.issues.length).map((p) => p.file); if (clean.length) L.push("抜けの無い頁: " + clean.join("・"), "");
  fs.writeFileSync(path.join(OUT, day + ".md"), L.join(NL));
  console.log("点検 " + day + ": 頁 " + pages.length + "・見つけた所 " + total + "・悪くなった所 " + worse.length);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, "worse=" + worse.length + NL + "total=" + total + NL + "day=" + day + NL);
})().catch((e) => { console.log("✗ " + e.message); process.exit(1); });
