# hotel/urls.py

from rest_framework.routers import DefaultRouter
from .views import (
    FoodCategoryViewSet, FoodItemViewSet,
    HotelOrderViewSet, HotelOrderItemViewSet,
    HotelExpenseFieldViewSet, HotelExpenseRecordViewSet
    # ,user_sales_summary
)
from django.urls import path, include
router = DefaultRouter()

router.register("food-categories", FoodCategoryViewSet)
router.register("food-items", FoodItemViewSet)
router.register("orders", HotelOrderViewSet)
router.register("order-items", HotelOrderItemViewSet)
router.register("Hotelexpense-fields", HotelExpenseFieldViewSet)
router.register("Hotelexpense-records", HotelExpenseRecordViewSet)

urlpatterns = [
    path('',include(router.urls)),
    # path('user_sales/',user_sales_summary)
] 

"""

food-categories
food-items
orders
order-item
expense-fields
expense-records


"""
