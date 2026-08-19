from app.core.module_registry import Module
from app.modules.leads.routes import router

module = Module(
    key="leads",
    name="Leads",
    router=router,
    permissions=["leads.view", "leads.view_all", "leads.create", "leads.update", "leads.convert"],
)
