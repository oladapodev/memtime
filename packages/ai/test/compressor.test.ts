import { describe, expect, test } from "bun:test";
import { compressDiff, prioritizeChunks, estimateTokens } from "../src/compressor";

const SAMPLE_DIFF = `diff --git a/src/auth.ts b/src/auth.ts
index abc..def 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,6 +10,8 @@ export function verify(token: string) {
   if (!token) throw new Error("no token");
+  const version = await cache.get(\`token:version:\${token}\`);
+  if (version && version !== currentVersion) throw new Error("token revoked");
   return jwt.verify(token, SECRET);
 }
diff --git a/src/config.ts b/src/config.ts
index 123..456 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,2 +1,3 @@
 export const PORT = 3000;
+export const APP_NAME = "myapp";
`;

describe("compressDiff", () => {
  test("splits diff into per-file chunks", () => {
    const result = compressDiff(SAMPLE_DIFF);
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0].filePath).toBe("src/auth.ts");
    expect(result.chunks[1].filePath).toBe("src/config.ts");
  });

  test("counts added and removed lines", () => {
    const result = compressDiff(SAMPLE_DIFF);
    expect(result.chunks[0].linesAdded).toBe(2);
    expect(result.chunks[0].linesRemoved).toBe(0);
    expect(result.chunks[1].linesAdded).toBe(1);
    expect(result.chunks[1].linesRemoved).toBe(0);
  });

  test("classifies change types", () => {
    const result = compressDiff(SAMPLE_DIFF);
    expect(result.chunks[0].changeType).toBe("modified");
  });

  test("generates file count summary", () => {
    const result = compressDiff(SAMPLE_DIFF);
    expect(result.summary).toContain("2 file(s)");
  });
});

describe("prioritizeChunks", () => {
  test("prioritizes added files first", () => {
    const chunks = [
      { filePath: "deleted.ts", hunks: "", changeType: "deleted" as const, linesAdded: 0, linesRemoved: 10 },
      { filePath: "added.ts", hunks: "", changeType: "added" as const, linesAdded: 5, linesRemoved: 0 },
    ];
    const result = prioritizeChunks(chunks, 5);
    expect(result[0].changeType).toBe("added");
  });

  test("limits to maxChunks", () => {
    const chunks = Array.from({ length: 20 }, (_, i) => ({
      filePath: `file${i}.ts`,
      hunks: "",
      changeType: "modified" as const,
      linesAdded: 1,
      linesRemoved: 0,
    }));
    const result = prioritizeChunks(chunks, 5);
    expect(result).toHaveLength(5);
  });
});

describe("estimateTokens", () => {
  test("estimates roughly 1 token per 4 chars", () => {
    const text = "hello world this is a test of the token estimator";
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(5);
    expect(tokens).toBeLessThan(20);
  });
});
