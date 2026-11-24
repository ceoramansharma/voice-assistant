import type { ProjectConfig, PythonFileArtifact } from "../types/assistant";

function buildConfigPy(cfg: ProjectConfig): string {
  const computeDefault =
    cfg.whisperDevice === "cuda" ? "float16" : "int8";

  return `"""
config.py — Runtime configuration and OS capability detection for VoxControl.

Loads settings from environment variables (.env supported via python-dotenv)
with safe defaults tailored for local desktop execution across Windows, macOS,
and Linux.
"""

from __future__ import annotations

import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

load_dotenv()

OperatingSystem = Literal["windows", "macos", "linux"]
ConfirmationMode = Literal["voice_or_keyboard", "keyboard_only", "voice_only"]
VoiceLanguageMode = Literal["bilingual_hi_en", "english_only", "hindi_only"]
LlmProvider = Literal["ollama", "gemini"]


def detect_os() -> OperatingSystem:
    """Return normalized operating system identifier."""
    if sys.platform.startswith("win"):
        return "windows"
    if sys.platform == "darwin":
        return "macos"
    return "linux"


def primary_modifier_key() -> str:
    """Return the OS primary shortcut modifier ('command' on macOS, 'ctrl' elsewhere)."""
    return "command" if detect_os() == "macos" else "ctrl"


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class AppConfig:
    """Immutable application configuration loaded on startup."""

    # AI Brain Provider (Local Ollama or Cloud Gemini)
    llm_provider: LlmProvider = "${cfg.llmProvider}"
    ollama_model: str = "${cfg.ollamaModel}"
    ollama_host: str = "${cfg.ollamaHost}"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    max_history_turns: int = 16
    max_tool_rounds: int = 10

    # Push-to-Talk & Audio Input
    ptt_hotkey: str = "${cfg.pttHotkey}"
    sample_rate: int = 16000
    channels: int = 1
    min_audio_seconds: float = 0.35
    max_audio_seconds: float = 30.0
    audio_feedback_tones: bool = True

    # Local faster-whisper STT (supports English + Hindi / Hinglish)
    voice_language_mode: VoiceLanguageMode = "${cfg.voiceLanguage}"
    whisper_model_size: str = "${cfg.whisperModel}"
    whisper_device: str = "${cfg.whisperDevice}"
    whisper_compute_type: str = "${computeDefault}"
    whisper_beam_size: int = 5

    # Offline pyttsx3 TTS
    tts_enabled: bool = True
    tts_rate: int = ${cfg.ttsRate}
    tts_volume: float = 0.9

    # Execution & Browser Automation
    enable_playwright: bool = ${cfg.enablePlaywright ? "True" : "False"}
    playwright_headless: bool = False
    typing_interval_sec: float = 0.012
    shell_timeout_sec: int = 20
    workspace_root: Path = Path.home()

    # Safety & Confirmation
    confirmation_mode: ConfirmationMode = "${cfg.confirmationMode}"
    confirmation_timeout_sec: float = 12.0
    audit_log_path: Path = Path.home() / ".voxcontrol" / "audit.log"

    # Logging
    log_level: str = "INFO"

    @classmethod
    def from_env(cls) -> "AppConfig":
        """Construct AppConfig from environment variables with typed defaults."""
        provider = os.getenv("VOX_LLM_PROVIDER", "${cfg.llmProvider}").strip().lower()
        if provider not in {"ollama", "gemini"}:
            provider = "${cfg.llmProvider}"

        conf_mode = os.getenv("VOX_CONFIRMATION_MODE", "${cfg.confirmationMode}").strip().lower()
        if conf_mode not in {"voice_or_keyboard", "keyboard_only", "voice_only"}:
            conf_mode = "${cfg.confirmationMode}"

        lang_mode = os.getenv("VOX_LANGUAGE_MODE", "${cfg.voiceLanguage}").strip().lower()
        if lang_mode not in {"bilingual_hi_en", "english_only", "hindi_only"}:
            lang_mode = "${cfg.voiceLanguage}"

        whisper_model = os.getenv("VOX_WHISPER_MODEL", "${cfg.whisperModel}").strip()
        # English-only (.en) Whisper models cannot recognize Hindi; auto-strip .en if Hindi is enabled
        if lang_mode in {"bilingual_hi_en", "hindi_only"} and whisper_model.endswith(".en"):
            whisper_model = whisper_model[:-3]

        return cls(
            llm_provider=provider,  # type: ignore[arg-type]
            ollama_model=os.getenv("OLLAMA_MODEL", "${cfg.ollamaModel}").strip(),
            ollama_host=os.getenv("OLLAMA_HOST", "${cfg.ollamaHost}").strip().rstrip("/"),
            gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip(),
            ptt_hotkey=os.getenv("VOX_PTT_HOTKEY", "${cfg.pttHotkey}").strip().lower(),
            voice_language_mode=lang_mode,  # type: ignore[arg-type]
            whisper_model_size=whisper_model,
            whisper_device=os.getenv("VOX_WHISPER_DEVICE", "${cfg.whisperDevice}").strip().lower(),
            whisper_compute_type=os.getenv("VOX_WHISPER_COMPUTE_TYPE", "${computeDefault}").strip().lower(),
            tts_enabled=_env_bool("VOX_TTS_ENABLED", True),
            tts_rate=int(os.getenv("VOX_TTS_RATE", "${cfg.ttsRate}")),
            enable_playwright=_env_bool("VOX_ENABLE_PLAYWRIGHT", ${cfg.enablePlaywright ? "True" : "False"}),
            playwright_headless=_env_bool("VOX_PLAYWRIGHT_HEADLESS", False),
            confirmation_mode=conf_mode,  # type: ignore[arg-type]
            confirmation_timeout_sec=float(os.getenv("VOX_CONFIRM_TIMEOUT", "12.0")),
            shell_timeout_sec=int(os.getenv("VOX_SHELL_TIMEOUT", "20")),
            workspace_root=Path(os.getenv("VOX_WORKSPACE_ROOT", str(Path.home()))).expanduser().resolve(),
            log_level=os.getenv("VOX_LOG_LEVEL", "INFO").upper(),
        )

    @property
    def active_model_label(self) -> str:
        """Return human-readable active provider and model string."""
        if self.llm_provider == "ollama":
            return f"ollama/{self.ollama_model} ({self.ollama_host})"
        return f"gemini/{self.gemini_model}"

    def validate(self) -> None:
        """Raise ValueError if mandatory credentials or bounds are invalid."""
        if self.llm_provider == "gemini" and not self.gemini_api_key:
            raise ValueError(
                "GEMINI_API_KEY is missing. Export GEMINI_API_KEY in .env, "
                "or switch VOX_LLM_PROVIDER=ollama to run 100% locally with no API key."
            )
        if self.llm_provider == "ollama" and not self.ollama_model:
            raise ValueError("OLLAMA_MODEL cannot be empty when VOX_LLM_PROVIDER=ollama.")
        if self.sample_rate != 16000:
            raise ValueError("faster-whisper pipeline requires 16000 Hz mono audio.")
        if self.confirmation_timeout_sec < 3.0:
            raise ValueError("confirmation_timeout_sec must be at least 3.0 seconds.")


def configure_logging(level: str = "INFO") -> None:
    """Configure structured console logging."""
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )
`;
}

