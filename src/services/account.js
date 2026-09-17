import { CredentialError } from '../errors.js';
import { safeAccount } from '../storage/credentials.js';

function firstValue(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '');
}

/**
 * 账号服务。
 */
export class AccountService {
  /**
   * @param {object} dependencies 服务依赖。
   */
  constructor({ store, gameApi }) {
    this.store = store;
    this.gameApi = gameApi;
  }

  /**
   * 使用短信验证码登录并保存账号。
   * @param {object} input 登录参数。
   * @returns {Promise<object>} 脱敏账号。
   */
  async loginBySms(input) {
    if (!input?.mobile || !input?.code) throw new CredentialError('手机号和验证码不能为空');
    const data = await this.gameApi.loginBySms(input.mobile, input.code);
    return this.finishLogin({
      token: data.token,
      userId: data.userId,
      serverId: data.serverId,
      roleId: data.roleId,
      did: data.did,
      accountId: input.accountId,
      label: input.label,
    });
  }

  /**
   * 使用已有 Token 登录并保存账号。
   * @param {object} input 登录参数。
   * @returns {Promise<object>} 脱敏账号。
   */
  async loginByToken(input) {
    if (!input?.token) throw new CredentialError('Token 不能为空');
    return this.finishLogin({
      token: input.token,
      userId: input.userId,
      serverId: input.serverId,
      roleId: input.roleId,
      did: input.did,
      accountId: input.accountId,
      label: input.label,
    });
  }

  /**
   * 完成登录并补充游戏角色元数据。
   * @param {object} input 登录数据。
   * @returns {Promise<object>} 脱敏账号。
   */
  async finishLogin(input) {
    if (!input.token) throw new CredentialError('登录接口没有返回 Token');
    let account = {
      id: input.accountId || input.userId || `account-${Date.now()}`,
      label: input.label || input.userId || '鸣潮账号',
      token: input.token,
      userId: input.userId || '',
      serverId: input.serverId || '',
      roleId: input.roleId || '',
      did: input.did || '',
    };

    if (!account.userId || !account.serverId || !account.roleId) {
      const gameData = await this.gameApi.getGameData(account.token, null, account.did || null);
      account = {
        ...account,
        userId: firstValue(gameData.userId, gameData.uid, gameData.roleId, account.userId),
        serverId: firstValue(gameData.serverId, gameData.server, account.serverId),
        roleId: firstValue(gameData.roleId, gameData.playerId, account.roleId),
      };
    }

    if (!account.serverId || !account.roleId) {
      throw new CredentialError('无法从账号获取 serverId 或 roleId, 请手动提供这两个字段');
    }
    return this.store.upsert(account);
  }

  /**
   * 列出本地账号。
   * @returns {Promise<object[]>} 脱敏账号列表。
   */
  async list() {
    return this.store.list();
  }

  /**
   * 设置当前账号。
   * @param {string} accountId 账号 ID。
   * @returns {Promise<object>} 脱敏账号。
   */
  async setActive(accountId) {
    return this.store.setActive(accountId);
  }

  /**
   * 删除本地账号。
   * @param {string} accountId 账号 ID。
   * @returns {Promise<boolean>} 是否删除。
   */
  async remove(accountId) {
    return this.store.remove(accountId);
  }

  /**
   * 解析账号并请求访问令牌。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 账号上下文。
   */
  async context(accountId) {
    const account = await this.store.resolve(accountId);
    if (!account.serverId || !account.roleId) {
      throw new CredentialError('账号缺少 serverId 或 roleId, 请重新登录');
    }
    const access = await this.gameApi.requestAccessToken(account);
    return { account, bat: access.bat };
  }

  async diagnose(accountId) {
    const context = await this.context(accountId);
    const { account, bat } = context;
    const result = {
      account: safeAccount(account),
      tokenValid: Boolean(bat),
      daily: null,
      boundRoles: null,
      selectedRoleMatches: false,
      roleData: null,
      baseData: null,
      suggestions: [],
    };

    try {
      const daily = await this.gameApi.getGameData(account.token, null, account.did || null);
      result.daily = {
        ok: true,
        userId: daily.userId,
        serverId: daily.serverId,
        roleId: daily.roleId,
        roleName: daily.roleName,
      };
    } catch (error) {
      result.daily = { ok: false, message: error instanceof Error ? error.message : String(error) };
    }

    try {
      const roles = await this.gameApi.getBoundRoles(account.token, account.did || null);
      result.boundRoles = roles.map(role => ({
        userId: role.userId,
        serverId: role.serverId,
        roleId: role.roleId,
        roleName: role.roleName,
        isDefault: role.isDefault,
      }));
      result.selectedRoleMatches = roles.some(role => String(role.roleId) === String(account.roleId) && String(role.serverId) === String(account.serverId));
    } catch (error) {
      result.boundRoles = { ok: false, message: error instanceof Error ? error.message : String(error) };
    }

    for (const [key, loader] of [['roleData', () => this.gameApi.getRoleData(account, bat)], ['baseData', () => this.gameApi.getBaseData(account, bat)]]) {
      try {
        const data = await loader();
        result[key] = { ok: true, keys: Object.keys(data || {}) };
      } catch (error) {
        result[key] = {
          ok: false,
          code: error?.details?.code,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }

    if (!account.did) result.suggestions.unshift('当前凭据没有 did。原版登录只保存 Token, 不能保证与其他设备共存。请使用本项目重新短信登录, 并避免同时在库街区 App 或其他插件登录。');
    if (result.tokenValid && result.daily?.ok && result.selectedRoleMatches && !result.roleData?.ok) {
      result.suggestions.push('Token 和 serverId/roleId 已通过基础校验, 角色详情接口仍拒绝查询。请在库街区 App 重新选择当前鸣潮角色, 并打开角色面板/数据终端的对外展示开关。');
    }
    if (!result.tokenValid) result.suggestions.push('Token 无效, 请重新登录。');
    if (result.boundRoles && !result.selectedRoleMatches) result.suggestions.push('本地保存的角色与库街区绑定角色不一致, 请重新登录或切换角色。');
    return result;
  }

  /**
   * 检查账号 Token。
   * @param {string|undefined} accountId 账号 ID。
   * @returns {Promise<object>} 检查结果。
   */
  async validate(accountId) {
    const context = await this.context(accountId);
    return {
      valid: true,
      account: safeAccount(context.account),
      accessTokenReady: Boolean(context.bat),
    };
  }
}
