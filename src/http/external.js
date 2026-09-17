import { ApiError } from '../errors.js';

const REWARD_URL = 'https://newsimg.5054399.com/comm/mlcxqcommon/static/wap/js/data_102.js';

/**
 * 外部游戏资料客户端。
 */
export class ExternalDataClient {
  /**
   * @param {import('./client.js').HttpClient} http HTTP 客户端。
   */
  constructor(http) {
    this.http = http;
  }

  /**
   * 获取兑换码列表。
   * @returns {Promise<object[]>} 兑换码列表。
   */
  async getRedeemCodes() {
    const content = await this.http.get(`${REWARD_URL}?_=${Date.now()}`, {
      headers: {
        accept: '*/*',
        referer: 'https://www.4399.com/',
        origin: 'https://www.4399.com',
      },
    });
    const match = String(content).match(/var mlList=(.*);/);
    if (!match) throw new ApiError('兑换码接口返回格式发生变化');
    try {
      const data = JSON.parse(match[1]);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      throw new ApiError('兑换码数据解析失败', { cause: error instanceof Error ? error.message : String(error) });
    }
  }
}
