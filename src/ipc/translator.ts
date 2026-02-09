import {ipcMain, BrowserWindow} from "electron";
import {loadSettings} from "../settings";
import {app} from "electron";
import path from "path";
import fs from "fs";
import https from "https";

export type TranslatorIPC = {
    "translator:translate": (text: string, fromLang: string, toLang: string, cacheKey: string) => Promise<string>;
    "translator:getUsage": () => Promise<{ characterCount: number; characterLimit: number }>;
};

// Track pending usage update to debounce renderer notifications
let usageUpdateTimer: ReturnType<typeof setTimeout> | null = null;

// Translation cache stored in userData
const cachePath = path.join(app.getPath("userData"), "translation-cache.json");
const usagePath = path.join(app.getPath("userData"), "translation-usage.json");

interface TranslationCache {
    [cacheKey: string]: {
        translation: string;
        timestamp: number;
        sourceText: string;
    };
}

interface TranslationUsage {
    characterCount: number;
    lastReset: number; // timestamp
}

function loadCache(): TranslationCache {
    try {
        if (fs.existsSync(cachePath)) {
            return JSON.parse(fs.readFileSync(cachePath, "utf8"));
        }
    } catch (err) {
        console.error("Failed to load translation cache:", err);
    }
    return {};
}

function saveCache(cache: TranslationCache) {
    try {
        fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
    } catch (err) {
        console.error("Failed to save translation cache:", err);
    }
}

async function fetchDeepLUsage(apiKey: string): Promise<{ characterCount: number; characterLimit: number }> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "api-free.deepl.com",
            path: "/v2/usage",
            method: "GET",
            headers: {
                "Authorization": `DeepL-Auth-Key ${apiKey}`,
            },
        };

        const req = https.request(options, (res) => {
            let data = "";

            res.on("data", (chunk) => {
                data += chunk;
            });

            res.on("end", () => {
                try {
                    if (res.statusCode !== 200) {
                        reject(new Error(`DeepL API error: ${res.statusCode} - ${data}`));
                        return;
                    }

                    const result = JSON.parse(data);
                    if (result && typeof result.character_count === "number" && typeof result.character_limit === "number") {
                        resolve({
                            characterCount: result.character_count,
                            characterLimit: result.character_limit,
                        });
                    } else {
                        reject(new Error("Unexpected response format from DeepL usage API"));
                    }
                } catch (err) {
                    reject(err);
                }
            });
        });

        req.on("error", (err) => {
            reject(err);
        });

        req.end();
    });
}

function loadUsage(): TranslationUsage {
    try {
        if (fs.existsSync(usagePath)) {
            const data = JSON.parse(fs.readFileSync(usagePath, "utf8"));
            // Reset monthly (30 days)
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            if (data.lastReset < thirtyDaysAgo) {
                return { characterCount: 0, lastReset: Date.now() };
            }
            return data;
        }
    } catch (err) {
        console.error("Failed to load usage:", err);
    }
    return { characterCount: 0, lastReset: Date.now() };
}

function saveUsage(usage: TranslationUsage) {
    try {
        fs.writeFileSync(usagePath, JSON.stringify(usage, null, 2));
    } catch (err) {
        console.error("Failed to save usage:", err);
    }
}

function incrementUsage(characterCount: number) {
    const usage = loadUsage();
    usage.characterCount += characterCount;
    saveUsage(usage);
}

function notifyUsageUpdate() {
    // Clear any existing timer
    if (usageUpdateTimer) {
        clearTimeout(usageUpdateTimer);
    }

    // Debounce: only notify renderer after 1 second of no new translations
    usageUpdateTimer = setTimeout(() => {
        for (const win of BrowserWindow.getAllWindows()) {
            win.webContents.send("translator:usage-updated");
        }
    }, 1000);
}

async function translateWithDeepL(
    text: string,
    fromLang: string,
    toLang: string,
    apiKey: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        // Convert language codes from xx-XX to XX (uppercase)
        const sourceLang = fromLang.split("-")[0].toUpperCase();
        const targetLang = toLang.split("-")[0].toUpperCase();

        const body = JSON.stringify({
            text: [text],
            source_lang: sourceLang,
            target_lang: targetLang,
        });

        const options = {
            hostname: "api-free.deepl.com",
            path: "/v2/translate",
            method: "POST",
            headers: {
                "Authorization": `DeepL-Auth-Key ${apiKey}`,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
            },
        };

        const req = https.request(options, (res) => {
            let data = "";

            res.on("data", (chunk) => {
                data += chunk;
            });

            res.on("end", () => {
                try {
                    if (res.statusCode !== 200) {
                        reject(new Error(`DeepL API error: ${res.statusCode} - ${data}`));
                        return;
                    }

                    const result = JSON.parse(data);
                    if (result && result.translations && result.translations[0]) {
                        resolve(result.translations[0].text);
                    } else {
                        reject(new Error("Unexpected response format from DeepL"));
                    }
                } catch (err) {
                    reject(err);
                }
            });
        });

        req.on("error", (err) => {
            reject(err);
        });

        req.write(body);
        req.end();
    });
}

async function translate(
    text: string,
    fromLang: string,
    toLang: string,
    cacheKey: string
): Promise<string> {
    const cache = loadCache();

    // Check cache - only use if source text matches
    if (cache[cacheKey] && cache[cacheKey].sourceText === text) {
        return cache[cacheKey].translation;
    }

    // Get settings
    const settings = loadSettings();

    if (!settings.deeplApiKey) {
        throw new Error("DeepL API key not configured");
    }

    const translation = await translateWithDeepL(
        text,
        fromLang,
        toLang,
        settings.deeplApiKey
    );

    // Track usage
    incrementUsage(text.length);

    // Notify renderer to update usage display (debounced)
    notifyUsageUpdate();

    // Update cache
    cache[cacheKey] = {
        translation,
        timestamp: Date.now(),
        sourceText: text,
    };
    saveCache(cache);

    return translation;
}

export function registerTranslatorHandlers() {
    ipcMain.handle("translator:translate", async (_e, text: string, fromLang: string, toLang: string, cacheKey: string) => {
        return translate(text, fromLang, toLang, cacheKey);
    });

    ipcMain.handle("translator:getUsage", async () => {
        const settings = loadSettings();

        if (!settings.deeplApiKey) {
            // Return 0 if no API key configured
            return { characterCount: 0, characterLimit: 500000 };
        }

        try {
            // Fetch real usage from DeepL API
            return await fetchDeepLUsage(settings.deeplApiKey);
        } catch (err) {
            console.error("Failed to fetch DeepL usage:", err);
            // Fallback to local tracking if API call fails
            const localUsage = loadUsage();
            return { characterCount: localUsage.characterCount, characterLimit: 500000 };
        }
    });
}
