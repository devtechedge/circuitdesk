import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "coverage",
  "playwright-report",
  "test-results",
]);

const TEXT_EXTENSIONS = /\.(ts|tsx|js|mjs|md|sql|json|yml|yaml|css)$/i;

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkFiles(full, acc);
    } else if (TEXT_EXTENSIONS.test(name) && name !== "pnpm-lock.yaml") {
      acc.push(full);
    }
  }
  return acc;
}

describe("public repository hygiene invariants", () => {
  const root = process.cwd();
  const selfRel = "tests/unit/public-text-hygiene.test.ts";
  const files = walkFiles(root).filter(
    (f) => relative(root, f).replace(/\\/g, "/") !== selfRel
  );

  it("contains zero em dashes anywhere in source, docs, SQL, or workflows", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      if (content.includes("\u2014")) {
        offenders.push(relative(root, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("contains zero forbidden audience framing phrases or live secret prefixes", () => {
    const forbidden = [
      "hiring manager",
      "hiring-manager",
      "recruiter",
      "recruiters",
      "portfolio piece",
      "job-application project",
      "built for a job posting",
      "sk_live_",
      "rzp_live_",
      "shpat_",
    ];

    const hits: string[] = [];
    for (const file of files) {
      const lower = readFileSync(file, "utf8").toLowerCase();
      for (const term of forbidden) {
        if (lower.includes(term)) {
          hits.push(`${relative(root, file)} -> ${term}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
