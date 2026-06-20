import { describe, expect, test } from "bun:test";
import { DryRunFixVerifier } from "../src/verifier";

const SAMPLE_PATCH = `--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,6 +10,8 @@ export function verify(token) {
   if (!token) throw new Error("no token");
+  const version = await cache.get(\`token:version:\${token}\`);
+  if (version && version !== currentVersion) throw new Error("token revoked");
   return jwt.verify(token, SECRET);
 }`;

const INVALID_PATCH = `This is not a valid diff patch.`;

const FINDING = {
  ruleId: "auth-cache-revocation",
  severity: "high" as const,
  filePath: "src/auth.ts",
  line: 12,
  title: "Cached auth can bypass revocation",
  body: "Session data is trusted from cache before revocation is checked.",
  suggestion: "Include token version in cache key.",
  memoryFact: "Auth caches must include revocation checks.",
};

describe("DryRunFixVerifier", () => {
  const verifier = new DryRunFixVerifier();

  test("passes valid patches", async () => {
    const result = await verifier.verify(SAMPLE_PATCH, FINDING);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(5);
    expect(result.log).toContain("PASSED");
  });

  test("fails empty patches", async () => {
    const result = await verifier.verify("", FINDING);
    expect(result.passed).toBe(false);
    expect(result.confidence).toBe(0);
  });

  test("fails patches without diff header", async () => {
    const result = await verifier.verify(INVALID_PATCH, FINDING);
    expect(result.passed).toBe(false);
  });

  test("is always available", () => {
    expect(verifier.isAvailable()).toBe(true);
  });
});
