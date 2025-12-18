# hotel/views.py

from rest_framework import viewsets, permissions
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import get_user_model

from .models import (
    FoodCategory, FoodItem, 
    HotelOrder, HotelOrderItem,
    HotelExpenseField, HotelExpenseRecord
)

from .serializers import (
    FoodCategorySerializer, FoodItemSerializer,
    HotelOrderSerializer, HotelOrderItemSerializer,
    HotelExpenseFieldSerializer, HotelExpenseRecordSerializer,
    SimpleFoodItemSerializer, SimpleHotelOrderSerializer
)
from LaundryApp.pagination import CustomPageNumberPagination


User = get_user_model()


# ---------------------------
#   FOOD CATEGORY VIEWSET
# ---------------------------
class FoodCategoryViewSet(viewsets.ModelViewSet):
    queryset = FoodCategory.objects.all()
    serializer_class = FoodCategorySerializer
    #permission_classes = [AllowAny]
    permission_classes = [permissions.IsAuthenticated]
    """permissions.IsAuthenticated"""


# ---------------------------
#   FOOD ITEM VIEWSET
# ---------------------------
class FoodItemViewSet(viewsets.ModelViewSet):
    queryset = FoodItem.objects.all().select_related("category", "created_by")
    #permission_classes = [AllowAny]
    permission_classes = [permissions.IsAuthenticated]
    ""  "permissions.IsAuthenticated"""
    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return FoodItemSerializer
        return FoodItemSerializer


# ---------------------------
#   HOTEL ORDER ITEM VIEWSET
# ---------------------------
class HotelOrderItemViewSet(viewsets.ModelViewSet):
    queryset = HotelOrderItem.objects.all().select_related("food_item", "order")
    serializer_class = HotelOrderItemSerializer
    #permission_classes = [permissions.IsAuthenticated]
    permission_classes = [AllowAny]
    pagination_class = CustomPageNumberPagination

# ---------------------------
#   HOTEL ORDER VIEWSET
# ---------------------------
class HotelOrderViewSet(viewsets.ModelViewSet):
    queryset = HotelOrder.objects.all().select_related("created_by")
    permission_classes = [permissions.IsAuthenticated]
    #permission_classes = [AllowAny]

    def get_serializer_class(self):
        if self.action in ["list"]: 
            return SimpleHotelOrderSerializer
        return HotelOrderSerializer


# ---------------------------
#   EXPENSE FIELD VIEWSET
# ---------------------------
class HotelExpenseFieldViewSet(viewsets.ModelViewSet):
    queryset = HotelExpenseField.objects.all()
    serializer_class = HotelExpenseFieldSerializer
    permission_classes = [permissions.IsAuthenticated]
    #permission_classes = [AllowAny]

# ---------------------------
#   EXPENSE RECORD VIEWSET
# ---------------------------
class HotelExpenseRecordViewSet(viewsets.ModelViewSet):
    queryset = HotelExpenseRecord.objects.all().select_related("field")
    serializer_class = HotelExpenseRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    #permission_classes = [AllowAny]