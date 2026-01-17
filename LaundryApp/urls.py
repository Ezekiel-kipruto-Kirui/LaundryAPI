from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CustomerViewSet,
    OrderViewSet,
    OrderItemViewSet,
    ExpenseFieldViewSet,
    ExpenseRecordViewSet,
    PaymentViewSet,
    UserProfileViewSet,
    sendsms_view,
    
)

router = DefaultRouter()
router.register(r'users', UserProfileViewSet, basename='users')
router.register(r'customers', CustomerViewSet, basename='customers')
router.register(r'orders', OrderViewSet, basename='orders')
router.register(r'order-items', OrderItemViewSet, basename='order-items')
router.register(r'expense-fields', ExpenseFieldViewSet, basename='expense-fields')
router.register(r'expense-records', ExpenseRecordViewSet, basename='expense-records')
router.register(r'payments', PaymentViewSet, basename='payments')


urlpatterns = [
    path('', include(router.urls)),
  
    path('send-sms/', sendsms_view),
]
