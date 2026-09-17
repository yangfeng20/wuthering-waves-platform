import { ApiError } from '../errors.js';

const CN_SERVER_ID = '76402e5b20be2c39f095a152090afddc';
const CN_URL = 'https://gmserver-api.aki-game2.com/gacha/record/query';
const INTL_URL = 'https://gmserver-api.aki-game2.net/gacha/record/query';

/**
 * 抽卡 API 客户端。
 */
export class GachaApiClient {
  /**
   * @param {import('./client.js').HttpClient} http HTTP 客户端。
   */
  constructor(http) {
    this.http = http;
  }

  /**
   * 获取一个卡池的抽卡记录。
   * @param {object} data 抽卡查询参数。
   * @returns {Promise<object>} 抽卡记录。
   */
  async getPool(data) {
    const url = data.serverId === CN_SERVER_ID ? CN_URL : INTL_URL;
    const response = await this.http.postForm(url, data, { source: 'ios' });
    if (response.code !== 0) {
      throw new ApiError(`获取抽卡记录失败: ${response.message || response.msg || '未知错误'}`, { response });
    }
    if (!response.data) throw new ApiError('抽卡记录为空, 请检查 recordId');
    return response.data;
  }

  /**
   * 获取全部卡池抽卡记录。
   * @param {object} data 基础参数。
   * @returns {Promise<object>} 按卡池聚合的记录。
   */
  async getAllPools(data) {
    const pools = await Promise.all(
      ['1', '2', '3', '4', '5', '6', '7'].map(cardPoolId => this.getPool({
        playerId: data.playerId,
        serverId: data.serverId || CN_SERVER_ID,
        languageCode: data.languageCode || 'zh-Hans',
        recordId: data.recordId,
        cardPoolId,
        cardPoolType: cardPoolId,
      })),
    );
    return { pools, flat: pools.flatMap((pool, index) => (pool || []).map(item => ({ ...item, cardPoolId: String(index + 1) }))) };
  }
}

export { CN_SERVER_ID };
