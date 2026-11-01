// lp_promise_fix_2026-11-01.js — LP の約束の点検(ops/善意立国/LPの約束の点検_2026-11-01.md §3)で「頁の文を直す」とされた物を直す一度きりの便。NOTE席
//   oni/kokumin: 毎月あなたの頁(九月・十月は出せなかった→十一月号から再開)・一行の遺言(受付の形を準備中)・招待状 3 通(招いた記録の受付は準備中)・「十一月から繋がる」→「十二月の点火から」・人数の矛盾の一行
//   index: 創設市民 500→創設の門は 8/31 に閉じ 52 名・席の番号は百番/日誌の「来」二つを事実に/「―」の四つの数を国情演説への道に/梯子の 500→100
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const edit = (f, pairs) => { let s = fs.readFileSync(path.join(ROOT, f), "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("  (無し) " + f + ": " + a.slice(0, 50)); continue; } s = s.split(a).join(b); } fs.writeFileSync(path.join(ROOT, f), s); console.log(f + ": 書いた"); };

for (const f of ["oni.html", "kokumin.html"]) edit(f, [
  ['<div class="perk"><div class="w">毎月</div><h3>あなたの頁</h3><p>その月のあなたを、編纂者が一篇の文章にして贈ります。</p></div>',
   '<div class="perk"><div class="w">毎月</div><h3>あなたの頁</h3><p>その月のあなたを、編纂者が一篇の文章にして贈ります。九月号と十月号は出せませんでした。十一月号(十一月末)から再開します。</p></div>'],
  ['<div class="perk"><div class="w">毎月</div><h3>一行の遺言</h3><p>未来に遺す一行を、毎月一つ、ブロックチェーンに刻みます。</p></div>',
   '<div class="perk"><div class="w">毎月</div><h3>一行の遺言</h3><p>未来に遺す一行を、毎月一つ、ブロックチェーンに刻みます(受付の形を準備中です。始める月をここに書きます)。</p></div>'],
  ['<div class="perk"><div class="w">随時</div><h3>招待状 3 通</h3><p>大事な人を三人まで。返礼は記録だけ、金銭は一切ありません。</p></div>',
   '<div class="perk"><div class="w">随時</div><h3>招待状 3 通</h3><p>大事な人を三人まで(招いた記録の受付は準備中)。金銭の返礼は一切ありません。</p></div>'],
  ['<p class="lead">十一月から、善意立国は WOWOO Burn Chronicle に繋がります。', '<p class="lead">十二月の点火から、善意立国は WOWOO Burn Chronicle に繋がります(重みの統治が通った日が点火の日です)。'],
]);

edit("index.html", [
  ['<span class="tick"><b class="num">500</b>創設</span>', '<span class="tick"><b class="num">100</b>席</span>'],
  ['<div class="rng num">1 – 500</div>', '<div class="rng num">1 – 100</div>'],
  ['<div class="rng num">500 – 2,000</div>', '<div class="rng num">100 – 2,000</div>'],
  ['<p>創設の民。国の精神を、まず身体で示す人たち。数ではなく、密度でつくる核。</p>', '<p>創設の民。国の精神を、まず身体で示す人たち。数ではなく、密度でつくる核。席の番号は百番で締めます。</p>'],
  ['<div class="title-c"><div class="tn">創設市民</div><p>#001–500。建国と同時に刻まれた最初の500名。<b style="color:var(--fg)">500で永遠に締まる</b>——後から誰も入れない。</p></div>',
   '<div class="title-c"><div class="tn">創設国民</div><p>創設の門は 2026 年 8 月 31 日に閉じ、創設国民は 52 名。<b style="color:var(--fg)">後から誰も創設国民にはなれない。</b>席の番号(国民の証)は百番で締めます。</p></div>'],
  ['<div class="tile accent"><div class="kl">市民数</div><div class="kv">―<span class="u">名</span></div><div class="ks">第1回 国情演説より公開</div></div>\n      <div class="tile"><div class="kl">刻まれた善行</div><div class="kv">―<span class="u">件</span></div><div class="ks">第三者の確認を経たものだけ</div></div>\n      <div class="tile"><div class="kl">系譜の深さ</div><div class="kv">―<span class="u">代</span></div><div class="ks">招かれた民が、招いた世代の数</div></div>\n      <div class="tile"><div class="kl">離国率</div><div class="kv">―<span class="u">%</span></div><div class="ks">去った人の数も、隠さず出す</div></div>',
   '<div class="tile accent"><div class="kl">数は、毎週木曜の国情演説で</div><div class="kv" style="font-size:1.1rem;line-height:1.6">国民の数・入と出・帳面の数・燃えた量を、毎週木曜の国情演説(国民限定)で、そのまま出しています。去った人の数も隠しません。</div><div class="ks"><a href="https://note.com/gen_matsuda/membership" style="color:inherit">国情演説を読む →</a></div></div>'],
  ['<div class="dt">来 ── 第一号</div>\n        <div class="ev">最初の市民が刻まれる</div>\n        <div class="nt">#001。この国で最初に証を受け取る人。名は、永遠に一番上に残る。</div>',
   '<div class="dt">2026.09.02 ── 第 1 回 叙任式</div>\n        <div class="ev">創設国民 52 名に、番号を授与</div>\n        <div class="nt">番号は入国の順で永久に決まる。国民の証(SBT)の配り始めは準備中。</div>'],
  ['<div class="dt">来 ── 創設の締切</div>\n        <div class="ev">創設市民、500名で締まる</div>\n        <div class="nt">この日を過ぎたら、誰一人として創設市民にはなれない。</div>',
   '<div class="dt">2026.08.31 ── 創設の門、閉じる</div>\n        <div class="ev">創設国民は 52 名で締まった</div>\n        <div class="nt">この日を過ぎた人は、誰一人として創設国民にはなれない。席の番号は百番まで。</div>'],
  ['最初の500名は「創設市民」と呼ばれ、<b style="color:var(--fg)">500名で永久に締め切ります。</b>\n      ― 建国は、まもなく。',
   '最初の 52 名は「創設国民」と呼ばれ、<b style="color:var(--fg)">2026 年 8 月 31 日に永久に締め切りました。</b>席の番号は百番まで。\n      ― 入口は、<a href="kokumin.html" style="color:inherit">こちら</a>。'],
  ['var target=500; // creation phase target shown as the near horizon', 'var target=100; // 席の番号は百番で締める(2026-11-01 揃えた)'],
]);
