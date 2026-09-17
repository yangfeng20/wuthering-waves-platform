import { assertCode, parseData, randomDeviceCode } from './helpers.js';

const PATHS = {
  login: '/user/sdkLogin',
  refreshData: '/aki/roleBox/akiBox/refreshData',
  requestToken: '/aki/roleBox/requestToken',
  boundRoles: '/gamer/role/list',
  gameData: '/gamer/widget/game3/refresh',
  baseData: '/aki/roleBox/akiBox/baseData',
  roleData: '/aki/roleBox/akiBox/roleData',
  calabashData: '/aki/roleBox/akiBox/calabashData',
  challengeData: '/aki/roleBox/akiBox/challengeDetails',
  exploreData: '/aki/roleBox/akiBox/exploreIndex',
  signInRecord: '/encourage/signIn/queryRecordV2',
  roleDetail: '/aki/roleBox/akiBox/getRoleDetail',
  eventList: '/forum/companyEvent/findEventList',
  towerData: '/aki/roleBox/akiBox/towerDataDetail',
  towerIndex: '/aki/roleBox/akiBox/towerIndex',
};

const IOS_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) KuroGameBox/2.9.1';

/**
 * 鸣潮游戏数据 API 客户端。
 */
export class GameApiClient {
  /**
   * @param {import('./client.js').HttpClient} http HTTP 客户端。
   */
  constructor(http) {
    this.http = http;
    this.publicIp = null;
    this.publicIpPromise = null;
  }

  /**
   * 获取对外 IP, 用于构造库街区设备请求头。
   * @returns {Promise<string>} 对外 IP。
   */
  async getPublicIp() {
    if (this.publicIp) return this.publicIp;
    if (this.publicIpPromise) return this.publicIpPromise;
    this.publicIpPromise = (async () => {
      const sources = [
        async () => (await fetch('https://event.kurobbs.com/event/ip', { signal: AbortSignal.timeout(4000) })).text(),
        async () => (await (await fetch('https://api.ipify.org/?format=json', { signal: AbortSignal.timeout(4000) })).json()).ip,
        async () => (await (await fetch('https://httpbin.org/ip', { signal: AbortSignal.timeout(4000) })).json()).origin,
      ];
      for (const source of sources) {
        try {
          const ip = String(await source()).trim();
          if (ip) {
            this.publicIp = ip;
            return ip;
          }
        } catch {
          continue;
        }
      }
      this.publicIp = '192.168.0.1';
      return this.publicIp;
    })();
    try {
      return await this.publicIpPromise;
    } finally {
      this.publicIpPromise = null;
    }
  }

  /**
   * 构造库街区请求头。
   * @param {'ios'|'android'|'web'} platform 平台。
   * @param {string|null} token Token。
   * @param {string|null} did 设备标识。
   * @param {boolean} needToken 是否发送 token 请求头。
   * @param {string|null} bat 游戏访问令牌。
   * @returns {Promise<object>} 请求头。
   */
  async buildHeaders(platform = 'ios', token = null, did = null, needToken = false, bat = null) {
    const headers = {
      source: platform,
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      version: '2.9.1',
    };

    if (platform === 'ios') {
      headers['User-Agent'] = IOS_USER_AGENT;
      const ip = await this.getPublicIp();
      headers.devCode = `${ip}, ${IOS_USER_AGENT}`;
    } else if (platform === 'android') {
      headers['User-Agent'] = 'okhttp/3.11.0';
      headers.osVersion = '35';
      headers.model = 'V2243A';
      headers.versionCode = '2500';
      headers.channelId = '6';
      headers.lang = 'zh-Hans';
      headers.countryCode = 'CN';
      if (token) headers.Cookie = `user_token=${token}`;
    }

    if (did) headers.did = did;
    if (bat) headers['b-at'] = bat;
    if (needToken && token) headers.token = token;
    return headers;
  }

  /**
   * 使用手机号验证码登录库街区。
   * @param {string} mobile 手机号。
   * @param {string} code 验证码。
   * @returns {Promise<object>} 登录结果, 包含 token 和 did。
   */
  async loginBySms(mobile, code) {
    const did = randomDeviceCode();
    const headers = await this.buildHeaders('ios');
    const response = await this.http.postForm(
      PATHS.login,
      { mobile, code, devCode: did },
      headers,
    );
    assertCode(response, [200], '验证码登录');
    return { ...response.data, did };
  }

