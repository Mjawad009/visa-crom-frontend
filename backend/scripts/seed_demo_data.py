"""
Seeds a realistic demo dataset: branches, staff across every role, leads
moving through the pipeline, converted clients, cases and admission
applications at various stages, tasks (including an overdue one and a
recurring one), a few notifications, and some communication log entries.

Run with:  python -m scripts.seed_demo_data

Deliberately goes through the real service layer (LeadService.transition,
CaseService.create_case, etc.) rather than inserting rows directly — that
way every activity log entry, workflow history row, and business-rule
check (e.g. "can't open a case for an inactive client") fires exactly
like it would from the API, so the demo data looks and behaves like
real usage rather than a raw DB dump.

Idempotent-ish: safe to run multiple times, but every run adds a *new*
batch of leads/cases/etc. (this is demo data, not structural seed data —
re-running scripts/seed.py's seed_permissions() etc. is idempotent by
design, but demo business records aren't meant to be deduplicated).
If you want a clean slate, wipe the DB and re-run migrations first.

NOT included: file/document uploads. Those need real object storage
credentials (R2_BUCKET_NAME / R2_ENDPOINT_URL) to generate a working
presigned upload URL — without them there's nothing to seed a working
Documents panel with. Upload a couple of sample PDFs by hand through the
UI once storage is configured; everything else in this script doesn't
depend on that.
"""
import asyncio
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.modules.admissions.schemas import AdmissionApplicationCreate
from app.modules.admissions.service import AdmissionService
from app.modules.branches.models import Branch
from app.modules.branches.schemas import BranchCreate
from app.modules.branches.service import BranchService
from app.modules.cases.schemas import CaseCreate
from app.modules.cases.service import CaseService
from app.modules.clients.schemas import ClientCreate
from app.modules.clients.service import ClientService
from app.modules.communications.schemas import CommunicationCreate
from app.modules.communications.service import CommunicationService
from app.modules.leads.schemas import LeadCreate
from app.modules.leads.service import LeadService
from app.modules.notifications.schemas import NotificationCreate
from app.modules.notifications.service import NotificationService
from app.modules.permissions.models import Role
from app.modules.permissions.seed import seed_permissions
from app.modules.admissions.seed import seed_admissions_pipeline
from app.modules.cases.seed import seed_case_pipeline
from app.modules.files.seed import seed_document_categories
from app.modules.leads.seed import seed_lead_pipeline
from app.modules.tasks.schemas import TaskCreate
from app.modules.tasks.service import TaskService
from app.modules.users.schemas import UserCreate
from app.modules.users.service import UserService

random.seed(42)  # reproducible demo data across runs

NOW = datetime.now(timezone.utc)
DEMO_PASSWORD = "Demo1234!"

FIRST_NAMES = [
    "Amara", "Ravi", "Sofia", "Kwame", "Yuki", "Fatima", "Diego", "Priya", "Chidi", "Elena",
    "Hassan", "Mei", "Carlos", "Aisha", "Lucas", "Ingrid", "Tariq", "Noor", "Santiago", "Zara",
    "Kenji", "Olamide", "Valentina", "Youssef", "Anya", "Bilal", "Camila", "Dmitri", "Esi", "Farid",
]
LAST_NAMES = [
    "Okafor", "Singh", "Alvarez", "Mensah", "Tanaka", "Al-Sayed", "Rodriguez", "Sharma", "Nwosu", "Petrova",
    "Khan", "Chen", "Diaz", "Bello", "Silva", "Larsen", "Rahman", "Haddad", "Torres", "Yusuf",
    "Sato", "Adeyemi", "Moreno", "Naser", "Kowalski", "Malik", "Fernandes", "Volkov", "Owusu", "Karimi",
]
COUNTRIES = ["Canada", "United Kingdom", "Australia", "United States", "Germany", "New Zealand", "Ireland"]
VISA_TYPES = ["Study Visa", "Skilled Worker Visa", "Family Sponsorship", "Visitor Visa", "Post-Graduate Work Permit"]
LEAD_SOURCES = ["website", "referral", "social_media", "walk_in", "agent_partner", "other"]
INSTITUTIONS = [
    "University of Toronto", "Conestoga College", "University of Manchester", "Melbourne Polytechnic",
    "Trinity College Dublin", "Humber College", "University of Auckland", "Seneca Polytechnic",
]

