import { assertCode } from './helpers.js';

const PATHS = {
  taskProcess: '/encourage/level/getTaskProcess',
  signIn: '/user/signIn',
  like: '/forum/like',
  share: '/encourage/level/shareTask',
  detail: '/forum/getPostDetail',
  postList: '/forum/list',
  coin: '/encourage/gold/getTotalGold',
};

function headers(token, extra = {}) {
  return { source: 'ios', token, ...extra };
}

/**
 * 库街区社区 API 客户端。
 */
export class CommunityApiClient {
  /**
   * @param {import('./client.js').HttpClient} http HTTP 客户端。
   */
  constructor(http) {
    this.http = http;
  }

  /**
   * 获取任务状态。
   * @param {string} token Token。
   * @returns {Promise<object>} 任务状态。
   */
  async getTaskProcess(token) {
    const response = await this.http.postForm(PATHS.taskProcess, { gameId: 0 }, headers(token, { devcode: '' }));
    assertCode(response, [200], '获取社区任务状态');
    return response.data;
  }

  /**
   * 获取库洛币数量。
   * @param {string} token Token。
   * @returns {Promise<object>} 库洛币数据。
   */
  async getCoin(token) {
    const response = await this.http.postForm(PATHS.coin, null, headers(token, { devcode: '' }));
    assertCode(response, [200], '获取库洛币');
    return response.data;
  }

  /**
   * 获取社区帖子列表。
   * @returns {Promise<object>} 帖子列表。
   */
  async getPost() {
    const response = await this.http.postForm(PATHS.postList, { forumId: 9, gameId: 3 }, { source: 'ios', version: '', devcode: '' });
    assertCode(response, [200], '获取社区帖子');
    return response.data;
  }

  /**
   * 获取社区签到记录。
   * @param {string} token Token。
   * @returns {Promise<object>} 签到信息。
   */
  async getSignInInfo(token) {
    const response = await this.http.postForm(PATHS.signIn, { gameId: 2 }, headers(token));
    assertCode(response, [200], '获取社区签到信息');
    return response.data;
  }

  /**
   * 获取任务动作参数, 用于诊断社区任务接口。
   * @param {string} token Token。
   * @returns {Promise<object>} 原始任务信息。
   */
  async inspect(token) {
    const [task, coin] = await Promise.all([this.getTaskProcess(token), this.getCoin(token)]);
    return { task, coin };
  }
}

export { PATHS };
