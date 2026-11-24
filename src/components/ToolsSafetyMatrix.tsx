import React, { useMemo, useState } from "react";
import { Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { TOOL_REGISTRY } from "../data/toolRegistry";
import type { OsTarget, RiskLevel, ToolSpec } from "../types/assistant";

interface ToolsSafetyMatrixProps {
  osTarget: OsTarget;
}

const CATEGORIES: Array<"All" | ToolSpec["category"]> = [
  "All",
  "Input & Dictation",
  "Keyboard & Windowing",
  "Applications",
  "File System",
  "Browser Automation",
  "System & Terminal",
];

export function ToolsSafetyMatrix({ osTarget }: ToolsSafetyMatrixProps) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");
  const [categoryFilter, setCategoryFilter] = useState<"All" | ToolSpec["category"]>("All");

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TOOL_REGISTRY.filter((tool) => {
      if (riskFilter !== "all" && tool.risk !== riskFilter) return false;
      if (categoryFilter !== "All" && tool.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.guardrail.toLowerCase().includes(q) ||
        tool.exampleVoice.toLowerCase().includes(q)
      );
    });
  }, [search, riskFilter, categoryFilter]);

  const safeCount = useMemo(
    () => TOOL_REGISTRY.filter((t) => t.risk === "safe").length,
    []
  );
  const highRiskCount = TOOL_REGISTRY.length - safeCount;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight text-balance">
            Tool Declarations & Safety Classification Matrix
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            Every Python function exposed to{" "}
            <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              gemini-2.5-flash
            </code>{" "}
            carries strict type hints, OS-aware branches, and a mandatory risk policy enforced by{" "}
            <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              SafetyGuard
            </code>
            .
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-600 font-mono tabular-nums">
          <span>{TOOL_REGISTRY.length} tools</span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-700 font-medium">{safeCount} Safe</span>
          <span aria-hidden="true">·</span>
          <span className="text-red-700 font-medium">{highRiskCount} High-Risk</span>
        </div>
      </div>

      {/* Mandatory Safety Guardrails Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-1.5">
          <p className="text-xs font-semibold text-slate-900">
            01. Hardware Corner Failsafe
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            <code className="font-mono text-slate-800">pyautogui.FAILSAFE = True</code> is
            re-asserted before every keystroke or shortcut. Slamming the cursor into any
            screen corner raises <code className="font-mono">FailSafeException</code> immediately.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-1.5">
          <p className="text-xs font-semibold text-slate-900">
            02. Manual AFC Interception
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            <code className="font-mono text-slate-800">brain.py</code> disables SDK automatic
            function calling so no High-Risk action can execute without explicit voice (
            <em>“yes”</em>) or keyboard (<kbd>Enter</kbd>) confirmation.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-1.5">
          <p className="text-xs font-semibold text-slate-900">
            03. Protected Path & Audit Trail
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            <code className="font-mono text-slate-800">validate_path()</code> blocks writes
            or deletes inside OS roots and <code className="font-mono">~/.ssh</code>. Every
            decision is logged to <code className="font-mono">~/.voxcontrol/audit.log</code>.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tools by name, voice command, or guardrail..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-md">
            {(["all", "safe", "high_risk"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setRiskFilter(level)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  riskFilter === level
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {level === "all" ? "All Risk" : level === "safe" ? "Safe Only" : "High-Risk Only"}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as "All" | ToolSpec["category"])
            }
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "All" ? "All Categories" : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* High-Density Engineering Matrix */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-56">Tool & Signature</th>
                <th className="py-3 px-4 w-32">Risk Policy</th>
                <th className="py-3 px-4">Behavior & Guardrail</th>
                <th className="py-3 px-4 w-64">
                  OS Implementation ({osTarget})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredTools.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-500">
                    No tools match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTools.map((tool) => {
                  const isHighRisk = tool.risk === "high_risk";
                  return (
                    <tr key={tool.name} className="hover:bg-slate-50/70 align-top">
                      <td className="py-3.5 px-4 space-y-1">
                        <code className="font-mono text-[13px] font-semibold text-slate-900 block">
                          {tool.name}
                        </code>
                        <span className="text-[11px] text-slate-500 block">
                          {tool.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isHighRisk ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            High-Risk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            Safe
                          </span>
                        )}
                        {tool.dynamicEscalation && (
                          <p className="text-[11px] text-amber-700 mt-1 whitespace-normal max-w-[140px]">
                            Escalates on overwrite
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 space-y-1.5 max-w-md">
                        <p className="text-slate-700 leading-relaxed">
                          {tool.description}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          <span className="font-medium text-slate-700">Guardrail:</span>{" "}
                          {tool.guardrail}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          <span className="font-medium text-slate-700">Voice example:</span>{" "}
                          “{tool.exampleVoice}”
                        </p>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 leading-relaxed">
                        {tool.osNotes[osTarget]}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
