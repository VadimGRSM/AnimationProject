from django.urls import path
from . import views

app_name = 'animation'

urlpatterns = [
    path('', views.project_list, name='project_list'),
    path('project/create/', views.project_create, name='project_create'),
    path('project/<int:pk>/editor/', views.project_editor, name='project_editor'),
]