_used_names: set[str] = set()


def random_name() -> str:
    while True:
        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        if name not in _used_names:
            _used_names.add(name)
            return name


def slugify_email(name: str, domain: str = "example.com") -> str:
    return f"{name.lower().replace(' ', '.')}{random.randint(1, 999)}@{domain}"


async def seed_branches(db) -> list[Branch]:
    service = BranchService(db)
    existing = await service.list_branches(include_inactive=True)
    if existing:
        return existing

    specs = [
        ("Toronto HQ", "TOR-01", "100 King St W, Toronto, ON", "+1 416 555 0100", "toronto@example.com"),
        ("Vancouver Branch", "VAN-01", "500 Burrard St, Vancouver, BC", "+1 604 555 0100", "vancouver@example.com"),
        ("Dubai Branch", "DXB-01", "Sheikh Zayed Rd, Dubai, UAE", "+971 4 555 0100", "dubai@example.com"),
    ]
    branches = []
    for name, code, address, phone, email in specs:
        branches.append(await service.create_branch(BranchCreate(name=name, code=code, address=address, phone=phone, email=email)))
    return branches


async def seed_users(db, branches: list[Branch]) -> dict[str, list]:
    """Returns users grouped by role key, e.g. {"consultant": [User, ...]}."""
    roles = {r.key: r for r in (await db.execute(select(Role))).scalars().all()}
    service = UserService(db)

    # (role_key, count, branch_or_None) — None branch = CEO/finance/marketing, company-wide
    plan = [
        ("ceo", 1, None),
        ("branch_manager", 1, branches[0]),
        ("branch_manager", 1, branches[1]),
        ("sales", 2, branches[0]),
        ("sales", 1, branches[1]),
        ("consultant", 3, branches[0]),
        ("consultant", 2, branches[1]),
        ("consultant", 1, branches[2]),
        ("documentation_officer", 1, branches[0]),
        ("visa_processing_officer", 1, branches[0]),
        ("admissions_officer", 1, branches[1]),
        ("finance", 1, None),
        ("marketing", 1, None),
        ("reception", 1, branches[0]),
    ]

    by_role: dict[str, list] = {}
    for role_key, count, branch in plan:
        role = roles.get(role_key)
        if not role:
            continue
        for _ in range(count):
            name = random_name()
            user = await service.create_user(
                UserCreate(
                    email=slugify_email(name, "consultancydemo.com"),
                    password=DEMO_PASSWORD,
                    full_name=name,
                    role_id=role.id,
                    branch_id=branch.id if branch else None,
                ),
                actor_user_id=None,  # bootstrap-style creation, no acting admin yet
            )
            by_role.setdefault(role_key, []).append(user)
    return by_role


async def seed_leads(db, branches: list[Branch], staff: dict[str, list]) -> list:
    service = LeadService(db)
    assignees = staff.get("sales", []) + staff.get("consultant", [])
    leads = []

    # Distribution across stages: some brand new, some further along,
    # some converted, some lost — gives every list/filter something to show.
    stage_plan = (
        ["new"] * 6
        + ["contacted"] * 6
        + ["qualified"] * 5
        + ["proposal_sent"] * 4
        + ["converted"] * 6
        + ["lost"] * 3
    )

    for stage in stage_plan:
        name = random_name()
        branch = random.choice(branches)
        assignee = random.choice(assignees) if assignees else None
        lead = await service.create_lead(
            LeadCreate(
                full_name=name,
                email=slugify_email(name),
                phone=f"+1 555 {random.randint(1000, 9999)}",
                source=random.choice(LEAD_SOURCES),
                country_of_interest=random.choice(COUNTRIES),
                visa_type_interest=random.choice(VISA_TYPES),
                notes="Seeded demo lead.",
                branch_id=branch.id,
                assigned_to_user_id=assignee.id if assignee else None,
            ),
            actor_user_id=assignee.id if assignee else None,
        )
        actor = assignee.id if assignee else None

        if stage in ("contacted", "qualified", "proposal_sent", "converted"):
            lead = await service.transition(lead.id, "contact", actor_user_id=actor)
        if stage in ("qualified", "proposal_sent", "converted"):
            lead = await service.transition(lead.id, "qualify", actor_user_id=actor)
        if stage in ("proposal_sent", "converted"):
            lead = await service.transition(lead.id, "send_proposal", actor_user_id=actor)
        if stage == "converted":
            lead = await service.transition(lead.id, "convert", actor_user_id=actor)
        if stage == "lost":
            # Lose it from wherever it happens to be (fresh "new" here).
            lead = await service.transition(lead.id, "mark_lost", actor_user_id=actor)

        leads.append(lead)
    return leads


