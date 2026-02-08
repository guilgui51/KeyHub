import {FlatRow, NamespaceData, TreeNode} from "./types";

export function buildTree(keys: {key: string; values: Record<string, string | null>}[]): TreeNode[] {
    const root: TreeNode[] = [];
    for (const entry of keys) {
        const parts = entry.key.split(".");
        let siblings = root;
        let pathSoFar = "";
        for (let i = 0; i < parts.length; i++) {
            pathSoFar = pathSoFar ? `${pathSoFar}.${parts[i]}` : parts[i];
            const isLast = i === parts.length - 1;
            let node = siblings.find((n) => n.segment === parts[i]);
            if (!node) {
                node = {segment: parts[i], fullKey: pathSoFar, children: []};
                if (isLast) node.values = entry.values;
                siblings.push(node);
            } else if (isLast) {
                node.values = entry.values;
            }
            siblings = node.children;
        }
    }
    return root;
}

export function sortTree(nodes: TreeNode[]): TreeNode[] {
    nodes.sort((a, b) => a.segment.localeCompare(b.segment));
    for (const n of nodes) sortTree(n.children);
    return nodes;
}

export function treeHasMissing(node: TreeNode, langCodes: string[]): boolean {
    if (node.values) return langCodes.some((c) => node.values![c] === null || node.values![c] === "");
    return node.children.some((child) => treeHasMissing(child, langCodes));
}

function treeMatchesSearch(node: TreeNode, q: string): boolean {
    if (node.segment.toLowerCase().includes(q)) return true;
    if (node.fullKey.toLowerCase().includes(q)) return true;
    return node.children.some((child) => treeMatchesSearch(child, q));
}

export function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
    const result: TreeNode[] = [];
    for (const node of nodes) {
        if (treeMatchesSearch(node, q)) {
            result.push({...node, children: filterTree(node.children, q)});
        }
    }
    return result;
}

/** Count completed and missing leaf keys under a set of nodes */
export function countKeys(nodes: TreeNode[], langCodes: string[]): {completed: number; missing: number} {
    let completed = 0;
    let missing = 0;
    for (const n of nodes) {
        if (n.children.length === 0 && n.values !== undefined) {
            const isMissing = langCodes.some((c) => n.values![c] === null || n.values![c] === "");
            if (isMissing) missing++;
            else completed++;
        } else {
            const sub = countKeys(n.children, langCodes);
            completed += sub.completed;
            missing += sub.missing;
        }
    }
    return {completed, missing};
}

export function flattenTree(
    nodes: TreeNode[], namespace: string, depth: number,
    rows: FlatRow[], expanded: Set<string>, langCodes: string[], forceExpand: boolean,
) {
    for (const node of nodes) {
        const isLeaf = node.children.length === 0 && node.values !== undefined;
        const id = `${namespace}:${node.fullKey}`;
        const isExpanded = forceExpand || expanded.has(id);
        const hasMissing = isLeaf
            ? langCodes.some((c) => node.values![c] === null || node.values![c] === "")
            : treeHasMissing(node, langCodes);

        if (isLeaf) {
            rows.push({type: "leaf", depth, segment: node.segment, fullKey: node.fullKey, namespace, values: node.values, hasMissing});
        } else {
            const counts = countKeys([node], langCodes);
            rows.push({type: "branch", depth, segment: node.segment, fullKey: node.fullKey, namespace, expanded: isExpanded, hasMissing, completedCount: counts.completed, missingCount: counts.missing});
            if (isExpanded) flattenTree(node.children, namespace, depth + 1, rows, expanded, langCodes, forceExpand);
        }
    }
}

export function getSiblingKeys(
    nsData: NamespaceData,
    selectedKey: string,
): {key: string; values: Record<string, string | null>}[] {
    const dotIdx = selectedKey.lastIndexOf(".");
    const parentPrefix = dotIdx === -1 ? "" : selectedKey.substring(0, dotIdx + 1);

    if (parentPrefix === "") {
        return nsData.keys.filter((k) => !k.key.includes("."));
    }

    return nsData.keys.filter((k) =>
        k.key.startsWith(parentPrefix) && !k.key.substring(parentPrefix.length).includes(".")
    );
}