function buildSafetyPy(): string {
  return `"""
safety.py — Mandatory safety guardrails, risk classification, path validation,
and explicit user confirmation gate for High-Risk desktop operations.

Security invariants:
1. pyautogui.FAILSAFE = True is enforced on startup and before every GUI action.
2. Every tool is classified into SAFE vs. HIGH_RISK (with dynamic escalation).
3. Critical OS directories and credential stores are protected from mutation.
4. High-Risk actions require explicit spoken ("yes") or keyboard (Enter) approval
   and default strictly to DENY on timeout or ambiguous input.
"""

from __future__ import annotations

import json
import logging
import queue
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable

import pyautogui
from pynput import keyboard

from config import AppConfig, detect_os

logger = logging.getLogger("voxcontrol.safety")


class RiskLevel(str, Enum):
    """Execution risk classification for desktop automation tools."""

    SAFE = "safe"
    HIGH_RISK = "high_risk"


class ProtectedPathError(PermissionError):
    """Raised when a tool attempts to modify or delete a protected OS path."""


@dataclass(frozen=True)
class ToolPolicy:
    """Static safety policy metadata for a registered tool."""

    name: str
    risk_level: RiskLevel
    category: str
    reason: str


TOOL_POLICIES: dict[str, ToolPolicy] = {
    # SAFE — Non-destructive desktop automation & read-only queries
    "type_text": ToolPolicy("type_text", RiskLevel.SAFE, "input", "Types dictated text into focused window"),
    "press_hotkey": ToolPolicy("press_hotkey", RiskLevel.SAFE, "keyboard", "Dispatches OS shortcut chord"),
    "press_key": ToolPolicy("press_key", RiskLevel.SAFE, "keyboard", "Dispatches bounded single key press"),
    "launch_application": ToolPolicy("launch_application", RiskLevel.SAFE, "apps", "Opens local application"),
    "switch_window": ToolPolicy("switch_window", RiskLevel.SAFE, "window", "Focuses existing window"),
    "manage_window": ToolPolicy("manage_window", RiskLevel.SAFE, "window", "Arranges active window via OS shortcut"),
    "clipboard_action": ToolPolicy("clipboard_action", RiskLevel.SAFE, "input", "Reads or updates system clipboard"),
    "list_directory": ToolPolicy("list_directory", RiskLevel.SAFE, "filesystem", "Read-only directory listing"),
    "read_file": ToolPolicy("read_file", RiskLevel.SAFE, "filesystem", "Read-only file inspection"),
    "create_or_write_file": ToolPolicy(
        "create_or_write_file",
        RiskLevel.SAFE,
        "filesystem",
        "Creates new file (escalates to HIGH_RISK when overwriting an existing file)",
    ),
    "browser_open_url": ToolPolicy("browser_open_url", RiskLevel.SAFE, "browser", "Navigates browser to URL"),
    "browser_search": ToolPolicy("browser_search", RiskLevel.SAFE, "browser", "Runs web search query"),
    "browser_page_action": ToolPolicy("browser_page_action", RiskLevel.SAFE, "browser", "Semantic page interaction"),
    "get_system_info": ToolPolicy("get_system_info", RiskLevel.SAFE, "system", "Read-only system status"),
    # HIGH-RISK — Destructive, privileged, or externally visible actions
    "move_or_rename_path": ToolPolicy(
        "move_or_rename_path", RiskLevel.HIGH_RISK, "filesystem", "Moves or renames files on disk"
    ),
    "delete_path": ToolPolicy(
        "delete_path", RiskLevel.HIGH_RISK, "filesystem", "Deletes files or folders"
    ),
    "run_shell_command": ToolPolicy(
        "run_shell_command", RiskLevel.HIGH_RISK, "terminal", "Executes arbitrary OS shell command"
    ),
    "system_power_action": ToolPolicy(
        "system_power_action", RiskLevel.HIGH_RISK, "system", "Locks, sleeps, restarts, or shuts down computer"
    ),
    "send_message_or_email": ToolPolicy(
        "send_message_or_email", RiskLevel.HIGH_RISK, "comms", "Sends external email or chat message"
    ),
}

AFFIRMATIVE_TOKENS = {
    # English
    "yes", "yeah", "yep", "confirm", "confirmed", "proceed", "approve", "do it", "go ahead",
    # Hindi & Hinglish
    "haan", "han", "ha", "ji", "ji haan", "theek hai", "thik hai", "kar do", "kardo", "bilkul",
    "हाँ", "हां", "जी", "जी हाँ", "ठीक है", "कर दो", "बिल्कुल",
}
NEGATIVE_TOKENS = {
    # English
    "no", "nope", "cancel", "stop", "abort", "deny", "never mind", "dont", "don't",
    # Hindi & Hinglish
    "nahi", "nahin", "na", "mat karo", "ruko", "band karo", "rehne do",
    "नहीं", "नहि", "ना", "मत करो", "रुको", "रद्द", "बंद करो",
}


def enforce_failsafe() -> None:
    """
    Guarantee PyAutoGUI failsafe remains enabled at all times.
    Moving the mouse cursor to any primary screen corner immediately aborts
    execution by raising pyautogui.FailSafeException.
    """
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.08


def _protected_roots() -> list[Path]:
    """Return critical OS and credential paths that cannot be modified or deleted."""
    home = Path.home().resolve()
    common = [
        home / ".ssh",
        home / ".gnupg",
        home / ".aws",
    ]
    current_os = detect_os()
    if current_os == "windows":
        return [
            Path("C:/").resolve(),
            Path("C:/Windows").resolve(),
            Path("C:/Program Files").resolve(),
            Path("C:/Program Files (x86)").resolve(),
            Path("C:/Users").resolve(),
            *common,
        ]
    if current_os == "macos":
        return [
            Path("/").resolve(),
            Path("/System").resolve(),
            Path("/Library").resolve(),
            Path("/Applications").resolve(),
            Path("/usr").resolve(),
            Path("/bin").resolve(),
            Path("/sbin").resolve(),
            Path("/etc").resolve(),
            *common,
        ]
    return [
        Path("/").resolve(),
        Path("/etc").resolve(),
        Path("/usr").resolve(),
        Path("/bin").resolve(),
        Path("/sbin").resolve(),
        Path("/boot").resolve(),
        Path("/lib").resolve(),
        Path("/var").resolve(),
        *common,
    ]


def validate_path(path_str: str, *, allow_home_root: bool = False) -> Path:
    """
    Expand and resolve a user-supplied path while blocking mutations to
    critical system roots and private credential directories.
    """
    resolved = Path(path_str).expanduser().resolve()
    home = Path.home().resolve()

    if not allow_home_root and resolved == home:
        raise ProtectedPathError(f"Refusing destructive operation on home directory root: {resolved}")

    for protected in _protected_roots():
        if resolved == protected:
            raise ProtectedPathError(f"Operation blocked on protected system path: {resolved}")
        # Block anything inside credential stores or Windows/macOS system dirs
        if protected != Path("/").resolve() and protected != Path("C:/").resolve():
            try:
                resolved.relative_to(protected)
                raise ProtectedPathError(f"Operation blocked inside protected directory: {protected}")
            except ValueError:
                continue

    return resolved


class SafetyGuard:
    """Evaluates tool risk, prompts for explicit approval, and writes an audit trail."""

    def __init__(self, config: AppConfig) -> None:
        self.config = config
        enforce_failsafe()
        self.config.audit_log_path.parent.mkdir(parents=True, exist_ok=True)

    def classify(self, tool_name: str, args: dict[str, Any]) -> tuple[RiskLevel, str]:
        """Classify a proposed tool invocation as SAFE or HIGH_RISK."""
        policy = TOOL_POLICIES.get(tool_name)
        if policy is None:
            return RiskLevel.HIGH_RISK, "Unregistered tool defaults to HIGH_RISK"

        # Dynamic escalation: overwriting an existing file requires confirmation
        if tool_name == "create_or_write_file" and bool(args.get("overwrite", False)):
            target_raw = str(args.get("path", ""))
            if target_raw and Path(target_raw).expanduser().exists():
                return (
                    RiskLevel.HIGH_RISK,
                    f"Target file already exists and overwrite=True ({target_raw})",
                )

        # Dynamic escalation: blocking dangerous hotkey chords
        if tool_name == "press_hotkey":
            keys = {str(k).lower() for k in args.get("keys", [])}
            if {"ctrl", "alt", "delete"}.issubset(keys) or {"alt", "f4"}.issubset(keys):
                return RiskLevel.HIGH_RISK, f"Sensitive system hotkey chord: {sorted(keys)}"

        return policy.risk_level, policy.reason

    def format_action_summary(self, tool_name: str, args: dict[str, Any]) -> str:
        """Create a clear, human-readable description for voice + terminal review."""
        if tool_name == "delete_path":
            mode = "recursively delete folder" if args.get("recursive") else "delete"
            return f"{mode} '{args.get('path')}'"
        if tool_name == "move_or_rename_path":
            return f"move '{args.get('source')}' to '{args.get('destination')}'"
        if tool_name == "run_shell_command":
            return f"run shell command: {args.get('command')}"
        if tool_name == "system_power_action":
            return f"execute system power action: {args.get('action')}"
        if tool_name == "send_message_or_email":
            return f"send {args.get('channel', 'email')} to {args.get('recipient')} with subject '{args.get('subject')}'"
        return f"execute {tool_name} with arguments {json.dumps(args, ensure_ascii=False)}"

    def record_audit(
        self,
        tool_name: str,
        args: dict[str, Any],
        risk: RiskLevel,
        approved: bool,
        outcome: str,
    ) -> None:
        """Append a structured JSONL audit entry to ~/.voxcontrol/audit.log."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tool": tool_name,
            "args": args,
            "risk": risk.value,
            "approved": approved,
            "outcome": outcome,
        }
        try:
            with self.config.audit_log_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry, ensure_ascii=False) + "\\n")
        except OSError as exc:
            logger.warning("Failed to append audit log: %s", exc)

    def request_confirmation(
        self,
        tool_name: str,
        args: dict[str, Any],
        speak_fn: Callable[[str, bool], None],
        listen_confirmation_fn: Callable[[float], str] | None = None,
    ) -> bool:
        """
        Require explicit user confirmation before executing a HIGH_RISK action.

        Supports keyboard confirmation (Enter = approve, Esc = deny) and/or
        spoken confirmation ('yes' = approve, 'no'/'cancel' = deny).
        Strictly returns False on timeout or unclear response.
        """
        summary = self.format_action_summary(tool_name, args)
        mode = self.config.confirmation_mode
        timeout = self.config.confirmation_timeout_sec

        print("\\n" + "=" * 72)
        print("HIGH-RISK ACTION REQUIRES CONFIRMATION")
        print(f"Tool   : {tool_name}")
        print(f"Action : {summary}")
        if mode == "keyboard_only":
            print(f"Prompt : Press [ENTER] to approve or [ESC] to cancel ({timeout:.0f}s timeout)")
        elif mode == "voice_only":
            print(f"Prompt : Say 'YES' to approve or 'NO' to cancel ({timeout:.0f}s timeout)")
        else:
            print(f"Prompt : Say 'YES' / press [ENTER] to approve, or say 'NO' / press [ESC] ({timeout:.0f}s)")
        print("=" * 72)

        spoken_prompt = f"High risk action: {summary}. "
        if mode == "keyboard_only":
            spoken_prompt += "Press Enter to confirm, or Escape to cancel."
        elif mode == "voice_only":
            spoken_prompt += "Say yes to confirm, or no to cancel."
        else:
            spoken_prompt += "Say yes or press Enter to confirm."
        speak_fn(spoken_prompt, True)

        decision_queue: queue.Queue[bool] = queue.Queue(maxsize=1)
        stop_event = threading.Event()

        def _publish(approved: bool, source: str) -> None:
            if not stop_event.is_set():
                stop_event.set()
                logger.info("Confirmation resolved via %s: %s", source, "APPROVED" if approved else "DENIED")
                try:
                    decision_queue.put_nowait(approved)
                except queue.Full:
                    pass

        kb_listener: keyboard.Listener | None = None
        if mode in {"keyboard_only", "voice_or_keyboard"}:
            def on_press(key: keyboard.Key | keyboard.KeyCode | None) -> bool | None:
                if stop_event.is_set():
                    return False
                if key == keyboard.Key.enter:
                    _publish(True, "keyboard[Enter]")
                    return False
                if key == keyboard.Key.esc:
                    _publish(False, "keyboard[Esc]")
                    return False
                return None

            kb_listener = keyboard.Listener(on_press=on_press)
            kb_listener.start()

        if mode in {"voice_only", "voice_or_keyboard"} and listen_confirmation_fn is not None:
            def _voice_worker() -> None:
                try:
                    transcript = listen_confirmation_fn(min(4.5, timeout))
                    normalized = transcript.strip().lower().rstrip(".!?")
                    if not normalized:
                        return
                    logger.info("Confirmation voice heard: %r", normalized)
                    if any(tok in normalized.split() or tok == normalized for tok in NEGATIVE_TOKENS):
                        _publish(False, f"voice[{normalized}]")
                    elif any(tok in normalized.split() or tok == normalized for tok in AFFIRMATIVE_TOKENS):
                        _publish(True, f"voice[{normalized}]")
                except Exception as exc:  # pragma: no cover - defensive audio guard
                    logger.warning("Voice confirmation listener error: %s", exc)

            voice_thread = threading.Thread(target=_voice_worker, daemon=True)
            voice_thread.start()

        approved = False
        try:
            approved = decision_queue.get(timeout=timeout)
        except queue.Empty:
            logger.warning("Confirmation timed out after %.1fs — defaulting to DENY.", timeout)
            approved = False
        finally:
            stop_event.set()
            if kb_listener is not None:
                kb_listener.stop()
                time.sleep(0.05)

        if not approved:
            speak_fn("Action cancelled.", False)
        return approved
`;
}

