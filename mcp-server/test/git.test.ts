import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  mkdtemp: vi.fn(),
  rm: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  mkdtemp: fsMocks.mkdtemp,
  rm: fsMocks.rm,
  readFile: fsMocks.readFile,
  readdir: fsMocks.readdir,
}));

const sshMocks = vi.hoisted(() => ({
  ensureSshConfig: vi.fn(() => "/home/test/.ssh/config"),
  getSshCommand: vi.fn(() => "ssh -F /home/test/.ssh/config"),
}));

vi.mock("../src/config/ssh.js", () => sshMocks);

const gitMocks = vi.hoisted(() => {
  const clone = vi.fn();
  const env = vi.fn(() => ({ clone }));

  return { clone, env };
});

vi.mock("simple-git", () => ({
  simpleGit: vi.fn(() => ({
    env: gitMocks.env,
    clone: gitMocks.clone,
  })),
}));

import { tmpdir } from "os";
import { resolve } from "path";
import { cleanupRepo, cloneRepo, listFiles, readFile } from "../src/tools/git.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("git tools", () => {
  it("clona repositório com shallow clone", async () => {
    fsMocks.mkdtemp.mockResolvedValue("/tmp/troubleshooting-abc");
    gitMocks.clone.mockResolvedValue(undefined);

    const repoPath = await cloneRepo("git@github.com:org/app.git", "main");

    expect(repoPath).toBe("/tmp/troubleshooting-abc");
    expect(sshMocks.ensureSshConfig).toHaveBeenCalled();
    expect(gitMocks.env).toHaveBeenCalledWith(
      expect.objectContaining({ GIT_SSH_COMMAND: "ssh -F /home/test/.ssh/config" })
    );
    expect(gitMocks.clone).toHaveBeenCalledWith(
      "git@github.com:org/app.git",
      "/tmp/troubleshooting-abc",
      ["--depth", "1", "--branch", "main", "--single-branch"]
    );
  });

  it("limpa diretório temporário quando clone falha", async () => {
    fsMocks.mkdtemp.mockResolvedValue("/tmp/troubleshooting-fail");
    gitMocks.clone.mockRejectedValue(new Error("not found"));

    await expect(cloneRepo("git@github.com:org/app.git", "main")).rejects.toThrow(
      "Falha ao clonar repositório"
    );
    expect(fsMocks.rm).toHaveBeenCalledWith("/tmp/troubleshooting-fail", {
      recursive: true,
      force: true,
    });
  });

  it("impede path traversal ao ler arquivo", async () => {
    await expect(readFile("/tmp/troubleshooting-abc", "../secret")).rejects.toThrow(
      "Path traversal detectado"
    );
  });

  it("lê arquivo dentro do repositório", async () => {
    fsMocks.readFile.mockResolvedValue("conteudo");

    const result = await readFile("/tmp/troubleshooting-abc", "README.md");

    expect(result).toBe("conteudo");
    expect(fsMocks.readFile).toHaveBeenCalled();
  });

  it("lista arquivos com marcação de diretórios", async () => {
    fsMocks.readdir.mockResolvedValue([
      { name: "src", isDirectory: () => true },
      { name: "README.md", isDirectory: () => false },
    ]);

    const result = await listFiles("/tmp/troubleshooting-abc", "");

    expect(result).toEqual(["src/", "README.md"]);
  });

  it("faz cleanup apenas em diretório temporário", async () => {
    const repoPath = resolve(tmpdir(), "troubleshooting-clean");

    await cleanupRepo(repoPath);

    expect(fsMocks.rm).toHaveBeenCalledWith(repoPath, { recursive: true, force: true });
  });

  it("bloqueia cleanup fora do diretório temporário", async () => {
    await expect(cleanupRepo("/var/repos/app")).rejects.toThrow(
      "Cleanup apenas permitido para diretórios temporários"
    );
  });
});
