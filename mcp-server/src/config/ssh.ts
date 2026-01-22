import { execFileSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

const DEFAULT_GITHUB_KEY = "~/.ssh/github_deploy_key";
const DEFAULT_AZURE_KEY = "~/.ssh/azure_deploy_key";
const DEFAULT_SSH_CONFIG = "~/.ssh/config";

function resolveHomePath(pathValue: string): string {
  if (pathValue.startsWith("~/")) {
    return join(homedir(), pathValue.slice(2));
  }
  if (pathValue === "~") {
    return homedir();
  }
  return pathValue;
}

function getGithubKeyPath(): string {
  return resolveHomePath(
    process.env.GITHUB_SSH_KEY_PATH ?? process.env.SSH_PRIVATE_KEY_PATH ?? DEFAULT_GITHUB_KEY
  );
}

function getAzureKeyPath(): string {
  return resolveHomePath(process.env.AZURE_SSH_KEY_PATH ?? DEFAULT_AZURE_KEY);
}

function getConfigPath(): string {
  return resolveHomePath(process.env.SSH_CONFIG_PATH ?? DEFAULT_SSH_CONFIG);
}

export function getSSHConfig(): string {
  const githubKeyPath = getGithubKeyPath();
  const azureKeyPath = getAzureKeyPath();

  return `Host github.com
  IdentityFile ${githubKeyPath}
  StrictHostKeyChecking no

Host ssh.dev.azure.com
  IdentityFile ${azureKeyPath}
  StrictHostKeyChecking no
`;
}

export function ensureSshConfig(): string {
  const configPath = getConfigPath();
  const configDir = dirname(configPath);

  mkdirSync(configDir, { recursive: true, mode: 0o700 });

  if (!existsSync(configPath)) {
    writeFileSync(configPath, getSSHConfig(), { mode: 0o600 });
  }

  return configPath;
}

export function getSshCommand(configPath?: string): string {
  const resolvedConfigPath = configPath ?? ensureSshConfig();
  return `ssh -F ${resolvedConfigPath}`;
}

export function setupSSHAgent(): void {
  const keys = [getGithubKeyPath(), getAzureKeyPath()].filter((key) => existsSync(key));

  if (keys.length === 0) {
    return;
  }

  for (const key of keys) {
    try {
      execFileSync("ssh-add", [key], { stdio: "ignore" });
    } catch (error) {
      console.warn("SSH key não adicionada ao agent:", error);
    }
  }
}
