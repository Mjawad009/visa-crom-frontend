from app.core.module_registry import Module
from app.modules.permissions.routes import router

module = Module(
    key="permissions",
    name="Permission Engine",
    router=router,
    permissions=["roles.manage"],
)
