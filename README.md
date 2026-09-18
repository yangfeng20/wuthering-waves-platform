# wuthering-waves-platform

鸣潮个人数据通用服务。项目的核心能力独立于 Yunzai 和 Redis, 当前第一阶段通过 MCP stdio 暴露给 AI 客户端。

## 当前能力

- 库街区短信登录和 Token 登录
- 账号列表和 Token 有效性检查
- 游戏账号信息和日常数据
- 角色列表、角色详情、等级、属性、技能、共鸣链
- 武器等级、星级、共鸣阶数和效果
- 声骸、主词条、副词条、套装和本地评分
- 全角色练度汇总
- 数据坞、探索度、全息战略和逆境深塔
- 抽卡记录查询
- 库街区签到记录、任务状态和库洛币
- 角色、武器、声骸、敌人、道具和素材 Wiki
- 活动、公告、资讯、当前卡池和兑换码
- 角色和武器抽卡模拟

## 能力清单

### 账号和登录

| MCP 工具 | 说明 |
| --- | --- |
| `waves_account_login_sms` | 使用库街区手机号和短信验证码登录 |
| `waves_account_login_token` | 使用已有 Token 和 did 登录 |
| `waves_account_list` | 查看本地已保存账号, Token 会被隐藏 |
| `waves_account_set_active` | 切换当前账号 |
| `waves_account_remove` | 删除本地账号凭据 |
| `waves_account_validate` | 检查 Token 是否有效 |
| `waves_account_diagnose` | 诊断 Token, did, 角色绑定和接口状态 |
| `waves_account_snapshot` | 获取账号基础资料, 日常数据和角色列表 |

### 个人游戏数据

| MCP 工具 | 说明 |
| --- | --- |
| `waves_daily_data` | 体力, 活跃度, 周任务等日常数据 |
| `waves_character_list` | 获取账号角色列表 |
| `waves_character_build` | 获取单个角色完整培养数据 |
| `waves_all_character_builds` | 获取全角色培养汇总 |
| `waves_analyze_build` | 分析角色或账号培养短板 |
| `waves_calabash` | 数据坞和声骸收集数据 |
| `waves_explore` | 地图探索度 |
| `waves_challenge` | 全息战略和挑战数据 |
| `waves_tower` | 逆境深塔数据 |

角色培养数据包括:

```text
角色等级和属性
共鸣链
技能名称和技能等级
武器名称, 等级, 星级和共鸣阶数
声骸名称, 等级, COST, 主词条, 副词条和套装
声骸评分
角色面板属性
```

### 库街区 Wiki 和公共资料

| MCP 工具 | 说明 |
| --- | --- |
| `waves_character_guide` | 角色技能说明, 角色档案和培养资料 |
| `waves_wiki_entry` | 查询角色, 武器, 声骸, 敌人, 道具和素材详情 |
| `waves_wiki_search` | 搜索库街区 Wiki |
| `waves_wiki_catalogue` | 查询 Wiki 分类列表 |
| `waves_calendar` | 当前角色卡池, 武器卡池和活动日历 |
| `waves_news` | 官方公告, 活动和资讯 |
| `waves_redeem_codes` | 查询鸣潮兑换码 |

### 培养对比和分析

| MCP 工具 | 说明 |
| --- | --- |
| `waves_character_benchmark` | 查询角色毕业参考面板 |
| `waves_compare_character_build` | 对比自己的角色和毕业参考面板 |

毕业参考面板来自第三方维护的 `CharacterMAX` 数据, 不是官方排行榜, 也不是所有玩家的平均值。部分角色可能暂时没有参考面板。

对比内容包括:

```text
角色等级
技能等级
武器等级和共鸣
角色属性
声骸数量和满级数量
五星声骸数量
声骸套装
声骸评分
培养差距和升级建议
```

### 抽卡和库街区社区数据

| MCP 工具 | 说明 |
| --- | --- |
| `waves_gacha_records` | 查询角色和武器抽卡记录 |
| `waves_simulate_gacha` | 本地模拟角色或武器十连, 不修改账号 |
| `waves_sign_in_record` | 查询游戏签到记录 |
| `waves_task_status` | 查询库街区任务状态 |
| `waves_coin` | 查询库洛币数量 |
| `waves_posts` | 查询鸣潮社区帖子 |

### MCP 参数说明

大部分个人数据工具都支持:

```text
accountId      指定账号, 不填使用当前账号
includeRaw     是否返回接口原始数据, 默认 false
includeDetails 是否返回更完整的全角色详情, 默认 false
```

`waves_all_character_builds` 默认返回适合 AI 阅读的全角色摘要。如果要查看某个角色的完整声骸词条, 推荐使用:

```text
waves_character_build
```

也可以直接用自然语言提问, 不需要手动填写工具名:

```text
查看我所有角色的培养汇总
详细分析我的维里奈
查询维里奈的库街区攻略
对比我的莫宁和毕业参考面板
结合我的角色数据给出培养优先级
```