function buildAudioIoPy(): string {
  return `"""
audio_io.py — Local Speech-to-Text (faster-whisper), Push-to-Talk microphone
capture (sounddevice + pynput), and offline Text-to-Speech (pyttsx3).

All audio processing runs 100% locally on your machine with zero cloud STT/TTS
latency and strict Push-to-Talk gating so background noise never triggers commands.
"""

from __future__ import annotations

import logging
import queue
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable

import numpy as np
import pyttsx3
import sounddevice as sd
from faster_whisper import WhisperModel
from pynput import keyboard

from config import AppConfig

logger = logging.getLogger("voxcontrol.audio")


HOTKEY_MAP: dict[str, keyboard.Key] = {
    "ctrl_r": keyboard.Key.ctrl_r,
    "ctrl_l": keyboard.Key.ctrl_l,
    "alt_r": keyboard.Key.alt_r,
    "alt_l": keyboard.Key.alt_l,
    "f8": keyboard.Key.f8,
    "f9": keyboard.Key.f9,
    "f10": keyboard.Key.f10,
    "f12": keyboard.Key.f12,
    "caps_lock": keyboard.Key.caps_lock,
    "pause": keyboard.Key.pause,
}


@dataclass(frozen=True)
class TranscriptionResult:
    """Result returned from local faster-whisper inference."""

    text: str
    language: str
    duration_sec: float
    inference_ms: int


class WhisperTranscriber:
    """Local faster-whisper engine with automatic CUDA/CPU compute fallback."""

    def __init__(self, config: AppConfig) -> None:
        self.config = config
        device = config.whisper_device
        compute_type = config.whisper_compute_type

        if device == "auto":
            device, compute_type = self._detect_best_device()

        logger.info(
            "Loading faster-whisper model '%s' on device=%s (compute_type=%s)...",
            config.whisper_model_size,
            device,
            compute_type,
        )
        try:
            self.model = WhisperModel(
                config.whisper_model_size,
                device=device,
                compute_type=compute_type,
            )
        except Exception as exc:
            logger.warning("Primary device '%s' failed (%s); falling back to CPU int8.", device, exc)
            self.model = WhisperModel(
                config.whisper_model_size,
                device="cpu",
                compute_type="int8",
            )

    @staticmethod
    def _detect_best_device() -> tuple[str, str]:
        """Use CUDA float16 when CTranslate2 sees an NVIDIA GPU, otherwise CPU int8."""
        try:
            import ctranslate2

            if ctranslate2.get_cuda_device_count() > 0:
                return "cuda", "float16"
        except Exception:
            pass
        return "cpu", "int8"

    def transcribe(self, audio_pcm: np.ndarray) -> TranscriptionResult:
        """Transcribe a 16kHz mono float32 NumPy array in memory (English + Hindi / Hinglish)."""
        start = time.perf_counter()
        audio_1d = np.asarray(audio_pcm, dtype=np.float32).flatten()
        duration = len(audio_1d) / float(self.config.sample_rate)

        # Configure language detection for bilingual Hindi+English, English-only, or Hindi-only
        lang_mode = self.config.voice_language_mode
        if lang_mode == "english_only":
            whisper_lang: str | None = "en"
            initial_prompt: str | None = None
        elif lang_mode == "hindi_only":
            whisper_lang = "hi"
            initial_prompt = "नमस्ते, कंप्यूटर कमांड जैसे VS Code, Chrome, Notepad, file, folder."
        else:
            # Auto-detect Hindi or English per utterance; prompt primes Whisper for Hinglish tech terms
            whisper_lang = None
            initial_prompt = (
                "Bilingual Hindi and English desktop voice commands. "
                "Open VS Code, Chrome, Notepad, Terminal, file, folder. "
                "नमस्ते, क्रोम खोलो, नई फाइल बनाओ, टाइप करो, डिलीट करो।"
            )

        segments, info = self.model.transcribe(
            audio_1d,
            language=whisper_lang,
            initial_prompt=initial_prompt,
            beam_size=self.config.whisper_beam_size,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 350},
            condition_on_previous_text=False,
        )
        text = " ".join(seg.text.strip() for seg in segments if seg.text.strip()).strip()
        elapsed_ms = int((time.perf_counter() - start) * 1000)

        return TranscriptionResult(
            text=text,
            language=getattr(info, "language", whisper_lang or "en"),
            duration_sec=duration,
            inference_ms=elapsed_ms,
        )


class VoiceSpeaker:
    """
    Thread-safe offline TTS speaker backed by pyttsx3.

    pyttsx3 relies on OS-specific speech event loops (SAPI5 on Windows,
    NSSpeechSynthesizer on macOS, espeak/espeak-ng on Linux) that must be driven
    from a single dedicated worker thread to avoid deadlocks or COM errors.
    """

    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self._queue: queue.Queue[tuple[str | None, threading.Event | None]] = queue.Queue()
        self._thread = threading.Thread(target=self._worker_loop, name="tts-worker", daemon=True)
        self._ready = threading.Event()
        self._thread.start()
        self._ready.wait(timeout=4.0)

    def _select_preferred_voice(self, engine: Any) -> None:
        """Prefer an Indian English or Hindi SAPI5 voice when installed in bilingual/Hindi mode."""
        if self.config.voice_language_mode == "english_only":
            return
        try:
            voices = engine.getProperty("voices") or []
            preferred_tokens = (
                ("hemant", "kalpana", "hindi", "hi-in", "hi_in")
                if self.config.voice_language_mode == "hindi_only"
                else ("heera", "ravi", "hemant", "kalpana", "en-in", "hi-in")
            )
            for token in preferred_tokens:
                for voice in voices:
                    descriptor = f"{getattr(voice, 'id', '')} {getattr(voice, 'name', '')}".lower()
                    if token in descriptor:
                        engine.setProperty("voice", voice.id)
                        logger.info("Selected TTS voice: %s", getattr(voice, "name", voice.id))
                        return
        except Exception as exc:
            logger.debug("Using default system TTS voice (%s).", exc)

    def _worker_loop(self) -> None:
        engine = None
        if self.config.tts_enabled:
            try:
                engine = pyttsx3.init()
                engine.setProperty("rate", self.config.tts_rate)
                engine.setProperty("volume", self.config.tts_volume)
                self._select_preferred_voice(engine)
            except Exception as exc:
                logger.warning("pyttsx3 initialization failed (%s); running in silent console mode.", exc)
                engine = None
        self._ready.set()

        while True:
            text, done_evt = self._queue.get()
            if text is None:
                if done_evt:
                    done_evt.set()
                break
            try:
                if engine is not None and text.strip():
                    engine.say(text)
                    engine.runAndWait()
            except Exception as exc:
                logger.warning("TTS playback error: %s", exc)
            finally:
                if done_evt:
                    done_evt.set()

    def speak(self, text: str, block: bool = False) -> None:
        """Enqueue a brief spoken confirmation; optionally block until finished."""
        cleaned = text.strip()
        if not cleaned:
            return
        logger.info("Assistant says: %s", cleaned)
        if not self.config.tts_enabled:
            return
        done = threading.Event() if block else None
        self._queue.put((cleaned, done))
        if done is not None:
            done.wait(timeout=15.0)

    def shutdown(self) -> None:
        """Cleanly terminate the TTS background thread."""
        done = threading.Event()
        self._queue.put((None, done))
        done.wait(timeout=3.0)


def _play_tone(freq_hz: float, duration_sec: float = 0.07, volume: float = 0.14) -> None:
    """Emit a brief cross-platform sine wave cue via sounddevice."""
    try:
        sr = 16000
        t = np.linspace(0, duration_sec, int(sr * duration_sec), endpoint=False)
        envelope = np.hanning(len(t))
        wave = (np.sin(2.0 * np.pi * freq_hz * t) * envelope * volume).astype(np.float32)
        sd.play(wave, samplerate=sr, blocking=False)
    except Exception:
        pass


class PushToTalkRecorder:
    """
    Captures microphone audio strictly while the configured Push-to-Talk hotkey
    is held down, pushing finished float32 buffers to a callback or queue.
    """

    def __init__(
        self,
        config: AppConfig,
        on_clip_ready: Callable[[np.ndarray], None],
    ) -> None:
        self.config = config
        self.on_clip_ready = on_clip_ready
        self.target_key = HOTKEY_MAP.get(config.ptt_hotkey, keyboard.Key.ctrl_r)

        self._lock = threading.Lock()
        self._is_recording = False
        self._paused = False
        self._frames: list[np.ndarray] = []
        self._record_started_at = 0.0
        self._stream: sd.InputStream | None = None
        self._listener: keyboard.Listener | None = None

    def start(self) -> None:
        """Open the microphone input stream and start global PTT key monitoring."""
        self._stream = sd.InputStream(
            samplerate=self.config.sample_rate,
            channels=self.config.channels,
            dtype="float32",
            callback=self._audio_callback,
        )
        self._stream.start()

        self._listener = keyboard.Listener(
            on_press=self._on_key_press,
            on_release=self._on_key_release,
        )
        self._listener.start()
        logger.info("Push-to-Talk active. Hold [%s] while speaking.", self.config.ptt_hotkey.upper())

    def stop(self) -> None:
        """Close the keyboard listener and microphone stream."""
        if self._listener is not None:
            self._listener.stop()
            self._listener = None
        if self._stream is not None:
            self._stream.stop()
            self._stream.close()
            self._stream = None

    def set_paused(self, paused: bool) -> None:
        """Temporarily suspend PTT capture (e.g., during High-Risk voice confirmation)."""
        with self._lock:
            self._paused = paused
            if paused:
                self._is_recording = False
                self._frames.clear()

    def _audio_callback(self, indata: np.ndarray, frames: int, time_info: object, status: sd.CallbackFlags) -> None:
        if status:
            logger.debug("Audio stream status: %s", status)
        with self._lock:
            if not self._is_recording:
                return
            elapsed = time.monotonic() - self._record_started_at
            if elapsed >= self.config.max_audio_seconds:
                return
            self._frames.append(indata.copy())

    def _on_key_press(self, key: keyboard.Key | keyboard.KeyCode | None) -> None:
        if key != self.target_key:
            return
        with self._lock:
            # Debounce OS key-repeat events while key is already held
            if self._paused or self._is_recording:
                return
            self._is_recording = True
            self._frames = []
            self._record_started_at = time.monotonic()

        logger.info("Listening... (release %s when done)", self.config.ptt_hotkey.upper())
        if self.config.audio_feedback_tones:
            _play_tone(880.0)

    def _on_key_release(self, key: keyboard.Key | keyboard.KeyCode | None) -> None:
        if key != self.target_key:
            return
        with self._lock:
            if not self._is_recording:
                return
            self._is_recording = False
            captured = list(self._frames)
            self._frames.clear()
            duration = time.monotonic() - self._record_started_at

        if self.config.audio_feedback_tones:
            _play_tone(620.0)

        if not captured or duration < self.config.min_audio_seconds:
            logger.debug("Ignoring short PTT tap (%.2fs).", duration)
            return

        audio_clip = np.concatenate(captured, axis=0).flatten()
        self.on_clip_ready(audio_clip)

    def record_confirmation_clip(self, duration_sec: float = 4.0) -> np.ndarray:
        """Record a short one-shot clip for spoken High-Risk confirmation."""
        self.set_paused(True)
        try:
            sample_count = int(self.config.sample_rate * duration_sec)
            recording = sd.rec(
                sample_count,
                samplerate=self.config.sample_rate,
                channels=self.config.channels,
                dtype="float32",
            )
            sd.wait()
            return recording.flatten()
        finally:
            self.set_paused(False)
`;
}

