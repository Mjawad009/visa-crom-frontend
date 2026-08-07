from app.core.module_registry import Module
from app.modules.client_api.routes import router

module = Module(
    key="me",  # mounts at /api/v1/me/... — "my own data", from the client's perspective
    name="Client Self-Service API",
    router=router,
    permissions=["client_portal.view_own"],
)
