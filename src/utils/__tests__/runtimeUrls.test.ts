import test from "node:test";
import assert from "node:assert/strict";

const loadModule = async () => import(`../runtimeUrls.ts?t=${Date.now()}`);

test("buildApiUrl falls back to relative path when VITE_API_BASE_URL is not configured", async () => {
  const { buildApiUrl } = await loadModule();
  assert.equal(buildApiUrl("/api/profile"), "/api/profile");
  assert.equal(buildApiUrl("api/health"), "/api/health");
});

test("buildApiUrl prefixes configured API base URL", async () => {
  const { buildApiUrl } = await loadModule();
  assert.equal(buildApiUrl("/api/profile", "https://example.com/"), "https://example.com/api/profile");
});

test("resolveAssetUrl keeps absolute and data URLs unchanged", async () => {
  const { resolveAssetUrl } = await loadModule();
  assert.equal(resolveAssetUrl("https://cdn.example.com/a.png"), "https://cdn.example.com/a.png");
  assert.equal(resolveAssetUrl("data:image/png;base64,abc"), "data:image/png;base64,abc");
});

test("resolveAssetUrl prefixes configured API base URL for relative upload paths", async () => {
  const { resolveAssetUrl } = await loadModule();
  assert.equal(resolveAssetUrl("/uploads/body/test.png", "https://api.fittrack.ai/"), "https://api.fittrack.ai/uploads/body/test.png");
  assert.equal(resolveAssetUrl("uploads/body/test.png", "https://api.fittrack.ai/"), "https://api.fittrack.ai/uploads/body/test.png");
});
