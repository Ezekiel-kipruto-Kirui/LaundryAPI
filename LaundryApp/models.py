# laundry/LaundryApp/models.py
from __future__ import annotations
import uuid
import logging
from decimal import Decimal
from typing import cast
from django.db import models, transaction, IntegrityError
from django.db.models import Sum
import requests
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import AbstractUser, BaseUserManager
from .sms_utility import send_sms
from phonenumber_field.modelfields import PhoneNumberField
import phonenumbers
from django.conf import settings
from multiselectfield import MultiSelectField
from django.contrib.postgres.fields import ArrayField



logger = logging.getLogger(__name__)

try:
    from django.db.models import JSONField
except ImportError:
    from django.contrib.postgres.fields import JSONField
class shoptype(models.Model):
    SHOP_CHOICE = (
        ('Shop A','Shop A'),
        ('Shop B','Shop B'),
        ('Hotel','Hotel')
    )
    shoptype= models.CharField(max_length=50, choices=SHOP_CHOICE)
    def __str__(self):
        return f"{self.shoptype}"


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")

        email = self.normalize_email(email)

        # ✅ CRITICAL DEFAULTS
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("is_active", True)

        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        return self.create_user(email, password, **extra_fields)


class UserProfile(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

   
    USER_TYPE_CHOICES = (
        ('admin', 'Admin'),
        ('staff', 'Staff'),
    )
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES, db_index=True)

    objects = CustomUserManager()  # pyright: ignore[reportAssignmentType]

    def __str__(self):
        return f"{self.email} - {self.user_type})"




class Customer(models.Model):
    name = models.CharField(max_length=200, db_index=True)
    phone = PhoneNumberField(region="KE", unique=True, db_index=True)  # pyright: ignore[reportCallIssue]
    address = models.CharField(max_length=255, default='',  null=True, blank=True)
    created_by = models.ForeignKey(
    UserProfile,
    # settings.AUTH_USER_MODEL,   # <--- THIS is the fix
        on_delete=models.CASCADE,
        null=True
    )
    
    def __str__(self):
        return f"{self.name} ({self.phone})"

    def clean(self):
        super().clean()
        if self.phone:
            try:
                parsed = phonenumbers.parse(str(self.phone), "KE")
                self.phone = phonenumbers.format_number(
                    parsed, phonenumbers.PhoneNumberFormat.E164
                )
            except phonenumbers.NumberParseException:
                raise ValueError("Invalid phone number format. Example: +254712345678")


class Order(models.Model):
    """Main order model that contains multiple order items"""
    
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name='orders', db_index=True
    )
    uniquecode = models.CharField(max_length=10, unique=True, blank=True, editable=False)

    PAYMENT_TYPE_CHOICES = (
        ('cash', 'Cash'),
        ('M-Pesa', 'M-Pesa'),
        ('card', 'Credit/Debit Card'),
        ('bank_transfer', 'Bank Transfer'),
        ('other', 'Other'),
        ('None', 'None'),

    )
    payment_type = models.CharField(max_length=50, choices=PAYMENT_TYPE_CHOICES,
                                    default='None', blank=True, db_index=True)

    PAYMENT_STATUS_CHOICES = (
        ('pending', 'pending'),
        ('completed', 'complete'),
        ('partial', 'partial'),
    )
    payment_status = models.CharField(max_length=50, choices=PAYMENT_STATUS_CHOICES,
                                      default='pending', blank=True, db_index=True)

    SHOP_CHOICE = (
        ('Shop A', 'Shop A'),
        ('Shop B', 'Shop B'),
    )
    shop = models.CharField(max_length=50, choices=SHOP_CHOICE, db_index=True)

    delivery_date = models.DateField(db_index=True)

    ORDER_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('Completed', 'Completed'),
        ('Delivered_picked', 'Delivered_picked'),
    )
    order_status = models.CharField(max_length=50, choices=ORDER_STATUS_CHOICES,
                                    default='pending', db_index=True)

    addressdetails = models.TextField(default='', blank=True)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), editable=False)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    #created_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True)
    
    created_by = models.ForeignKey(
    UserProfile,
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='orders_created'
    )
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    updated_by = models.ForeignKey(
        UserProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders_updated'
    )

    
    previous_order_status = models.CharField(max_length=50, blank=True, null=True)

    def save(self, *args, **kwargs):

        with transaction.atomic():  # pyright: ignore[reportGeneralTypeIssues]
            if not self.uniquecode:
                prefix = "ORD"
                for _ in range(5):
                    unique_id = uuid.uuid4().hex[:5].upper()
                    new_code = f"{prefix}-{unique_id}"
                    if not Order.objects.filter(uniquecode=new_code).exists():
                        self.uniquecode = new_code
                        break
                else:
                    raise IntegrityError("Could not generate unique order code.")
            
            # Set payment status
            if self.amount_paid == 0:
                self.payment_status = 'pending'
            elif self.balance > 0 and self.balance < self.total_price:
                self.payment_status = 'partial'
            elif self.balance == 0:
                self.payment_status = 'completed'
            if self.payment_status == 'pending':
                self.payment_type = 'None'

            if self.pk:
                try:
                    old_instance = Order.objects.get(pk=self.pk)
                    self.previous_order_status = old_instance.order_status
                except Order.DoesNotExist:
                    pass

            super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Order"
        verbose_name_plural = "Orders"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order_status']),
            models.Index(fields=['payment_status']),
            models.Index(fields=['delivery_date']),
            models.Index(fields=['shop']),
        ]

    def __str__(self):
        customer_name = getattr(self.customer, "name", "Unknown")
        return f"Order {self.uniquecode} for {customer_name}"


