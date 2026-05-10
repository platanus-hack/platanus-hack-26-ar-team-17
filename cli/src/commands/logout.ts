import { clearConfig, configPath } from '../config';
import { ok, dim } from '../util/print';

export async function logout(): Promise<number> {
  clearConfig();
  ok('Signed out.');
  process.stdout.write(`  ${dim(`removed ${configPath()}`)}\n`);
  return 0;
}
