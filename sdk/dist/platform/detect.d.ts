/**
 * Auto-detects platform & action from the runtime environment.
 * Internal — never exposed to the user.
 */
export declare function detectPlatform(): string;
export declare function detectPlatformApiUrl(): string;
/**
 * Inspects the call stack to infer the action name.
 * Walks back past internal SDK frames and uses the first user-land function name.
 * Falls back to 'execute' if not determinable.
 */
export declare function detectAction(): string;
//# sourceMappingURL=detect.d.ts.map