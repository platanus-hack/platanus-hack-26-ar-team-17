"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeText = normalizeText;
const ZERO_WIDTH_CHARS = /[​-‍﻿­͏ᅟᅠ឴឵᠋-᠍​-‏]/g;
function normalizeText(text) {
    if (!text)
        return '';
    let result = text;
    try {
        result = decodeURIComponent(result);
    }
    catch {
        // use original if decode fails
    }
    return result.normalize('NFKC').replace(ZERO_WIDTH_CHARS, '');
}
