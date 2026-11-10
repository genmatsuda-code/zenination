// sitemap.xml を、各頁の canonical から作り直す(2026-11-10 Web プロデューサー席)。
// 使い方: node tools/build-sitemap.js   → sitemap.xml を上書き。
// noindex・refresh の頁は載せない。lastmod は git の最後の commit の日(未 commit の変更があれば今日)。
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const files = ['.', 'en'].flatMap((d) => fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith('.html')).map((f) => (d === '.' ? f : d + '/' + f)));
const dirty = new Set(execSync('git status --porcelain', { cwd: root }).toString().split('\n').map((l) => l.slice(3).trim()));
const top = new Set(['', 'en/', 'kokumin.html', 'oni.html', 'honkowa.html', 'tokuten.html', 'kuni.html']);
const rows = [];
for (const rel of files) {
  const s = fs.readFileSync(path.join(root, rel), 'utf8');
  if (/name="robots"[^>]*noindex/.test(s) || /http-equiv="refresh"/.test(s)) continue;
  const canon = (s.match(/rel="canonical" href="([^"]*)"/) || [])[1];
  if (!canon) continue;
  let last = today;
  if (!dirty.has(rel)) { try { last = execSync('git log -1 --format=%cs -- "' + rel + '"', { cwd: root }).toString().trim() || today; } catch (_) {} }
  const key = canon.replace('https://genmatsuda-code.github.io/zenination/', '');
  rows.push({ canon, last, pr: key === '' ? '1.0' : top.has(key) ? '0.8' : key.startsWith('en/') ? '0.5' : '0.6' });
}
rows.sort((a, b) => b.pr - a.pr || a.canon.localeCompare(b.canon));
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  rows.map((r) => `  <url><loc>${r.canon}</loc><lastmod>${r.last}</lastmod><priority>${r.pr}</priority></url>`).join('\n') + '\n</urlset>\n';
fs.writeFileSync(path.join(root, 'sitemap.xml'), xml);
console.log('sitemap.xml: ' + rows.length + ' 頁');
