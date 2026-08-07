from app.core.module_registry import Module
from app.modules.files.routes import router

module = Module(
    key="files",
    name="File Service",
    router=router,
    permissions=["files.upload", "files.verify", "files.delete"],
)
