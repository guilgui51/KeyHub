import {ipcMain} from "electron";
import {loadSettings, saveSettings} from "../settings";

export type SettingsIPC = {
    "settings:get": () => Promise<AppSettings>;
    "settings:update": (data: Partial<AppSettings>) => Promise<AppSettings>;
}

export function registerSettingsHandlers() {
    ipcMain.handle("settings:get", async () => {
        return loadSettings();
    });

    ipcMain.handle("settings:update", async (_e, data) => {
        return saveSettings(data);
    });
}