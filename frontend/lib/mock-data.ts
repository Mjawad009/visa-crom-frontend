/**
 * Fixture data for NEXT_PUBLIC_MOCK_MODE - lets the frontend be browsed
 * end to end with zero backend. See lib/api-client.ts for where this
 * gets wired in. Not used in real builds; purely a local-preview aid.
 */

export const MOCK_USER = {
  id: "mock-user-1",
  email: "you@example.com",
  full_name: "Preview User",
  role_key: "ceo",
  branch_id: "mock-branch-1",
  is_superuser: true,
  permissions: [],
};

const now = new Date().toISOString();

export const MOCK_LEADS = [
  { id: "lead-1", branch_id: "mock-branch-1", assigned_to_user_id: "mock-user-1", full_name: "Amara Okafor", email: "amara@example.com", phone: "+1 555 0101", source: "website", country_of_interest: "Canada", visa_type_interest: "Study visa", notes: "Interested in fall intake.", is_converted: false, created_at: now, current_stage_key: "contacted", current_stage_name: "Contacted" },
  { id: "lead-2", branch_id: "mock-branch-1", assigned_to_user_id: "mock-user-1", full_name: "Ravi Singh", email: "ravi@example.com", phone: "+1 555 0102", source: "referral", country_of_interest: "UK", visa_type_interest: "Skilled worker", notes: null, is_converted: false, created_at: now, current_stage_key: "new", current_stage_name: "New" },
  { id: "lead-3", branch_id: "mock-branch-1", assigned_to_user_id: "mock-user-1", full_name: "Maria Alvarez", email: "maria@example.com", phone: "+1 555 0103", source: "social_media", country_of_interest: "Australia", visa_type_interest: "Visitor visa", notes: null, is_converted: true, created_at: now, current_stage_key: "converted", current_stage_name: "Converted" },
];

export const MOCK_CLIENTS = [
  { id: "client-1", branch_id: "mock-branch-1", assigned_consultant_id: "mock-user-1", lead_id: "lead-3", user_id: null, full_name: "Maria Alvarez", email: "maria@example.com", phone: "+1 555 0103", date_of_birth: "1995-04-12", nationality: "Mexican", passport_number: "G12345678", passport_expiry: "2029-01-01", address: "123 Main St", notes: null, is_active: true, created_at: now },
];

export const MOCK_CASES = [
  { id: "case-1", client_id: "client-1", branch_id: "mock-branch-1", assigned_consultant_id: "mock-user-1", reference: "VC-2026-4821", case_type: "study_visa", destination_country: "Canada", visa_type: "Study Permit", priority: "high", target_submission_date: "2026-09-01", notes: null, is_closed: false, closed_reason: null, created_at: now, current_stage_key: "document_collection", current_stage_name: "Document Collection", client_full_name: "Maria Alvarez" },
];

export const MOCK_ADMISSIONS = [
  { id: "admission-1", client_id: "client-1", branch_id: "mock-branch-1", assigned_officer_id: "mock-user-1", institution_name: "State University", program_name: "MSc Computer Science", country: "Canada", intake_term: "Fall 2026", notes: null, is_closed: false, closed_reason: null, created_at: now, current_stage_key: "offer_received", current_stage_name: "Offer Received", client_full_name: "Maria Alvarez" },
];

export const MOCK_FILES = [
  { id: "file-1", entity_type: "case", entity_id: "case-1", folder_id: null, category: "passport", filename: "passport.jpg", content_type: "image/jpeg", size_bytes: 204800, version: 1, previous_version_id: null, status: "verified", rejection_reason: null, ocr_text: null, ai_analysis: null, expiry_date: "2029-01-01", created_at: now },
];

export const MOCK_CATEGORIES = [
  { id: "cat-1", key: "passport", name: "Passport", description: null, expiry_tracking_enabled: true },
  { id: "cat-2", key: "bank_statement", name: "Bank Statement", description: null, expiry_tracking_enabled: false },
];

export const MOCK_COMMUNICATIONS = [
  { id: "comm-1", entity_type: "case", entity_id: "case-1", channel: "email", direction: "outbound", sender_user_id: "mock-user-1", recipient_email: "maria@example.com", subject: "Document checklist", body: "Hi Maria, here's what we still need...", created_at: now },
];

