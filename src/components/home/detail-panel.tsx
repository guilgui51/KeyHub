import {useEffect, useMemo, useRef, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faXmark, faTriangleExclamation, faTrash, faLanguage, faSpinner} from "@fortawesome/free-solid-svg-icons";
import {List, useListRef} from "react-window";

// ── Detail panel showing sibling keys (virtualized) ──────────────────────

interface DetailPanelProps {
    namespace: string;
    selectedKey: string;
    siblings: {key: string; values: Record<string, string | null>}[];
    langCodes: string[];
    onUpdateValue: (namespace: string, key: string, langCode: string, value: string) => Promise<void>;
    onRemoveKey: (namespace: string, key: string) => Promise<void>;
    onSelectKey: (namespace: string, key: string) => void;
    onClose: () => void;
}

/** Compute the fixed row height for a sibling card based on number of languages */
function computeRowHeight(langCount: number): number {
    // outer: pt-2 (8) + card border (2) + card padding p-3 (24) + header+mb (36)
    // per lang: label+mb (28) + textarea (38) + space-y-3 gap (12) = 78, last no gap
    return 8 + 2 + 24 + 36 + langCount * 78 - 12;
}

export default function DetailPanel({namespace, selectedKey, siblings, langCodes, onUpdateValue, onRemoveKey, onSelectKey, onClose}: DetailPanelProps) {
    const parentPrefix = selectedKey.lastIndexOf(".") === -1 ? "" : selectedKey.substring(0, selectedKey.lastIndexOf("."));
    const listRef = useListRef();
    const rowHeight = useMemo(() => computeRowHeight(langCodes.length), [langCodes.length]);

    // Scroll to the selected key when it changes
    useEffect(() => {
        const idx = siblings.findIndex((s) => s.key === selectedKey);
        if (idx >= 0 && listRef.current) {
            listRef.current.scrollToRow({index: idx, align: "smart"});
        }
    }, [selectedKey, siblings]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
                <div className="min-w-0">
                    <p className="text-xs text-gray-500 truncate">{namespace}</p>
                    {parentPrefix && (
                        <p className="text-xs font-mono text-gray-500 truncate">{parentPrefix}</p>
                    )}
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1 shrink-0 ml-2 cursor-pointer">
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>

            <div className="flex-1 min-h-0">
                <List
                    listRef={listRef}
                    style={{height: "100%", width: "100%"}}
                    rowCount={siblings.length}
                    rowHeight={rowHeight}
                    rowComponent={SiblingRow}
                    rowProps={{siblings, selectedKey, namespace, langCodes, onUpdateValue, onRemoveKey, onSelectKey}}
                />
            </div>
        </div>
    );
}

// ── Virtualized sibling row ──────────────────────────────────────────────

interface SiblingRowProps {
    index: number;
    style: React.CSSProperties;
    siblings: {key: string; values: Record<string, string | null>}[];
    selectedKey: string;
    namespace: string;
    langCodes: string[];
    onUpdateValue: (namespace: string, key: string, langCode: string, value: string) => Promise<void>;
    onRemoveKey: (namespace: string, key: string) => Promise<void>;
    onSelectKey: (namespace: string, key: string) => void;
    [key: string]: unknown;
}

