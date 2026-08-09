"""
Importing this module has the side effect of registering every model
with SQLAlchemy's declarative Base — required so that string-based
relationship references (e.g. User.role -> "Role") resolve correctly,
and so Alembic's autogenerate can see the full schema.

This is the one file in the project allowed to know every module's
models module exists. Business logic never imports from here; only
app/main.py (at startup) and alembic/env.py do.
"""
from app.modules.branches import models as _branches_models  # noqa: F401
from app.modules.permissions import models as _permissions_models  # noqa: F401
from app.modules.users import models as _users_models  # noqa: F401
from app.modules.auth import models as _auth_models  # noqa: F401
from app.modules.notifications import models as _notifications_models  # noqa: F401
from app.modules.logs import models as _logs_models  # noqa: F401
from app.modules.workflow import models as _workflow_models  # noqa: F401
from app.modules.files import models as _files_models  # noqa: F401
from app.modules.leads import models as _leads_models  # noqa: F401
from app.modules.clients import models as _clients_models  # noqa: F401
from app.modules.cases import models as _cases_models  # noqa: F401
from app.modules.admissions import models as _admissions_models  # noqa: F401
from app.modules.communications import models as _communications_models  # noqa: F401
from app.modules.tasks import models as _tasks_models  # noqa: F401
