# perfomancereport/urls.py - For ViewSets
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DashboardViewSet

router = DefaultRouter()
router.register(r'Report', DashboardViewSet, basename='dashboard')

urlpatterns = [
    path('', include(router.urls)),
    
]