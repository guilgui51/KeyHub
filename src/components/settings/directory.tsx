import {useEffect, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faTrash, faXmark} from "@fortawesome/free-solid-svg-icons";

export default function Directory() {
    const [rootFolder, setRootFolder] = useState<string | null>(null);
    const [languages, setLanguages] = useState<TranslationLanguage[]>([]);

    const applySettings = (settings: AppSettings) => {
        setRootFolder(settings.rootFolder);
        setLanguages(settings.languages);
    };

    useEffect(() => {
        window.api["settings:get"]().then(applySettings);
    }, []);

    // Listen for navbar-triggered changes
    useEffect(() => {
        const handler = () => window.api["settings:get"]().then(applySettings);
        window.addEventListener("translations-changed", handler);
        return () => window.removeEventListener("translations-changed", handler);
    }, []);

    const handleRemoveLanguage = async (code: string) => {
        applySettings(await window.api["translations:removeLanguage"](code));
        window.dispatchEvent(new CustomEvent("translations-changed"));
    };

    const handleRemoveFile = async (code: string, absolutePath: string) => {
        applySettings(await window.api["translations:removeFile"](code, absolutePath));
        window.dispatchEvent(new CustomEvent("translations-changed"));
    };

    return (
        <div className="flex flex-col h-full">
            <div className="sticky top-0 left-0 z-20 py-4 px-4 bg-gray-950/40 space-y-2">
                <h2 className="text-2xl font-semibold">Dossier racine</h2>
                {rootFolder && (
                    <p className="text-xs text-gray-500 truncate" title={rootFolder}>
                        <span className="text-gray-400">{rootFolder}</span>
                    </p>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
                {languages.length === 0 && (
                    <p className="text-gray-500 text-center mt-12">
                        Aucun fichier importé. Utilisez la barre de navigation pour ouvrir un dossier et ajouter des langues.
                    </p>
                )}

                {languages.map((lang) => (
                    <div key={lang.code} className="bg-gray-900 rounded-lg border border-gray-800">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                            <span className="inline-flex items-center gap-2">
                                <span className="bg-green-600/20 text-green-400 text-xs font-mono font-semibold px-2 py-0.5 rounded">
                                    {lang.code}
                                </span>
                                <span className="text-sm text-gray-400">
                                    {lang.files.length} fichier{lang.files.length > 1 ? "s" : ""}
                                </span>
                            </span>
                            <button
                                onClick={() => handleRemoveLanguage(lang.code)}
                                className="text-gray-500 hover:text-red-400 transition-colors p-1 cursor-pointer"
                                title="Supprimer cette langue"
                            >
                                <FontAwesomeIcon icon={faTrash} size="sm" />
                            </button>
                        </div>

                        <div className="divide-y divide-gray-800/50">
                            {lang.files.map((file) => (
                                <div
                                    key={file.absolutePath}
                                    className="flex items-center justify-between px-4 py-2 hover:bg-gray-800/30 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-sm font-medium text-gray-200 shrink-0">
                                            {file.namespace}
                                        </span>
                                        <span className="text-xs text-gray-500 truncate" title={file.absolutePath}>
                                            {file.absolutePath}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveFile(lang.code, file.absolutePath)}
                                        className="text-gray-600 hover:text-red-400 transition-colors p-1 shrink-0 ml-2 cursor-pointer"
                                        title="Retirer ce fichier"
                                    >
                                        <FontAwesomeIcon icon={faXmark} size="sm" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