  /**
   * 请求游戏访问令牌。
   * @param {object} account 账号信息。
   * @returns {Promise<object>} 访问令牌结果。
   */
  async requestAccessToken(account) {
    const headers = await this.buildHeaders('ios', account.token, account.did || null, true);
    const response = await this.http.postForm(
      PATHS.requestToken,
      { serverId: account.serverId, roleId: account.roleId },
      headers,
    );
    if (response.code === 220) throw new Error('账号 Token 已失效, 请重新登录');
    assertCode(response, [200, 10902], '请求游戏访问令牌');
    const parsed = parseData(response.data);
    return { bat: parsed?.accessToken || parsed?.token || parsed, response };
  }

  /**
   * 获取账号绑定的鸣潮角色列表。
   * @param {string} token Token。
   * @param {string|null} did 设备标识。
   * @returns {Promise<object[]>} 绑定角色列表。
   */
  async getBoundRoles(token, did = null) {
    const headers = await this.buildHeaders('android', token, did, true);
    const response = await this.http.postForm(PATHS.boundRoles, { gameId: 3 }, headers);
    assertCode(response, [200], '获取绑定角色');
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * 获取日常数据。
   * @param {string} token Token。
   * @param {string|null} bat 访问令牌。
   * @param {string|null} did 设备标识。
   * @returns {Promise<object>} 日常数据。
   */
  async getGameData(token, bat = null, did = null) {
    const headers = await this.buildHeaders('ios', token, did, true, bat);
    const response = await this.http.postForm(PATHS.gameData, { type: '2', sizeType: '1' }, headers);
    assertCode(response, [200], '获取日常数据');
    if (response.data === null) throw new Error('日常数据为空, 请检查库街区数据展示开关');
    return response.data;
  }

  /**
   * 刷新账号资料并获取 b-at。
   * @param {object} account 账号信息。
   * @param {string} bat 访问令牌。
   * @returns {Promise<object>} 刷新结果。
   */
  async refreshData(account, bat) {
    const headers = await this.buildHeaders('ios', account.token, account.did || null, false, bat);
    const response = await this.http.postForm(
      PATHS.refreshData,
      { gameId: 3, serverId: account.serverId, roleId: account.roleId },
      headers,
    );
    assertCode(response, [10902, 200], '刷新账号资料');
    return parseData(response.data);
  }

  /**
   * 获取账号基础资料。
   * @param {object} account 账号信息。
   * @param {string} bat 访问令牌。
   * @returns {Promise<object>} 基础资料。
   */
  async getBaseData(account, bat) {
    await this.refreshData(account, bat);
    const headers = await this.buildHeaders('ios', account.token, account.did || null, false, bat);
    const response = await this.http.postForm(
      PATHS.baseData,
      { gameId: 3, serverId: account.serverId, roleId: account.roleId },
      headers,
    );
    assertCode(response, [10902, 200], '获取账号基础资料');
    const data = parseData(response.data);
    if (!data || data.showToGuest === false) throw new Error('账号基础资料未开放展示');
    return data;
  }

  /**
   * 获取角色列表。
   * @param {object} account 账号信息。
   * @param {string} bat 访问令牌。
   * @returns {Promise<object>} 角色列表。
   */
  async getRoleData(account, bat) {
    await this.refreshData(account, bat);
    const headers = await this.buildHeaders('ios', account.token, account.did || null, false, bat);
    const response = await this.http.postForm(
      PATHS.roleData,
      { gameId: 3, serverId: account.serverId, roleId: account.roleId },
      headers,
    );
    assertCode(response, [10902, 200], '获取角色列表');
    const data = parseData(response.data);
    if (!data || data.showToGuest === false) throw new Error('角色数据未开放展示');
    return data;
  }

  /**
   * 获取数据坞。
   * @param {object} account 账号信息。
   * @param {string} bat 访问令牌。
   * @returns {Promise<object>} 数据坞数据。
   */
  async getCalabashData(account, bat) {
    await this.refreshData(account, bat);
    const headers = await this.buildHeaders('ios', account.token, account.did || null, false, bat);
    const response = await this.http.postForm(
      PATHS.calabashData,
      { gameId: 3, serverId: account.serverId, roleId: account.roleId },
      headers,
    );
    assertCode(response, [10902, 200], '获取数据坞');
    return parseData(response.data);
  }

  /**
   * 获取挑战数据。
   * @param {object} account 账号信息。
   * @param {string} bat 访问令牌。
   * @returns {Promise<object>} 挑战数据。
   */
  async getChallengeData(account, bat) {
    await this.refreshData(account, bat);
    const headers = await this.buildHeaders('ios', account.token, account.did || null, false, bat);
    const response = await this.http.postForm(
      PATHS.challengeData,
      { gameId: 3, serverId: account.serverId, roleId: account.roleId, countryCode: 1 },
      headers,
    );
    assertCode(response, [10902, 200], '获取挑战数据');
    const data = parseData(response.data);
    if (!data || data.open === false) throw new Error('挑战数据未开放展示');
    return data;
  }

  /**
   * 获取探索数据。
   * @param {object} account 账号信息。
   * @param {string} bat 访问令牌。
   * @returns {Promise<object>} 探索数据。
   */
  async getExploreData(account, bat) {
    await this.refreshData(account, bat);
    const headers = await this.buildHeaders('ios', account.token, account.did || null, false, bat);
    const response = await this.http.postForm(
      PATHS.exploreData,
      { gameId: 3, serverId: account.serverId, roleId: account.roleId, countryCode: 1 },
      headers,
    );
    assertCode(response, [10902, 200], '获取探索数据');
    const data = parseData(response.data);
    if (!data || data.open === false) throw new Error('探索数据未开放展示');
    return data;
  }

  /**
   * 获取角色详细培养数据。
   * @param {object} account 账号信息。
   * @param {string} characterId 角色 ID。
   * @param {string} bat 访问令牌。
   * @returns {Promise<object>} 角色培养数据。
   */
  async getRoleDetail(account, characterId, bat) {
    await this.refreshData(account, bat);
    const headers = await this.buildHeaders('ios', account.token, account.did || null, false, bat);
    const response = await this.http.postForm(
      PATHS.roleDetail,
      { serverId: account.serverId, roleId: account.roleId, id: characterId },
      headers,
    );
    assertCode(response, [10902, 200], '获取角色详细数据');
    return parseData(response.data);
  }

  /**
   * 获取逆境深塔数据。
   * @param {object} account 账号信息。
   * @param {string} bat 访问令牌。
   * @returns {Promise<object>} 深塔数据。
   */
  async getTowerData(account, bat) {
    await this.refreshData(account, bat);
    const headers = await this.buildHeaders('ios', account.token, account.did || null, false, bat);
    const form = { gameId: 3, serverId: account.serverId, roleId: account.roleId };
    const response = await this.http.postForm(PATHS.towerData, form, headers);
    assertCode(response, [10902, 200], '获取逆境深塔数据');
    const data = parseData(response.data);
    if (data !== null) return data;
    const fallback = await this.http.postForm(PATHS.towerIndex, form, headers);
    assertCode(fallback, [200], '获取逆境深塔索引');
    return parseData(fallback.data);
  }

  /**
   * 查询签到记录。
   * @param {object} account 账号信息。
   * @param {string} bat 访问令牌。
   * @returns {Promise<object>} 签到记录。
   */
  async getSignInRecord(account, bat) {
    await this.refreshData(account, bat);
    const headers = await this.buildHeaders('ios', account.token, account.did || null, true, bat);
    const response = await this.http.postForm(
      PATHS.signInRecord,
      { gameId: 3, serverId: account.serverId, roleId: account.roleId },
      headers,
    );
    assertCode(response, [200], '获取签到记录');
    return response.data;
  }

  /**
   * 获取官方活动和公告。
   * @param {number} eventType 活动类型。
   * @returns {Promise<object>} 活动列表。
   */
  async getEventList(eventType = 0) {
    const headers = await this.buildHeaders('ios');
    const response = await this.http.postForm(PATHS.eventList, { gameId: 3, eventType }, headers);
    assertCode(response, [200], '获取活动公告');
    return response.data;
  }
}

export { PATHS };
