import {registerSettingsHandlers, SettingsIPC} from "./settings";
import {AppIpcs, registerAppHandlers} from "./app";
import {registerTranslationHandlers, TranslationsIPC} from "./translations";
import {registerServerHandlers, ServerIPC} from "./server";
import {registerTranslatorHandlers, TranslatorIPC} from "./translator";

export type IpcChannels = AppIpcs & SettingsIPC & TranslationsIPC & ServerIPC & TranslatorIPC;

export function registerAllIpcHandlers() {
    registerAppHandlers();
    registerSettingsHandlers();
    registerTranslationHandlers();
    registerServerHandlers();
    registerTranslatorHandlers();
}
