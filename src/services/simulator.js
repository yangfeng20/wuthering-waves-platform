function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 本地抽卡模拟服务。
 */
export class SimulatorService {
  /**
   * @param {object} wikiService Wiki 服务。
   */
  constructor(wikiService) {
    this.wikiService = wikiService;
    this.state = new Map();
  }

  /**
   * 模拟十连。
   * @param {object} input 模拟参数。
   * @returns {Promise<object>} 模拟结果。
   */
  async tenPull(input = {}) {
    const type = input.type === 'weapon' ? 'weapon' : 'role';
    const key = `${input.sessionId || 'default'}:${type}`;
    const state = this.state.get(key) || { fivePity: 0, fourPity: 0, results: [] };
    const results = [];
    for (let index = 0; index < 10; index += 1) {
      const fiveRate = state.fivePity >= 69 ? 1 : 0.008;
      const fourRate = state.fourPity >= 9 ? 1 : 0.06;
      const random = Math.random();
      if (random < fiveRate) {
        results.push({ rarity: 5, type, pity: state.fivePity + 1 });
        state.fivePity = 0;
        state.fourPity = 0;
      } else if (random < fiveRate + fourRate) {
        results.push({ rarity: 4, type, pity: state.fourPity + 1 });
        state.fivePity += 1;
        state.fourPity = 0;
      } else {
        results.push({ rarity: 3, type, pity: state.fivePity + 1 });
        state.fivePity += 1;
        state.fourPity += 1;
      }
    }
    state.results.push(...results);
    this.state.set(key, state);
    return { type, results, pity: { five: state.fivePity, four: state.fourPity } };
  }
}
