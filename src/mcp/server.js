#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createConfig } from '../config.js';
import { serializeError } from '../errors.js';
import { logError, logInfo } from '../log.js';
import { createServices } from '../services/index.js';

const config = createConfig();
const services = createServices(config);
const server = new McpServer({ name: 'waves-platform', version: '0.1.0' });

function compact(value, includeRaw = false) {
  if (includeRaw) return value;
  if (Array.isArray(value)) return value.map(item => compact(item, false));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'raw' && key !== 'rawRoleData')
    .map(([key, item]) => [key, compact(item, false)]));
}

function buildCollectionResult(value, includeDetails = false, includeRaw = false) {
  const result = compact(value, includeRaw);
  if (includeDetails || includeRaw || !Array.isArray(result.characters)) return result;
  return {
    account: result.account,
    summary: result.summary,
    characters: result.characters.map(item => ({
      ok: item.ok,
      character: item.character ? {
        roleId: item.character.roleId,
        roleName: item.character.roleName,
        level: item.character.level,
        starLevel: item.character.starLevel,
        attributeId: item.character.attributeId,
      } : null,
      build: item.build ? {
        role: item.build.role,
        chain: {
          unlocked: item.build.chain?.unlocked,
          total: item.build.chain?.total,
        },
        skills: item.build.skills,
        weapon: item.build.weapon,
        echoScore: item.build.echoScore ? {
          available: item.build.echoScore.available,
          totalScore: item.build.echoScore.totalScore,
          averageScore: item.build.echoScore.averageScore,
          rank: item.build.echoScore.rank,
          color: item.build.echoScore.color,
        } : null,
        recommendations: item.build.recommendations,
      } : null,
      error: item.error,
    })),
  };
}

function jsonResult(data) {
  const text = JSON.stringify(data, null, 2);
  const maxChars = 120000;
  // MCP SDK 要求 structuredContent 必须是对象, 数组结果统一包裹, 原始数据保留在 text 中
  const structured = Array.isArray(data) ? { items: data } : data;
  if (text.length <= maxChars) {
    return { content: [{ type: 'text', text }], structuredContent: structured };
  }
  const preview = text.slice(0, maxChars);
  const guarded = {
    truncated: true,
    totalChars: text.length,
    message: '结果过大, 已截断文本输出。请缩小查询范围或使用 includeRaw=false。',
    preview,
  };
  return {
    content: [{ type: 'text', text: JSON.stringify(guarded, null, 2) }],
    structuredContent: guarded,
  };
}

function errorResult(error) {
  const serialized = serializeError(error);
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify(serialized, null, 2) }],
    structuredContent: serialized,
  };
}

function registerTool(name, description, inputSchema, handler) {
  server.registerTool(name, { description, inputSchema }, async args => {
    try {
      return jsonResult(await handler(args || {}));
    } catch (error) {
      logError(`工具 ${name} 执行失败`, error);
      return errorResult(error);
    }
  });
}

const accountSchema = { accountId: z.string().optional().describe('账号 ID, 不填使用当前账号') };
const rawSchema = { ...accountSchema, includeRaw: z.boolean().optional().describe('是否返回接口原始数据, 默认 false') };

registerTool(
  'waves_capabilities',
  '查看 waves-platform 当前支持的数据能力和 MCP 工具分类。',
  {},
  async () => ({
    account: ['登录', '账号列表', '账号切换', 'Token 检查', '账号诊断', '账号快照'],
    game: ['日常数据', '角色列表', '单角色培养', '全角色练度', '数据坞', '探索度', '挑战', '逆境深塔'],
    community: ['签到记录', '社区任务', '库洛币', '帖子'],
    publicData: ['角色 Wiki', '武器 Wiki', '声骸 Wiki', '公告', '活动日历', '兑换码'],
    gacha: ['角色和武器抽卡记录'],
    local: ['声骸评分', '培养短板分析', '毕业面板参考对比', '抽卡模拟'],
  }),
);

registerTool(
  'waves_account_login_sms',
  '使用库街区手机号和短信验证码登录, 保存本地账号凭据。不会返回 Token。',
  {
    mobile: z.string().describe('手机号'),
    code: z.string().describe('短信验证码'),
    accountId: z.string().optional().describe('自定义账号 ID'),
    label: z.string().optional().describe('账号显示名称'),
  },
  async args => services.accounts.loginBySms(args),
);

