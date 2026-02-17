from django.urls import path
from .views import stk_push, stk_push_callback, send_email_api

urlpatterns = [
    path('stk-push/', stk_push, name='stk_push'),
    path('callback/', stk_push_callback, name='stk_push_callback'),
    path('send-email/', send_email_api, name='send_email_api'),
]
