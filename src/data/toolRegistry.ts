import type { ToolSpec } from "../types/assistant";

export const TOOL_REGISTRY: ToolSpec[] = [
  {
    name: "type_text",
    signature: "type_text(text: str, press_enter: bool = False, use_clipboard_paste: bool = False) -> dict",
    category: "Input & Dictation",
    risk: "safe",
    description:
      "Types dictated prose or code into the currently focused window. Automatically uses clipboard paste for multi-line blocks or non-ASCII text to preserve indentation and Unicode characters.",
    osNotes: {
      windows: "pyautogui.write for short ASCII; Ctrl+V via pyperclip for multiline/Unicode",
      macos: "pyautogui.write for short ASCII; Command+V via pyperclip for multiline/Unicode",
      linux: "pyautogui.write via X11/xdotool; Ctrl+V via xclip/xsel + pyperclip",
    },
    guardrail: "Enforces pyautogui.FAILSAFE = True; restores previous clipboard contents after paste.",
    exampleVoice: "Type a Python hello world function and press enter",
  },
  {
    name: "press_hotkey",
    signature: "press_hotkey(keys: list[str]) -> dict",
    category: "Keyboard & Windowing",
    risk: "safe",
    description:
      "Executes a keyboard shortcut chord such as ['mod', 'n'] or ['mod', 'shift', 'p']. Maps portable 'mod' token to Command on macOS and Ctrl on Windows/Linux.",
    osNotes: {
      windows: "Maps 'mod' -> 'ctrl', 'super' -> 'win'",
      macos: "Maps 'mod' -> 'command', 'alt' -> 'option'",
      linux: "Maps 'mod' -> 'ctrl', 'super' -> 'win'",
    },
    guardrail: "Blocks raw system shutdown key combos; enforces pyautogui.FAILSAFE = True.",
    exampleVoice: "Create a new file and open the command palette",
  },
  {
    name: "press_key",
    signature: "press_key(key: str, presses: int = 1) -> dict",
    category: "Keyboard & Windowing",
    risk: "safe",
    description:
      "Presses a single navigation, editing, or media key (enter, tab, escape, backspace, pagedown, volumeup) up to a bounded count.",
    osNotes: {
      windows: "Direct Win32 virtual key synthesis via pyautogui",
      macos: "Quartz CGEvent key synthesis (requires Accessibility permission)",
      linux: "XTest key synthesis via python-xlib",
    },
    guardrail: "Caps repeat count at 25 presses per call to prevent runaway input loops.",
    exampleVoice: "Press escape twice",
  },
  {
    name: "launch_application",
    signature: "launch_application(app_name: str, arguments: list[str] | None = None) -> dict",
    category: "Applications",
    risk: "safe",
    description:
      "Launches desktop applications by friendly name (VS Code, Chrome, Terminal, Slack, Spotify, Notes) using OS-native launchers rather than screen coordinates.",
    osNotes: {
      windows: "Alias table + shutil.which / os.startfile detached process",
      macos: "open -a <Bundle Name> with alias resolution",
      linux: "shutil.which / gtk-launch / xdg-open with start_new_session=True",
    },
    guardrail: "Uses argument arrays (shell=False) to prevent command injection.",
    exampleVoice: "Open VS Code",
  },
  {
    name: "switch_window",
    signature: "switch_window(target: str) -> dict",
    category: "Keyboard & Windowing",
    risk: "safe",
    description:
      "Brings an already-running application or matching window title to the foreground, or cycles to the previous window when target is 'previous'.",
    osNotes: {
      windows: "pygetwindow title match with Alt+Tab fallback",
      macos: "AppleScript 'tell application ... to activate' or Cmd+Tab",
      linux: "wmctrl -a / xdotool windowactivate with Alt+Tab fallback",
    },
    guardrail: "No hardcoded screen coordinates; sanitizes target string before OS dispatch.",
    exampleVoice: "Switch to Google Chrome",
  },
  {
    name: "manage_window",
    signature: "manage_window(action: str) -> dict",
    category: "Keyboard & Windowing",
    risk: "safe",
    description:
      "Controls active window geometry using OS-native window manager shortcuts: minimize, maximize, snap_left, snap_right, show_desktop, or close.",
    osNotes: {
      windows: "Win+Up / Win+Down / Win+Left / Win+Right / Win+D / Alt+F4",
      macos: "Ctrl+Cmd+F / Cmd+M / Cmd+W / Cmd+H",
      linux: "Super+Up / Super+Left / Super+Right / Alt+F4",
    },
    guardrail: "Dispatches standard OS shortcuts only; never force-kills processes.",
    exampleVoice: "Snap this window to the left half of the screen",
  },
  {
    name: "clipboard_action",
    signature: "clipboard_action(action: str, text: str | None = None) -> dict",
    category: "Input & Dictation",
    risk: "safe",
    description:
      "Copies the active selection, cuts, pastes, reads the current clipboard text, or writes text directly to the system clipboard.",
    osNotes: {
      windows: "pyperclip Win32 clipboard + Ctrl+C/X/V",
      macos: "pbcopy/pbpaste via pyperclip + Cmd+C/X/V",
      linux: "xclip/xsel/wl-clipboard via pyperclip + Ctrl+C/X/V",
    },
    guardrail: "Truncates clipboard readback to 4,000 characters to protect prompt context.",
    exampleVoice: "Copy what I have selected and summarize it",
  },
  {
    name: "list_directory",
    signature: "list_directory(path: str = '.', max_entries: int = 50) -> dict",
    category: "File System",
    risk: "safe",
    description:
      "Lists files and folders inside a given directory with sizes and entry types using pathlib.",
    osNotes: {
      windows: "Expands ~ and environment paths via pathlib.Path",
      macos: "Expands ~ and resolves symlinks safely",
      linux: "Expands ~ and resolves symlinks safely",
    },
    guardrail: "Read-only; bounded to max_entries to prevent huge directory dumps.",
    exampleVoice: "List the files in my Downloads folder",
  },
  {
    name: "read_file",
    signature: "read_file(path: str, max_chars: int = 4000) -> dict",
    category: "File System",
    risk: "safe",
    description:
      "Reads UTF-8 text content from a local file so the assistant can inspect, summarize, or answer questions about it.",
    osNotes: {
      windows: "UTF-8 read with replacement fallback for encoding safety",
      macos: "UTF-8 read with replacement fallback for encoding safety",
      linux: "UTF-8 read with replacement fallback for encoding safety",
    },
    guardrail: "Read-only; blocks reading private key folders (~/.ssh, ~/.aws) by default.",
    exampleVoice: "Read my notes.txt file on the desktop",
  },
  {
    name: "create_or_write_file",
    signature: "create_or_write_file(path: str, content: str, overwrite: bool = False) -> dict",
    category: "File System",
    risk: "safe",
    dynamicEscalation: "Escalates to High-Risk automatically if the target file already exists and overwrite=True.",
    description:
      "Creates a new text or source-code file on disk and writes the requested content, creating missing parent directories automatically.",
    osNotes: {
      windows: "Atomic UTF-8 write via pathlib.Path",
      macos: "Atomic UTF-8 write via pathlib.Path",
      linux: "Atomic UTF-8 write via pathlib.Path",
    },
    guardrail: "Refuses overwriting existing files unless overwrite=True AND confirmed by user.",
    exampleVoice: "Create hello.py on my desktop with a hello world script",
  },
  {
    name: "move_or_rename_path",
    signature: "move_or_rename_path(source: str, destination: str) -> dict",
    category: "File System",
    risk: "high_risk",
    description:
      "Moves or renames a file or directory to a new location on disk using shutil.move.",
    osNotes: {
      windows: "Path validation against C:\\Windows and Program Files",
      macos: "Path validation against /System, /Library, /usr",
      linux: "Path validation against /, /etc, /usr, /var, /bin",
    },
    guardrail: "Requires explicit voice ('yes') or keyboard (Enter) confirmation before execution.",
    exampleVoice: "Move draft.md from Desktop to Documents/archive",
  },
  {
    name: "delete_path",
    signature: "delete_path(path: str, recursive: bool = False) -> dict",
    category: "File System",
    risk: "high_risk",
    description:
      "Deletes a file or directory. Prefers moving items to the OS Trash/Recycle Bin via send2trash before falling back to permanent unlink.",
    osNotes: {
      windows: "Sends to Recycle Bin via send2trash; blocks system roots",
      macos: "Sends to Finder Trash via send2trash; blocks /System and /",
      linux: "Sends to Freedesktop Trash via send2trash; blocks / and /etc",
    },
    guardrail: "Mandatory High-Risk confirmation + ProtectedPathError blocklist for OS/root folders.",
    exampleVoice: "Delete old_backup.zip from my Downloads folder",
  },
  {
    name: "browser_open_url",
    signature: "browser_open_url(url: str, wait_for_load: bool = True) -> dict",
    category: "Browser Automation",
    risk: "safe",
    description:
      "Navigates to a web URL in a Playwright-managed Chromium session (when enabled) or falls back cleanly to the system default browser.",
    osNotes: {
      windows: "Playwright Chromium or webbrowser.open fallback",
      macos: "Playwright Chromium or webbrowser.open fallback",
      linux: "Playwright Chromium or xdg-open via webbrowser",
    },
    guardrail: "Validates http:// or https:// scheme; rejects javascript: and file:// URIs.",
    exampleVoice: "Open docs.python.org in the browser",
  },
  {
    name: "browser_search",
    signature: "browser_search(query: str, engine: str = 'google') -> dict",
    category: "Browser Automation",
    risk: "safe",
    description:
      "Performs a web search using Google, DuckDuckGo, GitHub, or YouTube without brittle screen coordinates.",
    osNotes: {
      windows: "URL-encoded search dispatch via Playwright or default browser",
      macos: "URL-encoded search dispatch via Playwright or default browser",
      linux: "URL-encoded search dispatch via Playwright or default browser",
    },
    guardrail: "Read-only navigation; URL parameters safely encoded via urllib.parse.",
    exampleVoice: "Search Google for faster-whisper int8 quantization benchmarks",
  },
  {
    name: "browser_page_action",
    signature: "browser_page_action(action: str, selector_or_text: str = '', value: str = '') -> dict",
    category: "Browser Automation",
    risk: "safe",
    description:
      "Interacts with the active Playwright browser page using semantic text/role locators (click_text, fill_input, get_page_text, go_back, scroll_down, scroll_up, new_tab).",
    osNotes: {
      windows: "Cross-platform Playwright DOM automation (no screen coordinates)",
      macos: "Cross-platform Playwright DOM automation (no screen coordinates)",
      linux: "Cross-platform Playwright DOM automation (no screen coordinates)",
    },
    guardrail: "Read/navigate actions stay Safe; form submissions for messaging belong in send_message_or_email.",
    exampleVoice: "Click the Documentation link and scroll down",
  },
  {
    name: "run_shell_command",
    signature: "run_shell_command(command: str, working_directory: str | None = None) -> dict",
    category: "System & Terminal",
    risk: "high_risk",
    description:
      "Executes a terminal command in the system shell with a strict timeout and captures truncated stdout/stderr output.",
    osNotes: {
      windows: "PowerShell / cmd via subprocess.run with timeout",
      macos: "zsh / sh via subprocess.run with timeout",
      linux: "bash / sh via subprocess.run with timeout",
    },
    guardrail: "Always classified High-Risk; requires explicit confirmation and enforces 20s timeout.",
    exampleVoice: "Run git status in my project folder",
  },
  {
    name: "system_power_action",
    signature: "system_power_action(action: str) -> dict",
    category: "System & Terminal",
    risk: "high_risk",
    description:
      "Locks the screen, puts the machine to sleep, restarts, or shuts down the operating system.",
    osNotes: {
      windows: "rundll32 lock / shutdown /r /t 5 / shutdown /s /t 5",
      macos: "pmset sleepnow / osascript System Events restart or shut down",
      linux: "loginctl lock-session / systemctl suspend, reboot, poweroff",
    },
    guardrail: "Always High-Risk; requires explicit confirmation before invoking OS power APIs.",
    exampleVoice: "Put my computer to sleep",
  },
  {
    name: "send_message_or_email",
    signature: "send_message_or_email(recipient: str, subject: str, body: str, channel: str = 'email') -> dict",
    category: "Applications",
    risk: "high_risk",
    description:
      "Prepares and dispatches an outbound message or opens a pre-filled mailto/messaging draft with explicit user review before sending.",
    osNotes: {
      windows: "Opens mailto draft or triggers confirmed send hotkey",
      macos: "AppleScript Mail draft / mailto URI with confirmation gate",
      linux: "xdg-open mailto draft with explicit confirmation gate",
    },
    guardrail: "Always High-Risk; displays full recipient, subject, and body summary before confirmation.",
    exampleVoice: "Send an email to Alex saying the release build passed",
  },
  {
    name: "get_system_info",
    signature: "get_system_info() -> dict",
    category: "System & Terminal",
    risk: "safe",
    description:
      "Returns the current operating system, local date/time, working directory, CPU/RAM usage, and battery status if available.",
    osNotes: {
      windows: "platform + psutil metrics",
      macos: "platform + psutil metrics",
      linux: "platform + psutil metrics",
    },
    guardrail: "Strictly read-only telemetry with zero side effects.",
    exampleVoice: "What is my battery percentage and current working directory?",
  },
];
