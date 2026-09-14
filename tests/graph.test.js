import test from "node:test";
import assert from "node:assert/strict";
import { encodeShareUrl, uploadUrl, resolveShareUrl } from "../app/src/graph.js";

const link = "https://industrialroboticslt-my.sharepoint.com/:f:/g/personal/x_y_lt/IgD9?e=57d9Ti";

test("encodeShareUrl follows Graph 'u!' base64url rule", () => {
  const enc = encodeShareUrl(link);
  assert.ok(enc.startsWith("u!"));
  assert.ok(!/[=+/]/.test(enc), "no padding, no + or /");
  const back = Buffer.from(enc.slice(2).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  assert.equal(back, link);
});
test("resolveShareUrl asks Graph for the shared driveItem", () => {
  assert.equal(resolveShareUrl(link), `https://graph.microsoft.com/v1.0/shares/${encodeShareUrl(link)}/driveItem?$select=id,name,parentReference,webUrl`);
});
test("uploadUrl targets a child of the folder by drive and item id", () => {
  assert.equal(uploadUrl("b!drive", "01ITEM", "plociai_2026-09-14.xlsx"),
    "https://graph.microsoft.com/v1.0/drives/b!drive/items/01ITEM:/plociai_2026-09-14.xlsx:/content");
});
test("uploadUrl escapes unsafe characters in the file name", () => {
  assert.ok(uploadUrl("d", "i", "a b#.xlsx").endsWith("/items/i:/a%20b%23.xlsx:/content"));
});
