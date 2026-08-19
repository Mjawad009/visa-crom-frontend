from app.core.module_registry import Module
from app.modules.logs.routes import router

module = Module(
    key="logs",
    name="Activity & Audit Logs",
    router=router,
    permissions=["logs.view_activity", "logs.view_audit"],
)