function SiblingRow({index, style, siblings, selectedKey, namespace, langCodes, onUpdateValue, onRemoveKey, onSelectKey}: SiblingRowProps) {
    const entry = siblings[index];
    const isActive = entry.key === selectedKey;
    const lastSegment = entry.key.substring(entry.key.lastIndexOf(".") + 1);

    return (
        <div style={style} className="px-4 pt-2">
            <div
                className={`rounded-lg border p-3 transition-colors cursor-pointer h-full ${
                    isActive
                        ? "border-green-600/50 bg-green-600/5"
                        : "border-gray-800 hover:border-gray-700"
                }`}
                onClick={() => onSelectKey(namespace, entry.key)}
            >
                <div className="flex items-center justify-between mb-3">
                    <span className={`font-mono text-sm font-medium ${isActive ? "text-green-400" : "text-gray-300"}`}>
                        {lastSegment}
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemoveKey(namespace, entry.key); }}
                        className="text-gray-700 hover:text-red-400 transition-colors p-1 cursor-pointer"
                        title="Supprimer cette clé"
                    >
                        <FontAwesomeIcon icon={faTrash} className="text-xs" />
                    </button>
                </div>

                <div className="space-y-3">
                    {langCodes.map((code) => (
                        <LangInput
                            key={`${namespace}:${entry.key}:${code}`}
                            namespace={namespace}
                            keyName={entry.key}
                            langCode={code}
                            value={entry.values[code]}
                            allValues={entry.values}
                            langCodes={langCodes}
                            onSave={(val) => onUpdateValue(namespace, entry.key, code, val)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Language input with debounced save and translation suggestion ───────────

interface LangInputProps {
    namespace: string;
    keyName: string;
    langCode: string;
    value: string | null;
    allValues: Record<string, string | null>;
    langCodes: string[];
    onSave: (value: string) => Promise<void>;
}

function LangInput({namespace, keyName, langCode, value, allValues, langCodes, onSave}: LangInputProps) {
    const [local, setLocal] = useState(value ?? "");
    const [suggestion, setSuggestion] = useState<string | null>(null);
    const [loadingSuggestion, setLoadingSuggestion] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const translateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const missing = value === null || value === "";

    useEffect(() => { setLocal(value ?? ""); }, [value]);

    // Find a source language with a value (pick the first non-empty one)
    const sourceLanguage = langCodes.find(code => code !== langCode && allValues[code] && allValues[code]?.trim());
    const sourceText = sourceLanguage ? allValues[sourceLanguage] : null;

    // Fetch translation suggestion when this language is empty and a source exists
    useEffect(() => {
        // Clear any pending translation requests
        if (translateTimerRef.current) {
            clearTimeout(translateTimerRef.current);
        }

        // Only fetch if current language is empty and we have a source
        if (!missing || !sourceText || !sourceLanguage) {
            setSuggestion(null);
            return;
        }

        // Debounce translation requests
        translateTimerRef.current = setTimeout(async () => {
            setLoadingSuggestion(true);
            try {
                const cacheKey = `${namespace}:${keyName}:${sourceLanguage}->${langCode}`;
                const translated = await window.api["translator:translate"](
                    sourceText,
                    sourceLanguage,
                    langCode,
                    cacheKey
                );
                setSuggestion(translated);
            } catch (err) {
                console.error("Translation error:", err);
                setSuggestion(null);
            } finally {
                setLoadingSuggestion(false);
            }
        }, 500);

        return () => {
            if (translateTimerRef.current) clearTimeout(translateTimerRef.current);
        };
    }, [missing, sourceText, sourceLanguage, langCode, namespace, keyName]);

    const handleChange = (newVal: string) => {
        setLocal(newVal);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => onSave(newVal), 400);
    };

    const handleAcceptSuggestion = () => {
        if (suggestion) {
            setLocal(suggestion);
            onSave(suggestion);
            setSuggestion(null);
        }
    };

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (translateTimerRef.current) clearTimeout(translateTimerRef.current);
    }, []);

    return (
        <div>
            <label className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-semibold bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">{langCode}</span>
                {missing && (
                    <span className="text-xs text-amber-500">
                        <FontAwesomeIcon icon={faTriangleExclamation} className="mr-1" />
                        Clé absente
                    </span>
                )}
                {loadingSuggestion && (
                    <FontAwesomeIcon icon={faSpinner} className="text-xs text-blue-400 animate-spin" />
                )}
                {suggestion && !loadingSuggestion && (
                    <button
                        onClick={handleAcceptSuggestion}
                        className="group relative flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600/20 hover:bg-blue-600/30 transition-colors cursor-pointer"
                        title="Cliquez pour accepter la traduction suggérée"
                    >
                        <FontAwesomeIcon icon={faLanguage} className="text-xs text-blue-400" />
                        <span className="text-xs text-blue-400">Traduction</span>
                        <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-10 max-w-xs">
                            <div className="bg-gray-800 border border-gray-700 rounded p-2 shadow-lg text-xs text-gray-200">
                                {suggestion}
                            </div>
                        </div>
                    </button>
                )}
            </label>
            <textarea
                value={local}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={missing ? "Traduction manquante — saisir pour créer" : ""}
                rows={1}
                className={`w-full px-3 py-1.5 bg-gray-900 border rounded text-sm focus:outline-none resize-none ${
                    missing ? "border-amber-600/40 placeholder-amber-700/60 focus:border-amber-500" : "border-gray-800 focus:border-green-500"
                }`}
            />
        </div>
    );
}
