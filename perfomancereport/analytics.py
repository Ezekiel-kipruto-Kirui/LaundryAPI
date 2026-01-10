import hashlib
import logging
from collections import Counter
from functools import lru_cache
from datetime import datetime, timedelta

# Django core imports
from django.db.models import (
    Avg, Count, DecimalField, Q, Sum, Case, When, F
)
from django.db.models.functions import Coalesce, ExtractMonth, ExtractYear
from django.utils.timezone import now, make_aware
from django.utils.dateparse import parse_datetime, parse_date

# Local imports
from LaundryApp.models import Order, OrderItem, ExpenseRecord, Customer
from HotelApp.models import HotelOrder, HotelExpenseRecord, HotelOrderItem

# Setup logger
logger = logging.getLogger(__name__)

# --- Constants ---
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
ACTIVE_ORDER_STATUSES = ['pending', 'Completed', 'Delivered_picked']

# Payment status constants matching the Model
PAYMENT_STATUS_PENDING = 'pending'
PAYMENT_STATUS_PARTIAL = 'partial'
PAYMENT_STATUS_COMPLETED = 'completed'


class DashboardAnalytics:
    """
    Handles all analytics and dashboard-related functionality.
    """

    def __init__(self, admin_instance=None):
        self.admin_instance = admin_instance

    def get_user_shops(self, request):
        """Get shops accessible to the user."""
        if self.admin_instance and hasattr(self.admin_instance, 'get_user_shops'):
            return self.admin_instance.get_user_shops(request)
        return ['Shop A', 'Shop B']

    # --- Structure & Helpers ---

    def _get_empty_dashboard_data(self):
        """Returns the standard empty data structure."""
        return {
            'order_stats': {
                'total_orders': 0, 'pending_orders': 0, 'completed_orders': 0,
                'delivered_orders': 0, 'total_revenue': 0.0, 'avg_order_value': 0.0,
                'total_balance': 0.0, 'total_amount_paid': 0.0
            },
            'payment_stats': {
                'pending_payments': 0, 'partial_payments': 0, 'complete_payments': 0,
                'total_pending_amount': 0.0, 'total_partial_amount': 0.0, 
                'total_complete_amount': 0.0, 'total_collected_amount': 0.0, 
                'total_balance_amount': 0.0
            },
            'payment_type_stats': {},
            'expense_stats': {
                'total_expenses': 0.0, 'shop_a_expenses': 0.0, 
                'shop_b_expenses': 0.0, 'average_expense': 0.0
            },
            'hotel_stats': {
                'total_orders': 0, 'total_revenue': 0.0, 'avg_order_value': 0.0,
                'total_expenses': 0.0, 'net_profit': 0.0
            },
            'business_growth': {
                'total_revenue': 0.0, 'total_orders': 0, 
                'total_expenses': 0.0, 'net_profit': 0.0
            },
            'revenue_by_shop': [],
            'balance_by_shop': [],
            'common_customers': [],
            'payment_methods': [],
            'top_services': [],
            'common_items': [],
            'service_types': [],
            'monthly_expenses_data': [],
            'monthly_business_growth': [],
            'shop_a_stats': self._get_empty_shop_stats(),
            'shop_b_stats': self._get_empty_shop_stats(),
            'shop_a_orders': {'pending': [], 'partial': [], 'complete': [], 'overdue': []},
            'shop_b_orders': {'pending': [], 'partial': [], 'complete': [], 'overdue': []},
            'orders_by_payment_status': {'pending': [], 'partial': [], 'complete': [], 'overdue': []}
        }

    def _get_empty_shop_stats(self):
        """Helper to create empty stats for a specific shop."""
        return {
            'revenue': 0.0, 'total_orders': 0, 'pending_orders': 0, 'completed_orders': 0,
            'pending_payments': 0, 'partial_payments': 0, 'complete_payments': 0,
            'total_pending_amount': 0.0, 'total_partial_amount': 0.0, 'total_complete_amount': 0.0,
            'total_balance': 0.0, 'total_amount_paid': 0.0, 'total_expenses': 0.0, 'net_profit': 0.0
        }

    def _parse_date(self, date_str):
        """Parse date string to datetime object."""
        if not date_str:
            return None
        
        try:
            # Try parsing as datetime first
            parsed = parse_datetime(date_str)
            if parsed:
                return make_aware(parsed) if not parsed.tzinfo else parsed
            
            # Try parsing as date
            parsed_date = parse_date(date_str)
            if parsed_date:
                return make_aware(datetime.combine(parsed_date, datetime.min.time()))
        except (ValueError, TypeError) as e:
            logger.error(f"Error parsing date {date_str}: {e}")
        
        return None

    def _apply_date_filters(self, queryset, date_field, start_date=None, end_date=None):
        """Apply date range filters to queryset."""
        if start_date:
            start_date = self._parse_date(start_date) if isinstance(start_date, str) else start_date
            if start_date:
                queryset = queryset.filter(**{f'{date_field}__gte': start_date})

        if end_date:
            end_date = self._parse_date(end_date) if isinstance(end_date, str) else end_date
            if end_date:
                # Add time to include the entire end date
                if hasattr(end_date, 'date'):
                    end_date = make_aware(datetime.combine(end_date.date(), datetime.max.time()))
                queryset = queryset.filter(**{f'{date_field}__lte': end_date})
        
        return queryset

    def _apply_shop_filters(self, queryset, request):
        """Apply shop access filters."""
        user_shops = self.get_user_shops(request)
        if user_shops is not None and user_shops:
            if hasattr(queryset.model, 'shop'):
                queryset = queryset.filter(shop__in=user_shops)
        return queryset

    # --- Aggregation Logic ---

    def _get_base_queryset(self, request, start_date=None, end_date=None, payment_status=None, shop=None):
        """Construct base Order queryset with filters."""
        # Get all orders first without status filter
        base_queryset = Order.objects.all()
        logger.info(f"DEBUG: Total orders in DB: {base_queryset.count()}")
        
        if base_queryset.exists():
            for order in base_queryset[:5]:
                logger.info(f"DEBUG: Order {order.id}: status={order.order_status}, "
                          f"total_price={order.total_price}, shop={order.shop}, created_at={order.created_at}")
        
        # Apply date filters using created_at (more reliable than delivery_date)
        base_queryset = self._apply_date_filters(base_queryset, 'created_at', start_date, end_date)
        logger.info(f"DEBUG: After date filters: {base_queryset.count()}")
        
        if shop:
            base_queryset = base_queryset.filter(shop=shop)
            logger.info(f"DEBUG: After shop filter '{shop}': {base_queryset.count()}")

        # Apply payment status filter
        if payment_status:
            base_queryset = base_queryset.filter(payment_status=payment_status)
            logger.info(f"DEBUG: After payment filter '{payment_status}': {base_queryset.count()}")

        # Apply shop filters from user permissions
        base_queryset = self._apply_shop_filters(base_queryset, request)
        logger.info(f"DEBUG: Final queryset count: {base_queryset.count()}")

        return base_queryset

    def _calculate_order_stats(self, base_queryset):
        """Calculate core order statistics."""
        try:
            stats = base_queryset.aggregate(
                total_orders=Count('id'),
                pending_orders=Count('id', filter=Q(order_status='pending')),
                completed_orders=Count('id', filter=Q(order_status='Completed')),
                delivered_orders=Count('id', filter=Q(order_status='Delivered_picked')),
                avg_order_value=Coalesce(Avg('total_price'), 0.0, output_field=DecimalField()),
                total_amount_paid=Coalesce(Sum('amount_paid'), 0.0, output_field=DecimalField()),
                total_balance=Coalesce(Sum('balance'), 0.0, output_field=DecimalField()),
                total_revenue=Coalesce(Sum('total_price'), 0.0, output_field=DecimalField())
            )
            
            logger.info(f"Order stats calculated: {stats}")
            return stats
        except Exception as e:
            logger.error(f"Error calculating order stats: {e}")
            return {
                'total_orders': 0, 'pending_orders': 0, 'completed_orders': 0,
                'delivered_orders': 0, 'avg_order_value': 0.0, 'total_amount_paid': 0.0,
                'total_balance': 0.0, 'total_revenue': 0.0
            }

    def _calculate_payment_stats(self, base_queryset):
        """Calculate payment statistics."""
        try:
            stats = base_queryset.aggregate(
                pending_payments=Count('id', filter=Q(payment_status=PAYMENT_STATUS_PENDING)),
                partial_payments=Count('id', filter=Q(payment_status=PAYMENT_STATUS_PARTIAL)),
                complete_payments=Count('id', filter=Q(payment_status=PAYMENT_STATUS_COMPLETED)),
                
                total_pending_amount=Coalesce(
                    Sum(Case(
                        When(payment_status=PAYMENT_STATUS_PENDING, then=F('total_price')),
                        default=0.0,
                        output_field=DecimalField()
                    )), 0.0, output_field=DecimalField()
                ),
                total_partial_amount=Coalesce(
                    Sum(Case(
                        When(payment_status=PAYMENT_STATUS_PARTIAL, then=F('amount_paid')),
                        default=0.0,
                        output_field=DecimalField()
                    )), 0.0, output_field=DecimalField()
                ),
                total_complete_amount=Coalesce(
                    Sum(Case(
                        When(payment_status=PAYMENT_STATUS_COMPLETED, then=F('total_price')),
                        default=0.0,
                        output_field=DecimalField()
                    )), 0.0, output_field=DecimalField()
                ),
                
                total_collected_amount=Coalesce(Sum('amount_paid'), 0.0, output_field=DecimalField()),
                total_balance_amount=Coalesce(Sum('balance'), 0.0, output_field=DecimalField())
            )
            
            # Calculate overdue orders using created_at
            overdue_qs = base_queryset.filter(
                created_at__lt=now().date(),
                payment_status__in=[PAYMENT_STATUS_PENDING, PAYMENT_STATUS_PARTIAL]
            )
            overdue_stats = overdue_qs.aggregate(
                overdue_payments=Count('id'),
                total_overdue_amount=Coalesce(Sum('balance'), 0.0, output_field=DecimalField())
            )
            
            stats.update(overdue_stats)
            logger.info(f"Payment stats calculated: {stats}")
            return stats
        except Exception as e:
            logger.error(f"Error calculating payment stats: {e}")
            return {
                'pending_payments': 0, 'partial_payments': 0, 'complete_payments': 0,
                'total_pending_amount': 0.0, 'total_partial_amount': 0.0,
                'total_complete_amount': 0.0, 'total_collected_amount': 0.0,
                'total_balance_amount': 0.0, 'overdue_payments': 0,
                'total_overdue_amount': 0.0
            }

    def _calculate_payment_type_stats(self, base_queryset):
        """Calculate stats grouped by payment type."""
        try:
            payment_stats = {}
            payment_types = base_queryset.values('payment_type').distinct()
            
            for entry in payment_types:
                p_type = entry['payment_type']
                qs = base_queryset.filter(payment_type=p_type)
                
                type_stats = qs.aggregate(
                    count=Count('id'),
                    total_amount=Coalesce(Sum('total_price'), 0.0, output_field=DecimalField()),
                    amount_collected=Coalesce(Sum('amount_paid'), 0.0, output_field=DecimalField())
                )
                
                payment_stats[p_type] = type_stats
            
            return payment_stats
        except Exception as e:
            logger.error(f"Error calculating payment type stats: {e}")
            return {}

    # --- Expense Logic ---

    def _calculate_expense_stats(self, request, start_date=None, end_date=None):
        """Calculate expense statistics."""
        try:
            expenses = ExpenseRecord.objects.all()
            expenses = self._apply_date_filters(expenses, 'date', start_date, end_date)
            expenses = self._apply_shop_filters(expenses, request)

            stats = expenses.aggregate(
                total_expenses=Coalesce(Sum('amount'), 0.0, output_field=DecimalField()),
                average_expense=Coalesce(Avg('amount'), 0.0, output_field=DecimalField())
            )
            
            # Calculate shop-specific expenses
            shop_a_exp = float(expenses.filter(shop='Shop A').aggregate(
                t=Coalesce(Sum('amount'), 0.0, output_field=DecimalField())
            )['t'] or 0.0)
            
            shop_b_exp = float(expenses.filter(shop='Shop B').aggregate(
                t=Coalesce(Sum('amount'), 0.0, output_field=DecimalField())
            )['t'] or 0.0)
            
            stats['shop_a_expenses'] = shop_a_exp
            stats['shop_b_expenses'] = shop_b_exp
            
            logger.info(f"Expense stats calculated: {stats}")
            return stats
        except Exception as e:
            logger.error(f"Error calculating expense stats: {e}")
            return {
                'total_expenses': 0.0, 'shop_a_expenses': 0.0,
                'shop_b_expenses': 0.0, 'average_expense': 0.0
            }

    # --- Hotel Logic ---

    def _calculate_hotel_stats(self, start_date=None, end_date=None):
        """Calculate hotel statistics."""
        try:
            # Hotel orders
            hotel_orders = HotelOrder.objects.all()
            hotel_orders = self._apply_date_filters(hotel_orders, 'created_at', start_date, end_date)
            
            # Get total orders
            total_orders = hotel_orders.count()
            
            # Calculate revenue from non-credit orders
            revenue_result = HotelOrderItem.objects.filter(
                order__in=hotel_orders,
                oncredit=False
            ).aggregate(
                total_revenue=Coalesce(
                    Sum(F('price') * F('quantity')), 0.0, output_field=DecimalField()
                )
            )
            
            total_revenue = revenue_result['total_revenue'] or 0.0
            
            # Calculate expenses
            hotel_expenses = HotelExpenseRecord.objects.all()
            hotel_expenses = self._apply_date_filters(hotel_expenses, 'date', start_date, end_date)
            
            total_exp = float(hotel_expenses.aggregate(
                t=Coalesce(Sum('amount'), 0.0, output_field=DecimalField())
            )['t'] or 0.0)
            
            avg_order_value = float(total_revenue) / total_orders if total_orders > 0 else 0.0
            net_profit = float(total_revenue) - total_exp
            
            stats = {
                'total_orders': total_orders,
                'total_revenue': float(total_revenue),
                'avg_order_value': float(avg_order_value),
                'total_expenses': float(total_exp),
                'net_profit': float(net_profit)
            }
            
            logger.info(f"Hotel stats calculated: {stats}")
            return stats
        except Exception as e:
            logger.error(f"Error calculating hotel stats: {e}")
            return {
                'total_orders': 0, 'total_revenue': 0.0, 'avg_order_value': 0.0,
                'total_expenses': 0.0, 'net_profit': 0.0
            }

    # --- Shop-specific Data ---

    def _get_shop_specific_data(self, base_queryset, shop_name, total_expenses_for_shop):
        """Get combined stats and order lists for a specific shop."""
        try:
            shop_qs = base_queryset.filter(shop=shop_name)
            
            # Order stats
            order_stats = shop_qs.aggregate(
                revenue=Coalesce(Sum('total_price'), 0.0, output_field=DecimalField()),
                total_orders=Count('id'),
                pending_orders=Count('id', filter=Q(order_status='pending')),
                completed_orders=Count('id', filter=Q(order_status='Completed')),
                total_amount_paid=Coalesce(Sum('amount_paid'), 0.0, output_field=DecimalField()),
                total_balance=Coalesce(Sum('balance'), 0.0, output_field=DecimalField())
            )
            
            # Payment stats
            pay_stats = shop_qs.aggregate(
                pending_payments=Count('id', filter=Q(payment_status=PAYMENT_STATUS_PENDING)),
                partial_payments=Count('id', filter=Q(payment_status=PAYMENT_STATUS_PARTIAL)),
                complete_payments=Count('id', filter=Q(payment_status=PAYMENT_STATUS_COMPLETED)),
                total_pending_amount=Coalesce(
                    Sum(Case(When(payment_status=PAYMENT_STATUS_PENDING, then=F('total_price')), 
                           default=0.0, output_field=DecimalField())), 
                    0.0, output_field=DecimalField()
                ),
                total_partial_amount=Coalesce(
                    Sum(Case(When(payment_status=PAYMENT_STATUS_PARTIAL, then=F('amount_paid')), 
                           default=0.0, output_field=DecimalField())), 
                    0.0, output_field=DecimalField()
                ),
                total_complete_amount=Coalesce(
                    Sum(Case(When(payment_status=PAYMENT_STATUS_COMPLETED, then=F('total_price')), 
                           default=0.0, output_field=DecimalField())), 
                    0.0, output_field=DecimalField()
                )
            )
            
            # Merge stats
            final_stats = {**order_stats, **pay_stats}
            final_stats['total_expenses'] = total_expenses_for_shop
            final_stats['net_profit'] = float(final_stats['revenue']) - float(total_expenses_for_shop)
            
            # Convert decimals to floats for JSON serialization
            for key, value in final_stats.items():
                if hasattr(value, '__float__'):
                    final_stats[key] = float(value)
            
            orders_by_status = self._get_orders_by_payment_status(shop_qs)
            
            return {
                'stats': final_stats,
                'orders_by_payment_status': orders_by_status
            }
        except Exception as e:
            logger.error(f"Error getting shop data for {shop_name}: {e}")
            return {
                'stats': self._get_empty_shop_stats(),
                'orders_by_payment_status': {'pending': [], 'partial': [], 'complete': [], 'overdue': []}
            }

    def _get_orders_by_payment_status(self, queryset):
        """Get orders grouped by payment status."""
        try:
            orders = {
                'pending': list(queryset.filter(
                    payment_status=PAYMENT_STATUS_PENDING
                ).select_related('customer').order_by('-created_at')[:50]),
                
                'partial': list(queryset.filter(
                    payment_status=PAYMENT_STATUS_PARTIAL
                ).select_related('customer').order_by('-created_at')[:50]),
                
                'complete': list(queryset.filter(
                    payment_status=PAYMENT_STATUS_COMPLETED
                ).select_related('customer').order_by('-created_at')[:50]),
                
                'overdue': list(queryset.filter(
                    created_at__lt=now().date(),
                    payment_status__in=[PAYMENT_STATUS_PENDING, PAYMENT_STATUS_PARTIAL]
                ).select_related('customer').order_by('-created_at')[:50])
            }
            
            # Convert order objects to serializable dicts
            for status in orders:
                orders[status] = [
                    {
                        'id': order.id,
                        'uniquecode': order.uniquecode,
                        'customer_name': order.customer.name if order.customer else 'Unknown',
                        'total_price': float(order.total_price),
                        'amount_paid': float(order.amount_paid),
                        'balance': float(order.balance),
                        'created_at': order.created_at.strftime('%Y-%m-%d %H:%M') if order.created_at else None,
                        'order_status': order.order_status,
                        'payment_status': order.payment_status,
                        'shop': order.shop
                    }
                    for order in orders[status]
                ]
            
            return orders
        except Exception as e:
            logger.error(f"Error getting orders by payment status: {e}")
            return {'pending': [], 'partial': [], 'complete': [], 'overdue': []}

    # --- Analytics Lists ---

    def _get_common_customers(self, base_queryset):
        """Get common customers."""
        try:
            customers = list(base_queryset.values(
                'customer__name', 'customer__phone'
            ).annotate(
                count=Count('id'),
                spent=Coalesce(Sum('total_price'), 0.0, output_field=DecimalField())
            ).order_by('-count')[:5])
            
            # Convert decimals to floats
            for customer in customers:
                customer['spent'] = float(customer['spent'])
            
            return customers
        except Exception as e:
            logger.error(f"Error getting common customers: {e}")
            return []

    def _get_payment_methods(self, base_queryset):
        """Get payment methods breakdown."""
        try:
            methods = list(base_queryset.values('payment_type').annotate(
                count=Count('id'),
                total=Coalesce(Sum('total_price'), 0.0, output_field=DecimalField())
            ).order_by('-count'))
            
            # Convert decimals to floats
            for method in methods:
                method['total'] = float(method['total'])
            
            return methods
        except Exception as e:
            logger.error(f"Error getting payment methods: {e}")
            return []

    def _get_top_services(self, order_ids):
        """Get top services from order items."""
        try:
            if not order_ids:
                return []
                
            item_data = OrderItem.objects.filter(order_id__in=order_ids)
            counter = Counter()
            
            for item in item_data:
                if item.servicetype:
                    services = item.servicetype if isinstance(item.servicetype, list) else [item.servicetype]
                    for service in services:
                        counter[service] += 1
            
            return [{'servicetype': s, 'count': c} for s, c in counter.most_common(10)]
        except Exception as e:
            logger.error(f"Error getting top services: {e}")
            return []

    def _get_common_items(self, order_ids):
        """Get common items from order items."""
        try:
            if not order_ids:
                return []
                
            order_items = OrderItem.objects.filter(order_id__in=order_ids)
            all_items = []
            
            for item in order_items:
                if item.itemname:
                    items_list = [i.strip() for i in item.itemname.split(',') if i.strip()]
                    all_items.extend(items_list)
            
            counter = Counter(all_items)
            return [{'itemname': i, 'count': c} for i, c in counter.most_common(5)]
        except Exception as e:
            logger.error(f"Error getting common items: {e}")
            return []

    # --- Charts ---

    def _get_monthly_expenses_data(self, request, chart_year):
        """Get monthly expenses data for charts."""
        try:
            monthly_expenses_data = []
            user_shops = self.get_user_shops(request)
            shops = user_shops if user_shops else ['Shop A', 'Shop B']
            
            for shop_name in shops:
                exp_data = ExpenseRecord.objects.filter(
                    shop=shop_name, 
                    date__year=chart_year
                ).annotate(
                    month=ExtractMonth('date')
                ).values('month').annotate(
                    exp=Coalesce(Sum('amount'), 0.0, output_field=DecimalField())
                ).order_by('month')
                
                exp_by_month = {d['month']: float(d['exp']) for d in exp_data}
                monthly_values = [exp_by_month.get(month, 0.0) for month in range(1, 13)]
                
                hash_color = hashlib.md5(shop_name.encode()).hexdigest()[:6]
                monthly_expenses_data.append({
                    'label': f'{shop_name} Expenses',
                    'data': monthly_values,
                    'borderColor': f'#{hash_color}',
                    'fill': False
                })
            
            return monthly_expenses_data
        except Exception as e:
            logger.error(f"Error getting monthly expenses data: {e}")
            return []

    def _get_monthly_business_growth(self, start_date=None, end_date=None):
        """Get monthly business growth data."""
        try:
            # Laundry revenue - use created_at for more reliable filtering
            laundry_qs = Order.objects.all()
            if start_date or end_date:
                laundry_qs = self._apply_date_filters(laundry_qs, 'created_at', start_date, end_date)
            
            # Group by month
            if start_date or end_date:
                laundry_data = laundry_qs.annotate(
                    year=ExtractYear('created_at'),
                    month=ExtractMonth('created_at')
                ).values('year', 'month').annotate(
                    rev=Coalesce(Sum('total_price'), 0.0, output_field=DecimalField())
                ).order_by('year', 'month')
                
                laundry_list = [float(d['rev']) for d in laundry_data]
            else:
                # Default to current year
                current_year = now().year
                laundry_data = laundry_qs.filter(
                    created_at__year=current_year
                ).annotate(
                    month=ExtractMonth('created_at')
                ).values('month').annotate(
                    rev=Coalesce(Sum('total_price'), 0.0, output_field=DecimalField())
                ).order_by('month')
                
                revenue_by_month = {d['month']: float(d['rev']) for d in laundry_data}
                laundry_list = [revenue_by_month.get(m, 0.0) for m in range(1, 13)]

            # Hotel revenue
            hotel_qs = HotelOrder.objects.all()
            if start_date or end_date:
                hotel_qs = self._apply_date_filters(hotel_qs, 'created_at', start_date, end_date)
            
            if start_date or end_date:
                hotel_data = hotel_qs.annotate(
                    year=ExtractYear('created_at'),
                    month=ExtractMonth('created_at')
                ).values('year', 'month').annotate(
                    rev=Coalesce(
                        Sum(Case(
                            When(order_items__oncredit=False, 
                                 then=F('order_items__price') * F('order_items__quantity')),
                            default=0.0,
                            output_field=DecimalField()
                        )), 0.0
                    )
                ).order_by('year', 'month')
                
                hotel_list = [float(d['rev']) for d in hotel_data]
            else:
                current_year = now().year
                hotel_data = hotel_qs.filter(
                    created_at__year=current_year
                ).annotate(
                    month=ExtractMonth('created_at')
                ).values('month').annotate(
                    rev=Coalesce(
                        Sum(Case(
                            When(order_items__oncredit=False, 
                                 then=F('order_items__price') * F('order_items__quantity')),
                            default=0.0,
                            output_field=DecimalField()
                        )), 0.0
                    )
                ).order_by('month')
                
                hotel_by_month = {d['month']: float(d['rev']) for d in hotel_data}
                hotel_list = [hotel_by_month.get(m, 0.0) for m in range(1, 13)]

            # Combine data
            max_len = max(len(laundry_list), len(hotel_list))
            laundry_list += [0.0] * (max_len - len(laundry_list))
            hotel_list += [0.0] * (max_len - len(hotel_list))
            total_list = [laundry_list[i] + hotel_list[i] for i in range(max_len)]

            return [
                {'label': 'Laundry Revenue', 'data': laundry_list, 
                 'borderColor': '#36A2EB', 'fill': False},
                {'label': 'Hotel Revenue', 'data': hotel_list, 
                 'borderColor': '#FF6384', 'fill': False},
                {'label': 'Total Revenue', 'data': total_list, 
                 'borderColor': '#4BC0C0', 'borderDash': [5, 5], 'fill': False}
            ]
        except Exception as e:
            logger.error(f"Error getting monthly business growth: {e}")
            return []

    # --- Main Method ---

    def get_dashboard_data(self, request, start_date=None, end_date=None, payment_status=None, shop=None):
        """Main method to retrieve dashboard data."""
        try:
            logger.info("=== STARTING DASHBOARD DATA COLLECTION ===")
            
            # Get base queryset
            base_qs = self._get_base_queryset(request, start_date, end_date, payment_status, shop)
            
            # Calculate all stats
            order_stats = self._calculate_order_stats(base_qs)
            payment_stats = self._calculate_payment_stats(base_qs)
            payment_type_stats = self._calculate_payment_type_stats(base_qs)
            expense_stats = self._calculate_expense_stats(request, start_date, end_date)
            hotel_stats = self._calculate_hotel_stats(start_date, end_date)
            
            # Calculate business growth
            # Convert to float for consistent arithmetic
            total_revenue = float(order_stats['total_revenue']) + hotel_stats['total_revenue']
            total_expenses = float(expense_stats['total_expenses']) + hotel_stats['total_expenses']
            business_growth = {
                'total_revenue': total_revenue,
                'total_orders': order_stats['total_orders'] + hotel_stats['total_orders'],
                'total_expenses': total_expenses,
                'net_profit': total_revenue - total_expenses
            }
            
            # Get shop-specific data
            shop_a_data = self._get_shop_specific_data(
                base_qs, 'Shop A', expense_stats.get('shop_a_expenses', 0.0)
            )
            shop_b_data = self._get_shop_specific_data(
                base_qs, 'Shop B', expense_stats.get('shop_b_expenses', 0.0)
            )
            
            # Get analytics lists
            order_ids = tuple(base_qs.values_list('id', flat=True))
            common_customers = self._get_common_customers(base_qs)
            payment_methods = self._get_payment_methods(base_qs)
            top_services = self._get_top_services(order_ids)
            common_items = self._get_common_items(order_ids)
            
            # Get charts data
            chart_year = now().year
            if start_date:
                parsed_start = self._parse_date(start_date)
                if parsed_start:
                    chart_year = parsed_start.year
            
            monthly_expenses_data = self._get_monthly_expenses_data(request, chart_year)
            monthly_business_growth = self._get_monthly_business_growth(start_date, end_date)
            
            # Prepare final result
            result = {
                'order_stats': order_stats,
                'payment_stats': payment_stats,
                'payment_type_stats': payment_type_stats,
                'expense_stats': expense_stats,
                'hotel_stats': hotel_stats,
                'business_growth': business_growth,
                'common_customers': common_customers,
                'payment_methods': payment_methods,
                'top_services': top_services,
                'common_items': common_items,
                'service_types': top_services,
                'monthly_expenses_data': monthly_expenses_data,
                'monthly_business_growth': monthly_business_growth,
                'shop_a_stats': shop_a_data['stats'],
                'shop_b_stats': shop_b_data['stats'],
                'shop_a_orders': shop_a_data['orders_by_payment_status'],
                'shop_b_orders': shop_b_data['orders_by_payment_status'],
                'orders_by_payment_status': self._get_orders_by_payment_status(base_qs),
                # Revenue by shop
                'revenue_by_shop': [
                    {'shop': 'Shop A', 'total_revenue': float(shop_a_data['stats'].get('revenue', 0)), 'paid': float(shop_a_data['stats'].get('total_amount_paid', 0)), 'bal': float(shop_a_data['stats'].get('total_balance', 0))},
                    {'shop': 'Shop B', 'total_revenue': float(shop_b_data['stats'].get('revenue', 0)), 'paid': float(shop_b_data['stats'].get('total_amount_paid', 0)), 'bal': float(shop_b_data['stats'].get('total_balance', 0))}
                ],
                # Balance by shop
                'balance_by_shop': [
                    {'shop': 'Shop A', 'total_balance': float(shop_a_data['stats'].get('total_balance', 0))},
                    {'shop': 'Shop B', 'total_balance': float(shop_b_data['stats'].get('total_balance', 0))}
                ]
            }
            
            # Convert all Decimal values to float for JSON serialization
            self._convert_decimals_to_floats(result)
            
            logger.info(f"=== DASHBOARD DATA COMPLETE ===")
            logger.info(f"Total Orders: {order_stats['total_orders']}")
            logger.info(f"Total Revenue: {total_revenue}")
            logger.info(f"Net Profit: {business_growth['net_profit']}")
            
            return result
            
        except Exception as e:
            logger.error(f"CRITICAL ERROR in get_dashboard_data: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return self._get_empty_dashboard_data()

    def _convert_decimals_to_floats(self, data):
        """Recursively convert Decimal values to floats."""
        if isinstance(data, dict):
            for key, value in data.items():
                if hasattr(value, '__float__'):
                    data[key] = float(value)
                elif isinstance(value, (dict, list)):
                    self._convert_decimals_to_floats(value)
        elif isinstance(data, list):
            for i, item in enumerate(data):
                if hasattr(item, '__float__'):
                    data[i] = float(item)
                elif isinstance(item, (dict, list)):
                    self._convert_decimals_to_floats(item)