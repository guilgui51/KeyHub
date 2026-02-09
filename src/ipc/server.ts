import http from "http";
import {BrowserWindow, ipcMain} from "electron";
import {loadSettings} from "../settings";
import {ensureFile, flattenJson, readJsonFile, setNestedValue, writeJsonFile} from "./translations";

export type ServerIPC = {
    "server:start": (port?: number) => Promise<{ running: boolean; port: number }>;
    "server:stop": () => Promise<{ running: boolean; port: number }>;
    "server:status": () => Promise<{ running: boolean; port: number }>;
};

let server: http.Server | null = null;
let currentPort = 5874;

function notifyRenderer(namespace: string, keys: string[]) {
    for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("server:keys-received", {namespace, keys});
    }
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    // Parse URL: /locales/:lng/:ns
    const match = req.url?.match(/^\/locales\/([^/]+)\/([^/]+)$/);
    if (!match || req.method !== "POST") {
        res.writeHead(404, {"Content-Type": "application/json"});
        res.end(JSON.stringify({error: "Not found. Use POST /locales/:lng/:ns"}));
        return;
    }

    const langCode = match[1];
    const namespace = match[2];

    let body = "";
    req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
    });

    req.on("end", () => {
        try {

            const {key,defaultValue}: {key: string, value: string} = JSON.parse(body);
            const settings = loadSettings();
            const addedKeys: string[] = [];

            // Ensure the key exists in all languages (with empty value)
            for (const lang of settings.languages) {
                if (key === 'Roles') console.log('checks',lang.code,namespace)
                const file = ensureFile(settings, lang.code, namespace);
                if (!file) continue;

                const json = readJsonFile(file.absolutePath);
                const flat = flattenJson(json);
                if (key === 'Roles') console.log('received keys',key,flat,key in flat)
                if (!(key in flat)) {
                    setNestedValue(json, key, "");
                    writeJsonFile(file.absolutePath, json);
                    // Only track the key once when it's first added
                    if (!addedKeys.includes(key)) {
                        addedKeys.push(key);
                    }
                }
            }

            // If a default value is provided, set it for the requesting language
            if (defaultValue && typeof defaultValue === "string") {
                const file = ensureFile(settings, langCode, namespace);
                if (file) {
                    const json = readJsonFile(file.absolutePath);
                    setNestedValue(json, key, defaultValue);
                    writeJsonFile(file.absolutePath, json);
                }
            }

            // Only notify if new keys were added
            if (addedKeys.length > 0) {
                notifyRenderer(namespace, addedKeys);
            }

            res.writeHead(200, {"Content-Type": "application/json"});
            res.end(JSON.stringify({ok: true}));
        } catch {
            res.writeHead(400, {"Content-Type": "application/json"});
            res.end(JSON.stringify({error: "Invalid JSON body"}));
        }
    });
}

function getStatus(): { running: boolean; port: number } {
    return {running: server !== null && server.listening, port: currentPort};
}

export function startServer(port?: number): Promise<{ running: boolean; port: number }> {
    return new Promise((resolve, reject) => {
        if (server?.listening) {
            resolve(getStatus());
            return;
        }

        if (port !== undefined) currentPort = port;
        server = http.createServer(handleRequest);

        server.on("error", (err) => {
            server = null;
            reject(err);
        });

        server.listen(currentPort, "127.0.0.1", () => {
            console.log(`i18next server listening on http://127.0.0.1:${currentPort}`);
            resolve(getStatus());
        });
    });
}

function stopServer(): Promise<{ running: boolean; port: number }> {
    return new Promise((resolve) => {
        if (!server) {
            resolve(getStatus());
            return;
        }
        server.close(() => {
            server = null;
            console.log("i18next server stopped");
            resolve(getStatus());
        });
    });
}

export function registerServerHandlers() {
    ipcMain.handle("server:start", async (_e, port?: number) => startServer(port));
    ipcMain.handle("server:stop", async () => stopServer());
    ipcMain.handle("server:status", async () => getStatus());
}
