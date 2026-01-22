import { mkdtemp, mkdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { simpleGit } from "simple-git";
import { cleanupRepo, cloneRepo, listFiles, readFile } from "../src/tools/git.js";

const tempRoots: string[] = [];
const previousSshConfigPath = process.env.SSH_CONFIG_PATH;

afterEach(async () => {
  const cleanupTasks = tempRoots.splice(0, tempRoots.length).map((path) =>
    rm(path, { recursive: true, force: true })
  );

  await Promise.all(cleanupTasks);

  if (previousSshConfigPath === undefined) {
    delete process.env.SSH_CONFIG_PATH;
  } else {
    process.env.SSH_CONFIG_PATH = previousSshConfigPath;
  }
});

describe("git tools (integração)", () => {
  it("clona repositório local e permite leitura/listagem", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "git-tools-"));
    tempRoots.push(tempRoot);

    const sourceRepo = join(tempRoot, "source-repo");
    await mkdir(sourceRepo, { recursive: true });

    const git = simpleGit(sourceRepo);
    await git.raw(["init", "--initial-branch=main"]);
    await git.addConfig("user.name", "test");
    await git.addConfig("user.email", "test@example.com");

    await writeFile(join(sourceRepo, "README.md"), "conteudo");
    await git.add(["README.md"]);
    await git.commit("init");

    process.env.SSH_CONFIG_PATH = join(tempRoot, "ssh_config");

    const repoPath = await cloneRepo(sourceRepo, "main");
    try {
      const content = await readFile(repoPath, "README.md");
      expect(content).toBe("conteudo");

      const entries = await listFiles(repoPath, "");
      expect(entries).toContain("README.md");
    } finally {
      await cleanupRepo(repoPath);
    }
  });
});