async def seed_clients(db, branches: list[Branch], staff: dict[str, list], leads: list) -> list:
    service = ClientService(db)
    consultants = staff.get("consultant", [])
    clients = []

    converted_leads = [l for l in leads if l.current_stage_key == "converted"]
    for lead in converted_leads:
        consultant = random.choice(consultants) if consultants else None
        client = await service.create_client(
            ClientCreate(
                full_name=lead.full_name,
                email=lead.email,
                phone=lead.phone,
                date_of_birth=date(1985 + random.randint(0, 20), random.randint(1, 12), random.randint(1, 28)),
                nationality=random.choice(["Nigerian", "Indian", "Brazilian", "Filipino", "Kenyan", "Vietnamese", "Egyptian"]),
                passport_number=f"P{random.randint(10000000, 99999999)}",
                passport_expiry=date(2027 + random.randint(0, 4), random.randint(1, 12), 1),
                address="123 Demo St",
                branch_id=lead.branch_id,
                assigned_consultant_id=consultant.id if consultant else None,
                lead_id=lead.id,
            ),
            actor_user_id=consultant.id if consultant else None,
        )
        clients.append(client)

    # A handful of direct clients too (no lead history — e.g. referred
    # straight to a consultant, common enough to be worth modeling).
    for _ in range(3):
        name = random_name()
        branch = random.choice(branches)
        consultant = random.choice(consultants) if consultants else None
        client = await service.create_client(
            ClientCreate(
                full_name=name,
                email=slugify_email(name),
                phone=f"+1 555 {random.randint(1000, 9999)}",
                nationality=random.choice(["Ghanaian", "Colombian", "Pakistani", "Ukrainian"]),
                passport_number=f"P{random.randint(10000000, 99999999)}",
                branch_id=branch.id,
                assigned_consultant_id=consultant.id if consultant else None,
            ),
            actor_user_id=consultant.id if consultant else None,
        )
        clients.append(client)

    return clients


async def seed_cases(db, staff: dict[str, list], clients: list) -> list:
    service = CaseService(db)
    officers = staff.get("visa_processing_officer", []) + staff.get("documentation_officer", []) + staff.get("consultant", [])
    cases = []

    case_types = ["study_visa", "skilled_worker", "family_sponsorship", "visitor_visa"]
    # (how many "advance" transitions to apply, close_unsuccessful afterward?)
    stage_plan = [
        (0, False), (1, False), (2, False), (3, False), (4, False),
        (5, False), (6, False), (9, False),  # reaches post_visa_support (terminal, successful)
        (2, True), (4, True),  # closed unsuccessful partway through
    ]

    # Only clients converted from a lead (or the direct ones) are eligible —
    # create_case requires an *active* client, which all of these are.
    eligible_clients = [c for c in clients if c.is_active]
    for i, (advances, close_bad) in enumerate(stage_plan):
        if not eligible_clients:
            break
        client = eligible_clients[i % len(eligible_clients)]
        officer = random.choice(officers) if officers else None
        case = await service.create_case(
            CaseCreate(
                client_id=client.id,
                case_type=random.choice(case_types),
                destination_country=random.choice(COUNTRIES),
                visa_type=random.choice(VISA_TYPES),
                priority=random.choice(["low", "normal", "normal", "high", "urgent"]),
                target_submission_date=date.today() + timedelta(days=random.randint(14, 120)),
                notes="Seeded demo case.",
                assigned_consultant_id=officer.id if officer else None,
            ),
            actor_user_id=officer.id if officer else None,
        )
        for _ in range(advances):
            case = await service.transition(case.id, "advance", actor_user_id=officer.id if officer else None)
        if close_bad:
            case = await service.transition(case.id, "close_unsuccessful", actor_user_id=officer.id if officer else None)
        cases.append(case)

    return cases


