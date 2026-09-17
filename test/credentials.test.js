import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { CredentialStore } from '../src/storage/credentials.js';

test('凭据存储应隐藏 Token 并支持当前账号', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'waves-platform-'));
  const store = new CredentialStore({
    dataDir,
    credentialsPath: path.join(dataDir, 'credentials.json'),
    envToken: '',
    envUserId: '',
    envServerId: '',
    envRoleId: '',
    envAccountId: 'env',
  });
  const account = await store.upsert({
    id: 'main',
    label: '测试账号',
    token: 'secret-token',
    userId: 'user-1',
    serverId: 'server-1',
    roleId: 'role-1',
    did: 'device-1',
  });
  assert.equal(account.token, undefined);
  const resolved = await store.resolve('main');
  assert.equal(resolved.token, 'secret-token');
  assert.equal(resolved.did, 'device-1');
  const listed = await store.list();
  assert.equal(listed[0].token, undefined);
});
