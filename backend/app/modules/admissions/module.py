from app.core.module_registry import Module
from app.modules.admissions.routes import router

module = Module(
    key="admissions",
    name="Admissions",
    router=router,
    permissions=["admissions.view", "admissions.view_all", "admissions.create", "admissions.update"],
)
