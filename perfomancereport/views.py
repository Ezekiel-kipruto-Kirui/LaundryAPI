# perfomancereport/views.py - Convert to ViewSets
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated,AllowAny
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from .analytics import DashboardAnalytics
from .serializer import DashboardSerializer
import logging

logger = logging.getLogger(__name__)

class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    
    @method_decorator(cache_page(300))
    def list(self, request):
        """Get full dashboard data"""
        try:
            start_date = request.GET.get('start_date')
            end_date = request.GET.get('end_date')
            payment_status = request.GET.get('payment_status')
            shop = request.GET.get('shop')
            
            analytics = DashboardAnalytics()
            dashboard_data = analytics.get_dashboard_data(
                request=request,
                start_date=start_date,
                end_date=end_date,
                payment_status=payment_status,
                shop=shop
            )
            
            serializer = DashboardSerializer(data=dashboard_data)
            if serializer.is_valid():
                return Response({
                    'success': True,
                    'data': serializer.data,
                    'message': 'Dashboard data retrieved successfully'
                })
            else:
                return Response({
                    'success': False,
                    'error': 'Data serialization failed',
                    'details': serializer.errors
                }, status=400)
                
        except Exception as e:
            return Response({
                'success': False,
                'error': 'Failed to retrieve dashboard data',
                'details': str(e)
            }, status=500)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get key stats only"""
        try:
            analytics = DashboardAnalytics()
            dashboard_data = analytics.get_dashboard_data(request)
            
            key_stats = {
                'total_revenue': dashboard_data.get('business_growth', {}).get('total_revenue', 0),
                'total_orders': dashboard_data.get('business_growth', {}).get('total_orders', 0),
                'net_profit': dashboard_data.get('business_growth', {}).get('net_profit', 0),
                'total_expenses': dashboard_data.get('business_growth', {}).get('total_expenses', 0),
                'laundry_stats': dashboard_data.get('order_stats', {}),
                'hotel_stats': dashboard_data.get('hotel_stats', {}),
                'payment_stats': dashboard_data.get('payment_stats', {}),
            }
            
            return Response({
                'success': True,
                'data': key_stats,
                'message': 'Dashboard stats retrieved successfully'
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': 'Failed to retrieve dashboard stats',
                'details': str(e)
            }, status=500)