async def seed_admissions(db, staff: dict[str, list], clients: list) -> list:
    service = AdmissionService(db)
    officers = staff.get("admissions_officer", []) + staff.get("consultant", [])
    apps = []

    stage_plan = [(0, False), (1, False), (2, False), (3, False), (5, False), (2, True)]
    eligible_clients = [c for c in clients if c.is_active]
    for i, (advances, close_bad) in enumerate(stage_plan):
        if not eligible_clients:
            break
        client = eligible_clients[(i + 2) % len(eligible_clients)]
        officer = random.choice(officers) if officers else None
        app = await service.create_application(
            AdmissionApplicationCreate(
                client_id=client.id,
                institution_name=random.choice(INSTITUTIONS),
                program_name=random.choice(["Business Administration", "Computer Science", "Nursing", "Data Analytics"]),
                country=random.choice(COUNTRIES),
                intake_term=random.choice(["Fall 2026", "Winter 2027", "Spring 2027"]),
                notes="Seeded demo admission application.",
                assigned_officer_id=officer.id if officer else None,
            ),
            actor_user_id=officer.id if officer else None,
        )
        for _ in range(advances):
            app = await service.transition(app.id, "advance", actor_user_id=officer.id if officer else None)
        if close_bad:
            app = await service.transition(app.id, "close_unsuccessful", actor_user_id=officer.id if officer else None)
        apps.append(app)

    return apps


async def seed_tasks(db, staff: dict[str, list], leads: list, clients: list, cases: list) -> None:
    service = TaskService(db)
    all_staff = [u for group in staff.values() for u in group]
    if not all_staff:
        return

    def pick_link():
        pool = [("lead", l.id) for l in leads] + [("client", c.id) for c in clients] + [("case", c.id) for c in cases]
        return random.choice(pool) if pool and random.random() < 0.6 else (None, None)

    specs = [
        # (title, task_type, days_from_now, recurrence)
        ("Follow up on IELTS results", "follow_up", 1, None),
        ("Initial consultation call", "call", 2, None),
        ("Document checklist review", "task", 3, None),
        ("Visa interview prep session", "meeting", 5, None),
        ("Client onboarding appointment", "appointment", 4, None),
        ("Chase outstanding bank statement", "follow_up", -2, None),  # overdue
        ("Weekly pipeline check-in", "meeting", 7, "weekly"),  # recurring
        ("Submit application to institution", "task", 6, None),
        ("Confirm biometrics appointment", "appointment", 10, None),
        ("Call client re: offer letter", "call", -1, None),  # overdue
        ("Monthly compliance review", "task", 14, "monthly"),  # recurring
        ("Send fee reminder", "follow_up", 3, None),
        ("Review medical exam results", "task", 8, None),
        ("Interview follow-up call", "call", 9, None),
        ("Passport renewal reminder", "follow_up", 20, None),
    ]

    for title, task_type, days_offset, recurrence in specs:
        assignee = random.choice(all_staff)
        entity_type, entity_id = pick_link()
        await service.create_task(
            TaskCreate(
                title=title,
                task_type=task_type,
                due_at=NOW + timedelta(days=days_offset),
                assigned_to_user_id=assignee.id,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id else None,
                reminder_minutes_before=30,
                reminder_channel="in_app",
                recurrence=recurrence,
            ),
            actor_user_id=assignee.id,
        )

    # A couple of already-completed tasks, so the "Completed" filter has
    # something to show too.
    for title in ["Sent welcome email", "Verified passport copy"]:
        assignee = random.choice(all_staff)
        task = await service.create_task(
            TaskCreate(title=title, task_type="task", due_at=NOW - timedelta(days=5), assigned_to_user_id=assignee.id),
            actor_user_id=assignee.id,
        )
        await service.complete_task(task.id, actor_user_id=assignee.id)


