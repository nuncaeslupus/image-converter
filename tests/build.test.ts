import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distIndex = resolve(root, "dist/index.html");

describe("production build", () => {
  it("test_viteBuild_defaultConfig_producesDistIndex", () => {
    rmSync(resolve(root, "dist"), { recursive: true, force: true });

    expect(() => execFileSync("npm", ["run", "build"], { cwd: root, stdio: "pipe" })).not.toThrow();

    expect(existsSync(distIndex)).toBe(true);
  }, 120_000);
});
