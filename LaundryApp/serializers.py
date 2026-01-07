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
    phone = serializers.SerializerMethodField()
    
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'created_by']
    
    def get_phone(self, obj):
        """Convert PhoneNumberField to string format"""
        return str(obj.phone) if obj.phone else None

   
# --- CORRECTED OrderItem Serializer ---
class OrderItemSerializer(serializers.ModelSerializer):
    ITEM_TYPE_CHOICES = OrderItem.ITEMS_CATEGORY
    
    #  FIX 1: Explicitly define the field as MultipleChoiceField 
    # to accept the list input from the frontend.
    servicetype = serializers.MultipleChoiceField(
        choices=SERVICE_TYPE_CHOICES,
        required=True
    )
    itemtype = serializers.MultipleChoiceField(
        choices=ITEM_TYPE_CHOICES,
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
        
        # 3. Check if itemtype exists and is a list (which it will be after validation)
        if 'itemtype' in internal_value and isinstance(internal_value['itemtype'], list):
            # Convert the list back to a comma-separated string for model storage
            internal_value['itemtype'] = ','.join(internal_value['itemtype'])
            
        return internal_value

# --- Order Serializer (Cleaned up create/update) ---
class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, required=False, default=[])
    customer = CustomerSerializer(read_only=True)
    customer_id = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.all(), source='customer', write_only=True, required=True)
    created_by = UserProfileSerializer(read_only=True)
    
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
            'created_at', 'updated_at', 'customer', 'created_by'
        ]

    def validate_customer(self, value):
        """Handle both customer ID and customer object"""
        if value is None:
            raise serializers.ValidationError("Customer is required")
        return value

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        # customer_id PrimaryKeyRelatedField auto-resolves to Customer object
        customer_data = validated_data.pop("customer", None)
        
        # If customer_id resolved to None but customer_data exists (edge case)
        if "customer" not in validated_data and customer_data is not None:
            if isinstance(customer_data, int):
                try:
                    customer_obj = Customer.objects.get(id=customer_data)
                    validated_data["customer"] = customer_obj
                except Customer.DoesNotExist:
                    raise serializers.ValidationError({"customer": "Customer not found"})
            else:
                validated_data["customer"] = customer_data

        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user

        order = Order.objects.create(**validated_data)

        for item_data in items_data:
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