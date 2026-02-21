import { LobsterSightClient } from "./src/client.js";
import { registerHooks } from "./src/hooks.js";
import {
  createListTasksTool,
  createGetTaskTool,
  createCreateTaskTool,
  createUpdateTaskTool,
  createAddEventTool,
  createListProjectsTool,
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

export default function register(api: PluginApi) {
  const cfg = (api.pluginConfig ?? {}) as { apiUrl?: string; apiKey?: string };

  if (!cfg.apiUrl || !cfg.apiKey) {
    api.logger.warn(
      "LobsterSight plugin: missing apiUrl or apiKey in config. " +
        "Set plugins.entries.lobstersight.config.apiUrl and .apiKey to enable.",
    );
    return;
  }

  const client = new LobsterSightClient(cfg.apiUrl, cfg.apiKey);

  api.logger.info(`LobsterSight plugin connected to ${cfg.apiUrl}`);

  // Register agent tools
  const tools = [
    createListProjectsTool(client),
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
