from app.core.module_registry import Module
from app.modules.notifications.routes import router

module = Module(
    key="notifications",
    name="Notifications",
    router=router,
    permissions=[],  # every authenticated user manages their own inbox
)
