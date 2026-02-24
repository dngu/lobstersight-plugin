import { LobsterSightClient } from "./src/client.js";
import { registerHooks } from "./src/hooks.js";
import {
  createListTasksTool,
  createGetTaskTool,
  createCreateTaskTool,
  createCreateRecurringTaskTool,
  createUpdateTaskTool,
  createAddEventTool,
  createListProjectsTool,
  createCreateProjectTool,
  createListRecurringTasksTool,
  createReportRecurrenceRunTool,
  createUpdateRecurrenceTool,
} from "./src/tools.js";

type PluginApi = {
  id: string;
  name: string;
  config: unknown;
  pluginConfig?: Record<string, unknown>;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  registerTool: (tool: unknown, opts?: { optional?: boolean }) => void;
  registerCli: (
    registrar: (ctx: { program: unknown; config: unknown; logger: unknown }) => void,
    opts?: { commands?: string[] },
  ) => void;
  on: (hookName: string, handler: (...args: unknown[]) => unknown, opts?: { priority?: number }) => void;
};

const DEFAULT_API_URL = "https://tkaqtttawnzvivnqytfh.supabase.co/functions/v1/agent-api";

export default function register(api: PluginApi) {
  // Always register the CLI setup command, even without an API key
  api.registerCli(
    ({ program }) => {
      const cmd = program as { command: (name: string) => unknown };
      const ls = cmd.command("lobstersight") as {
        description: (desc: string) => unknown;
        command: (name: string) => unknown;
      };
      ls.description("LobsterSight task tracking plugin");

      const setup = ls.command("setup") as {
        description: (desc: string) => unknown;
        action: (fn: () => Promise<void>) => void;
      };
      setup.description("Interactive setup wizard for LobsterSight");
      setup.action(async () => {
        const { runSetup } = await import("./src/setup.js");
        await runSetup();
      });
    },
    { commands: ["lobstersight"] },
  );

  const cfg = (api.pluginConfig ?? {}) as { apiUrl?: string; apiKey?: string };
  const apiUrl = cfg.apiUrl || DEFAULT_API_URL;

  if (!cfg.apiKey) {
    api.logger.warn(
      "LobsterSight plugin: missing apiKey. Run `openclaw lobstersight setup` to configure.",
    );
    return;
  }

  const client = new LobsterSightClient(apiUrl, cfg.apiKey);

  api.logger.info(`LobsterSight plugin connected to ${apiUrl}`);

  // Register agent tools
  const tools = [
    createListProjectsTool(client),
    createCreateProjectTool(client),
    createListTasksTool(client),
    createGetTaskTool(client),
    createCreateTaskTool(client),
    createCreateRecurringTaskTool(client),
    createUpdateTaskTool(client),
    createAddEventTool(client),
    createListRecurringTasksTool(client),
    createReportRecurrenceRunTool(client),
    createUpdateRecurrenceTool(client),
  ];

  for (const tool of tools) {
    api.registerTool(tool, { optional: true });
  }

  // Register lifecycle hooks (open task injection)
  registerHooks(api, client);
}