function buildToolsPy(cfg: ProjectConfig): string {
  return `"""
tools.py — OS-aware Desktop Execution Layer and Gemini Function Declarations.

Provides 19 cleanly typed, self-documenting Python tools covering dictation,
keyboard shortcuts, window management, application launching, file operations,
toggleable Playwright browser automation, terminal commands, and system info.

All GUI automation enforces pyautogui.FAILSAFE = True and prefers OS-native
hotkeys/launchers over brittle hardcoded (x, y) coordinates.
"""

from __future__ import annotations

import logging
import os
import platform
import shutil
import subprocess
import time
import urllib.parse
import webbrowser
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import pyautogui
import pyperclip

from config import AppConfig, detect_os, primary_modifier_key
from safety import ProtectedPathError, enforce_failsafe, validate_path

logger = logging.getLogger("voxcontrol.tools")

try:
    from send2trash import send2trash as _send2trash
except ImportError:  # pragma: no cover
    _send2trash = None

try:
    import psutil as _psutil
except ImportError:  # pragma: no cover
    _psutil = None


# Friendly cross-platform application alias registry
APP_ALIASES: dict[str, dict[str, str]] = {
    "vscode": {"windows": "code", "macos": "Visual Studio Code", "linux": "code"},
    "vs code": {"windows": "code", "macos": "Visual Studio Code", "linux": "code"},
    "visual studio code": {"windows": "code", "macos": "Visual Studio Code", "linux": "code"},
    "chrome": {"windows": "chrome", "macos": "Google Chrome", "linux": "google-chrome"},
    "google chrome": {"windows": "chrome", "macos": "Google Chrome", "linux": "google-chrome"},
    "firefox": {"windows": "firefox", "macos": "Firefox", "linux": "firefox"},
    "terminal": {"windows": "wt", "macos": "Terminal", "linux": "x-terminal-emulator"},
    "notepad": {"windows": "notepad", "macos": "TextEdit", "linux": "gedit"},
    "notes": {"windows": "notepad", "macos": "Notes", "linux": "gedit"},
    "calculator": {"windows": "calc", "macos": "Calculator", "linux": "gnome-calculator"},
    "files": {"windows": "explorer", "macos": "Finder", "linux": "xdg-open"},
    "finder": {"windows": "explorer", "macos": "Finder", "linux": "xdg-open"},
    "slack": {"windows": "slack", "macos": "Slack", "linux": "slack"},
    "spotify": {"windows": "spotify", "macos": "Spotify", "linux": "spotify"},
}

KEY_ALIASES: dict[str, str] = {
    "cmd": "command",
    "meta": "command",
    "control": "ctrl",
    "return": "enter",
    "esc": "escape",
    "del": "delete",
    "option": "alt",
}


class _PlaywrightManager:
    """Lazy-initialized persistent Playwright Chromium session (optional/toggleable)."""

    def __init__(self, enabled: bool, headless: bool = False) -> None:
        self.enabled = enabled
        self.headless = headless
        self._playwright: Any = None
        self._browser: Any = None
        self._page: Any = None

    def ensure_page(self) -> Any:
        if not self.enabled:
            return None
        if self._page is not None and not self._page.is_closed():
            return self._page
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as exc:
            raise RuntimeError(
                "Playwright is enabled in config but not installed. "
                "Run 'pip install playwright && playwright install chromium' or set VOX_ENABLE_PLAYWRIGHT=false."
            ) from exc

        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(headless=self.headless)
        context = self._browser.new_context(viewport={"width": 1366, "height": 860})
        self._page = context.new_page()
        return self._page

    def close(self) -> None:
        try:
            if self._browser is not None:
                self._browser.close()
            if self._playwright is not None:
                self._playwright.stop()
        except Exception as exc:
            logger.debug("Playwright shutdown warning: %s", exc)
        finally:
            self._page = None
            self._browser = None
            self._playwright = None


class DesktopToolbox:
    """Stateful container holding OS-aware tools and optional Playwright browser session."""

    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self.os_name = detect_os()
        self.mod_key = primary_modifier_key()
        self.browser = _PlaywrightManager(
            enabled=config.enable_playwright,
            headless=config.playwright_headless,
        )
        enforce_failsafe()

    def close(self) -> None:
        """Release browser resources cleanly on shutdown."""
        self.browser.close()

    # ------------------------------------------------------------------
    # 1. Input, Dictation & Clipboard
    # ------------------------------------------------------------------

    def type_text(
        self,
        text: str,
        press_enter: bool = False,
        use_clipboard_paste: bool = False,
    ) -> dict[str, Any]:
        """Type dictated prose or source code into the currently focused application.

        Automatically falls back to clipboard paste when text contains newlines
        or non-ASCII characters so code indentation and Unicode stay intact.

        Args:
            text: Exact string or multi-line code snippet to type.
            press_enter: If True, press Enter after inserting the text.
            use_clipboard_paste: Force clipboard paste mode instead of character keystrokes.
        """
        enforce_failsafe()
        should_paste = use_clipboard_paste or ("\\n" in text) or (not text.isascii())

        if should_paste:
            previous_clipboard = ""
            try:
                previous_clipboard = pyperclip.paste()
            except Exception:
                pass
            pyperclip.copy(text)
            time.sleep(0.05)
            pyautogui.hotkey(self.mod_key, "v")
            time.sleep(0.08)
            try:
                pyperclip.copy(previous_clipboard)
            except Exception:
                pass
            mode = "clipboard_paste"
        else:
            pyautogui.write(text, interval=self.config.typing_interval_sec)
            mode = "keystroke_stream"

        if press_enter:
            pyautogui.press("enter")

        return {"status": "ok", "mode": mode, "characters": len(text), "pressed_enter": press_enter}

    def press_hotkey(self, keys: list[str]) -> dict[str, Any]:
        """Press a simultaneous keyboard shortcut chord such as ['mod', 'n'] or ['mod', 'shift', 'p'].

        Always pass 'mod' for the OS primary modifier (resolved to Command on macOS
        and Ctrl on Windows/Linux).

        Args:
            keys: Ordered list of key names to hold together.
        """
        enforce_failsafe()
        if not keys:
            return {"status": "error", "message": "No keys provided."}

        normalized: list[str] = []
        for raw in keys:
            k = raw.strip().lower()
            if k in {"mod", "primary"}:
                normalized.append(self.mod_key)
            else:
                normalized.append(KEY_ALIASES.get(k, k))

        pyautogui.hotkey(*normalized)
        return {"status": "ok", "os": self.os_name, "dispatched_keys": normalized}

    def press_key(self, key: str, presses: int = 1) -> dict[str, Any]:
        """Press a single editing, navigation, or media key up to 25 times.

        Args:
            key: Key name (e.g., 'enter', 'tab', 'escape', 'backspace', 'volumeup').
            presses: Number of times to press the key (clamped between 1 and 25).
        """
        enforce_failsafe()
        count = max(1, min(int(presses), 25))
        normalized = KEY_ALIASES.get(key.strip().lower(), key.strip().lower())
        pyautogui.press(normalized, presses=count, interval=0.05)
        return {"status": "ok", "key": normalized, "presses": count}

    def clipboard_action(self, action: str, text: str | None = None) -> dict[str, Any]:
        """Interact with the system clipboard.

        Args:
            action: One of 'copy', 'cut', 'paste', 'read', or 'write'.
            text: Text content to store on clipboard when action is 'write'.
        """
        enforce_failsafe()
        act = action.strip().lower()
        if act == "copy":
            pyautogui.hotkey(self.mod_key, "c")
            time.sleep(0.1)
            return {"status": "ok", "action": "copy", "clipboard_preview": pyperclip.paste()[:300]}
        if act == "cut":
            pyautogui.hotkey(self.mod_key, "x")
            time.sleep(0.1)
            return {"status": "ok", "action": "cut"}
        if act == "paste":
            pyautogui.hotkey(self.mod_key, "v")
            return {"status": "ok", "action": "paste"}
        if act == "read":
            content = pyperclip.paste()
            return {"status": "ok", "action": "read", "content": content[:4000]}
        if act == "write":
            pyperclip.copy(text or "")
            return {"status": "ok", "action": "write", "characters": len(text or "")}
        return {"status": "error", "message": f"Unsupported clipboard action: {action}"}

    # ------------------------------------------------------------------
    # 2. Applications & OS-Native Window Control
    # ------------------------------------------------------------------

    def launch_application(self, app_name: str, arguments: list[str] | None = None) -> dict[str, Any]:
        """Launch a desktop application by friendly name using OS-native launchers.

        Args:
            app_name: Friendly name or executable (e.g., 'vscode', 'chrome', 'terminal', 'notepad').
            arguments: Optional list of CLI arguments such as a file or directory path.
        """
        args = list(arguments or [])
        key = app_name.strip().lower()
        resolved = APP_ALIASES.get(key, {}).get(self.os_name, app_name.strip())

        try:
            if self.os_name == "macos":
                cmd = ["open", "-a", resolved]
                if args:
                    cmd.extend(["--args", *args])
                subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            elif self.os_name == "windows":
                binary = shutil.which(resolved)
                if binary:
                    subprocess.Popen(
                        [binary, *args],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=getattr(subprocess, "DETACHED_PROCESS", 0),
                    )
                else:
                    os.startfile(resolved)  # type: ignore[attr-defined]
            else:
                if resolved == "xdg-open":
                    target = args[0] if args else str(Path.home())
                    subprocess.Popen(["xdg-open", target], start_new_session=True)
                else:
                    binary = shutil.which(resolved)
                    if binary:
                        subprocess.Popen(
                            [binary, *args],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                            start_new_session=True,
                        )
                    else:
                        subprocess.Popen(
                            ["gtk-launch", resolved],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                            start_new_session=True,
                        )
            time.sleep(0.8)
            return {"status": "ok", "os": self.os_name, "launched": resolved, "arguments": args}
        except Exception as exc:
            return {"status": "error", "message": f"Could not launch '{app_name}': {exc}"}

    def switch_window(self, target: str) -> dict[str, Any]:
        """Bring an existing application window into focus without mouse coordinates.

        Args:
            target: Application or window title substring, or 'previous' to cycle windows.
        """
        enforce_failsafe()
        cleaned = target.strip()
        if cleaned.lower() in {"previous", "last", "next", "back"}:
            if self.os_name == "macos":
                pyautogui.hotkey("command", "tab")
            else:
                pyautogui.hotkey("alt", "tab")
            return {"status": "ok", "action": "cycle_window"}

        if self.os_name == "macos":
            resolved = APP_ALIASES.get(cleaned.lower(), {}).get("macos", cleaned)
            safe_name = resolved.replace('"', "")
            result = subprocess.run(
                ["osascript", "-e", f'tell application "{safe_name}" to activate'],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                return {"status": "ok", "focused": resolved}
            return {"status": "error", "message": result.stderr.strip() or f"App '{resolved}' not found."}

        if self.os_name == "windows":
            try:
                import pygetwindow as gw  # type: ignore[import-not-found]

                matches = gw.getWindowsWithTitle(cleaned)
                if matches:
                    win = matches[0]
                    if win.isMinimized:
                        win.restore()
                    win.activate()
                    return {"status": "ok", "focused": win.title}
            except Exception as exc:
                logger.debug("pygetwindow fallback: %s", exc)
            pyautogui.hotkey("alt", "tab")
            return {"status": "ok", "fallback": "alt+tab", "requested": cleaned}

        # Linux: wmctrl -> xdotool -> alt+tab fallback
        if shutil.which("wmctrl"):
            res = subprocess.run(["wmctrl", "-a", cleaned], capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                return {"status": "ok", "focused": cleaned, "via": "wmctrl"}
        if shutil.which("xdotool"):
            res = subprocess.run(
                ["xdotool", "search", "--name", cleaned, "windowactivate"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if res.returncode == 0:
                return {"status": "ok", "focused": cleaned, "via": "xdotool"}
        pyautogui.hotkey("alt", "tab")
        return {"status": "ok", "fallback": "alt+tab", "requested": cleaned}

    def manage_window(self, action: str) -> dict[str, Any]:
        """Manage the active window using OS-native keyboard shortcuts.

        Args:
            action: One of 'minimize', 'maximize', 'snap_left', 'snap_right', 'show_desktop', or 'close'.
        """
        enforce_failsafe()
        act = action.strip().lower()

        if self.os_name == "macos":
            mapping: dict[str, tuple[str, ...]] = {
                "minimize": ("command", "m"),
                "maximize": ("ctrl", "command", "f"),
                "close": ("command", "w"),
                "show_desktop": ("fn", "f11"),
            }
        elif self.os_name == "windows":
            mapping = {
                "minimize": ("win", "down"),
                "maximize": ("win", "up"),
                "snap_left": ("win", "left"),
                "snap_right": ("win", "right"),
                "show_desktop": ("win", "d"),
                "close": ("alt", "f4"),
            }
        else:
            mapping = {
                "minimize": ("super", "h"),
                "maximize": ("super", "up"),
                "snap_left": ("super", "left"),
                "snap_right": ("super", "right"),
                "show_desktop": ("super", "d"),
                "close": ("alt", "f4"),
            }

        chord = mapping.get(act)
        if not chord:
            return {"status": "error", "message": f"Action '{action}' is not supported on {self.os_name}."}

        pyautogui.hotkey(*chord)
        return {"status": "ok", "action": act, "shortcut": list(chord)}

    # ------------------------------------------------------------------
    # 3. File System Operations (pathlib + Safety Path Validation)
    # ------------------------------------------------------------------

    def list_directory(self, path: str = ".", max_entries: int = 50) -> dict[str, Any]:
        """List files and subdirectories in a local directory.

        Args:
            path: Directory path (supports '~' expansion). Defaults to workspace root.
            max_entries: Maximum entries to return (1-200).
        """
        target = Path(path).expanduser()
        if not target.is_absolute():
            target = (self.config.workspace_root / target).resolve()
        else:
            target = target.resolve()

        if not target.exists() or not target.is_dir():
            return {"status": "error", "message": f"Directory not found: {target}"}

        limit = max(1, min(int(max_entries), 200))
        items: list[dict[str, Any]] = []
        for entry in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))[:limit]:
            try:
                size = entry.stat().st_size if entry.is_file() else None
            except OSError:
                size = None
            items.append({"name": entry.name, "type": "dir" if entry.is_dir() else "file", "size_bytes": size})

        return {"status": "ok", "path": str(target), "count": len(items), "entries": items}

    def read_file(self, path: str, max_chars: int = 4000) -> dict[str, Any]:
        """Read UTF-8 text content from a local file.

        Args:
            path: File path to inspect.
            max_chars: Maximum characters to return (clamped to 12000).
        """
        try:
            target = validate_path(path, allow_home_root=True)
        except ProtectedPathError as exc:
            return {"status": "error", "message": str(exc)}

        if not target.exists() or not target.is_file():
            return {"status": "error", "message": f"File not found: {target}"}

        limit = max(100, min(int(max_chars), 12000))
        content = target.read_text(encoding="utf-8", errors="replace")
        return {
            "status": "ok",
            "path": str(target),
            "truncated": len(content) > limit,
            "content": content[:limit],
        }

    def create_or_write_file(self, path: str, content: str, overwrite: bool = False) -> dict[str, Any]:
        """Create a file on disk and write UTF-8 text or code into it.

        Args:
            path: Target file path (missing parent folders are created automatically).
            content: Complete text or source code to write.
            overwrite: Must be True to replace an existing file (triggers High-Risk confirmation).
        """
        try:
            target = validate_path(path)
        except ProtectedPathError as exc:
            return {"status": "error", "message": str(exc)}

        if target.exists() and not overwrite:
            return {
                "status": "error",
                "message": f"File already exists: {target}. Re-issue with overwrite=True if you intend to replace it.",
            }

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return {"status": "ok", "path": str(target), "bytes_written": len(content.encode("utf-8"))}

    def move_or_rename_path(self, source: str, destination: str) -> dict[str, Any]:
        """HIGH-RISK: Move or rename a file or folder on disk.

        Args:
            source: Existing file or directory path.
            destination: Target destination path.
        """
        try:
            src = validate_path(source)
            dst = validate_path(destination)
        except ProtectedPathError as exc:
            return {"status": "error", "message": str(exc)}

        if not src.exists():
            return {"status": "error", "message": f"Source path does not exist: {src}"}

        dst.parent.mkdir(parents=True, exist_ok=True)
        final_path = shutil.move(str(src), str(dst))
        return {"status": "ok", "source": str(src), "destination": str(final_path)}

    def delete_path(self, path: str, recursive: bool = False) -> dict[str, Any]:
        """HIGH-RISK: Delete a file or directory (uses OS Trash/Recycle Bin when available).

        Args:
            path: Path to delete.
            recursive: Must be True to delete a non-empty directory.
        """
        try:
            target = validate_path(path)
        except ProtectedPathError as exc:
            return {"status": "error", "message": str(exc)}

        if not target.exists():
            return {"status": "error", "message": f"Path not found: {target}"}

        if _send2trash is not None:
            _send2trash(str(target))
            return {"status": "ok", "path": str(target), "method": "os_trash"}

        if target.is_dir():
            if not recursive:
                return {"status": "error", "message": "Target is a directory; pass recursive=True to remove it."}
            shutil.rmtree(target)
        else:
            target.unlink()
        return {"status": "ok", "path": str(target), "method": "permanent_unlink"}

    # ------------------------------------------------------------------
    # 4. Browser Automation (Playwright with Default-Browser Fallback)
    # ------------------------------------------------------------------

    def browser_open_url(self, url: str, wait_for_load: bool = True) -> dict[str, Any]:
        """Open an HTTP or HTTPS URL in Playwright Chromium or the default OS browser.

        Args:
            url: Full web URL (https:// is prepended automatically if omitted).
            wait_for_load: When Playwright is active, wait for DOMContentLoaded.
        """
        cleaned = url.strip()
        if not cleaned.startswith(("http://", "https://")):
            cleaned = f"https://{cleaned}"
        parsed = urllib.parse.urlparse(cleaned)
        if parsed.scheme not in {"http", "https"}:
            return {"status": "error", "message": "Only http:// and https:// URLs are allowed."}

        if self.config.enable_playwright:
            page = self.browser.ensure_page()
            page.goto(cleaned, wait_until="domcontentloaded" if wait_for_load else "commit", timeout=20000)
            return {"status": "ok", "engine": "playwright", "url": page.url, "title": page.title()}

        webbrowser.open(cleaned)
        return {"status": "ok", "engine": "system_browser", "url": cleaned}

    def browser_search(self, query: str, engine: str = "google") -> dict[str, Any]:
        """Run a web search without relying on screen coordinates.

        Args:
            query: Search query text.
            engine: Search engine ('google', 'duckduckgo', 'github', or 'youtube').
        """
        encoded = urllib.parse.quote_plus(query.strip())
        templates = {
            "google": f"https://www.google.com/search?q={encoded}",
            "duckduckgo": f"https://duckduckgo.com/?q={encoded}",
            "github": f"https://github.com/search?q={encoded}",
            "youtube": f"https://www.youtube.com/results?search_query={encoded}",
        }
        url = templates.get(engine.strip().lower(), templates["google"])
        return self.browser_open_url(url)

    def browser_page_action(
        self,
        action: str,
        selector_or_text: str = "",
        value: str = "",
    ) -> dict[str, Any]:
        """Interact with the active Playwright browser page using semantic locators.

        Args:
            action: One of 'click_text', 'fill_input', 'get_page_text', 'go_back', 'scroll_down', 'scroll_up', 'new_tab'.
            selector_or_text: Visible link/button text or CSS selector.
            value: Text to fill when action is 'fill_input'.
        """
        if not self.config.enable_playwright:
            return {
                "status": "error",
                "message": "Playwright is disabled. Enable VOX_ENABLE_PLAYWRIGHT=true to use page actions.",
            }

        page = self.browser.ensure_page()
        act = action.strip().lower()

        if act == "click_text":
            page.get_by_text(selector_or_text, exact=False).first.click(timeout=8000)
            return {"status": "ok", "clicked": selector_or_text, "url": page.url}
        if act == "fill_input":
            locator = page.locator(selector_or_text).first
            locator.fill(value, timeout=8000)
            return {"status": "ok", "filled": selector_or_text}
        if act == "get_page_text":
            text = page.inner_text("body")
            return {"status": "ok", "title": page.title(), "url": page.url, "text": text[:3500]}
        if act == "go_back":
            page.go_back(wait_until="domcontentloaded")
            return {"status": "ok", "url": page.url}
        if act == "scroll_down":
            page.mouse.wheel(0, 650)
            return {"status": "ok", "scrolled": "down"}
        if act == "scroll_up":
            page.mouse.wheel(0, -650)
            return {"status": "ok", "scrolled": "up"}
        if act == "new_tab":
            self.browser._page = page.context.new_page()
            return {"status": "ok", "action": "new_tab"}
        return {"status": "error", "message": f"Unsupported browser_page_action: {action}"}

    # ------------------------------------------------------------------
    # 5. Terminal, Power, Messaging & System Info
    # ------------------------------------------------------------------

    def run_shell_command(self, command: str, working_directory: str | None = None) -> dict[str, Any]:
        """HIGH-RISK: Execute a command in the local OS shell with a strict timeout.

        Args:
            command: Shell command string to execute.
            working_directory: Optional directory to run the command inside.
        """
        cwd = self.config.workspace_root
        if working_directory:
            cwd = Path(working_directory).expanduser().resolve()
            if not cwd.exists():
                return {"status": "error", "message": f"Working directory does not exist: {cwd}"}

        try:
            proc = subprocess.run(
                command,
                shell=True,
                cwd=str(cwd),
                capture_output=True,
                text=True,
                timeout=self.config.shell_timeout_sec,
            )
            return {
                "status": "ok" if proc.returncode == 0 else "error",
                "returncode": proc.returncode,
                "stdout": proc.stdout[:3000].strip(),
                "stderr": proc.stderr[:1500].strip(),
            }
        except subprocess.TimeoutExpired:
            return {"status": "error", "message": f"Command timed out after {self.config.shell_timeout_sec}s."}

    def system_power_action(self, action: str) -> dict[str, Any]:
        """HIGH-RISK: Lock, sleep, restart, or shut down the computer.

        Args:
            action: One of 'lock', 'sleep', 'restart', or 'shutdown'.
        """
        act = action.strip().lower()
        commands: dict[str, dict[str, list[str]]] = {
            "windows": {
                "lock": ["rundll32.exe", "user32.dll,LockWorkStation"],
                "sleep": ["rundll32.exe", "powrprof.dll,SetSuspendState", "0", "1", "0"],
                "restart": ["shutdown", "/r", "/t", "5"],
                "shutdown": ["shutdown", "/s", "/t", "5"],
            },
            "macos": {
                "lock": ["pmset", "displaysleepnow"],
                "sleep": ["pmset", "sleepnow"],
                "restart": ["osascript", "-e", 'tell application "System Events" to restart'],
                "shutdown": ["osascript", "-e", 'tell application "System Events" to shut down'],
            },
            "linux": {
                "lock": ["loginctl", "lock-session"],
                "sleep": ["systemctl", "suspend"],
                "restart": ["systemctl", "reboot"],
                "shutdown": ["systemctl", "poweroff"],
            },
        }
        cmd = commands.get(self.os_name, {}).get(act)
        if not cmd:
            return {"status": "error", "message": f"Unsupported power action '{action}' on {self.os_name}."}

        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"status": "ok", "action": act, "os": self.os_name}

    def send_message_or_email(
        self,
        recipient: str,
        subject: str,
        body: str,
        channel: str = "email",
    ) -> dict[str, Any]:
        """HIGH-RISK: Prepare and open an outbound email or message draft for dispatch.

        Args:
            recipient: Email address or recipient handle.
            subject: Subject line for the email/message.
            body: Message body content.
            channel: Delivery channel ('email' opens default mail client via mailto URI).
        """
        if channel.strip().lower() == "email":
            query = urllib.parse.urlencode({"subject": subject, "body": body})
            mailto_uri = f"mailto:{urllib.parse.quote(recipient)}?{query}"
            webbrowser.open(mailto_uri)
            return {
                "status": "ok",
                "channel": "email",
                "recipient": recipient,
                "detail": "Opened pre-filled email draft in default mail client.",
            }
        return {
            "status": "ok",
            "channel": channel,
            "recipient": recipient,
            "detail": f"Prepared {channel} message payload for {recipient}.",
        }

    def get_system_info(self) -> dict[str, Any]:
        """Return current OS platform, local date/time, working directory, CPU/RAM, and battery info."""
        info: dict[str, Any] = {
            "status": "ok",
            "os": self.os_name,
            "platform_release": platform.platform(),
            "local_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "workspace_root": str(self.config.workspace_root),
            "playwright_enabled": self.config.enable_playwright,
        }
        if _psutil is not None:
            info["cpu_percent"] = _psutil.cpu_percent(interval=0.2)
            info["memory_percent"] = _psutil.virtual_memory().percent
            battery = _psutil.sensors_battery()
            if battery is not None:
                info["battery_percent"] = round(battery.percent, 1)
                info["power_plugged"] = battery.power_plugged
        return info

    def get_tool_callables(self) -> list[Callable[..., dict[str, Any]]]:
        """Return the ordered list of bound Python tool functions for google-genai."""
        tools: list[Callable[..., dict[str, Any]]] = [
            self.type_text,
            self.press_hotkey,
            self.press_key,
            self.clipboard_action,
            self.launch_application,
            self.switch_window,
            self.manage_window,
            self.list_directory,
            self.read_file,
            self.create_or_write_file,
            self.move_or_rename_path,
            self.delete_path,
            self.browser_open_url,
            self.browser_search,
            self.run_shell_command,
            self.system_power_action,
            self.send_message_or_email,
            self.get_system_info,
        ]
        if self.config.enable_playwright:
            tools.append(self.browser_page_action)
        return tools
`;
}

