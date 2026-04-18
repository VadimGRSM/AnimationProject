from channels.generic.websocket import AsyncWebsocketConsumer


class ProjectConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.project_id = self.scope["url_route"]["kwargs"]["project_id"]
        self.project_group_name = f"project_{self.project_id}"

        await self.channel_layer.group_add(self.project_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        project_group_name = getattr(self, "project_group_name", None)
        if project_group_name:
            await self.channel_layer.group_discard(project_group_name, self.channel_name)
