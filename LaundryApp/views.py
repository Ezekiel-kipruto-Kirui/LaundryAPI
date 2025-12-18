from rest_framework import viewsets, status,permissions
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny,IsAdminUser
from django.db import transaction
from .models import Customer, Order, OrderItem, ExpenseField, ExpenseRecord, Payment, UserProfile
from .serializers import (
    CustomerSerializer, OrderSerializer, OrderItemSerializer,
    ExpenseFieldSerializer, ExpenseRecordSerializer, PaymentSerializer, UserProfileSerializer
)
from .pagination import CustomPageNumberPagination
class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

# Update your UserProfileViewset
class UserProfileViewset(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]  # CHANGE THIS from AllowAny
    
    # def get_permissions(self):
    #     """Only allow superusers to create/update/delete users"""
    #     if self.action in ['create', 'update', 'partial_update', 'destroy']:
    #         return [IsAdminUser()]
    #     return [IsAuthenticated()]
# ---------------------- CUSTOMER CRUD ---------------------- #
class CustomerViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for customers.
    """
    queryset = Customer.objects.all().order_by("-id")
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]  # change to IsAuthenticated for production
    pagination_class=CustomPageNumberPagination


# ---------------------- ORDER + NESTED ITEMS CRUD ---------------------- #
class OrderViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for orders + nested items creation & update.
    Transaction ensures rollback safety.
    """
    queryset = Order.objects.all().order_by("-id")
    serializer_class = OrderSerializer
    permission_classes = [AllowAny]
    pagination_class=CustomPageNumberPagination

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={"request": request})
        serializer.is_valid(raise_exception=True)
        updated_order = serializer.save()

        return Response(OrderSerializer(updated_order).data, status=status.HTTP_200_OK)


# ---------------------- ORDER ITEM CRUD ---------------------- #
class OrderItemViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for individual order items.
    Useful for editing items individually from frontend.
    """
    queryset = OrderItem.objects.all()
    serializer_class = OrderItemSerializer
    permission_classes = [permissions.IsAuthenticated]


# ---------------------- EXPENSE FIELD CRUD ---------------------- #
class ExpenseFieldViewSet(viewsets.ModelViewSet):
    queryset = ExpenseField.objects.all().order_by("label")
    serializer_class = ExpenseFieldSerializer
    permission_classes = [permissions.IsAuthenticated]


# ---------------------- EXPENSE RECORD CRUD ---------------------- #
class ExpenseRecordViewSet(viewsets.ModelViewSet):
    queryset = ExpenseRecord.objects.all().order_by("-date")
    serializer_class = ExpenseRecordSerializer
    permission_classes = [permissions.IsAuthenticated]


# ---------------------- PAYMENT CRUD ---------------------- #
class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
