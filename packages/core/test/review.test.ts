import { expect, test } from "bun:test";
import { analyzeDiff, reviewPullRequest } from "../src/index";
import { DryRunMemoryAdapter } from "../../memforks/src/index";

const diff = `diff --git a/src/middleware.ts b/src/middleware.ts
+ const session = await cache.get(\`session:\${token}\`)
+ if (session) return NextResponse.next()
+ const verified = await auth.verify(token)
+ await cache.set(\`session:\${token}\`, verified, { ttl: 86400 })
diff --git a/src/server/actions/profile.ts b/src/server/actions/profile.ts
+ await db.user.update({ data: Object.fromEntries(formData) })`;

test("review rules find auth cache and mass assignment", () => {
  const findings = analyzeDiff(diff);
  expect(findings.map((finding) => finding.ruleId)).toContain("auth-cache-revocation");
  expect(findings.map((finding) => finding.ruleId)).toContain("formdata-mass-assignment");
});

test("review creates branch and commits PR memory", async () => {
  const result = await reviewPullRequest({ repo: "demo/forkguard", prNumber: 482, diff }, new DryRunMemoryAdapter());
  expect(result.prBranch).toBe("pr/demo-forkguard/482");
  expect(result.findings.length).toBeGreaterThanOrEqual(2);
  expect(result.memoryEvents.map((event) => event.kind)).toEqual(["branch", "commit", "recall", "commit"]);
});

test("analyzeDiff suppresses rules when suppressedRuleIds provided", () => {
  const findingsWithSuppression = analyzeDiff(diff, ["auth-cache-revocation"]);
  expect(findingsWithSuppression.find((f) => f.ruleId === "auth-cache-revocation")).toBeUndefined();
  expect(findingsWithSuppression.find((f) => f.ruleId === "formdata-mass-assignment")).toBeDefined();
});

test("analyzeDiff suppresses multiple rules", () => {
  const findings = analyzeDiff(diff, ["auth-cache-revocation", "formdata-mass-assignment"]);
  expect(findings.find((f) => f.ruleId === "auth-cache-revocation")).toBeUndefined();
  expect(findings.find((f) => f.ruleId === "formdata-mass-assignment")).toBeUndefined();
});

test("analyzeDiff with empty suppressedRuleIds acts as normal", () => {
  const findingsNormal = analyzeDiff(diff);
  const findingsEmpty = analyzeDiff(diff, []);
  expect(findingsEmpty.length).toBe(findingsNormal.length);
  expect(findingsEmpty.map((f) => f.ruleId)).toEqual(findingsNormal.map((f) => f.ruleId));
});

test("reviewPullRequest passes suppressedRuleIds through", async () => {
  const result = await reviewPullRequest(
    { repo: "demo/forkguard", prNumber: 483, diff, suppressedRuleIds: ["auth-cache-revocation"] },
    new DryRunMemoryAdapter(),
  );
  expect(result.findings.find((f) => f.ruleId === "auth-cache-revocation")).toBeUndefined();
  expect(result.findings.find((f) => f.ruleId === "formdata-mass-assignment")).toBeDefined();
});
