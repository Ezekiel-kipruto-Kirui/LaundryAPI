from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Customer, Order, OrderItem,
    ExpenseField, ExpenseRecord, Payment, shoptype,CustomUserManager,UserProfile
)

User = get_user_model()

# Get SERVICE_TYPES directly from the OrderItem model
SERVICE_TYPE_CHOICES = OrderItem.SERVICE_TYPES

# --- Core User Serializer ---
# class UserProfileSerializer(serializers.ModelSerializer):
#     password = serializers.CharField(write_only=True)
#     class Meta:
#         model = User
#         fields = '__all__'

class UserProfileSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        required=True
    )

    class Meta:
        model = UserProfile
        fields = (
            'id',
            'email',
            'password',
            'user_type',
            'first_name',
            'last_name',
            'is_active',
            'is_staff',
            'is_superuser',
            'last_login',
            'date_joined',
        )
        read_only_fields = ('last_login', 'date_joined')

    # -------------------------
    # INTERNAL ROLE SYNC LOGIC
    # -------------------------
    def _sync_permissions(self, user, user_type):
        """
        Keep Django permission flags in sync with user_type
        """
        if user_type == 'admin':
            user.is_superuser = True
            user.is_staff = True
        elif user_type == 'staff':
            user.is_superuser = False
            user.is_staff = True
        else:
            user.is_superuser = False
            user.is_staff = False

    # -------------------------
    # CREATE
    # -------------------------
    def create(self, validated_data):
        password = validated_data.pop("password")
        user_type = validated_data.pop("user_type", "staff")

        if user_type == "admin":
            user = UserProfile.objects.create_superuser(
                password=password,
                user_type=user_type,
                **validated_data
            )
        else:
            user = UserProfile.objects.create_user(
                password=password,
                user_type=user_type,
                **validated_data
            )

        return user

    # -------------------------
    # UPDATE
    # -------------------------
    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        user_type = validated_data.get('user_type', instance.user_type)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.user_type = user_type  # ✅ ensure it is saved

        if password:
            instance.set_password(password)

        self._sync_permissions(instance, user_type)

        instance.save()
        return instance


class CustomerSerializer(serializers.ModelSerializer):
    created_by = UserProfileSerializer(read_only=True)

    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone',
            'created_by'
        ]

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        return super().create(validated_data)

# --- CORRECTED OrderItem Serializer ---
class OrderItemSerializer(serializers.ModelSerializer):
    # 🎯 FIX 1: Explicitly define the field as MultipleChoiceField 
    # to accept the list input from the frontend.
    servicetype = serializers.MultipleChoiceField(
        choices=SERVICE_TYPE_CHOICES,
        required=True
    )
    
    class Meta:
        model = OrderItem
        fields = [
            'id', 'servicetype', 'itemtype', 'itemname',
            'quantity', 'itemcondition', 'additional_info',
            'unit_price', 'total_item_price', 'created_at'
        ]
        read_only_fields = ['total_item_price', 'created_at']

    # 🎯 FIX 2: Override to_internal_value to convert the validated list 
    # into the comma-separated string required by the model *before* saving.
    def to_internal_value(self, data):
        # 1. Allow MultipleChoiceField validation to run
        try:
            internal_value = super().to_internal_value(data)
        except serializers.ValidationError as e:
            # Re-raise validation errors if they occur
            raise e
        
        # 2. Check if servicetype exists and is a list (which it will be after validation)
        if 'servicetype' in internal_value and isinstance(internal_value['servicetype'], list):
            # Convert the list back to a comma-separated string for model storage
            internal_value['servicetype'] = ','.join(internal_value['servicetype'])
            
        return internal_value

# --- Order Serializer (Cleaned up create/update) ---
class OrderSerializer(serializers.ModelSerializer):
    customer = CustomerSerializer(read_only=True)
    customer_id = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.all(), write_only=True
    )
    # This serializer now returns the servicetype as a comma-separated string
    items = OrderItemSerializer(many=True) 
    created_by = UserProfileSerializer(read_only=True)
    updated_by = UserProfileSerializer(read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'uniquecode',
            'customer', 'customer_id',
            'payment_type', 'payment_status', 'shop',
            'delivery_date', 'order_status',
            'addressdetails', 'amount_paid',
            'total_price', 'balance',
            'created_at', 'updated_at',
            'created_by', 'updated_by',
            'items',
        ]
        read_only_fields = [
            'uniquecode', 'total_price', 'balance',
            'created_at', 'updated_at'
        ]

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        customer = validated_data.pop("customer_id")
        validated_data["customer"] = customer

        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user

        order = Order.objects.create(**validated_data)

        for item_data in items_data:
            # servicetype is now ALREADY a string due to OrderItemSerializer.to_internal_value
            OrderItem.objects.create(order=order, **item_data)

        return order

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)

        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["updated_by"] = request.user

        # Update order fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update order items (optional)
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                # servicetype is already a string here too
                OrderItem.objects.create(order=instance, **item_data)

        return instance


# --- Expense Serializers ---
class ExpenseFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseField
        fields = ['id', 'label', 'created_at']


class ExpenseRecordSerializer(serializers.ModelSerializer):
    field = ExpenseFieldSerializer(read_only=True)
    field_id = serializers.PrimaryKeyRelatedField(
        queryset=ExpenseField.objects.all(),
        write_only=True
    )
    description = serializers.CharField(source='notes', required=False, allow_blank=True)

    class Meta:
        model = ExpenseRecord
        fields = ['id', 'field', 'field_id', 'shop', 'amount', 'date', 'description']
        read_only_fields = ['date']

    def create(self, validated_data):
        field = validated_data.pop("field_id")
        validated_data["field"] = field
        return super().create(validated_data)


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'order', 'price']