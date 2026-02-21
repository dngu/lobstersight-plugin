import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import * as p from "@clack/prompts";
import { LobsterSightClient } from "./client.js";

const CONFIG_PATH = path.join(os.homedir(), ".openclaw", "openclaw.json");

async function readConfig(): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
}

async function writeConfig(config: Record<string, unknown>): Promise<void> {
  // Back up before writing
  try {
    await fs.copyFile(CONFIG_PATH, CONFIG_PATH + ".bak");
  } catch {
    // ignore if no existing file
  }
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

function getPluginConfig(config: Record<string, unknown>): Record<string, unknown> {
  const plugins = (config.plugins ?? {}) as Record<string, unknown>;
  const entries = (plugins.entries ?? {}) as Record<string, unknown>;
  const ls = (entries.lobstersight ?? {}) as Record<string, unknown>;
  return (ls.config ?? {}) as Record<string, unknown>;
}

function setPluginConfig(
  config: Record<string, unknown>,
  pluginCfg: Record<string, unknown>,
): Record<string, unknown> {
  const plugins = { ...((config.plugins ?? {}) as Record<string, unknown>) };
  const entries = { ...((plugins.entries ?? {}) as Record<string, unknown>) };
  entries.lobstersight = {
    ...((entries.lobstersight ?? {}) as Record<string, unknown>),
    enabled: true,
    config: pluginCfg,
  };
  plugins.entries = entries;
  return { ...config, plugins };
}

export async function runSetup(): Promise<void> {
  p.intro("LobsterSight Setup");

  // Step 1: API Key
  p.note(
    [
      "You need an API key from LobsterSight.",
      "",
      "1. Go to your LobsterSight dashboard",
      "2. Open Settings (gear icon)",
      "3. Click 'Create API Key'",
      "4. Copy the key (starts with ls_)",
    ].join("\n"),
    "Getting your API key",
  );

  const apiKey = await p.text({
    message: "Paste your LobsterSight API key",
    placeholder: "ls_...",
    validate: (value) => {
      if (!value?.trim()) return "API key is required";
      if (!value.trim().startsWith("ls_")) return "Key should start with ls_";
      return undefined;
    },
  });

  if (p.isCancel(apiKey)) {
    p.cancel("Setup cancelled.");
    return;
  }

  // Step 2: Test connection
  const spinner = p.spinner();
  spinner.start("Testing connection...");

  const client = new LobsterSightClient(
    "https://www.lobstersight.com/agent-api",
    apiKey.trim(),
  );

  let projects;
  try {
    projects = await client.listProjects();
    spinner.stop("Connected successfully!");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    spinner.stop(`Connection failed: ${msg}`);
    p.cancel("Fix the issue and try again.");
    return;
  }

  // Step 3: Agent project setup
  const agentProjects = projects.filter((proj) => proj.actor_type === "agent");

  let agentProjectId: string | undefined;

  if (agentProjects.length > 0) {
    const choice = await p.select({
      message: "Select your agent project (or create a new one)",
      options: [
        ...agentProjects.map((proj) => ({
          value: proj.id,
          label: proj.name,
          hint: proj.description ?? undefined,
        })),
        { value: "__new__", label: "Create a new agent project" },
        { value: "__skip__", label: "Skip for now" },
      ],
    });

    if (p.isCancel(choice)) {
      p.cancel("Setup cancelled.");
      return;
    }

    if (choice === "__new__") {
      agentProjectId = await createAgentProject(client);
    } else if (choice !== "__skip__") {
      agentProjectId = choice;
    }
  } else {
    const shouldCreate = await p.confirm({
      message: "No agent projects found. Create one now?",
      initialValue: true,
    });

    if (p.isCancel(shouldCreate)) {
      p.cancel("Setup cancelled.");
      return;
    }

    if (shouldCreate) {
      agentProjectId = await createAgentProject(client);
    }
  }

  // Step 4: Save to config
  spinner.start("Saving configuration...");

  try {
    const config = await readConfig();
    const pluginCfg: Record<string, unknown> = {
      ...getPluginConfig(config),
      apiKey: apiKey.trim(),
    };
    if (agentProjectId) {
      pluginCfg.agentProjectId = agentProjectId;
    }
    const updated = setPluginConfig(config, pluginCfg);
    await writeConfig(updated);
    spinner.stop("Configuration saved!");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    spinner.stop(`Failed to save config: ${msg}`);
    p.cancel("You may need to add the config manually.");
    return;
  }

  p.outro("LobsterSight is ready! Restart OpenClaw to activate.");
}

async function createAgentProject(client: LobsterSightClient): Promise<string | undefined> {
  const name = await p.text({
    message: "Project name",
    placeholder: "Agent Tasks",
    initialValue: "Agent Tasks",
    validate: (value) => (value?.trim() ? undefined : "Name is required"),
  });

  if (p.isCancel(name)) return undefined;

  const description = await p.text({
    message: "Project description (optional)",
    placeholder: "Tasks managed by the OpenClaw agent",
    initialValue: "Tasks managed by the OpenClaw agent",
  });

  if (p.isCancel(description)) return undefined;

  try {
    const project = await client.createProject({
      name: name.trim(),
      description: description?.trim() || undefined,
      actor_type: "agent",
    });
    p.log.success(`Created project: ${project.name} (${project.id})`);
    return project.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    p.log.error(`Failed to create project: ${msg}`);
    return undefined;
  }
}
