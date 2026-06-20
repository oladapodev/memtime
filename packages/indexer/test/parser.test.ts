import { describe, expect, test } from "bun:test";
import { parseFile } from "../src/parser";

describe("parseFile", () => {
  test("parses TypeScript imports", () => {
    const result = parseFile("test.ts", `import { foo } from "./bar";\nimport type { Baz } from "./baz";\nimport "polyfill";`);
    expect(result.language).toBe("typescript");
    expect(result.imports).toContain("./bar");
    expect(result.imports).toContain("./baz");
    expect(result.imports).toContain("polyfill");
  });

  test("parses CommonJS requires", () => {
    const result = parseFile("test.ts", `import { foo } from "./bar";\nconst fs = require("fs");`);
    expect(result.imports).toContain("./bar");
    expect(result.imports).toContain("fs");
  });

  test("extracts function declarations", () => {
    const result = parseFile("test.ts", `function foo() {}\nexport function bar() {}\nconst baz = () => {};`);
    expect(result.functions.some((f) => f.name === "foo")).toBe(true);
    expect(result.functions.some((f) => f.name === "bar")).toBe(true);
    expect(result.functions.some((f) => f.name === "baz")).toBe(true);
  });

  test("extracts class declarations", () => {
    const result = parseFile("test.ts", `class MyClass {}\nexport abstract class BaseClass {}`);
    expect(result.classes.some((c) => c.name === "MyClass")).toBe(true);
    expect(result.classes.some((c) => c.name === "BaseClass")).toBe(true);
  });

  test("extracts exports", () => {
    const result = parseFile("test.ts", `export function foo() {}\nexport class Bar {}\nexport const BAZ = 1;`);
    expect(result.exports).toContain("foo");
    expect(result.exports).toContain("Bar");
    expect(result.exports).toContain("BAZ");
  });

  test("detects Python correctly", () => {
    const result = parseFile("main.py", `import os\nfrom datetime import datetime\n\ndef hello():\n    pass\n\nclass User:\n    pass`);
    expect(result.language).toBe("python");
    expect(result.imports).toContain("os");
    expect(result.imports).toContain("datetime");
    expect(result.functions.some((f) => f.name === "hello")).toBe(true);
    expect(result.classes.some((c) => c.name === "User")).toBe(true);
  });

  test("detects Rust correctly", () => {
    const result = parseFile("main.rs", `use std::collections::HashMap;\npub fn run() {}\npub struct Config {}`);
    expect(result.language).toBe("rust");
    expect(result.imports).toContain("std/collections/HashMap");
    expect(result.functions.some((f) => f.name === "run")).toBe(true);
    expect(result.classes.some((c) => c.name === "Config")).toBe(true);
  });

  test("parses JSX/TSX files", () => {
    const result = parseFile("component.tsx", `import React from "react";\nexport function Button() { return <button />; }`);
    expect(result.language).toBe("tsx");
    expect(result.imports).toContain("react");
    expect(result.exports).toContain("Button");
  });
});
