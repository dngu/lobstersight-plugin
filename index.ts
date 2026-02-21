import { LobsterSightClient } from "./src/client.js";
import { registerHooks } from "./src/hooks.js";
import {
  createListTasksTool,
  createGetTaskTool,
  createCreateTaskTool,
  createUpdateTaskTool,
  createAddEventTool,
  createListProjectsTool,
  createCreateProjectTool,
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
  on: (hookName: string, handler: (...args: unknown[]) => unknown, opts?: { priority?: number }) => void;
};

const DEFAULT_API_URL = "https://tkaqtttawnzvivnqytfh.supabase.co/functions/v1/agent-api";

export default function register(api: PluginApi) {
  const cfg = (api.pluginConfig ?? {}) as { apiUrl?: string; apiKey?: string };
  const apiUrl = cfg.apiUrl || DEFAULT_API_URL;

  if (!cfg.apiKey) {
    api.logger.warn(
      "LobsterSight plugin: missing apiKey in config. " +
        "Set plugins.entries.lobstersight.config.apiKey to enable.",
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
    createUpdateTaskTool(client),
    createAddEventTool(client),
  ];

  for (const tool of tools) {
    api.registerTool(tool, { optional: true });
  }

  // Register lifecycle hooks (open task injection)
  registerHooks(api, client);
}
