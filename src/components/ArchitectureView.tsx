import React from "react";
import { ArrowRight, FolderTree } from "lucide-react";
import type { ProjectConfig, PythonFileArtifact } from "../types/assistant";

interface ArchitectureViewProps {
  config: ProjectConfig;
  files: PythonFileArtifact[];
  onOpenFile: (path: string) => void;
}

const PIPELINE_STAGES = [
  {
    index: "01",
    title: "Push-to-Talk Capture",
    module: "audio_io.py",
    tech: "pynput + sounddevice",
    detail:
      "Records 16kHz mono float32 audio strictly while the PTT hotkey is held. Debounces OS key-repeat events and drops sub-350ms accidental taps.",
  },
  {
    index: "02",
    title: "Local Speech-to-Text",
    module: "audio_io.py",
    tech: "faster-whisper (VAD)",
    detail:
      "Transcribes audio buffers directly in RAM with Silero VAD filtering and automatic CUDA float16 / CPU int8 selection—zero audio leaves your machine.",
  },
  {
    index: "03",
    title: "Gemini Intent Routing",
    module: "brain.py",
    tech: "google-genai · gemini-2.5-flash",
    detail:
      "Maps natural speech into multi-step typed Python function calls using OS-aware system instructions. SDK automatic execution is explicitly disabled.",
  },
  {
    index: "04",
    title: "Safety & Confirmation Gate",
    module: "safety.py",
    tech: "SafetyGuard + FAILSAFE",
    detail:
      "Classifies every proposed call as Safe vs. High-Risk (with dynamic overwrite escalation). Blocks protected OS paths and requires spoken/keyboard approval.",
  },
  {
    index: "05",
    title: "OS-Aware Execution",
    module: "tools.py",
    tech: "PyAutoGUI · pathlib · Playwright",
    detail:
      "Executes keyboard shortcuts, clipboard-safe dictation, OS-native app launchers, file mutations, and optional Playwright semantic browser tasks.",
  },
  {
    index: "06",
    title: "Offline Voice Feedback",
    module: "audio_io.py",
    tech: "pyttsx3 worker thread",
    detail:
      "Speaks crisp 1–2 sentence confirmations from a dedicated TTS queue thread so SAPI5, NSSpeechSynthesizer, and espeak-ng never deadlock.",
  },
];

const ARCHITECTURE_DECISIONS = [
  {
    title: "Why disable automatic_function_calling in google-genai?",
    rationale:
      "The Python SDK can invoke tool callables automatically, which would execute delete_path or run_shell_command before a human can intervene. Setting AutomaticFunctionCallingConfig(disable=True) forces every FunctionCall through SafetyGuard.classify() and SafetyGuard.request_confirmation() with an immutable JSONL audit record.",
  },
  {
    title: "Why auto-switch multiline dictation to clipboard paste?",
    rationale:
      "pyautogui.write() struggles with non-ASCII Unicode characters and can trigger editor auto-indent duplication when typing Python code line by line. type_text() automatically copies multiline or Unicode payloads via pyperclip, dispatches OS paste (Cmd+V / Ctrl+V), and restores your previous clipboard.",
  },
  {
    title: "Why isolate pyttsx3 onto a dedicated worker thread?",
    rationale:
      "pyttsx3 wraps OS-native speech APIs (COM/SAPI5 on Windows, AppKit NSSpeechSynthesizer on macOS) that crash or hang if initialized on one thread and called from another. VoiceSpeaker owns one persistent worker thread fed by a thread-safe Queue.",
  },
  {
    title: "Why prefer OS hotkeys & Playwright over (x, y) coordinates?",
    rationale:
      "Hardcoded pixel coordinates break immediately across HiDPI scaling, multi-monitor setups, or window resizing. VoxControl relies on portable 'mod' hotkeys, OS app launchers (open -a, os.startfile, xdg-open), window activation APIs, and Playwright semantic text locators.",
  },
];

export function ArchitectureView({
  config,
  files,
  onOpenFile,
}: ArchitectureViewProps) {
  const isOllama = config.llmProvider === "ollama";
  const activeBrainLabel = isOllama
    ? `Ollama (${config.ollamaModel})`
    : "Gemini API (gemini-2.5-flash)";

  const dynamicStages = PIPELINE_STAGES.map((stage) =>
    stage.index === "03"
      ? {
          ...stage,
          title: isOllama ? "Local Ollama Intent Routing" : "Gemini Intent Routing",
          tech: isOllama
            ? `ollama · ${config.ollamaModel}`
            : "google-genai · gemini-2.5-flash",
          detail: isOllama
            ? "Runs 100% locally via Ollama with zero API keys. Uses native tool calling (qwen2.5, llama3.1, mistral) with automatic structured-JSON fallback for older models."
            : stage.detail,
        }
      : stage
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight text-balance">
            Modular System Architecture & Data Flow
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            VoxControl separates audio I/O, LLM intent planning, risk governance, and
            OS-specific execution into six cleanly bounded Python modules.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-500">
          PTT: {config.pttHotkey.toUpperCase()} · STT: {config.whisperModel} · Brain:{" "}
          {activeBrainLabel}
        </div>
      </div>

      {/* 6-Stage Execution Pipeline */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          End-to-End Voice Command Pipeline
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dynamicStages.map((stage) => (
            <div
              key={stage.index}
              className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold text-blue-700 tabular-nums">
                    Stage {stage.index}
                  </span>
                  <span className="font-mono text-slate-500">{stage.tech}</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {stage.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {stage.detail}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <code className="font-mono text-xs text-slate-700">
                  {stage.module}
                </code>
                <button
                  type="button"
                  onClick={() => onOpenFile(stage.module)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
                >
                  Inspect
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Folder Layout + Key Design Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Project Folder Structure
            </h2>
          </div>

          <div className="bg-slate-950 rounded-md p-4 font-mono text-xs text-slate-200 space-y-1.5 overflow-x-auto">
            <div className="text-sky-400 font-semibold">voxcontrol/</div>
            {files.map((file, idx) => {
              const prefix = idx === files.length - 1 ? "└── " : "├── ";
              const lines = file.content.split("\n").length;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => onOpenFile(file.path)}
                  className="w-full flex items-center justify-between gap-3 text-left py-1 px-1.5 rounded hover:bg-slate-800/80 transition-colors cursor-pointer"
                >
                  <span className="truncate">
                    <span className="text-slate-500">{prefix}</span>
                    <span className="text-slate-100">{file.path}</span>
                  </span>
                  <span className="text-slate-500 tabular-nums shrink-0">
                    {lines}L
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Click any file in the tree above to open its complete runnable source code
            in the Source Code explorer.
          </p>
        </section>

        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Principal Architecture Decisions
            </h2>
          </div>
          {ARCHITECTURE_DECISIONS.map((item, idx) => (
            <div key={idx} className="p-5 space-y-1.5">
              <h3 className="text-xs font-semibold text-slate-900">
                0{idx + 1}. {item.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {item.rationale}
              </p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
