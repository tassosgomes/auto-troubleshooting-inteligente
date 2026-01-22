import { simpleGit, SimpleGit } from "simple-git";
import { mkdtemp, readFile as fsReadFile, readdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { basename, join, resolve, sep } from "path";
import { ensureSshConfig, getSshCommand } from "../config/ssh.js";

const CLONE_TIMEOUT_MS = 30_000;
const TEMP_DIR_PREFIX = "troubleshooting-";

function resolveInsideRoot(rootPath: string, targetPath: string): string {
  const resolvedRoot = resolve(rootPath);
  const resolvedTarget = resolve(rootPath, targetPath);

  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + sep)) {
    throw new Error("Path traversal detectado");
  }

  return resolvedTarget;
}

function isTempRepoPath(repoPath: string): boolean {
  const resolvedRepoPath = resolve(repoPath);
  const resolvedTmpDir = resolve(tmpdir());
  const repoBaseName = basename(resolvedRepoPath);

  return (
    repoBaseName.startsWith(TEMP_DIR_PREFIX) &&
    resolvedRepoPath.startsWith(resolvedTmpDir + sep)
  );
}

export async function cloneRepo(repoUrl: string, branch: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), TEMP_DIR_PREFIX));
  ensureSshConfig();

  const git: SimpleGit = simpleGit({
    timeout: { block: CLONE_TIMEOUT_MS },
  });

  const cloneOptions = ["--depth", "1", "--branch", branch, "--single-branch"];
  const gitEnv = {
    ...process.env,
    GIT_SSH_COMMAND: getSshCommand(),
  };

  try {
    await git.env(gitEnv).clone(repoUrl, tempDir, cloneOptions);
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Falha ao clonar repositório: ${message}`);
  }

  return tempDir;
}

export async function readFile(repoPath: string, filePath: string): Promise<string> {
  const fullPath = resolveInsideRoot(repoPath, filePath);
  return fsReadFile(fullPath, "utf-8");
}

export async function listFiles(
  repoPath: string,
  directory: string
): Promise<string[]> {
  const targetPath = resolveInsideRoot(repoPath, directory || ".");
  const entries = await readdir(targetPath, { withFileTypes: true });

  return entries.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
}

export async function cleanupRepo(repoPath: string): Promise<void> {
  if (!isTempRepoPath(repoPath)) {
    throw new Error("Cleanup apenas permitido para diretórios temporários");
  }

  await rm(repoPath, { recursive: true, force: true });
}
