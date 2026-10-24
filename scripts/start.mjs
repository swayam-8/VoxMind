import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const integrationSettings = [
  'INTEGRATION_ENCRYPTION_KEY',
  'AI_INTERNAL_SECRET',
  'INTEGRATIONS_API_BASE_URL',
  'FRONTEND_URL',
  'ZOOM_CLIENT_ID',
  'ZOOM_CLIENT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_AUTH_CLIENT_ID',
  'GOOGLE_AUTH_CLIENT_SECRET',
  'AUTH_API_BASE_URL',
  'WEBEX_CLIENT_ID',
  'WEBEX_CLIENT_SECRET',
];
const placeholderSecrets = new Set([
  'voxmind-change-me-to-a-secure-random-32-plus-char-secret-key-12345',
  'voxmind-default-docker-secret-key-32chars-min-change-prod',
]);

// Keep generated secrets stable across restarts, and reuse existing OAuth settings.
export function prepareEnvironment(root) {
  const target = path.join(root, '.env');
  let source = fs.readFileSync(
    fs.existsSync(target) ? target : path.join(root, '.env.example'), 'utf8',
  );
  const values = parseEnv(source);
  const backendFile = path.join(root, 'backend', '.env');
  const backend = fs.existsSync(backendFile)
    ? parseEnv(fs.readFileSync(backendFile, 'utf8')) : {};

  function set(key, value) {
    // Single quotes preserve literal $, #, backslashes and double quotes in Compose.
    const entry = `${key}='${value.replaceAll("'", "\\'")}'`;
    const existing = new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`, 'm');
    source = existing.test(source)
      ? source.replace(existing, () => entry)
      : `${source.trimEnd()}\n${entry}\n`;
    values[key] = value;
  }

  for (const key of integrationSettings) {
    if (!values[key] && backend[key]) set(key, backend[key]);
  }
  if (!values.JWT_SECRET || placeholderSecrets.has(values.JWT_SECRET)) {
    set('JWT_SECRET', randomBytes(32).toString('hex'));
  }
  if (!values.INTEGRATION_ENCRYPTION_KEY) {
    set('INTEGRATION_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
  }
  if (!values.AI_INTERNAL_SECRET || values.AI_INTERNAL_SECRET === 'voxmind-internal-ai-service-secret') {
    set('AI_INTERNAL_SECRET', randomBytes(32).toString('hex'));
  }
  fs.writeFileSync(target, source, { mode: 0o600 });
  if (process.platform !== 'win32') fs.chmodSync(target, 0o600);
}

function docker(args, root, quiet = false) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      cwd: root,
      stdio: quiet ? 'ignore' : 'inherit',
      windowsHide: true,
    });
    child.once('error', () => reject(new Error('Install Docker Desktop and make sure it is running.')));
    child.once('exit', (code) => code === 0
      ? resolve()
      : reject(new Error(`Docker command failed (${code ?? 'interrupted'}).`)));
  });
}

export async function main(action = 'start', root = projectRoot, execute = docker) {
  if (!['start', 'stop', 'logs'].includes(action)) {
    throw new Error('Use npm start, npm stop, or npm run logs.');
  }
  try {
    await execute(['compose', 'version'], root, true);
    await execute(['info'], root, true);
  } catch {
    throw new Error('Docker Desktop must be installed and running. Start it, then try again.');
  }

  if (action === 'stop') {
    await execute(['compose', '--profile', 'models', 'down'], root);
    console.log('MeetingBrief stopped. Your database, recordings and models are preserved.');
    return;
  }
  if (action === 'logs') {
    await execute(['compose', '--profile', 'models', 'logs', '--follow', '--tail', '100'], root);
    return;
  }

  prepareEnvironment(root);
  console.log('Starting all MeetingBrief services. The first run downloads and builds images and can take several minutes.');
  console.log('If a port is in use, stop the old development server and run npm start again.');
  try {
    await execute(['compose', 'up', '--build', '--detach', '--wait', '--wait-timeout', '1200'], root);
    // Keep the website available while the initial LLM download runs in the background.
    await execute(['compose', 'up', '--detach', 'ollama_model'], root);
  } catch {
    throw new Error('Startup did not finish. Run npm run logs for details, then retry npm start.');
  }
  console.log('\nMeetingBrief is ready: http://localhost:5173');
  console.log('On the first run, AI summaries become available after the background model download finishes.');
  console.log('Stop everything: npm stop\nView logs: npm run logs');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv[2]).catch((error) => {
    console.error(`\n[MeetingBrief] ${error.message}`);
    process.exitCode = 1;
  });
}
