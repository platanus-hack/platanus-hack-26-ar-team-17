const isTTY = process.stdout.isTTY === true;
const useColor = isTTY && process.env.NO_COLOR === undefined;

const wrap = (open: string, close: string) => (s: string) =>
  useColor ? `\x1b[${open}m${s}\x1b[${close}m` : s;

export const dim = wrap('2', '22');
export const bold = wrap('1', '22');
export const red = wrap('31', '39');
export const green = wrap('32', '39');
export const yellow = wrap('33', '39');
export const cyan = wrap('36', '39');

export function info(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

export function ok(msg: string): void {
  process.stdout.write(`${green('✓')} ${msg}\n`);
}

export function warn(msg: string): void {
  process.stderr.write(`${yellow('!')} ${msg}\n`);
}

export function err(msg: string): void {
  process.stderr.write(`${red('✗')} ${msg}\n`);
}

export function kv(key: string, value: string): void {
  process.stdout.write(`  ${dim(key.padEnd(14))} ${value}\n`);
}
