"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.prompt = prompt;
exports.promptHidden = promptHidden;
exports.confirm = confirm;
const readline = __importStar(require("node:readline"));
function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
function promptHidden(question) {
    return new Promise(resolve => {
        process.stdout.write(question);
        const stdin = process.stdin;
        const wasRaw = stdin.isRaw === true;
        if (stdin.setRawMode)
            stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        let buf = '';
        const onData = (ch) => {
            for (const c of ch) {
                if (c === '\n' || c === '\r' || c === '') {
                    if (stdin.setRawMode)
                        stdin.setRawMode(wasRaw);
                    stdin.pause();
                    stdin.removeListener('data', onData);
                    process.stdout.write('\n');
                    resolve(buf.trim());
                    return;
                }
                if (c === '') {
                    process.stdout.write('\n');
                    process.exit(130);
                }
                if (c === '' || c === '\b') {
                    buf = buf.slice(0, -1);
                    continue;
                }
                buf += c;
            }
        };
        stdin.on('data', onData);
    });
}
async function confirm(question, defaultYes = false) {
    const hint = defaultYes ? '[Y/n]' : '[y/N]';
    const ans = (await prompt(`${question} ${hint} `)).toLowerCase();
    if (!ans)
        return defaultYes;
    return ans === 'y' || ans === 'yes';
}
