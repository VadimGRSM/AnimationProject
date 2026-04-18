import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def build_project_group_name(project_id):
    return f"project_{project_id}"


def broadcast_project_event(project_id, event_type, payload):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning(
            "Channel layer unavailable for project event broadcast",
            extra={"project_id": project_id, "event_type": event_type},
        )
        return

    async_to_sync(channel_layer.group_send)(
        build_project_group_name(project_id),
        {
            "type": "project.metadata_event",
            "event_type": event_type,
            "payload": {
                "project_id": project_id,
                **(payload or {}),
            },
        },
    )
    logger.debug(
        "Broadcasted project metadata event",
        extra={
            "project_id": project_id,
            "event_type": event_type,
            "actor_user_id": (payload or {}).get("actor_user_id"),
        },
    )
