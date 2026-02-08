import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faMagnifyingGlass} from "@fortawesome/free-solid-svg-icons";
import {List} from "react-window";
import Modal from "../shared/modal";
import TreeRow from "./tree-row";
import DetailPanel from "./detail-panel";
import {NamespaceData, SelectedKey, FlatRow} from "./types";
import {buildTree, sortTree, filterTree, countKeys, flattenTree, getSiblingKeys} from "./tree-utils";

const ROW_HEIGHT = 30;

export default function Home() {
    const [loading, setLoading] = useState(true);
    const [hasFiles, setHasFiles] = useState(false);
    const [namespaces, setNamespaces] = useState<NamespaceData[]>([]);
    const [langCodes, setLangCodes] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<SelectedKey | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
    const listRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Add-key modal state (from tree context)
    const [addKeyModal, setAddKeyModal] = useState<{namespace: string; prefix: string} | null>(null);
    const [newKeyName, setNewKeyName] = useState("");

    const loadData = useCallback(async () => {
        const settings = await window.api["settings:get"]();
        const has = settings.languages.length > 0;
        setHasFiles(has);
        setLangCodes(settings.languages.map((l) => l.code));
        if (has) {
            setNamespaces(await window.api["translations:readAll"]());
        } else {
            setNamespaces([]);
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Listen for navbar-triggered changes
    useEffect(() => {
        const handler = () => loadData();
        window.addEventListener("translations-changed", handler);
        return () => window.removeEventListener("translations-changed", handler);
    }, [loadData]);

    const toggleExpand = useCallback((id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    // Build flat rows from tree
    const flatRows = useMemo(() => {
        const q = search.toLowerCase().trim();
        const isSearching = q.length > 0;
        const rows: FlatRow[] = [];

        for (const ns of namespaces) {
            const nsMatch = ns.namespace.toLowerCase().includes(q);
            let tree = buildTree(ns.keys);
            sortTree(tree);
            if (isSearching && !nsMatch) {
                tree = filterTree(tree, q);
                if (tree.length === 0) continue;
            }
            const nsId = `ns:${ns.namespace}`;
            const nsExpanded = isSearching || expanded.has(nsId);
            const counts = countKeys(tree, langCodes);
            rows.push({type: "namespace", depth: 0, segment: ns.namespace, fullKey: `__ns__${ns.namespace}`, namespace: ns.namespace, completedCount: counts.completed, missingCount: counts.missing, expanded: nsExpanded});
            if (nsExpanded) flattenTree(tree, ns.namespace, 1, rows, expanded, langCodes, isSearching);
        }
        return rows;
    }, [namespaces, search, expanded, langCodes]);

    // Callbacks
    const handleSelectKey = useCallback((ns: string, key: string) => {
        setSelected({namespace: ns, key});
    }, []);

    const handleUpdateValue = useCallback(async (namespace: string, key: string, langCode: string, value: string) => {
        await window.api["translations:updateKey"](namespace, key, langCode, value);
        setNamespaces((prev) =>
            prev.map((ns) =>
                ns.namespace === namespace
                    ? {...ns, keys: ns.keys.map((k) => k.key === key ? {...k, values: {...k.values, [langCode]: value}} : k)}
                    : ns
            )
        );
    }, []);

    const handleAddKey = async () => {
        if (!addKeyModal || !newKeyName.trim()) return;
        const fullKey = addKeyModal.prefix
            ? `${addKeyModal.prefix}.${newKeyName.trim()}`
            : newKeyName.trim();

        await window.api["translations:addKey"](addKeyModal.namespace, fullKey);
        setAddKeyModal(null);
        setNewKeyName("");
        await loadData();

        // Auto-expand to the new key and select it
        const parts = fullKey.split(".");
        const ns = addKeyModal.namespace;
        setExpanded((prev) => {
            const next = new Set(prev);
            next.add(`ns:${ns}`);
            let path = "";
            for (let i = 0; i < parts.length - 1; i++) {
                path = path ? `${path}.${parts[i]}` : parts[i];
                next.add(`${ns}:${path}`);
            }
            return next;
        });
        setSelected({namespace: ns, key: fullKey});
    };

    const handleRemoveKey = useCallback(async (namespace: string, key: string) => {
        await window.api["translations:removeKey"](namespace, key);
        setSelected((prev) => (prev?.namespace === namespace && prev?.key === key) ? null : prev);
        setNamespaces((prev) =>
            prev.map((ns) =>
                ns.namespace === namespace
                    ? {...ns, keys: ns.keys.filter((k) => k.key !== key)}
                    : ns
            )
        );
    }, []);

    const openAddKeyModal = useCallback((namespace: string, prefix: string) => {
        setAddKeyModal({namespace, prefix});
        setNewKeyName("");
    }, []);

    if (loading) return null;

    // ── Empty state ──────────────────────────────────────────────────────
    if (!hasFiles) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
                <p className="text-gray-500 max-w-md">
                    Aucun fichier de traduction importé. Utilisez le bouton
                    <span className="text-gray-300 font-medium"> Ouvrir </span>
                    dans la barre de navigation pour sélectionner un dossier.
                </p>
            </div>
        );
    }

    // Compute siblings for detail panel
    const selectedNs = selected ? namespaces.find((ns) => ns.namespace === selected.namespace) : null;
    const siblings = selected && selectedNs ? getSiblingKeys(selectedNs, selected.key) : [];

    // ── Main browser ─────────────────────────────────────────────────────
    return (
        <div className="flex h-full">
            {/* Left: key tree */}
            <div className={`flex flex-col h-full transition-all duration-200 ${selected ? "w-1/2" : "w-full"}`}>
                {/* Search bar */}
                <div className="shrink-0 py-3 px-4 bg-gray-950/40">
                    <div className="relative">
                        <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                        <input
                            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher par clé ou fichier..."
                            className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm focus:outline-none focus:border-green-500 placeholder-gray-600"
                        />
                    </div>
                </div>

                {/* Virtualized tree */}
                <div className="flex-1 min-h-0" ref={containerRef}>
                    {flatRows.length === 0 ? (
                        <p className="text-gray-500 text-center mt-12 text-sm">Aucun résultat.</p>
                    ) : (
                        <List
                            listRef={listRef}
                            style={{height: "100%", width: "100%"}}
                            rowCount={flatRows.length}
                            rowHeight={ROW_HEIGHT}
                            rowComponent={TreeRow}
                            rowProps={{flatRows, selected, langCodes, onToggle: toggleExpand, onSelect: handleSelectKey, onAddKey: openAddKeyModal}}
                        />
                    )}
                </div>
            </div>

            {/* Right: detail panel */}
            <div className={`h-full border-l border-gray-800 bg-gray-950 flex flex-col transition-all duration-200 overflow-hidden ${selected ? "w-1/2" : "w-0"}`}>
                {selected && selectedNs && (
                    <DetailPanel
                        namespace={selected.namespace}
                        selectedKey={selected.key}
                        siblings={siblings}
                        langCodes={langCodes}
                        onUpdateValue={handleUpdateValue}
                        onRemoveKey={handleRemoveKey}
                        onSelectKey={handleSelectKey}
                        onClose={() => setSelected(null)}
                    />
                )}
            </div>

            {/* Add key modal (from tree context) */}
            <AddKeyModal
                addKeyModal={addKeyModal}
                newKeyName={newKeyName}
                onNewKeyNameChange={setNewKeyName}
                onConfirm={handleAddKey}
                onClose={() => setAddKeyModal(null)}
            />
        </div>
    );
}

// ── Add key modal (contextual, from tree + button) ───────────────────────

function AddKeyModal({addKeyModal, newKeyName, onNewKeyNameChange, onConfirm, onClose}: {
    addKeyModal: {namespace: string; prefix: string} | null;
    newKeyName: string;
    onNewKeyNameChange: (v: string) => void;
    onConfirm: () => void;
    onClose: () => void;
}) {
    return (
        <Modal isOpen={!!addKeyModal} onClose={onClose} title="Ajouter une clé">
            {addKeyModal && (
                <div className="space-y-4">
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Fichier</p>
                        <p className="text-sm font-mono text-green-400">{addKeyModal.namespace}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nom de la clé</label>
                        {addKeyModal.prefix && (
                            <p className="text-xs text-gray-500 mb-1">
                                Préfixe : <span className="font-mono text-gray-400">{addKeyModal.prefix}.</span>
                            </p>
                        )}
                        <input
                            type="text" value={newKeyName}
                            onChange={(e) => onNewKeyNameChange(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && onConfirm()}
                            placeholder="ex: myKey ou nested.subKey"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono focus:outline-none focus:border-green-500"
                            autoFocus
                        />
                    </div>
                    {newKeyName.trim() && (
                        <p className="text-xs text-gray-500">
                            Clé complète : <span className="font-mono text-gray-300">
                                {addKeyModal.prefix ? `${addKeyModal.prefix}.${newKeyName.trim()}` : newKeyName.trim()}
                            </span>
                        </p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-1.5 rounded text-sm text-gray-400 hover:text-gray-200 transition-colors cursor-pointer">
                            Annuler
                        </button>
                        <button onClick={onConfirm} disabled={!newKeyName.trim()}
                            className="px-4 py-1.5 rounded bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors cursor-pointer">
                            Ajouter
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
