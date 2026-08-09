from app.core.module_registry import Module
from app.modules.tasks.routes import router

module = Module(
    key="tasks",
    name="Tasks & Calendar",
    router=router,
    permissions=["tasks.view", "tasks.view_all", "tasks.create", "tasks.update"],
)
