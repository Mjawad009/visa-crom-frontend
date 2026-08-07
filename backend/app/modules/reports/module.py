from app.core.module_registry import Module
from app.modules.reports.routes import router

module = Module(
    key="reports",
    name="Reports & Analytics",
    router=router,
    permissions=["reports.view"],
)
