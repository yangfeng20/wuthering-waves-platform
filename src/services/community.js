import { safeAccount } from '../storage/credentials.js';

/**
 * 库街区社区数据服务。
 */
export class CommunityService {
  /**
   * @param {object} dependencies 服务依赖。
   */
  constructor({ accounts, communityApi }) {
    this.accounts = accounts;
    this.communityApi = communityApi;
  }

  /**
   * 获取社区上下文。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 账号上下文。
   */
  async context(accountId) {
    return this.accounts.context(accountId);
  }

  /**
   * 获取签到记录。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 签到记录。
   */
  async signInRecord(accountId) {
    const { account, bat } = await this.context(accountId);
    return { account: safeAccount(account), data: await this.accounts.gameApi.getSignInRecord(account, bat) };
  }

  /**
   * 获取社区任务状态。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 任务状态。
   */
  async taskStatus(accountId) {
    const account = await this.accounts.store.resolve(accountId);
    return { account: safeAccount(account), data: await this.communityApi.getTaskProcess(account.token) };
  }

  /**
   * 获取库洛币数量。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 库洛币数据。
   */
  async coin(accountId) {
    const account = await this.accounts.store.resolve(accountId);
    return { account: safeAccount(account), data: await this.communityApi.getCoin(account.token) };
  }

  /**
   * 获取社区帖子列表。
   * @returns {Promise<object>} 帖子数据。
   */
  async posts() {
    return this.communityApi.getPost();
  }
}
