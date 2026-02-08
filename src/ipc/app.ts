import {app, ipcMain} from "electron";

export type AppIpcs = {
    "app:exit": () => void;
}

export function registerAppHandlers() {
    ipcMain.handle("app:exit", () => {
        app.quit();
    });
}