registerTool(
  'waves_account_login_token',
  '使用已有库街区 Token 登录, 保存本地账号凭据。不会在结果中返回 Token。',
  {
    token: z.string().describe('库街区 Token'),
    userId: z.string().optional().describe('用户 ID'),
    serverId: z.string().optional().describe('服务器 ID'),
    roleId: z.string().optional().describe('游戏角色 ID'),
    did: z.string().optional().describe('登录时生成的设备标识'),
    accountId: z.string().optional().describe('自定义账号 ID'),
    label: z.string().optional().describe('账号显示名称'),
  },
  async args => services.accounts.loginByToken(args),
);

registerTool('waves_account_list', '列出本地已保存账号, Token 会被隐藏。', {}, async () => services.accounts.list());
registerTool('waves_account_set_active', '设置当前使用的本地账号。', { accountId: z.string() }, async args => services.accounts.setActive(args.accountId));
registerTool('waves_account_remove', '删除本地保存的账号凭据。', { accountId: z.string() }, async args => ({ removed: await services.accounts.remove(args.accountId), accountId: args.accountId }));
registerTool('waves_account_validate', '检查账号 Token 是否可用。', accountSchema, async args => services.accounts.validate(args.accountId));
registerTool('waves_account_diagnose', '诊断账号 Token, 绑定角色和角色详情接口状态, 不返回 Token。', accountSchema, async args => services.accounts.diagnose(args.accountId));
registerTool('waves_account_snapshot', '获取账号基础资料, 日常数据和角色列表的综合快照。', accountSchema, async args => services.game.snapshot(args.accountId));

registerTool('waves_daily_data', '获取鸣潮日常数据, 包含体力等信息。', rawSchema, async args => compact(await services.game.daily(args.accountId), args.includeRaw));
registerTool('waves_character_list', '获取账号拥有或展示的角色列表。', rawSchema, async args => compact(await services.game.characters(args.accountId), args.includeRaw));
registerTool(
  'waves_character_build',
  '获取指定角色的等级, 属性, 技能, 共鸣链, 武器, 声骸和评分。selector 可以填写角色名称或角色 ID。',
  {
    accountId: z.string().optional().describe('账号 ID'),
    selector: z.string().describe('角色名称或角色 ID'),
    includeRaw: z.boolean().optional().describe('是否返回接口原始数据'),
  },
  async args => compact(await services.game.characterBuild(args.accountId, args.selector), args.includeRaw),
);
registerTool(
  'waves_all_character_builds',
  '获取账号所有角色的培养汇总, 默认返回适合 AI 阅读的摘要。需要单个角色的完整声骸词条时, 再调用 waves_character_build。',
  { ...rawSchema, includeDetails: z.boolean().optional().describe('是否返回每个角色的完整声骸详情, 默认 false') },
  async args => buildCollectionResult(await services.game.allBuilds(args.accountId), args.includeDetails, args.includeRaw),
);
registerTool('waves_analyze_build', '分析一个角色或整个账号的培养短板和声骸评分。', {
  accountId: z.string().optional().describe('账号 ID'),
  selector: z.string().optional().describe('角色名称或角色 ID, 不填分析全账号'),
  includeRaw: z.boolean().optional().describe('是否返回接口原始数据'),
  includeDetails: z.boolean().optional().describe('全账号分析时是否返回完整声骸详情, 默认 false'),
}, async args => {
  const result = args.selector
    ? await services.game.characterBuild(args.accountId, args.selector)
    : await services.game.allBuilds(args.accountId);
  return args.selector
    ? compact(result, args.includeRaw)
    : buildCollectionResult(result, args.includeDetails, args.includeRaw);
});
registerTool(
  'waves_character_benchmark',
  '获取第三方维护的角色毕业参考面板, 用于培养对比。该数据不是官方排行榜或玩家平均值。',
  {
    name: z.string().describe('角色名称'),
    includeRaw: z.boolean().optional().describe('是否返回参考面板原始数据'),
  },
  async args => services.benchmark.get(args.name, args.includeRaw),
);
registerTool(
  'waves_compare_character_build',
  '将自己的角色培养数据与毕业参考面板进行对比, 返回技能, 属性, 武器, 声骸和培养建议差异。',
  {
    accountId: z.string().optional().describe('账号 ID'),
    selector: z.string().describe('角色名称或角色 ID'),
  },
  async args => services.benchmark.compare(args.accountId, args.selector),
);

