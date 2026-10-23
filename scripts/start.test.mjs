import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseEnv } from 'node:util';
import { main, prepareEnvironment } from './start.mjs';

function fixture(t, template = 'JWT_SECRET=\nINTEGRATION_ENCRYPTION_KEY=\n') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'voxmind-start-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'backend'));
  fs.writeFileSync(path.join(root, '.env.example'), template);
  return root;
}

function readEnvironment(root) {
  return parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8'));
}

test('first start generates private, stable secrets without modifying the template', (t) => {
  const root = fixture(t);
  const template = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  prepareEnvironment(root);
  const first = readEnvironment(root);
  assert.match(first.JWT_SECRET, /^[a-f0-9]{64}$/);
  assert.match(first.INTEGRATION_ENCRYPTION_KEY, /^[a-f0-9]{64}$/);
  assert.notEqual(first.JWT_SECRET, first.INTEGRATION_ENCRYPTION_KEY);
  prepareEnvironment(root);
  assert.deepEqual(readEnvironment(root), first);
  assert.equal(fs.readFileSync(path.join(root, '.env.example'), 'utf8'), template);
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(path.join(root, '.env')).mode & 0o777, 0o600);
  }
});

test('existing root credentials win and unrelated settings remain intact', (t) => {
  const root = fixture(t);
  const existing = '# Keep my settings\nJWT_SECRET=existing-jwt-secret\nINTEGRATION_ENCRYPTION_KEY=existing-key\nZOOM_CLIENT_SECRET=keep-me\nCUSTOM_VALUE=42\n';
  fs.writeFileSync(path.join(root, '.env'), existing);
  fs.writeFileSync(path.join(root, 'backend', '.env'), 'INTEGRATION_ENCRYPTION_KEY=other-key\nZOOM_CLIENT_SECRET=other-secret\n');
  prepareEnvironment(root);
  assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), existing);
});

test('existing backend OAuth credentials and encryption key survive moving to Docker', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'backend', '.env'), 'INTEGRATION_ENCRYPTION_KEY=existing-key\nGOOGLE_CLIENT_ID=google-id\nGOOGLE_CLIENT_SECRET="secret$with#characters"\nMONGO_URI=mongodb://localhost:27017/voxmind\n');
  prepareEnvironment(root);
  const values = readEnvironment(root);
  assert.equal(values.INTEGRATION_ENCRYPTION_KEY, 'existing-key');
  assert.equal(values.GOOGLE_CLIENT_ID, 'google-id');
  assert.equal(values.GOOGLE_CLIENT_SECRET, 'secret$with#characters');
  assert.equal(values.MONGO_URI, undefined);
});

test('old public Docker JWT placeholder is replaced', (t) => {
  const root = fixture(t, 'JWT_SECRET=voxmind-default-docker-secret-key-32chars-min-change-prod\n');
  prepareEnvironment(root);
  assert.match(readEnvironment(root).JWT_SECRET, /^[a-f0-9]{64}$/);
});

test('startup checks Docker, prepares secrets, then waits for all services', async (t) => {
  const root = fixture(t);
  const calls = [];
  await main('start', root, async (args) => {
    calls.push(args);
    if (args.includes('up')) assert.match(readEnvironment(root).JWT_SECRET, /^[a-f0-9]{64}$/);
  });
  assert.deepEqual(calls, [
    ['compose', 'version'], ['info'],
    ['compose', 'up', '--build', '--detach', '--wait', '--wait-timeout', '1200'],
    ['compose', 'up', '--detach', 'ollama_model'],
  ]);
});

test('missing Docker fails before writing settings or attempting startup', async (t) => {
  const root = fixture(t);
  await assert.rejects(main('start', root, async () => { throw new Error('not available'); }), /Docker Desktop/);
  assert.equal(fs.existsSync(path.join(root, '.env')), false);
});

test('failed startup gives a log command instead of reporting success', async (t) => {
  const root = fixture(t);
  await assert.rejects(main('start', root, async (args) => {
    if (args.includes('up')) throw new Error('unhealthy');
  }), /npm run logs/);
});

test('stop preserves volumes and logs does not regenerate settings', async (t) => {
  const root = fixture(t);
  const calls = [];
  const execute = async (args) => calls.push(args);
  await main('stop', root, execute);
  assert.deepEqual(calls.at(-1), ['compose', '--profile', 'models', 'down']);
  await main('logs', root, execute);
  assert.deepEqual(calls.at(-1), ['compose', '--profile', 'models', 'logs', '--follow', '--tail', '100']);
  assert.equal(fs.existsSync(path.join(root, '.env')), false);
});
