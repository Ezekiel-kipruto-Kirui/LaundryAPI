# hotel/serializers.py

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    FoodCategory, FoodItem, 
    HotelOrder, HotelOrderItem,
    HotelExpenseField, HotelExpenseRecord
)

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['email','first_name','last_name']

class FoodCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodCategory
        fields = ['id', 'name']

# serializers.py
class FoodItemSerializer(serializers.ModelSerializer):
    category = FoodCategorySerializer()
    created_by = UserProfileSerializer()
    class Meta:
        model = FoodItem
        fields = '__all__'
class HotelOrderItemSerializer(serializers.ModelSerializer):
    food_item_name = serializers.CharField(source='food_item.name', read_only=True)
    total_price = serializers.SerializerMethodField()
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    created_by = UserProfileSerializer(source='order.created_by', read_only=True)
    order_created_at = serializers.DateTimeField(source='order.created_at', read_only=True)

    class Meta:
        model = HotelOrderItem
        fields = '__all__'
        read_only_fields = ['created_at']

    def get_total_price(self, obj):
        return obj.get_total_price()

class HotelOrderSerializer(serializers.ModelSerializer):
    order_items = HotelOrderItemSerializer(many=True, read_only=True)
    total_amount = serializers.SerializerMethodField()
    created_by = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = HotelOrder
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at']
    
    def get_total_amount(self, obj):
        return obj.get_total()

class HotelOrderCreateSerializer(serializers.ModelSerializer):
    items = HotelOrderItemSerializer(many=True, write_only=True, required=False)
    
    class Meta:
        model = HotelOrder
        fields = ['id', 'created_by', 'created_at', 'items']
        read_only_fields = ['created_by', 'created_at']
    
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        request = self.context.get('request')
        
        order = HotelOrder.objects.create(
            created_by=request.user if request and request.user else None
        )
        
        # Create order items
        for item_data in items_data:
            HotelOrderItem.objects.create(order=order, **item_data)
        
        return order


class HotelExpenseFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = HotelExpenseField
        fields = ['id', 'label', 'created_at']
        read_only_fields = ['created_at']



class HotelExpenseRecordSerializer(serializers.ModelSerializer):
    field = HotelExpenseFieldSerializer(read_only=True)
    field_id = serializers.PrimaryKeyRelatedField(
        queryset=HotelExpenseField.objects.all(),
        write_only=True
    )

    class Meta:
        model = HotelExpenseRecord
        fields = ['id', 'field', 'field_id', 'amount', 'date', 'notes']
        read_only_fields = ['date']

    def create(self, validated_data):
        field = validated_data.pop("field_id")
        validated_data["field"] = field
        return super().create(validated_data)



