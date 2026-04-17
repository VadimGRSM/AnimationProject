from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

_legacy_path = Path(__file__).resolve().parent.parent / 'views.py'
_legacy_spec = spec_from_file_location('animation._legacy_views', _legacy_path)
if _legacy_spec is None or _legacy_spec.loader is None:
    raise ImportError('Could not load legacy animation views module.')

_legacy_module = module_from_spec(_legacy_spec)
_legacy_spec.loader.exec_module(_legacy_module)

for _name in dir(_legacy_module):
    if _name.startswith('__'):
        continue
    globals()[_name] = getattr(_legacy_module, _name)

from .sharing import (  # noqa: E402
    invite_accept,
    invite_detail,
    project_invite_create,
    project_invite_revoke,
    project_member_remove,
    project_member_role_update,
    project_share,
)
