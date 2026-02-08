import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
    faChevronRight,
    faChevronDown,
    faPlus,
} from "@fortawesome/free-solid-svg-icons";
import {FlatRow, SelectedKey} from "./types";

interface TreeRowProps {
    index: number;
    style: React.CSSProperties;
    flatRows: FlatRow[];
    selected: SelectedKey | null;
    langCodes: string[];
    onToggle: (id: string) => void;
    onSelect: (ns: string, key: string) => void;
    onAddKey: (ns: string, prefix: string) => void;
    [key: string]: unknown;
}

export default function TreeRow({index, style, flatRows, selected, langCodes, onToggle, onSelect, onAddKey}: TreeRowProps) {
    const row = flatRows[index];
    const indent = row.depth * 16;

    if (row.type === "namespace") {
        const id = `ns:${row.namespace}`;
        return (
            <div style={style} className="flex items-center cursor-pointer select-none hover:bg-gray-900/50 px-4 group" onClick={() => onToggle(id)}>
                <FontAwesomeIcon icon={row.expanded ? faChevronDown : faChevronRight} className="text-gray-600 text-[10px] w-3 shrink-0 mr-2" />
                <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">{row.segment}</span>
                <KeyCounts completed={row.completedCount ?? 0} missing={row.missingCount ?? 0} />
                <button
                    onClick={(e) => { e.stopPropagation(); onAddKey(row.namespace, ""); }}
                    className="ml-auto flex items-center text-gray-700 hover:text-green-400 transition-colors opacity-0 group-hover:opacity-100 p-0.5 cursor-pointer"
                    title="Ajouter une clé"
                >
                    <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                </button>
            </div>
        );
    }

    if (row.type === "branch") {
        const id = `${row.namespace}:${row.fullKey}`;
        return (
            <div style={{...style, paddingLeft: indent + 16}} className="flex items-center cursor-pointer select-none hover:bg-gray-900/50 pr-4 group" onClick={() => onToggle(id)}>
                <FontAwesomeIcon icon={row.expanded ? faChevronDown : faChevronRight} className="text-gray-600 text-[10px] w-3 shrink-0 mr-1.5" />
                <span className="font-mono text-xs text-gray-400 truncate">{row.segment}</span>
                <KeyCounts completed={row.completedCount ?? 0} missing={row.missingCount ?? 0} />
                <button
                    onClick={(e) => { e.stopPropagation(); onAddKey(row.namespace, row.fullKey); }}
                    className="ml-auto text-gray-700 hover:text-green-400 transition-colors opacity-0 group-hover:opacity-100 p-0.5"
                    title="Ajouter une sous-clé"
                >
                    <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                </button>
            </div>
        );
    }

    // Leaf row with language tags
    const isSelected = selected?.namespace === row.namespace && selected?.key === row.fullKey;
    return (
        <div
            style={{...style, paddingLeft: indent + 16}}
            className={`flex items-center cursor-pointer select-none pr-4 ${isSelected ? "bg-green-600/20 text-green-300" : "hover:bg-gray-900/50 text-gray-300"}`}
            onClick={() => onSelect(row.namespace, row.fullKey)}
        >
            <span className="w-3 shrink-0 mr-1.5" />
            <div className="flex items-center gap-1 shrink-0 mr-2">
                {langCodes.map((code) => {
                    const val = row.values?.[code];
                    const filled = val !== null && val !== undefined && val !== "";
                    return (
                        <span
                            key={code}
                            className={`text-[9px] font-mono font-semibold px-1 py-px rounded ${
                                filled
                                    ? "bg-green-600/20 text-green-400"
                                    : "bg-red-600/20 text-red-400"
                            }`}
                        >
                            {code}
                        </span>
                    );
                })}
            </div>
            <span className="font-mono text-xs truncate">{row.segment}</span>
        </div>
    );
}

function KeyCounts({completed, missing}: {completed: number; missing: number}) {
    return (
        <span className="ml-2 flex items-center gap-1 shrink-0 text-[10px] font-mono">
            <span className="text-green-400">{completed}</span>
            <span className="text-gray-600">/</span>
            <span className={missing > 0 ? "text-red-400" : "text-gray-600"}>{missing}</span>
        </span>
    );
}
