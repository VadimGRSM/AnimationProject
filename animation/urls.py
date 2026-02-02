from django.urls import path
from . import views

app_name = 'animation'

urlpatterns = [
    path('', views.project_list, name='project_list'),
    path('project/create/', views.project_create, name='project_create'),
    path('project/<int:pk>/editor/', views.project_editor, name='project_editor'),
    path('project/<int:pk>/rename/', views.project_rename, name='project_rename'),
    path('project/<int:pk>/delete/', views.project_delete, name='project_delete'),
    path('project/<int:pk>/save/', views.project_save, name='project_save'),
    path('api/project/<int:pk>/frame/<int:index>/save/', views.frame_save, name='frame_save'),
    path('api/project/<int:pk>/frame/<int:index>/layers/', views.frame_layers, name='frame_layers'),
    path('api/project/<int:pk>/frame/<int:index>/layers/reorder/', views.layer_reorder, name='layer_reorder'),
    path(
        'api/project/<int:pk>/frame/<int:index>/layers/<int:layer_id>/update/',
        views.layer_update,
        name='layer_update',
    ),
    path(
        'api/project/<int:pk>/frame/<int:index>/layers/<int:layer_id>/delete/',
        views.layer_delete,
        name='layer_delete',
    ),
]