---
name: lobstersight
description: Track and manage tasks via LobsterSight. View open work, create tasks, update progress, and log activity on the shared task board.
metadata:
  openclaw:
    emoji: "\U0001F99E"
    always: true
user-invocable: true
disable-model-invocation: false
---

# LobsterSight — Task Tracking

You have access to a shared LobsterSight task board with the `lobstersight_*` tools.

## Project ownership

Tasks are organized into projects. Each project belongs to either the **agent** or the **human user**.

- **Agent project**: Your tasks. You own these and should proactively pick them up, track progress, and mark them done. When you create tasks for yourself, always assign them to your agent project.
- **User projects**: The user's personal tasks. You can see them for context, but **only create, update, or modify tasks in user projects when the user explicitly asks you to**. Never proactively change a user's tasks.

Use `lobstersight_list_projects` to discover which projects exist and who owns them (check the `actor_type` field).

## Tools

| Tool | Purpose |
|------|---------|
| `lobstersight_list_projects` | Discover projects and their ownership |
| `lobstersight_list_tasks` | List tasks with filters (status, project, open) |
| `lobstersight_get_task` | Get full task details by ID |
| `lobstersight_create_task` | Create a new task |
| `lobstersight_update_task` | Update status, priority, description, time |
| `lobstersight_add_event` | Log a comment or progress note |

## When to use these tools

- **Starting a conversation**: Your open tasks are automatically shown in context. Review what's in progress and pick up where you left off.
- **Starting work on a task**: Move it to `in_progress` before you begin.
- **Logging progress**: Use `lobstersight_add_event` to note what you did, decisions made, or blockers hit. Be specific — "Refactored auth middleware to use JWT validation" is better than "worked on auth".
- **Completing a task**: Update status to `done` and include `actual_minutes` if you can estimate it.
- **Discovering new work**: When you find something that needs doing (a bug, a follow-up, an improvement), create a task in the appropriate project — your agent project for things you'll handle, the user's project if it's something for them.
- **Helping the user**: When the user asks about their tasks, list them. When they ask you to create, update, or move one of their tasks, do it in their project.

## Task statuses

| Status | Meaning |
|--------|---------|
| `backlog` | Identified but not yet planned |
| `todo` | Planned and ready to start |
| `in_progress` | Currently being worked on |
| `done` | Completed |
| `canceled` | No longer needed |

## Priorities

| Value | Label |
|-------|-------|
| 0 | None |
| 1 | Low |
| 2 | Medium |
| 3 | High |
| 4 | Urgent |

## Subtasks

You can break a large task into subtasks using `parent_id` when creating a task. However, **subtasks must only be one level deep**. Never create a subtask of a subtask. If a task already has a `parent_id`, it is a subtask — do not use it as a parent for another task. Keep the hierarchy flat: top-level tasks and their direct subtasks, nothing deeper.

## Best practices

- Always check for existing tasks before creating duplicates
- Move tasks to `in_progress` before starting work
- Log progress events with meaningful context, not just "working on it"
- When you finish a task, mark it `done` and note what was accomplished
- If you discover a blocker, log it as an event with `event_type: "blocker"`
- When creating tasks for yourself, always use the agent project ID
- When creating tasks for the user, always use their project ID
- Don't touch user tasks unless asked
- Never nest subtasks more than one level deep (no sub-sub-tasks)