class OrderItem(models.Model):
    """Individual items/services within an order"""
    order = models.ForeignKey(Order, on_delete=models.CASCADE,related_name='items', db_index=True)
    SERVICE_TYPES = (
        ('Washing', 'Washing'),
        ('Folding', 'Folding'),
        ('Ironing', 'Ironing'),
        ('Dry cleaning', 'Dry cleaning'),
    )
    servicetype = MultiSelectField(max_length=50, choices=SERVICE_TYPES,
                                   default='Washing', db_index=True)

    ITEMS_CATEGORY = (
        ('Clothing', 'Clothing'),
        ('Bedding', 'Bedding'),
        ('Household items', 'Household items'),
        ('Footwares', 'Footwares'),
    )
    itemtype = MultiSelectField(max_length=100, choices=ITEMS_CATEGORY,
                                default='Clothing', db_index=True)

    itemname = models.TextField()
    quantity = models.PositiveIntegerField(default=1)
    ITEM_CONDITION_CHOICES = (
        ('New', 'New'),
        ('Old', 'Old'),
        ('Torn', 'Torn'),
    )
    itemcondition = models.CharField(max_length=50, choices=ITEM_CONDITION_CHOICES,
                                     default='new', db_index=True)
    additional_info = models.TextField(blank=True, null=True)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_item_price = models.DecimalField(max_digits=12, decimal_places=2,
                                           default=Decimal("0.00"), editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.itemname:
            item_name = str(self.itemname)
            items = [item.strip() for item in item_name.split(',') if item.strip()]
            self.itemname = ', '.join(items)

        self.total_item_price = self.unit_price or Decimal("0.00")
        super().save(*args, **kwargs)

        # Update order totals only if needed
        order = cast(Order, self.order)
        if order and order.pk:
            order_total = OrderItem.objects.filter(order=order).aggregate(total=Sum('total_item_price'))['total']
            if order_total is None:
                order_total = Decimal("0.00")
            if order_total != order.total_price:
                order.total_price = order_total
                order.balance = Decimal(str(order.total_price)) - Decimal(str(order.amount_paid))
                order.save(update_fields=['total_price', 'balance'])

    def get_item_list(self):
        return [item.strip() for item in str(self.itemname).split(',') if item.strip()] if self.itemname else []

    def item_count(self):
        return len(self.get_item_list())

    class Meta:
        verbose_name = "Order Item"
        verbose_name_plural = "Order Items"
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['servicetype']),
            models.Index(fields=['itemtype']),
        ]

    def __str__(self):
        items = self.get_item_list()
        if len(items) > 3:
            return f"{self.quantity} x {', '.join(items[:3])}... ({self.servicetype})"
        return f"{self.quantity} x {', '.join(items)} ({self.servicetype})"