当前 MCP 主要提供只读查询和本地模拟, 暂未开放实际签到, 自动任务, 点赞, 分享, 自动推送以及面板图上传删除等写操作。

## 环境要求

- Node.js 22+
- 一个支持 MCP stdio 的 AI 客户端

不需要 Yunzai-Bot, Redis, QQ 机器人或锅巴插件。

## 安装

推荐使用 npm 全局安装:

```bash
npm install -g wuthering-waves-platform
```

安装完成后, 可以使用项目 CLI 登录和管理账号:

```bash
wuthering-waves-platform login
wuthering-waves-platform accounts
wuthering-waves-platform validate
wuthering-waves-platform diagnose
```

不想全局安装时, 可以使用 npx:

```bash
npx -y --package wuthering-waves-platform wuthering-waves-platform login
```

Windows, macOS 和 Linux 均可使用。
## 登录

注意: 不要执行 `pnpm login`, 这是 pnpm 自带的 npm 仓库登录命令, 不是本项目的游戏账号登录。

推荐使用项目自己的命令:

```bash
wuthering-waves-platform login
```

按提示输入手机号, 库街区短信验证码和账号名称。建议先在库街区 App 中完成数据展示设置, 然后退出 App, 再执行本命令获取验证码。登录完成后不要再次在 App 或其他插件中登录同一账号, 以免旧 Token 失效。

账号凭据默认保存到:

```text
%USERPROFILE%/.waves-platform/credentials.json
```

查看已保存账号:

```bash
wuthering-waves-platform accounts
```

检查当前 Token:

```bash
wuthering-waves-platform validate
```

诊断账号绑定和角色数据接口:

```bash
wuthering-waves-platform diagnose
```

也可以在 MCP 客户端中调用 `waves_account_login_sms`。该工具只返回脱敏账号信息, 不会返回 Token。

还可以设置环境变量:

```text
WAVES_TOKEN=你的Token
WAVES_USER_ID=你的用户ID
WAVES_SERVER_ID=你的服务器ID
WAVES_ROLE_ID=你的角色ID
WAVES_DID=登录时生成的设备标识
```

登录凭据默认保存在用户目录下的 `.waves-platform/credentials.json`, 文件不会被 Git 跟踪。请不要分享该文件。

重要: 库街区账号的 Token 和设备标识 `did` 是绑定的。不要在库街区 App, 原 Yunzai 插件和本服务之间反复登录同一账号, 后登录可能使先前会话失效。使用本项目短信登录时会自动保存 `token + did`。

## MCP 配置

以支持标准 stdio MCP 配置的客户端为例:

```json
{
  "mcpServers": {
    "wuthering-waves-platform": {
      "command": "npx",
      "args": [
        "-y",
        "--package",
        "wuthering-waves-platform",
        "wuthering-waves-platform-mcp"
      ]
    }
  }
}
```

Windows 路径建议使用正斜杠。配置完成后重启 MCP 客户端。

## 通过 npm 使用

发布后可以直接安装:

```bash
npm install -g wuthering-waves-platform
```

登录鸣潮账号:

```bash
wuthering-waves-platform login
```

查看账号:

```bash
wuthering-waves-platform accounts
```

MCP 客户端配置:

```json
{
  "mcpServers": {
    "wuthering-waves-platform": {
      "command": "wuthering-waves-platform-mcp"
    }
  }
}
```

不想全局安装时, 可以使用 `npx`:

```json
{
  "mcpServers": {
    "wuthering-waves-platform": {
      "command": "npx",
      "args": [
        "-y",
        "--package",
        "wuthering-waves-platform",
        "wuthering-waves-platform-mcp"
      ]
    }
  }
}
```

登录命令对应为:

```bash
npx -y --package wuthering-waves-platform wuthering-waves-platform login
```

## 在 Pi 中使用

Pi 会自动读取对应的 MCP 配置。项目只使用 npm 包命令, 不依赖开发者本机路径。

如果 Pi 当前会话已经打开, 执行:

```text
/reload
/mcp
```

然后选择或重连 `wuthering-waves-platform`。也可以直接让 AI 查询:

```text
查看我的鸣潮角色练度
```

## 推荐使用顺序

```text
1. 运行 `wuthering-waves-platform login` 登录游戏账号
2. 调用 `waves_account_list` 查看账号
3. 调用 `waves_character_list` 查看角色
4. 调用 `waves_all_character_builds` 获取完整练度
5. 调用 `waves_analyze_build` 获取培养分析
```

## 数据展示开关

如果接口返回空数据, 请在库街区 App 的数据终端中打开对应数据的对外展示开关。角色面板、声骸、探索和挑战数据可能分别受展示开关影响。

## 当前阶段说明

当前阶段优先完成通用核心和 MCP 适配器。CLI 和 HTTP 适配器会复用同一套核心服务, 不会重新实现业务逻辑。

## 许可证

本项目复用了原 waves-plugin 的接口适配思路和部分评分规则, 保留 AGPL-3.0 许可证与原作者归属。原始项目地址:

https://github.com/erzaozi/waves-plugin


## Link

[linuxdo](https://linux.do)