function buildBrainPy(): string {
  return `"""
brain.py — Dual-Provider AI Intent Router (Local Ollama + Cloud Gemini API).

Supports:
  1. Local Ollama (100% offline, free, no API key):
     - Native Ollama function calling for models like qwen2.5:7b, llama3.1,
       llama3.2:3b, and mistral.
     - Automatic structured-JSON fallback for older models (like base llama3 or
       deepseek-coder) that do not support Ollama's native tools parameter.
  2. Google Gemini API (google-genai SDK, gemini-2.5-flash):
     - automatic_function_calling is explicitly DISABLED.

Security Invariant:
  Regardless of provider, EVERY tool call proposed by the LLM passes through
  SafetyGuard.classify() and (for HIGH_RISK actions) SafetyGuard.request_confirmation()
  before touching the operating system.
"""

from __future__ import annotations

import inspect
import json
import logging
import re
from typing import Any, Callable

from config import AppConfig, detect_os, primary_modifier_key
from safety import RiskLevel, SafetyGuard
from tools import DesktopToolbox

logger = logging.getLogger("voxcontrol.brain")


class AssistantBrain:
    """Routes natural spoken transcripts into safe, multi-step OS tool calls."""

    def __init__(
        self,
        config: AppConfig,
        toolbox: DesktopToolbox,
        safety_guard: SafetyGuard,
        speak_fn: Callable[[str, bool], None],
        listen_confirmation_fn: Callable[[float], str] | None = None,
        dry_run: bool = False,
    ) -> None:
        self.config = config
        self.toolbox = toolbox
        self.safety_guard = safety_guard
        self.speak_fn = speak_fn
        self.listen_confirmation_fn = listen_confirmation_fn
        self.dry_run = dry_run

        self.tool_callables = toolbox.get_tool_callables()
        self.tool_map: dict[str, Callable[..., dict[str, Any]]] = {
            fn.__name__: fn for fn in self.tool_callables
        }
        self.system_instruction = self._build_system_instruction()

        # Provider-specific clients & histories
        self._gemini_client: Any = None
        self._gemini_types: Any = None
        self._gemini_history: list[Any] = []

        self._ollama_client: Any = None
        self._ollama_messages: list[dict[str, Any]] = [
            {"role": "system", "content": self.system_instruction}
        ]
        self._ollama_native_tools_supported = True

        if config.llm_provider == "ollama":
            try:
                import ollama
            except ImportError as exc:
                raise RuntimeError(
                    "The 'ollama' Python package is not installed. Run: pip install ollama"
                ) from exc
            self._ollama_client = ollama.Client(host=config.ollama_host)
            logger.info("Brain initialized with Local Ollama (%s @ %s)", config.ollama_model, config.ollama_host)
        else:
            try:
                from google import genai
                from google.genai import types
            except ImportError as exc:
                raise RuntimeError(
                    "The 'google-genai' package is not installed. Run: pip install google-genai"
                ) from exc
            self._gemini_client = genai.Client(api_key=config.gemini_api_key)
            self._gemini_types = types
            logger.info("Brain initialized with Gemini API (%s)", config.gemini_model)

    def _build_system_instruction(self) -> str:
        os_name = detect_os()
        mod_key = primary_modifier_key()
        pw_state = "ENABLED" if self.config.enable_playwright else "DISABLED (fallback to default browser)"
        return (
            "You are VoxControl, a fast, reliable local desktop voice assistant.\\n"
            f"Current OS: {os_name}. Primary modifier key: '{mod_key}' (always pass 'mod' to press_hotkey).\\n"
            f"Voice language mode: {self.config.voice_language_mode}.\\n"
            f"Workspace root: {self.config.workspace_root}. Playwright browser automation: {pw_state}.\\n"
            "Rules:\\n"
            "1. Bilingual Hindi + English Support: Users may speak naturally in English, Hindi (Devanagari), "
            "or Hinglish (mixed Hindi + English, e.g. 'VS Code kholo aur nayi file banao' or "
            "'Notepad open karke namaste likho'). Always understand intent seamlessly and execute the right tools.\\n"
            "2. Decompose compound spoken requests into ordered multi-step tool calls. "
            "For example, 'Open VS Code, create a new file, and type a Python hello world script' "
            "should call launch_application('vscode'), press_hotkey(['mod', 'n']), and "
            "type_text(..., use_clipboard_paste=True).\\n"
            "3. Never guess hardcoded screen coordinates. Always use OS hotkeys, app launchers, "
            "pathlib file tools, or Playwright semantic locators.\\n"
            "4. Emit the exact tool call even for high-risk actions (deleting files, shell commands, "
            "power actions, sending email); the local SafetyGuard will pause and ask the user for approval.\\n"
            "5. Keep final spoken responses crisp and brief (1 to 2 sentences) for offline TTS."
        )

    def _build_json_fallback_prompt(self) -> str:
        """Compact tool catalog prompt used automatically for Ollama models without native tool calling."""
        catalog_lines: list[str] = []
        for fn in self.tool_callables:
            sig = inspect.signature(fn)
            first_doc = (inspect.getdoc(fn) or "").splitlines()[0] if inspect.getdoc(fn) else ""
            catalog_lines.append(f"- {fn.__name__}{sig}: {first_doc}")
        catalog = "\\n".join(catalog_lines)
        return (
            f"{self.system_instruction}\\n\\n"
            "TOOL CALLING FORMAT (strict JSON only):\\n"
            "When you need to execute one or more desktop actions, reply ONLY with valid JSON:\\n"
            '{"tool_calls": [{"name": "tool_name", "arguments": {"arg": "value"}}], "reply": ""}\\n'
            "When all actions are complete or no tool is needed, reply ONLY with valid JSON:\\n"
            '{"tool_calls": [], "reply": "Short spoken confirmation."}\\n\\n'
            f"Available tools:\\n{catalog}"
        )

    def handle_utterance(self, transcript: str) -> str:
        """Process a user voice command through the configured provider (Ollama or Gemini)."""
        cleaned = transcript.strip()
        if not cleaned:
            return ""
        if self.config.llm_provider == "ollama":
            return self._handle_ollama(cleaned)
        return self._handle_gemini(cleaned)

    # ------------------------------------------------------------------
    # Provider 1: Local Ollama (Native Tool Calling + JSON Fallback)
    # ------------------------------------------------------------------

    def _prune_ollama_history(self) -> None:
        max_non_system = self.config.max_history_turns * 2
        if len(self._ollama_messages) > max_non_system + 1:
            self._ollama_messages = [self._ollama_messages[0], *self._ollama_messages[-max_non_system:]]

    def _handle_ollama(self, transcript: str) -> str:
        self._ollama_messages.append({"role": "user", "content": transcript})
        self._prune_ollama_history()

        if not self._ollama_native_tools_supported:
            return self._handle_ollama_json_fallback()

        for round_idx in range(1, self.config.max_tool_rounds + 1):
            logger.debug("Ollama planning round %d/%d (%s)", round_idx, self.config.max_tool_rounds, self.config.ollama_model)
            try:
                response = self._ollama_client.chat(
                    model=self.config.ollama_model,
                    messages=self._ollama_messages,
                    tools=self.tool_callables,
                    options={"temperature": 0.1},
                )
            except Exception as exc:
                err_text = str(exc).lower()
                if "does not support tools" in err_text or "tool" in err_text and "support" in err_text:
                    logger.warning(
                        "Model '%s' does not support native Ollama tools; switching to structured JSON tool mode.",
                        self.config.ollama_model,
                    )
                    self._ollama_native_tools_supported = False
                    self._ollama_messages[0] = {"role": "system", "content": self._build_json_fallback_prompt()}
                    return self._handle_ollama_json_fallback()
                raise RuntimeError(
                    f"Ollama request failed ({exc}). Ensure Ollama is running and run: "
                    f"ollama pull {self.config.ollama_model}"
                ) from exc

            msg = response.message
            tool_calls = getattr(msg, "tool_calls", None) or []

            assistant_record: dict[str, Any] = {
                "role": "assistant",
                "content": getattr(msg, "content", "") or "",
            }
            if tool_calls:
                assistant_record["tool_calls"] = [
                    {
                        "function": {
                            "name": tc.function.name,
                            "arguments": dict(tc.function.arguments or {}),
                        }
                    }
                    for tc in tool_calls
                ]
            self._ollama_messages.append(assistant_record)

            if not tool_calls:
                return (getattr(msg, "content", "") or "Done.").strip()

            for tc in tool_calls:
                tool_name = tc.function.name
                raw_args = tc.function.arguments or {}
                tool_args = json.loads(raw_args) if isinstance(raw_args, str) else dict(raw_args)
                result_payload = self._execute_with_guardrails(tool_name, tool_args)
                self._ollama_messages.append(
                    {
                        "role": "tool",
                        "tool_name": tool_name,
                        "content": json.dumps(result_payload, ensure_ascii=False),
                    }
                )

        return "Stopped after reaching the maximum multi-step tool limit."

    def _handle_ollama_json_fallback(self) -> str:
        """Fallback JSON tool loop for Ollama models without native tools API (e.g. llama3, deepseek-coder)."""
        for round_idx in range(1, self.config.max_tool_rounds + 1):
            logger.debug("Ollama JSON-fallback round %d/%d", round_idx, self.config.max_tool_rounds)
            response = self._ollama_client.chat(
                model=self.config.ollama_model,
                messages=self._ollama_messages,
                format="json",
                options={"temperature": 0.1},
            )
            raw_content = (getattr(response.message, "content", "") or "").strip()
            self._ollama_messages.append({"role": "assistant", "content": raw_content})

            parsed = self._extract_json_object(raw_content)
            if not parsed:
                return raw_content or "Done."

            calls = parsed.get("tool_calls") or []
            if not isinstance(calls, list) or not calls:
                return str(parsed.get("reply") or "Done.").strip()

            results_summary: list[dict[str, Any]] = []
            for item in calls:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("name", "")).strip()
                args = item.get("arguments") or {}
                if not isinstance(args, dict):
                    args = {}
                out = self._execute_with_guardrails(name, args)
                results_summary.append({"tool": name, "result": out})

            self._ollama_messages.append(
                {
                    "role": "user",
                    "content": f"Tool execution results: {json.dumps(results_summary, ensure_ascii=False)}. "
                    "Continue with remaining tool_calls if needed, or return empty tool_calls with a short spoken reply.",
                }
            )

        return "Stopped after reaching the maximum multi-step tool limit."

    @staticmethod
    def _extract_json_object(text: str) -> dict[str, Any] | None:
        try:
            obj = json.loads(text)
            return obj if isinstance(obj, dict) else None
        except json.JSONDecodeError:
            match = re.search(r"\\{[\\s\\S]*\\}", text)
            if not match:
                return None
            try:
                obj = json.loads(match.group(0))
                return obj if isinstance(obj, dict) else None
            except json.JSONDecodeError:
                return None

    # ------------------------------------------------------------------
    # Provider 2: Cloud Gemini API (google-genai)
    # ------------------------------------------------------------------

    def _prune_gemini_history(self) -> None:
        max_items = self.config.max_history_turns * 2
        if len(self._gemini_history) > max_items:
            self._gemini_history = self._gemini_history[-max_items:]

    def _handle_gemini(self, transcript: str) -> str:
        types = self._gemini_types
        self._gemini_history.append(
            types.Content(role="user", parts=[types.Part.from_text(text=transcript)])
        )
        self._prune_gemini_history()

        gen_config = types.GenerateContentConfig(
            system_instruction=self.system_instruction,
            tools=self.tool_callables,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            temperature=0.1,
        )

        for round_idx in range(1, self.config.max_tool_rounds + 1):
            logger.debug("Gemini planning round %d/%d", round_idx, self.config.max_tool_rounds)
            response = self._gemini_client.models.generate_content(
                model=self.config.gemini_model,
                contents=self._gemini_history,
                config=gen_config,
            )

            candidate_content = response.candidates[0].content if response.candidates else None
            if candidate_content is not None:
                self._gemini_history.append(candidate_content)

            function_calls = response.function_calls or []
            if not function_calls:
                return (response.text or "Done.").strip()

            response_parts: list[Any] = []
            for call in function_calls:
                tool_name = call.name or ""
                tool_args = dict(call.args or {})
                result_payload = self._execute_with_guardrails(tool_name, tool_args)
                response_parts.append(
                    types.Part.from_function_response(
                        name=tool_name,
                        response=result_payload,
                    )
                )

            self._gemini_history.append(types.Content(role="user", parts=response_parts))

        return "Stopped after reaching the maximum multi-step tool limit."

    # ------------------------------------------------------------------
    # Shared SafetyGuard Execution Gate
    # ------------------------------------------------------------------

    def _execute_with_guardrails(self, tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
        """Classify risk, enforce confirmation for HIGH_RISK tools, execute, and audit."""
        fn = self.tool_map.get(tool_name)
        if fn is None:
            return {"status": "error", "message": f"Unknown tool requested: {tool_name}"}

        risk, reason = self.safety_guard.classify(tool_name, args)
        logger.info("Tool call: %s(%s) -> risk=%s (%s)", tool_name, args, risk.value, reason)

        approved = True
        if risk == RiskLevel.HIGH_RISK:
            approved = self.safety_guard.request_confirmation(
                tool_name=tool_name,
                args=args,
                speak_fn=self.speak_fn,
                listen_confirmation_fn=self.listen_confirmation_fn,
            )
            if not approved:
                self.safety_guard.record_audit(tool_name, args, risk, approved=False, outcome="denied_by_user")
                return {
                    "status": "denied_by_user",
                    "message": "User explicitly declined confirmation for this high-risk action.",
                }

        if self.dry_run:
            result = {
                "status": "ok",
                "dry_run": True,
                "tool": tool_name,
                "args": args,
                "message": "Dry-run mode active: OS side effects skipped.",
            }
            self.safety_guard.record_audit(tool_name, args, risk, approved=approved, outcome="dry_run")
            return result

        try:
            result = fn(**args)
            outcome = str(result.get("status", "ok"))
            self.safety_guard.record_audit(tool_name, args, risk, approved=approved, outcome=outcome)
            return result
        except Exception as exc:
            logger.exception("Tool execution failed for %s", tool_name)
            self.safety_guard.record_audit(tool_name, args, risk, approved=approved, outcome=f"exception:{exc}")
            return {"status": "error", "message": str(exc)}
`;
}

