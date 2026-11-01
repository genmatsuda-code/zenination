// split_zukan_2026-11-01.js — 図鑑を二つに分ける一度きりの便: sbt.html を善意立国の国民の証だけにし、本怖の帯は honkowa-zukan.html(帯の札)へ。リンクの付け替え・sitemap・記事の段も(⚖️2026-11-01 松田さん「分けて二つ・デザインはがらっと変えて」)。NOTE席
"use strict";
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8'), wr = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);
let s = rd('sbt.html');
const R = (a, b) => { if (!s.includes(a)) throw new Error('無し: ' + a.slice(0, 60)); s = s.split(a).join(b); };
R('<title>SBT 図鑑 ── 誰が、どの証を持っているか</title>', '<title>国民の証の図鑑 ── 善意立国</title>');
R('content="善意立国の国民の証と、本怖の帯 SBT「HonKowa」。誰が(番号で)、いつ受け取ったかをカードで並べた図鑑。譲れない・売れない・だから集めたくなる。"', 'content="善意立国の国民の証(SBT・百番まで)を、誰が(番号で)いつ受け取ったかをカードで並べた図鑑。譲れない・売れない・だから集めたくなる。"');
R('content="SBT 図鑑 ── 誰が、どの証を持っているか(善意立国の国民の証/本怖の帯)"', 'content="国民の証の図鑑 ── 善意立国"');
R('content="国民の証(百番まで)と HonKowa の帯。番号と受け取った日と tx を一枚ずつ。全部 Optimism で確かめられる。"', 'content="善意立国の国民の証(百番まで)。番号と受け取った日と tx を一枚ずつ。全部 Optimism で確かめられる。"');
R('<div class="brand"><b>SBT 図鑑</b> / ZENINATION × HONKOWA</div>\n  <nav><a href="#z">国民の証</a><a href="#h">HonKowa</a><a href="#voice">特典のご意見箱</a><a href="#how">仕組み</a></nav>', '<div class="brand"><b>国民の証の図鑑</b> / ZENINATION</div>\n  <nav><a href="#z">国民の証</a><a href="#voice">特典のご意見箱</a><a href="#how">仕組み</a><a href="kokumin.html">善意立国</a></nav>');
// 表紙
const h1s = s.indexOf('<div class="lbl">SBT 図鑑 ── 誰が、どの証を持っているか</div>'), h1e = s.indexOf('</div>\n</div>\n\n<section class="z"');
if (h1s < 0 || h1e < 0) throw new Error('表紙の範囲');
s = s.slice(0, h1s) + '<div class="lbl">ZENINATION ── 国民の証を持っている人の一覧</div>\n  <h1>百の席に、<br>百人の国民を。<small>善意立国(松田元の note の会・月 2,980 円)の国民が受け取る SBT が「国民の証」です。<b>入国の順の番号で、百番まで。</b>譲れず、売れず、消えません。受け取った人のカードが番号で並び、空いている席は点線のまま。名前は本人が出すと決めた時だけ。いまは配り始める前で、見本だけが置いてあります。<br><span style="color:var(--dim)">本怖(本当にあった怖い話)の帯「HonKowa」は別の会の別の記録で、図鑑も別です → <a href="honkowa-zukan.html" style="color:var(--ember)">帯の札</a></span></small></h1>\n  <div class="tally">\n    <div><div class="k">受け取った国民</div><div class="v" id="tz">—<small>/ 100</small></div></div>\n    <div><div class="k">空いている席</div><div class="v" id="tzLeft">—</div></div>\n  ' + s.slice(h1e);
R('<div class="lbl">① 善意立国 ── 国民の証(100 枚で打ち止め)</div><h2>善意立国の国民が持つ、番号つきの証。</h2><p>善意立国(松田元の note の会・月 2,980 円)の国民が受け取る SBT です。番号は入国の順で永久に決まり、百番で締めます。', '<div class="lbl">ZENINATION ── 国民の証(100 枚で打ち止め)</div><h2>番号は、入国の順で永久に決まる。</h2><p>百番で締めます。');
// 本怖の束を丸ごと外す
const hs = s.indexOf('<section class="h" id="h">'); if (hs < 0) throw new Error('h 節');
const he = s.indexOf('</div></section>', hs) + '</div></section>'.length;
s = s.slice(0, hs) + s.slice(he).replace(/^\n+/, '');
R('<div class="lbl">VOICE ── SBT ホルダーの特典のご意見箱</div>', '<div class="lbl">VOICE ── 国民の証を持つ方の特典のご意見箱</div>');
R('<p>SBT を持っている方(これから持つ方も)が、欲しい特典を書く箱です。<b>送る先は note の掲示板</b>(本怖は本怖の掲示板、善意立国は善意立国の掲示板)。下の「送る」を押すと、文を写して掲示板を開きます。番号だけで書けます。名前は要りません。</p>\n      <label>どちらの SBT</label>\n      <select id="vk"><option value="h">本怖 ── HonKowa(帯)</option><option value="z">善意立国 ── 国民の証</option></select>', '<p>国民の証を持っている方(これから持つ方も)が、欲しい特典を書く箱です。<b>送る先は善意立国の掲示板。</b>下のボタンを押すと、文を写して掲示板を開きます。番号だけで書けます。名前は要りません。</p>');
R('placeholder="例: 黒帯だけの相場の勉強会を年に一度／忘年会は土曜が助かる／帯の色のステッカー"', 'placeholder="例: 国民の証を持つ人だけの演説の先行枠／番号入りのステッカー／月末の目玉の一票"');
const vs = s.indexOf('<h3>いま出ている案</h3>'), ve = s.indexOf('</div>\n  </div>\n</div></section>', vs);
if (vs < 0 || ve < 0) throw new Error('案の範囲');
s = s.slice(0, vs) + '<h3>いま出ている案</h3>\n      <p>国民の証を持つ方の特典は、この箱に届いた物から決めます。いま出ている案がこれ。決まった物だけ「決まった」と載せます。</p>\n      <div class="ideas"><span>月末の目玉(来月の企画)を、国民の証を持つ人の一票で決める</span><span>演説(降臨の間)の先行の枠</span><span>国主の一撃(毎朝の 3 問)に、国民の証の番号で先に出せる</span><span>佐藤の帳面の「次の一手」を一日 早く読める</span></div>\n      <p style="margin-top:12px;font-size:12.5px;color:var(--dim)">約束ではなく記録です。中身は変わる事があります。</p>\n    ' + s.slice(ve);
R('本怖の会員の総数は、この頁にも鎖にも出しません。特典は記録であって約束ではなく、決まった物だけをこの頁に載せます。', '特典は記録であって約束ではなく、決まった物だけをこの頁に載せます。本怖の帯「HonKowa」の図鑑は <a href="honkowa-zukan.html">帯の札</a>(別の会・別の記録)。');
R('<footer><div class="wrap"><div>善意立国 ── 佐藤(松田元が作った AI)の国 / 本当にあった怖い話 ── 松田元</div>', '<footer><div class="wrap"><div>善意立国 ── 佐藤(松田元が作った AI)の国</div>');
// JS
R('document.getElementById("znote").textContent=z.length?"":"国民の証の配り始めは準備中です。受け取った方から、席が緑に光ります。";', 'document.getElementById("znote").textContent=z.length?"":"国民の証の配り始めは準備中です。受け取った方から、席が緑に光ります。"; document.getElementById("tzLeft").textContent=100-z.length;');
const js = s.indexOf('      var h=(j.honkowa||[])'), jeTok = '      if(h.length>24)document.getElementById("hmoreWrap").style.display="flex";\n', je = s.indexOf(jeTok);
if (js < 0 || je < 0) throw new Error('JS h');
s = s.slice(0, js) + s.slice(je + jeTok.length);
R('[["zmore","zgrid","もっと見る(21〜100 番) ▾","たたむ ▴"],["hmore","hgrid","もっと見る ▾","たたむ ▴"]]', '[["zmore","zgrid","もっと見る(21〜100 番) ▾","たたむ ▴"]]');
R('var k=document.getElementById("vk").value, n=', 'var k="z", n=');
R('(本怖の方は本怖の投稿の下へ・善意立国の方は善意立国の投稿の下へ)', '(善意立国の投稿の下へ)');
R('var LV={w:"白帯",g:"緑帯",k:"黒帯",m:"免許皆伝"}, RR={w:"COMMON",g:"UNCOMMON",k:"RARE",m:"LEGEND"};\n', '');
wr('sbt.html', s);
// リンクの付け替え
let c = rd('honkowa-sbt-claim.html');
c = c.split('<a href="sbt.html#voice">図鑑の「特典のご意見箱」</a>').join('<a href="honkowa-zukan.html#voice">帯の札の「特典のご意見箱」</a>').split('SBT 図鑑に、番号と帯で載る').join('帯の札(本怖の図鑑)に、番号と帯で載る');
wr('honkowa-sbt-claim.html', c);
let hk = rd('honkowa.html'); const anc = '<p class="hero-p"><small>第一弾の忘年会は決まっています。';
if (!hk.includes(anc)) throw new Error('honkowa anchor');
if (!hk.includes('honkowa-zukan.html')) hk = hk.replace(anc, '<p class="hero-p" style="margin-top:14px">帯を受け取った人の札は <a href="honkowa-zukan.html">帯の札(本怖の図鑑)</a> に掛かります。</p>\n  ' + anc);
wr('honkowa.html', hk);
let sm = rd('sitemap.xml');
if (!sm.includes('honkowa-zukan.html')) sm = sm.replace('<url><loc>https://genmatsuda-code.github.io/zenination/sbt.html</loc><lastmod>2026-11-01</lastmod><priority>0.8</priority></url>', '<url><loc>https://genmatsuda-code.github.io/zenination/sbt.html</loc><lastmod>2026-11-01</lastmod><priority>0.8</priority></url>\n  <url><loc>https://genmatsuda-code.github.io/zenination/honkowa-zukan.html</loc><lastmod>2026-11-01</lastmod><priority>0.8</priority></url>');
wr('sitemap.xml', sm);
let ks = rd('tools/known-standalone.txt'); if (!/honkowa-zukan/.test(ks)) wr('tools/known-standalone.txt', ks.replace(/\s*$/, '\n') + 'honkowa-zukan.html\n');
// 記事
const A = path.join(ROOT, '..', '佐藤note自動投稿', 'enqueue_burn1102_v2.js');
let a = fs.readFileSync(A, 'utf8');
const old = '国民の証と HonKowa のカードが並ぶ図鑑です。黒帯以上は金の縁のカード。名前は本人が出すと決めた時だけ。欲しい特典を書く「ご意見箱」もここに置きました。\nSBT 図鑑: https://genmatsuda-code.github.io/zenination/sbt.html';
if (!a.includes(old) && !a.includes('honkowa-zukan')) throw new Error('記事の図鑑の段が見つからない');
a = a.split(old).join('会は別なので、図鑑も別に作りました。善意立国は「国民の証の図鑑」(カードの束・百の席)。本怖は「帯の札」(夜の屋敷の壁に掛かる木の札・黒帯以上は黒檀に金)。名前は本人が出すと決めた時だけ。欲しい特典を書く「ご意見箱」はどちらにも置きました。\n国民の証の図鑑: https://genmatsuda-code.github.io/zenination/sbt.html\n帯の札(本怖): https://genmatsuda-code.github.io/zenination/honkowa-zukan.html');
fs.writeFileSync(A, a);
console.log('sbt 善意立国のみ・リンク付け替え・記事 済');
