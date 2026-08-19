from app.core.module_registry import Module
from app.modules.workflow.routes import router

module = Module(
    key="workflow",
    name="Workflow Engine",
    router=router,
    permissions=["workflow.manage_definitions", "workflow.transition"],
)
