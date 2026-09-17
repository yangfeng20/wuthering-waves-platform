import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('MCP stdio 应暴露能力工具', async () => {
  const dataDir = await fsMkdtemp();
  const client = new Client({ name: 'waves-platform-test', version: '0.1.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(projectRoot, 'src/mcp/server.js')],
    cwd: projectRoot,
    env: { ...process.env, WAVES_DATA_DIR: dataDir },
    stderr: 'pipe',
  });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map(tool => tool.name);
    assert.ok(names.includes('waves_all_character_builds'));
    assert.ok(names.includes('waves_account_login_sms'));
    assert.ok(names.includes('waves_wiki_entry'));
    const result = await client.callTool({ name: 'waves_capabilities', arguments: {} });
    assert.equal(result.isError, undefined);
    assert.ok(result.structuredContent);
    const accountList = await client.callTool({ name: 'waves_account_list', arguments: {} });
    assert.equal(accountList.isError, undefined);
    assert.ok(accountList.structuredContent);
    assert.ok(Array.isArray(accountList.structuredContent.items));
  } finally {
    await client.close();
  }
});

async function fsMkdtemp() {
  const fs = await import('node:fs/promises');
  return fs.mkdtemp(path.join(os.tmpdir(), 'waves-mcp-test-'));
}
