from django.urls import path
from . import views 

urlpatterns = [

# path("stk-push/", stk_push, name="stk_push"),

# path("stk-push-callback/", stk_push_callback, name="stk_push_callback"),
   path('stk-push/', views.index, name='index'),
    path('callback/', views.stk_push_callback, name='mpesa_stk_push_callback'),
]
