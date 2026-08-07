from app.core.module_registry import Module
from app.modules.communications.routes import router

module = Module(
    key="communications",
    name="Communications",
    router=router,
    permissions=["communication.view", "communication.send"],
)
