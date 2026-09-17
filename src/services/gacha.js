import { CN_SERVER_ID } from '../http/gacha.js';

function parseRecordUrl(recordUrl) {
  if (!recordUrl) return {};
  const url = new URL(recordUrl);
  return {
    playerId: url.searchParams.get('player_id') || '',
    recordId: url.searchParams.get('record_id') || '',
    serverId: url.searchParams.get('svr_id') || '',
  };
}

/**
 * 抽卡数据服务。
 */
export class GachaService {
  /**
   * @param {object} dependencies 服务依赖。
   */
  constructor({ gachaApi }) {
    this.gachaApi = gachaApi;
  }

  /**
   * 查询抽卡记录。
   * @param {object} input 查询参数。
   * @returns {Promise<object>} 抽卡数据。
   */
  async records(input) {
    const fromUrl = input.recordUrl ? parseRecordUrl(input.recordUrl) : {};
    const params = {
      playerId: input.playerId || fromUrl.playerId,
      recordId: input.recordId || fromUrl.recordId,
      serverId: input.serverId || fromUrl.serverId || CN_SERVER_ID,
      languageCode: input.languageCode || 'zh-Hans',
    };
    if (!params.playerId || !params.recordId) throw new Error('需要提供 recordUrl, 或同时提供 playerId 和 recordId');
    const result = await this.gachaApi.getAllPools(params);
    return { query: params, ...result };
  }
}
