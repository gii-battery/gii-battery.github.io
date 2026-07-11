import assert from "node:assert/strict";
import test from "node:test";
import { findLikelyDuplicate, headlineSimilarity, normalizeUrl } from "./duplicate-guard.mjs";

const priorByd = {
  headline: "比亚迪第 1,700 万辆新能源车下线，海豹 08 同步搭载二代刀片电池",
  main_url: "https://example.com/byd?utm_source=newsletter",
  companies: ["比亚迪", "海洋网"],
  info_date: "2026-07-09",
};

test("normalizes tracking parameters before URL comparison", () => {
  assert.equal(normalizeUrl("https://example.com/a?utm_source=x&ref=y&id=7"), "https://example.com/a?id=7");
});

test("blocks the same event when another outlet rewrites the headline", () => {
  const candidate = {
    headline: "比亚迪第1700万辆新能源车下线，海豹08搭载第二代刀片电池",
    main_url: "https://another.example/byd-milestone",
    companies: ["比亚迪"],
    info_date: "2026-07-09",
  };
  const duplicate = findLikelyDuplicate(candidate, [priorByd]);
  assert.ok(duplicate);
  assert.ok(headlineSimilarity(candidate.headline, priorByd.headline) > 0.8);
});

test("blocks policy rewrites through date and institution aliases", () => {
  const prior = {
    headline: "中国动力电池安全新国标正式实施，新增底部撞击和快充循环后安全测试",
    main_url: "https://example.com/standard",
    companies: ["市场监管总局", "国家标准委"],
    info_date: "2026-07-01",
  };
  const candidate = {
    headline: "中国两项电动汽车强制国标施行，动力电池测试新增底部撞击与快充后短路",
    main_url: "https://another.example/standard-explainer",
    companies: ["国家市场监督管理总局", "国家标准化管理委员会"],
    info_date: "2026-07-01",
  };
  assert.ok(findLikelyDuplicate(candidate, [prior]));
});

test("allows a similar recurring event on a different date", () => {
  const candidate = {
    ...priorByd,
    headline: "比亚迪第1800万辆新能源车下线，海豹09搭载第三代刀片电池",
    main_url: "https://example.com/byd-next-milestone",
    info_date: "2026-10-12",
  };
  assert.equal(findLikelyDuplicate(candidate, [priorByd]), null);
});

test("blocks an exact URL even when the title changes", () => {
  const candidate = {
    headline: "比亚迪公布新能源车生产新节点",
    main_url: "https://example.com/byd?ref=homepage",
    companies: ["比亚迪"],
    info_date: "2026-07-10",
  };
  assert.equal(findLikelyDuplicate(candidate, [priorByd])?.reason, "相同新闻链接");
});
