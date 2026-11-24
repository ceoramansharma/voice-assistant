import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Play,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
  RotateCcw,
  Check,
  X,
  Loader2,
  Terminal,
} from "lucide-react";
import type {
  ConversationTurn,
  ProjectConfig,
  SimulatedStep,
} from "../types/assistant";

interface IntentSimulatorProps {
  config: ProjectConfig;
}

interface PendingBatch {
  priorResponses: Array<Record<string, unknown>>;
  remainingCalls: Array<{ id?: string; name: string; args: Record<string, unknown> }>;
}

interface SimulatorApiResult {
  steps: SimulatedStep[];
  finalSpeech: string | null;
  pendingStepId: string | null;
  conversationState: ConversationTurn[];
  modelUsed: string;
  _pendingBatch?: PendingBatch;
  error?: string;
}

const PRESET_COMMANDS = [
  {
    label: "Multi-step VS Code script",
    category: "English · Safe",
    command:
      "Open VS Code, create a new file, and type a Python hello world script",
  },
  {
    label: "Hinglish VS Code + Python",
    category: "Hindi + English · Safe",
    command:
      "VS Code kholo, ek nayi file banao aur usme Python hello world script type karo",
  },
  {
    label: "Hindi YouTube search",
    category: "Hindi · Safe",
    command:
      "ब्राउज़र में यूट्यूब पर पाइथन ट्यूटोरियल सर्च करो और थोड़ा नीचे स्क्रॉल करो",
  },
  {
    label: "Hinglish delete + git status",
    category: "Hindi + English · High-Risk",
    command:
      "Documents folder se temp.log delete kar do aur workspace mein git status chalao",
  },
  {
    label: "Send status email",
    category: "English · High-Risk",
    command:
      "Send an email to alex@example.com with subject Release Ready saying all tests passed",
  },
];

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function IntentSimulator({ config }: IntentSimulatorProps) {
  const [utterance, setUtterance] = useState(PRESET_COMMANDS[0].command);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [steps, setSteps] = useState<SimulatedStep[]>([]);
  const [finalSpeech, setFinalSpeech] = useState<string | null>(null);
  const [pendingStepId, setPendingStepId] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<ConversationTurn[]>([]);
  const [pendingBatch, setPendingBatch] = useState<PendingBatch | undefined>(undefined);
  const [speakPreview, setSpeakPreview] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micLocale, setMicLocale] = useState<"en-IN" | "hi-IN">(
    config.voiceLanguage === "hindi_only" ? "hi-IN" : "en-IN"
  );

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const speakText = (text: string) => {
    if (!speakPreview || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = Math.min(1.6, Math.max(0.7, config.ttsRate / 175));
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore browser speech synthesis failures
    }
  };

  const runSimulation = async (overrideUtterance?: string) => {
    const query = (overrideUtterance ?? utterance).trim();
    if (!query || isLoading) return;

    setIsLoading(true);
    setErrorMsg(null);
    setSteps([]);
    setFinalSpeech(null);
    setPendingStepId(null);
    setConversationState([]);
    setPendingBatch(undefined);

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utterance: query,
          osTarget: config.osTarget,
          playwrightEnabled: config.enablePlaywright,
        }),
      });
      const data: SimulatorApiResult = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gemini intent routing request failed.");
      }

      setSteps(data.steps ?? []);
      setFinalSpeech(data.finalSpeech ?? null);
      setPendingStepId(data.pendingStepId ?? null);
      setConversationState(data.conversationState ?? []);
      setPendingBatch(data._pendingBatch);

      if (data.finalSpeech) {
        speakText(data.finalSpeech);
      } else if (data.pendingStepId) {
        const pending = (data.steps ?? []).find((s) => s.id === data.pendingStepId);
        if (pending) {
          speakText(
            `High risk action: ${pending.toolName.replaceAll("_", " ")}. Press Enter to confirm or Escape to cancel.`
          );
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to run intent simulation.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecision = async (decision: "approve" | "deny") => {
    if (!pendingStepId || isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch("/api/simulate/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          osTarget: config.osTarget,
          playwrightEnabled: config.enablePlaywright,
          conversationState,
          steps,
          pendingStepId,
          pendingBatch,
        }),
      });
      const data: SimulatorApiResult = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to resume execution loop.");
      }

      setSteps(data.steps ?? []);
      setFinalSpeech(data.finalSpeech ?? null);
      setPendingStepId(data.pendingStepId ?? null);
      setConversationState(data.conversationState ?? []);
      setPendingBatch(data._pendingBatch);

      if (data.finalSpeech) {
        speakText(data.finalSpeech);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to resume simulation.");
    } finally {
      setIsLoading(false);
    }
  };

  // Support real Enter / Esc keyboard confirmation when a High-Risk gate is open
  useEffect(() => {
    if (!pendingStepId || isLoading) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        void handleDecision("approve");
      } else if (e.key === "Escape") {
        e.preventDefault();
        void handleDecision("deny");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const toggleVoiceCapture = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;

    if (!SpeechRecCtor) {
      setErrorMsg(
        "Browser SpeechRecognition is unavailable in this browser. Type a command directly or pick a preset below."
      );
      return;
    }

    setErrorMsg(null);
    const rec = new SpeechRecCtor();
    rec.lang = micLocale;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript?.trim();
      if (spoken) {
        setUtterance(spoken);
        void runSimulation(spoken);
      }
    };
    rec.onerror = (event) => {
      setIsListening(false);
      if (event.error !== "no-speech") {
        setErrorMsg(`Microphone capture error: ${event.error}`);
      }
    };
    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
    setIsListening(true);
    rec.start();
  };

  const resetTrace = () => {
    setSteps([]);
    setFinalSpeech(null);
    setPendingStepId(null);
    setConversationState([]);
    setPendingBatch(undefined);
    setErrorMsg(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight text-balance">
            Live Gemini 2.5 Flash Intent & Safety Simulator
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            Test natural spoken or typed commands against the exact 19 tool declarations in{" "}
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
              tools.py
            </code>
            . Safe actions execute in dry-run mode; High-Risk actions pause at the confirmation gate.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span>Target: {config.osTarget}</span>
          <span aria-hidden="true">·</span>
          <label className="inline-flex items-center gap-1.5">
            <span>Mic:</span>
            <select
              aria-label="Browser dictation language"
              value={micLocale}
              onChange={(e) => setMicLocale(e.target.value as "en-IN" | "hi-IN")}
              className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none"
            >
              <option value="en-IN">English / Hinglish (en-IN)</option>
              <option value="hi-IN">Hindi (hi-IN)</option>
            </select>
          </label>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setSpeakPreview((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer whitespace-nowrap"
          >
            {speakPreview ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                TTS Audio On
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                TTS Audio Off
              </>
            )}
          </button>
        </div>
      </div>

      {/* Command Input Area */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <label
          htmlFor="voice-command-input"
          className="block text-xs font-semibold text-slate-700"
        >
          Natural Voice Command Transcript
        </label>

        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            id="voice-command-input"
            rows={2}
            value={utterance}
            onChange={(e) => setUtterance(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void runSimulation();
              }
            }}
            placeholder="Speak or type a command, e.g. Open VS Code, create a new file, and type a Python hello world script"
            className="flex-1 px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-none"
          />
          <div className="flex sm:flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void runSimulation()}
              disabled={isLoading || !utterance.trim()}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Run Dry-Run
            </button>

            <button
              type="button"
              onClick={toggleVoiceCapture}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                isListening
                  ? "bg-red-50 border-red-300 text-red-700"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  Stop Mic
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  Dictate
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preset scenarios */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-2">Sample commands:</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_COMMANDS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setUtterance(preset.command);
                  void runSimulation(preset.command);
                }}
                className="px-3 py-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors text-left cursor-pointer"
              >
                <span className="font-medium text-slate-900">{preset.label}</span>
                <span className="text-slate-400 mx-1.5">·</span>
                <span className="text-slate-500">{preset.category}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800 flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Simulation Error</p>
            <p className="text-xs mt-0.5 text-red-700">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Execution Trace */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Execution & Safety Trace
          </h2>
          {steps.length > 0 && (
            <button
              type="button"
              onClick={resetTrace}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Trace
            </button>
          )}
        </div>

        {steps.length === 0 && !finalSpeech && !isLoading && (
          <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
            <Terminal className="w-6 h-6 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-900">
              No dry-run trace yet
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Run one of the sample commands above or speak a custom command to inspect how{" "}
              <code className="font-mono">brain.py</code> decomposes natural speech into
              ordered Python tool calls and intercepts High-Risk operations.
            </p>
          </div>
        )}

        {isLoading && steps.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
            <div className="h-4 w-48 bg-slate-100 rounded" />
            <div className="h-16 w-full bg-slate-50 rounded" />
          </div>
        )}

        {steps.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
            {steps.map((step, index) => {
              const isHighRisk = step.risk === "high_risk";
              const isPending = step.status === "awaiting_confirmation";
              const isDenied = step.status === "denied";

              return (
                <div key={step.id} className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs text-slate-400 tabular-nums">
                        {String(index + 1).padStart(2, "0")}.
                      </span>
                      <code className="font-mono text-sm font-semibold text-slate-900">
                        {step.toolName}
                      </code>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      {isHighRisk ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          High-Risk
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Safe
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-medium">
                      {step.status === "executed" && (
                        <span className="text-slate-600">Executed (dry-run)</span>
                      )}
                      {step.status === "approved" && (
                        <span className="text-emerald-700">
                          Confirmed by user · Executed
                        </span>
                      )}
                      {step.status === "denied" && (
                        <span className="text-red-700">Denied by user · Skipped</span>
                      )}
                      {isPending && (
                        <span className="text-amber-700 font-semibold">
                          Paused · Awaiting Confirmation
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">{step.riskReason}</p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="bg-slate-950 rounded-md p-3.5 overflow-x-auto">
                      <p className="text-[11px] font-mono text-slate-400 mb-1.5">
                        Gemini FunctionCall Arguments
                      </p>
                      <pre className="text-xs font-mono text-sky-300 leading-relaxed">
                        {JSON.stringify(step.args, null, 2)}
                      </pre>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 overflow-x-auto">
                      <p className="text-[11px] font-mono text-slate-500 mb-1.5">
                        {isPending
                          ? "SafetyGuard Gate (Paused)"
                          : "Tool Return Payload"}
                      </p>
                      {isPending ? (
                        <div className="space-y-3">
                          <p className="text-xs text-slate-700 leading-relaxed">
                            <code className="font-mono">safety.py</code> intercepted this
                            High-Risk call before execution. Confirm with{" "}
                            <kbd className="px-1.5 py-0.5 text-[11px] bg-white border border-slate-300 rounded">
                              Enter
                            </kbd>{" "}
                            or cancel with{" "}
                            <kbd className="px-1.5 py-0.5 text-[11px] bg-white border border-slate-300 rounded">
                              Esc
                            </kbd>
                            .
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => void handleDecision("approve")}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve (Yes / Enter)
                            </button>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => void handleDecision("deny")}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-white border border-red-300 hover:bg-red-50 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <X className="w-3.5 h-3.5" />
                              Deny (No / Esc)
                            </button>
                          </div>
                        </div>
                      ) : (
                        <pre
                          className={`text-xs font-mono leading-relaxed ${
                            isDenied ? "text-red-700" : "text-slate-700"
                          }`}
                        >
                          {JSON.stringify(step.simulatedOutput ?? {}, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Final Spoken Response */}
        {finalSpeech && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 flex items-start gap-3.5">
            <Volume2 className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500">
                pyttsx3 Offline Spoken Confirmation
              </p>
              <p className="text-sm font-medium text-slate-900 leading-relaxed">
                “{finalSpeech}”
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
