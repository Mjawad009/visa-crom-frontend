import {
  MOCK_ADMISSIONS,
  MOCK_ADMISSIONS_FUNNEL,
  MOCK_ACTIVITY_LOGS,
  MOCK_AUDIT_LOGS,
  MOCK_BRANCH_PERFORMANCE,
  MOCK_BRANCHES,
  MOCK_CASE_FUNNEL,
  MOCK_CASES,
  MOCK_CATEGORIES,
  MOCK_CLIENTS,
  MOCK_COMMUNICATIONS,
  MOCK_DOCUMENT_COMPLIANCE,
  MOCK_FILES,
  MOCK_LEAD_FUNNEL,
  MOCK_LEADS,
  MOCK_NOTIFICATIONS,
  MOCK_PERMISSIONS,
  MOCK_ROLE_PERMISSIONS,
  MOCK_ROLES,
  MOCK_TASKS,
  MOCK_USER,
  MOCK_USERS,
} from "./mock-data";

export const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

function findById<T extends { id: string }>(list: T[], id: string): T | undefined {
  return list.find((item) => item.id === id);
}

/**
 * Returns a fixture response for a given path+method, or `undefined` if
 * this path isn't mocked (falls through to a real fetch - useful if
 * you're mixing a real backend for some calls during development).
 */
