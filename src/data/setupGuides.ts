import type { OsTarget, ProjectConfig } from "../types/assistant";

export interface SetupStep {
  number: string;
  title: string;
  description: string;
  command: string;
  note?: string;
}

export interface TroubleshootingItem {
  symptom: string;
  cause: string;
  resolution: string;
}

export interface OsSetupGuide {
  osLabel: string;
  shellLabel: string;
  prerequisitesSummary: string;
  steps: SetupStep[];
  permissionsChecklist: string[];
  troubleshooting: TroubleshootingItem[];
}

export function getSetupGuide(os: OsTarget, config: ProjectConfig): OsSetupGuide {
  const pwStep: SetupStep | null = config.enablePlaywright
    ? {
        number: "04",
        title: "Install Playwright Chromium Binary",
        description:
          "Downloads the isolated Chromium engine used by browser_open_url and browser_page_action without relying on brittle screen coordinates.",
        command: "playwright install chromium",
        note: "Skip or disable at runtime with --no-playwright if you only want default OS browser URL opening.",
      }
    : null;

  const envStepNum = pwStep ? "05" : "04";
  const testStepNum = pwStep ? "06" : "05";

  if (os === "macos") {
    return {
      osLabel: "macOS (Apple Silicon & Intel)",
      shellLabel: "zsh",
      prerequisitesSummary: "Homebrew, Python 3.10+, PortAudio, FFmpeg, and macOS Accessibility/Microphone permissions.",
      steps: [
        {
          number: "01",
          title: "Install System Audio & Media Libraries",
          description: "Install PortAudio (required by sounddevice) and FFmpeg via Homebrew.",
          command: "brew install portaudio ffmpeg",
          note: "On Apple Silicon Macs, ensure Homebrew's /opt/homebrew/bin is on your PATH.",
        },
        {
          number: "02",
          title: "Create Isolated Virtual Environment",
          description: "Unzip the downloaded voxcontrol folder, enter it, and create a Python 3.10+ virtual environment.",
          command: "cd voxcontrol\npython3 -m venv .venv\nsource .venv/bin/activate\npython -m pip install --upgrade pip",
        },
        {
          number: "03",
          title: "Install Python Dependencies",
          description: "Install google-genai, faster-whisper, sounddevice, pynput, PyAutoGUI, and pyttsx3.",
          command: "pip install -r requirements.txt",
        },
        ...(pwStep ? [pwStep] : []),
        {
          number: envStepNum,
          title: "Configure GEMINI_API_KEY",
          description: "Copy the environment template and export your Gemini API key (or store it inside .env).",
          command: 'cp .env.example .env\nexport GEMINI_API_KEY="your_actual_gemini_api_key"\npython main.py --config-check',
          note: "Never commit .env to Git. You can also place GEMINI_API_KEY directly inside .env.",
        },
        {
          number: testStepNum,
          title: "Run Safe Dry-Run & First Voice Command",
          description: "First test intent routing safely in dry-run mode without moving windows, then launch Push-to-Talk.",
          command: "python main.py --dry-run --text-mode\n# Try: 'Open VS Code, create a new file, and type a Python hello world script'\n\n# When verified, launch live Push-to-Talk mode:\npython main.py",
          note: `Hold [${config.pttHotkey.toUpperCase()}] while speaking, then release. Move cursor to any screen corner to abort via PyAutoGUI FAILSAFE.`,
        },
      ],
      permissionsChecklist: [
        "System Settings -> Privacy & Security -> Microphone: enable Terminal / iTerm2 / VS Code.",
        "System Settings -> Privacy & Security -> Accessibility: enable your terminal app so pynput and PyAutoGUI can synthesize keys.",
        "System Settings -> Privacy & Security -> Input Monitoring: enable your terminal app so the global Push-to-Talk hotkey works when other apps are focused.",
      ],
      troubleshooting: [
        {
          symptom: "pynput hotkey is ignored when another app is focused",
          cause: "macOS blocks global keystroke monitoring until Input Monitoring is granted.",
          resolution: "Add your terminal app in System Settings -> Privacy & Security -> Input Monitoring, then fully restart the terminal.",
        },
        {
          symptom: "OSError: PortAudio library not found",
          cause: "sounddevice cannot locate libportaudio.dylib.",
          resolution: "Run 'brew install portaudio' and reinstall sounddevice inside the venv ('pip install --force-reinstall sounddevice').",
        },
        {
          symptom: "pyttsx3 raises objc / AppKit errors on macOS",
          cause: "pyobjc-core mismatch on newer macOS versions.",
          resolution: "Run 'pip install --upgrade pyobjc' inside your virtual environment.",
        },
      ],
    };
  }

  if (os === "windows") {
    return {
      osLabel: "Windows 10 / 11",
      shellLabel: "PowerShell / .bat",
      prerequisitesSummary:
        "Python 3.10+ (with 'Add python.exe to PATH' checked), optional FFmpeg, and the included 1-click Windows .bat scripts (including VoxControl.exe builder).",
      steps: [
        {
          number: "01",
          title: "Download & Extract the Windows Package",
          description:
            "Click 'Download Project (.zip)' in the top right while Target OS is Windows, then right-click voxcontrol-windows.zip -> Extract All.",
          command: "# Inside the extracted voxcontrol/ folder you will find:\n#   install_windows.bat    (1-click installer)\n#   run_voxcontrol.bat     (1-click launcher)\n#   build_windows_exe.bat  (builds standalone VoxControl.exe)",
        },
        {
          number: "02",
          title: "One-Click Install (or Manual PowerShell)",
          description:
            "Double-click install_windows.bat to automatically create .venv, install faster-whisper (Hindi + English) and dependencies, and create .env. Or run manually in PowerShell:",
          command: "cd voxcontrol\npython -m venv .venv\n.\\.venv\\Scripts\\Activate.ps1\npython -m pip install --upgrade pip\npip install -r requirements.txt" + (config.enablePlaywright ? "\nplaywright install chromium" : ""),
          note: "PortAudio DLLs are bundled inside sounddevice on Windows. Optional FFmpeg: winget install --id Gyan.FFmpeg -e",
        },
        {
          number: "03",
          title: "Add Your GEMINI_API_KEY",
          description:
            "Open the created .env file in Notepad, replace your_gemini_api_key_here with your Gemini API key, save, and verify configuration:",
          command: "notepad .env\n.\\.venv\\Scripts\\python.exe main.py --config-check",
          note: "Never share or commit your .env file. Hindi + English bilingual mode uses multilingual Whisper models (small / base / medium).",
        },
        {
          number: "04",
          title: "Launch Voice Assistant (English, Hindi & Hinglish)",
          description:
            "Double-click run_voxcontrol.bat (or test safely first with --dry-run --text-mode).",
          command: "# Safe dry-run test first (no OS actions executed):\n.\\.venv\\Scripts\\python.exe main.py --dry-run --text-mode\n\n# Live Push-to-Talk mode (or double-click run_voxcontrol.bat):\n.\\.venv\\Scripts\\python.exe main.py",
          note: `Hold [${config.pttHotkey.toUpperCase()}] while speaking in English, Hindi, or Hinglish (e.g. "VS Code kholo aur nayi file banao"), then release. Flick mouse to top-left corner to abort via PyAutoGUI FAILSAFE.`,
        },
        {
          number: "05",
          title: "Optional: Build Standalone VoxControl.exe",
          description:
            "Need a native .exe launcher? Double-click build_windows_exe.bat on your Windows PC to compile dist\\VoxControl\\VoxControl.exe with PyInstaller.",
          command: ".\\build_windows_exe.bat\n# Output executable: dist\\VoxControl\\VoxControl.exe",
          note: "Keep your .env file in the same dist\\VoxControl\\ folder as VoxControl.exe. First voice command downloads the Whisper model weights once and caches them locally.",
        },
      ],
      permissionsChecklist: [
        "Settings -> Privacy & security -> Microphone: ensure 'Let desktop apps access your microphone' is turned ON.",
        "For Hindi + English spoken feedback (pyttsx3): open Windows Settings -> Time & language -> Speech -> Add voices -> install 'Hindi (India)' (Hemant/Kalpana) or 'English (India)' (Heera/Ravi).",
        "If automating an elevated Administrator window, launch PowerShell or run_voxcontrol.bat as Administrator (Windows UIPI blocks non-elevated keystrokes to elevated apps).",
        "If using CUDA for faster-whisper, ensure NVIDIA drivers and cuBLAS/cuDNN libraries match CTranslate2 requirements (or leave VOX_WHISPER_DEVICE=cpu for fast int8 CPU inference).",
      ],
      troubleshooting: [
        {
          symptom: "Hindi words are transcribed poorly or forced into English",
          cause: "An English-only (.en) Whisper model is configured or the tiny model is too small for Hindi accents.",
          resolution: "Set VOX_LANGUAGE_MODE=bilingual_hi_en and VOX_WHISPER_MODEL=small (or medium / large-v3-turbo on GPU) in .env.",
        },
        {
          symptom: "Cannot type into Task Manager or Administrator terminal",
          cause: "Windows User Interface Privilege Isolation (UIPI) blocks standard processes from sending input to elevated windows.",
          resolution: "Right-click run_voxcontrol.bat -> Run as administrator when you need to control elevated apps.",
        },
        {
          symptom: "cublas64_12.dll not found when loading faster-whisper",
          cause: "CUDA mode selected without matching CUDA 12 runtime DLLs.",
          resolution: "Set VOX_WHISPER_DEVICE=cpu and VOX_WHISPER_COMPUTE_TYPE=int8 in .env (small int8 runs smoothly on modern Windows CPUs).",
        },
        {
          symptom: "pyttsx3 produces no audio or cannot speak Hindi text",
          cause: "Windows SAPI5 Hindi/Indian voice pack is not installed or muted in Volume Mixer.",
          resolution: "Install Hindi (India) or English (India) under Windows Settings -> Time & language -> Speech.",
        },
      ],
    };
  }

  // Linux
  return {
    osLabel: "Linux (Ubuntu / Debian / Arch)",
    shellLabel: "bash",
    prerequisitesSummary: "Python 3.10+, PortAudio, FFmpeg, espeak-ng (for pyttsx3), xclip, and wmctrl/xdotool on X11.",
    steps: [
      {
        number: "01",
        title: "Install System Audio, TTS & X11 Window Tools",
        description: "Install PortAudio, FFmpeg, espeak-ng (offline TTS backend), xclip (clipboard), and wmctrl/xdotool.",
        command: "sudo apt update && sudo apt install -y \\\n  portaudio19-dev ffmpeg espeak-ng xclip wmctrl xdotool python3-tk python3-dev",
        note: "On Arch Linux: sudo pacman -S portaudio ffmpeg espeak-ng xclip wmctrl xdotool tk",
      },
      {
        number: "02",
        title: "Create Isolated Virtual Environment",
        description: "Unzip voxcontrol.zip and initialize an isolated virtual environment.",
        command: "cd voxcontrol\npython3 -m venv .venv\nsource .venv/bin/activate\npython -m pip install --upgrade pip",
      },
      {
        number: "03",
        title: "Install Python Dependencies",
        description: "Install google-genai, faster-whisper, sounddevice, pynput, PyAutoGUI, and pyttsx3.",
        command: "pip install -r requirements.txt",
      },
      ...(pwStep ? [pwStep] : []),
      {
        number: envStepNum,
        title: "Configure GEMINI_API_KEY",
        description: "Create your .env file and export GEMINI_API_KEY, then verify configuration.",
        command: 'cp .env.example .env\nexport GEMINI_API_KEY="your_actual_gemini_api_key"\npython main.py --config-check',
      },
      {
        number: testStepNum,
        title: "Run Safe Dry-Run & First Voice Command",
        description: "Validate tool mapping safely first, then switch to live Push-to-Talk mode.",
        command: "python main.py --dry-run --text-mode\n# Try: 'List the files in my home folder'\n\n# Launch live Push-to-Talk mode:\npython main.py",
        note: `Hold [${config.pttHotkey.toUpperCase()}] while speaking, then release.`,
      },
    ],
    permissionsChecklist: [
      "X11 sessions work out of the box with pynput, PyAutoGUI, wmctrl, and xdotool.",
      "Wayland note: Wayland intentionally isolates global hotkeys and synthetic input for security. On GNOME/KDE Wayland, either switch to an Xorg/X11 session at login or enable XWayland/ydotool permissions.",
      "Verify your microphone is recognized: python -c \"import sounddevice as sd; print(sd.query_devices())\"",
    ],
    troubleshooting: [
      {
        symptom: "pynput or PyAutoGUI fails silently under Wayland",
        cause: "Wayland compositors restrict XTest synthetic input and global keyboard hooks.",
        resolution: "Log into an X11/Xorg session for full desktop automation, or run VoxControl with --text-mode for file/shell/Playwright tasks.",
      },
      {
        symptom: "pyttsx3 error: libespeak.so.1 not found",
        cause: "espeak-ng system speech backend is not installed.",
        resolution: "Run 'sudo apt install -y espeak-ng' (Debian/Ubuntu) or 'sudo pacman -S espeak-ng' (Arch).",
      },
      {
        symptom: "pyperclip raises PyperclipException: could not find a copy/paste mechanism",
        cause: "Missing xclip or xsel clipboard utility.",
        resolution: "Run 'sudo apt install -y xclip' (or 'wl-clipboard' on Wayland).",
      },
    ],
  };
}
