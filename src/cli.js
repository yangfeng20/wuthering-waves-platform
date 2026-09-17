#!/usr/bin/env node
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createConfig } from './config.js';
import { serializeError } from './errors.js';
import { createServices } from './services/index.js';

const config = createConfig();
const services = createServices(config);

async function promptLogin() {
  const rl = readline.createInterface({ input, output });
  try {
    const mobile = await rl.question('手机号: ');
    const code = await rl.question('验证码: ');
    const label = await rl.question('账号名称(可选): ');
    const account = await services.accounts.loginBySms({ mobile, code, label: label || undefined });
    console.log(JSON.stringify(account, null, 2));
  } finally {
    rl.close();
  }
}

async function main() {
  await services.store.ensure();
  const command = process.argv[2] || 'help';
  if (command === 'login') {
    await promptLogin();
    return;
  }
  if (command === 'accounts') {
    console.log(JSON.stringify(await services.accounts.list(), null, 2));
    return;
  }
  if (command === 'validate') {
    console.log(JSON.stringify(await services.accounts.validate(process.argv[3]), null, 2));
    return;
  }
  if (command === 'diagnose') {
    console.log(JSON.stringify(await services.accounts.diagnose(process.argv[3]), null, 2));
    return;
  }
  console.log('waves-platform 可用命令:');
  console.log('  pnpm run waves:login     使用短信验证码登录');
  console.log('  pnpm run waves:accounts  查看已保存账号');
  console.log('  pnpm run waves:validate  检查当前账号 Token');
  console.log('  pnpm run waves:diagnose  诊断账号和角色数据接口');
}

main().catch(error => {
  console.error(JSON.stringify(serializeError(error), null, 2));
  process.exitCode = 1;
});
