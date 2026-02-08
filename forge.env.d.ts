/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import {IpcChannels} from "./src/ipc";

export {};

declare module "*.png" {
    const value: string;
    export default value;
}

declare global {
    export interface TranslationFile {
        absolutePath: string;
        namespace: string;
    }

    export interface TranslationLanguage {
        code: string;
        files: TranslationFile[];
    }

    export interface AppSettings {
        rootFolder: string | null;
        languages: TranslationLanguage[];
        serverPort: number;
        serverAutoStart: boolean;
        deeplApiKey: string;
    }

    interface Window {
        api: {
            [K in keyof IpcChannels]: (
                ...args: Parameters<IpcChannels[K]>
            ) => ReturnType<IpcChannels[K]>;
        } & {
            onKeysReceived: (callback: (data: {namespace: string; keys: string[]}) => void) => () => void;
            onUsageUpdated: (callback: () => void) => () => void;
        };
    }
}
