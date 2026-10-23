import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const target = path.resolve(process.cwd(), ".env");
const existing = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
const match = existing.match(/^INTEGRATION_ENCRYPTION_KEY=(.*)$/m);
if (process.env.INTEGRATION_ENCRYPTION_KEY || match?.[1]?.trim()) {
  console.log(
    "An integration encryption key is already configured. Existing values were preserved.",
  );
} else {
  const entry = `INTEGRATION_ENCRYPTION_KEY=${crypto.randomBytes(32).toString("hex")}`;
  const updated = match
    ? existing.replace(/^INTEGRATION_ENCRYPTION_KEY=.*$/m, entry)
    : `${existing}${existing.endsWith("\n") || !existing ? "" : "\n"}${entry}\n`;
  fs.writeFileSync(target, updated, { mode: 0o600 });
  fs.chmodSync(target, 0o600);
  console.log(
    "Created an encryption key in backend/.env. Keep this file private and retain the key across restarts.",
  );
}
