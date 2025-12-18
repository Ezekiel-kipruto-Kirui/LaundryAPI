from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CustomerViewSet, OrderViewSet, OrderItemViewSet,
    ExpenseFieldViewSet, ExpenseRecordViewSet, PaymentViewSet,
    UserProfileViewset
)

router = DefaultRouter()
router.register(r'users', UserProfileViewset)
router.register(r'customers', CustomerViewSet)
router.register(r'orders', OrderViewSet)
router.register(r'order-items', OrderItemViewSet)
router.register(r'expense-fields', ExpenseFieldViewSet)
router.register(r'expense-records', ExpenseRecordViewSet)
router.register(r'payments', PaymentViewSet)



urlpatterns = [
    path('', include(router.urls)),
    
]
