import {dialog, ipcMain} from "electron";
import {loadSettings, saveSettings} from "../settings";
import path from "path";
import fs from "fs";

/** Flat map of dot-notated keys → string values */
type FlatJson = Record<string, string>;

/** One namespace (file) with its keys merged across all languages */
interface NamespaceData {
    namespace: string;
    keys: {
        key: string;
        values: Record<string, string | null>; // langCode → value | null
    }[];
}

export type TranslationsIPC = {
    "translations:importFolder": () => Promise<AppSettings | null>;
    "translations:addLanguage": (code: string) => Promise<AppSettings>;
    "translations:removeLanguage": (code: string) => Promise<AppSettings>;
    "translations:removeFile": (code: string, absolutePath: string) => Promise<AppSettings>;
    "translations:readAll": () => Promise<NamespaceData[]>;
    "translations:updateKey": (namespace: string, key: string, langCode: string, value: string) => Promise<void>;
    "translations:addKey": (namespace: string, key: string) => Promise<void>;
    "translations:removeKey": (namespace: string, key: string) => Promise<void>;
};

const LOCALE_REGEX = /^[a-z]{2}-[A-Z]{2}$/;
const LOCALE_JSON_REGEX = /^[a-z]{2}-[A-Z]{2}\.json$/;
const DEFAULT_NAMESPACE = "default";

function scanJsonFiles(dirPath: string): TranslationFile[] {
    return fs.readdirSync(dirPath)
        .filter((name) => name.endsWith(".json"))
        .map((name) => ({
            absolutePath: path.join(dirPath, name),
            namespace: path.basename(name, ".json"),
        }));
}

