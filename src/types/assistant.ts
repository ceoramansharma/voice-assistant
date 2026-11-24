export type OsTarget = "macos" | "windows" | "linux";

export type PttHotkey = "ctrl_r" | "f9" | "alt_r" | "f8";

export type VoiceLanguageMode = "bilingual_hi_en" | "english_only" | "hindi_only";

export type WhisperModelSize =
  | "tiny"
  | "base"
  | "small"
  | "medium"
  | "large-v3-turbo"
  | "tiny.en"
  | "base.en"
  | "small.en"
  | "medium.en";

export type WhisperDevice = "auto" | "cpu" | "cuda";

export type ConfirmationMode = "voice_or_keyboard" | "keyboard_only" | "voice_only";

export type RiskLevel = "safe" | "high_risk";

export type NavSection =
  | "code"
  | "simulator"
  | "tools"
  | "architecture"
  | "setup";

export type LlmProvider = "ollama" | "gemini";

export type OllamaModel =
  | "qwen2.5:7b"
  | "llama3.1"
  | "llama3"
  | "mistral"
  | "deepseek-coder"
  | "llama3.2:3b";

export interface ProjectConfig {
  osTarget: OsTarget;
  llmProvider: LlmProvider;
  ollamaModel: OllamaModel;
  ollamaHost: string;
  pttHotkey: PttHotkey;
  voiceLanguage: VoiceLanguageMode;
  whisperModel: WhisperModelSize;
  whisperDevice: WhisperDevice;
  enablePlaywright: boolean;
  confirmationMode: ConfirmationMode;
  ttsRate: number;
}

export interface PythonFileArtifact {
  path: string;
  title: string;
  language: "python" | "text" | "env" | "markdown" | "batch";
  summary: string;
  responsibilities: string[];
  content: string;
}

export interface ToolSpec {
  name: string;
  signature: string;
  category:
    | "Input & Dictation"
    | "Keyboard & Windowing"
    | "Applications"
    | "File System"
    | "Browser Automation"
    | "System & Terminal";
  risk: RiskLevel;
  dynamicEscalation?: string;
  description: string;
  osNotes: {
    windows: string;
    macos: string;
    linux: string;
  };
  guardrail: string;
  exampleVoice: string;
}

export interface SimulatedStep {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  risk: RiskLevel;
  riskReason: string;
  status: "executed" | "awaiting_confirmation" | "approved" | "denied";
  simulatedOutput?: Record<string, unknown>;
}

export interface ConversationTurn {
  role: "user" | "model";
  parts: Array<Record<string, unknown>>;
}

export interface SimulationResponse {
  steps: SimulatedStep[];
  finalSpeech: string | null;
  pendingStepId: string | null;
  conversationState: ConversationTurn[];
  modelUsed: string;
}
