from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import AnimationProject, Frame


@login_required
def project_list(request):
    projects = AnimationProject.objects.filter(owner=request.user)
    return render(request, 'animation/project_list.html', {
        'projects': projects,
    })


@login_required
def project_create(request):
    if request.method == 'POST':
        title = request.POST.get('title') or 'Новый проект'
        fps = int(request.POST.get('fps') or 12)
        width = int(request.POST.get('width') or 1280)
        height = int(request.POST.get('height') or 720)

        project = AnimationProject.objects.create(
            owner=request.user,
            title=title,
            fps=fps,
            width=width,
            height=height,
        )

        # сразу создаём первый пустой кадр
        Frame.objects.create(project=project, index=1)

        return redirect('animation:project_editor', pk=project.pk)

    return render(request, 'animation/project_create.html')


@login_required
def project_editor(request, pk):
    project = get_object_or_404(AnimationProject, pk=pk, owner=request.user)
    # пока отдаём только сам проект
    # позже сюда добавим загрузку кадра
    return render(request, 'animation/editor.html', {
        'project': project,
    })
