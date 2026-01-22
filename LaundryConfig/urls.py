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
    path('beautiful-composition-spa-bath-concept.jpg', lambda request: serve(request, 'beautiful-composition-spa-bath-concept.jpg', document_root=FRONTEND_BUILD_DIR)),
    path('Clean-apge-logo-2.png', lambda request: serve(request, 'Clean-apge-logo-2.png', document_root=FRONTEND_BUILD_DIR)),
    path('view-inside-laundromat-room-with-vintage-decor-washing-machines.jpeg', lambda request: serve(request, 'view-inside-laundromat-room-with-vintage-decor-washing-machines.jpeg', document_root=FRONTEND_BUILD_DIR)),
    path('Clean-page-logo.png', lambda request: serve(request, 'Clean-page-logo.png', document_root=FRONTEND_BUILD_DIR)),
    path('washing.jpeg', lambda request: serve(request, 'washing.jpeg', document_root=FRONTEND_BUILD_DIR)),
    path('ironing2.png', lambda request: serve(request, 'ironing2.png', document_root=FRONTEND_BUILD_DIR)),
    path('folding.png', lambda request: serve(request, 'folding.png', document_root=FRONTEND_BUILD_DIR)),
    path('carpet scraping.png', lambda request: serve(request, 'carpet scraping.png', document_root=FRONTEND_BUILD_DIR)),
    path('carpetcleaning.jpeg', lambda request: serve(request, 'carpetcleaning.jpeg', document_root=FRONTEND_BUILD_DIR)),

    path('cleancarpet.png', lambda request: serve(request, 'cleancarpet.png', document_root=FRONTEND_BUILD_DIR)),
    path('fastdryingsofa.jpeg', lambda request: serve(request, 'fastdryingsofa.jpeg', document_root=FRONTEND_BUILD_DIR)),
    path('dirtysofa.png', lambda request: serve(request, 'dirtysofa.png', document_root=FRONTEND_BUILD_DIR)),
    path('cleansofa.png', lambda request: serve(request, 'cleansofa.png', document_root=FRONTEND_BUILD_DIR)),
    path('shoepolishing.png', lambda request: serve(request, 'shoepolishing.png', document_root=FRONTEND_BUILD_DIR)),
    path('mattress_left.jpg', lambda request: serve(request, 'mattress_left.jpg', document_root=FRONTEND_BUILD_DIR)),
    path('mattress_right.jpg', lambda request: serve(request, 'mattress_right.jpg', document_root=FRONTEND_BUILD_DIR)),
    path('sofacleaning.mp4', lambda request: serve(request, 'sofacleaning.mp4', document_root=FRONTEND_BUILD_DIR)),
    path('sofacleaning2.mp4', lambda request: serve(request, 'sofacleaning2.mp4', document_root=FRONTEND_BUILD_DIR)),
    path('ironing2.png', lambda request: serve(request, 'ironing2.png', document_root=FRONTEND_BUILD_DIR)),
    path('matresscleaning.png', lambda request: serve(request, 'matresscleaning.png', document_root=FRONTEND_BUILD_DIR)),
    path('finishedshoes.png', lambda request: serve(request, 'finishedshoes.png', document_root=FRONTEND_BUILD_DIR)),
    path('snikerscleaning.png', lambda request: serve(request, 'snikerscleaning.png', document_root=FRONTEND_BUILD_DIR)),
    path('shop1.jpeg', lambda request: serve(request, 'shop1.jpeg', document_root=FRONTEND_BUILD_DIR)),
    path('shop2.jpeg', lambda request: serve(request, 'shop2.jpeg', document_root=FRONTEND_BUILD_DIR)),
    path('shop3.jpeg', lambda request: serve(request, 'shop3.jpeg', document_root=FRONTEND_BUILD_DIR)),
    path('shop4.jpeg', lambda request: serve(request, 'shop4.jpeg', document_root=FRONTEND_BUILD_DIR)),
    

    path('cleanclothes.jpg', lambda request: serve(request, 'cleanclothes.jpg', document_root=FRONTEND_BUILD_DIR)),
    path('dirtyclothes.png', lambda request: serve(request, 'dirtyclothes.png', document_root=FRONTEND_BUILD_DIR)),
    path('ironing.png', lambda request: serve(request, 'ironing.png', document_root=FRONTEND_BUILD_DIR)),
    path('ironing1.png', lambda request: serve(request, 'ironing1.png', document_root=FRONTEND_BUILD_DIR)),
    path('matressbefore.png', lambda request: serve(request, 'matressbefore.png', document_root=FRONTEND_BUILD_DIR)),
    path('matressafter.jpg', lambda request: serve(request, 'matressafter.jpg', document_root=FRONTEND_BUILD_DIR)),
    path('cleanbeddings.png', lambda request: serve(request, 'cleanbeddings.png', document_root=FRONTEND_BUILD_DIR)),
    path('dirtybeddings.png', lambda request: serve(request, 'dirtybeddings.png', document_root=FRONTEND_BUILD_DIR)),
    path('new-sneakers.jpg', lambda request: serve(request, 'new-sneakers.jpg', document_root=FRONTEND_BUILD_DIR)),
    path('dirtshoes.png', lambda request: serve(request, 'dirtshoes.png', document_root=FRONTEND_BUILD_DIR)),    
    path('favicon.ico', lambda request: serve(request, 'favicon.ico', document_root=FRONTEND_BUILD_DIR)),
    path('placeholder.svg', lambda request: serve(request, 'placeholder.svg', document_root=FRONTEND_BUILD_DIR)),
    path('robots.txt', lambda request: serve(request, 'robots.txt', document_root=FRONTEND_BUILD_DIR)),
    re_path('', TemplateView.as_view(template_name="index.html")),
 




]

# Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
