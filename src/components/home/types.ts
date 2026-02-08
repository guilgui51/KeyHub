export interface NamespaceData {
    namespace: string;
    keys: {
        key: string;
        values: Record<string, string | null>;
    }[];
}

export interface SelectedKey {
    namespace: string;
    key: string;
}

export interface TreeNode {
    segment: string;
    fullKey: string;
    children: TreeNode[];
    values?: Record<string, string | null>;
}

export interface FlatRow {
    type: "namespace" | "branch" | "leaf";
    depth: number;
    segment: string;
    fullKey: string;
    namespace: string;
    values?: Record<string, string | null>;
    expanded?: boolean;
    hasMissing?: boolean;
    completedCount?: number;
    missingCount?: number;
}
