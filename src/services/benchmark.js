const BENCHMARK_BASE_URL = 'https://raw.githubusercontent.com/Xinglingsuiyue/waves-plugin/main/resources/CharacterMAX';

function numberValue(value) {
  const number = Number.parseFloat(String(value ?? '').replace('%', ''));
  return Number.isFinite(number) ? number : null;
}

function attributeMap(attributes = []) {
  return Object.fromEntries(attributes.map(item => [item.name, {
    value: item.value,
    number: numberValue(item.value),
  }]));
}

function skillMap(skills = []) {
  return Object.fromEntries(skills.map(item => [item.name, Number(item.level) || 0]));
}

function echoSummary(echoes = []) {
  const mainStats = {};
  const subStats = {};
  const sets = {};
  for (const echo of echoes) {
    for (const prop of echo.mainProps || []) mainStats[prop.attributeName] = (mainStats[prop.attributeName] || 0) + 1;
    for (const prop of echo.subProps || []) subStats[prop.attributeName] = (subStats[prop.attributeName] || 0) + 1;
    if (echo.set?.name) sets[echo.set.name] = (sets[echo.set.name] || 0) + 1;
  }
  return {
    count: echoes.length,
    level25: echoes.filter(echo => Number(echo.level) >= 25).length,
    quality5: echoes.filter(echo => Number(echo.quality) >= 5).length,
    cost: echoes.reduce((sum, echo) => sum + (Number(echo.cost) || 0), 0),
    mainStats,
    subStats,
    sets,
  };
}

function delta(own, reference) {
  if (own === null || reference === null) return null;
  return Number((own - reference).toFixed(3));
}

/**
 * 角色毕业参考和培养对比服务。
 *
 * 参考数据来自第三方维护的 CharacterMAX 文件, 不是库街区官方排行榜或所有玩家平均值。
 */
export class BenchmarkService {
  /**
   * @param {object} dependencies 服务依赖。
   */
  constructor({ game, analyzer }) {
    this.game = game;
    this.analyzer = analyzer;
    this.cache = new Map();
  }

  /**
   * 获取角色毕业参考原始数据。
   * @param {string} name 角色名称。
   * @returns {Promise<object>} 参考数据。
   */
  async fetch(name) {
    const normalized = String(name || '').trim();
    if (!normalized) throw new Error('角色名称不能为空');
    if (this.cache.has(normalized)) return this.cache.get(normalized);
    const url = `${BENCHMARK_BASE_URL}/${encodeURIComponent(normalized)}.json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (response.status === 404) return { found: false, name: normalized, source: url };
    if (!response.ok) throw new Error(`获取角色毕业参考失败: HTTP ${response.status}`);
    const payload = await response.json();
    const data = typeof payload?.data === 'string' ? JSON.parse(payload.data) : (payload?.data || payload);
    const result = {
      found: true,
      name: normalized,
      source: url,
      data,
      build: this.analyzer.decorateBuild(data),
    };
    this.cache.set(normalized, result);
    return result;
  }

  /**
   * 查询角色毕业参考。
   * @param {string} name 角色名称。
   * @param {boolean} includeRaw 是否返回原始数据。
   * @returns {Promise<object>} 参考结果。
   */
  async get(name, includeRaw = false) {
    const result = await this.fetch(name);
    if (!result.found) return result;
    return {
      found: true,
      name: result.name,
      source: result.source,
      benchmark: result.build,
      ...(includeRaw ? { raw: result.data } : {}),
    };
  }

  /**
   * 对比账号角色和毕业参考。
   * @param {string|undefined} accountId 账号 ID。
   * @param {string} selector 角色名称或 ID。
   * @returns {Promise<object>} 对比结果。
   */
  async compare(accountId, selector) {
    const own = await this.game.characterBuild(accountId, selector);
    const name = own.build.role.name || own.character.roleName || selector;
    const benchmark = await this.fetch(name);
    if (!benchmark.found) {
      return {
        found: false,
        name,
        message: `暂无 ${name} 的毕业参考面板`,
        own: own.build,
      };
    }

    const ownBuild = own.build;
    const reference = benchmark.build;
    const ownSkills = skillMap(ownBuild.skills);
    const referenceSkills = skillMap(reference.skills);
    const skillDiff = Object.entries(referenceSkills).map(([skillName, referenceLevel]) => ({
      name: skillName,
      ownLevel: ownSkills[skillName] || 0,
      referenceLevel,
      delta: (ownSkills[skillName] || 0) - referenceLevel,
    }));

    const ownAttributes = attributeMap(ownBuild.attributes);
    const referenceAttributes = attributeMap(reference.attributes);
    const attributeDiff = Object.entries(referenceAttributes).map(([attributeName, referenceValue]) => ({
      name: attributeName,
      ownValue: ownAttributes[attributeName]?.value ?? null,
      referenceValue: referenceValue.value,
      delta: delta(ownAttributes[attributeName]?.number ?? null, referenceValue.number),
    }));

    const ownEchoes = echoSummary(ownBuild.echoes);
    const referenceEchoes = echoSummary(reference.echoes);
    const recommendations = [];

    if ((ownBuild.role.level || 0) < (reference.role.level || 0)) {
      recommendations.push(`角色等级从 ${ownBuild.role.level || 0} 提升到 ${reference.role.level || 0}`);
    }
    for (const item of skillDiff.filter(item => item.delta < 0)) {
      recommendations.push(`技能「${item.name}」从 ${item.ownLevel} 提升到参考值 ${item.referenceLevel}`);
    }
    if ((ownBuild.weapon.level || 0) < (reference.weapon.level || 0)) {
      recommendations.push(`武器等级从 ${ownBuild.weapon.level || 0} 提升到 ${reference.weapon.level || 0}`);
    }
    if ((ownBuild.weapon.resonanceLevel || 0) < (reference.weapon.resonanceLevel || 0)) {
      recommendations.push(`武器共鸣阶数从 ${ownBuild.weapon.resonanceLevel || 0} 提升到参考值 ${reference.weapon.resonanceLevel}`);
    }
    if (reference.echoScore?.available && ownBuild.echoScore?.available && ownBuild.echoScore.totalScore < reference.echoScore.totalScore) {
      recommendations.push(`声骸总分从 ${ownBuild.echoScore.totalScore.toFixed(2)} 提升到参考值 ${reference.echoScore.totalScore.toFixed(2)}`);
    }
    if (ownEchoes.level25 < referenceEchoes.level25) {
      recommendations.push(`满级声骸从 ${ownEchoes.level25} 个提升到 ${referenceEchoes.level25} 个`);
    }
    if (ownEchoes.quality5 < referenceEchoes.quality5) {
      recommendations.push(`五星声骸从 ${ownEchoes.quality5} 个提升到 ${referenceEchoes.quality5} 个`);
    }

    return {
      found: true,
      name,
      source: benchmark.source,
      own: {
        account: own.account,
        build: ownBuild,
        echoSummary: ownEchoes,
      },
      reference: {
        build: reference,
        echoSummary: referenceEchoes,
      },
      differences: {
        skills: skillDiff,
        attributes: attributeDiff,
        weapon: {
          own: ownBuild.weapon,
          reference: reference.weapon,
        },
        echo: {
          own: ownEchoes,
          reference: referenceEchoes,
          scoreDelta: ownBuild.echoScore?.available && reference.echoScore?.available
            ? Number((ownBuild.echoScore.totalScore - reference.echoScore.totalScore).toFixed(3))
            : null,
        },
      },
      recommendations,
    };
  }
}

export { BENCHMARK_BASE_URL };
