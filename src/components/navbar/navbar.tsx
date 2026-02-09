import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
    faFolderOpen,
    faLanguage,
    faPlus,
    faFolderTree,
    faGlobe,
    faPowerOff,
    faTrash,
    faServer,
    faChartBar,
} from "@fortawesome/free-solid-svg-icons";
import logo from "../../assets/logo.png";
import Modal from "../shared/modal";
import {useToast} from "../shared/toast-context";

/** Dispatch this event after any mutation so Home can reload */
function notifyChange() {
    window.dispatchEvent(new CustomEvent("translations-changed"));
}

/** Dispatch event to select a key in Home after creation */
function notifySelectKey(namespace: string, key: string) {
    window.dispatchEvent(new CustomEvent("select-key", {detail: {namespace, key}}));
}

export default function Navbar() {
    const navigate = useNavigate();
    const {addToast} = useToast();
    const [rootFolder, setRootFolder] = useState<string | null>(null);
    const [folderStructure, setFolderStructure] = useState<"namespaced" | "flat">("namespaced");
    const [languages, setLanguages] = useState<TranslationLanguage[]>([]);
    const [namespaces, setNamespaces] = useState<string[]>([]);

    // Server status
    const [serverRunning, setServerRunning] = useState(false);
    const [serverPort, setServerPort] = useState(5874);

    // Translation usage
    const [translationUsage, setTranslationUsage] = useState(0);
    const [translationLimit, setTranslationLimit] = useState(500000);

    // Add-key modal
    const [addKeyOpen, setAddKeyOpen] = useState(false);
    const [selectedNs, setSelectedNs] = useState("");
    const [newNsName, setNewNsName] = useState("");
    const [newKeyName, setNewKeyName] = useState("");
    const [useNewNs, setUseNewNs] = useState(false);

    // Languages modal
    const [langOpen, setLangOpen] = useState(false);
    const [newLangCode, setNewLangCode] = useState("");
    const [langError, setLangError] = useState("");

    const loadSettings = async () => {
        const settings = await window.api["settings:get"]();
        setRootFolder(settings.rootFolder);
        setFolderStructure(settings.folderStructure ?? "namespaced");
        setLanguages(settings.languages);
        setServerPort(settings.serverPort);
        // Collect unique namespaces
        const ns = new Set<string>();
        for (const lang of settings.languages) {
            for (const f of lang.files) ns.add(f.namespace);
        }
        setNamespaces([...ns].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
    };

    const loadServerStatus = async () => {
        const status = await window.api["server:status"]();
        setServerRunning(status.running);
        setServerPort(status.port);
    };

    const loadTranslationUsage = async () => {
        try {
            const usage = await window.api["translator:getUsage"]();
            setTranslationUsage(usage.characterCount);
            setTranslationLimit(usage.characterLimit);
        } catch (err) {
            console.error("Failed to load translation usage:", err);
        }
    };

    useEffect(() => {
        loadSettings();
        loadServerStatus();
        loadTranslationUsage();
    }, []);

    // Also reload when translations change (e.g. from Home tree add-key)
    useEffect(() => {
        const handler = () => loadSettings();
        window.addEventListener("translations-changed", handler);
        return () => window.removeEventListener("translations-changed", handler);
    }, []);

    // Poll server status every 2 seconds
    useEffect(() => {
        const interval = setInterval(loadServerStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    // Listen for new keys received from server
    useEffect(() => {
        const unsubscribe = window.api.onKeysReceived((data) => {
            const {namespace, keys} = data;

            // Format the toast message
            const keyList = keys.join(", ");
            const message = keys.length === 1
                ? `Nouvelle clé ajoutée :\nNamespace : ${namespace}\nClé : ${keyList}`
                : `${keys.length} nouvelles clés ajoutées :\nNamespace : ${namespace}\nClés : ${keyList}`;

            // Show toast notification
            addToast(message, "success");

            // Reload data
            loadSettings();
            notifyChange();
        });
        return unsubscribe;
    }, [addToast]);

    // Listen for translation usage updates
    useEffect(() => {
        const unsubscribe = window.api.onUsageUpdated(() => {
            loadTranslationUsage();
        });
        return unsubscribe;
    }, []);

    // ── Folder ───────────────────────────────────────────────────────────
    const handleFolder = async () => {
        const result = await window.api["translations:importFolder"]();
        if (!result) return;
        await loadSettings();
        notifyChange();
        navigate("/");
    };

    // ── Add key ──────────────────────────────────────────────────────────
    const openAddKey = () => {
        setSelectedNs(namespaces[0] ?? "");
        setNewNsName("");
        setNewKeyName("");
        setUseNewNs(namespaces.length === 0);
        setAddKeyOpen(true);
    };

    const isFlat = folderStructure === "flat";

    const handleAddKey = async () => {
        const ns = isFlat ? "default" : (useNewNs ? newNsName.trim() : selectedNs);
        const key = newKeyName.trim();
        if (!ns || !key) return;
        await window.api["translations:addKey"](ns, key);
        setAddKeyOpen(false);
        notifyChange();
        notifySelectKey(ns, key);
    };

    // ── Languages ────────────────────────────────────────────────────────
    const openLanguages = () => {
        setNewLangCode("");
        setLangError("");
        setLangOpen(true);
    };

    const handleAddLanguage = async () => {
        const code = newLangCode.trim();
        if (!/^[a-z]{2}-[A-Z]{2}$/.test(code)) {
            setLangError("Format invalide (xx-XX).");
            return;
        }
        if (languages.some((l) => l.code === code)) {
            setLangError("Cette langue existe déjà.");
            return;
        }
        const updated = await window.api["translations:addLanguage"](code);
        setLanguages(updated.languages);
        setNewLangCode("");
        setLangError("");
        notifyChange();
    };

    const handleRemoveLanguage = async (code: string) => {
        const updated = await window.api["translations:removeLanguage"](code);
        setLanguages(updated.languages);
        notifyChange();
    };

    const hasFolder = !!rootFolder;

    return (
        <>
            <nav className="shrink-0 flex items-center bg-gray-900 border-b border-gray-800 px-3 py-2 gap-3" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
                {/* Logo */}
                <div className="flex flex-col items-center mr-2 shrink-0">
                    <img src={logo} alt="Logo" className="h-8 w-auto" />
                    <span className="text-[9px] font-bold text-gray-400 leading-none mt-0.5">KeyHub</span>
                </div>

                <div className="w-px h-10 bg-gray-800 shrink-0" />

                {/* Action buttons */}
                <NavButton icon={faLanguage} label="Traductions" onClick={() => navigate("/")} />
                {hasFolder && (
                    <>
                        <NavButton icon={faChartBar} label="Stats" onClick={() => navigate("/statistics")} />
                        <NavButton icon={faPlus} label="Clé" onClick={openAddKey} />
                        <NavButton icon={faGlobe} label="Langues" onClick={openLanguages} />
                        <NavButton icon={faFolderTree} label="Dossier" onClick={() => navigate("/settings/directory")} />
                    </>
                )}

                <NavButton
                    icon={faFolderOpen}
                    label={hasFolder ? "Changer" : "Ouvrir"}
                    onClick={handleFolder}
                />

                <div className="flex-1" />

                {/* Server status + Translation usage */}
                {hasFolder && (
                    <div className="flex flex-col gap-1 px-3 py-1.5 rounded-lg bg-gray-800/50 shrink-0" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
                        <div className="flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${serverRunning ? "bg-green-500" : "bg-gray-600"}`} />
                            <span className="text-xs text-gray-400">
                                {serverRunning ? `Port ${serverPort}` : "Serveur arrêté"}
                            </span>
                        </div>
                        <div className="text-[10px] text-gray-500">
                            DeepL: {(translationUsage / 1000).toFixed(1)}k / {(translationLimit / 1000).toFixed(0)}k
                        </div>
                    </div>
                )}

                {hasFolder && (
                    <NavButton icon={faServer} label="Paramètres" onClick={() => navigate("/settings/settings")} />
                )}

                <NavButton icon={faPowerOff} label="Quitter" onClick={() => window.api["app:exit"]()} variant="danger" />
            </nav>

            {/* ── Add key modal ──────────────────────────────────────────── */}
            <Modal isOpen={addKeyOpen} onClose={() => setAddKeyOpen(false)} title="Ajouter une clé">
                <div className="space-y-4">
                    {!isFlat && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Namespace (fichier)</label>
                            {namespaces.length > 0 && (
                                <div className="space-y-2">
                                    <select
                                        value={useNewNs ? "__new__" : selectedNs}
                                        onChange={(e) => {
                                            if (e.target.value === "__new__") {
                                                setUseNewNs(true);
                                            } else {
                                                setUseNewNs(false);
                                                setSelectedNs(e.target.value);
                                            }
                                        }}
                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-green-500"
                                    >
                                        {namespaces.map((ns) => (
                                            <option key={ns} value={ns}>{ns}</option>
                                        ))}
                                        <option value="__new__">+ Nouveau namespace...</option>
                                    </select>
                                </div>
                            )}
                            {(useNewNs || namespaces.length === 0) && (
                                <input
                                    type="text"
                                    value={newNsName}
                                    onChange={(e) => setNewNsName(e.target.value)}
                                    placeholder="ex: common, errors, auth"
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-green-500 mt-2"
                                    autoFocus={namespaces.length === 0}
                                />
                            )}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nom de la clé</label>
                        <input
                            type="text"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddKey()}
                            placeholder="ex: myKey ou nested.subKey"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-green-500"
                            autoFocus={isFlat || namespaces.length > 0}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setAddKeyOpen(false)} className="px-4 py-1.5 rounded text-sm text-gray-400 hover:text-gray-200 transition-colors cursor-pointer">
                            Annuler
                        </button>
                        <button
                            onClick={handleAddKey}
                            disabled={!isFlat && !(useNewNs ? newNsName.trim() : selectedNs) || !newKeyName.trim()}
                            className="px-4 py-1.5 rounded bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors cursor-pointer"
                        >
                            Ajouter
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ── Languages modal ────────────────────────────────────────── */}
            <Modal isOpen={langOpen} onClose={() => setLangOpen(false)} title="Langues">
                <div className="space-y-4">
                    {languages.length === 0 && (
                        <p className="text-sm text-gray-500">Aucune langue configurée.</p>
                    )}
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {languages.map((lang) => (
                            <div key={lang.code} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <span className="bg-green-600/20 text-green-400 text-xs font-mono font-semibold px-2 py-0.5 rounded">
                                        {lang.code}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {lang.files.length} fichier{lang.files.length > 1 ? "s" : ""}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleRemoveLanguage(lang.code)}
                                    className="text-gray-500 hover:text-red-400 transition-colors p-1 cursor-pointer"
                                    title="Supprimer"
                                >
                                    <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-gray-800 pt-3">
                        <label className="block text-xs font-medium text-gray-400 mb-1">Ajouter une langue</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newLangCode}
                                onChange={(e) => { setNewLangCode(e.target.value); setLangError(""); }}
                                onKeyDown={(e) => e.key === "Enter" && handleAddLanguage()}
                                placeholder="xx-XX"
                                className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-green-500"
                            />
                            <button
                                onClick={handleAddLanguage}
                                disabled={!newLangCode.trim()}
                                className="px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors cursor-pointer"
                            >
                                <FontAwesomeIcon icon={faPlus} />
                            </button>
                        </div>
                        {langError && <p className="text-xs text-red-400 mt-1">{langError}</p>}
                    </div>
                </div>
            </Modal>
        </>
    );
}

// ── Reusable square-ish action button ────────────────────────────────────

function NavButton({icon, label, onClick, variant}: {
    icon: any;
    label: string;
    onClick: () => void;
    variant?: "danger";
}) {
    const base = variant === "danger"
        ? "text-red-400 hover:bg-red-500/20 hover:text-red-300"
        : "text-gray-300 hover:bg-gray-800 hover:text-green-400";

    return (
        <button
            onClick={onClick}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg transition-colors cursor-pointer shrink-0 ${base}`}
        >
            <FontAwesomeIcon icon={icon} className="text-lg" />
            <span className="text-[9px] mt-1 leading-none font-medium">{label}</span>
        </button>
    );
}
