import React, { useMemo, useState } from "react";
import JSZip from "jszip";
import {
  Code2,
  Download,
  Layers,
  Menu,
  PlayCircle,
  ShieldCheck,
  TerminalSquare,
  X,
} from "lucide-react";
import { generatePythonProject } from "./data/pythonProjectGenerator";
import { CodeExplorer } from "./components/CodeExplorer";
import { IntentSimulator } from "./components/IntentSimulator";
import { ToolsSafetyMatrix } from "./components/ToolsSafetyMatrix";
import { ArchitectureView } from "./components/ArchitectureView";
import { SetupGuideView } from "./components/SetupGuideView";
import type {
  ConfirmationMode,
  LlmProvider,
  NavSection,
  OllamaModel,
  OsTarget,
  ProjectConfig,
  PttHotkey,
  PythonFileArtifact,
  VoiceLanguageMode,
  WhisperDevice,
  WhisperModelSize,
} from "./types/assistant";

const DEFAULT_CONFIG: ProjectConfig = {
  osTarget: "windows",
  llmProvider: "ollama",
  ollamaModel: "qwen2.5:7b",
  ollamaHost: "http://localhost:11434",
  pttHotkey: "ctrl_r",
  voiceLanguage: "bilingual_hi_en",
  whisperModel: "small",
  whisperDevice: "auto",
  enablePlaywright: true,
  confirmationMode: "voice_or_keyboard",
  ttsRate: 185,
};

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "code", label: "Source Code", icon: Code2 },
  { id: "simulator", label: "Intent Simulator", icon: PlayCircle },
  { id: "tools", label: "Tools & Safety", icon: ShieldCheck },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "setup", label: "Setup Guide", icon: TerminalSquare },
];

