"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cyan = exports.yellow = exports.green = exports.red = exports.bold = exports.dim = void 0;
exports.info = info;
exports.ok = ok;
exports.warn = warn;
exports.err = err;
exports.kv = kv;
const isTTY = process.stdout.isTTY === true;
const useColor = isTTY && process.env.NO_COLOR === undefined;
const wrap = (open, close) => (s) => useColor ? `\x1b[${open}m${s}\x1b[${close}m` : s;
exports.dim = wrap('2', '22');
exports.bold = wrap('1', '22');
exports.red = wrap('31', '39');
exports.green = wrap('32', '39');
exports.yellow = wrap('33', '39');
exports.cyan = wrap('36', '39');
function info(msg) {
    process.stdout.write(`${msg}\n`);
}
function ok(msg) {
    process.stdout.write(`${(0, exports.green)('✓')} ${msg}\n`);
}
function warn(msg) {
    process.stderr.write(`${(0, exports.yellow)('!')} ${msg}\n`);
}
function err(msg) {
    process.stderr.write(`${(0, exports.red)('✗')} ${msg}\n`);
}
function kv(key, value) {
    process.stdout.write(`  ${(0, exports.dim)(key.padEnd(14))} ${value}\n`);
}