export async function getMockResponse<T>(path: string, method: string, _body?: BodyInit | null): Promise<T | undefined> {
  await new Promise((r) => setTimeout(r, 150)); // a little latency so loading states are visible

  const [pathname] = path.split("?");
  const segments = pathname.split("/").filter(Boolean);

  // --- Auth ---
  if (pathname === "/auth/login" && method === "POST") {
    return { access_token: "mock-access-token", refresh_token: "mock-refresh-token" } as unknown as T;
  }
  if (pathname === "/auth/me") {
    return MOCK_USER as unknown as T;
  }
  if (pathname === "/auth/logout") {
    return undefined as unknown as T;
  }

  // --- Leads ---
  if (segments[0] === "leads") {
    if (segments.length === 1) return MOCK_LEADS as unknown as T;
    const record = findById(MOCK_LEADS, segments[1]);
    if (record) return record as unknown as T;
  }

  // --- Clients ---
  if (segments[0] === "clients") {
    if (segments.length === 1) return MOCK_CLIENTS as unknown as T;
    const record = findById(MOCK_CLIENTS, segments[1]);
    if (record) return record as unknown as T;
  }

  // --- Cases ---
  if (segments[0] === "cases") {
    if (segments.length === 1) return MOCK_CASES as unknown as T;
    const record = findById(MOCK_CASES, segments[1]);
    if (record) return record as unknown as T;
  }

  // --- Admissions ---
  if (segments[0] === "admissions") {
    if (segments.length === 1) return MOCK_ADMISSIONS as unknown as T;
    const record = findById(MOCK_ADMISSIONS, segments[1]);
    if (record) return record as unknown as T;
  }

  // --- Files ---
  if (segments[0] === "files") {
    if (segments[1] === "categories") return MOCK_CATEGORIES as unknown as T;
    if (segments[1] === "expiring") return MOCK_FILES as unknown as T;
    if (segments.length === 1) return MOCK_FILES as unknown as T;
    if (segments[2] === "download-url") return { download_url: "#" } as unknown as T;
    if (segments[2] === "upload-url") return { file_id: "mock-file-id", upload_url: "#", storage_key: "mock-key" } as unknown as T;
  }

  // --- Communications ---
  if (segments[0] === "communications") {
    return MOCK_COMMUNICATIONS as unknown as T;
  }

  // --- Notifications ---
  if (segments[0] === "notifications") {
    if (segments[1] === "read-all" && method === "POST") {
      let count = 0;
      MOCK_NOTIFICATIONS.forEach((n) => {
        if (!n.is_read) {
          n.is_read = true;
          count++;
        }
      });
      return { marked_read: count } as unknown as T;
    }
    if (segments[2] === "read" && method === "POST") {
      const record = findById(MOCK_NOTIFICATIONS, segments[1]);
      if (record) record.is_read = true;
      return undefined as unknown as T;
    }
    if (segments.length === 1) {
      const unreadOnly = path.includes("unread_only=true");
      const list = unreadOnly ? MOCK_NOTIFICATIONS.filter((n) => !n.is_read) : MOCK_NOTIFICATIONS;
      return list as unknown as T;
    }
  }

  // --- Users ---
  if (segments[0] === "users") {
    if (segments.length === 1 && method === "GET") return MOCK_USERS as unknown as T;
    if (segments.length === 1 && method === "POST") {
      const body = _body ? JSON.parse(_body.toString()) : {};
      const created = {
        id: `mock-user-${MOCK_USERS.length + 1}`,
        email: body.email,
        full_name: body.full_name,
        phone: body.phone ?? null,
        role_id: body.role_id,
        branch_id: body.branch_id ?? null,
        is_active: true,
        additional_role_ids: body.additional_role_ids ?? [],
      };
      MOCK_USERS.push(created);
      return created as unknown as T;
    }
    if (segments[2] === "reset-password" && method === "POST") {
      // Nothing to actually store in mock mode — just acknowledge.
      const record = findById(MOCK_USERS, segments[1]);
      return record as unknown as T;
    }
    if (segments.length === 2) {
      const record = findById(MOCK_USERS, segments[1]);
      if (!record) return undefined;
      if (method === "PATCH") {
        const body = _body ? JSON.parse(_body.toString()) : {};
        Object.assign(record, body);
      }
      return record as unknown as T;
    }
  }

  // --- Branches ---
  if (segments[0] === "branches") {
    if (segments.length === 1 && method === "GET") return MOCK_BRANCHES as unknown as T;
    if (segments.length === 1 && method === "POST") {
      const body = _body ? JSON.parse(_body.toString()) : {};
      const created = {
        id: `mock-branch-${MOCK_BRANCHES.length + 1}`,
        name: body.name,
        code: body.code,
        address: body.address ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        is_active: true,
      };
      MOCK_BRANCHES.push(created);
      return created as unknown as T;
    }
    if (segments.length === 2 && method === "PATCH") {
      const record = findById(MOCK_BRANCHES, segments[1]);
      if (!record) return undefined;
      const body = _body ? JSON.parse(_body.toString()) : {};
      Object.assign(record, body);
      return record as unknown as T;
    }
  }

  // --- Permissions (Roles & Permissions) ---
  if (segments[0] === "permissions") {
    if (segments[1] === "roles" && segments.length === 2 && method === "GET") return MOCK_ROLES as unknown as T;
    if (segments[1] === "roles" && segments.length === 2 && method === "POST") {
      const body = _body ? JSON.parse(_body.toString()) : {};
      const created = { id: `role-${MOCK_ROLES.length + 1}`, key: body.key, name: body.name, description: body.description ?? null, is_system: false };
      MOCK_ROLES.push(created);
      MOCK_ROLE_PERMISSIONS[created.id] = [];
      return created as unknown as T;
    }
    if (segments[1] === "roles" && segments.length === 3 && method === "DELETE") {
      const idx = MOCK_ROLES.findIndex((r) => r.id === segments[2]);
      if (idx !== -1) MOCK_ROLES.splice(idx, 1);
      return undefined as unknown as T;
    }
    if (segments[1] === "permissions") return MOCK_PERMISSIONS as unknown as T;
    if (segments[1] === "roles" && segments[3] === "permissions") {
      const roleId = segments[2];
      if (method === "PUT") {
        const body = _body ? JSON.parse(_body.toString()) : {};
        MOCK_ROLE_PERMISSIONS[roleId] = body.permission_keys ?? [];
        return MOCK_ROLE_PERMISSIONS[roleId] as unknown as T;
      }
      return (MOCK_ROLE_PERMISSIONS[roleId] ?? []) as unknown as T;
    }
  }

  // --- Logs ---
  if (segments[0] === "logs") {
    if (segments[1] === "activity") return MOCK_ACTIVITY_LOGS as unknown as T;
    if (segments[1] === "audit") return MOCK_AUDIT_LOGS as unknown as T;
  }

  // --- Tasks & Calendar ---
  if (segments[0] === "tasks") {
    if (segments.length === 1 && method === "GET") {
      const statusMatch = path.match(/status_filter=([^&]+)/);
      const entityTypeMatch = path.match(/entity_type=([^&]+)/);
      const entityIdMatch = path.match(/entity_id=([^&]+)/);
      let list = MOCK_TASKS;
      if (statusMatch) list = list.filter((t) => t.status === statusMatch[1]);
      if (entityTypeMatch) list = list.filter((t) => t.entity_type === entityTypeMatch[1]);
      if (entityIdMatch) list = list.filter((t) => t.entity_id === entityIdMatch[1]);
      return list as unknown as T;
    }
    if (segments.length === 1 && method === "POST") {
      const body = _body ? JSON.parse(_body.toString()) : {};
      const created = {
        id: `mock-task-${MOCK_TASKS.length + 1}`,
        branch_id: "mock-branch-1",
        assigned_to_user_id: body.assigned_to_user_id || "mock-user-1",
        created_by_user_id: "mock-user-1",
        title: body.title,
        description: body.description ?? null,
        task_type: body.task_type ?? "task",
        entity_type: body.entity_type ?? null,
        entity_id: body.entity_id ?? null,
        due_at: body.due_at,
        all_day: body.all_day ?? false,
        location: body.location ?? null,
        status: "pending",
        completed_at: null,
        reminder_minutes_before: body.reminder_minutes_before ?? null,
        reminder_channel: body.reminder_channel ?? "in_app",
        reminder_sent: false,
        recurrence: body.recurrence ?? null,
        recurrence_until: body.recurrence_until ?? null,
        recurrence_parent_id: null,
        created_at: new Date().toISOString(),
      };
      MOCK_TASKS.push(created);
      return created as unknown as T;
    }
    if (segments.length === 2 && method === "PATCH") {
      const record = findById(MOCK_TASKS, segments[1]);
      if (!record) return undefined;
      const body = _body ? JSON.parse(_body.toString()) : {};
      Object.assign(record, body);
      return record as unknown as T;
    }
    if (segments[2] === "complete" && method === "POST") {
      const record = findById(MOCK_TASKS, segments[1]);
      if (!record) return undefined;
      record.status = "completed";
      record.completed_at = new Date().toISOString();
      return record as unknown as T;
    }
    if (segments[2] === "cancel" && method === "POST") {
      const record = findById(MOCK_TASKS, segments[1]);
      if (!record) return undefined;
      record.status = "cancelled";
      return record as unknown as T;
    }
    if (segments.length === 2 && method === "GET") {
      return findById(MOCK_TASKS, segments[1]) as unknown as T;
    }
  }

  // --- Reports ---
  if (segments[0] === "reports") {
    if (segments[1] === "funnel" && segments[2] === "leads") return MOCK_LEAD_FUNNEL as unknown as T;
    if (segments[1] === "funnel" && segments[2] === "cases") return MOCK_CASE_FUNNEL as unknown as T;
    if (segments[1] === "funnel" && segments[2] === "admissions") return MOCK_ADMISSIONS_FUNNEL as unknown as T;
    if (segments[1] === "branch-performance") return MOCK_BRANCH_PERFORMANCE as unknown as T;
    if (segments[1] === "document-compliance") return MOCK_DOCUMENT_COMPLIANCE as unknown as T;
  }

  // --- AI ---
  if (segments[0] === "ai") {
    if (segments[1] === "chat") return { content: "This is a mock AI response - no backend is running." } as unknown as T;
    if (segments[1] === "knowledge-search") {
      return { answer: "Mock answer - connect a real backend for actual search.", sources: [] } as unknown as T;
    }
    return {
      content: "Mock AI output.",
      summary: "Mock summary.",
      suggestions: "Mock suggestions.",
      disclaimer: "Mock disclaimer.",
      missing_categories: [],
    } as unknown as T;
  }

  return undefined; // not mocked - falls through to a real fetch attempt
}
