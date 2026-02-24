---
name: lobstersight
description: Track and manage tasks via LobsterSight. View open work, create tasks and projects, update progress, log activity, and manage cron jobs.
metadata:
  openclaw:
    emoji: "\U0001F99E"
    always: true
user-invocable: true
disable-model-invocation: false
---

# LobsterSight — Task Tracking

You have access to a shared LobsterSight task board with the `lobstersight_*` tools.

## ROUTING: Recurring vs one-off

**Before creating any task, decide:** does this work repeat on a schedule?

- **Recurring** (repeating, periodic, scheduled, "every day/week/month", daily, weekly, monthly, yearly) → **ALWAYS** use `lobstersight_create_recurring_task`. Never `lobstersight_create_task`.
- **One-off** (single piece of work, no schedule) → use `lobstersight_create_task`.

If the user says "recurring task", "repeating task", "scheduled task", or anything with a cadence — that's `lobstersight_create_recurring_task`.

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
| `lobstersight_create_task` | Create a one-off, non-recurring task |
| `lobstersight_create_recurring_task` | Create a new recurring task (cron job) with a schedule |
| `lobstersight_update_task` | Update status, priority, description, time |
| `lobstersight_add_event` | Log a comment or progress note |
| `lobstersight_list_recurring_tasks` | List cron jobs with schedule info |
| `lobstersight_report_recurrence_run` | Report the result of a cron job execution |
| `lobstersight_update_recurrence` | Pause, resume, or reschedule a cron job |

## When to create tasks

Task tracking is part of your core workflow, not an optional extra. Follow these rules:

- **DO create a task** when work spans multiple turns, involves research + implementation, or is something you'd want to resume later. Even if the user didn't ask you to track it — create it anyway.
- **DO NOT create a task** for trivial one-shot questions ("what time is it?", "convert this to JSON", quick lookups). If it takes a single response, skip it.
- **DO NOT create a regular task about a cron job** — not to track it, fix it, monitor it, investigate it, or anything else. Cron jobs have their own tools and run-reporting system. If a cron job needs attention, work on it directly and report via `lobstersight_report_recurrence_run`. Never put a cron job on the task board as a regular task.
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

## Cron jobs

Cron jobs are **their own thing** — they have a built-in schedule, run history, and dedicated tools. They are NOT regular tasks. They appear in your injected context under "Cron Jobs" with their schedule and next run time.

### CRITICAL: Never create regular tasks about cron jobs

**NEVER** use `lobstersight_create_task` for anything related to an existing cron job. This includes:

- "Fix [cron job name]" — **wrong**. Just fix it and report the run.
- "Monitor [cron job name]" — **wrong**. Check its status with `lobstersight_list_recurring_tasks`.
- "Investigate [cron job name] failure" — **wrong**. Investigate directly, then report the run.
- "Run [cron job name]" — **wrong**. Execute it and report with `lobstersight_report_recurrence_run`.
- Any task whose title or description references a cron job — **wrong**.

Cron jobs already exist in LobsterSight with their own schedule, status, and run history. When the user asks you to work with, execute, fix, sync, or manage cron jobs:

1. Use `lobstersight_list_recurring_tasks` to see them
2. Do the work directly (fix, execute, investigate — whatever is needed)
3. Use `lobstersight_report_recurrence_run` to report the outcome
4. Use `lobstersight_update_recurrence` to pause/resume/reschedule

The cron job's run history IS the tracking. There is no need for a separate task.

### Cron statuses

| Status | Meaning |
|--------|---------|
| `active` | Running on schedule |
| `paused` | Temporarily stopped — won't execute until resumed |
| `failing` | Last run failed — needs attention |

### Creating a cron job

Create a recurring task whenever the user asks for work that repeats on a schedule — "recurring task", "repeating task", "every Monday", "daily check", etc. Use `lobstersight_create_recurring_task` (NOT `lobstersight_create_task`) and put it in the **agent project** if it's work the agent will execute. The `recurrence_rule` is required:

```
recurrence_rule: {
  frequency: "daily" | "weekly" | "monthly" | "yearly",
  interval: 1,           // every N periods
  time_of_day: "09:00",  // HH:mm 24h format (optional)
  timezone: "America/New_York",  // IANA timezone (optional)
  days_of_week: [1, 3, 5],      // 0=Sun..6=Sat (optional, for weekly)
  day_of_month: 15,              // 1-31 (optional, for monthly)
  end_date: "2026-12-31",       // when to stop (optional)
  count: 10                      // total occurrences (optional)
}
```

Set `next_run_at` to an ISO timestamp for the first scheduled run.

### Executing and reporting

When you execute a cron job (either because the user asked or because it's due), follow this flow:

1. **Do the work** described in the cron job's title/description
2. **Report the result** with `lobstersight_report_recurrence_run`:
   - `outcome: "success"` — completed normally. If status was `failing`, it auto-resets to `active`.
   - `outcome: "failure"` — something went wrong. Provide an `error` message. Status auto-sets to `failing`.
   - `outcome: "skipped"` — intentionally skipped this run (e.g. preconditions not met).
3. Include `duration_ms`, `content` (summary of what happened), and `next_run_at`

**Do not** create a regular task, mark it done, or use any other task tracking for the execution. The run report IS the tracking.

### Managing cron jobs

Use `lobstersight_update_recurrence` to:
- **Pause**: Set `recurrence_status: "paused"` to temporarily stop the schedule
- **Resume**: Set `recurrence_status: "active"` to restart it
- **Reschedule**: Set `next_run_at` to change when the next run happens

### Cron job workflow

- **At conversation start**: Check injected context for cron jobs. If a job is `failing`, investigate and fix it directly — do NOT create a "Fix ..." task. If a job is overdue (`next_run_at` is in the past), execute it. Always report results with `lobstersight_report_recurrence_run`.
- **When asked to "sync", "run", or "catch up" cron jobs**: List them with `lobstersight_list_recurring_tasks`, execute the work, and report results with `lobstersight_report_recurrence_run`. Do **not** create regular tasks.
- **When a cron job is failing**: Investigate the error, fix the issue, re-run the job, and report with `lobstersight_report_recurrence_run`. Do NOT create a task like "Fix [job name]" or "Investigate [job name] failure". Work on it directly.
- **When asked to set up a new recurring/repeating/scheduled task**: Create it with `lobstersight_create_recurring_task`. Use the agent project for agent work.
- **On failure**: Report with `outcome: "failure"` and a clear `error` message. The user sees this in the UI.

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
- Always report cron job run results — never silently skip reporting
- Investigate `failing` cron jobs proactively when you see them in context
- Never create regular tasks about cron jobs — not to fix, monitor, track, or investigate them. Use the cron tools directly.
- Cron jobs follow the same project ownership rules: agent project for agent work, human project for user work
