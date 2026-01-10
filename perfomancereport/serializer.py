# perfomancereport/serializers.py
from rest_framework import serializers
from decimal import Decimal

class DashboardSerializer(serializers.Serializer):
    """
    Serializer to format the Dashboard Dictionary data for API responses.
    Handles conversion of Decimals to Floats and formats the structure cleanly.
    """
    
    # Nested serializers for organization
    class OrderStatsSerializer(serializers.Serializer):
        total_orders = serializers.IntegerField()
        pending_orders = serializers.IntegerField()
        completed_orders = serializers.IntegerField()
        delivered_orders = serializers.IntegerField()
        total_revenue = serializers.FloatField()
        avg_order_value = serializers.FloatField()
        total_balance = serializers.FloatField()
        total_amount_paid = serializers.FloatField()

    class PaymentStatsSerializer(serializers.Serializer):
        pending_payments = serializers.IntegerField()
        partial_payments = serializers.IntegerField()
        complete_payments = serializers.IntegerField()
        total_pending_amount = serializers.FloatField()
        total_partial_amount = serializers.FloatField()
        total_complete_amount = serializers.FloatField()
        total_collected_amount = serializers.FloatField()
        total_balance_amount = serializers.FloatField()
        overdue_payments = serializers.IntegerField(required=False, default=0)
        total_overdue_amount = serializers.FloatField(required=False, default=0.0)

    class ExpenseStatsSerializer(serializers.Serializer):
        total_expenses = serializers.FloatField()
        shop_a_expenses = serializers.FloatField()
        shop_b_expenses = serializers.FloatField()
        average_expense = serializers.FloatField()

    class HotelStatsSerializer(serializers.Serializer):
        total_orders = serializers.IntegerField()
        total_revenue = serializers.FloatField()
        avg_order_value = serializers.FloatField()
        total_expenses = serializers.FloatField()
        net_profit = serializers.FloatField()

    class BusinessGrowthSerializer(serializers.Serializer):
        total_revenue = serializers.FloatField()
        total_orders = serializers.IntegerField()
        total_expenses = serializers.FloatField()
        net_profit = serializers.FloatField()

    class ShopStatsSerializer(serializers.Serializer):
        revenue = serializers.FloatField()
        total_orders = serializers.IntegerField()
        pending_orders = serializers.IntegerField()
        completed_orders = serializers.IntegerField()
        pending_payments = serializers.IntegerField()
        partial_payments = serializers.IntegerField()
        complete_payments = serializers.IntegerField()
        total_pending_amount = serializers.FloatField()
        total_partial_amount = serializers.FloatField()
        total_complete_amount = serializers.FloatField()
        total_balance = serializers.FloatField()
        total_amount_paid = serializers.FloatField()
        total_expenses = serializers.FloatField()
        net_profit = serializers.FloatField()

    # Main Serializer Fields
    order_stats = OrderStatsSerializer(required=False)
    payment_stats = PaymentStatsSerializer(required=False)
    payment_type_stats = serializers.DictField(child=serializers.DictField(), required=False)
    expense_stats = ExpenseStatsSerializer(required=False)
    hotel_stats = HotelStatsSerializer(required=False)
    business_growth = BusinessGrowthSerializer(required=False)
    
    revenue_by_shop = serializers.ListField(required=False)
    balance_by_shop = serializers.ListField(required=False)
    expenses_by_shop = serializers.ListField(required=False)
    
    # Revenue by shop item structure
    class RevenueByShopSerializer(serializers.Serializer):
        shop = serializers.CharField()
        total_revenue = serializers.FloatField()
        paid = serializers.FloatField()
        bal = serializers.FloatField()
    
    class BalanceByShopSerializer(serializers.Serializer):
        shop = serializers.CharField()
        total_balance = serializers.FloatField()
    
    common_customers = serializers.ListField(required=False)
    payment_methods = serializers.ListField(required=False)
    top_services = serializers.ListField(required=False)
    common_items = serializers.ListField(required=False)
    service_types = serializers.ListField(required=False)
    
    line_chart_data = serializers.ListField(required=False)
    monthly_order_volume = serializers.ListField(required=False)
    monthly_expenses_data = serializers.ListField(required=False)
    monthly_business_growth = serializers.ListField(required=False)
    
    shop_a_stats = ShopStatsSerializer(required=False)
    shop_b_stats = ShopStatsSerializer(required=False)
    
    # We use DictField for orders because they are grouped by string keys ('pending', etc)
    shop_a_orders = serializers.DictField(child=serializers.ListField(), required=False)
    shop_b_orders = serializers.DictField(child=serializers.ListField(), required=False)
    orders_by_payment_status = serializers.DictField(child=serializers.ListField(), required=False)

    def _convert_decimal(self, data):
        """Recursively convert Decimals to Floats in a data structure."""
        if isinstance(data, Decimal):
            return float(data)
        elif isinstance(data, dict):
            return {k: self._convert_decimal(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._convert_decimal(i) for i in data]
        # Handle PhoneNumber objects
        elif hasattr(data, '__str__'):
            return str(data)
        return data

    def to_representation(self, instance):
        """
        Override to_representation to handle Decimal to Float conversion globally
        and ensure nested structures are serialized correctly.
        """
        # The 'instance' here is the python dictionary returned by get_dashboard_data
        # First, convert all decimals to floats in the raw data
        converted_instance = self._convert_decimal(instance)
        
        # Then call parent representation to validate structure via nested serializers
        data = super().to_representation(converted_instance)
        return data