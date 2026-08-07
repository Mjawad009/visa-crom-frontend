from app.core.module_registry import Module
from app.modules.ai.routes import router

module = Module(
    key="ai",
    name="AI Service",
    router=router,
    permissions=["ai.use_assistant"],
)
