import { spawn } from 'child_process';
import path from 'path';

const scriptPath = path.resolve(process.cwd(), '../scripts/migrate_sql_to_mongo.py');
const pythonCmd = process.env.VOXMIND_MIGRATION_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

console.log(`Running SQL-to-Mongo migration via: ${scriptPath}`);

const child = spawn(pythonCmd, [scriptPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false,
});

child.on('error', () => { console.error('Install Python and scripts/requirements-migration.txt before running this optional migration.'); process.exitCode = 1; });

child.on('exit', (code) => {
  if (code === 0) {
    console.log('Migration process completed successfully.');
  } else {
    console.error(`Migration process exited with code ${code}`);
  }
  process.exit(code ?? 0);
});
