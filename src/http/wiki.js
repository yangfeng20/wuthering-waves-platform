import { assertCode } from './helpers.js';

const PATHS = {
  page: '/wiki/core/catalogue/item/getPage',
  detail: '/wiki/core/catalogue/item/getEntryDetail',
  search: '/wiki/core/catalogue/item/search',
  home: '/wiki/core/homepage/getPage',
};

const CATALOGUES = {
  '1105': '共鸣者',
  '1106': '武器',
  '1107': '声骸',
  '1219': '合鸣效果',
  '1158': '敌人',
  '1264': '可合成道具',
  '1265': '道具合成图纸',
  '1217': '补给',
  '1161': '资源',
  '1218': '素材',
  '1223': '特殊道具',
};

/**
 * 库街区 Wiki API 客户端。
 */
export class WikiApiClient {
  /**
   * @param {import('./client.js').HttpClient} http HTTP 客户端。
   */
  constructor(http) {
    this.http = http;
  }

  /**
   * 获取 Wiki 分类列表。
   * @param {string} catalogueId 分类 ID。
   * @returns {Promise<object>} 分类数据。
   */
  async getPage(catalogueId) {
    const response = await this.http.postForm(PATHS.page, { catalogueId, limit: 1000 }, { wiki_type: '9' });
    assertCode(response, [200], '获取 Wiki 列表');
    return response.data;
  }

  /**
   * 获取 Wiki 词条详情。
   * @param {string} id 词条 ID。
   * @returns {Promise<object>} 词条数据。
   */
  async getEntryDetail(id) {
    const response = await this.http.postForm(PATHS.detail, { id }, { wiki_type: '9' });
    assertCode(response, [200], '获取 Wiki 详情');
    return response.data;
  }

  /**
   * 搜索 Wiki。
   * @param {string} keyword 搜索词。
   * @returns {Promise<object>} 搜索结果。
   */
  async search(keyword) {
    const response = await this.http.postForm(PATHS.search, { keyword, limit: 1000 }, { wiki_type: '9' });
    assertCode(response, [200], '搜索 Wiki');
    return response.data;
  }

  /**
   * 获取 Wiki 首页和卡池日历数据。
   * @returns {Promise<object>} 首页数据。
   */
  async getHomePage() {
    const response = await this.http.postForm(PATHS.home, null, { wiki_type: '9' });
    assertCode(response, [200], '获取 Wiki 首页');
    return response.data;
  }

  /**
   * 按名称查找 Wiki 词条。
   * @param {string} name 词条名称。
   * @param {string} catalogueId 分类 ID。
   * @returns {Promise<object>} 词条索引和详情。
   */
  async getEntry(name, catalogueId = '') {
    const catalogueIds = catalogueId ? [catalogueId] : Object.keys(CATALOGUES);
    for (const id of catalogueIds) {
      const page = await this.getPage(id);
      const records = page?.results?.records || [];
      const record = records.find(item => item.name === name);
      if (record) {
        const linkId = record.content?.linkId;
        const detail = linkId ? await this.getEntryDetail(linkId) : null;
        return { catalogueId: id, catalogueName: CATALOGUES[id], record, detail };
      }
    }
    return null;
  }

  /**
   * 获取分类名称映射。
   * @returns {object} 分类映射。
   */
  getCatalogueMap() {
    return { ...CATALOGUES };
  }
}

export { CATALOGUES, PATHS };
