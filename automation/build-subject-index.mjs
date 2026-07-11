import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function decodeHtml(value = "") {
  return value
    .replace(/<[^>]+>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function subjectId(name) {
  let hash = 2166136261;
  for (const character of name) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `subject-${(hash >>> 0).toString(36)}`;
}

function extractCompanies(card) {
  const companies = [];
  for (const match of card.matchAll(/<span[^>]*>\s*公司\s*[·：:]\s*([^<]+)<\/span>/g)) {
    const raw = decodeHtml(match[1]);
    companies.push(...raw.split(/[、，,]/).map((name) => name.trim()));
  }
  return [...new Set(companies)].filter((name) =>
    name.length >= 2
    && name.length <= 60
    && !/^(公司|企业|车企|未披露|外部电池初创企业)$/.test(name)
    && !/余家|多家|若干|等客户/.test(name),
  );
}

function parseReport(html, report) {
  const items = [];
  const sections = [...html.matchAll(/<section class="segment"[^>]*>[\s\S]*?<\/section>/g)];
  for (const sectionMatch of sections) {
    const section = sectionMatch[0];
    const segment = decodeHtml(section.match(/<h2 class="segment-title">([^<]+)<\/h2>/)?.[1] || "其他")
      .replace(/\s*[·•]\s*\d+\s*条?\s*$/, "");
    for (const cardMatch of section.matchAll(/<article class="card"[^>]*>[\s\S]*?<\/article>/g)) {
      const card = cardMatch[0];
      const headline = decodeHtml(card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] || "");
      if (!headline) continue;
      const date = card.match(/<time[^>]*datetime="(\d{4}-\d{2}-\d{2})"/)?.[1]
        || card.match(/信息日期[： ·]*(\d{4}-\d{2}-\d{2})/)?.[1]
        || report.date;
      for (const company of extractCompanies(card)) {
        items.push({
          subject: company,
          date,
          report_date: report.date,
          report_file: report.file,
          headline,
          segment,
        });
      }
    }
  }
  return items;
}

function ensureSubjectNavigation(html) {
  let updated = html
    .replaceAll("Lithium Industry Daily", "Lithium Industry Briefing")
    .replaceAll("锂电产业链新闻日报", "锂电产业链新闻简报")
    .replaceAll(">最新日报<", ">最新报告<")
    .replaceAll(">历史日报<", ">历史报告<")
    .replaceAll("查看日报", "查看报告")
    .replaceAll("历史日报列表", "历史报告列表")
    .replaceAll("自动更新时间：每天 19:00（Asia/Shanghai）。", "自动更新时间：每周一、周三、周五 19:00（Asia/Shanghai）。")
    .replaceAll("计划更新时间：每天 19:00（Asia/Shanghai）。", "计划更新时间：每周一、周三、周五 19:00（Asia/Shanghai）。")
    .replaceAll('aria-label="日报导航"', 'aria-label="报告导航"');
  if (!updated.includes('href="subjects.html"')) {
    updated = updated.replace(
      /(<div class="nav-links">[\s\S]*?<a[^>]*href="archive\.html"[^>]*>历史报告<\/a>)/,
      '$1\n        <a href="subjects.html">主体归纳</a>',
    );
  }
  return updated;
}

function renderSubjects(subjects) {
  const buttons = subjects.map((subject) =>
    `<a class="subject-chip" data-subject-name="${escapeHtml(subject.name.toLowerCase())}" href="#${subject.id}">${escapeHtml(subject.name)}<span>${subject.count}</span></a>`,
  ).join("\n        ");
  const sections = subjects.map((subject) => {
    const rows = subject.items.map((item) => `        <article class="news-row">
          <div class="news-meta"><time datetime="${item.date}">${item.date}</time><span>${escapeHtml(item.segment)}</span></div>
          <h3>${escapeHtml(item.headline)}</h3>
          <a href="${escapeHtml(item.report_file)}">打开 ${item.report_date} 报告</a>
        </article>`).join("\n");
    return `    <section class="subject-section" id="${subject.id}" data-subject-name="${escapeHtml(subject.name.toLowerCase())}">
      <div class="subject-heading"><h2>${escapeHtml(subject.name)}</h2><span>${subject.count} 条</span></div>
${rows}
    </section>`;
  }).join("\n\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="按公司和机构查看锂电产业链历次报告中的相关新闻">
  <title>主体归纳 | 锂电产业链新闻简报</title>
  <style>
    :root { --ink:#17324a; --muted:#5b7185; --blue:#1769aa; --blue-deep:#0d4f86; --blue-pale:#eaf6ff; --paper:#fbfdff; --line:#87bce5; --yellow:#ffe998; --shadow:rgba(23,50,74,.09); }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; background:#eef7fd; }
    body { margin:0; color:var(--ink); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; line-height:1.65; letter-spacing:0; background:repeating-linear-gradient(0deg,rgba(23,105,170,.025) 0,rgba(23,105,170,.025) 1px,transparent 1px,transparent 28px),var(--paper); }
    a { color:var(--blue-deep); text-underline-offset:3px; }
    .page { width:min(980px,calc(100% - 32px)); margin:0 auto; padding:28px 0 56px; }
    .site-nav { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-bottom:18px; padding:0 3px 12px; border-bottom:2px dashed var(--line); }
    .site-nav a { color:var(--blue-deep); font-weight:800; text-decoration:none; }
    .site-nav a:hover,.site-nav a:focus-visible,.site-nav .current { text-decoration:underline; }
    .site-nav .brand { color:var(--blue); }
    .nav-links { display:flex; flex-wrap:wrap; gap:18px; }
    .masthead { padding:26px 28px; border:2px dashed var(--line); border-radius:8px; background:#f5fbff; box-shadow:0 12px 28px var(--shadow); }
    .kicker { margin:0 0 6px; color:var(--blue-deep); font-size:.9rem; font-weight:800; text-transform:uppercase; }
    h1,h2,h3 { letter-spacing:0; }
    h1 { margin:0; color:var(--blue); font-size:2.2rem; line-height:1.2; }
    .intro { margin:12px 0 0; color:var(--muted); }
    .filter { width:100%; margin:18px 0 12px; padding:11px 13px; border:1px solid #a8cee9; border-radius:6px; background:#fff; color:var(--ink); font:inherit; }
    .subject-chips { display:flex; flex-wrap:wrap; gap:8px; padding:14px; border:1px dashed var(--line); border-radius:8px; background:#f5fbff; }
    .subject-chip { display:inline-flex; align-items:center; gap:7px; min-height:36px; padding:6px 10px; border:1px solid #a8cee9; border-radius:6px; background:#fff; font-size:.88rem; font-weight:800; text-decoration:none; }
    .subject-chip span { display:grid; place-items:center; min-width:22px; height:22px; padding:0 5px; border-radius:999px; background:var(--yellow); font-size:.75rem; }
    .subject-section { scroll-margin-top:18px; margin-top:26px; border-top:2px dashed var(--line); }
    .subject-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:18px 2px 8px; }
    .subject-heading h2 { margin:0; color:var(--blue-deep); font-size:1.3rem; }
    .subject-heading span { color:var(--muted); font-weight:750; }
    .news-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px 20px; padding:16px; border-bottom:1px dashed #b2d0e6; background:#fff; }
    .news-meta { display:flex; flex-wrap:wrap; gap:8px; color:var(--muted); font-size:.82rem; }
    .news-meta span { padding:1px 7px; border-radius:999px; background:var(--blue-pale); }
    .news-row h3 { grid-column:1; margin:0; font-size:1rem; line-height:1.5; }
    .news-row > a { grid-column:2; grid-row:1 / span 2; align-self:center; font-size:.86rem; font-weight:800; white-space:nowrap; }
    .empty { display:none; margin:20px 0; color:var(--muted); }
    footer { margin-top:30px; color:var(--muted); font-size:.86rem; }
    [hidden] { display:none !important; }
    @media (max-width:680px) { .page{width:min(100% - 20px,980px);padding-top:14px}.site-nav{align-items:flex-start}.site-nav .brand{max-width:130px}.nav-links{gap:10px}.masthead{padding:20px}h1{font-size:1.75rem}.news-row{grid-template-columns:1fr}.news-row > a{grid-column:1;grid-row:auto;justify-self:start}.subject-heading{align-items:baseline} }
  </style>
</head>
<body>
  <main class="page">
    <nav class="site-nav" aria-label="报告导航">
      <a class="brand" href="./">Lithium Industry Briefing</a>
      <div class="nav-links">
        <a href="./">最新报告</a>
        <a href="archive.html">历史报告</a>
        <a class="current" aria-current="page" href="subjects.html">主体归纳</a>
      </div>
    </nav>
    <header class="masthead">
      <p class="kicker">Subject Index</p>
      <h1>主体归纳</h1>
      <p class="intro">按公司或机构汇总历次报告中的相关新闻。</p>
      <input class="filter" id="subject-filter" type="search" placeholder="搜索公司或机构" autocomplete="off">
      <div class="subject-chips" aria-label="主体列表">
        ${buttons}
      </div>
      <p class="empty" id="empty-state">没有匹配的主体。</p>
    </header>
${sections}
    <footer>随每期报告自动更新。</footer>
  </main>
  <script>
    const input = document.querySelector('#subject-filter');
    const chips = [...document.querySelectorAll('.subject-chip')];
    const sections = [...document.querySelectorAll('.subject-section')];
    const empty = document.querySelector('#empty-state');
    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      let visible = 0;
      for (const element of [...chips, ...sections]) {
        const match = !query || element.dataset.subjectName.includes(query);
        element.hidden = !match;
        if (match && element.classList.contains('subject-chip')) visible += 1;
      }
      empty.style.display = visible ? 'none' : 'block';
    });
  </script>
</body>
</html>
`;
}

export async function buildSubjectIndex() {
  const reportsFile = JSON.parse(await readFile(path.join(ROOT, "reports.json"), "utf8"));
  reportsFile.reports = reportsFile.reports.map((report) => ({
    ...report,
    title: report.title === "锂电产业链新闻日报" ? "锂电产业链新闻简报" : report.title,
  }));
  const grouped = new Map();

  for (const report of reportsFile.reports) {
    const reportPath = path.join(ROOT, report.file);
    const html = await readFile(reportPath, "utf8");
    for (const item of parseReport(html, report)) {
      const group = grouped.get(item.subject) || [];
      group.push(item);
      grouped.set(item.subject, group);
    }
  }

  const subjects = [...grouped.entries()].map(([name, items]) => ({
    id: subjectId(name),
    name,
    count: items.length,
    items: items.sort((left, right) => right.date.localeCompare(left.date) || right.report_date.localeCompare(left.report_date)),
  })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN"));

  const siteFiles = (await readdir(ROOT)).filter((file) =>
    file === "index.html" || file === "archive.html" || /^daily-\d{4}-\d{2}-\d{2}\.html$/.test(file),
  );
  await Promise.all(siteFiles.map(async (file) => {
    const filePath = path.join(ROOT, file);
    const html = await readFile(filePath, "utf8");
    await writeFile(filePath, ensureSubjectNavigation(html));
  }));

  await Promise.all([
    writeFile(path.join(ROOT, "subjects.html"), renderSubjects(subjects)),
    writeFile(path.join(ROOT, "subjects.json"), `${JSON.stringify({ updated_at: new Date().toISOString(), subjects }, null, 2)}\n`),
    writeFile(path.join(ROOT, "reports.json"), `${JSON.stringify(reportsFile, null, 2)}\n`),
  ]);
  console.log(`Built subject index: ${subjects.length} subjects, ${subjects.reduce((sum, subject) => sum + subject.count, 0)} references.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildSubjectIndex();
}
