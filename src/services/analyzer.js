import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function numberValue(value) {
  if (typeof value === 'number') return value;
  const result = Number.parseFloat(String(value ?? '').replace('%', ''));
  return Number.isFinite(result) ? result : 0;
}

function compactProp(prop) {
  return {
    attributeName: prop?.attributeName,
    attributeValue: prop?.attributeValue,
    color: prop?.color,
  };
}

function compactEcho(echo) {
  return {
    id: echo?.phantomProp?.id || echo?.phantomProp?.phantomId || echo?.id,
    name: echo?.phantomProp?.name || echo?.name,
    iconUrl: echo?.phantomProp?.iconUrl,
    level: echo?.level,
    cost: echo?.cost,
    mainProps: (echo?.mainProps || []).map(compactProp),
    subProps: (echo?.subProps || []).map(compactProp),
    set: echo?.fetterDetail ? {
      name: echo.fetterDetail.name,
      iconUrl: echo.fetterDetail.iconUrl,
    } : null,
  };
}

function compactScoreEcho(echo) {
  return {
    ...compactEcho(echo),
    realScore: echo?.realScore,
    rank: echo?.rank,
    color: echo?.color,
  };
}

/**
 * 角色培养和声骸评分服务。
 */
export class BuildAnalyzer {
  /**
   * @param {object} config 项目配置。
   */
  constructor(config) {
    this.config = config;
    this.weightRoot = path.join(config.resourceRoot, 'Weight');
  }

  /**
   * 读取角色权重。
   * @param {string} roleId 角色 ID。
   * @returns {object|null} 权重。
   */
  loadWeights(roleId) {
    const rolePath = path.join(this.weightRoot, `${roleId}.yaml`);
    const basePath = path.join(this.weightRoot, 'weight.yaml');
    if (!fs.existsSync(rolePath) || !fs.existsSync(basePath)) return null;
    return {
      role: YAML.parse(fs.readFileSync(rolePath, 'utf8')),
      base: YAML.parse(fs.readFileSync(basePath, 'utf8')),
    };
  }

  /**
   * 计算单个角色培养摘要。
   * @param {object} detail 原始角色详情。
   * @returns {object} 结构化培养摘要。
   */
  decorateBuild(detail) {
    const data = clone(detail) || {};
    const role = data.role || {};
    const skills = Array.isArray(data.skillList) ? data.skillList : [];
    const chains = Array.isArray(data.chainList) ? data.chainList : [];
    const weaponData = data.weaponData || {};
    const phantomData = data.phantomData || {};
    const echoes = Array.isArray(phantomData.equipPhantomList) ? phantomData.equipPhantomList.filter(Boolean) : [];
    let score = null;
    const weights = this.loadWeights(role.roleId);
    if (weights) {
      try {
        score = this.calculateScore(data, weights.role, weights.base);
      } catch (error) {
        score = { available: false, reason: `评分失败: ${error instanceof Error ? error.message : String(error)}` };
      }
    }
    if (score?.echoes) {
      score = { ...score, echoes: score.echoes.map(compactScoreEcho) };
    }

    const lowSkills = skills
      .filter(skill => Number(skill.level) < 8)
      .map(skill => ({ name: skill.skill?.name || skill.skill?.skillName || skill.name || '未知技能', level: skill.level }));

    return {
      role: {
        id: role.roleId,
        name: role.roleName,
        level: role.level,
        starLevel: role.starLevel,
        attributeId: role.attributeId,
        attributeName: role.attributeName,
        acronym: role.acronym,
        breach: role.breach,
        stats: role.stats || role.attributeData || role.attrData || null,
      },
      attributes: (data.roleAttributeList || []).map(attribute => ({
        id: attribute.attributeId,
        name: attribute.attributeName,
        value: attribute.attributeValue,
        iconUrl: attribute.iconUrl,
      })),
      chain: {
        unlocked: chains.filter(chain => chain.unlocked).length,
        total: chains.length,
        list: chains.map(chain => ({
          id: chain.chainId || chain.id,
          name: chain.name || chain.chainName,
          unlocked: Boolean(chain.unlocked),
          iconUrl: chain.iconUrl,
        })),
      },
      skills: skills.map(skill => ({
        id: skill.skill?.skillId || skill.skillId,
        name: skill.skill?.name || skill.skill?.skillName || skill.name,
        level: skill.level,
        iconUrl: skill.skill?.iconUrl || skill.iconUrl,
      })),
      weapon: {
        id: weaponData.weapon?.weaponId || weaponData.weaponId,
        name: weaponData.weapon?.weaponName || weaponData.weaponName,
        iconUrl: weaponData.weapon?.weaponIcon,
        level: weaponData.level,
        starLevel: weaponData.weapon?.weaponStarLevel || weaponData.weaponStarLevel,
        resonanceLevel: weaponData.resonLevel,
        effectName: weaponData.weapon?.weaponEffectName,
        effectDescription: weaponData.weapon?.effectDescription,
      },
      echoes: echoes.map(compactEcho),
      echoScore: score,
      recommendations: {
        lowSkillCount: lowSkills.length,
        lowSkills,
        missingEchoSlots: Math.max(0, 5 - echoes.length),
        hasWeapon: Boolean(weaponData.weapon || weaponData.weaponName),
        scoreAvailable: Boolean(score?.available),
      },
    };
  }

