import type { LobsterSightClient, Task } from "./client.js";

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
};

const PRIORITY_LABELS: Record<number, string> = {
  0: "None",
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
};

function formatTaskCompact(t: Task): string {
  const priority = PRIORITY_LABELS[t.priority] ?? String(t.priority);
  const status = STATUS_LABELS[t.status] ?? t.status;
  const due = t.due_date ? ` | Due: ${t.due_date}` : "";
  return `- [${t.id.slice(0, 8)}] (${status}, ${priority}) ${t.title}${due}`;
}

function renderTaskGroup(label: string, tasks: Task[]): string[] {
  if (tasks.length === 0) return [];
  return [`**${label} (${tasks.length}):**`, ...tasks.map(formatTaskCompact), ""];
}

type PluginConfig = {
  apiUrl?: string;
  apiKey?: string;
  injectOpenTasks?: boolean;
  maxInjectedTasks?: number;
  agentProjectId?: string;
};

/**
 * Registers the before_prompt_build hook that injects open tasks into the
 * agent's context, separated by project ownership.
 */
export function registerHooks(
  api: {
    on: (hookName: string, handler: (...args: unknown[]) => unknown, opts?: { priority?: number }) => void;
    logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
    pluginConfig?: Record<string, unknown>;
  },
  client: LobsterSightClient,
) {
  const cfg = (api.pluginConfig ?? {}) as PluginConfig;
  const inject = cfg.injectOpenTasks !== false; // default true
  const maxTasks = cfg.maxInjectedTasks ?? 20;
  const agentProjectId = cfg.agentProjectId;

  if (!inject) {
    api.logger.info("Open task injection disabled by config");
    return;
  }

  api.on(
    "before_prompt_build",
    async () => {
      try {
        const tasks = await client.listTasks({ open: true, limit: maxTasks });

        if (tasks.length === 0) {
          return { prependContext: "[LobsterSight] No open tasks across any project." };
        }

        // Split tasks by ownership
        const agentTasks = agentProjectId
          ? tasks.filter((t) => t.project_id === agentProjectId)
          : tasks;
        const userTasks = agentProjectId
          ? tasks.filter((t) => t.project_id !== agentProjectId)
          : [];

        const sections: string[] = ["## LobsterSight — Task Board", ""];

        // Agent's own tasks — these are the ones it should proactively work on
        if (agentProjectId) {
          if (agentTasks.length > 0) {
            sections.push(`### Your Tasks (agent project)`);
            sections.push("These are assigned to you. Proactively pick up and work on these.");
            sections.push("");
            sections.push(
              ...renderTaskGroup("In Progress", agentTasks.filter((t) => t.status === "in_progress")),
            );
            sections.push(
              ...renderTaskGroup("To Do", agentTasks.filter((t) => t.status === "todo")),
            );
            sections.push(
              ...renderTaskGroup("Backlog", agentTasks.filter((t) => t.status === "backlog")),
            );
          } else {
            sections.push("### Your Tasks (agent project)");
            sections.push("No open tasks in your project. Check if the user needs help with theirs.");
            sections.push("");
          }

          // User's tasks — read-only unless asked
          if (userTasks.length > 0) {
            sections.push(`### User's Tasks (${userTasks.length} open)`);
            sections.push(
              "These belong to the user. Only act on them when the user explicitly asks.",
            );
            sections.push("");
            sections.push(...userTasks.map(formatTaskCompact));
            sections.push("");
          }
        } else {
          // No agentProjectId configured — show all tasks without ownership split
          sections.push(
            ...renderTaskGroup("In Progress", tasks.filter((t) => t.status === "in_progress")),
          );
          sections.push(
            ...renderTaskGroup("To Do", tasks.filter((t) => t.status === "todo")),
          );
          sections.push(
            ...renderTaskGroup("Backlog", tasks.filter((t) => t.status === "backlog")),
          );
          sections.push(
            "*Tip: Set `agentProjectId` in plugin config to separate agent tasks from user tasks.*",
            "",
          );
        }

        sections.push(
          "Use the lobstersight tools to update task status, log progress, or create new tasks.",
        );

        return { prependContext: sections.join("\n") };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        api.logger.warn(`Failed to fetch open tasks: ${msg}`);
        return undefined;
      }
    },
    { priority: 50 },
  );
}
