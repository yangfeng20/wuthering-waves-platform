import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), '.env'));
loadEnvFile(path.join(projectRoot, '.env'));

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * 创建通用项目配置。
 * @returns {object} 项目配置。
 */
export function createConfig() {
  const dataDir = process.env.WAVES_DATA_DIR || path.join(os.homedir(), '.waves-platform');
  return {
    projectRoot,
    resourceRoot: path.join(projectRoot, 'resources'),
    dataDir: path.resolve(dataDir),
    credentialsPath: path.resolve(dataDir, 'credentials.json'),
    apiBaseUrl: process.env.WAVES_API_BASE_URL || 'https://api.kurobbs.com',
    proxyUrl: process.env.WAVES_PROXY_URL || '',
    timeout: numberEnv('WAVES_HTTP_TIMEOUT', 30000),
    maxConcurrency: Math.max(1, numberEnv('WAVES_MAX_CONCURRENCY', 3)),
    logLevel: process.env.WAVES_LOG_LEVEL || 'info',
    userAgent: process.env.WAVES_USER_AGENT || 'wuthering-waves-platform/0.1.0',
    envToken: process.env.WAVES_TOKEN || '',
    envUserId: process.env.WAVES_USER_ID || '',
    envServerId: process.env.WAVES_SERVER_ID || '',
    envRoleId: process.env.WAVES_ROLE_ID || '',
    envDid: process.env.WAVES_DID || '',
    envAccountId: process.env.WAVES_ACCOUNT_ID || 'env',
  };
}
