import { describe, expect, test } from "bun:test";
import { evaluatePullRequestTrigger, matchesCommentTag } from "../src/evaluator";
import type { TriggerConfig } from "../src/types";

const baseEvent = {
  action: "opened",
  repository: { full_name: "test/repo", default_branch: "main" },
  pull_request: {
    number: 1,
    title: "Test PR",
    state: "open",
    head: { sha: "abc123", ref: "feature/test" },
    base: { sha: "def456", ref: "main" },
    labels: [],
  },
  installation: { id: 1 },
};

describe("evaluatePullRequestTrigger", () => {
  test("auto mode triggers on opened", () => {
    const result = evaluatePullRequestTrigger(baseEvent, null);
    expect(result.shouldTrigger).toBe(true);
    expect(result.mode).toBe("auto");
  });

  test("auto mode triggers on synchronize", () => {
    const result = evaluatePullRequestTrigger(
      { ...baseEvent, action: "synchronize" },
      null,
    );
    expect(result.shouldTrigger).toBe(true);
  });

  test("comment mode blocks PR events", () => {
    const config: TriggerConfig = {
      id: "test",
      repoId: "repo_test_repo",
      triggerMode: "comment",
      configJson: {},
      updatedAt: new Date().toISOString(),
    };
    const result = evaluatePullRequestTrigger(baseEvent, config);
    expect(result.shouldTrigger).toBe(false);
    expect(result.reason).toContain("comment tag only");
  });

  test("custom mode with branch filter passes matching branch", () => {
    const config: TriggerConfig = {
      id: "test",
      repoId: "repo_test_repo",
      triggerMode: "custom",
      configJson: {
        branchFilters: ["feature/*"],
      },
      updatedAt: new Date().toISOString(),
    };
    const result = evaluatePullRequestTrigger(baseEvent, config);
    expect(result.shouldTrigger).toBe(true);
  });

  test("custom mode blocks non-matching branch", () => {
    const config: TriggerConfig = {
      id: "test",
      repoId: "repo_test_repo",
      triggerMode: "custom",
      configJson: {
        branchFilters: ["main"],
      },
      updatedAt: new Date().toISOString(),
    };
    const result = evaluatePullRequestTrigger(baseEvent, config);
    expect(result.shouldTrigger).toBe(false);
    expect(result.reason).toContain("branch filter");
  });

  test("custom mode with label requirement blocks unlabeled PR", () => {
    const config: TriggerConfig = {
      id: "test",
      repoId: "repo_test_repo",
      triggerMode: "custom",
      configJson: {
        labelRequirements: ["review-required"],
      },
      updatedAt: new Date().toISOString(),
    };
    const result = evaluatePullRequestTrigger(baseEvent, config);
    expect(result.shouldTrigger).toBe(false);
    expect(result.reason).toContain("required labels");
  });

  test("custom mode passes with matching labels", () => {
    const config: TriggerConfig = {
      id: "test",
      repoId: "repo_test_repo",
      triggerMode: "custom",
      configJson: {
        labelRequirements: ["review-required"],
      },
      updatedAt: new Date().toISOString(),
    };
    const labeledEvent = {
      ...baseEvent,
      pull_request: {
        ...baseEvent.pull_request,
        labels: [{ name: "review-required" }],
      },
    };
    const result = evaluatePullRequestTrigger(labeledEvent, config);
    expect(result.shouldTrigger).toBe(true);
  });

  test("ignores non-standard PR actions", () => {
    const result = evaluatePullRequestTrigger(
      { ...baseEvent, action: "closed" },
      null,
    );
    expect(result.shouldTrigger).toBe(false);
  });
});

describe("matchesCommentTag", () => {
  test("matches /forkbot review", () => {
    expect(matchesCommentTag("/forkbot review", null)).toBe(true);
  });

  test("matches @ForkBot review", () => {
    expect(matchesCommentTag("@ForkBot review this PR please", null)).toBe(true);
  });

  test("does not match plain text", () => {
    expect(matchesCommentTag("please review this PR", null)).toBe(false);
  });

  test("does not match /forkbot fix", () => {
    expect(matchesCommentTag("/forkbot fix #3", null)).toBe(false);
  });
});
