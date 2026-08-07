from app.core.module_registry import Module
from app.modules.cases.routes import router

module = Module(
    key="cases",
    name="Cases",
    router=router,
    permissions=["cases.view", "cases.view_all", "cases.create", "cases.update"],
)
