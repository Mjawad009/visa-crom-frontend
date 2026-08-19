from app.core.module_registry import Module
from app.modules.users.routes import router

module = Module(
    key="users",
    name="User Management",
    router=router,
    permissions=["users.view", "users.create", "users.update", "users.deactivate"],
)