async def seed_notifications(db, staff: dict[str, list]) -> None:
    service = NotificationService(db)
    all_staff = [u for group in staff.values() for u in group]
    if not all_staff:
        return

    specs = [
        ("New lead assigned", "A new lead was just assigned to you.", "info", True),
        ("Case advanced to Submission", "One of your cases moved to the Submission stage.", "success", True),
        ("Document expiring soon", "A client's passport expires within 30 days.", "warning", False),
        ("Task overdue", "You have an overdue follow-up task.", "warning", False),
        ("Admission offer received", "An institution sent back an offer letter.", "success", True),
    ]
    for _ in range(10):
        title, body, ntype, is_read = random.choice(specs)
        user = random.choice(all_staff)
        notif = await service.notify(
            NotificationCreate(user_id=user.id, title=title, body=body, type=ntype, send_email=False)
        )
        if is_read:
            await service.mark_read(notif.id, user.id)


async def seed_communications(db, staff: dict[str, list], leads: list, clients: list) -> None:
    service = CommunicationService(db)
    all_staff = [u for group in staff.values() for u in group]
    if not all_staff:
        return

    notes = [
        "Called and left a voicemail, will try again tomorrow.",
        "Client confirmed they've gathered all required documents.",
        "Discussed timeline expectations — aiming for next intake.",
        "Sent over the fee structure and service agreement.",
        "Client had questions about the medical exam requirement.",
    ]
    pool = [("lead", l.id, l.email) for l in leads[:10]] + [("client", c.id, c.email) for c in clients[:8]]
    for entity_type, entity_id, email in pool:
        sender = random.choice(all_staff)
        channel = random.choice(["internal_note", "internal_note", "email"])
        await service.create(
            CommunicationCreate(
                entity_type=entity_type,
                entity_id=str(entity_id),
                channel=channel,
                subject="Follow-up" if channel == "email" else None,
                body=random.choice(notes),
                recipient_email=email if channel == "email" else None,
            ),
            actor_user_id=sender.id,
        )


async def main() -> None:
    async with AsyncSessionLocal() as db:
        # Structural seed first (idempotent) — roles, permissions,
        # pipeline definitions, document categories. Safe even if
        # scripts/seed.py already ran.
        await seed_permissions(db)
        await seed_lead_pipeline(db)
        await seed_case_pipeline(db)
        await seed_admissions_pipeline(db)
        await seed_document_categories(db)

        print("Seeding branches...")
        branches = await seed_branches(db)

        print("Seeding staff users...")
        staff = await seed_users(db, branches)
        total_staff = sum(len(v) for v in staff.values())

        print("Seeding leads...")
        leads = await seed_leads(db, branches, staff)

        print("Seeding clients...")
        clients = await seed_clients(db, branches, staff, leads)

        print("Seeding cases...")
        cases = await seed_cases(db, staff, clients)

        print("Seeding admission applications...")
        admissions = await seed_admissions(db, staff, clients)

        print("Seeding tasks...")
        await seed_tasks(db, staff, leads, clients, cases)

        print("Seeding notifications...")
        await seed_notifications(db, staff)

        print("Seeding communication logs...")
        await seed_communications(db, staff, leads, clients)

        print()
        print("Demo data seeded:")
        print(f"  {len(branches)} branches")
        print(f"  {total_staff} staff users (password for all: {DEMO_PASSWORD})")
        print(f"  {len(leads)} leads")
        print(f"  {len(clients)} clients")
        print(f"  {len(cases)} cases")
        print(f"  {len(admissions)} admission applications")
        print()
        print("Log in as any seeded user's email — every one uses the same demo password above.")
        print("The CEO account has full access and no branch restriction; a good first login.")


if __name__ == "__main__":
    asyncio.run(main())
