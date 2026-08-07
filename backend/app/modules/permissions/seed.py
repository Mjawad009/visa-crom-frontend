"""
Baseline seed data for roles and permissions.

Run via `python -m app.modules.permissions.seed` (see seed_runner below)
after migrations. This is data, not schema — safe to extend per-deployment
without a migration.
"""
from app.modules.permissions.models import Permission, Role, RolePermission

SYSTEM_ROLES = [
    ("ceo", "CEO", "Full visibility and control across all branches."),
    ("branch_manager", "Branch Manager", "Manages a single branch's operations and staff."),
    ("sales", "Sales", "Manages leads and initial client conversion."),
    ("consultant", "Consultant", "Advises clients on visa pathways and eligibility."),
    ("documentation_officer", "Documentation Officer", "Collects, verifies, and manages client documents."),
    ("visa_processing_officer", "Visa Processing Officer", "Manages visa applications through submission and decision."),
    ("admissions_officer", "Admissions Officer", "Manages education/admissions pipeline for study-visa clients."),
    ("finance", "Finance", "Manages invoices, payments, and financial reporting."),
    ("marketing", "Marketing", "Manages campaigns and lead-generation channels."),
    ("reception", "Reception", "Front-desk scheduling and initial client intake."),
    ("client", "Client", "External portal access to their own case only."),
]

# Baseline permissions. Each business module will extend this list as it
# ships (Phase 4+); Phase 2 seeds only Core Platform permissions.
# Baseline permissions. Each business module extends this list as it
# ships. Phase 2 seeds Core Platform permissions; Phase 4 adds Leads.
CORE_PERMISSIONS = [
    ("users.view", "users", "View user accounts"),
    ("users.create", "users", "Create user accounts"),
    ("users.update", "users", "Edit user accounts"),
    ("users.deactivate", "users", "Deactivate user accounts"),
    ("branches.view", "branches", "View branches"),
    ("branches.manage", "branches", "Create/edit branches"),
    ("roles.manage", "permissions", "Manage roles and their permissions"),
    ("logs.view_activity", "logs", "View activity logs"),
    ("logs.view_audit", "logs", "View audit logs (sensitive)"),
    ("workflow.manage_definitions", "workflow", "Create/edit workflow definitions"),
    ("workflow.transition", "workflow", "Move an entity through workflow stages"),
    ("files.upload", "files", "Upload documents"),
    ("files.verify", "files", "Approve/reject uploaded documents"),
    ("files.delete", "files", "Delete documents"),
    ("ai.use_assistant", "ai", "Use AI chat assistant / generators"),
    # --- Leads (Phase 4) ---
    ("leads.view", "leads", "View own assigned leads"),
    ("leads.view_all", "leads", "View all leads across the branch/company"),
    ("leads.create", "leads", "Create new leads"),
    ("leads.update", "leads", "Edit leads and move them through the pipeline"),
    ("leads.convert", "leads", "Convert a lead into a client"),
    # --- Clients (Phase 5) ---
    ("clients.view", "clients", "View own assigned clients"),
    ("clients.view_all", "clients", "View all clients across the branch/company"),
    ("clients.create", "clients", "Create new client records"),
    ("clients.update", "clients", "Edit client records"),
    ("clients.deactivate", "clients", "Deactivate a client record"),
    # --- Cases (Phase 6) ---
    ("cases.view", "cases", "View own assigned cases"),
    ("cases.view_all", "cases", "View all cases across the branch/company"),
    ("cases.create", "cases", "Open a new case for a client"),
    ("cases.update", "cases", "Edit cases and move them through the pipeline"),
    # --- Admissions (Phase 10) ---
    ("admissions.view", "admissions", "View own assigned admission applications"),
    ("admissions.view_all", "admissions", "View all admission applications across the branch/company"),
    ("admissions.create", "admissions", "Create a new admission application"),
    ("admissions.update", "admissions", "Edit admission applications and move them through the pipeline"),
    # --- Communications (Phase 11) ---
    ("communication.view", "communications", "View the email/notes timeline on any entity"),
    ("communication.send", "communications", "Send an email or log an internal note on any entity"),
    # --- Reports & Analytics (Phase 13) ---
    ("reports.view", "reports", "View company/branch-wide reports and analytics"),
    # --- Client Self-Service API (Phase 14) ---
    ("client_portal.view_own", "client_api", "Read-only access to one's own client record, cases, admissions, documents, and communications"),
    # --- Tasks & Calendar (Phase 18) ---
    ("tasks.view", "tasks", "View own tasks, reminders, and appointments"),
    ("tasks.view_all", "tasks", "View all tasks across the branch/company"),
    ("tasks.create", "tasks", "Create tasks, reminders, and appointments"),
    ("tasks.update", "tasks", "Edit, complete, or cancel tasks"),
]

