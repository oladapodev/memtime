import type { CodebaseDoc } from "./types";

/**
 * AI-generated codebase documentation from scanned files.
 * Uses Workers AI to produce structured markdown docs.
 *
 * 8 doc types:
 * - ARCHITECTURE — high-level system design
 * - FILES — file map with purpose of each file
 * - CONVENTIONS — code style and patterns
 * - DOMAIN — business domain model
 * - API — API route/endpoint reference
 * - DB_SCHEMA — database schema
 * - DEPLOYMENT — deploy config and instructions
 * - GLOSSARY — key terms and abbreviations
 */

type FileSummary = {
  path: string;
  language: string;
  exports: string[];
  functions: string[];
  classes: string[];
  imports: string[];
};

type GeneratorInput = {
  repoId: string;
  defaultBranch: string;
  fileCount: number;
  languages: Record<string, number>;
  files: FileSummary[];
  dependencySummary: { totalEdges: number; externalDeps: string[] };
};

/**
 * Generate all 8 codebase docs for a repo.
 */
export async function generateCodebaseDocs(
  ai: { run: (model: string, inputs: { prompt: string; stream?: boolean }) => Promise<{ response?: string } | ReadableStream> },
  input: GeneratorInput,
): Promise<CodebaseDoc[]> {
  const docTypes: CodebaseDoc["docType"][] = [
    "ARCHITECTURE",
    "FILES",
    "CONVENTIONS",
    "DOMAIN",
    "API",
    "DB_SCHEMA",
    "DEPLOYMENT",
    "GLOSSARY",
  ];

  const docs: CodebaseDoc[] = [];
  const version = 1;

  for (const docType of docTypes) {
    try {
      const prompt = buildPrompt(docType, input);
      const response = await ai.run("@cf/meta/llama-4-scout", { prompt, stream: false });

      // Handle streaming vs non-streaming response
      let content = "";
      if (response && typeof response === "object" && "response" in response) {
        content = (response as { response?: string }).response ?? "";
      }

      if (content) {
        docs.push({
          repoId: input.repoId,
          docType,
          content: content.trim(),
          version,
        });
      }
    } catch (error) {
      // Don't fail the whole index if one doc fails
      console.error(`Failed to generate ${docType} doc:`, error);
    }
  }

  return docs;
}

function buildPrompt(docType: CodebaseDoc["docType"], input: GeneratorInput): string {
  const fileTable = input.files
    .slice(0, 50) // Limit context to avoid token overflow
    .map((f) => {
      const parts = [`- \`${f.path}\` (${f.language})`];
      if (f.exports.length > 0) parts.push(`  exports: ${f.exports.slice(0, 5).join(", ")}`);
      if (f.functions.length > 0) parts.push(`  functions: ${f.functions.slice(0, 5).join(", ")}`);
      if (f.classes.length > 0) parts.push(`  classes: ${f.classes.slice(0, 3).join(", ")}`);
      return parts.join("\n");
    })
    .join("\n");

  const prompts: Record<string, string> = {
    ARCHITECTURE: `You are analyzing a codebase for ForkBot, a PR review bot. Based on the file listing below, generate a high-level ARCHITECTURE document in Markdown.

Repository: ${input.repoId}
Default branch: ${input.defaultBranch}
Total files: ${input.fileCount}
Languages: ${Object.entries(input.languages).map(([l, c]) => `${l} (${c})`).join(", ")}

Files:
${fileTable}

Generate an ARCHITECTURE.md covering:
1. **Overview** — what this project does (infer from file names and structure)
2. **Directory structure** — purpose of each top-level directory
3. **Key modules** — the main entry points and their responsibilities
4. **Data flow** — how data moves through the system
5. **External dependencies** — notable libraries and services used

Output only valid Markdown.`,

    FILES: `You are analyzing a codebase. Based on the file listing, generate a FILES.md document describing the purpose of each important file.

Repository: ${input.repoId}
Total files: ${input.fileCount}

Files:
${fileTable}

Generate FILES.md that lists each file with a brief description of its purpose. Group by directory. Focus on source files (not config). Output only valid Markdown.`,

    CONVENTIONS: `Based on the codebase structure below, infer code conventions and patterns used in this project.

Repository: ${input.repoId}
Languages: ${Object.entries(input.languages).map(([l, c]) => `${l} (${c})`).join(", ")}

Files:
${fileTable}

Generate CONVENTIONS.md covering:
1. **Naming conventions** — how variables, functions, classes are named
2. **File organization** — how code is structured across files
3. **Import patterns** — how dependencies are imported
4. **Testing patterns** — how tests are organized (infer from file names)
5. **Code style** — noticeable patterns (functional, OOP, etc.)

Output only valid Markdown.`,

    DOMAIN: `Infer the business domain of this codebase from its structure.

Repository: ${input.repoId}

Files:
${fileTable}

Generate DOMAIN.md covering:
1. **Domain model** — key entities and their relationships
2. **Core concepts** — main ideas the codebase deals with
3. **Module boundaries** — how the domain is split across packages

Output only valid Markdown.`,

    API: `Based on the codebase structure, infer the API surface of this project.

Repository: ${input.repoId}

Files:
${fileTable}

Look for route handlers, controllers, endpoints in file paths and exports.
Generate API.md listing likely API endpoints and their purposes.

Output only valid Markdown.`,

    DB_SCHEMA: `Based on the codebase structure, infer the database schema used.

Repository: ${input.repoId}

Files:
${fileTable}

Generate DB_SCHEMA.md listing likely tables, their relationships, and key fields.
Look for SQL files, ORM models, migrations, and schema definitions.

Output only valid Markdown.`,

    DEPLOYMENT: `Infer the deployment configuration of this project.

Repository: ${input.repoId}

Files:
${fileTable}

Generate DEPLOYMENT.md covering:
1. **Hosting platform** (infer from config files)
2. **Build process** 
3. **Environment requirements**
4. **Deploy commands**

Output only valid Markdown.`,

    GLOSSARY: `Based on the codebase structure, create a glossary of key terms.

Repository: ${input.repoId}

Files:
${fileTable}

Generate GLOSSARY.md defining key domain and technical terms used in this codebase.
Look at package names, class names, function names, and file paths for terminology.

Output only valid Markdown.`,
  };

  return prompts[docType] ?? "Generate documentation about this codebase.";
}
