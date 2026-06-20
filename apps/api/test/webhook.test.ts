import { expect, test } from "bun:test";
import { verifyGitHubSignature } from "../../../packages/github/src/index";

// Re-use the parseCommentCommand from the index file by inlining the logic
function parseCommentCommand(body: string): {
  command: string;
  args: string[];
  findingNumber?: number;
  question?: string;
  facts?: string[];
} | null {
  const text = body.trim();
  const match = text.match(/^(?:\/forkbot|@ForkBot)\s+(\w+)(.*)$/i);
  if (!match) return null;

  const command = match[1].toLowerCase();
  const rest = match[2].trim();
  const args = rest ? rest.split(/\s+/).filter(Boolean) : [];
  const validCommands = ["review", "fix", "describe", "ask", "promote", "status", "help"];
  if (!validCommands.includes(command)) return null;

  const result: { command: string; args: string[]; findingNumber?: number; question?: string; facts?: string[] } = { command, args };

  if (command === "fix" && args.length > 0) {
    const num = parseInt(args[0].replace(/^#/, ""), 10);
    if (!isNaN(num)) result.findingNumber = num;
  }

  if (command === "ask") {
    result.question = rest;
  }

  if (command === "promote") {
    result.facts = args;
  }

  return result;
}

test("parseCommentCommand parses /forkbot review", () => {
  const cmd = parseCommentCommand("/forkbot review");
  expect(cmd).not.toBeNull();
  expect(cmd!.command).toBe("review");
  expect(cmd!.args).toEqual([]);
});

test("parseCommentCommand parses @ForkBot review", () => {
  const cmd = parseCommentCommand("@ForkBot review");
  expect(cmd).not.toBeNull();
  expect(cmd!.command).toBe("review");
});

test("parseCommentCommand parses /forkbot fix #3", () => {
  const cmd = parseCommentCommand("/forkbot fix #3");
  expect(cmd).not.toBeNull();
  expect(cmd!.command).toBe("fix");
  expect(cmd!.findingNumber).toBe(3);
});

test("parseCommentCommand parses /forkbot ask what does this PR do", () => {
  const cmd = parseCommentCommand("/forkbot ask what does this PR do");
  expect(cmd).not.toBeNull();
  expect(cmd!.command).toBe("ask");
  expect(cmd!.question).toBe("what does this PR do");
});

test("parseCommentCommand parses /forkbot promote convention fact", () => {
  const cmd = parseCommentCommand("/forkbot promote convention fact");
  expect(cmd).not.toBeNull();
  expect(cmd!.command).toBe("promote");
  expect(cmd!.facts).toEqual(["convention", "fact"]);
});

test("parseCommentCommand parses /forkbot help", () => {
  const cmd = parseCommentCommand("/forkbot help");
  expect(cmd).not.toBeNull();
  expect(cmd!.command).toBe("help");
});

test("parseCommentCommand rejects unknown command", () => {
  const cmd = parseCommentCommand("/forkbot unknown");
  expect(cmd).toBeNull();
});

test("parseCommentCommand rejects non-command comment", () => {
  const cmd = parseCommentCommand("just a normal comment");
  expect(cmd).toBeNull();
});

test("parseCommentCommand is case insensitive for ForkBot", () => {
  const cmd = parseCommentCommand("/FORKBOT review");
  expect(cmd).not.toBeNull();
  expect(cmd!.command).toBe("review");
});

test("parseCommentCommand handles @forkbot in lowercase", () => {
  const cmd = parseCommentCommand("@forkbot review");
  expect(cmd).not.toBeNull();
  expect(cmd!.command).toBe("review");
});

// ─── Signature verification tests ─────────────────────────────────

async function createSignature(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `sha256=${[...new Uint8Array(signed)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

test("verifyGitHubSignature accepts valid payload", async () => {
  const payload = JSON.stringify({ action: "opened" });
  const header = await createSignature(payload, "secret");
  expect(await verifyGitHubSignature(payload, header, "secret")).toBe(true);
});

test("verifyGitHubSignature rejects tampered payload", async () => {
  const payload = JSON.stringify({ action: "opened" });
  const header = await createSignature(payload, "secret");
  expect(await verifyGitHubSignature(payload + "x", header, "secret")).toBe(false);
});

test("verifyGitHubSignature rejects missing header", async () => {
  expect(await verifyGitHubSignature("{}", null, "secret")).toBe(false);
});
