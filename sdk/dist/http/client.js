"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.post = post;
const https_1 = __importDefault(require("https"));
const url_1 = require("url");
async function post(url, body) {
    const parsed = new url_1.URL(url);
    if (parsed.protocol !== 'https:') {
        throw new Error('HTTPS required — HTTP is not allowed for security reasons');
    }
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: parsed.pathname + parsed.search,
            method: 'POST',
            protocol: 'https:',
            rejectUnauthorized: true,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
        };
        const req = https_1.default.request(options, (res) => {
            let raw = '';
            res.on('data', (chunk) => (raw += chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(raw));
                }
                catch {
                    reject(new Error('Invalid JSON response from Platform API'));
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}