export const MOCK_NOTIFICATIONS = [
  {
    id: "notif-1",
    title: "New lead assigned",
    body: "Amara Okafor was assigned to you.",
    type: "info",
    link: "/dashboard/leads/lead-1",
    is_read: false,
    created_at: now,
  },
  {
    id: "notif-2",
    title: "Case advanced to Submission",
    body: "Ravi Singh's skilled worker case moved to Submission.",
    type: "success",
    link: null,
    is_read: false,
    created_at: now,
  },
  {
    id: "notif-3",
    title: "Document expiring soon",
    body: "A passport on file expires within 30 days.",
    type: "warning",
    link: null,
    is_read: true,
    created_at: now,
  },
];

export const MOCK_BRANCHES = [
  {
    id: "mock-branch-1",
    name: "Toronto HQ",
    code: "TOR-01",
    address: "100 King St W, Toronto, ON",
    phone: "+1 416 555 0100",
    email: "toronto@example.com",
    is_active: true,
  },
  {
    id: "mock-branch-2",
    name: "Vancouver Branch",
    code: "VAN-01",
    address: "500 Burrard St, Vancouver, BC",
    phone: "+1 604 555 0100",
    email: "vancouver@example.com",
    is_active: true,
  },
];

export const MOCK_ROLES = [
  { id: "role-ceo", key: "ceo", name: "CEO", description: "Full access across every branch and module.", is_system: true },
  { id: "role-branch-manager", key: "branch_manager", name: "Branch Manager", description: "Manages a single branch's team and pipeline.", is_system: true },
  { id: "role-consultant", key: "consultant", name: "Consultant", description: "Works leads and cases assigned to them.", is_system: false },
];

export const MOCK_PERMISSIONS = [
  { id: "perm-1", key: "users.view", module: "users", description: "View team members" },
  { id: "perm-2", key: "users.create", module: "users", description: "Add new team members" },
  { id: "perm-3", key: "users.update", module: "users", description: "Edit team member details" },
  { id: "perm-4", key: "users.deactivate", module: "users", description: "Deactivate or reactivate accounts" },
  { id: "perm-5", key: "branches.view", module: "branches", description: "View branches" },
  { id: "perm-6", key: "branches.manage", module: "branches", description: "Create and edit branches" },
  { id: "perm-7", key: "roles.manage", module: "permissions", description: "Manage roles and permissions" },
  { id: "perm-8", key: "logs.view_activity", module: "logs", description: "View activity feed" },
  { id: "perm-9", key: "logs.view_audit", module: "logs", description: "View audit trail" },
];

export const MOCK_ROLE_PERMISSIONS: Record<string, string[]> = {
  "role-ceo": MOCK_PERMISSIONS.map((p) => p.key),
  "role-branch-manager": ["users.view", "branches.view", "logs.view_activity"],
  "role-consultant": [],
};

export const MOCK_USERS = [
  { id: "mock-user-1", email: "you@example.com", full_name: "Preview User", phone: "+1 555 0100", role_id: "role-ceo", branch_id: "mock-branch-1", is_active: true, additional_role_ids: [] as string[] },
  { id: "mock-user-2", email: "sam@example.com", full_name: "Sam Rivera", phone: "+1 555 0101", role_id: "role-branch-manager", branch_id: "mock-branch-1", is_active: true, additional_role_ids: ["role-consultant"] as string[] },
  { id: "mock-user-3", email: "jo@example.com", full_name: "Jo Tan", phone: null, role_id: "role-consultant", branch_id: "mock-branch-2", is_active: false, additional_role_ids: [] as string[] },
];

export const MOCK_TASKS = [
  {
    id: "task-1",
    branch_id: "mock-branch-1",
    assigned_to_user_id: "mock-user-1",
    created_by_user_id: "mock-user-1",
    title: "Follow up with Amara on IELTS results",
    description: "She was waiting on her official score report.",
    task_type: "follow_up",
    entity_type: "lead",
    entity_id: "lead-1",
    due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    all_day: false,
    location: null,
    status: "pending",
    completed_at: null,
    reminder_minutes_before: 30,
    reminder_channel: "in_app",
    reminder_sent: false,
    recurrence: null as string | null,
    recurrence_until: null as string | null,
    recurrence_parent_id: null as string | null,
    created_at: now,
  },
  {
    id: "task-2",
    branch_id: "mock-branch-1",
    assigned_to_user_id: "mock-user-1",
    created_by_user_id: "mock-user-1",
    title: "Visa consultation call",
    description: null,
    task_type: "call",
    entity_type: null,
    entity_id: null,
    due_at: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
    all_day: false,
    location: null,
    status: "pending",
    completed_at: null,
    reminder_minutes_before: 15,
    reminder_channel: "email",
    reminder_sent: false,
    recurrence: null as string | null,
    recurrence_until: null as string | null,
    recurrence_parent_id: null as string | null,
    created_at: now,
  },
  {
    id: "task-3",
    branch_id: "mock-branch-1",
    assigned_to_user_id: "mock-user-2",
    created_by_user_id: "mock-user-1",
    title: "Client onboarding meeting",
    description: "Walk through the engagement agreement.",
    task_type: "meeting",
    entity_type: "client",
    entity_id: "client-1",
    due_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    all_day: false,
    location: "Toronto HQ, Room 2",
    status: "completed",
    completed_at: now,
    reminder_minutes_before: null,
    reminder_channel: "in_app",
    reminder_sent: false,
    recurrence: null as string | null,
    recurrence_until: null as string | null,
    recurrence_parent_id: null as string | null,
    created_at: now,
  },
];

