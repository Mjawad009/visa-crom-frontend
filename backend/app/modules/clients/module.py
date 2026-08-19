from app.core.module_registry import Module
from app.modules.clients.routes import router

module = Module(
    key="clients",
    name="Clients",
    router=router,
    permissions=["clients.view", "clients.view_all", "clients.create", "clients.update", "clients.deactivate"],
)
