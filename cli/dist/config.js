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
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.clearConfig = clearConfig;
exports.configPath = configPath;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const DEFAULT_API_URL = 'http://localhost:3000';
function configDir() {
    return path.join(os.homedir(), '.zero-gate');
}
function configFile() {
    return path.join(configDir(), 'config.json');
}
function loadConfig() {
    const file = configFile();
    let stored = {};
    if (fs.existsSync(file)) {
        try {
            stored = JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        catch {
            stored = {};
        }
    }
    const apiUrl = process.env.ZEROGATE_URL?.replace(/\/$/, '') ??
        stored.apiUrl ??
        DEFAULT_API_URL;
    return {
        apiUrl,
        token: process.env.ZEROGATE_TOKEN ?? stored.token,
        userId: stored.userId,
        displayName: stored.displayName,
    };
}
function saveConfig(cfg) {
    const dir = configDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = configFile();
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2), { mode: 0o600 });
    try {
        fs.chmodSync(file, 0o600);
    }
    catch {
    }
}
function clearConfig() {
    const file = configFile();
    if (fs.existsSync(file))
        fs.unlinkSync(file);
}
function configPath() {
    return configFile();
}
