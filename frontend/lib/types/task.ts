export type TaskType = "task" | "call" | "meeting" | "appointment" | "follow_up";
export type ReminderChannel = "in_app" | "email" | "sms" | "whatsapp";
export type TaskStatus = "pending" | "completed" | "cancelled";
export type RecurrenceRule = "daily" | "weekly" | "monthly";

export interface Task {
  id: string;
  branch_id: string | null;
  assigned_to_user_id: string;
  created_by_user_id: string;
  title: string;
  description: string | null;
  task_type: TaskType;
  entity_type: string | null;
  entity_id: string | null;
  due_at: string;
  all_day: boolean;
  location: string | null;
  status: TaskStatus;
  completed_at: string | null;
  reminder_minutes_before: number | null;
  reminder_channel: ReminderChannel;
  reminder_sent: boolean;
  recurrence: RecurrenceRule | null;
  recurrence_until: string | null;
  recurrence_parent_id: string | null;
  created_at: string;
}

export interface TaskCreatePayload {
  title: string;
  description?: string;
  task_type?: TaskType;
  entity_type?: string;
  entity_id?: string;
  due_at: string;
  all_day?: boolean;
  location?: string;
  branch_id?: string;
  assigned_to_user_id?: string;
  reminder_minutes_before?: number;
  reminder_channel?: ReminderChannel;
  recurrence?: RecurrenceRule;
  recurrence_until?: string;
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  task: "Task",
  call: "Call",
  meeting: "Meeting",
  appointment: "Appointment",
  follow_up: "Follow-up",
};

export function taskStatusTone(status: TaskStatus): "neutral" | "approved" | "pending" | "rejected" | "info" {
  if (status === "completed") return "approved";
  if (status === "cancelled") return "neutral";
  return "pending";
}

/** Groups tasks by calendar day (YYYY-MM-DD, local time) for an agenda-style view. */
export function groupTasksByDay(tasks: Task[]): { day: string; tasks: Task[] }[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const day = new Date(task.due_at).toDateString();
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(task);
  }
  return Array.from(groups.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([day, tasks]) => ({ day, tasks }));
}