# Default role -> permission grants for Phase 2 (kept minimal; business
# modules add their own grants as they ship).
DEFAULT_ROLE_GRANTS = {
    "ceo": [p[0] for p in CORE_PERMISSIONS],  # CEO gets everything by default
    "branch_manager": [
        "users.view", "users.update", "branches.view",
        "logs.view_activity", "workflow.transition",
        "files.upload", "files.verify", "ai.use_assistant",
        "leads.view_all", "leads.create", "leads.update", "leads.convert",
        "clients.view_all", "clients.create", "clients.update", "clients.deactivate",
        "cases.view_all", "cases.create", "cases.update",
        "admissions.view_all", "admissions.create", "admissions.update",
        "communication.view", "communication.send", "reports.view",
        "tasks.view_all", "tasks.create", "tasks.update",
    ],
    "sales": [
        "files.upload", "ai.use_assistant", "leads.view", "leads.create", "leads.update", "leads.convert",
        "communication.view", "communication.send",
        "tasks.view", "tasks.create", "tasks.update",
    ],
    "consultant": [
        "files.upload", "files.verify", "ai.use_assistant", "leads.view",
        "clients.view", "clients.create", "clients.update",
        "cases.view", "cases.create", "cases.update",
        "communication.view", "communication.send",
        "tasks.view", "tasks.create", "tasks.update",
    ],
    "documentation_officer": [
        "files.upload", "files.verify", "clients.view_all", "cases.view_all", "cases.update", "admissions.view_all",
        "communication.view", "communication.send",
        "tasks.view", "tasks.create", "tasks.update",
    ],
    "visa_processing_officer": [
        "files.upload", "files.verify", "workflow.transition", "clients.view_all", "cases.view_all", "cases.update",
        "communication.view", "communication.send",
        "tasks.view", "tasks.create", "tasks.update",
    ],
    "admissions_officer": [
        "files.upload", "files.verify", "workflow.transition", "clients.view_all", "cases.view_all", "cases.update",
        "admissions.view", "admissions.create", "admissions.update",
        "communication.view", "communication.send",
        "tasks.view", "tasks.create", "tasks.update",
    ],
    "finance": ["logs.view_activity", "clients.view_all", "cases.view_all", "reports.view"],
    "marketing": [
        "ai.use_assistant", "leads.view_all", "leads.create", "communication.view", "communication.send",
        "tasks.view", "tasks.create", "tasks.update",
    ],
    "reception": [
        "files.upload", "leads.create", "communication.send",
        "tasks.view", "tasks.create", "tasks.update",
    ],
    "client": ["client_portal.view_own"],  # the only permission this role has, and the only one it needs
}


async def seed_permissions(db) -> None:
    """Idempotent seed: safe to run on every deploy."""
    from sqlalchemy import select

    # Roles
    role_by_key = {}
    for key, name, description in SYSTEM_ROLES:
        existing = (await db.execute(select(Role).where(Role.key == key))).scalar_one_or_none()
        if not existing:
            existing = Role(key=key, name=name, description=description, is_system=True)
            db.add(existing)
        role_by_key[key] = existing
    await db.flush()

    # Permissions
    perm_by_key = {}
    for key, module, description in CORE_PERMISSIONS:
        existing = (await db.execute(select(Permission).where(Permission.key == key))).scalar_one_or_none()
        if not existing:
            existing = Permission(key=key, module=module, description=description)
            db.add(existing)
        perm_by_key[key] = existing
    await db.flush()

    # Grants
    for role_key, perm_keys in DEFAULT_ROLE_GRANTS.items():
        role = role_by_key[role_key]
        for perm_key in perm_keys:
            perm = perm_by_key[perm_key]
            existing = (
                await db.execute(
                    select(RolePermission).where(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id == perm.id,
                    )
                )
            ).scalar_one_or_none()
            if not existing:
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))

    await db.commit()
