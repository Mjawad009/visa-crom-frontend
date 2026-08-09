"""
Module Registry
================

This is the seam that makes the "Modular Monolith" promise real.

Every business module (Leads, Clients, Cases, Finance, ...) exposes a
single `Module` descriptor. The registry collects enabled modules and
wires their routers into the FastAPI app. Nothing in main.py needs to
know that "Leads" or "Finance" exist — it only knows how to load
whatever is registered and enabled.

To add a module:
    1. Create app/modules/<name>/module.py exporting a `module = Module(...)`
    2. Add "<name>" to ENABLED_MODULES in config/registry (env-driven)

To remove a module:
    1. Remove it from ENABLED_MODULES — no code elsewhere changes.

A module must NEVER import another module's internals directly.
Cross-module communication happens only through:
    - shared services (app/shared/)
    - published events (future: event bus in app/shared/events.py)
"""
from dataclasses import dataclass, field
from importlib import import_module
from typing import Callable, List, Optional

from fastapi import APIRouter, FastAPI


@dataclass
class Module:
    """Descriptor every business or core module must expose."""

    key: str                      # unique slug, e.g. "leads"
    name: str                     # display name, e.g. "Leads"
    router: APIRouter             # module's API routes
    permissions: List[str] = field(default_factory=list)  # permission keys this module defines
    on_startup: Optional[Callable] = None  # optional async hook
    on_shutdown: Optional[Callable] = None


# Modules are enabled here explicitly. Removing a module from this list
# and restarting the app is the entire "uninstall" procedure -- no other
# code changes anywhere.
ENABLED_MODULES: List[str] = [
    # --- Phase 2: Core Platform ---
    "auth",
    "permissions",
    "users",
    "branches",
    "notifications",
    "logs",
    "workflow",
    "files",
    "ai",
    # --- Business modules (Phase 4+) ---
    "leads",
    "clients",
    "cases",
    "admissions",
    "communications",
    "reports",
    "client_api",
    "tasks",
    # ...
]


def load_modules() -> List[Module]:
    """Import and return every enabled module's descriptor."""
    modules: List[Module] = []
    for key in ENABLED_MODULES:
        mod = import_module(f"app.modules.{key}.module")
        modules.append(mod.module)
    return modules


def register_modules(app: FastAPI, api_prefix: str) -> None:
    """Mount every enabled module's router onto the FastAPI app."""
    for module in load_modules():
        app.include_router(module.router, prefix=f"{api_prefix}/{module.key}", tags=[module.name])