function buildMainPy(): string {
  return `"""
main.py — Entry point and lifecycle orchestrator for VoxControl.

Usage:
  python main.py                  # Normal Push-to-Talk voice mode
  python main.py --dry-run        # Test voice -> Whisper -> Gemini without touching OS
  python main.py --text-mode      # Type commands in terminal (great for first test)
  python main.py --config-check   # Verify API key, OS detection, and tool registry
"""

from __future__ import annotations

import argparse
import logging
import queue
import signal
import sys
import threading

import numpy as np
import pyautogui

from audio_io import PushToTalkRecorder, VoiceSpeaker, WhisperTranscriber
from brain import AssistantBrain
from config import AppConfig, configure_logging, detect_os
from safety import SafetyGuard, enforce_failsafe
from tools import DesktopToolbox

logger = logging.getLogger("voxcontrol.main")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="VoxControl — Local Desktop Voice Assistant")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Plan tool calls and test High-Risk prompts without executing OS actions.",
    )
    parser.add_argument(
        "--text-mode",
        action="store_true",
        help="Accept typed commands from stdin instead of microphone Push-to-Talk.",
    )
    parser.add_argument(
        "--no-playwright",
        action="store_true",
        help="Disable Playwright and use the system default browser.",
    )
    parser.add_argument(
        "--config-check",
        action="store_true",
        help="Validate configuration and print loaded environment summary, then exit.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = AppConfig.from_env()
    if args.no_playwright:
        config = AppConfig(**{**config.__dict__, "enable_playwright": False})

    configure_logging(config.log_level)
    enforce_failsafe()

    try:
        config.validate()
    except ValueError as exc:
        logger.error("Configuration error: %s", exc)
        return 1

    if args.config_check:
        print(f"OS detected       : {detect_os()}")
        print(f"AI Brain          : {config.active_model_label}")
        print(f"PTT hotkey        : {config.ptt_hotkey}")
        print(f"Voice language    : {config.voice_language_mode}")
        print(f"Whisper model     : {config.whisper_model_size} ({config.whisper_device})")
        print(f"Playwright        : {'enabled' if config.enable_playwright else 'disabled'}")
        print(f"PyAutoGUI failsafe: {pyautogui.FAILSAFE}")
        print(f"Confirmation mode : {config.confirmation_mode}")
        if config.llm_provider == "ollama":
            try:
                import ollama
                models = ollama.Client(host=config.ollama_host).list()
                installed = [getattr(m, "model", str(m)) for m in getattr(models, "models", [])]
                print(f"Ollama status     : REACHABLE ({len(installed)} model(s) installed)")
            except Exception as exc:
                print(f"Ollama status     : UNREACHABLE ({exc}) — make sure Ollama is running")
        print("Configuration check passed.")
        return 0

    shutdown_event = threading.Event()

    def _handle_signal(signum: int, _frame: object) -> None:
        logger.info("Received signal %s — shutting down gracefully...", signum)
        shutdown_event.set()

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    speaker = VoiceSpeaker(config)
    toolbox = DesktopToolbox(config)
    safety_guard = SafetyGuard(config)
    transcriber: WhisperTranscriber | None = None
    recorder: PushToTalkRecorder | None = None
    clip_queue: queue.Queue[np.ndarray] = queue.Queue()

    try:
        if not args.text_mode:
            transcriber = WhisperTranscriber(config)

            def _listen_confirmation(duration_sec: float) -> str:
                assert recorder is not None and transcriber is not None
                clip = recorder.record_confirmation_clip(duration_sec=duration_sec)
                return transcriber.transcribe(clip).text

            recorder = PushToTalkRecorder(config, on_clip_ready=clip_queue.put)
            recorder.start()
        else:
            _listen_confirmation = None  # type: ignore[assignment]

        brain = AssistantBrain(
            config=config,
            toolbox=toolbox,
            safety_guard=safety_guard,
            speak_fn=speaker.speak,
            listen_confirmation_fn=_listen_confirmation if not args.text_mode else None,
            dry_run=args.dry_run,
        )

        mode_label = "DRY-RUN" if args.dry_run else "LIVE"
        logger.info("VoxControl ready [%s | OS=%s | Failsafe=%s]", mode_label, detect_os(), pyautogui.FAILSAFE)
        speaker.speak("VoxControl is ready.", block=False)

        if args.text_mode:
            print("Text mode active. Type a command (or 'exit' to quit).")
            while not shutdown_event.is_set():
                try:
                    utterance = input("\\nCommand > ").strip()
                except (EOFError, KeyboardInterrupt):
                    break
                if utterance.lower() in {"exit", "quit"}:
                    break
                if not utterance:
                    continue
                reply = brain.handle_utterance(utterance)
                if reply:
                    print(f"Assistant > {reply}")
                    speaker.speak(reply, block=False)
        else:
            assert transcriber is not None
            while not shutdown_event.is_set():
                try:
                    audio_clip = clip_queue.get(timeout=0.3)
                except queue.Empty:
                    continue

                result = transcriber.transcribe(audio_clip)
                if not result.text:
                    logger.info("No speech detected in %.2fs clip.", result.duration_sec)
                    continue

                logger.info(
                    "Heard [%s] (%.2fs audio, %dms STT): %s",
                    result.language,
                    result.duration_sec,
                    result.inference_ms,
                    result.text,
                )
                try:
                    reply = brain.handle_utterance(result.text)
                    if reply:
                        speaker.speak(reply, block=False)
                except pyautogui.FailSafeException:
                    logger.warning("PyAutoGUI FAILSAFE triggered! Mouse moved to screen corner.")
                    speaker.speak("Emergency failsafe triggered. Action aborted.", block=False)
                except Exception as exc:
                    logger.exception("Error handling command: %s", exc)
                    speaker.speak("Something went wrong while running that command.", block=False)
    finally:
        if recorder is not None:
            recorder.stop()
        toolbox.close()
        speaker.shutdown()
        logger.info("VoxControl exited cleanly.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
`;
}

