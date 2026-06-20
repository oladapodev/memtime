import { expect, test } from "bun:test";
import { verifyGitHubSignature } from "../src/index";

async function signature(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `sha256=${[...new Uint8Array(signed)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

test("GitHub webhook signature verification accepts valid payload", async () => {
  const payload = JSON.stringify({ action: "opened" });
  const header = await signature(payload, "secret");
  expect(await verifyGitHubSignature(payload, header, "secret")).toBe(true);
});

test("GitHub webhook signature verification rejects invalid payload", async () => {
  const payload = JSON.stringify({ action: "opened" });
  const header = await signature(payload, "secret");
  expect(await verifyGitHubSignature(`${payload}x`, header, "secret")).toBe(false);
});