class ExpenseField(models.Model):
    label = models.CharField(max_length=100, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('label',)  # Prevent duplicate labels

    def __str__(self):
        return self.label


class ExpenseRecord(models.Model):
    field = models.ForeignKey(
        ExpenseField, on_delete=models.CASCADE, related_name="records", db_index=True
    )
    shop = models.CharField(max_length=100, choices=Order.SHOP_CHOICE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField(auto_now_add=True, db_index=True)
    notes = models.CharField(max_length=150, null=True, blank=True)

    def __str__(self):
        return f"{self.field.label}: {self.amount}"


class Payment(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE,related_name='payment', db_index=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ['-id']

    def __str__(self):
        return f"Payment for {self.order.uniquecode} - KSh {self.price}"


def _build_order_items_summary(order: Order) -> str:
    item_entries: list[str] = []

    for order_item in order.items.all():
        names = order_item.get_item_list()
        if not names and order_item.itemname:
            names = [str(order_item.itemname).strip()]

        quantity = int(order_item.quantity or 1)
        for name in names:
            if quantity > 1:
                item_entries.append(f"{quantity}x {name}")
            else:
                item_entries.append(name)

    if not item_entries:
        return "items not specified"

    max_items_in_sms = 6
    visible_items = item_entries[:max_items_in_sms]
    summary = ", ".join(visible_items)
    hidden_count = len(item_entries) - max_items_in_sms
    if hidden_count > 0:
        summary = f"{summary}, +{hidden_count} more"

    return summary


def _format_currency(value: Decimal) -> str:
    return f"KSh {Decimal(value).quantize(Decimal('0.01'))}"


def _send_order_sms(customer_phone: str, order_code: str, message_body: str) -> None:
    success, response = send_sms(customer_phone, message_body)

    if success:
        logger.info(
            f"SMS sent successfully for order {order_code} | SID={response}"
        )
    else:
        logger.error(
            f"Failed to send SMS for order {order_code} | Error={response}"
        )


@receiver(post_save, sender=Order)
def handle_order_sms(sender, instance, created, **kwargs):
    customer = instance.customer
    customer_phone = str(customer.phone).strip() if customer.phone else None
    order_code = instance.uniquecode

    # Validate phone number format (+countrycode)
    if not customer_phone or not customer_phone.startswith("+"):
        logger.warning(
            f"Invalid phone number for order {order_code}: {customer_phone}"
        )
        return

    message_body = None

    # NEW ORDER CREATED
    if created:
        def send_created_order_sms():
            try:
                order_with_items = (
                    Order.objects.select_related("customer")
                    .prefetch_related("items")
                    .get(pk=instance.pk)
                )
            except Order.DoesNotExist:
                logger.error(
                    f"Order not found while preparing SMS for {order_code}"
                )
                return

            items_summary = _build_order_items_summary(order_with_items)
            total_price = _format_currency(order_with_items.total_price)
            amount_paid = _format_currency(order_with_items.amount_paid)
            balance = _format_currency(order_with_items.balance)
            created_message = (
                f"Hello {order_with_items.customer.name}! "
                f"Your order {order_with_items.uniquecode} has been received. "
                f"Items: {items_summary}. "
                f"Total: {total_price}. "
                f"Paid: {amount_paid}. "
                f"Balance: {balance}. "
                "And it is now being processed."
            )
            _send_order_sms(customer_phone, order_code, created_message)

        transaction.on_commit(send_created_order_sms)
        return

    # ORDER COMPLETED (status change only)
    elif (
        instance.order_status == "Completed"
        and getattr(instance, "previous_order_status", None) != "Completed"
    ):
        message_body = (
            f"Hi {customer.name}, your order {order_code} is now complete! "
            "Thank you for choosing our laundry service."
        )

    # ORDER DELIVERED / PICKED UP (status change only)
    elif (
        instance.order_status == "Delivered_picked"
        and getattr(instance, "previous_order_status", None) != "Delivered_picked"
    ):
        message_body = (
            f"Hello {customer.name}, your order {order_code} has been delivered successfully. "
            "We appreciate your trust in our services!"
        )

    # SEND SMS USING TWILIO MESSAGING SERVICE
    if message_body:
        _send_order_sms(customer_phone, order_code, message_body)