function buildRequirementsTxt(cfg: ProjectConfig): string {
  const lines = [
    "# VoxControl — Local Desktop Voice Assistant Dependencies",
    "# Python 3.10+ recommended",
    "",
  ];

  if (cfg.llmProvider === "ollama") {
    lines.push(
      "# Local Ollama Brain (100% offline, no API key required)",
      "ollama>=0.4.7",
      "",
      "# Optional Cloud Gemini SDK (uncomment if switching VOX_LLM_PROVIDER=gemini)",
      "# google-genai>=1.14.0",
      ""
    );
  } else {
    lines.push(
      "# Gemini Brain (modern official SDK)",
      "google-genai>=1.14.0",
      "",
      "# Optional Local Ollama SDK (uncomment if switching VOX_LLM_PROVIDER=ollama)",
      "# ollama>=0.4.7",
      ""
    );
  }

  lines.push(
    "# Local Speech-to-Text & Audio Capture",
    "faster-whisper>=1.1.0",
    "sounddevice>=0.5.1",
    "numpy>=1.26.4",
    "",
    "# Desktop Control, Global Hotkeys & Offline TTS",
    "pynput>=1.7.7",
    "pyautogui>=0.9.54",
    "pyperclip>=1.9.0",
    "pyttsx3>=2.98",
    "",
    "# Safety, Utilities & Telemetry",
    "python-dotenv>=1.0.1",
    "send2trash>=1.8.3",
    "psutil>=6.1.0"
  );

  if (cfg.enablePlaywright) {
    lines.push("", "# Reliable Browser Automation (toggleable via VOX_ENABLE_PLAYWRIGHT)", "playwright>=1.50.0");
  } else {
    lines.push("", "# Optional Browser Automation (uncomment if enabling Playwright later)", "# playwright>=1.50.0");
  }

  if (cfg.osTarget === "windows") {
    lines.push("", "# Windows-specific window title activation helper", "pygetwindow>=0.0.9");
  } else {
    lines.push("", "# Windows-only optional helper (skip on macOS/Linux)", "# pygetwindow>=0.0.9; sys_platform == 'win32'");
  }

  return lines.join("\n") + "\n";
}

function buildEnvExample(cfg: ProjectConfig): string {
  return `# VoxControl Local Configuration (.env)
# Copy this file to .env to customize settings.

# AI Brain Provider: "ollama" (100% local, free, no API key) or "gemini" (cloud API)
VOX_LLM_PROVIDER="${cfg.llmProvider}"

# Local Ollama settings (used when VOX_LLM_PROVIDER=ollama)
OLLAMA_MODEL="${cfg.ollamaModel}"
OLLAMA_HOST="${cfg.ollamaHost}"

# Gemini API settings (only required when VOX_LLM_PROVIDER=gemini)
GEMINI_API_KEY="your_gemini_api_key_here"
GEMINI_MODEL="gemini-2.5-flash"

# Push-to-Talk hotkey: ctrl_r, f9, alt_r, f8, caps_lock
VOX_PTT_HOTKEY="${cfg.pttHotkey}"

# Voice language mode: bilingual_hi_en (Hindi + English), english_only, hindi_only
VOX_LANGUAGE_MODE="${cfg.voiceLanguage}"

# faster-whisper model:
#   For Hindi + English (bilingual): tiny, base, small (recommended), medium, large-v3-turbo
#   For English only: tiny.en, base.en, small.en, medium.en
VOX_WHISPER_MODEL="${cfg.whisperModel}"
VOX_WHISPER_DEVICE="${cfg.whisperDevice}"
VOX_WHISPER_COMPUTE_TYPE="${cfg.whisperDevice === "cuda" ? "float16" : "int8"}"

# Offline TTS settings
VOX_TTS_ENABLED="true"
VOX_TTS_RATE="${cfg.ttsRate}"

# Optional Playwright browser automation
VOX_ENABLE_PLAYWRIGHT="${cfg.enablePlaywright ? "true" : "false"}"
VOX_PLAYWRIGHT_HEADLESS="false"

# High-Risk Confirmation Mode: voice_or_keyboard, keyboard_only, voice_only
VOX_CONFIRMATION_MODE="${cfg.confirmationMode}"
VOX_CONFIRM_TIMEOUT="12.0"
`;
}

function buildInstallWindowsBat(cfg: ProjectConfig): string {
  const isOllama = cfg.llmProvider === "ollama";
  return `@echo off
setlocal enabledelayedexpansion
title VoxControl — Windows One-Click Installer

echo ======================================================================
echo   VoxControl — Windows Installer (${isOllama ? `Local Ollama: ${cfg.ollamaModel}` : "Gemini API"} + Hindi/English)
echo ======================================================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3.10+ was not found on your PATH.
    echo Please install Python from https://www.python.org/downloads/windows/
    echo IMPORTANT: Check "Add python.exe to PATH" during installation.
    pause
    exit /b 1
)

echo [1/4] Creating isolated virtual environment (.venv)...
python -m venv .venv
if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment.
    pause
    exit /b 1
)

call .venv\\Scripts\\activate.bat

echo [2/4] Upgrading pip and installing Python packages...
python -m pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Dependency installation failed. Check internet connection and retry.
    pause
    exit /b 1
)
${
  cfg.enablePlaywright
    ? `
echo [3/4] Installing Playwright Chromium browser engine...
playwright install chromium
`
    : `
echo [3/4] Playwright disabled in build config — skipping Chromium download.
`
}
echo [4/4] Setting up .env configuration file...
if not exist .env (
    copy .env.example .env >nul
    echo Created .env from .env.example.
)
${
  isOllama
    ? `
where ollama >nul 2>&1
if errorlevel 1 (
    echo.
    echo [NOTE] Ollama CLI was not detected yet.
    echo Install Ollama for Windows from https://ollama.com/download/windows
    echo Then run: ollama pull ${cfg.ollamaModel}
) else (
    echo.
    echo [Ollama] Pulling local model ${cfg.ollamaModel} (cached locally after first download)...
    ollama pull ${cfg.ollamaModel}
)

echo.
echo ======================================================================
echo   Installation Complete! (100%% Local Ollama Mode — No API Key Needed)
echo   NEXT STEPS:
echo     1. Ensure Ollama is running in your Windows system tray.
echo     2. Double-click run_voxcontrol.bat to launch the voice assistant.
echo     3. Optional: Double-click build_windows_exe.bat to build VoxControl.exe.
echo ======================================================================
`
    : `
echo.
echo ======================================================================
echo   Installation Complete!
echo   NEXT STEPS:
echo     1. Open .env in Notepad and paste your GEMINI_API_KEY.
echo     2. Double-click run_voxcontrol.bat to launch the voice assistant.
echo     3. Optional: Double-click build_windows_exe.bat to build VoxControl.exe.
echo ======================================================================
`
}pause
`;
}

function buildRunWindowsBat(cfg: ProjectConfig): string {
  const isOllama = cfg.llmProvider === "ollama";
  return `@echo off
setlocal
title VoxControl — Local Desktop Voice Assistant

if not exist .venv\\Scripts\\python.exe (
    echo [INFO] Virtual environment not found. Please run install_windows.bat first.
    pause
    exit /b 1
)

if not exist .env (
    copy .env.example .env >nul
${
  isOllama
    ? `    echo [INFO] Created .env configured for local Ollama (${cfg.ollamaModel}).`
    : `    echo [INFO] Created .env — please add your GEMINI_API_KEY in Notepad, save, and re-run.
    notepad .env
    exit /b 0`
}
)

echo Starting VoxControl (${isOllama ? `Local Ollama: ${cfg.ollamaModel}` : "Gemini API"})...
echo Hold your Push-to-Talk hotkey and speak in English, Hindi, or Hinglish.
echo Move your mouse cursor to any screen corner to abort immediately (FAILSAFE).
echo.
.venv\\Scripts\\python.exe main.py %*
pause
`;
}

