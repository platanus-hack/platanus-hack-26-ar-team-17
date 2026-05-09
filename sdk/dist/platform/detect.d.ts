/**
 * Auto-detects platform & action from the runtime environment.
 * Internal — never exposed to the user.
 */
export declare const PLATFORM_API_URL = "https://next-app-ochre-zeta.vercel.app";
export declare function detectPlatform(): string;
/**
 * Inspects the call stack to infer the action name.
 * Walks back past internal SDK frames and uses the first user-land function name.
 * Falls back to 'execute' if not determinable.
 */
export declare function detectAction(): string;
//# sourceMappingURL=detect.d.ts.map