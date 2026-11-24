import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = "gemini-4-hydrogen";

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured in the server environment. Please check Settings > Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "type_text",
    description:
      "Type dictated prose or code into the currently focused window. Set use_clipboard_paste=true for multi-line code blocks or non-ASCII text.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: "The exact text or code to type." },
        press_enter: {
          type: Type.BOOLEAN,
          description: "Whether to press Enter after typing.",
        },
        use_clipboard_paste: {
          type: Type.BOOLEAN,
          description: "Use clipboard paste instead of character-by-character typing for code or multiline blocks.",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "press_hotkey",
    description:
      "Press a keyboard shortcut chord such as ['mod', 'n'] (new file) or ['mod', 's'] (save). Always use 'mod' for the OS primary modifier (Cmd on macOS, Ctrl on Windows/Linux).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        keys: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Ordered list of keys to hold simultaneously, e.g. ['mod', 'shift', 'p'].",
        },
      },
      required: ["keys"],
    },
  },
  {
    name: "press_key",
    description: "Press a single navigation, editing, or media key.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        key: { type: Type.STRING, description: "Key name such as enter, tab, escape, backspace, volumeup." },
        presses: { type: Type.INTEGER, description: "Number of times to press the key (1-25)." },
      },
      required: ["key"],
    },
  },
  {
    name: "launch_application",
    description: "Launch a desktop application by friendly name (e.g., vscode, chrome, terminal, notepad, slack, finder, calculator).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        app_name: { type: Type.STRING, description: "Application name or alias." },
        arguments: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Optional startup arguments such as a folder or file path.",
        },
      },
      required: ["app_name"],
    },
  },
  {
    name: "switch_window",
    description: "Focus an already running application window by name, or pass 'previous' to cycle windows.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        target: { type: Type.STRING, description: "Window title or app name, or 'previous'." },
      },
      required: ["target"],
    },
  },
  {
    name: "manage_window",
    description: "Control the active window via OS shortcuts: minimize, maximize, snap_left, snap_right, show_desktop, or close.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: "One of: minimize, maximize, snap_left, snap_right, show_desktop, close.",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "clipboard_action",
    description: "Copy, cut, paste, read, or write system clipboard text.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: "One of: copy, cut, paste, read, write." },
        text: { type: Type.STRING, description: "Text to write when action is 'write'." },
      },
      required: ["action"],
    },
  },
  {
    name: "list_directory",
    description: "List files and subdirectories inside a folder path.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "Directory path (supports ~), defaults to current folder." },
        max_entries: { type: Type.INTEGER, description: "Max items to return." },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description: "Read UTF-8 text contents from a local file.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "Path to the file to read." },
        max_chars: { type: Type.INTEGER, description: "Max characters to read." },
      },
      required: ["path"],
    },
  },
  {
    name: "create_or_write_file",
    description: "Create a file on disk and write UTF-8 text content. Set overwrite=true only when explicitly asked to replace an existing file.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "Target file path." },
        content: { type: Type.STRING, description: "Text or source code content to write." },
        overwrite: { type: Type.BOOLEAN, description: "Whether to overwrite if the file already exists." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "move_or_rename_path",
    description: "HIGH-RISK: Move or rename a file or folder on disk.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        source: { type: Type.STRING, description: "Existing source path." },
        destination: { type: Type.STRING, description: "Destination path." },
      },
      required: ["source", "destination"],
    },
  },
  {
    name: "delete_path",
    description: "HIGH-RISK: Delete a file or directory (prefers OS Trash/Recycle Bin when available).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "Target path to delete." },
        recursive: { type: Type.BOOLEAN, description: "Set true to delete a non-empty directory." },
      },
      required: ["path"],
    },
  },
  {
    name: "browser_open_url",
    description: "Open a URL in Playwright Chromium or the default system browser.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: "HTTP or HTTPS URL to open." },
        wait_for_load: { type: Type.BOOLEAN, description: "Wait for DOM load in Playwright." },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_search",
    description: "Search the web via Google, DuckDuckGo, GitHub, or YouTube.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Search query string." },
        engine: { type: Type.STRING, description: "google, duckduckgo, github, or youtube." },
      },
      required: ["query"],
    },
  },
  {
    name: "browser_page_action",
    description: "Interact with the active Playwright browser page using semantic selectors (click_text, fill_input, get_page_text, go_back, scroll_down, scroll_up, new_tab).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: "Page action to execute." },
        selector_or_text: { type: Type.STRING, description: "Visible link/button text or CSS selector." },
        value: { type: Type.STRING, description: "Value to type when action is fill_input." },
      },
      required: ["action"],
    },
  },
  {
    name: "run_shell_command",
    description: "HIGH-RISK: Run a shell/terminal command on the local operating system.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: { type: Type.STRING, description: "Shell command string to execute." },
        working_directory: { type: Type.STRING, description: "Optional working directory path." },
      },
      required: ["command"],
    },
  },
  {
    name: "system_power_action",
    description: "HIGH-RISK: Lock, sleep, restart, or shut down the computer.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: "One of: lock, sleep, restart, shutdown." },
      },
      required: ["action"],
    },
  },
  {
    name: "send_message_or_email",
    description: "HIGH-RISK: Draft or send an email or chat message to a recipient.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        recipient: { type: Type.STRING, description: "Email address or contact name." },
        subject: { type: Type.STRING, description: "Message subject line." },
        body: { type: Type.STRING, description: "Message body text." },
        channel: { type: Type.STRING, description: "Channel such as email or slack." },
      },
      required: ["recipient", "subject", "body"],
    },
  },
  {
    name: "get_system_info",
    description: "Read current OS name, local time, working directory, CPU/RAM usage, and battery status.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];

const HIGH_RISK_TOOLS = new Set([
  "delete_path",
  "move_or_rename_path",
  "run_shell_command",
  "system_power_action",
  "send_message_or_email",
]);

function classifyRisk(
  toolName: string,
  args: Record<string, unknown>
): { risk: "safe" | "high_risk"; reason: string } {
  if (HIGH_RISK_TOOLS.has(toolName)) {
    const reasons: Record<string, string> = {
      delete_path: "Destructive file system operation; requires explicit confirmation.",
      move_or_rename_path: "Mutates file paths on disk; requires explicit confirmation.",
      run_shell_command: "Executes arbitrary OS terminal commands; requires explicit confirmation.",
      system_power_action: "Changes machine power state (lock/sleep/restart/shutdown); requires explicit confirmation.",
      send_message_or_email: "Sends external communication on behalf of the user; requires explicit confirmation.",
    };
    return { risk: "high_risk", reason: reasons[toolName] ?? "High-risk system action." };
  }
  if (toolName === "create_or_write_file" && Boolean(args.overwrite)) {
    return {
      risk: "high_risk",
      reason: "Dynamic escalation: overwrite=True can replace an existing file on disk.",
    };
  }
  return {
    risk: "safe",
    reason: "Non-destructive desktop action permitted under pyautogui.FAILSAFE = True.",
  };
}

function buildDryRunOutput(
  toolName: string,
  args: Record<string, unknown>,
  osTarget: string
): Record<string, unknown> {
  switch (toolName) {
    case "launch_application":
      return { status: "ok", app: args.app_name, os: osTarget, detail: `Launched ${args.app_name} in foreground.` };
    case "press_hotkey":
      return {
        status: "ok",
        keys: args.keys,
        resolved_modifier: osTarget === "macos" ? "command" : "ctrl",
        detail: "Hotkey dispatched cleanly.",
      };
    case "type_text":
      return {
        status: "ok",
        characters: typeof args.text === "string" ? args.text.length : 0,
        mode: args.use_clipboard_paste ? "clipboard_paste" : "keystroke_stream",
      };
    case "list_directory":
      return {
        status: "ok",
        path: args.path ?? ".",
        entries: ["main.py (4.2 KB)", "notes.txt (1.1 KB)", "temp.log (84 KB)", "docs/ (dir)"],
      };
    case "read_file":
      return {
        status: "ok",
        path: args.path,
        preview: "# Example local file contents loaded successfully for dry-run inspection.",
      };
    case "get_system_info":
      return {
        status: "ok",
        os: osTarget,
        cwd: osTarget === "windows" ? "C:\\Users\\dev" : "/Users/dev",
        cpu_percent: 18.4,
        ram_percent: 42.1,
        battery_percent: 87,
      };
    case "run_shell_command":
      return {
        status: "ok",
        returncode: 0,
        stdout: `[Dry-Run] Command '${args.command}' executed cleanly with exit code 0.`,
      };
    case "delete_path":
      return {
        status: "ok",
        trashed: true,
        path: args.path,
        detail: "Moved item safely to OS Trash/Recycle Bin.",
      };
    default:
      return { status: "ok", tool: toolName, dry_run: true };
  }
}

function buildSystemInstruction(osTarget: string, playwrightEnabled: boolean): string {
  const modKey = osTarget === "macos" ? "command" : "ctrl";
  return [
    "You are VoxControl, a local desktop voice assistant running on the user's computer.",
    `Target operating system: ${osTarget}. Primary keyboard modifier: '${modKey}' (pass 'mod' to press_hotkey).`,
    `Playwright browser automation is ${playwrightEnabled ? "ENABLED" : "DISABLED (browser_open_url and browser_search fall back to the default browser)"}.`,
    "Language support: The user may speak naturally in English, Hindi (Devanagari script), or Hinglish (mixed Hindi + English, e.g. 'VS Code kholo aur nayi file banao' or 'Chrome mein YouTube search karo'). Always understand Hindi, Hinglish, and English commands accurately and map them to the exact OS tools.",
    "Decompose compound natural voice commands into clean, ordered tool calls (for example, launching an app, pressing ['mod', 'n'] for a new file, then calling type_text with use_clipboard_paste=true for multiline code or Devanagari text).",
    "Never invent hardcoded (x, y) mouse coordinates. Always prefer OS hotkeys, app launchers, and semantic Playwright actions.",
    "For high-risk actions (deleting files, running shell commands, power actions, sending emails), still emit the exact tool call so the local SafetyGuard confirmation gate can intercept and ask the user for explicit approval.",
    "After all required tools succeed or if an action is denied by the user, reply with a crisp, natural spoken confirmation in 1-2 short sentences matching the user's language (English or simple Hindi/Hinglish) suitable for offline TTS.",
  ].join("\n");
}

interface SimStep {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  risk: "safe" | "high_risk";
  riskReason: string;
  status: "executed" | "awaiting_confirmation" | "approved" | "denied";
  simulatedOutput?: Record<string, unknown>;
}

function formatApiError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : "Failed to run Gemini intent simulation.";
  try {
    const parsed = JSON.parse(raw);
    const code = Number(parsed?.error?.code) || 500;
    const msg = typeof parsed?.error?.message === "string" ? parsed.error.message : raw;
    return { status: code >= 400 && code < 600 ? code : 500, message: msg };
  } catch {
    return { status: 500, message: raw };
  }
}