  /**
   * 计算声骸评分。
   * @param {object} detail 角色详情。
   * @param {object} roleWeight 角色权重。
   * @param {object} baseWeight 基础权重。
   * @returns {object} 评分结果。
   */
  calculateScore(detail, roleWeight, baseWeight) {
    const echoes = Array.isArray(detail.phantomData?.equipPhantomList)
      ? detail.phantomData.equipPhantomList.filter(Boolean)
      : [];
    this.calculateValueWeights(roleWeight, baseWeight);
    const scoredEchoes = echoes.map(echo => this.calculateEcho(echo, roleWeight, baseWeight));
    const totalScore = scoredEchoes.reduce((sum, echo) => sum + (echo.realScore || 0), 0);
    const [rank, color] = this.rank(totalScore / 5);
    return {
      available: true,
      totalScore,
      averageScore: totalScore / 5,
      rank,
      color,
      echoes: scoredEchoes,
    };
  }

  /**
   * 计算权重派生值。
   * @param {object} roleWeight 角色权重。
   * @param {object} baseWeight 基础权重。
   * @returns {void}
   */
  calculateValueWeights(roleWeight, baseWeight) {
    const find = (list, name) => list.find(item => item.name === name);
    const addSub = (name, baseMax, basePercentMax, roleBase, roleProp) => {
      if (!roleWeight.subProps.some(item => item.name === name)) {
        roleWeight.subProps.push({ name, weight: baseMax / roleBase / (basePercentMax / 100) * roleProp });
      }
    };
    const addMain = (cost, name, baseMax, basePercentMax, roleBase, roleProp) => {
      roleWeight.mainProps[cost] ||= [];
      if (!roleWeight.mainProps[cost].some(item => item.name === name)) {
        roleWeight.mainProps[cost].push({ name, weight: baseMax / roleBase / (basePercentMax / 100) * roleProp });
      }
    };
    const subAttack = find(baseWeight.subProps, '攻击');
    const subAttackPercent = find(baseWeight.subProps, '攻击百分比');
    const subHp = find(baseWeight.subProps, '生命');
    const subHpPercent = find(baseWeight.subProps, '生命百分比');
    const subDefense = find(baseWeight.subProps, '防御');
    const subDefensePercent = find(baseWeight.subProps, '防御百分比');
    if (subAttack && subAttackPercent && roleWeight.baseAttack) addSub('攻击', subAttack.max, subAttackPercent.max, roleWeight.baseAttack, find(roleWeight.subProps, '攻击百分比')?.weight || 0);
    if (subHp && subHpPercent && roleWeight.baseHP) addSub('生命', subHp.max, subHpPercent.max, roleWeight.baseHP, find(roleWeight.subProps, '生命百分比')?.weight || 0);
    if (subDefense && subDefensePercent && roleWeight.baseDefense) addSub('防御', subDefense.max, subDefensePercent.max, roleWeight.baseDefense, find(roleWeight.subProps, '防御百分比')?.weight || 0);
    for (const cost of ['C4', 'C3']) {
      const main = baseWeight.mainProps?.[cost];
      const roleMain = roleWeight.mainProps?.[cost];
      if (main && roleMain && roleWeight.baseAttack) {
        const attack = find(main, '攻击');
        const attackPercent = find(main, '攻击百分比');
        const rolePercent = find(roleMain, '攻击百分比');
        if (attack && attackPercent && rolePercent) addMain(cost, '攻击', attack.max, attackPercent.max, roleWeight.baseAttack, rolePercent.weight);
      }
    }
    const hp = find(baseWeight.mainProps?.C1 || [], '生命');
    const hpPercent = find(baseWeight.mainProps?.C1 || [], '生命百分比');
    const roleHp = find(roleWeight.mainProps?.C1 || [], '生命百分比');
    if (hp && hpPercent && roleHp && roleWeight.baseHP) addMain('C1', '生命', hp.max, hpPercent.max, roleWeight.baseHP, roleHp.weight);
    roleWeight.subProps.forEach(item => { item.theoreticalValue = 21 * (item.weight || 0); });
    for (const cost of Object.keys(roleWeight.mainProps || {})) {
      roleWeight.mainProps[cost].forEach(item => { item.theoreticalValue = (cost === 'C4' ? 44 : cost === 'C3' ? 30 : 18) * (item.weight || 0); });
    }
  }

