import test from 'node:test';
import assert from 'node:assert/strict';
import { BuildAnalyzer } from '../src/services/analyzer.js';

test('培养分析应返回角色, 技能, 武器和声骸摘要', () => {
  const analyzer = new BuildAnalyzer({ resourceRoot: 'D:/not-exists' });
  const result = analyzer.decorateBuild({
    role: { roleId: 'unknown', roleName: '测试角色', level: 80, starLevel: 5, attributeId: 1 },
    chainList: [{ unlocked: true }, { unlocked: false }],
    skillList: [{ level: 6, skill: { name: '共鸣技能' } }],
    weaponData: { level: 90, resonLevel: 1, weapon: { weaponName: '测试武器', weaponStarLevel: 5 } },
    phantomData: {
      equipPhantomList: [{ cost: 4, level: 25, phantomProp: { name: '测试声骸' }, mainProps: [], subProps: [] }],
    },
  });
  assert.equal(result.role.name, '测试角色');
  assert.equal(result.chain.unlocked, 1);
  assert.equal(result.skills[0].level, 6);
  assert.equal(result.weapon.name, '测试武器');
  assert.equal(result.echoes.length, 1);
  assert.equal(result.recommendations.missingEchoSlots, 4);
  assert.equal(result.recommendations.lowSkills[0].name, '共鸣技能');
});