export const MOCK_ACTIVITY_LOGS = [
  { id: "log-1", actor_user_id: "mock-user-1", branch_id: "mock-branch-1", module: "leads", action: "create", entity_type: "lead", entity_id: "lead-1", metadata_json: null, created_at: now },
  { id: "log-2", actor_user_id: "mock-user-1", branch_id: "mock-branch-1", module: "cases", action: "update", entity_type: "case", entity_id: "case-1", metadata_json: null, created_at: now },
  { id: "log-3", actor_user_id: "mock-user-2", branch_id: "mock-branch-1", module: "users", action: "deactivate", entity_type: "user", entity_id: "mock-user-3", metadata_json: null, created_at: now },
];

export const MOCK_AUDIT_LOGS = [
  { id: "audit-1", actor_user_id: "mock-user-2", branch_id: "mock-branch-1", action: "update", entity_type: "user", entity_id: "mock-user-3", before_json: { is_active: true }, after_json: { is_active: false }, created_at: now },
];

export const MOCK_LEAD_FUNNEL = {
  definition_key: "lead_pipeline",
  stages: [
    { stage_key: "new", stage_name: "New", count: 4 },
    { stage_key: "contacted", stage_name: "Contacted", count: 3 },
    { stage_key: "qualified", stage_name: "Qualified", count: 2 },
    { stage_key: "proposal_sent", stage_name: "Proposal Sent", count: 1 },
    { stage_key: "converted", stage_name: "Converted", count: 5 },
    { stage_key: "lost", stage_name: "Lost", count: 1 },
  ],
};

export const MOCK_CASE_FUNNEL = {
  definition_key: "visa_case_pipeline",
  stages: [
    { stage_key: "consultation", stage_name: "Consultation", count: 2 },
    { stage_key: "document_collection", stage_name: "Document Collection", count: 3 },
    { stage_key: "eligibility_review", stage_name: "Eligibility Review", count: 1 },
    { stage_key: "application", stage_name: "Application", count: 1 },
    { stage_key: "submission", stage_name: "Submission", count: 2 },
    { stage_key: "biometrics", stage_name: "Biometrics", count: 1 },
    { stage_key: "medical", stage_name: "Medical", count: 0 },
    { stage_key: "interview", stage_name: "Interview", count: 1 },
    { stage_key: "decision", stage_name: "Decision", count: 1 },
    { stage_key: "post_visa_support", stage_name: "Post Visa Support", count: 3 },
  ],
};

export const MOCK_ADMISSIONS_FUNNEL = {
  definition_key: "admissions_pipeline",
  stages: [
    { stage_key: "preparing_application", stage_name: "Preparing Application", count: 2 },
    { stage_key: "submitted_to_institution", stage_name: "Submitted To Institution", count: 1 },
    { stage_key: "offer_received", stage_name: "Offer Received", count: 1 },
    { stage_key: "deposit_paid", stage_name: "Deposit Paid", count: 0 },
    { stage_key: "document_issued", stage_name: "Document Issued", count: 0 },
    { stage_key: "completed", stage_name: "Completed", count: 2 },
  ],
};

export const MOCK_BRANCH_PERFORMANCE = {
  rows: [
    { branch_id: "mock-branch-1", branch_name: "London", leads: 4, clients: 3, cases: 2, admissions: 1 },
    { branch_id: "mock-branch-2", branch_name: "Toronto", leads: 2, clients: 1, cases: 1, admissions: 1 },
  ],
};

export const MOCK_DOCUMENT_COMPLIANCE = {
  status_counts: { pending: 3, verified: 8, rejected: 1 },
  expiring_within_30_days: 2,
};
