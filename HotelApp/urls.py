# hotel/urls.py

from rest_framework.routers import DefaultRouter
from .views import (
    FoodCategoryViewSet, FoodItemViewSet,
    HotelOrderViewSet, HotelOrderItemViewSet,
    HotelExpenseFieldViewSet, HotelExpenseRecordViewSet
)

router = DefaultRouter()

router.register("food-categories", FoodCategoryViewSet)
router.register("food-items", FoodItemViewSet)
router.register("orders", HotelOrderViewSet)
router.register("order-items", HotelOrderItemViewSet)
router.register("Hotelexpense-fields", HotelExpenseFieldViewSet)
router.register("Hotelexpense-records", HotelExpenseRecordViewSet)

urlpatterns = router.urls

"""

food-categories
food-items
orders
order-item
expense-fields
expense-records


"""
