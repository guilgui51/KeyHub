import {useEffect, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPlay, faStop} from "@fortawesome/free-solid-svg-icons";

export default function ServerSettings() {
    // Server state
    const [serverRunning, setServerRunning] = useState(false);
    const [serverPort, setServerPort] = useState(5874);
    const [portInput, setPortInput] = useState("5874");
    const [autoStart, setAutoStart] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    // Translator state
    const [deeplKey, setDeeplKey] = useState("");

    useEffect(() => {
        window.api["settings:get"]().then((settings) => {
            setServerPort(settings.serverPort);
            setPortInput(String(settings.serverPort));
            setAutoStart(settings.serverAutoStart);
            setDeeplKey(settings.deeplApiKey || "");
        });
        window.api["server:status"]().then((s) => setServerRunning(s.running));
    }, []);

    const handleStartServer = async () => {
        setServerError(null);
        const port = parseInt(portInput, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
            setServerError("Port invalide (1-65535)");
            return;
        }
        try {
            const status = await window.api["server:start"](port);
            setServerRunning(status.running);
            setServerPort(status.port);
            // Save port to settings
            await window.api["settings:update"]({serverPort: port});
        } catch (err: unknown) {
            setServerError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleStopServer = async () => {
        setServerError(null);
        const status = await window.api["server:stop"]();
        setServerRunning(status.running);
    };

    const handleAutoStartChange = async (checked: boolean) => {
        setAutoStart(checked);
        await window.api["settings:update"]({serverAutoStart: checked});
    };

    const handleDeeplKeyBlur = async () => {
        await window.api["settings:update"]({deeplApiKey: deeplKey});
    };

    return (
        <div className="flex flex-col h-full">
            <div className="sticky top-0 left-0 z-20 py-4 px-4 bg-gray-950/40">
                <h2 className="text-2xl font-semibold">Paramètres du serveur</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 space-y-4">
                    {/* Status + controls */}
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-2">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${serverRunning ? "bg-green-500" : "bg-gray-600"}`} />
                            <span className="text-sm text-gray-300">
                                {serverRunning ? `Actif sur le port ${serverPort}` : "Arrêté"}
                            </span>
                        </span>
                    </div>

                    {/* Port + buttons */}
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-400">Port :</label>
                        <input
                            type="number"
                            min={1}
                            max={65535}
                            value={portInput}
                            onChange={(e) => setPortInput(e.target.value)}
                            disabled={serverRunning}
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm w-24 text-gray-200
                                       disabled:opacity-50 disabled:cursor-not-allowed
                                       focus:outline-none focus:border-blue-500"
                        />
                        {serverRunning ? (
                            <button
                                onClick={handleStopServer}
                                className="flex items-center gap-2 bg-red-600/20 text-red-400 hover:bg-red-600/30
                                           px-3 py-1.5 rounded text-sm transition-colors cursor-pointer"
                            >
                                <FontAwesomeIcon icon={faStop} size="sm" />
                                Arrêter
                            </button>
                        ) : (
                            <button
                                onClick={handleStartServer}
                                className="flex items-center gap-2 bg-green-600/20 text-green-400 hover:bg-green-600/30
                                           px-3 py-1.5 rounded text-sm transition-colors cursor-pointer"
                            >
                                <FontAwesomeIcon icon={faPlay} size="sm" />
                                Démarrer
                            </button>
                        )}
                    </div>

                    {serverError && (
                        <p className="text-red-400 text-sm">{serverError}</p>
                    )}

                    {/* Auto-start */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoStart}
                            onChange={(e) => handleAutoStartChange(e.target.checked)}
                            className="accent-blue-500"
                        />
                        <span className="text-sm text-gray-400">Démarrer automatiquement au lancement</span>
                    </label>

                    {/* Config snippet */}
                    <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-2">
                            Configuration i18next pour votre application :
                        </p>
                        <pre className="bg-gray-800 rounded p-3 text-xs text-gray-300 overflow-x-auto">
{`i18next.init({
  saveMissing: true,
  saveMissingTo: "all",
  missingKeyHandler: false,
  backend: {
    loadPath: "/locales/{{lng}}/{{ns}}.json",
    addPath: "http://localhost:${portInput}/locales/{{lng}}/{{ns}}",
  },
});`}
                        </pre>
                    </div>
                </div>

                {/* ── Translation Service ────────────────────────────────────── */}
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 space-y-4 mt-4">
                    <h3 className="text-lg font-semibold text-gray-200">Service de traduction</h3>
                    <p className="text-xs text-gray-500">
                        Configuration pour la traduction automatique. Les traductions sont mises en cache pour économiser les ressources.
                    </p>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Clé API DeepL</label>
                            <input
                                type="password"
                                value={deeplKey}
                                onChange={(e) => setDeeplKey(e.target.value)}
                                onBlur={handleDeeplKeyBlur}
                                placeholder="Entrez votre clé API DeepL"
                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200
                                           focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <p className="text-xs text-gray-500">
                            <a
                                href="https://www.deepl.com/pro-api"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline"
                            >
                                Obtenir une clé DeepL
                            </a>
                            {" "}(500k caractères/mois gratuits)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
