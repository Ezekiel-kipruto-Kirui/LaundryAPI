import os
from django.db import models
from django.conf import settings
from django.utils import timezone

class FoodCategory(models.Model):
    name = models.CharField(max_length=100, unique=True, db_index=True)

    def __str__(self):
        return self.name



class FoodItem(models.Model):
    category = models.ForeignKey(FoodCategory, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=100, db_index=True)
   
   

    # seller who uploaded this food
    created_by =  models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE)
    # stock management
    quantity = models.PositiveIntegerField(default=0)  # how many portions are available
   

    def __str__(self):
        return f"{self.name}"

class HotelOrder(models.Model):
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"HotelOrder {self.id} by {self.created_by.username}"

    def get_total(self):
        # Calculate total as quantity * price for each item, then sum
        total = 0
        for item in self.order_items.all():
            total += item.get_total_price()
        return total


# Add this to your HotelOrderItem model
class HotelOrderItem(models.Model):
    order = models.ForeignKey(HotelOrder, on_delete=models.CASCADE, related_name='order_items',null=True)
    food_item = models.ForeignKey(FoodItem, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    oncredit = models.BooleanField(default=False, null=True,blank=True)
    name = models.CharField(max_length=50,null=True)
    created_at = models.DateTimeField(auto_now_add=True,null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True
    )
    
    def save(self, *args, **kwargs):
        # Ensure no availability checks in save method
        super().save(*args, **kwargs)
                
        super().save(*args, **kwargs)

    def get_total_price(self):
        """Calculate total price for this order item"""
        return self.price

    def __str__(self):
        return f"{self.food_item.name}"


class HotelExpenseField(models.Model):
    label = models.CharField(max_length=100, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('label',)  # Prevent duplicate labels

    def __str__(self):
        return self.label


class HotelExpenseRecord(models.Model):
    field = models.ForeignKey(
        HotelExpenseField, on_delete=models.CASCADE, related_name="records", db_index=True
    )
   
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField(auto_now_add=True, db_index=True)
    notes = models.CharField(max_length=150, null=True, blank=True)

    def __str__(self):
        return f"{self.field.label}: {self.amount}"
