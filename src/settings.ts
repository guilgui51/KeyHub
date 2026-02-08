// electron/config/settings.ts
import fs from "fs";
import path from "path";
import {app} from "electron";

const settingsPath = path.join(app.getPath("userData"), "settings.json");

// Default values
const defaultSettings: AppSettings = {
    rootFolder: null,
    languages: [],
    serverPort: 5874,
    serverAutoStart: false,
    deeplApiKey: "",
};

export function loadSettings(): AppSettings {
    try {
        if (!fs.existsSync(settingsPath)) {
            fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
            return defaultSettings;
        }
        const raw = fs.readFileSync(settingsPath, "utf8");
        return { ...defaultSettings, ...JSON.parse(raw) };
    } catch (err) {
        console.error("Failed to read settings:", err);
        return defaultSettings;
    }
}

export function saveSettings(data: Partial<AppSettings>): AppSettings {
    const current = loadSettings();
    const updated = { ...current, ...data };
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2));
    } catch (err) {
        console.error("Failed to write settings:", err);
    }
    return updated;
}
