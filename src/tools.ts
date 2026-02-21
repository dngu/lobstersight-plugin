import { Type } from "@sinclair/typebox";
import type { LobsterSightClient } from "./client.js";

const PRIORITY_LABELS: Record<number, string> = {
  0: "None",
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
};

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
};

function formatTask(t: { id: string; title: string; status: string; priority: number; description?: string | null; project_id?: string | null; due_date?: string | null; created_at: string }): string {
  const parts = [
    `[${t.id.slice(0, 8)}] ${t.title}`,
    `  Status: ${STATUS_LABELS[t.status] ?? t.status} | Priority: ${PRIORITY_LABELS[t.priority] ?? t.priority}`,
  ];
  if (t.description) parts.push(`  Description: ${t.description}`);
  if (t.due_date) parts.push(`  Due: ${t.due_date}`);
  if (t.project_id) parts.push(`  Project: ${t.project_id}`);
  parts.push(`  Created: ${t.created_at}`);
  return parts.join("\n");
}

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

export function createListTasksTool(client: LobsterSightClient) {
  return {
    name: "lobstersight_list_tasks",
    label: "LobsterSight: List Tasks",
    description:
      "List tasks from LobsterSight. Filter by status, project, or open/closed. Returns task IDs, titles, statuses, and priorities.",
    parameters: Type.Object({
      status: Type.Optional(
        Type.Union([
          Type.Literal("backlog"),
          Type.Literal("todo"),
          Type.Literal("in_progress"),
          Type.Literal("done"),
          Type.Literal("canceled"),
        ], { description: "Filter by task status" }),
      ),
      project_id: Type.Optional(Type.String({ description: "Filter by project UUID" })),
      open: Type.Optional(Type.Boolean({ description: "If true, show only incomplete tasks (not done/canceled)" })),
      limit: Type.Optional(Type.Number({ description: "Maximum number of tasks to return", minimum: 1, maximum: 100 })),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const tasks = await client.listTasks({
        status: params.status as string | undefined,
        project_id: params.project_id as string | undefined,
        open: params.open as boolean | undefined,
        limit: params.limit as number | undefined,
      });

      if (tasks.length === 0) {
        return text("No tasks found matching the filters.");
      }

      const lines = [`Found ${tasks.length} task(s):`, "", ...tasks.map(formatTask)];
      return text(lines.join("\n"));
    },
  };
}

export function createGetTaskTool(client: LobsterSightClient) {
  return {
    name: "lobstersight_get_task",
    label: "LobsterSight: Get Task",
    description:
      "Get full details of a single task from LobsterSight by its ID, including labels and metadata.",
    parameters: Type.Object({
      task_id: Type.String({ description: "The UUID of the task to retrieve" }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const taskId = params.task_id as string;
      if (!taskId) throw new Error("task_id is required");

      const task = await client.getTask(taskId);
      const parts = [
        `Task: ${task.title}`,
        `ID: ${task.id}`,
        `Status: ${STATUS_LABELS[task.status] ?? task.status}`,
        `Priority: ${PRIORITY_LABELS[task.priority] ?? task.priority}`,
      ];
      if (task.description) parts.push(`Description: ${task.description}`);
      if (task.project_id) parts.push(`Project: ${task.project_id}`);
      if (task.parent_id) parts.push(`Parent Task: ${task.parent_id}`);
      if (task.start_date) parts.push(`Start: ${task.start_date}`);
      if (task.due_date) parts.push(`Due: ${task.due_date}`);
      if (task.deadline_date) parts.push(`Deadline: ${task.deadline_date}`);
      if (task.estimate_minutes) parts.push(`Estimate: ${task.estimate_minutes} min`);
      if (task.actual_minutes) parts.push(`Actual: ${task.actual_minutes} min`);
      if (task.completed_at) parts.push(`Completed: ${task.completed_at}`);
      if (task.task_labels?.length) {
        const labels = task.task_labels.map((tl) => tl.labels.name).join(", ");
        parts.push(`Labels: ${labels}`);
      }
      if (task.metadata && Object.keys(task.metadata).length > 0) {
        parts.push(`Metadata: ${JSON.stringify(task.metadata)}`);
      }
      parts.push(`Created: ${task.created_at}`);
      parts.push(`Updated: ${task.updated_at}`);

      return text(parts.join("\n"));
    },
  };
}

export function createCreateTaskTool(client: LobsterSightClient) {
  return {
    name: "lobstersight_create_task",
    label: "LobsterSight: Create Task",
    description:
      "Create a new task in LobsterSight. Specify a title and optionally a description, status, priority, project, due date, and time estimate.",
    parameters: Type.Object({
      title: Type.String({ description: "Task title (required)" }),
      description: Type.Optional(Type.String({ description: "Detailed description of the task" })),
      status: Type.Optional(
        Type.Union([
          Type.Literal("backlog"),
          Type.Literal("todo"),
          Type.Literal("in_progress"),
          Type.Literal("done"),
          Type.Literal("canceled"),
        ], { description: "Initial status (default: backlog)" }),
      ),
      priority: Type.Optional(
        Type.Number({ description: "Priority: 0=None, 1=Low, 2=Medium, 3=High, 4=Urgent", minimum: 0, maximum: 4 }),
      ),
      project_id: Type.Optional(Type.String({ description: "Project UUID to assign this task to" })),
      parent_id: Type.Optional(Type.String({ description: "Parent task UUID for subtasks" })),
      due_date: Type.Optional(Type.String({ description: "Due date (YYYY-MM-DD)" })),
      estimate_minutes: Type.Optional(Type.Number({ description: "Estimated time in minutes", minimum: 0 })),
      metadata: Type.Optional(Type.Unknown({ description: "Arbitrary key-value metadata" })),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const title = params.title as string;
      if (!title?.trim()) throw new Error("title is required");

      const task = await client.createTask({
        title: title.trim(),
        description: params.description as string | undefined,
        status: params.status as string | undefined,
        priority: params.priority as number | undefined,
        project_id: params.project_id as string | undefined,
        parent_id: params.parent_id as string | undefined,
        due_date: params.due_date as string | undefined,
        estimate_minutes: params.estimate_minutes as number | undefined,
        metadata: params.metadata as Record<string, unknown> | undefined,
      });

      return text(
        [
          `Task created successfully.`,
          `ID: ${task.id}`,
          `Title: ${task.title}`,
          `Status: ${STATUS_LABELS[task.status] ?? task.status}`,
          `Priority: ${PRIORITY_LABELS[task.priority] ?? task.priority}`,
        ].join("\n"),
      );
    },
  };
}

export function createUpdateTaskTool(client: LobsterSightClient) {
  return {
    name: "lobstersight_update_task",
    label: "LobsterSight: Update Task",
    description:
      "Update an existing task in LobsterSight. Change its status, priority, description, time tracking, or other fields. Status changes and priority changes are automatically logged in the activity timeline.",
    parameters: Type.Object({
      task_id: Type.String({ description: "The UUID of the task to update" }),
      title: Type.Optional(Type.String({ description: "New title" })),
      description: Type.Optional(Type.String({ description: "New description" })),
      status: Type.Optional(
        Type.Union([
          Type.Literal("backlog"),
          Type.Literal("todo"),
          Type.Literal("in_progress"),
          Type.Literal("done"),
          Type.Literal("canceled"),
        ], { description: "New status" }),
      ),
      priority: Type.Optional(
        Type.Number({ description: "New priority: 0=None, 1=Low, 2=Medium, 3=High, 4=Urgent", minimum: 0, maximum: 4 }),
      ),
      actual_minutes: Type.Optional(Type.Number({ description: "Actual time spent in minutes", minimum: 0 })),
      due_date: Type.Optional(Type.String({ description: "New due date (YYYY-MM-DD) or empty string to clear" })),
      estimate_minutes: Type.Optional(Type.Number({ description: "New estimate in minutes", minimum: 0 })),
      metadata: Type.Optional(Type.Unknown({ description: "Metadata to merge" })),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const taskId = params.task_id as string;
      if (!taskId) throw new Error("task_id is required");

      const update: Record<string, unknown> = {};
      if (params.title !== undefined) update.title = params.title;
      if (params.description !== undefined) update.description = params.description;
      if (params.status !== undefined) update.status = params.status;
      if (params.priority !== undefined) update.priority = params.priority;
      if (params.actual_minutes !== undefined) update.actual_minutes = params.actual_minutes;
      if (params.due_date !== undefined) update.due_date = params.due_date || null;
      if (params.estimate_minutes !== undefined) update.estimate_minutes = params.estimate_minutes;
      if (params.metadata !== undefined) update.metadata = params.metadata;

      if (Object.keys(update).length === 0) {
        return text("No fields to update. Provide at least one field to change.");
      }

      const task = await client.updateTask(taskId, update);

      return text(
        [
          `Task updated successfully.`,
          `ID: ${task.id}`,
          `Title: ${task.title}`,
          `Status: ${STATUS_LABELS[task.status] ?? task.status}`,
          `Priority: ${PRIORITY_LABELS[task.priority] ?? task.priority}`,
        ].join("\n"),
      );
    },
  };
}

export function createAddEventTool(client: LobsterSightClient) {
  return {
    name: "lobstersight_add_event",
    label: "LobsterSight: Add Event",
    description:
      "Add a comment or progress note to a task's activity timeline in LobsterSight. Use this to log progress updates, blockers, decisions, or any context about the task.",
    parameters: Type.Object({
      task_id: Type.String({ description: "The UUID of the task" }),
      content: Type.String({ description: "The comment or progress note text" }),
      event_type: Type.Optional(Type.String({ description: "Event type (default: comment). Examples: comment, progress, blocker, decision" })),
      metadata: Type.Optional(Type.Unknown({ description: "Optional metadata for the event" })),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const taskId = params.task_id as string;
      const content = params.content as string;
      if (!taskId) throw new Error("task_id is required");
      if (!content?.trim()) throw new Error("content is required");

      const event = await client.addTaskEvent(taskId, {
        event_type: (params.event_type as string) || "comment",
        content: content.trim(),
        metadata: params.metadata as Record<string, unknown> | undefined,
      });

      return text(`Event logged on task ${taskId.slice(0, 8)}:\n  Type: ${event.event_type}\n  Content: ${event.content}`);
    },
  };
}

export function createListProjectsTool(client: LobsterSightClient) {
  return {
    name: "lobstersight_list_projects",
    label: "LobsterSight: List Projects",
    description:
      "List all projects in LobsterSight. Each project has an actor_type indicating whether it belongs to the agent or the human user. Use this to discover project IDs before creating or filtering tasks.",
    parameters: Type.Object({
      actor_type: Type.Optional(
        Type.Union([Type.Literal("human"), Type.Literal("agent")], {
          description: "Filter by owner type: 'agent' for the agent's own projects, 'human' for the user's personal projects",
        }),
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const projects = await client.listProjects({
        actor_type: params.actor_type as "human" | "agent" | undefined,
      });

      if (projects.length === 0) {
        return text("No projects found.");
      }

      const lines = [`Found ${projects.length} project(s):`, ""];
      for (const p of projects) {
        const owner = p.actor_type === "agent" ? "[Agent]" : "[Human]";
        const desc = p.description ? ` — ${p.description}` : "";
        lines.push(`${owner} ${p.name}${desc}`);
        lines.push(`  ID: ${p.id}`);
        if (p.color) lines.push(`  Color: ${p.color}`);
        lines.push(`  Created: ${p.created_at}`);
        lines.push("");
      }

      return text(lines.join("\n"));
    },
  };
}

export function createCreateProjectTool(client: LobsterSightClient) {
  return {
    name: "lobstersight_create_project",
    label: "LobsterSight: Create Project",
    description:
      "Create a new project in LobsterSight. Projects group related tasks together. Set actor_type to 'agent' for your own projects or 'human' for the user's projects (only when asked).",
    parameters: Type.Object({
      name: Type.String({ description: "Project name (required)" }),
      description: Type.Optional(Type.String({ description: "Project description" })),
      color: Type.Optional(Type.String({ description: "Hex color for the project (e.g. #3b82f6)" })),
      actor_type: Type.Optional(
        Type.Union([Type.Literal("human"), Type.Literal("agent")], {
          description: "Owner type: 'agent' (default) for agent-owned projects, 'human' for user projects",
        }),
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const name = params.name as string;
      if (!name?.trim()) throw new Error("name is required");

      const project = await client.createProject({
        name: name.trim(),
        description: params.description as string | undefined,
        color: params.color as string | undefined,
        actor_type: (params.actor_type as "human" | "agent") || "agent",
      });

      const owner = project.actor_type === "agent" ? "[Agent]" : "[Human]";
      return text(
        [
          `Project created successfully.`,
          `${owner} ${project.name}`,
          `ID: ${project.id}`,
          project.description ? `Description: ${project.description}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    },
  };
}
