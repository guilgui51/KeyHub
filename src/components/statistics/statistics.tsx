import {useEffect, useMemo, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
    faGlobe,
    faKey,
    faFolderOpen,
    faCheckCircle,
    faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";

export default function Statistics() {
    const [data, setData] = useState<{
        namespace: string;
        keys: { key: string; values: Record<string, string | null> }[];
    }[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const [translationData, appSettings] = await Promise.all([
                window.api["translations:readAll"](),
                window.api["settings:get"](),
            ]);
            setData(translationData);
            setSettings(appSettings);
            setLoading(false);
        })();
    }, []);

    // Reload when translations change
    useEffect(() => {
        const handler = async () => {
            const [translationData, appSettings] = await Promise.all([
                window.api["translations:readAll"](),
                window.api["settings:get"](),
            ]);
            setData(translationData);
            setSettings(appSettings);
        };
        window.addEventListener("translations-changed", handler);
        return () => window.removeEventListener("translations-changed", handler);
    }, []);

    const languages = settings?.languages || [];
    const languageCodes = languages.map((l) => l.code);

    // ── 1. Overview statistics ──
    const summary = useMemo(() => {
        const totalKeys = data.reduce((sum, ns) => sum + ns.keys.length, 0);
        const totalLanguages = languageCodes.length;
        const totalNamespaces = data.length;

        let filledCount = 0;
        let totalCells = 0;

        data.forEach((ns) => {
            ns.keys.forEach((k) => {
                languageCodes.forEach((lang) => {
                    totalCells++;
                    if (k.values[lang] && k.values[lang]?.trim() !== "") {
                        filledCount++;
                    }
                });
            });
        });

        const completionPercent = totalCells > 0 ? (filledCount / totalCells) * 100 : 100;

        return {
            totalKeys,
            totalLanguages,
            totalNamespaces,
            completionPercent: completionPercent.toFixed(1),
        };
    }, [data, languageCodes]);

    // ── 2. Language completion ──
    const languageCompletion = useMemo(() => {
        return languageCodes.map((lang) => {
            let filled = 0;
            let total = 0;
            data.forEach((ns) => {
                ns.keys.forEach((k) => {
                    total++;
                    if (k.values[lang] && k.values[lang]?.trim() !== "") {
                        filled++;
                    }
                });
            });
            const percent = total > 0 ? (filled / total) * 100 : 100;
            return {
                language: lang,
                completed: filled,
                missing: total - filled,
                percent: parseFloat(percent.toFixed(1)),
            };
        });
    }, [data, languageCodes]);

    // ── 3. Namespace key distribution ──
    const namespaceDistribution = useMemo(() => {
        return data.map((ns) => ({
            name: ns.namespace,
            keys: ns.keys.length,
        }));
    }, [data]);

    // ── 4. Namespace completion table ──
    const namespaceCompletion = useMemo(() => {
        return data.map((ns) => {
            const langStats: Record<string, { filled: number; total: number }> = {};
            languageCodes.forEach((lang) => {
                let filled = 0;
                ns.keys.forEach((k) => {
                    if (k.values[lang] && k.values[lang]?.trim() !== "") {
                        filled++;
                    }
                });
                langStats[lang] = {filled, total: ns.keys.length};
            });
            return {
                namespace: ns.namespace,
                totalKeys: ns.keys.length,
                langStats,
            };
        });
    }, [data, languageCodes]);

    // ── 5. Missing translations per key ──
    const missingTranslations = useMemo(() => {
        const result: {
            namespace: string;
            key: string;
            missingLanguages: string[];
        }[] = [];

        data.forEach((ns) => {
            ns.keys.forEach((k) => {
                const missing = languageCodes.filter(
                    (lang) => !k.values[lang] || k.values[lang]?.trim() === ""
                );
                if (missing.length > 0) {
                    result.push({
                        namespace: ns.namespace,
                        key: k.key,
                        missingLanguages: missing,
                    });
                }
            });
        });

        return result;
    }, [data, languageCodes]);

    // ── 6. Character count statistics ──
    const characterStats = useMemo(() => {
        const allTranslations: { key: string; lang: string; length: number; text: string }[] =
            [];

        data.forEach((ns) => {
            ns.keys.forEach((k) => {
                languageCodes.forEach((lang) => {
                    const text = k.values[lang] || "";
                    if (text.trim()) {
                        allTranslations.push({
                            key: `${ns.namespace}.${k.key}`,
                            lang,
                            length: text.length,
                            text,
                        });
                    }
                });
            });
        });

        allTranslations.sort((a, b) => b.length - a.length);

        return {
            longest: allTranslations.slice(0, 10),
            shortest: allTranslations
                .filter((t) => t.length > 0)
                .sort((a, b) => a.length - b.length)
                .slice(0, 10),
        };
    }, [data, languageCodes]);

    const COLORS = [
        "#22c55e",
        "#06b6d4",
        "#a855f7",
        "#f97316",
        "#ec4899",
        "#eab308",
        "#3b82f6",
        "#14b8a6",
        "#8b5cf6",
        "#84cc16",
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                Chargement des statistiques...
            </div>
        );
    }

    if (!settings?.rootFolder) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                Ouvrez un dossier de traductions pour voir les statistiques.
            </div>
        );
    }

    return (
        <div className="flex flex-col p-6 space-y-6 overflow-y-auto">
            <h1 className="text-2xl font-semibold mb-2">Statistiques</h1>

            {/* ── Overview cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={faKey} label="Clés totales" value={summary.totalKeys} />
                <StatCard
                    icon={faGlobe}
                    label="Langues"
                    value={summary.totalLanguages}
                />
                <StatCard
                    icon={faFolderOpen}
                    label="Namespaces"
                    value={summary.totalNamespaces}
                />
                <StatCard
                    icon={faCheckCircle}
                    label="Complétude globale"
                    value={`${summary.completionPercent}%`}
                    variant="success"
                />
            </div>

            {/* ── Language completion bar chart ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-md p-4 shadow-md">
                <h3 className="text-lg font-semibold mb-4 text-gray-200">
                    Complétude par langue
                </h3>
                {languageCompletion.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={languageCompletion}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis dataKey="language" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "#1f2937",
                                    border: "1px solid #374151",
                                    color: "#fff",
                                }}
                                formatter={(value: number) => `${value}%`}
                            />
                            <Legend />
                            <Bar dataKey="percent" name="Complétude (%)" fill="#22c55e" />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-sm text-gray-500">Aucune donnée disponible</p>
                )}
            </div>

            {/* ── Two columns: Namespace distribution + Language completion details ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Namespace key distribution pie */}
                <div className="bg-gray-900 border border-gray-800 rounded-md p-4 shadow-md">
                    <h3 className="text-lg font-semibold mb-4 text-gray-200">
                        Distribution des clés par namespace
                    </h3>
                    {namespaceDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={namespaceDistribution}
                                    dataKey="keys"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius="70%"
                                    label
                                >
                                    {namespaceDistribution.map((_, i) => (
                                        <Cell
                                            key={i}
                                            fill={COLORS[i % COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Legend />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#1f2937",
                                        border: "1px solid #374151",
                                        color: "#fff",
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-sm text-gray-500">Aucune donnée disponible</p>
                    )}
                </div>

                {/* Language completion details table */}
                <div className="bg-gray-900 border border-gray-800 rounded-md p-4 shadow-md">
                    <h3 className="text-lg font-semibold mb-4 text-gray-200">
                        Détails par langue
                    </h3>
                    <div className="overflow-y-auto max-h-[300px]">
                        <table className="min-w-full border-collapse text-sm">
                            <thead className="sticky top-0 bg-gray-900">
                                <tr className="text-gray-400 border-b border-gray-800">
                                    <th className="text-left p-2">Langue</th>
                                    <th className="text-right p-2">Complètes</th>
                                    <th className="text-right p-2">Manquantes</th>
                                    <th className="text-right p-2">%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {languageCompletion.map((lang, i) => (
                                    <tr
                                        key={lang.language}
                                        className="border-b border-gray-800 hover:bg-gray-800/30 transition"
                                    >
                                        <td className="p-2">
                                            <span className="bg-green-600/20 text-green-400 text-xs font-mono font-semibold px-2 py-0.5 rounded">
                                                {lang.language}
                                            </span>
                                        </td>
                                        <td className="p-2 text-right text-green-400">
                                            {lang.completed}
                                        </td>
                                        <td className="p-2 text-right text-red-400">
                                            {lang.missing}
                                        </td>
                                        <td className="p-2 text-right font-semibold">
                                            {lang.percent}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Namespace completion table ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-md p-4 shadow-md overflow-x-auto">
                <h3 className="text-lg font-semibold mb-4 text-gray-200">
                    Complétude par namespace
                </h3>
                <table className="min-w-full border-collapse text-sm">
                    <thead>
                        <tr className="text-gray-400 border-b border-gray-800">
                            <th className="text-left p-2">Namespace</th>
                            <th className="text-right p-2">Clés</th>
                            {languageCodes.map((lang) => (
                                <th key={lang} className="text-right p-2">
                                    <span className="bg-green-600/20 text-green-400 text-xs font-mono font-semibold px-2 py-0.5 rounded">
                                        {lang}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {namespaceCompletion.map((ns) => (
                            <tr
                                key={ns.namespace}
                                className="border-b border-gray-800 hover:bg-gray-800/30 transition"
                            >
                                <td className="p-2 font-medium text-gray-200">
                                    {ns.namespace}
                                </td>
                                <td className="p-2 text-right text-gray-400">
                                    {ns.totalKeys}
                                </td>
                                {languageCodes.map((lang) => {
                                    const stats = ns.langStats[lang];
                                    const percent =
                                        stats.total > 0
                                            ? (stats.filled / stats.total) * 100
                                            : 100;
                                    return (
                                        <td
                                            key={lang}
                                            className="p-2 text-right"
                                            title={`${stats.filled}/${stats.total}`}
                                        >
                                            <span
                                                className={`font-semibold ${
                                                    percent === 100
                                                        ? "text-green-400"
                                                        : percent >= 50
                                                        ? "text-yellow-400"
                                                        : "text-red-400"
                                                }`}
                                            >
                                                {percent.toFixed(0)}%
                                            </span>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── Missing translations ── */}
            {missingTranslations.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-md p-4 shadow-md">
                    <h3 className="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
                        <FontAwesomeIcon
                            icon={faExclamationTriangle}
                            className="text-yellow-400"
                        />
                        Traductions manquantes ({missingTranslations.length})
                    </h3>
                    <div className="overflow-y-auto max-h-[400px]">
                        <table className="min-w-full border-collapse text-sm">
                            <thead className="sticky top-0 bg-gray-900">
                                <tr className="text-gray-400 border-b border-gray-800">
                                    <th className="text-left p-2">Namespace</th>
                                    <th className="text-left p-2">Clé</th>
                                    <th className="text-left p-2">Langues manquantes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {missingTranslations.map((item, i) => (
                                    <tr
                                        key={i}
                                        className="border-b border-gray-800 hover:bg-gray-800/30 transition"
                                    >
                                        <td className="p-2 text-gray-400 font-mono text-xs">
                                            {item.namespace}
                                        </td>
                                        <td className="p-2 text-gray-200 font-mono text-xs">
                                            {item.key}
                                        </td>
                                        <td className="p-2">
                                            <div className="flex flex-wrap gap-1">
                                                {item.missingLanguages.map((lang) => (
                                                    <span
                                                        key={lang}
                                                        className="bg-red-600/20 text-red-400 text-xs font-mono px-2 py-0.5 rounded"
                                                    >
                                                        {lang}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Character count extremes ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Longest translations */}
                <div className="bg-gray-900 border border-gray-800 rounded-md p-4 shadow-md">
                    <h3 className="text-lg font-semibold mb-4 text-gray-200">
                        Traductions les plus longues
                    </h3>
                    <div className="space-y-2 overflow-y-auto max-h-[300px]">
                        {characterStats.longest.map((item, i) => (
                            <div
                                key={i}
                                className="bg-gray-800/50 rounded p-2 text-xs"
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-mono text-gray-400">
                                        {item.key}
                                    </span>
                                    <span className="bg-blue-600/20 text-blue-400 font-mono px-2 py-0.5 rounded ml-2">
                                        {item.lang}
                                    </span>
                                </div>
                                <div className="text-gray-300 truncate" title={item.text}>
                                    {item.text}
                                </div>
                                <div className="text-gray-500 mt-1">
                                    {item.length} caractères
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Shortest translations */}
                <div className="bg-gray-900 border border-gray-800 rounded-md p-4 shadow-md">
                    <h3 className="text-lg font-semibold mb-4 text-gray-200">
                        Traductions les plus courtes
                    </h3>
                    <div className="space-y-2 overflow-y-auto max-h-[300px]">
                        {characterStats.shortest.map((item, i) => (
                            <div
                                key={i}
                                className="bg-gray-800/50 rounded p-2 text-xs"
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-mono text-gray-400">
                                        {item.key}
                                    </span>
                                    <span className="bg-blue-600/20 text-blue-400 font-mono px-2 py-0.5 rounded ml-2">
                                        {item.lang}
                                    </span>
                                </div>
                                <div className="text-gray-300" title={item.text}>
                                    {item.text}
                                </div>
                                <div className="text-gray-500 mt-1">
                                    {item.length} caractères
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Stat card component ──
function StatCard({
    icon,
    label,
    value,
    variant = "default",
}: {
    icon: any;
    label: string;
    value: number | string;
    variant?: "default" | "success";
}) {
    const iconColor = variant === "success" ? "text-green-400" : "text-blue-400";
    const bgColor = variant === "success" ? "bg-green-500/10" : "bg-blue-500/10";

    return (
        <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-md p-4 shadow-md hover:border-gray-700 transition">
            <div className={`${bgColor} ${iconColor} p-3 rounded-lg`}>
                <FontAwesomeIcon icon={icon} className="w-5 h-5" />
            </div>
            <div>
                <div className="text-sm text-gray-400">{label}</div>
                <div className="text-lg font-semibold text-gray-100">{value}</div>
            </div>
        </div>
    );
}
