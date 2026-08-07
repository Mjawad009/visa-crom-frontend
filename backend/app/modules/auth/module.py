from app.core.module_registry import Module
from app.modules.auth.routes import router

module = Module(
    key="auth",
    name="Authentication",
    router=router,
    permissions=[],  # login is public; no permission gates its own routes
)
