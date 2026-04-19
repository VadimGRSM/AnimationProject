import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .access import get_project_connection_context
from .locks import (
    acquire_frame_lock,
    acquire_layer_lock,
    get_project_frame_lock_snapshot,
    get_project_layer_lock_snapshot,
    heartbeat_frame_lock,
    heartbeat_layer_lock,
    release_frame_locks,
    release_layer_locks,
)
from .presence import (
    activate_project_presence_session,
    deactivate_project_presence_session,
    set_project_presence_frame,
    touch_project_presence_session,
)

logger = logging.getLogger(__name__)


class ProjectConsumer(AsyncJsonWebsocketConsumer):
    BAD_REQUEST_CLOSE_CODE = 4400
    UNAUTHORIZED_CLOSE_CODE = 4401
    FORBIDDEN_CLOSE_CODE = 4403
    NOT_FOUND_CLOSE_CODE = 4404

    async def connect(self):
        raw_project_id = self.scope["url_route"]["kwargs"].get("project_id")
        try:
            project_id = int(raw_project_id)
        except (TypeError, ValueError):
            await self.close(code=self.BAD_REQUEST_CLOSE_CODE)
            return

        user = self.scope.get("user")
        if not user or not getattr(user, "is_authenticated", False):
            await self.close(code=self.UNAUTHORIZED_CLOSE_CODE)
            return

        connection_context = await self.get_connection_context(project_id, user.id)
        if not connection_context["project_exists"]:
            await self.close(code=self.NOT_FOUND_CLOSE_CODE)
            return
        if connection_context["role"] is None:
            await self.close(code=self.FORBIDDEN_CLOSE_CODE)
            return

        self.project_id = connection_context["project_id"]
        self.project_group_name = self.build_project_group_name(self.project_id)
        self.user_id = connection_context["user_id"]
        self.role = connection_context["role"]
        self.owned_layer_lock_ids = set()
        presence_state = await self.activate_presence_session()
        self.presence_session_id = presence_state["presence_session_id"]
        lock_state = await self.get_frame_lock_snapshot()
        layer_lock_state = await self.get_layer_lock_snapshot()
        self.replace_owned_layer_locks(layer_lock_state["locks"])

        await self.channel_layer.group_add(self.project_group_name, self.channel_name)
        await self.accept()
        await self.send_event(
            "connection_ready",
            {
                "project_id": self.project_id,
                "user_id": self.user_id,
                "role": self.role,
                "presence_session_id": self.presence_session_id,
            },
        )
        await self.send_event(
            "presence_snapshot",
            {
                "project_id": self.project_id,
                "users": presence_state["snapshot"],
            },
        )
        await self.send_event(
            "frame_lock_snapshot",
            {
                "project_id": self.project_id,
                "locks": lock_state["locks"],
            },
        )
        await self.send_event(
            "layer_lock_snapshot",
            {
                "project_id": self.project_id,
                "locks": layer_lock_state["locks"],
            },
        )
        await self.broadcast_released_locks(lock_state["stale_releases"])
        await self.broadcast_released_layer_locks(layer_lock_state["stale_releases"])
        if presence_state["joined_user"] is not None:
            await self.channel_layer.group_send(
                self.project_group_name,
                {
                    "type": "presence.user_joined",
                    "project_id": self.project_id,
                    "sender_channel_name": self.channel_name,
                    "user": presence_state["joined_user"],
                },
            )
        logger.info(
            "Project websocket connected",
            extra={"project_id": self.project_id, "user_id": self.user_id, "role": self.role},
        )

    async def disconnect(self, close_code):
        project_group_name = getattr(self, "project_group_name", None)
        project_id = getattr(self, "project_id", None)
        user_id = getattr(self, "user_id", None)
        presence_session_id = getattr(self, "presence_session_id", None)
        leave_state = None
        released_locks = []
        released_layer_locks = []
        if project_id and user_id and presence_session_id:
            released_locks = await self.release_all_locks()
            released_layer_locks = await self.release_all_layer_locks()
        self.owned_layer_lock_ids = set()
        if project_id and user_id:
            leave_state = await self.deactivate_presence_session()
        if project_group_name:
            await self.channel_layer.group_discard(project_group_name, self.channel_name)
        await self.broadcast_released_locks(released_locks)
        await self.broadcast_released_layer_locks(released_layer_locks)
        if project_group_name and leave_state and leave_state["left_user_id"] is not None:
            await self.channel_layer.group_send(
                project_group_name,
                {
                    "type": "presence.user_left",
                    "project_id": project_id,
                    "sender_channel_name": self.channel_name,
                    "user_id": leave_state["left_user_id"],
                },
            )
        if project_id and user_id:
            logger.info(
                "Project websocket disconnected",
                extra={
                    "project_id": project_id,
                    "user_id": user_id,
                    "close_code": close_code,
                    "released_lock_count": len(released_locks or []),
                    "released_layer_lock_count": len(released_layer_locks or []),
                },
            )

    async def receive_json(self, content, **kwargs):
        message_type = content.get("type")
        payload = content.get("payload") or {}

        if message_type == "ping":
            await self.touch_presence_session()
            await self.send_event(
                "pong",
                {
                    "project_id": self.project_id,
                    "payload": payload,
                },
            )
            return

        if message_type == "presence_set_frame":
            frame_id = payload.get("frame_id")
            frame_state = await self.update_presence_frame(frame_id)
            released_layer_locks = []
            if frame_state["changed"]:
                released_layer_locks = await self.release_all_layer_locks()
                self.remove_owned_layer_locks(released_layer_locks)
                await self.broadcast_released_layer_locks(released_layer_locks)
            if frame_state["changed"] and frame_state["user"] is not None:
                await self.channel_layer.group_send(
                    self.project_group_name,
                    {
                        "type": "presence.frame_changed",
                        "project_id": self.project_id,
                        "user": frame_state["user"],
                    },
                )
            return

        if message_type == "frame_lock_acquire":
            frame_id = payload.get("frame_id")
            lock_state = await self.acquire_frame_lock(frame_id)
            await self.broadcast_released_locks(lock_state["released"])
            if lock_state["status"] == "acquired" and lock_state["lock"] is not None:
                logger.info(
                    "Frame lock acquired",
                    extra={
                        "project_id": self.project_id,
                        "user_id": self.user_id,
                        "frame_id": lock_state["lock"]["frame_id"],
                    },
                )
                await self.channel_layer.group_send(
                    self.project_group_name,
                    {
                        "type": "frame.lock_acquired",
                        "project_id": self.project_id,
                        "lock": lock_state["lock"],
                    },
                )
            else:
                logger.info(
                    "Frame lock denied",
                    extra={
                        "project_id": self.project_id,
                        "user_id": self.user_id,
                        "frame_id": frame_id,
                        "reason": lock_state["reason"],
                    },
                )
                await self.send_event(
                    "frame_lock_denied",
                    {
                        "project_id": self.project_id,
                        "frame_id": frame_id,
                        "reason": lock_state["reason"],
                        "lock": lock_state["lock"],
                    },
                )
            return

        if message_type == "frame_lock_release":
            released_locks = await self.release_requested_locks(payload.get("frame_id"))
            await self.broadcast_released_locks(released_locks)
            if released_locks:
                logger.info(
                    "Frame lock released",
                    extra={
                        "project_id": self.project_id,
                        "user_id": self.user_id,
                        "released_lock_count": len(released_locks),
                    },
                )
            return

        if message_type == "frame_lock_heartbeat":
            heartbeat_state = await self.heartbeat_frame_lock(payload.get("frame_id"))
            await self.broadcast_released_locks(heartbeat_state["released"])
            return

        if message_type == "layer_lock_acquire":
            frame_id = payload.get("frame_id")
            layer_id = payload.get("layer_id")
            lock_state = await self.acquire_layer_lock(frame_id, layer_id)
            self.remove_owned_layer_locks(lock_state["released"])
            if lock_state["status"] == "acquired" and lock_state["lock"] is not None:
                self.add_owned_layer_lock(lock_state["lock"])
            await self.broadcast_released_layer_locks(lock_state["released"])
            if lock_state["status"] == "acquired" and lock_state["lock"] is not None:
                await self.channel_layer.group_send(
                    self.project_group_name,
                    {
                        "type": "layer.lock_acquired",
                        "project_id": self.project_id,
                        "lock": lock_state["lock"],
                    },
                )
            else:
                await self.send_event(
                    "layer_lock_denied",
                    {
                        "project_id": self.project_id,
                        "frame_id": frame_id,
                        "layer_id": layer_id,
                        "reason": lock_state["reason"],
                        "lock": lock_state["lock"],
                    },
                )
            return

        if message_type == "layer_lock_release":
            released_layer_locks = await self.release_requested_layer_locks(payload.get("layer_id"))
            self.remove_owned_layer_locks(released_layer_locks)
            await self.broadcast_released_layer_locks(released_layer_locks)
            return

        if message_type == "layer_lock_heartbeat":
            heartbeat_state = await self.heartbeat_layer_lock(payload.get("layer_id"))
            self.remove_owned_layer_locks(heartbeat_state["released"])
            await self.broadcast_released_layer_locks(heartbeat_state["released"])
            return

        if message_type in {"remote_cursor_moved", "layer_stroke_begin", "layer_stroke_segment", "layer_stroke_end"}:
            if not self.can_stream_layer_preview(payload):
                return
            await self.channel_layer.group_send(
                self.project_group_name,
                {
                    "type": f"live.{message_type}",
                    "project_id": self.project_id,
                    "sender_channel_name": self.channel_name,
                    "payload": {
                        **payload,
                        "project_id": self.project_id,
                        "user_id": self.user_id,
                        "display_name": getattr(self.scope.get("user"), "display_name", "") or getattr(self.scope.get("user"), "email", "") or f"User {self.user_id}",
                        "email": getattr(self.scope.get("user"), "email", ""),
                        "role": self.role,
                        "presence_session_id": self.presence_session_id,
                    },
                },
            )
            return

    async def send_event(self, event_type, payload):
        await self.send_json(
            {
                "type": event_type,
                "payload": payload,
            }
        )

    @staticmethod
    def build_project_group_name(project_id):
        return f"project_{project_id}"

    @database_sync_to_async
    def get_connection_context(self, project_id, user_id):
        return get_project_connection_context(project_id, user_id)

    @database_sync_to_async
    def activate_presence_session(self):
        return activate_project_presence_session(
            project_id=self.project_id,
            user_id=self.user_id,
            channel_name=self.channel_name,
            role=self.role,
        )

    @database_sync_to_async
    def deactivate_presence_session(self):
        return deactivate_project_presence_session(
            project_id=self.project_id,
            user_id=self.user_id,
            channel_name=self.channel_name,
        )

    @database_sync_to_async
    def touch_presence_session(self):
        return touch_project_presence_session(
            project_id=self.project_id,
            user_id=self.user_id,
            channel_name=self.channel_name,
        )

    @database_sync_to_async
    def update_presence_frame(self, frame_id):
        return set_project_presence_frame(
            project_id=self.project_id,
            user_id=self.user_id,
            channel_name=self.channel_name,
            frame_id=frame_id,
        )

    @database_sync_to_async
    def get_frame_lock_snapshot(self):
        return get_project_frame_lock_snapshot(project_id=self.project_id)

    @database_sync_to_async
    def get_layer_lock_snapshot(self):
        return get_project_layer_lock_snapshot(project_id=self.project_id)

    @database_sync_to_async
    def acquire_frame_lock(self, frame_id):
        return acquire_frame_lock(
            project_id=self.project_id,
            frame_id=frame_id,
            user_id=self.user_id,
            role=self.role,
            presence_session_id=self.presence_session_id,
        )

    @database_sync_to_async
    def acquire_layer_lock(self, frame_id, layer_id):
        return acquire_layer_lock(
            project_id=self.project_id,
            frame_id=frame_id,
            layer_id=layer_id,
            user_id=self.user_id,
            role=self.role,
            presence_session_id=self.presence_session_id,
        )

    @database_sync_to_async
    def release_requested_locks(self, frame_id):
        return release_frame_locks(
            project_id=self.project_id,
            user_id=self.user_id,
            presence_session_id=self.presence_session_id,
            frame_id=frame_id,
        )

    @database_sync_to_async
    def release_requested_layer_locks(self, layer_id):
        return release_layer_locks(
            project_id=self.project_id,
            user_id=self.user_id,
            presence_session_id=self.presence_session_id,
            layer_id=layer_id,
        )

    @database_sync_to_async
    def release_all_locks(self):
        return release_frame_locks(
            project_id=self.project_id,
            user_id=self.user_id,
            presence_session_id=self.presence_session_id,
            frame_id=None,
        )

    @database_sync_to_async
    def release_all_layer_locks(self):
        return release_layer_locks(
            project_id=self.project_id,
            user_id=self.user_id,
            presence_session_id=self.presence_session_id,
            layer_id=None,
        )

    @database_sync_to_async
    def heartbeat_frame_lock(self, frame_id):
        return heartbeat_frame_lock(
            project_id=self.project_id,
            frame_id=frame_id,
            user_id=self.user_id,
            presence_session_id=self.presence_session_id,
        )

    @database_sync_to_async
    def heartbeat_layer_lock(self, layer_id):
        return heartbeat_layer_lock(
            project_id=self.project_id,
            layer_id=layer_id,
            user_id=self.user_id,
            presence_session_id=self.presence_session_id,
        )

    def can_stream_layer_preview(self, payload):
        if not isinstance(payload, dict):
            return False
        frame_id = payload.get("frame_id")
        layer_id = payload.get("layer_id")
        tool = payload.get("tool")
        if tool not in {"brush", "eraser"}:
            return False
        try:
            numeric_frame_id = int(frame_id)
            numeric_layer_id = int(layer_id)
        except (TypeError, ValueError):
            return False
        return numeric_frame_id > 0 and numeric_layer_id in getattr(self, "owned_layer_lock_ids", set())

    @staticmethod
    def get_lock_layer_id(lock):
        if not isinstance(lock, dict):
            return None
        try:
            layer_id = int(lock.get("layer_id"))
        except (TypeError, ValueError):
            return None
        return layer_id if layer_id > 0 else None

    def replace_owned_layer_locks(self, locks):
        owned_layer_lock_ids = set()
        for lock in locks or []:
            if not isinstance(lock, dict):
                continue
            if lock.get("presence_session_id") != getattr(self, "presence_session_id", None):
                continue
            layer_id = self.get_lock_layer_id(lock)
            if layer_id is not None:
                owned_layer_lock_ids.add(layer_id)
        self.owned_layer_lock_ids = owned_layer_lock_ids

    def add_owned_layer_lock(self, lock):
        if not isinstance(lock, dict):
            return
        if lock.get("presence_session_id") != getattr(self, "presence_session_id", None):
            return
        layer_id = self.get_lock_layer_id(lock)
        if layer_id is None:
            return
        if not hasattr(self, "owned_layer_lock_ids"):
            self.owned_layer_lock_ids = set()
        self.owned_layer_lock_ids.add(layer_id)

    def remove_owned_layer_locks(self, locks):
        if not hasattr(self, "owned_layer_lock_ids"):
            self.owned_layer_lock_ids = set()
        for lock in locks or []:
            layer_id = self.get_lock_layer_id(lock)
            if layer_id is None:
                continue
            if lock.get("presence_session_id") == getattr(self, "presence_session_id", None) or layer_id in self.owned_layer_lock_ids:
                self.owned_layer_lock_ids.discard(layer_id)

    async def broadcast_released_locks(self, released_locks):
        for lock in released_locks or []:
            await self.channel_layer.group_send(
                self.project_group_name,
                {
                    "type": "frame.lock_released",
                    "project_id": self.project_id,
                    "lock": lock,
                },
            )

    async def broadcast_released_layer_locks(self, released_locks):
        for lock in released_locks or []:
            await self.channel_layer.group_send(
                self.project_group_name,
                {
                    "type": "layer.lock_released",
                    "project_id": self.project_id,
                    "lock": lock,
                },
            )

    async def presence_user_joined(self, event):
        if event.get("sender_channel_name") == self.channel_name:
            return
        await self.send_event(
            "presence_user_joined",
            {
                "project_id": event["project_id"],
                "user": event["user"],
            },
        )

    async def frame_lock_acquired(self, event):
        await self.send_event(
            "frame_lock_acquired",
            {
                "project_id": event["project_id"],
                "lock": event["lock"],
            },
        )

    async def frame_lock_released(self, event):
        await self.send_event(
            "frame_lock_released",
            {
                "project_id": event["project_id"],
                "lock": event["lock"],
            },
        )

    async def layer_lock_acquired(self, event):
        self.add_owned_layer_lock(event["lock"])
        await self.send_event(
            "layer_lock_acquired",
            {
                "project_id": event["project_id"],
                "lock": event["lock"],
            },
        )

    async def layer_lock_released(self, event):
        self.remove_owned_layer_locks([event["lock"]])
        await self.send_event(
            "layer_lock_released",
            {
                "project_id": event["project_id"],
                "lock": event["lock"],
            },
        )

    async def project_metadata_event(self, event):
        await self.send_event(
            event["event_type"],
            event["payload"],
        )

    async def presence_user_left(self, event):
        if event.get("sender_channel_name") == self.channel_name:
            return
        await self.send_event(
            "presence_user_left",
            {
                "project_id": event["project_id"],
                "user_id": event["user_id"],
            },
        )

    async def presence_frame_changed(self, event):
        await self.send_event(
            "presence_frame_changed",
            {
                "project_id": event["project_id"],
                "user": event["user"],
            },
        )

    async def live_remote_cursor_moved(self, event):
        if event.get("sender_channel_name") == self.channel_name:
            return
        await self.send_event("remote_cursor_moved", event["payload"])

    async def live_layer_stroke_begin(self, event):
        if event.get("sender_channel_name") == self.channel_name:
            return
        await self.send_event("layer_stroke_begin", event["payload"])

    async def live_layer_stroke_segment(self, event):
        if event.get("sender_channel_name") == self.channel_name:
            return
        await self.send_event("layer_stroke_segment", event["payload"])

    async def live_layer_stroke_end(self, event):
        if event.get("sender_channel_name") == self.channel_name:
            return
        await self.send_event("layer_stroke_end", event["payload"])
