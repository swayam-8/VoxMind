import { spawn } from 'child_process';
import path from 'path';

const scriptPath = path.resolve(process.cwd(), '../scripts/migrate_sql_to_mongo.py');
const pythonCmd = process.platform === 'win32'
  ? path.resolve(process.cwd(), '.venv/Scripts/python.exe')
  : path.resolve(process.cwd(), '.venv/bin/python');

console.log(`Running SQL-to-Mongo migration via: ${scriptPath}`);

const child = spawn(pythonCmd, [scriptPath], {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('Migration process completed successfully.');
  } else {
    console.error(`Migration process exited with code ${code}`);
  }
  process.exit(code ?? 0);
});
