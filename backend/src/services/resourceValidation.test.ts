import assert from "node:assert/strict";
import { test } from "node:test";
import { validateResourceUpload } from "./resourceValidation.js";

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const base = { userId: "user-a", mimeType: "image/png", size: png.length, data: `data:image/png;base64,${png.toString("base64")}` };

test("accepts a size-matched file whose signature matches its declared type", () => {
  assert.deepEqual(validateResourceUpload(base), { ok: true });
});

test("rejects mismatched type, byte count, malformed base64 and unsupported active formats", () => {
  assert.equal(validateResourceUpload({ ...base, mimeType: "application/pdf" }).ok, false);
  assert.equal(validateResourceUpload({ ...base, size: png.length + 1 }).ok, false);
  assert.equal(validateResourceUpload({ ...base, data: "data:image/png;base64,***" }).ok, false);
  assert.equal(validateResourceUpload({ ...base, mimeType: "image/svg+xml" }).ok, false);
});

test("enforces resource ownership for cloud keys and file-size bounds", () => {
  assert.equal(validateResourceUpload({ userId: "user-a", mimeType: "image/png", size: 10, r2Key: "users/user-b/resources/a.png" }).ok, false);
  assert.equal(validateResourceUpload({ userId: "user-a", mimeType: "image/png", size: 20 * 1024 * 1024 + 1, r2Key: "users/user-a/resources/a.png" }).ok, false);
});
