"""
URL configuration for LaundryConfig project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path,include,re_path
from django.shortcuts import redirect
from django.http import HttpResponse
from django.conf import settings
from django.views.static import serve
from rest_framework_simplejwt.views import TokenRefreshView

from .authentication import EmailTokenObtainPairView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from LaundryApp.views import CurrentUserView
import os


def serve_react_app(request):
    with open(os.path.join(settings.BASE_DIR, 'Front-end', 'dist', 'index.html'), 'r') as f:
        return HttpResponse(f.read(), content_type='text/html')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/Laundry/', include('LaundryApp.urls')),
    path('api/Hotel/', include('HotelApp.urls')),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/me/',CurrentUserView.as_view()),
    
    # User endpoints
    path('api/users/me/', CurrentUserView.as_view(), name='current_user'),
      # Your existing user routes
    path('assets/<path:path>', serve, {'document_root': os.path.join(settings.BASE_DIR, 'Front-end', 'dist', 'assets')}),
    re_path(r'^(?!api/|admin/|static/|assets/).*$', serve_react_app),  # Catch-all for React routes


]