function buildWindowsExeBat(cfg: ProjectConfig): string {
  return `@echo off
setlocal
title VoxControl — Build Standalone Windows .EXE

if not exist .venv\\Scripts\\python.exe (
    echo [ERROR] Run install_windows.bat first so .venv is ready.
    pause
    exit /b 1
)

call .venv\\Scripts\\activate.bat

echo [1/2] Installing PyInstaller inside .venv...
pip install --upgrade pyinstaller

echo [2/2] Packaging VoxControl.exe (bundles faster-whisper, sounddevice, pynput, pyttsx3, ${cfg.llmProvider})...
pyinstaller ^
  --noconfirm ^
  --onedir ^
  --console ^
  --name VoxControl ^
  --collect-all faster_whisper ^
  --collect-all ctranslate2 ^
  --collect-all sounddevice ^
  --collect-all tokenizers ^
  ${cfg.llmProvider === "ollama" ? "--collect-all ollama ^" : "--collect-all google.genai ^"}
  --hidden-import pyttsx3.drivers ^
  --hidden-import pyttsx3.drivers.sapi5 ^
  --hidden-import pynput.keyboard._win32 ^
  --hidden-import pynput.mouse._win32 ^
  main.py

if errorlevel 1 (
    echo [ERROR] PyInstaller build failed. See output above.
    pause
    exit /b 1
)

if exist .env (
    copy .env dist\\VoxControl\\.env >nul
)
if exist .env.example (
    copy .env.example dist\\VoxControl\\.env.example >nul
)

echo.
echo ======================================================================
echo   Build succeeded!
echo   Your Windows executable is ready at:
echo     dist\\VoxControl\\VoxControl.exe
echo   Keep .env next to VoxControl.exe and double-click to run.
echo ======================================================================
pause
`;
}

function buildReadmeMd(cfg: ProjectConfig): string {
  const isWin = cfg.osTarget === "windows";
  const isOllama = cfg.llmProvider === "ollama";
  return `# VoxControl — Local Desktop Voice Assistant (Hindi + English)

A modular, production-ready Python desktop voice assistant powered by:
- **faster-whisper** (local Push-to-Talk STT with VAD filtering + bilingual Hindi & English / Hinglish support)
- **${isOllama ? `Local Ollama (\`${cfg.ollamaModel}\`)` : "google-genai (`gemini-2.5-flash`)"}** multi-step Function Calling${isOllama ? " (100% offline, zero API key required)" : ""}
- **PyAutoGUI + pynput + pathlib + Playwright** (OS-aware execution layer)
- **pyttsx3** (offline zero-latency spoken confirmations)

## Project Structure

\`\`\`text
voxcontrol/
├── main.py               # CLI entrypoint, lifecycle orchestration, PTT event loop
├── config.py             # Typed AppConfig, .env loader, Ollama/Gemini & bilingual config
├── audio_io.py           # faster-whisper Hindi/English STT, PTT recorder, pyttsx3 worker
├── brain.py              # Dual-provider router: Local Ollama (native + JSON fallback) & Gemini
├── tools.py              # 19 OS-aware tools with docstrings for LLM tool schemas
├── safety.py             # Failsafe enforcement, risk policies, Hindi+English confirmation gate
├── requirements.txt      # Pinned Python dependencies
├── .env.example          # Environment configuration template${
    isWin
      ? `
├── install_windows.bat   # One-click Windows installer
├── run_voxcontrol.bat    # One-click Windows launcher
└── build_windows_exe.bat # Packages standalone dist\\VoxControl\\VoxControl.exe`
      : ""
  }
\`\`\`

## Quick Start${
    isWin
      ? ` (Windows 10 / 11)

1. ${isOllama ? `Install [Ollama for Windows](https://ollama.com/download/windows) and ensure it is running.` : "Prepare your Gemini API key."}
2. Extract this folder and double-click **\`install_windows.bat\`**${isOllama ? ` (automatically installs dependencies and pulls \`${cfg.ollamaModel}\`)` : ""}.
${isOllama ? "3. Double-click **`run_voxcontrol.bat`** to launch 100% offline Push-to-Talk voice mode." : "3. Open **`.env`** in Notepad, paste your `GEMINI_API_KEY`, then double-click **`run_voxcontrol.bat`**."}
4. *(Optional)* Double-click **\`build_windows_exe.bat\`** to compile a standalone \`dist\\VoxControl\\VoxControl.exe\`.`
      : ""
  }

### Manual Terminal Setup
1. Create and activate a Python 3.10+ virtual environment:
   \`\`\`bash
   python -m venv .venv
   source .venv/bin/activate   # Windows PowerShell: .\\.venv\\Scripts\\Activate.ps1
   pip install -r requirements.txt
   \`\`\`
${cfg.enablePlaywright ? "2. Install Playwright Chromium:\n   ```bash\n   playwright install chromium\n   ```\n" : ""}${
    isOllama
      ? `3. Pull your local Ollama model:
   \`\`\`bash
   ollama pull ${cfg.ollamaModel}
   cp .env.example .env
   \`\`\`
`
      : `3. Configure your API key:
   \`\`\`bash
   cp .env.example .env
   # Edit .env and set GEMINI_API_KEY
   \`\`\`
`
  }4. Validate setup and run a safe dry-run first:
   \`\`\`bash
   python main.py --config-check
   python main.py --dry-run --text-mode
   \`\`\`
5. Launch Push-to-Talk voice mode:
   \`\`\`bash
   python main.py
   \`\`\`
   Hold **${cfg.pttHotkey.toUpperCase()}**, speak naturally in **English, Hindi, or Hinglish**, and release. Move your mouse cursor to any corner of the screen at any time to trigger \`pyautogui.FAILSAFE\`.
`;
}

export function generatePythonProject(config: ProjectConfig): PythonFileArtifact[] {
  return [
    {
      path: "main.py",
      title: "Entrypoint & Event Loop",
      language: "python",
      summary:
        "Orchestrates startup validation, Push-to-Talk clip queue consumption, signal handling, dry-run/text modes, and graceful shutdown.",
      responsibilities: [
        "Enforces pyautogui.FAILSAFE = True on boot",
        "Supports --config-check, --dry-run, --text-mode, and --no-playwright flags",
        "Coordinates WhisperTranscriber, PushToTalkRecorder, AssistantBrain, and VoiceSpeaker",
      ],
      content: buildMainPy(),
    },
    {
      path: "brain.py",
      title: "Gemini 2.5 Flash Intent Router",
      language: "python",
      summary:
        "Maps natural speech into ordered multi-step Python tool calls using google-genai with automatic_function_calling disabled so SafetyGuard intercepts every call.",
      responsibilities: [
        "Injects OS platform & primary modifier key into Gemini system instructions",
        "Disables SDK automatic execution so High-Risk tools cannot bypass confirmation",
        "Maintains bounded multi-turn conversation history with max_tool_rounds protection",
      ],
      content: buildBrainPy(),
    },
    {
      path: "tools.py",
      title: "OS-Aware Desktop Execution Layer",
      language: "python",
      summary:
        "Implements 19 typed Python tools with detailed docstrings covering dictation, hotkeys, windowing, apps, files, toggleable Playwright, and terminal commands.",
      responsibilities: [
        "Auto-switches multiline/Unicode dictation to clipboard paste to preserve code formatting",
        "Resolves portable 'mod' key and friendly app names across Windows, macOS, and Linux",
        "Provides lazy-loaded Playwright Chromium automation with default-browser fallback",
      ],
      content: buildToolsPy(config),
    },
    {
      path: "safety.py",
      title: "Risk Guardrails & Confirmation Gate",
      language: "python",
      summary:
        "Classifies every tool into Safe vs. High-Risk (with dynamic escalation), blocks protected OS roots, runs voice/keyboard confirmation prompts, and writes JSONL audit logs.",
      responsibilities: [
        "Static + dynamic risk classification (e.g., escalates overwrite=True on existing files)",
        "Blocks mutation of /, /System, /etc, C:\\Windows, ~/.ssh, and ~/.aws",
        "Concurrent keyboard (Enter/Esc) + voice ('yes'/'no') confirmation with strict deny-on-timeout",
      ],
      content: buildSafetyPy(),
    },
    {
      path: "audio_io.py",
      title: "Local STT, PTT Recorder & Offline TTS",
      language: "python",
      summary:
        "Encapsulates local faster-whisper transcription, debounced pynput Push-to-Talk microphone capture, acoustic cue tones, and a dedicated thread-safe pyttsx3 speaker.",
      responsibilities: [
        "Auto-detects CUDA float16 vs. CPU int8 for faster-whisper with VAD filtering",
        "Debounces OS key-repeat events and rejects accidental sub-350ms hotkey taps",
        "Runs pyttsx3 on a dedicated worker thread to prevent COM/NSSpeechSynthesizer deadlocks",
      ],
      content: buildAudioIoPy(),
    },
    {
      path: "config.py",
      title: "Typed Configuration & OS Detection",
      language: "python",
      summary:
        "Immutable AppConfig dataclass backed by python-dotenv with cross-platform OS and modifier key helpers.",
      responsibilities: [
        "Centralizes Gemini model, PTT hotkey, Whisper size/device, and Playwright toggle",
        "Validates required GEMINI_API_KEY and audio bounds before startup",
        "Detects Windows, macOS, or Linux cleanly via sys.platform",
      ],
      content: buildConfigPy(config),
    },
    {
      path: "requirements.txt",
      title: "Python Dependencies",
      language: "text",
      summary:
        "Pinned runtime packages tailored to your selected OS target and Playwright configuration.",
      responsibilities: [
        "Uses modern google-genai SDK (not legacy google-generativeai)",
        "Conditionally includes Playwright and Windows window-management helpers",
      ],
      content: buildRequirementsTxt(config),
    },
    {
      path: ".env.example",
      title: "Environment Template",
      language: "env",
      summary:
        "Template for local configuration reflecting your current workbench hotkey, Whisper, Playwright, and confirmation settings.",
      responsibilities: [
        "Documents every supported VOX_* override variable",
        "Keeps secrets out of version control",
      ],
      content: buildEnvExample(config),
    },
    {
      path: "README.md",
      title: "Project Quick-Start Guide",
      language: "markdown",
      summary: "Concise repository overview and launch commands included in the downloadable project archive.",
      responsibilities: [
        "Documents folder structure, Windows one-click scripts, and safe dry-run testing commands",
      ],
      content: buildReadmeMd(config),
    },
    ...(config.osTarget === "windows"
      ? [
          {
            path: "install_windows.bat",
            title: "One-Click Windows Installer",
            language: "batch" as const,
            summary:
              "Double-click on Windows 10/11 to create .venv, install Python dependencies, set up Playwright Chromium, and initialize .env.",
            responsibilities: [
              "Verifies Python 3.10+ on PATH with clear install instructions if missing",
              "Creates .venv and installs requirements.txt automatically",
              "Copies .env.example to .env for quick API key entry",
            ],
            content: buildInstallWindowsBat(config),
          },
          {
            path: "run_voxcontrol.bat",
            title: "One-Click Windows Launcher",
            language: "batch" as const,
            summary:
              "Double-click launcher that activates .venv and starts VoxControl in bilingual Push-to-Talk voice mode.",
            responsibilities: [
              "Checks that install_windows.bat has been run",
              "Opens .env in Notepad automatically if missing",
              "Launches main.py cleanly and forwards optional CLI flags",
            ],
            content: buildRunWindowsBat(),
          },
          {
            path: "build_windows_exe.bat",
            title: "Build Standalone VoxControl.exe",
            language: "batch" as const,
            summary:
              "Compiles a native standalone dist\\VoxControl\\VoxControl.exe on your Windows PC using PyInstaller with CTranslate2, sounddevice, pynput, and SAPI5 drivers bundled.",
            responsibilities: [
              "Installs PyInstaller inside .venv automatically",
              "Bundles faster-whisper, CTranslate2, PortAudio/sounddevice, and Windows SAPI5 TTS drivers",
              "Outputs ready-to-run dist\\VoxControl\\VoxControl.exe alongside .env",
            ],
            content: buildWindowsExeBat(),
          },
        ]
      : []),
  ];
}
