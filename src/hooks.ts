import type { LobsterSightClient, Task, RecurrenceRule } from "./client.js";

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
  blocked: "Blocked",
};

const PRIORITY_LABELS: Record<number, string> = {
  0: "None",
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
};

const RECURRENCE_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  failing: "Failing",
};

function formatRecurrenceSummary(rule: RecurrenceRule): string {
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let summary = rule.interval === 1
    ? rule.frequency.charAt(0).toUpperCase() + rule.frequency.slice(1)
    : `Every ${rule.interval} ${rule.frequency.replace(/ly$/, "")}${rule.interval > 1 ? "s" : ""}`;
  if (rule.days_of_week?.length) {
    summary += ` on ${rule.days_of_week.map((d) => DAY_NAMES[d]).join(", ")}`;
  }
  if (rule.day_of_month) summary += ` on day ${rule.day_of_month}`;
  if (rule.time_of_day) summary += ` at ${rule.time_of_day}`;
  return summary;
}

function formatTaskCompact(t: Task): string {
  const priority = PRIORITY_LABELS[t.priority] ?? String(t.priority);
  const status = STATUS_LABELS[t.status] ?? t.status;
  const due = t.due_date ? ` | Due: ${t.due_date}` : "";
  return `- [${t.id}] (${status}, ${priority}) ${t.title}${due}`;
}

function formatRecurringTaskCompact(t: Task): string {
  const status = RECURRENCE_STATUS_LABELS[t.recurrence_status!] ?? t.recurrence_status;
  const schedule = t.recurrence_rule ? formatRecurrenceSummary(t.recurrence_rule) : "Unknown";
  const next = t.next_run_at ? ` | Next: ${t.next_run_at}` : "";
  return `- [${t.id}] (${status}) ${t.title} — ${schedule}${next}`;
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
        // Fetch open tasks and recurring tasks in parallel
        const [tasks, recurringTasks] = await Promise.all([
          client.listTasks({ open: true, limit: maxTasks }),
          client.listTasks({ recurring: true, limit: maxTasks }),
        ]);

        // Filter out recurring tasks from the regular list to avoid duplicates
        const nonRecurringTasks = tasks.filter((t) => !t.recurrence_rule);

        if (nonRecurringTasks.length === 0 && recurringTasks.length === 0) {
          return { prependContext: "[LobsterSight] No open tasks or cron jobs." };
        }

        // Split non-recurring tasks by ownership
        const agentTasks = agentProjectId
          ? nonRecurringTasks.filter((t) => t.project_id === agentProjectId)
          : nonRecurringTasks;
        const userTasks = agentProjectId
          ? nonRecurringTasks.filter((t) => t.project_id !== agentProjectId)
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
              ...renderTaskGroup("Blocked", agentTasks.filter((t) => t.status === "blocked")),
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
            ...renderTaskGroup("In Progress", nonRecurringTasks.filter((t) => t.status === "in_progress")),
          );
          sections.push(
            ...renderTaskGroup("Blocked", nonRecurringTasks.filter((t) => t.status === "blocked")),
          );
          sections.push(
            ...renderTaskGroup("To Do", nonRecurringTasks.filter((t) => t.status === "todo")),
          );
          sections.push(
            ...renderTaskGroup("Backlog", nonRecurringTasks.filter((t) => t.status === "backlog")),
          );
          sections.push(
            "*Tip: Set `agentProjectId` in plugin config to separate agent tasks from user tasks.*",
            "",
          );
        }

        // Recurring tasks section
        if (recurringTasks.length > 0) {
          const failing = recurringTasks.filter((t) => t.recurrence_status === "failing");
          const active = recurringTasks.filter((t) => t.recurrence_status === "active");
          const paused = recurringTasks.filter((t) => t.recurrence_status === "paused");

          sections.push("### Cron Jobs (managed schedules — do NOT duplicate as regular tasks)");
          sections.push(
            `${recurringTasks.length} cron job(s): ${active.length} active, ${failing.length} failing, ${paused.length} paused.`,
          );
          sections.push("Use `lobstersight_report_recurrence_run` to report run results. Use `lobstersight_update_recurrence` to pause/resume.");
          sections.push("");

          if (failing.length > 0) {
            sections.push("**Failing (needs attention):**");
            sections.push(...failing.map(formatRecurringTaskCompact));
            sections.push("");
          }
          if (active.length > 0) {
            sections.push("**Active:**");
            sections.push(...active.map(formatRecurringTaskCompact));
            sections.push("");
          }
          if (paused.length > 0) {
            sections.push("**Paused:**");
            sections.push(...paused.map(formatRecurringTaskCompact));
            sections.push("");
          }
        }

        sections.push(
          "Use the lobstersight tools to update task status, log progress, create new tasks, or manage cron jobs.",
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
