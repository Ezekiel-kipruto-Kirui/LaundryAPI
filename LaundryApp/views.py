from django.db import transaction
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import (
    IsAuthenticated,
    AllowAny,
    IsAdminUser,
)
from .models import (
    Customer, Order, OrderItem,
    ExpenseField, ExpenseRecord,
    Payment, UserProfile
)
from .serializers import (
    CustomerSerializer, OrderSerializer, OrderItemSerializer,
    ExpenseFieldSerializer, ExpenseRecordSerializer,
    PaymentSerializer, UserProfileSerializer
)
from .pagination import CustomPageNumberPagination
from .sms_utility import send_sms   
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter
from django.db.models import Sum, Count, Q,F

class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

# Update your UserProfileViewSet
class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]  # CHANGE THIS from AllowAny
    
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
    permission_classes = [AllowAny]
    pagination_class=CustomPageNumberPagination

    @action(detail=False, methods=['get'])
    def by_phone(self, request):
        """Search customer by phone number (exact or normalized match)"""
        phone = request.query_params.get('phone', '')
        if not phone:
            return Response({"error": "Phone parameter required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Normalize the input phone for comparison
        import re
        cleaned = re.sub(r'\D', '', phone)
        
        # Try different formats
        if cleaned.startswith('254') and len(cleaned) == 12:
            search_phones = [f'+{cleaned}', cleaned]
        elif cleaned.startswith('0') and len(cleaned) == 10:
            normalized = '254' + cleaned[1:]
            search_phones = [f'+{normalized}', normalized]
        elif cleaned.startswith('7') and len(cleaned) == 9:
            normalized = '254' + cleaned
            search_phones = [f'+{normalized}', normalized]
        else:
            search_phones = [phone, f'+{phone}']
        
        # Search for customer with any matching phone format
        customer = None
        for search_phone in search_phones:
            try:
                # Try exact match first
                customer = Customer.objects.filter(phone=search_phone).first()
                if customer:
                    break
                # Try with E164 format
                if not search_phone.startswith('+'):
                    customer = Customer.objects.filter(phone=f'+{search_phone}').first()
                    if customer:
                        break
            except Exception:
                continue
        
        if customer:
            serializer = self.get_serializer(customer)
            return Response(serializer.data)
        return Response({"error": "Customer not found"}, status=status.HTTP_404_NOT_FOUND)


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

    # @transaction.atomic
    # def create(self, request, *args, **kwargs):
    #     serializer = self.get_serializer(data=request.data, context={"request": request})
    #     serializer.is_valid(raise_exception=True)
    #     order = serializer.save()
    #     return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={"request": request})
        serializer.is_valid(raise_exception=True)
        updated_order = serializer.save()

        return Response(OrderSerializer(updated_order).data, status=status.HTTP_200_OK)
    filter_backends = [
        DjangoFilterBackend,
        SearchFilter,
    ]

    filterset_fields = {
        "created_at": ["date__gte", "date__lte"],
        "order_status": ["exact"],
        "payment_status": ["exact"],
        "shop": ["exact"],
    }

    search_fields = [
        "uniquecode",
        "customer__name",
        "customer__phone",
    ]

    # ... existing code ...

    @action(detail=False, methods=['get'])
    def user_sales_summary(self, request):
        """
        Optimized endpoint to sum Order total_price per user.
        """
        # Aggregate Order model, grouping by the created_by user
        summary = Order.objects.values(
            user_id=F('created_by__id'),
            # username=F('created_by__username'),
            email=F('created_by__email')
        ).annotate(
            total_revenue=Sum('total_price')
        ).order_by('-total_revenue')

        return Response({
            'status': 'success',
            'data': list(summary)
        })

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get order summary statistics with optional date filtering"""
        queryset = self.filter_queryset(self.get_queryset())

        total_orders = queryset.count()
        total_revenue = queryset.aggregate(total=Sum('total_price'))['total'] or 0
        pending_orders = queryset.filter(order_status='pending').count()
        completed_orders = queryset.filter(order_status='Completed').count()
        pending_revenue = queryset.filter(payment_status='pending').aggregate(total=Sum('total_price'))['total'] or 0
        completed_revenue = queryset.filter(payment_status='completed').aggregate(total=Sum('total_price'))['total'] or 0

        # Shop breakdown
        shop_stats = queryset.values('shop').annotate(
            total_orders=Count('id'),
            total_revenue=Sum('total_price'),
            pending_orders=Count('id', filter=Q(order_status='pending')),
            completed_orders=Count('id', filter=Q(order_status='Completed'))
        )

        return Response({
            'total_orders': total_orders,
            'total_revenue': float(total_revenue),
            'pending_orders': pending_orders,
            'completed_orders': completed_orders,
            'pending_revenue': float(pending_revenue),
            'completed_revenue': float(completed_revenue),
            'shop_breakdown': list(shop_stats)
        })
        


# ---------------------- ORDER ITEM CRUD ---------------------- #
class OrderItemViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for individual order items.
    Useful for editing items individually from frontend.
    """
    queryset = OrderItem.objects.all()
    serializer_class = OrderItemSerializer
    permission_classes = [IsAuthenticated]
    pagination_class=CustomPageNumberPagination


# ---------------------- EXPENSE FIELD CRUD ---------------------- #
class ExpenseFieldViewSet(viewsets.ModelViewSet):
    queryset = ExpenseField.objects.all().order_by("label")
    serializer_class = ExpenseFieldSerializer
    permission_classes = [IsAuthenticated]


# ---------------------- EXPENSE RECORD CRUD ---------------------- #
class ExpenseRecordViewSet(viewsets.ModelViewSet):
    queryset = ExpenseRecord.objects.all().order_by("-date")
    serializer_class = ExpenseRecordSerializer
    permission_classes = [IsAuthenticated]
    
    filterset_fields = {"date": ["gte", "lte"]}


# ---------------------- PAYMENT CRUD ---------------------- #
class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]




@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sendsms_view(request):
    to_number = request.data.get("to_number")
    message = request.data.get("message")

    # -------------------------
    # Validation
    # -------------------------
    if not to_number:
        return Response(
            {"error": "to_number is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not message:
        return Response(
            {"error": "message is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if isinstance(to_number, list):
        if not all(isinstance(num, str) for num in to_number):
            return Response(
                {"error": "All phone numbers must be strings"},
                status=status.HTTP_400_BAD_REQUEST
            )
    elif not isinstance(to_number, str):
        return Response(
            {"error": "to_number must be a string or a list of strings"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # -------------------------
    # Send SMS (auto-detect)
    # -------------------------
    success, result = send_sms(to_number, message)

    if success:
        return Response(
            {
                "success": True,
                "type": "bulk" if isinstance(to_number, list) else "single",
                "response": result
            },
            status=status.HTTP_200_OK
        )

    return Response(
        {
            "success": False,
            "error": "Failed to send SMS",
            "details": result
        },
        status=status.HTTP_400_BAD_REQUEST
    )
    
