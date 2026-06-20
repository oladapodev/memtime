import { expect, test } from "bun:test";
import { DryRunMemoryAdapter } from "../src/index";

test("dry-run adapter branches, recalls, and promotes facts", async () => {
  const memory = new DryRunMemoryAdapter();
  await memory.commit("main", "seed", ["Auth cache entries include revocation epoch."]);
  await memory.branch("pr/demo/1", "main");
  await memory.commit("pr/demo/1", "review", ["PR found unsafe form data update."]);

  expect(await memory.recall("auth cache", "main")).toHaveLength(1);
  expect(await memory.recall("form data", "pr/demo/1")).toHaveLength(1);

  const event = await memory.promote("pr/demo/1", "main", ["Server actions validate form data."]);
  expect(event.kind).toBe("promote");
  expect(await memory.recall("server actions", "main")).toHaveLength(1);
});
