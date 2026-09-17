import { safeAccount } from '../storage/credentials.js';

function htmlToText(value) {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function collectWikiText(value, output, state) {
  if (state.length >= state.limit || value === null || value === undefined) return;
  if (typeof value === 'string') {
    const text = htmlToText(value);
    if (text.length > 1) {
      output.push(text.slice(0, Math.max(0, state.limit - state.length)));
      state.length += text.length;
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectWikiText(item, output, state);
    return;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (['mediaList', 'imgs', 'iconUrl', 'contentUrl', 'backgroundUrl'].includes(key)) continue;
      collectWikiText(item, output, state);
      if (state.length >= state.limit) return;
    }
  }
}

function compactWikiDetail(detail) {
  const output = [];
  const state = { length: 0, limit: 60000 };
  collectWikiText(detail?.content, output, state);
  return {
    id: detail?.id,
    name: detail?.name,
    lastUpdateTime: detail?.lastUpdateTime,
    text: output.join('\n').replace(/\n{3,}/g, '\n\n').slice(0, state.limit),
    truncated: state.length >= state.limit,
  };
}

/**
 * Wiki 和公共资料服务。
 */
export class WikiService {
  /**
   * @param {object} dependencies 服务依赖。
   */
  constructor({ wikiApi, externalApi }) {
    this.wikiApi = wikiApi;
    this.externalApi = externalApi;
  }

  /**
   * 查询 Wiki。
   * @param {string} keyword 关键词。
   * @returns {Promise<object>} 搜索结果。
   */
  async search(keyword) {
    return this.wikiApi.search(keyword);
  }

  /**
   * 获取 Wiki 词条。
   * @param {string} name 名称。
   * @param {string} catalogueId 分类 ID。
   * @returns {Promise<object>} 词条数据。
   */
  async entry(name, catalogueId = '', includeRaw = false) {
    const result = await this.wikiApi.getEntry(name, catalogueId);
    if (!result) return { found: false, name };
    if (includeRaw) return { found: true, ...result };
    return {
      found: true,
      catalogueId: result.catalogueId,
      catalogueName: result.catalogueName,
      record: result.record,
      detail: compactWikiDetail(result.detail),
    };
  }

  /**
   * 获取 Wiki 分类列表。
   * @param {string} catalogueId 分类 ID。
   * @returns {Promise<object>} 分类列表。
   */
  async catalogue(catalogueId) {
    return this.wikiApi.getPage(catalogueId);
  }

  /**
   * 获取当前活动和卡池。
   * @returns {Promise<object>} 日历数据。
   */
  async calendar() {
    const data = await this.wikiApi.getHomePage();
    const modules = data?.contentJson?.sideModules || [];
    const currentDate = new Date();
    const parseModule = module => {
      const content = module?.content || {};
      const tab = content.tabs?.[0] || {};
      const range = tab.countDown?.dateRange || [];
      const start = range[0] ? new Date(range[0]) : null;
      const end = range[1] ? new Date(range[1]) : null;
      const active = start && end ? (currentDate < start ? '未开始' : currentDate >= end ? '已结束' : '进行中') : '未知';
      return {
        images: (content.tabs || []).flatMap(item => item.imgs || []).map(item => item.img),
        description: tab.description || '',
        start: start?.toISOString() || null,
        end: end?.toISOString() || null,
        active,
      };
    };
    const activities = Array.isArray(modules[2]?.content)
      ? modules[2].content.map(item => ({
        title: item.title || '',
        contentUrl: item.contentUrl || '',
        dateRange: item.countDown?.dateRange || [],
      }))
      : [];
    return {
      rolePool: parseModule(modules[0]),
      weaponPool: parseModule(modules[1]),
      activities,
      raw: data,
    };
  }

  /**
   * 获取官方活动公告。
   * @param {number} eventType 活动类型。
   * @returns {Promise<object>} 公告列表。
   */
  async news(eventType = 0) {
    return this.externalApi.game.getEventList(eventType);
  }

  /**
   * 获取兑换码。
   * @returns {Promise<object[]>} 兑换码列表。
   */
  async redeemCodes() {
    const data = await this.externalApi.external.getRedeemCodes();
    return data.map(item => ({
      code: item.order,
      status: item.is_fail === '0' ? '可兑换' : '已过期',
      reward: item.reward,
      label: item.label || '',
      createdAt: item.create_time,
      raw: item,
    }));
  }
}