async function generateWithRetry(
  ai: GoogleGenAI,
  contents: Array<Record<string, unknown>>,
  systemInstruction: string,
  activeTools: FunctionDeclaration[]
) {
  let lastError: unknown;
  const delays = [400, 1000, 2000];
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await ai.models.generateContent({
        model: MODEL_NAME,
        contents: contents as unknown as string,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: activeTools }],
        },
      });
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : "";
      const isTransient = msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("429");
      if (!isTransient || attempt === delays.length) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
  throw lastError;
}

async function runSimulationLoop(
  ai: GoogleGenAI,
  contents: Array<Record<string, unknown>>,
  osTarget: string,
  playwrightEnabled: boolean,
  existingSteps: SimStep[] = []
) {
  const steps: SimStep[] = [...existingSteps];
  const activeTools = playwrightEnabled
    ? TOOL_DECLARATIONS
    : TOOL_DECLARATIONS.filter((t) => t.name !== "browser_page_action");

  const systemInstruction = buildSystemInstruction(osTarget, playwrightEnabled);
  let turnCount = 0;
  const maxTurns = 6;

  while (turnCount < maxTurns) {
    turnCount += 1;
    const response = await generateWithRetry(ai, contents, systemInstruction, activeTools);

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) {
      contents.push(modelContent as unknown as Record<string, unknown>);
    }

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) {
      return {
        steps,
        finalSpeech: (response.text ?? "Done.").trim(),
        pendingStepId: null,
        conversationState: contents,
        modelUsed: MODEL_NAME,
      };
    }

    const functionResponseParts: Array<Record<string, unknown>> = [];

    for (let idx = 0; idx < calls.length; idx += 1) {
      const call = calls[idx];
      const toolName = call.name ?? "unknown_tool";
      const args = (call.args ?? {}) as Record<string, unknown>;
      const { risk, reason } = classifyRisk(toolName, args);
      const stepId = `step_${Date.now()}_${turnCount}_${idx}`;

      if (risk === "high_risk") {
        // Record remaining calls in this turn as awaiting or pause immediately at the first high-risk tool
        steps.push({
          id: stepId,
          toolName,
          args,
          risk,
          riskReason: reason,
          status: "awaiting_confirmation",
        });

        // If any earlier safe calls in the same model turn already produced responses, attach them when resuming
        // Store pending metadata cleanly in conversationState via our response payload
        return {
          steps,
          finalSpeech: null,
          pendingStepId: stepId,
          conversationState: contents,
          modelUsed: MODEL_NAME,
          _pendingBatch: {
            priorResponses: functionResponseParts,
            remainingCalls: calls.slice(idx).map((c, rIdx) => ({
              id: c.id ?? `${stepId}_r${rIdx}`,
              name: c.name ?? "unknown_tool",
              args: (c.args ?? {}) as Record<string, unknown>,
            })),
          },
        };
      }

      const output = buildDryRunOutput(toolName, args, osTarget);
      steps.push({
        id: stepId,
        toolName,
        args,
        risk,
        riskReason: reason,
        status: "executed",
        simulatedOutput: output,
      });

      functionResponseParts.push({
        functionResponse: {
          ...(call.id ? { id: call.id } : {}),
          name: toolName,
          response: output,
        },
      });
    }

    contents.push({
      role: "user",
      parts: functionResponseParts,
    });
  }

  return {
    steps,
    finalSpeech: "Reached maximum dry-run tool turns for this command.",
    pendingStepId: null,
    conversationState: contents,
    modelUsed: MODEL_NAME,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", model: MODEL_NAME });
  });

  app.post("/api/simulate", async (req, res) => {
    try {
      const { utterance, osTarget = "macos", playwrightEnabled = true } = req.body ?? {};
      if (!utterance || typeof utterance !== "string" || !utterance.trim()) {
        return res.status(400).json({ error: "Please provide a spoken or typed command." });
      }

      const ai = getAiClient();
      const contents: Array<Record<string, unknown>> = [
        { role: "user", parts: [{ text: utterance.trim() }] },
      ];

      const result = await runSimulationLoop(ai, contents, String(osTarget), Boolean(playwrightEnabled));
      return res.json(result);
    } catch (error) {
      const { status, message } = formatApiError(error);
      return res.status(status).json({ error: message });
    }
  });

  app.post("/api/simulate/resume", async (req, res) => {
    try {
      const {
        decision,
        osTarget = "macos",
        playwrightEnabled = true,
        conversationState = [],
        steps = [],
        pendingStepId,
        pendingBatch,
      } = req.body ?? {};

      if (decision !== "approve" && decision !== "deny") {
        return res.status(400).json({ error: "Decision must be 'approve' or 'deny'." });
      }

      const ai = getAiClient();
      const updatedSteps: SimStep[] = (steps as SimStep[]).map((s) => ({ ...s }));
      const contents: Array<Record<string, unknown>> = Array.isArray(conversationState)
        ? [...conversationState]
        : [];

      const priorResponses: Array<Record<string, unknown>> =
        pendingBatch?.priorResponses ? [...pendingBatch.priorResponses] : [];
      const remainingCalls: Array<{ id?: string; name: string; args: Record<string, unknown> }> =
        pendingBatch?.remainingCalls ? [...pendingBatch.remainingCalls] : [];

      const activeCall = remainingCalls[0];
      const targetStep = updatedSteps.find((s) => s.id === pendingStepId);

      if (targetStep && activeCall) {
        if (decision === "approve") {
          const output = buildDryRunOutput(activeCall.name, activeCall.args, String(osTarget));
          targetStep.status = "approved";
          targetStep.simulatedOutput = output;
          priorResponses.push({
            functionResponse: {
              ...(activeCall.id ? { id: activeCall.id } : {}),
              name: activeCall.name,
              response: output,
            },
          });
        } else {
          const deniedOutput = {
            status: "denied_by_user",
            reason: "User explicitly declined the High-Risk confirmation prompt.",
          };
          targetStep.status = "denied";
          targetStep.simulatedOutput = deniedOutput;
          priorResponses.push({
            functionResponse: {
              ...(activeCall.id ? { id: activeCall.id } : {}),
              name: activeCall.name,
              response: deniedOutput,
            },
          });
        }

        // Process any remaining calls that were emitted in the same model turn
        for (let i = 1; i < remainingCalls.length; i += 1) {
          const nextCall = remainingCalls[i];
          const { risk, reason } = classifyRisk(nextCall.name, nextCall.args);
          const nextStepId = `step_${Date.now()}_resume_${i}`;

          if (risk === "high_risk") {
            updatedSteps.push({
              id: nextStepId,
              toolName: nextCall.name,
              args: nextCall.args,
              risk,
              riskReason: reason,
              status: "awaiting_confirmation",
            });
            return res.json({
              steps: updatedSteps,
              finalSpeech: null,
              pendingStepId: nextStepId,
              conversationState: contents,
              modelUsed: MODEL_NAME,
              _pendingBatch: {
                priorResponses,
                remainingCalls: remainingCalls.slice(i),
              },
            });
          }

          const out = buildDryRunOutput(nextCall.name, nextCall.args, String(osTarget));
          updatedSteps.push({
            id: nextStepId,
            toolName: nextCall.name,
            args: nextCall.args,
            risk,
            riskReason: reason,
            status: "executed",
            simulatedOutput: out,
          });
          priorResponses.push({
            functionResponse: {
              ...(nextCall.id ? { id: nextCall.id } : {}),
              name: nextCall.name,
              response: out,
            },
          });
        }
      }

      if (priorResponses.length > 0) {
        contents.push({
          role: "user",
          parts: priorResponses,
        });
      }

      const result = await runSimulationLoop(
        ai,
        contents,
        String(osTarget),
        Boolean(playwrightEnabled),
        updatedSteps
      );
      return res.json(result);
    } catch (error) {
      const { status, message } = formatApiError(error);
      return res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VoxControl workbench server listening on http://localhost:${PORT}`);
  });
}

startServer();
