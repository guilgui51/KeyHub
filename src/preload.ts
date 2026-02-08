import {contextBridge, ipcRenderer} from "electron";
import {IpcChannels} from "./ipc";

// Helper: build API dynamically from the IPCChannels type
function createApi<T extends Record<string, (...args: any[]) => any>>(channels: (keyof T)[]) {
    const api = {} as {
        [K in keyof T]: (...args: Parameters<T[K]>) => ReturnType<T[K]>;
    };

    for (const channel of channels) {
        api[channel] = ((...args: any[]) => ipcRenderer.invoke(channel as string, ...args)) as any;
    }
    return api;
}

// List all channels you want to expose
const channels: (keyof IpcChannels)[]= [
    "app:exit",
    "settings:get",
    "settings:update",
    "translations:importFolder",
    "translations:addLanguage",
    "translations:removeLanguage",
    "translations:removeFile",
    "translations:readAll",
    "translations:updateKey",
    "translations:addKey",
    "translations:removeKey",
    "server:start",
    "server:stop",
    "server:status",
    "translator:translate",
    "translator:getUsage",
];

const api = createApi<IpcChannels>(channels);

contextBridge.exposeInMainWorld("api", {
    ...api,
    onKeysReceived: (callback: (data: {namespace: string; keys: string[]}) => void) => {
        const listener = (_event: any, data: {namespace: string; keys: string[]}) => callback(data);
        ipcRenderer.on("server:keys-received", listener);
        return () => { ipcRenderer.removeListener("server:keys-received", listener); };
    },
    onUsageUpdated: (callback: () => void) => {
        const listener = () => callback();
        ipcRenderer.on("translator:usage-updated", listener);
        return () => { ipcRenderer.removeListener("translator:usage-updated", listener); };
    },
});