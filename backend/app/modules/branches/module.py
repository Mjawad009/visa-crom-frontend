from app.core.module_registry import Module
from app.modules.branches.routes import router

module = Module(
    key="branches",
    name="Branch Management",
    router=router,
    permissions=["branches.view", "branches.manage"],
)