export default function App() {
  const [config, setConfig] = useState<ProjectConfig>(DEFAULT_CONFIG);
  const [activeSection, setActiveSection] = useState<NavSection>("code");
  const [activeFilePath, setActiveFilePath] = useState<string>("main.py");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const projectFiles = useMemo(() => generatePythonProject(config), [config]);

  const activeNavLabel =
    NAV_ITEMS.find((item) => item.id === activeSection)?.label ?? "Source Code";

  const handleDownloadZip = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("voxcontrol");
      if (!folder) return;

      for (const file of projectFiles) {
        folder.file(file.path, file.content);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `voxcontrol-${config.osTarget}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSingleFile = (file: PythonFileArtifact) => {
    const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.path;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const openFileInExplorer = (path: string) => {
    setActiveFilePath(path);
    setActiveSection("code");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      {/* Brand Wordmark */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 bg-white shrink-0">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection("code");
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          VoxControl
        </a>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Workspace Navigation */}
      <nav className="p-3 space-y-1 border-b border-slate-200" aria-label="Workspace sections">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveSection(item.id);
                setMobileNavOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? "text-blue-700" : "text-slate-400"
                }`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Live Project Target Configurator */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-900">
            Build Configuration
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
            Updates <code className="font-mono">config.py</code>,{" "}
            <code className="font-mono">requirements.txt</code>, and setup commands live.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="cfg-os"
              className="block text-[11px] font-medium text-slate-600 mb-1"
            >
              Target OS
            </label>
            <select
              id="cfg-os"
              value={config.osTarget}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  osTarget: e.target.value as OsTarget,
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="macos">macOS (Apple Silicon / Intel)</option>
              <option value="windows">Windows 10 / 11</option>
              <option value="linux">Linux (Ubuntu / Debian / Arch)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="cfg-provider"
              className="block text-[11px] font-medium text-slate-600 mb-1"
            >
              AI Brain Provider
            </label>
            <select
              id="cfg-provider"
              value={config.llmProvider}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  llmProvider: e.target.value as LlmProvider,
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="ollama">Local Ollama (100% Offline, Free)</option>
              <option value="gemini">Gemini API (Cloud · gemini-2.5-flash)</option>
            </select>
          </div>

          {config.llmProvider === "ollama" && (
            <div>
              <label
                htmlFor="cfg-ollama-model"
                className="block text-[11px] font-medium text-slate-600 mb-1"
              >
                Local Ollama Model
              </label>
              <select
                id="cfg-ollama-model"
                value={config.ollamaModel}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    ollamaModel: e.target.value as OllamaModel,
                  }))
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="qwen2.5:7b">qwen2.5:7b (Best Hindi+EN + Tools)</option>
                <option value="llama3.1">llama3.1 (Native Tools)</option>
                <option value="llama3">llama3 (JSON Tool Fallback)</option>
                <option value="mistral">mistral (Native Tools)</option>
                <option value="deepseek-coder">deepseek-coder (Code + JSON Tools)</option>
                <option value="llama3.2:3b">llama3.2:3b (Fast / Low RAM)</option>
              </select>
              <p className="text-[10px] font-mono text-slate-500 mt-1 truncate">
                ollama pull {config.ollamaModel}
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="cfg-hotkey"
              className="block text-[11px] font-medium text-slate-600 mb-1"
            >
              Push-to-Talk Hotkey
            </label>
            <select
              id="cfg-hotkey"
              value={config.pttHotkey}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  pttHotkey: e.target.value as PttHotkey,
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="ctrl_r">Right Ctrl (ctrl_r)</option>
              <option value="f9">F9 Function Key (f9)</option>
              <option value="alt_r">Right Alt / Option (alt_r)</option>
              <option value="f8">F8 Function Key (f8)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="cfg-language"
              className="block text-[11px] font-medium text-slate-600 mb-1"
            >
              Voice Recognition Language
            </label>
            <select
              id="cfg-language"
              value={config.voiceLanguage}
              onChange={(e) => {
                const nextLang = e.target.value as VoiceLanguageMode;
                setConfig((prev) => {
                  let nextModel = prev.whisperModel;
                  if (nextLang === "english_only" && !nextModel.endsWith(".en")) {
                    nextModel =
                      nextModel === "large-v3-turbo"
                        ? "small.en"
                        : (`${nextModel}.en` as WhisperModelSize);
                  } else if (nextLang !== "english_only" && nextModel.endsWith(".en")) {
                    nextModel = nextModel.slice(0, -3) as WhisperModelSize;
                  }
                  return {
                    ...prev,
                    voiceLanguage: nextLang,
                    whisperModel: nextModel,
                  };
                });
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="bilingual_hi_en">Hindi + English (Hinglish)</option>
              <option value="hindi_only">Hindi Only (hi)</option>
              <option value="english_only">English Only (en)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="cfg-whisper"
                className="block text-[11px] font-medium text-slate-600 mb-1"
              >
                Whisper Model
              </label>
              <select
                id="cfg-whisper"
                value={config.whisperModel}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    whisperModel: e.target.value as WhisperModelSize,
                  }))
                }
                className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                {config.voiceLanguage === "english_only" ? (
                  <>
                    <option value="tiny.en">tiny.en</option>
                    <option value="base.en">base.en</option>
                    <option value="small.en">small.en</option>
                    <option value="medium.en">medium.en</option>
                  </>
                ) : (
                  <>
                    <option value="tiny">tiny</option>
                    <option value="base">base</option>
                    <option value="small">small</option>
                    <option value="medium">medium</option>
                    <option value="large-v3-turbo">large-v3-turbo</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="cfg-device"
                className="block text-[11px] font-medium text-slate-600 mb-1"
              >
                STT Device
              </label>
              <select
                id="cfg-device"
                value={config.whisperDevice}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    whisperDevice: e.target.value as WhisperDevice,
                  }))
                }
                className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="auto">auto</option>
                <option value="cpu">cpu</option>
                <option value="cuda">cuda</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="cfg-confirm"
              className="block text-[11px] font-medium text-slate-600 mb-1"
            >
              High-Risk Confirmation
            </label>
            <select
              id="cfg-confirm"
              value={config.confirmationMode}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  confirmationMode: e.target.value as ConfirmationMode,
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="voice_or_keyboard">Voice (“yes”) or Enter</option>
              <option value="keyboard_only">Keyboard Only (Enter / Esc)</option>
              <option value="voice_only">Voice Only (“yes” / “no”)</option>
            </select>
          </div>

          <label className="flex items-center justify-between gap-2 pt-1 cursor-pointer">
            <span className="text-xs font-medium text-slate-700">
              Playwright Browser Layer
            </span>
            <input
              type="checkbox"
              checked={config.enablePlaywright}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  enablePlaywright: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
          </label>
        </div>
      </div>

      {/* Quiet Footer Metadata */}
      <div className="px-4 py-3 border-t border-slate-200 text-[11px] text-slate-500">
        Python 3.10+ · PyAutoGUI Failsafe On
      </div>
    </div>
  );

  return (
    <div id="top" className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Left Sidebar Rail */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 max-w-[85vw] h-full shadow-xl">{sidebarContent}</div>
          <button
            type="button"
            className="flex-1 bg-slate-950/40"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation backdrop"
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Strict Top Bar Contract: Breadcrumb left, 1 primary action right */}
        <header className="h-14 sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-md cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="font-display font-semibold text-slate-900 whitespace-nowrap shrink-0 lg:hidden">
                VoxControl
              </span>
              <span className="text-slate-300 lg:hidden" aria-hidden="true">
                /
              </span>
              <span className="text-slate-500 whitespace-nowrap shrink-0 hidden lg:inline">
                VoxControl
              </span>
              <span className="text-slate-300 hidden lg:inline" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-900 whitespace-nowrap shrink-0">
                {activeNavLabel}
              </span>
              {activeSection === "code" && (
                <>
                  <span className="text-slate-300" aria-hidden="true">
                    /
                  </span>
                  <span className="font-mono text-xs text-slate-600 truncate">
                    {activeFilePath}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleDownloadZip()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {isExporting ? "Packaging..." : "Download Project (.zip)"}
            </button>
          </div>
        </header>

        {/* Active Viewport */}
        <main className="flex-1 min-w-0">
          {activeSection === "code" && (
            <CodeExplorer
              files={projectFiles}
              activePath={activeFilePath}
              onSelectPath={setActiveFilePath}
              onDownloadSingle={handleDownloadSingleFile}
            />
          )}

          {activeSection === "simulator" && <IntentSimulator config={config} />}

          {activeSection === "tools" && (
            <ToolsSafetyMatrix osTarget={config.osTarget} />
          )}

          {activeSection === "architecture" && (
            <ArchitectureView
              config={config}
              files={projectFiles}
              onOpenFile={openFileInExplorer}
            />
          )}

          {activeSection === "setup" && (
            <SetupGuideView
              config={config}
              onChangeOs={(osTarget) =>
                setConfig((prev) => ({ ...prev, osTarget }))
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}
