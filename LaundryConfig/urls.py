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
from django.views.generic import TemplateView
from .authentication import EmailTokenObtainPairView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from LaundryApp.views import CurrentUserView
# from LaundryApp.sms_utility import sendsms_view
from django.conf.urls.static import static
import os
from HotelApp.views import update_food_revenue,update_food_items_view



FRONTEND_BUILD_DIR = os.path.join(settings.BASE_DIR, 'Front-end', 'dist')


# def serve_react_app(request):
#     with open(os.path.join(settings.BASE_DIR, 'Front-end', 'dist', 'index.html'), 'r') as f:
#         return HttpResponse(f.read(), content_type='text/html')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/Laundry/', include('LaundryApp.urls')),
    path('api/Hotel/', include('HotelApp.urls')),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/Report/', include('perfomancereport.urls')),
    path('api/me/',CurrentUserView.as_view()),
    # path('api/send-sms/', sendsms_view), 
    path('api/users/me/', CurrentUserView.as_view(), name='current_user'),
    path('api/update-food-revenue/', update_food_revenue),
    path("api/update-food-items/", update_food_items_view, name="update_food_items"),
    path('assets/<path:path>', serve, {'document_root': os.path.join(settings.BASE_DIR, 'Front-end', 'dist', 'assets')}),
    path('bg.png', lambda request: serve(request, 'bg.png', document_root=FRONTEND_BUILD_DIR)),
    path('Clean-page-logo.png', lambda request: serve(request, 'Clean-page-logo.png', document_root=FRONTEND_BUILD_DIR)),
    path('favicon.ico', lambda request: serve(request, 'favicon.ico', document_root=FRONTEND_BUILD_DIR)),
    path('placeholder.svg', lambda request: serve(request, 'placeholder.svg', document_root=FRONTEND_BUILD_DIR)),
    path('robots.txt', lambda request: serve(request, 'robots.txt', document_root=FRONTEND_BUILD_DIR)),
    re_path('', TemplateView.as_view(template_name="index.html")),
 




]

# Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
