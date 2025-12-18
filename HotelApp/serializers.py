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
        fields = '__all__'

class FoodCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodCategory
        fields = ['id', 'name']



class FoodItemSerializer(serializers.ModelSerializer):
    category = FoodCategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=FoodCategory.objects.all(),
        write_only=True
    )
    created_by = UserProfileSerializer(read_only=True)

    class Meta:
        model = FoodItem
        fields = [
            'id', 'name', 'category', 'category_id',
            'created_by', 'quantity'
        ]

    def create(self, validated_data):
        category = validated_data.pop("category_id")
        validated_data["category"] = category
        
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
            
        return super().create(validated_data)



class HotelOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = HotelOrderItem
        fields = '__all__'

class HotelOrderSerializer(serializers.ModelSerializer):
    created_by = UserProfileSerializer(read_only=True)
    order_items = HotelOrderItemSerializer(many=True)
    total_order_price = serializers.DecimalField(
        max_digits=10, decimal_places=2,
        read_only=True, source='get_total'
    )

    class Meta:
        model = HotelOrder
        fields = [
            'id', 'created_by', 'created_at',
            'order_items', 'total_order_price'
        ]
        read_only_fields = ['created_at']

    def create(self, validated_data):
        order_items_data = validated_data.pop("order_items")
        
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user

        order = HotelOrder.objects.create(**validated_data)

        # Create order items
        for item_data in order_items_data:
            food_item = item_data.pop("food_item_id")
            HotelOrderItem.objects.create(
                order=order,
                food_item=food_item,
                **item_data
            )

        # Update food item quantities
        for order_item in order.order_items.all():
            food_item = order_item.food_item
            if food_item.quantity >= order_item.quantity:
                food_item.quantity -= order_item.quantity
                food_item.save()
            else:
                raise serializers.ValidationError(
                    f"Insufficient stock for {food_item.name}. "
                    f"Available: {food_item.quantity}, Requested: {order_item.quantity}"
                )

        return order

    def update(self, instance, validated_data):
        order_items_data = validated_data.pop("order_items", None)

        # Update order items if provided
        if order_items_data is not None:
            # Restore previous quantities
            for old_item in instance.order_items.all():
                food_item = old_item.food_item
                food_item.quantity += old_item.quantity
                food_item.save()
            
            # Delete old items
            instance.order_items.all().delete()
            
            # Create new items
            for item_data in order_items_data:
                food_item = item_data.pop("food_item_id")
                order_item = HotelOrderItem.objects.create(
                    order=instance,
                    food_item=food_item,
                    **item_data
                )
                
                # Update food item quantities
                if food_item.quantity >= order_item.quantity:
                    food_item.quantity -= order_item.quantity
                    food_item.save()
                else:
                    raise serializers.ValidationError(
                        f"Insufficient stock for {food_item.name}. "
                        f"Available: {food_item.quantity}, Requested: {order_item.quantity}"
                    )

        # Update other order fields if any
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        return instance



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



class SimpleFoodItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = FoodItem
        fields = ['id', 'name', 'category_name', 'quantity', 'price']


class SimpleHotelOrderSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    total_price = serializers.DecimalField(
        max_digits=10, decimal_places=2,
        read_only=True, source='get_total'
    )

    class Meta:
        model = HotelOrder
        fields = ['id', 'created_by_name', 'created_at', 'total_price']