/** Recursively flatten a nested JSON object into dot-notated keys */
export function flattenJson(obj: unknown, prefix = ""): FlatJson {
    const result: FlatJson = {};
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${k}` : k;
            if (v && typeof v === "object" && !Array.isArray(v)) {
                Object.assign(result, flattenJson(v, fullKey));
            } else {
                result[fullKey] = String(v ?? "");
            }
        }
    }
    return result;
}

/** Set a value at a dot-notated path, creating intermediary objects as needed */
export function setNestedValue(obj: Record<string, unknown>, dottedKey: string, value: string) {
    const parts = dottedKey.split(".");
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in current) || typeof current[parts[i]] !== "object" || current[parts[i]] === null) {
            current[parts[i]] = {};
        }
        current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
}

/** Remove a value at a dot-notated path. Cleans up empty parent objects. */
function removeNestedKey(obj: Record<string, unknown>, dottedKey: string) {
    const parts = dottedKey.split(".");
    const stack: {parent: Record<string, unknown>; key: string}[] = [];
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in current) || typeof current[parts[i]] !== "object") return;
        stack.push({parent: current, key: parts[i]});
        current = current[parts[i]] as Record<string, unknown>;
    }

    delete current[parts[parts.length - 1]];

    // Clean up empty parent objects bottom-up
    for (let i = stack.length - 1; i >= 0; i--) {
        const child = stack[i].parent[stack[i].key] as Record<string, unknown>;
        if (Object.keys(child).length === 0) {
            delete stack[i].parent[stack[i].key];
        } else {
            break;
        }
    }
}

/** Recursively sort object keys alphabetically */
function sortDeep(obj: Record<string, unknown>): Record<string, unknown> {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))) {
        const val = obj[key];
        sorted[key] = val && typeof val === "object" && !Array.isArray(val)
            ? sortDeep(val as Record<string, unknown>)
            : val;
    }
    return sorted;
}

export function readJsonFile(filePath: string): Record<string, unknown> {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
        return {};
    }
}

/** Write JSON back to disk with sorted keys */
export function writeJsonFile(filePath: string, json: Record<string, unknown>) {
    fs.writeFileSync(filePath, JSON.stringify(sortDeep(json), null, 2), "utf8");
}

/** Ensure a file exists for the given language + namespace, creating it if needed */
export function ensureFile(settings: AppSettings, langCode: string, namespace: string): TranslationFile | null {
    const lang = settings.languages.find((l) => l.code === langCode);
    if (!lang) return null;

    let file = lang.files.find((f) => f.namespace === namespace);
    if (!file && settings.rootFolder) {
        let filePath: string;
        if (settings.folderStructure === "flat") {
            filePath = path.join(settings.rootFolder, `${langCode}.json`);
        } else {
            const dirPath = path.join(settings.rootFolder, langCode);
            if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, {recursive: true});
            filePath = path.join(dirPath, `${namespace}.json`);
        }
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify({}, null, 2), "utf8");
        }
        file = {absolutePath: filePath, namespace};
        lang.files.push(file);
        saveSettings(settings);
    }
    return file ?? null;
}

export function registerTranslationHandlers() {
    // ── Import root folder ──────────────────────────────────────────────
    ipcMain.handle("translations:importFolder", async () => {
        const result = await dialog.showOpenDialog({properties: ["openDirectory"]});
        if (result.canceled || result.filePaths.length === 0) return null;

        const rootPath = result.filePaths[0];
        const entries = fs.readdirSync(rootPath, {withFileTypes: true});

        const settings = loadSettings();
        settings.rootFolder = rootPath;
        settings.languages = [];

        // Try namespaced first: look for locale subdirectories
        for (const entry of entries) {
            if (!entry.isDirectory() || !LOCALE_REGEX.test(entry.name)) continue;
            const files = scanJsonFiles(path.join(rootPath, entry.name));
            if (files.length === 0) continue;
            settings.languages.push({code: entry.name, files});
        }

        if (settings.languages.length > 0) {
            settings.folderStructure = "namespaced";
        } else {
            // Try flat: look for locale-named JSON files in root
            for (const entry of entries) {
                if (!entry.isFile() || !LOCALE_JSON_REGEX.test(entry.name)) continue;
                const code = path.basename(entry.name, ".json");
                settings.languages.push({
                    code,
                    files: [{absolutePath: path.join(rootPath, entry.name), namespace: DEFAULT_NAMESPACE}],
                });
            }
            settings.folderStructure = settings.languages.length > 0 ? "flat" : "namespaced";
        }

        return saveSettings(settings);
    });

    // ── Add a new language ────────────────────────────────────────────────
    ipcMain.handle("translations:addLanguage", async (_e, code: string) => {
        const settings = loadSettings();
        if (!settings.rootFolder) return settings;
        if (settings.languages.some((l) => l.code === code)) return settings;

        const files: TranslationFile[] = [];

        if (settings.folderStructure === "flat") {
            // Flat mode: create a single file in root
            const filePath = path.join(settings.rootFolder, `${code}.json`);
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, JSON.stringify({}, null, 2), "utf8");
            }
            files.push({absolutePath: filePath, namespace: DEFAULT_NAMESPACE});
        } else {
            // Namespaced mode: create subfolder with namespace files
            const allNamespaces = new Set<string>();
            for (const lang of settings.languages) {
                for (const file of lang.files) allNamespaces.add(file.namespace);
            }

            const dirPath = path.join(settings.rootFolder, code);
            if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, {recursive: true});

            for (const ns of allNamespaces) {
                const filePath = path.join(dirPath, `${ns}.json`);
                if (!fs.existsSync(filePath)) {
                    fs.writeFileSync(filePath, JSON.stringify({}, null, 2), "utf8");
                }
                files.push({absolutePath: filePath, namespace: ns});
            }
        }

        settings.languages.push({code, files});
        return saveSettings(settings);
    });

    // ── Remove a whole language ─────────────────────────────────────────
    ipcMain.handle("translations:removeLanguage", async (_e, code: string) => {
        const settings = loadSettings();
        settings.languages = settings.languages.filter((l) => l.code !== code);
        return saveSettings(settings);
    });

    // ── Remove a single file ref ────────────────────────────────────────
    ipcMain.handle("translations:removeFile", async (_e, code: string, absolutePath: string) => {
        const settings = loadSettings();
        const lang = settings.languages.find((l) => l.code === code);
        if (lang) {
            lang.files = lang.files.filter((f) => f.absolutePath !== absolutePath);
            if (lang.files.length === 0) {
                settings.languages = settings.languages.filter((l) => l.code !== code);
            }
        }
        return saveSettings(settings);
    });

    // ── Read all translation data ───────────────────────────────────────
    ipcMain.handle("translations:readAll", async (): Promise<NamespaceData[]> => {
        const settings = loadSettings();
        const langCodes = settings.languages.map((l) => l.code);

        const allNamespaces = new Set<string>();
        for (const lang of settings.languages) {
            for (const file of lang.files) allNamespaces.add(file.namespace);
        }

        const result: NamespaceData[] = [];

        for (const ns of [...allNamespaces].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))) {
            const langMaps: Record<string, FlatJson> = {};
            const allKeys = new Set<string>();

            for (const lang of settings.languages) {
                const file = lang.files.find((f) => f.namespace === ns);
                if (file) {
                    const flat = flattenJson(readJsonFile(file.absolutePath));
                    langMaps[lang.code] = flat;
                    for (const k of Object.keys(flat)) allKeys.add(k);
                } else {
                    langMaps[lang.code] = {};
                }
            }

            const keys = [...allKeys].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })).map((key) => ({
                key,
                values: Object.fromEntries(
                    langCodes.map((code) => [code, langMaps[code]?.[key] ?? null])
                ),
            }));

            result.push({namespace: ns, keys});
        }

        return result;
    });

    // ── Update a single key for a given language ────────────────────────
    ipcMain.handle("translations:updateKey", async (_e, namespace: string, key: string, langCode: string, value: string) => {
        const settings = loadSettings();
        const file = ensureFile(settings, langCode, namespace);
        if (!file) return;

        const json = readJsonFile(file.absolutePath);
        setNestedValue(json, key, value);
        writeJsonFile(file.absolutePath, json);
    });

    // ── Add a new key to all languages ──────────────────────────────────
    ipcMain.handle("translations:addKey", async (_e, namespace: string, key: string) => {
        const settings = loadSettings();

        for (const lang of settings.languages) {
            const file = ensureFile(settings, lang.code, namespace);
            if (!file) continue;

            const json = readJsonFile(file.absolutePath);
            // Only add if the key doesn't already exist
            const flat = flattenJson(json);
            if (!(key in flat)) {
                setNestedValue(json, key, "");
                writeJsonFile(file.absolutePath, json);
            }
        }
    });

    // ── Remove a key from all languages ─────────────────────────────────
    ipcMain.handle("translations:removeKey", async (_e, namespace: string, key: string) => {
        const settings = loadSettings();

        for (const lang of settings.languages) {
            const file = lang.files.find((f) => f.namespace === namespace);
            if (!file) continue;

            const json = readJsonFile(file.absolutePath);
            removeNestedKey(json, key);
            writeJsonFile(file.absolutePath, json);
        }
    });
}
