// oni-fonts.js — LP(oni.html)の書体を、頁で使う字だけに切り出して自前で置く(2026-10-31・NOTE席)
//   ⚖️2026-10-31「LPの速さ56、直しておいて」。速さ 56 の元=Google Fonts の CSS(115KB・描画を止める)と、日本語の書体の切れ端 百個近く。
//   やる事: 頁の字(本文・script・CSS の content)を集め、Google Fonts の text= 指定で「その字だけの woff2」を一つずつ取り、
//           assets/fonts/oni/ に置いて、assets/fonts/oni/fonts.css に @font-face を書き、頁の <!-- fonts:begin -->〜<!-- fonts:end --> に「描いた後に読む」一行を置く。見た目の書体は変えない。
//   ★頁の字を足したら、これを回し直す(回さないと、足した字だけ手元の書体で出る=崩れはしない)。
//   使い方: node tools/oni-fonts.js [oni.html ...]   … 既定は oni.html と kokumin.html(11/1 に中身を差し替える先)を合わせた字
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const PAGES = process.argv.slice(2).length ? process.argv.slice(2) : ["oni.html", "kokumin.html"];
const OUT = path.join(ROOT, "assets", "fonts", "oni");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const FACES = [
  ["Zen Kaku Gothic New", "zkg", [400, 700, 900]],
  ["Dela Gothic One", "dela", [400]],
  ["JetBrains Mono", "jbm", [300, 500, 800]],
];

const chars = new Set();
for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));   // 英数と記号は全部(数え上げの数字・後で足す英字)
for (const c of "、。・「」『』（）【】ー〜…−×÷＋＝￥¥％円月日年") chars.add(c);
for (const p of PAGES) {
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, "utf8").replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
  for (const c of s.replace(/\s+/g, "")) if (c.codePointAt(0) >= 0x20) chars.add(c);
}
const text = [...chars].sort().join("");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const old of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, old));
  const css = [];
  let total = 0;
  for (const [family, slug, weights] of FACES) {
    for (const w of weights) {
      const url = "https://fonts.googleapis.com/css2?family=" + family.replace(/ /g, "+") + ":wght@" + w + "&display=swap&text=" + encodeURIComponent(text);
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.status !== 200) throw new Error(family + " " + w + " の CSS が取れない(" + r.status + ")");
      const src = (await r.text()).match(/url\((https:[^)]+)\)\s*format\('woff2'\)/);
      if (!src) throw new Error(family + " " + w + " の woff2 が無い");
      const buf = Buffer.from(await (await fetch(src[1], { headers: { "User-Agent": UA } })).arrayBuffer());
      const name = slug + "-" + w + ".woff2";
      fs.writeFileSync(path.join(OUT, name), buf);
      total += buf.length;
      css.push('@font-face{font-family:"' + family + '";font-style:normal;font-weight:' + w + ';font-display:swap;src:url(' + name + ') format("woff2")}');
      console.log(name + " " + Math.round(buf.length / 1024) + "KB");
    }
  }
  // ★書体は「最初の一枚を描いた後」に読み始める(2026-10-31 15:2x)。<style> の中に @font-face を置くと、最初の描画の前に 370KB を取りに行き、
  //   合図=最初の中身が描けた知らせ(paint の first-contentful-paint)。rAF 二つでは中身の前の空の一枚で回る回があった(手元 82)。描画の止まった画面(裏の窓)用に 3 秒後の予備(1.5 秒では遅い端末で最初の描画より先に走った)。Lighthouse の FCP 3.2 秒・LCP 5.8 秒の主因だった(書体を外すと 87)。描いた後に読むと、出来上がりの書体は同じで、手元の書体から一瞬で替わる。
  fs.writeFileSync(path.join(OUT, "fonts.css"), css.join("\n") + "\n");
  const block = '<!-- fonts:begin(tools/oni-fonts.js が書く・手で直さない) -->\n<script>(function(){var d=0;function f(){if(d)return;d=1;var l=document.createElement("link");l.rel="stylesheet";l.href="assets/fonts/oni/fonts.css";document.head.appendChild(l)}try{new PerformanceObserver(function(l){if(l.getEntriesByName("first-contentful-paint").length)setTimeout(f,0)}).observe({type:"paint",buffered:true})}catch(e){addEventListener("DOMContentLoaded",function(){requestAnimationFrame(function(){requestAnimationFrame(f)})})}setTimeout(f,3000)})()</script><noscript><link rel="stylesheet" href="assets/fonts/oni/fonts.css"></noscript>\n<!-- fonts:end -->';
  for (const p of PAGES) {
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) continue;
    let s = fs.readFileSync(f, "utf8");
    if (!s.includes("fonts.googleapis.com") && !s.includes("fonts:begin")) { console.log(p + ": Google Fonts を使っていない=触らない"); continue; }
    s = s.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/g, "")
         .replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*/g, "")
         .replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet">\s*/g, "")
         .replace(/\s*\/\* fonts:begin[\s\S]*?\/\* fonts:end \*\//, "");   // 古い形(<style> の中)は消す
    if (s.includes("<!-- fonts:begin")) s = s.replace(/<!-- fonts:begin[\s\S]*?<!-- fonts:end -->/, block);
    else s = s.replace("</style>\n", "</style>\n" + block + "\n");
    fs.writeFileSync(f, s);
    console.log(p + ": 書いた");
  }
  console.log("字 " + chars.size + "・書体 " + css.length + " 本・計 " + Math.round(total / 1024) + "KB");
})().catch((e) => { console.error("✗ " + e.message); process.exit(1); });
