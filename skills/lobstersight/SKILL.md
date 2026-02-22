---
name: lobstersight
description: Track and manage tasks via LobsterSight. View open work, create tasks and projects, update progress, and log activity on the shared task board.
metadata:
  openclaw:
    emoji: "\U0001F99E"
    always: true
user-invocable: true
disable-model-invocation: false
---

# LobsterSight — Task Tracking

You have access to a shared LobsterSight task board with the `lobstersight_*` tools.

## Projects and ownership

Tasks are organized into projects. Each project has an `actor_type`:

- **`agent` projects**: Your work. You proactively pick up tasks, track progress, and mark them done. When you create tasks for yourself, put them in an agent project.
- **`human` projects**: The user's personal task lists. These are **not your work queue** — they're the user's own items. You can create human projects and tasks in them when the user asks, but never proactively act on tasks in human projects.

You can create projects of either type with `lobstersight_create_project`. Use `lobstersight_list_projects` to discover existing projects and their ownership.

## Tools

| Tool | Purpose |
|------|---------|
| `lobstersight_list_projects` | Discover projects and their ownership |
| `lobstersight_create_project` | Create a new project (agent or human) |
| `lobstersight_list_tasks` | List tasks with filters (status, project, open) |
| `lobstersight_get_task` | Get full task details by ID |
| `lobstersight_create_task` | Create a new task |
| `lobstersight_update_task` | Update status, priority, description, time |
| `lobstersight_add_event` | Log a comment or progress note |

## When to create tasks

Task tracking is part of your core workflow, not an optional extra. Follow these rules:

- **DO create a task** when work spans multiple turns, involves research + implementation, or is something you'd want to resume later. Even if the user didn't ask you to track it — create it anyway.
- **DO NOT create a task** for trivial one-shot questions ("what time is it?", "convert this to JSON", quick lookups). If it takes a single response, skip it.
- **Rule of thumb**: If you're about to do something and think "I should remember where I left off" — create a task first.

## Core workflow

- **Starting a conversation**: Your open tasks are automatically injected into context. Review what's in progress and pick up where you left off. If a task is `in_progress`, continue it before starting anything new.
- **Receiving a non-trivial request**: Create a task before starting work. Set it to `in_progress` immediately.
- **Working on something**: Log progress with `lobstersight_add_event` as you go — what you did, decisions made, blockers hit. Be specific: "Refactored auth middleware to use JWT validation" not "worked on auth".
- **Completing work**: Update status to `done` and include `actual_minutes` if you can estimate it.
- **Discovering follow-up work**: When you find something that needs doing (a bug, a follow-up, an improvement), create a task in the appropriate project rather than just mentioning it in chat.
- **Helping the user with their tasks**: When the user asks about their tasks, list them. When they ask you to create, update, or move tasks, do it in their project.

## Task statuses

| Status | Meaning |
|--------|---------|
| `backlog` | Identified but not yet planned |
| `todo` | Planned and ready to start |
| `in_progress` | Currently being worked on |
| `done` | Completed |
| `canceled` | No longer needed |
| `blocked` | Waiting on user action — cannot proceed until unblocked |

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

## Blocked tasks

### Blocking a task (agent → user)

When you hit a blocker that requires user action (e.g. missing credentials, unclear requirements, a decision only the user can make):

1. Use `lobstersight_update_task` to set `status: "blocked"` with `_block_reason` explaining what you need from the user
2. Tell the user in chat what you're blocked on so they know to respond
3. The task board will show blocked tasks prominently

### Unblocking a task (user → agent)

Blocked tasks can be resolved in two ways:

- **Via LobsterSight UI**: The user clicks "Unblock" in the web UI — the task returns to `in_progress`
- **Via direct reply to the bot**: When the user replies in chat with information that resolves a blocked task:
  1. Recognize the reply addresses a blocked task's issue
  2. Add an event comment on the task with the user's response (via `lobstersight_add_event`)
  3. Update the task status from `blocked` back to `in_progress` (via `lobstersight_update_task`)
  4. Continue working on the task using the information provided

If the task board shows blocked tasks at prompt time, proactively check if the user's latest message resolves any of them.

## Best practices

- Always check for existing tasks before creating duplicates
- Move tasks to `in_progress` before starting work
- Log progress events with meaningful context, not just "working on it"
- When you finish a task, mark it `done` and note what was accomplished
- If you discover a blocker, log it as an event with `event_type: "blocker"`
- When creating tasks for yourself, always use an agent project
- When creating tasks for the user, always use a human project
- Only proactively work on tasks in agent projects — never act on human project tasks unless asked
- Never nest subtasks more than one level deep (no sub-sub-tasks)
