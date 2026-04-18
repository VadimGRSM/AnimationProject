from django.urls import path
from . import views

app_name = 'animation'

urlpatterns = [
    path('favicon.ico', views.favicon, name='favicon'),
    path('favicon.png', views.favicon, name='favicon_png'),
    path('robots.txt', views.robots_txt, name='robots_txt'),
    path('security.txt', views.security_txt, name='security_txt'),
    path('.well-known/security.txt', views.security_txt, name='security_txt_well_known'),
    path('sitemap.xml', views.sitemap_xml, name='sitemap_xml'),
    path('', views.project_list, name='project_list'),
    path('project/create/', views.project_create, name='project_create'),
    path('project/<int:pk>/share/', views.project_share, name='project_share'),
    path('project/<int:pk>/invite/', views.project_invite_create, name='project_invite_create'),
    path(
        'project/<int:pk>/members/<int:member_id>/role/',
        views.project_member_role_update,
        name='project_member_role_update',
    ),
    path(
        'project/<int:pk>/members/<int:member_id>/remove/',
        views.project_member_remove,
        name='project_member_remove',
    ),
    path(
        'project/<int:pk>/invite/<int:invite_id>/revoke/',
        views.project_invite_revoke,
        name='project_invite_revoke',
    ),
    path('project/<int:pk>/editor/', views.project_editor, name='project_editor'),
    path('project/<int:pk>/rename/', views.project_rename, name='project_rename'),
    path('project/<int:pk>/delete/', views.project_delete, name='project_delete'),
    path('project/<int:pk>/save/', views.project_save, name='project_save'),
    path('invites/<str:token>/', views.invite_detail, name='invite_detail'),
    path('invites/<str:token>/accept/', views.invite_accept, name='invite_accept'),
    path('api/project/<int:pk>/update/', views.project_update, name='project_update'),
    path('api/project/<int:pk>/frames/', views.frames_list, name='frames_list'),
    path('api/project/<int:pk>/frames/create/', views.frame_create, name='frame_create'),
    path('api/project/<int:pk>/frames/reorder/', views.frame_reorder, name='frame_reorder'),
    path('api/project/<int:pk>/frame/<int:index>/', views.frame_detail, name='frame_detail'),
    path('api/project/<int:pk>/frame/<int:index>/delete/', views.frame_delete, name='frame_delete'),
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
    path('api/project/<int:pk>/export/', views.project_export, name='project_export'),
    path(
        'api/project/<int:pk>/export/download/<str:token>/',
        views.project_export_download,
        name='project_export_download',
    ),
]