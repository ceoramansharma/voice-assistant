import React, { useMemo, useState } from "react";
import { Check, Copy, FileCode2, FileText, Download } from "lucide-react";
import type { PythonFileArtifact } from "../types/assistant";

interface CodeExplorerProps {
  files: PythonFileArtifact[];
  activePath: string;
  onSelectPath: (path: string) => void;
  onDownloadSingle: (file: PythonFileArtifact) => void;
}

const PY_KEYWORDS = new Set([
  "from",
  "import",
  "as",
  "def",
  "class",
  "return",
  "if",
  "elif",
  "else",
  "for",
  "in",
  "while",
  "try",
  "except",
  "finally",
  "with",
  "raise",
  "assert",
  "pass",
  "break",
  "continue",
  "and",
  "or",
  "not",
  "is",
  "lambda",
  "True",
  "False",
  "None",
  "global",
  "nonlocal",
  "yield",
]);

const PY_BUILTINS = new Set([
  "str",
  "int",
  "float",
  "bool",
  "dict",
  "list",
  "tuple",
  "set",
  "object",
  "Exception",
  "ValueError",
  "PermissionError",
  "RuntimeError",
  "OSError",
  "print",
  "len",
  "max",
  "min",
  "round",
  "sorted",
  "any",
  "all",
  "getattr",
  "isinstance",
  "Path",
  "Any",
  "Callable",
  "Literal",
]);

function highlightPythonLine(line: string): React.ReactNode[] {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("#")) {
    return [<span key="c" className="text-slate-400 italic">{line}</span>];
  }
  if (trimmed.startsWith("@")) {
    return [<span key="d" className="text-amber-300">{line}</span>];
  }

  const tokens: React.ReactNode[] = [];
  const regex =
    /(#.*$)|("""|'''|f?"(?:\\.|[^"\\])*"|f?'(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(
        <span key={`t${keyIdx++}`} className="text-slate-200">
          {line.slice(lastIndex, match.index)}
        </span>
      );
    }

    const [full, comment, strLit, numLit, ident] = match;
    if (comment) {
      tokens.push(
        <span key={`t${keyIdx++}`} className="text-slate-400 italic">
          {comment}
        </span>
      );
    } else if (strLit) {
      tokens.push(
        <span key={`t${keyIdx++}`} className="text-emerald-300">
          {strLit}
        </span>
      );
    } else if (numLit) {
      tokens.push(
        <span key={`t${keyIdx++}`} className="text-amber-300">
          {numLit}
        </span>
      );
    } else if (ident) {
      if (PY_KEYWORDS.has(ident)) {
        tokens.push(
          <span key={`t${keyIdx++}`} className="text-sky-400 font-medium">
            {ident}
          </span>
        );
      } else if (PY_BUILTINS.has(ident)) {
        tokens.push(
          <span key={`t${keyIdx++}`} className="text-indigo-300">
            {ident}
          </span>
        );
      } else {
        tokens.push(
          <span key={`t${keyIdx++}`} className="text-slate-100">
            {ident}
          </span>
        );
      }
    } else {
      tokens.push(
        <span key={`t${keyIdx++}`} className="text-slate-200">
          {full}
        </span>
      );
    }
    lastIndex = match.index + full.length;
  }

  if (lastIndex < line.length) {
    tokens.push(
      <span key={`t${keyIdx++}`} className="text-slate-200">
        {line.slice(lastIndex)}
      </span>
    );
  }
  return tokens.length > 0 ? tokens : [<span key="empty"> </span>];
}

export function CodeExplorer({
  files,
  activePath,
  onSelectPath,
  onDownloadSingle,
}: CodeExplorerProps) {
  const [copied, setCopied] = useState(false);

  const activeFile = useMemo(
    () => files.find((f) => f.path === activePath) ?? files[0],
    [files, activePath]
  );

  const lines = useMemo(() => activeFile.content.split("\n"), [activeFile]);

  const totalLines = useMemo(
    () => files.reduce((acc, file) => acc + file.content.split("\n").length, 0),
    [files]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-57px)] bg-white">
      {/* File Tree Column */}
      <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/70">
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 tracking-tight">
            voxcontrol/
          </span>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {files.length} files · {totalLines} loc
          </span>
        </div>

        <nav className="p-2 space-y-0.5" aria-label="Python project files">
          {files.map((file) => {
            const isSelected = file.path === activeFile.path;
            const lineCount = file.content.split("\n").length;
            const Icon = file.language === "python" ? FileCode2 : FileText;

            return (
              <button
                key={file.path}
                type="button"
                onClick={() => onSelectPath(file.path)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left rounded-md transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? "text-blue-600" : "text-slate-400"
                    }`}
                  />
                  <span className="font-mono text-xs font-medium truncate">
                    {file.path}
                  </span>
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                  {lineCount}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 mt-2 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-800 mb-2">
            Module Responsibilities
          </p>
          <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
            {activeFile.responsibilities.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-slate-400 font-mono tabular-nums shrink-0">
                  0{index + 1}.
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Active Code Editor Pane */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight truncate">
                {activeFile.path}
              </h2>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {activeFile.title}
              </span>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                {lines.length} lines
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              {activeFile.summary}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onDownloadSingle(activeFile)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Save File
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Source
                </>
              )}
            </button>
          </div>
        </div>

        {/* High-contrast Dark Code Surface */}
        <div className="flex-1 bg-slate-950 overflow-auto code-scroll">
          <div className="py-4 min-w-max">
            <table className="w-full border-collapse font-mono text-[13px] leading-6">
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/70">
                    <td className="select-none text-right pr-5 pl-5 text-slate-500 w-14 align-top tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="pr-8 whitespace-pre text-slate-100">
                      {activeFile.language === "python" ? (
                        highlightPythonLine(line)
                      ) : (
                        <span
                          className={
                            line.trimStart().startsWith("#")
                              ? "text-slate-400 italic"
                              : "text-slate-200"
                          }
                        >
                          {line || " "}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
