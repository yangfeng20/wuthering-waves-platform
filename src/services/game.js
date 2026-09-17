import pLimit from 'p-limit';
import { safeAccount } from '../storage/credentials.js';

function matchCharacter(role, selector) {
  if (!selector) return false;
  const value = String(selector).trim();
  return String(role.roleId) === value || String(role.mapRoleId || '') === value || role.roleName === value || role.roleName?.includes(value);
}

/**
 * 游戏数据服务。
 */
export class GameDataService {
  /**
   * @param {object} dependencies 服务依赖。
   */
  constructor({ accounts, gameApi, analyzer, config }) {
    this.accounts = accounts;
    this.gameApi = gameApi;
    this.analyzer = analyzer;
    this.config = config;
  }

  /**
   * 获取账号上下文。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 上下文。
   */
  async context(accountId) {
    return this.accounts.context(accountId);
  }

  /**
   * 获取日常数据。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 日常数据。
   */
  async daily(accountId) {
    const { account, bat } = await this.context(accountId);
    return { account: safeAccount(account), data: await this.gameApi.getGameData(account.token, bat, account.did || null) };
  }

  /**
   * 获取账号基础资料。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 基础资料。
   */
  async base(accountId) {
    const { account, bat } = await this.context(accountId);
    return { account: safeAccount(account), data: await this.gameApi.getBaseData(account, bat) };
  }

  /**
   * 获取角色列表。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 角色列表。
   */
  async characters(accountId) {
    const { account, bat } = await this.context(accountId);
    const data = await this.gameApi.getRoleData(account, bat);
    return {
      account: safeAccount(account),
      characters: data.roleList || [],
      displayedRoleIds: data.showRoleIdList || [],
      raw: data,
    };
  }

  /**
   * 查找角色。
   * @param {object[]} roles 角色列表。
   * @param {string} selector 角色名称或 ID。
   * @returns {object} 角色。
   */
  findCharacter(roles, selector) {
    const role = roles.find(item => matchCharacter(item, selector));
    if (!role) throw new Error(`没有找到角色: ${selector}`);
    return role;
  }

  /**
   * 获取单个角色培养数据。
   * @param {string|undefined} accountId 账号 ID。
   * @param {string} selector 角色名称或 ID。
   * @returns {Promise<object>} 角色培养数据。
   */
  async characterBuild(accountId, selector) {
    const { account, bat } = await this.context(accountId);
    const roleData = await this.gameApi.getRoleData(account, bat);
    const role = this.findCharacter(roleData.roleList || [], selector);
    const detail = await this.gameApi.getRoleDetail(account, role.roleId, bat);
    return {
      account: safeAccount(account),
      character: role,
      build: this.analyzer.decorateBuild(detail),
      raw: detail,
    };
  }

  /**
   * 获取所有角色培养数据。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 全角色培养数据。
   */
  async allBuilds(accountId) {
    const { account, bat } = await this.context(accountId);
    const roleData = await this.gameApi.getRoleData(account, bat);
    const limit = pLimit(this.config.maxConcurrency);
    const results = await Promise.all((roleData.roleList || []).map(role => limit(async () => {
      try {
        const detail = await this.gameApi.getRoleDetail(account, role.roleId, bat);
        return {
          ok: true,
          character: role,
          build: this.analyzer.decorateBuild(detail),
          raw: detail,
        };
      } catch (error) {
        return { ok: false, character: role, error: error instanceof Error ? error.message : String(error) };
      }
    })));
    return {
      account: safeAccount(account),
      characters: results,
      summary: this.analyzer.summarizeBuilds(results),
      rawRoleData: roleData,
    };
  }

  /**
   * 获取数据坞。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 数据坞数据。
   */
  async calabash(accountId) {
    const { account, bat } = await this.context(accountId);
    return { account: safeAccount(account), data: await this.gameApi.getCalabashData(account, bat) };
  }

  /**
   * 获取探索数据。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 探索数据。
   */
  async explore(accountId) {
    const { account, bat } = await this.context(accountId);
    return { account: safeAccount(account), data: await this.gameApi.getExploreData(account, bat) };
  }

  /**
   * 获取挑战数据。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 挑战数据。
   */
  async challenge(accountId) {
    const { account, bat } = await this.context(accountId);
    return { account: safeAccount(account), data: await this.gameApi.getChallengeData(account, bat) };
  }

  /**
   * 获取逆境深塔数据。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 深塔数据。
   */
  async tower(accountId) {
    const { account, bat } = await this.context(accountId);
    return { account: safeAccount(account), data: await this.gameApi.getTowerData(account, bat) };
  }

  /**
   * 获取账号综合快照。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 综合快照。
   */
  async snapshot(accountId) {
    const results = await Promise.allSettled([
      this.base(accountId),
      this.daily(accountId),
      this.characters(accountId),
    ]);
    const [baseResult, dailyResult, charactersResult] = results;
    const firstValue = results.find(result => result.status === 'fulfilled')?.value;
    const account = firstValue?.account || safeAccount(await this.accounts.store.resolve(accountId));
    const errorOf = result => result.status === 'rejected'
      ? { message: result.reason instanceof Error ? result.reason.message : String(result.reason), code: result.reason?.code }
      : null;
    return {
      account,
      base: baseResult.status === 'fulfilled' ? baseResult.value.data : null,
      daily: dailyResult.status === 'fulfilled' ? dailyResult.value.data : null,
      characters: charactersResult.status === 'fulfilled' ? charactersResult.value.characters : null,
      errors: {
        base: errorOf(baseResult),
        daily: errorOf(dailyResult),
        characters: errorOf(charactersResult),
      },
    };
  }
}