  /**
   * 计算一个声骸。
   * @param {object} echo 声骸数据。
   * @param {object} roleWeight 角色权重。
   * @param {object} baseWeight 基础权重。
   * @returns {object} 声骸评分数据。
   */
  calculateEcho(echo, roleWeight, baseWeight) {
    const result = clone(echo);
    let total = 0;
    const roleSub = roleWeight.subProps || [];
    const baseSub = baseWeight.subProps || [];
    for (const prop of result.subProps || []) {
      const roleProp = roleSub.find(item => item.name === prop.attributeName);
      const baseProp = baseSub.find(item => item.name === prop.attributeName);
      if (!roleProp || !baseProp?.max) continue;
      total += numberValue(prop.attributeValue) / baseProp.max * (roleProp.theoreticalValue || 0);
    }
    for (const prop of result.mainProps || []) {
      const name = prop.attributeName?.includes('伤害加成') ? '伤害加成' : prop.attributeName;
      const baseProp = baseWeight.mainProps?.[`C${result.cost}`]?.find(item => item.name === name)
        || baseWeight.mainProps?.C3?.find(item => item.name === name)
        || baseWeight.mainProps?.C1?.find(item => item.name === name);
      const roleProp = roleWeight.mainProps?.[`C${result.cost}`]?.find(item => item.name === name)
        || roleWeight.mainProps?.C3?.find(item => item.name === name)
        || roleWeight.mainProps?.C1?.find(item => item.name === name);
      if (baseProp?.max && roleProp?.theoreticalValue) total += numberValue(prop.attributeValue) / baseProp.max * roleProp.theoreticalValue;
    }
    const subFactor = roleSub
      .slice()
      .sort((a, b) => (b.theoreticalValue || 0) - (a.theoreticalValue || 0))
      .slice(0, 5)
      .reduce((sum, item) => sum + (item.theoreticalValue || 0), 0);
    const mainFactor = result.cost === 4 ? 22 : result.cost === 3 ? 22.5 : result.cost === 1 ? 18 : 0;
    const factor = subFactor + mainFactor ? 25 / (subFactor + mainFactor) : 0;
    result.realScore = factor * total;
    [result.rank, result.color] = this.rank(result.realScore);
    return result;
  }

  /**
   * 获取评分等级。
   * @param {number} score 分数。
   * @returns {[string, string]} 等级和颜色。
   */
  rank(score) {
    const ranks = [
      [22, 'MAX', '#9d2933'],
      [19, 'ACE', '#f08a5d'],
      [17, 'SSS', '#eec900'],
      [15, 'SS', '#eec900'],
      [12, 'S', '#eec900'],
      [9, 'A', '#9f00ed'],
      [6, 'B', '#6640ff'],
      [3, 'C', '#00D200'],
      [0, 'D', '#a0a0a0'],
    ];
    return ranks.find(item => score >= item[0])?.slice(1) || ['D', '#a0a0a0'];
  }

  /**
   * 汇总全角色培养数据。
   * @param {object[]} results 角色结果。
   * @returns {object} 汇总结果。
   */
  summarizeBuilds(results) {
    const successful = results.filter(item => item.ok);
    return {
      total: results.length,
      success: successful.length,
      failed: results.length - successful.length,
      characters: successful.map(item => ({
        id: item.build.role.id,
        name: item.build.role.name,
        level: item.build.role.level,
        echoRank: item.build.echoScore?.rank || '未评分',
        echoScore: item.build.echoScore?.totalScore ?? null,
        lowSkillCount: item.build.recommendations.lowSkillCount,
      })),
    };
  }
}
