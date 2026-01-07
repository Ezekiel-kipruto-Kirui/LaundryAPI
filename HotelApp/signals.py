from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Sum
from .models import HotelOrderItem, FoodItem


def recalculate_food_item(food_item):
    totals = HotelOrderItem.objects.filter(
        food_item=food_item,
        oncredit=False
    ).aggregate(
        total_quantity=Sum('quantity'),
        total_revenue=Sum('price')
    )

    food_item.quantity = totals['total_quantity'] or 0
    food_item.total_order_price = totals['total_revenue'] or 0
    food_item.save(update_fields=['quantity', 'total_order_price'])


@receiver(post_save, sender=HotelOrderItem)
def update_food_item_on_save(sender, instance, **kwargs):
    recalculate_food_item(instance.food_item)


@receiver(post_delete, sender=HotelOrderItem)
def update_food_item_on_delete(sender, instance, **kwargs):
    recalculate_food_item(instance.food_item)
