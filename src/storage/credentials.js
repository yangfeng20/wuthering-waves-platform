import fs from 'node:fs/promises';
import path from 'node:path';
import { CredentialError } from '../errors.js';

function safeAccount(account) {
  const { token, ...publicAccount } = account;
  return publicAccount;
}

/**
 * 本地账号凭据存储。
 */
export class CredentialStore {
  /**
   * @param {object} config 项目配置。
   */
  constructor(config) {
    this.config = config;
    this.filePath = config.credentialsPath;
  }

  /**
   * 初始化存储目录和文件。
   * @returns {Promise<void>}
   */
  async ensure() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.write({ version: 1, activeAccountId: null, accounts: [] });
    }
  }

  /**
   * 读取完整凭据。
   * @returns {Promise<object>}
   */
  async read() {
    await this.ensure();
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const data = JSON.parse(content);
      if (!Array.isArray(data.accounts)) data.accounts = [];
      return data;
    } catch (error) {
      throw new CredentialError('读取本地凭据失败', { path: this.filePath, cause: String(error) });
    }
  }

  /**
   * 写入完整凭据。
   * @param {object} data 凭据数据。
   * @returns {Promise<void>}
   */
  async write(data) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    try {
      await fs.chmod(this.filePath, 0o600);
    } catch {
      return;
    }
  }

  /**
   * 返回环境变量账号。
   * @returns {object|null} 环境变量账号。
   */
  getEnvironmentAccount() {
    if (!this.config.envToken) return null;
    return {
      id: this.config.envAccountId,
      label: '环境变量账号',
      token: this.config.envToken,
      userId: this.config.envUserId,
      serverId: this.config.envServerId,
      roleId: this.config.envRoleId,
      did: this.config.envDid,
      source: 'environment',
    };
  }

  /**
   * 列出账号, 默认隐藏 Token。
   * @returns {Promise<object[]>} 账号列表。
   */
  async list() {
    const data = await this.read();
    const accounts = data.accounts.map(safeAccount);
    const envAccount = this.getEnvironmentAccount();
    if (envAccount) accounts.unshift(safeAccount(envAccount));
    return accounts.map(account => ({ ...account, active: account.id === data.activeAccountId }));
  }

  /**
   * 获取完整账号。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 账号。
   */
  async resolve(accountId) {
    const data = await this.read();
    const envAccount = this.getEnvironmentAccount();
    if (accountId === this.config.envAccountId && envAccount) return envAccount;
    const selectedId = accountId || data.activeAccountId;
    const account = data.accounts.find(item => item.id === selectedId);
    if (account) {
      if (!account.token) throw new CredentialError('账号缺少 Token, 请重新登录', { accountId: selectedId });
      return account;
    }
    if (!accountId && envAccount) return envAccount;
    throw new CredentialError('没有找到账号凭据, 请先登录或配置 WAVES_TOKEN', { accountId: selectedId });
  }

  /**
   * 保存账号并设置为当前账号。
   * @param {object} account 账号。
   * @returns {Promise<object>} 脱敏账号。
   */
  async upsert(account) {
    if (!account?.token) throw new CredentialError('不能保存空 Token');
    const data = await this.read();
    const normalized = {
      id: account.id || account.userId || `account-${Date.now()}`,
      label: account.label || account.userId || '鸣潮账号',
      token: account.token,
      userId: account.userId || '',
      serverId: account.serverId || '',
      roleId: account.roleId || '',
      did: account.did || '',
      source: account.source || 'local',
      updatedAt: new Date().toISOString(),
    };
    const index = data.accounts.findIndex(item => item.id === normalized.id);
    if (index >= 0) data.accounts[index] = { ...data.accounts[index], ...normalized };
    else data.accounts.push(normalized);
    data.activeAccountId = normalized.id;
    await this.write(data);
    return safeAccount(normalized);
  }

  /**
   * 设置当前账号。
   * @param {string} accountId 账号 ID。
   * @returns {Promise<object>} 脱敏账号。
   */
  async setActive(accountId) {
    const data = await this.read();
    if (!data.accounts.some(item => item.id === accountId) && accountId !== this.config.envAccountId) {
      throw new CredentialError('账号不存在', { accountId });
    }
    data.activeAccountId = accountId;
    await this.write(data);
    return this.resolve(accountId).then(safeAccount);
  }

  /**
   * 删除本地账号。
   * @param {string} accountId 账号 ID。
   * @returns {Promise<boolean>} 是否删除成功。
   */
  async remove(accountId) {
    const data = await this.read();
    const previous = data.accounts.length;
    data.accounts = data.accounts.filter(item => item.id !== accountId);
    if (data.activeAccountId === accountId) data.activeAccountId = data.accounts[0]?.id || null;
    await this.write(data);
    return previous !== data.accounts.length;
  }
}

export { safeAccount };
