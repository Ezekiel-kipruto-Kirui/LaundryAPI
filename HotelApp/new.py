# from django.db.models import Sum
# from HotelApp.models import HotelOrderItem, FoodItem   # replace with your real app name

# # Calculate total price for each food item (sum of price only)
# totals = HotelOrderItem.objects.values('food_item').annotate(
#     total_cash=Sum('price')
# )

# # Save into FoodItem model
# for item in totals:
#     food = FoodItem.objects.get(id=item['food_item'])
#     food.total_amount_cash = item['total_cash']
#     food.save()

# print("Total revenue per food item updated successfully!")
import os
import django

# 1. Set the environment variable to point to your settings file
# Replace 'LaundryAPI.settings' with the actual path to your settings 
# (the folder containing settings.py)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'LaundryAPI.settings')

# 2. Initialize Django
django.setup()
from django.db.models import Sum
from models import HotelOrderItem, FoodItem

totals = HotelOrderItem.objects.values('food_item').annotate(total_cash=Sum('price'))

for item in totals:
    food = FoodItem.objects.get(id=item['food_item'])
    food.total_amount_cash = item['total_cash']
    food.save()
print("Total revenue per food item updated successfully!")


