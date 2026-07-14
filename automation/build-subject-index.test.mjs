import assert from "node:assert/strict";
import test from "node:test";
import { canonicalCompanies, canonicalCompany } from "./build-subject-index.mjs";

test("groups BYD subsidiaries and brands under BYD", () => {
  assert.equal(canonicalCompany("比亚迪半导体"), "比亚迪");
  assert.equal(canonicalCompany("海洋网"), "比亚迪");
});

test("does not duplicate a parent when parent and subsidiary share one card", () => {
  assert.deepEqual(canonicalCompanies(["比亚迪", "比亚迪半导体", "海洋网"]), ["比亚迪"]);
});

test("groups GAC operating entities under GAC Group", () => {
  assert.equal(canonicalCompany("广汽国际"), "广汽集团");
  assert.equal(canonicalCompany("广汽能源"), "广汽集团");
  assert.equal(canonicalCompany("广汽埃安"), "广汽集团");
  assert.equal(canonicalCompany("GAC Energy"), "广汽集团");
  assert.equal(canonicalCompany("GAC"), "广汽集团");
});

test("does not duplicate GAC Group when aliases share one card", () => {
  assert.deepEqual(
    canonicalCompanies(["广汽集团", "广汽国际", "广汽能源", "GAC Aion"]),
    ["广汽集团"],
  );
});

test("keeps unrelated companies unchanged", () => {
  assert.equal(canonicalCompany("宁德时代"), "宁德时代");
});
