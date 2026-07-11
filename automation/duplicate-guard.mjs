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

export function normalizeUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || ["ref", "source", "from"].includes(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return null;
  }
}

function extractCompanies(card) {
  const companies = [];
  for (const match of card.matchAll(/<span[^>]*>\s*公司(?:\/机构)?\s*[·：:]\s*([^<]+)<\/span>/g)) {
    companies.push(...decodeHtml(match[1]).split(/[、，,]/).map((name) => name.trim()));
  }
  return [...new Set(companies)].filter(Boolean);
}

export function extractReportEvents(html, reportDate = "", reportFile = "") {
  return [...html.matchAll(/<article class="card"[^>]*>[\s\S]*?<\/article>/g)].map((match) => {
    const card = match[0];
    const links = card.match(/<div class="links">([\s\S]*?)<\/div>/)?.[1] || card;
    const rawUrl = links.match(/href="(https?:\/\/[^"#]+)"/)?.[1] || "";
    return {
      headline: decodeHtml(card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] || ""),
      main_url: normalizeUrl(rawUrl.replaceAll("&amp;", "&")) || "",
      companies: extractCompanies(card),
      info_date: card.match(/<time[^>]*datetime="(\d{4}-\d{2}-\d{2})"/)?.[1]
        || card.match(/信息日期[： ·]*(\d{4}-\d{2}-\d{2})/)?.[1]
        || reportDate,
      report_date: reportDate,
      report_file: reportFile,
    };
  }).filter((event) => event.headline);
}

function normalizedHeadline(value = "") {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function bigrams(value) {
  const normalized = normalizedHeadline(value);
  if (normalized.length < 2) return normalized ? [normalized] : [];
  return [...normalized.slice(0, -1)].map((_, index) => normalized.slice(index, index + 2));
}

export function headlineSimilarity(left, right) {
  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);
  if (!leftGrams.length || !rightGrams.length) return 0;
  const counts = new Map();
  for (const gram of leftGrams) counts.set(gram, (counts.get(gram) || 0) + 1);
  let overlap = 0;
  for (const gram of rightGrams) {
    if (!counts.get(gram)) continue;
    overlap += 1;
    counts.set(gram, counts.get(gram) - 1);
  }
  return (2 * overlap) / (leftGrams.length + rightGrams.length);
}

function normalizedCompany(value = "") {
  return value.toLowerCase()
    .replace("国家市场监督管理总局", "市场监管总局")
    .replace("国家标准化管理委员会", "国家标准委")
    .replace("工业和信息化部", "工信部")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function sharesCompany(left, right) {
  const leftCompanies = (left.companies || []).map(normalizedCompany).filter(Boolean);
  const rightCompanies = (right.companies || []).map(normalizedCompany).filter(Boolean);
  return leftCompanies.some((leftCompany) => rightCompanies.some((rightCompany) =>
    leftCompany === rightCompany
    || (Math.min(leftCompany.length, rightCompany.length) >= 4
      && (leftCompany.includes(rightCompany) || rightCompany.includes(leftCompany))),
  ));
}

export function findLikelyDuplicate(candidate, historicalEvents) {
  const candidateUrl = normalizeUrl(candidate.main_url);
  let bestMatch = null;

  for (const prior of historicalEvents) {
    const priorUrl = normalizeUrl(prior.main_url);
    const similarity = headlineSimilarity(candidate.headline, prior.headline);
    const sameDate = Boolean(candidate.info_date && prior.info_date && candidate.info_date === prior.info_date);
    const sameCompany = sharesCompany(candidate, prior);
    let reason = "";

    if (candidateUrl && priorUrl && candidateUrl === priorUrl) reason = "相同新闻链接";
    else if (sameDate && similarity >= 0.62) reason = "同日且标题高度相似";
    else if (sameDate && sameCompany && similarity >= 0.38) reason = "同日、同公司且事件描述相似";
    if (!reason) continue;

    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = { prior, reason, similarity };
    }
  }
  return bestMatch;
}

export function findCrossReportDuplicates(candidateEvents, historicalEvents) {
  return candidateEvents.flatMap((candidate) => {
    const match = findLikelyDuplicate(candidate, historicalEvents);
    return match ? [{ candidate, ...match }] : [];
  });
}
