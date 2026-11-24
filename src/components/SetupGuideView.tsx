import React, { useState } from "react";
import { Check, Copy, AlertTriangle } from "lucide-react";
import { getSetupGuide } from "../data/setupGuides";
import type { OsTarget, ProjectConfig } from "../types/assistant";

interface SetupGuideViewProps {
  config: ProjectConfig;
  onChangeOs: (os: OsTarget) => void;
}

export function SetupGuideView({ config, onChangeOs }: SetupGuideViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const guide = getSetupGuide(config.osTarget, config);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Header + OS Segmented Switch */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight text-balance">
            Setup & Troubleshooting Runbook
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            {guide.prerequisitesSummary}
          </p>
        </div>

        <div
          className="inline-flex items-center p-1 bg-slate-100 rounded-md"
          role="tablist"
          aria-label="Target operating system"
        >
          {(
            [
              { id: "macos", label: "macOS" },
              { id: "windows", label: "Windows" },
              { id: "linux", label: "Linux" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={config.osTarget === tab.id}
              onClick={() => onChangeOs(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                config.osTarget === tab.id
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Installation Steps */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Installation Steps · {guide.osLabel}
          </h2>
          <span className="text-xs font-mono text-slate-500">
            Shell: {guide.shellLabel}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          {guide.steps.map((step) => {
            const copyKey = `${config.osTarget}-${step.number}`;
            const isCopied = copiedId === copyKey;

            return (
              <div key={step.number} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {step.number}. {step.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleCopy(copyKey, step.command)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-slate-950 rounded-md p-4 overflow-x-auto">
                  <pre className="text-xs font-mono text-slate-100 leading-relaxed whitespace-pre">
                    {step.command}
                  </pre>
                </div>

                {step.note && (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Note: {step.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* OS Permissions Checklist */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          OS Permissions & Runtime Verification ({guide.osLabel})
        </h2>
        <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
          {guide.permissionsChecklist.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <span className="font-mono text-slate-400 tabular-nums shrink-0">
                0{idx + 1}.
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Troubleshooting Table */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h2 className="text-base font-semibold text-slate-900">
            Common Issues & Fixes
          </h2>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                  <th className="py-3 px-4 w-1/3">Symptom</th>
                  <th className="py-3 px-4 w-1/3">Root Cause</th>
                  <th className="py-3 px-4 w-1/3">Fix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {guide.troubleshooting.map((row, idx) => (
                  <tr key={idx} className="align-top hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-mono text-slate-900 font-medium">
                      {row.symptom}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 leading-relaxed">
                      {row.cause}
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 leading-relaxed">
                      {row.resolution}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