registerTool('waves_calabash', '获取数据坞和声骸收集数据。', rawSchema, async args => compact(await services.game.calabash(args.accountId), args.includeRaw));
registerTool('waves_explore', '获取地图探索度数据。', rawSchema, async args => compact(await services.game.explore(args.accountId), args.includeRaw));
registerTool('waves_challenge', '获取全息战略和其他挑战数据。', rawSchema, async args => compact(await services.game.challenge(args.accountId), args.includeRaw));
registerTool('waves_tower', '获取逆境深塔数据。', rawSchema, async args => compact(await services.game.tower(args.accountId), args.includeRaw));

registerTool('waves_sign_in_record', '获取游戏签到领取记录。', rawSchema, async args => compact(await services.community.signInRecord(args.accountId), args.includeRaw));
registerTool('waves_task_status', '获取库街区任务进度。', rawSchema, async args => compact(await services.community.taskStatus(args.accountId), args.includeRaw));
registerTool('waves_coin', '获取库洛币数量。', rawSchema, async args => compact(await services.community.coin(args.accountId), args.includeRaw));
registerTool('waves_posts', '获取库街区鸣潮社区帖子列表。', {}, async () => services.community.posts());

registerTool('waves_gacha_records', '通过抽卡记录链接或 playerId 和 recordId 获取抽卡记录。', {
  recordUrl: z.string().optional().describe('游戏抽卡记录链接'),
  playerId: z.string().optional().describe('抽卡玩家 ID'),
  recordId: z.string().optional().describe('抽卡记录 ID'),
  serverId: z.string().optional().describe('服务器 ID'),
  languageCode: z.string().optional().describe('语言代码, 默认 zh-Hans'),
}, async args => services.gacha.records(args));

registerTool('waves_wiki_search', '搜索库街区 Wiki。', { keyword: z.string() }, async args => services.wiki.search(args.keyword));
registerTool('waves_wiki_entry', '获取角色, 武器, 声骸, 敌人, 道具或素材的 Wiki 详情。', {
  name: z.string().describe('词条名称'),
  catalogueId: z.string().optional().describe('分类 ID, 1105 角色, 1106 武器, 1107 声骸等'),
  includeRaw: z.boolean().optional().describe('是否返回 Wiki 原始结构, 默认 false'),
}, async args => services.wiki.entry(args.name, args.catalogueId, args.includeRaw));
registerTool('waves_character_guide', '获取角色技能说明, 角色档案和公共培养资料。', {
  name: z.string().describe('角色名称'),
  includeRaw: z.boolean().optional().describe('是否返回 Wiki 原始结构, 默认 false'),
}, async args => services.wiki.entry(args.name, '1105', args.includeRaw));
registerTool('waves_wiki_catalogue', '获取指定 Wiki 分类的全部词条。', { catalogueId: z.string() }, async args => services.wiki.catalogue(args.catalogueId));
registerTool('waves_calendar', '获取当前角色卡池, 武器卡池和活动日历。', {}, async () => services.wiki.calendar());
registerTool('waves_news', '获取官方公告, 活动或资讯。eventType: 0 全部, 1 活动, 2 资讯, 3 公告。', { eventType: z.number().int().min(0).max(3).optional() }, async args => services.wiki.news(args.eventType || 0));
registerTool('waves_redeem_codes', '获取鸣潮兑换码。', {}, async () => services.wiki.redeemCodes());
registerTool('waves_simulate_gacha', '进行本地角色或武器十连抽卡模拟, 不会访问或修改游戏账号。', {
  type: z.enum(['role', 'weapon']).optional(),
  sessionId: z.string().optional(),
}, async args => services.simulator.tenPull(args));

async function main() {
  await services.store.ensure();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logInfo('MCP stdio 服务已启动');
}

main().catch(error => {
  logError('MCP 服务启动失败', error);
  process.exitCode = 1;
});
