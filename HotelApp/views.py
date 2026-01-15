# hotel/views.py

from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db.models import Sum, Count
from datetime import datetime, timedelta
from django.utils import timezone
from .models import FoodItem, HotelOrder, HotelOrderItem

from .models import (
    FoodCategory, FoodItem, 
    HotelOrder, HotelOrderItem,
    HotelExpenseField, HotelExpenseRecord
)

from .serializers import (
    FoodCategorySerializer, FoodItemSerializer,
    HotelOrderSerializer, HotelOrderItemSerializer,
    HotelExpenseFieldSerializer, HotelExpenseRecordSerializer,
    HotelOrderCreateSerializer
)
from LaundryApp.pagination import CustomPageNumberPagination


User = get_user_model()

from django.db.models import Sum
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import HotelOrderItem, FoodItem
from rest_framework.decorators import api_view, permission_classes
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

# @api_view(['GET']) # This tells Django to treat this as a REST API endpoint
# @permission_classes([AllowAny])
# def update_food_revenue(request):
#     # 1. Calculate totals for all food items
#     totals = HotelOrderItem.objects.values('food_item').annotate(total_cash=Sum('price'))
    
#     # 2. Update the FoodItem records
#     for item in totals:
#         try:
#             food = FoodItem.objects.get(id=item['food_item'])
#             food.total_amount_cash = item['total_cash']
#             food.save()
#         except FoodItem.DoesNotExist:
#             continue
            
#     return Response({"message": "Total revenue per food item updated successfully!"})
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def update_food_revenue(request):
    # ... (your update logic here) ...
    
    # After updating, fetch the new data
    updated_food = FoodItem.objects.all()
    serializer = FoodItemSerializer(updated_food, many=True)
    
    # Return the actual data so you can see the changes
    return Response(serializer.data)
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
# views.py
class FoodItemViewSet(viewsets.ModelViewSet):
    queryset = FoodItem.objects.all().select_related("category", "created_by")
    serializer_class = FoodItemSerializer
    permission_classes = [AllowAny]  # Or your preferred permissions
    
    def get_serializer_class(self):
        return FoodItemSerializer
    
    def perform_create(self, serializer):
        # Automatically set created_by to current user
        if self.request.user.is_authenticated:
            serializer.save(created_by=self.request.user)
        else:
            # Handle unauthenticated users - either allow null or raise error
            serializer.save()  # created_by will be null if field allows
    
    def perform_update(self, serializer):
        # Keep the original created_by when updating
        serializer.save()

class HotelOrderItemViewSet(viewsets.ModelViewSet):
    queryset = HotelOrderItem.objects.all().select_related("food_item", "order", "order__created_by")
    serializer_class = HotelOrderItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = CustomPageNumberPagination
    
    def get_queryset(self):
        queryset = HotelOrderItem.objects.all().select_related("food_item", "order", "order__created_by")
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date and end_date:
            try:
                start_date_obj = datetime.strptime(start_date, '%Y-%m-%d')
                end_date_obj = datetime.strptime(end_date, '%Y-%m-%d')
                # Include the entire end_date day
                end_date_obj = end_date_obj.replace(hour=23, minute=59, second=59)
                queryset = queryset.filter(created_at__range=[start_date_obj, end_date_obj])
            except ValueError:
                pass
        
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        # Set the current user if available
        serializer.save()

class HotelOrderViewSet(viewsets.ModelViewSet):
    queryset = HotelOrder.objects.all().order_by('-created_at')
    permission_classes = [AllowAny]
    filter_backends = [
        DjangoFilterBackend,
        SearchFilter,
    ]

    filterset_fields = {
        "created_at": ["date__gte", "date__lte"],
    }
    pagination_class = CustomPageNumberPagination
    
    def get_serializer_class(self):
        if self.action == 'create':
            return HotelOrderCreateSerializer
        return HotelOrderSerializer
    
    def get_queryset(self):
        queryset = HotelOrder.objects.all().order_by('-created_at')
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date and end_date:
            try:
                start_date_obj = datetime.strptime(start_date, '%Y-%m-%d')
                end_date_obj = datetime.strptime(end_date, '%Y-%m-%d')
                # Include the entire end_date day
                end_date_obj = end_date_obj.replace(hour=23, minute=59, second=59)
                queryset = queryset.filter(created_at__range=[start_date_obj, end_date_obj])
            except ValueError:
                pass
        
        return queryset
    
    def perform_create(self, serializer):
        # Pass the request context to serializer
        serializer.save()
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get order summary statistics"""
        queryset = self.get_queryset()
        
        total_orders = queryset.count()
        total_revenue = HotelOrderItem.objects.filter(
            order__in=queryset
        ).aggregate(
            total=Sum('price')
        )['total'] or 0
        
        average_order_value = total_revenue / total_orders if total_orders > 0 else 0
        
        return Response({
            'total_orders': total_orders,
            'total_revenue': float(total_revenue),
            'average_order_value': float(average_order_value)
        })
# ---------------------------
#   EXPENSE FIELD VIEWSET
# ---------------------------
class HotelExpenseFieldViewSet(viewsets.ModelViewSet):
    queryset = HotelExpenseField.objects.all()
    serializer_class = HotelExpenseFieldSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Disable pagination for expense fields
    #permission_classes = [AllowAny]

# ---------------------------
#   EXPENSE RECORD VIEWSET
# ---------------------------
class HotelExpenseRecordViewSet(viewsets.ModelViewSet):
    queryset = HotelExpenseRecord.objects.all().select_related("field")
    serializer_class = HotelExpenseRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Disable pagination for expense records
    filterset_fields = {"date": ["gte", "lte"]}
    #permission_classes = [AllowAny]

from django.http import JsonResponse
from django.db.models import Sum


def update_food_items_view(request):
    updated = []

    for item in FoodItem.objects.all():
        total_quantity = HotelOrderItem.objects.filter(
            food_item=item,
            oncredit=False
        ).aggregate(total=Sum('quantity'))['total'] or 0

        total_revenue = HotelOrderItem.objects.filter(
            food_item=item,
            oncredit=False
        ).aggregate(total=Sum('price'))['total'] or 0

        item.quantity = total_quantity
        item.total_order_price = total_revenue
        item.save()

        updated.append({
            "food_item": item.name,
            "quantity": total_quantity,
            "revenue": total_revenue
        })

    return JsonResponse({
        "status": "success",
        "message": "Food items updated successfully",
        "updated_items": updated
    })
