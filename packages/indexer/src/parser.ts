import type { ParsedFile } from "./types";

/**
 * Parse a single source file to extract:
 * - imports
 * - exports
 * - function declarations
 * - class declarations
 *
 * Uses regex-based extraction (Worker-compatible, no AST parser needed).
 * Handles JS/TS, Python, Rust, Go.
 */
export function parseFile(path: string, content: string): ParsedFile {
  const lang = detectLanguage(path);
  const lines = content.split("\n");

  return {
    path,
    language: lang,
    size: content.length,
    sha: "", // filled in by caller
    imports: extractImports(content, lang),
    exports: extractExports(content, lang),
    functions: extractFunctions(lines, lang),
    classes: extractClasses(lines, lang),
  };
}

function detectLanguage(path: string): string {
  const ext = path.slice(path.lastIndexOf("."));
  const map: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".rb": "ruby",
    ".css": "css",
    ".scss": "scss",
    ".less": "less",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".md": "markdown",
    ".sql": "sql",
  };
  return map[ext] ?? "unknown";
}

function extractImports(content: string, lang: string): string[] {
  const imports: string[] = [];

  switch (lang) {
    case "typescript":
    case "tsx":
    case "javascript":
    case "jsx": {
      // import ... from "..."
      const importFrom = content.matchAll(/import\s+(?:[\s\S]*?\s+from\s+)?['\"]([^'\"]+)['\"]/g);
      // require("...")
      const requireMatch = content.matchAll(/(?:import|require)\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/g);
      // dynamic import
      const dynamicImport = content.matchAll(/import\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/g);

      for (const m of importFrom) imports.push(m[1]);
      for (const m of requireMatch) imports.push(m[1]);
      for (const m of dynamicImport) imports.push(m[1]);
      break;
    }
    case "python": {
      const pyImports = content.matchAll(/(?:import|from)\s+([a-zA-Z_][\w.]*)/g);
      for (const m of pyImports) imports.push(m[1]);
      break;
    }
    case "rust": {
      const rsImports = content.matchAll(/(?:use|extern crate)\s+([a-zA-Z_:][\w:]*)/g);
      for (const m of rsImports) imports.push(m[1].replace(/::/g, "/"));
      break;
    }
    case "go": {
      const goImports = content.matchAll(/"([^"]+)"/g);
      for (const m of goImports) {
        if (m[1].includes(".") || m[1].includes("/")) imports.push(m[1]);
      }
      break;
    }
  }

  return [...new Set(imports)];
}

function extractExports(content: string, lang: string): string[] {
  const exports: string[] = [];

  switch (lang) {
    case "typescript":
    case "tsx":
    case "javascript":
    case "jsx": {
      // export function/class/const/interface/type
      const exportDecl = content.matchAll(/export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum|abstract\s+class)\s+(\w+)/g);
      for (const m of exportDecl) exports.push(m[1]);
      // export { ... }
      const exportList = content.matchAll(/export\s*\{\s*([^}]+)\s*\}/g);
      for (const m of exportList) {
        for (const name of m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean)) {
          exports.push(name);
        }
      }
      // module.exports = ...
      // Not parsing for now — too many patterns
      break;
    }
    case "python": {
      const pyExport = content.matchAll(/^(?:async\s+)?def\s+(\w+)|^class\s+(\w+)/gm);
      for (const m of pyExport) exports.push(m[1] || m[2]);
      break;
    }
    case "rust": {
      const rsPub = content.matchAll(/pub\s+(?:fn|struct|enum|trait|type|const|mod)\s+(\w+)/g);
      for (const m of rsPub) exports.push(m[1]);
      break;
    }
    case "go": {
      const goExport = content.matchAll(/^func\s+([A-Z]\w+)|^type\s+([A-Z]\w+)/gm);
      for (const m of goExport) exports.push(m[1] || m[2]);
      break;
    }
  }

  return [...new Set(exports)];
}

function extractFunctions(lines: string[], lang: string): { name: string; line: number }[] {
  const functions: { name: string; line: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpMatchArray | null = null;

    switch (lang) {
      case "typescript":
      case "tsx":
      case "javascript":
      case "jsx":
        match = line.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(|(\w+)\s*\([^)]*\)\s*{)/);
        break;
      case "python":
        match = line.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
        break;
      case "rust":
        match = line.match(/^(?:\s*pub\s+)?fn\s+(\w+)/);
        break;
      case "go":
        match = line.match(/^(?:\s*func\s+(?:\([^)]*\)\s+)?(\w+))/);
        break;
    }

    if (match) {
      const name = match[1] || match[2] || match[3];
      if (name) functions.push({ name, line: i + 1 });
    }
  }

  return functions;
}

function extractClasses(lines: string[], lang: string): { name: string; line: number }[] {
  const classes: { name: string; line: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpMatchArray | null = null;

    switch (lang) {
      case "typescript":
      case "tsx":
      case "javascript":
      case "jsx":
        match = line.match(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
        break;
      case "python":
        match = line.match(/^class\s+(\w+)/);
        break;
      case "rust":
        match = line.match(/^(?:\s*pub\s+)?(?:struct|enum|trait)\s+(\w+)/);
        break;
      case "go":
        match = line.match(/^type\s+(\w+)\s+(?:struct|interface)/);
        break;
    }

    if (match) {
      classes.push({ name: match[1], line: i + 1 });
    }
  }

  return classes;
}
