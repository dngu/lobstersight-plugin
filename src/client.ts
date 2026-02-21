/**
 * HTTP client for the LobsterSight agent API.
 */

export type TaskStatus = "backlog" | "todo" | "in_progress" | "done" | "canceled";

export type Task = {
  id: string;
  user_id: string;
  project_id: string | null;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  start_date: string | null;
  due_date: string | null;
  deadline_date: string | null;
  completed_at: string | null;
  estimate_minutes: number | null;
  actual_minutes: number | null;
  sort_position: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  task_labels?: Array<{ label_id: string; labels: { id: string; name: string; color: string | null } }>;
};

export type TaskEvent = {
  id: number;
  task_id: string;
  actor_type: "human" | "agent" | "system";
  event_type: string;
  content: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type CreateTaskParams = {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: number;
  project_id?: string;
  parent_id?: string;
  start_date?: string;
  due_date?: string;
  deadline_date?: string;
  estimate_minutes?: number;
  metadata?: Record<string, unknown>;
};

export type UpdateTaskParams = {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: number;
  project_id?: string | null;
  parent_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  deadline_date?: string | null;
  estimate_minutes?: number | null;
  actual_minutes?: number | null;
  metadata?: Record<string, unknown>;
  _event_metadata?: Record<string, unknown>;
};

export type ListTasksParams = {
  status?: TaskStatus;
  project_id?: string;
  open?: boolean;
  limit?: number;
};

export type AddEventParams = {
  event_type?: string;
  content?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  actor_type: "human" | "agent";
  archived_at: string | null;
  sort_position: number;
  created_at: string;
  updated_at: string;
};

export type ListProjectsParams = {
  actor_type?: "human" | "agent";
};

export class LobsterSightClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = (data as { error?: string }).error ?? `HTTP ${res.status}`;
      throw new Error(`LobsterSight API error: ${msg}`);
    }

    return data as T;
  }

  async listTasks(params?: ListTasksParams): Promise<Task[]> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.project_id) qs.set("project_id", params.project_id);
    if (params?.open) qs.set("open", "true");
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return this.request<Task[]>("GET", `/tasks${query ? `?${query}` : ""}`);
  }

  async getTask(taskId: string): Promise<Task> {
    return this.request<Task>("GET", `/tasks/${taskId}`);
  }

  async createTask(params: CreateTaskParams): Promise<Task> {
    return this.request<Task>("POST", "/tasks", params);
  }

  async updateTask(taskId: string, params: UpdateTaskParams): Promise<Task> {
    return this.request<Task>("PATCH", `/tasks/${taskId}`, params);
  }

  async listTaskEvents(taskId: string): Promise<TaskEvent[]> {
    return this.request<TaskEvent[]>("GET", `/tasks/${taskId}/events`);
  }

  async addTaskEvent(taskId: string, params: AddEventParams): Promise<TaskEvent> {
    return this.request<TaskEvent>("POST", `/tasks/${taskId}/events`, params);
  }

  async listProjects(params?: ListProjectsParams): Promise<Project[]> {
    const qs = new URLSearchParams();
    if (params?.actor_type) qs.set("actor_type", params.actor_type);
    const query = qs.toString();
    return this.request<Project[]>("GET", `/projects${query ? `?${query}` : ""}`);
  }
}
