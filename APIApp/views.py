import base64
import json
import logging
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django_daraja.models import AccessToken
from django_daraja.mpesa.utils import api_base_url, format_phone_number, mpesa_access_token
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


logger = logging.getLogger(__name__)
LOCAL_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0"}


@csrf_exempt
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def stk_push(request):
    if request.method == "GET":
        return Response(
            {
                "message": "Send a POST request to initiate STK Push.",
                "required_fields": ["phone_number", "amount"],
            },
            status=status.HTTP_200_OK,
        )

    try:
        phone_number = request.data.get("phone_number")
        amount = request.data.get("amount")

        if not phone_number:
            return Response(
                {"error": "phone_number is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if amount in (None, ""):
            return Response(
                {"error": "amount is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amount = int(amount)
        except (TypeError, ValueError):
            return Response(
                {"error": "Amount must be an integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if amount <= 0:
            return Response(
                {"error": "Amount must be greater than 0"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        callback_url = str(getattr(settings, "MPESA_CALLBACK_URL", "") or "").strip().strip("\"'")
        if not callback_url:
            callback_url = request.build_absolute_uri(reverse("stk_push_callback"))

        parsed_callback = urlparse(callback_url)
        invalid_host = (parsed_callback.hostname or "").lower() in LOCAL_HOSTS
        if parsed_callback.scheme != "https" or invalid_host or not parsed_callback.netloc:
            return Response(
                {
                    "error": (
                        "Invalid callback URL. Set MPESA_CALLBACK_URL to a public HTTPS endpoint."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            phone_number = format_phone_number(str(phone_number))
        except Exception:
            return Response(
                {
                    "error": (
                        "Invalid phone_number format. Use Kenyan format like "
                        "0712345678 or 254712345678."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        mpesa_environment = str(getattr(settings, "MPESA_ENVIRONMENT", "sandbox") or "").strip().lower()
        express_shortcode = str(getattr(settings, "MPESA_EXPRESS_SHORTCODE", "") or "").strip().strip("\"'")
        shortcode = str(getattr(settings, "MPESA_SHORTCODE", "") or "").strip().strip("\"'")
        business_short_code = (
            express_shortcode or shortcode if mpesa_environment == "sandbox" else shortcode or express_shortcode
        )

        passkey = str(getattr(settings, "MPESA_PASSKEY", "") or "").strip().strip("\"'")
        consumer_key = str(getattr(settings, "MPESA_CONSUMER_KEY", "") or "").strip().strip("\"'")
        consumer_secret = str(getattr(settings, "MPESA_CONSUMER_SECRET", "") or "").strip().strip("\"'")

        missing = []
        if not consumer_key:
            missing.append("MPESA_CONSUMER_KEY")
        if not consumer_secret:
            missing.append("MPESA_CONSUMER_SECRET")
        if not business_short_code:
            missing.append("MPESA_SHORTCODE/MPESA_EXPRESS_SHORTCODE")
        if not passkey:
            missing.append("MPESA_PASSKEY")
        if missing:
            return Response(
                {"error": "Missing Daraja configuration: " + ", ".join(sorted(missing))},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        shortcode_type = str(getattr(settings, "MPESA_SHORTCODE_TYPE", "paybill") or "").strip().lower()
        transaction_type = (
            "CustomerBuyGoodsOnline"
            if shortcode_type in {"till", "till_number", "buygoods"}
            else "CustomerPayBillOnline"
        )

        timestamp = timezone.localtime().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode(
            f"{business_short_code}{passkey}{timestamp}".encode("ascii")
        ).decode("utf-8")

        stk_payload = {
            "BusinessShortCode": business_short_code,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": transaction_type,
            "Amount": amount,
            "PartyA": phone_number,
            "PhoneNumber": phone_number,
            "CallBackURL": callback_url,
            "AccountReference": "LaundryPay",
            "TransactionDesc": "Laundry payment",
        }

        headers = {
            "Authorization": f"Bearer {mpesa_access_token()}",
            "Content-Type": "application/json",
        }
        url = f"{api_base_url().rstrip('/')}/mpesa/stkpush/v1/processrequest"

        response = requests.post(url, json=stk_payload, headers=headers, timeout=30)
        try:
            response_payload = response.json()
        except Exception:
            response_payload = {"raw_response": response.text}

        if (
            response.status_code >= 400
            and isinstance(response_payload, dict)
            and response_payload.get("errorCode") == "404.001.03"
        ):
            AccessToken.objects.all().delete()
            headers["Authorization"] = f"Bearer {mpesa_access_token()}"
            response = requests.post(url, json=stk_payload, headers=headers, timeout=30)
            try:
                response_payload = response.json()
            except Exception:
                response_payload = {"raw_response": response.text}

        if response.status_code >= 400:
            logger.error("Daraja STK push failed (status=%s): %s", response.status_code, response_payload)

        return Response(response_payload, status=response.status_code)
    except requests.RequestException as exc:
        return Response(
            {
                "error": "Could not reach Daraja API. Check internet access and MPESA_ENVIRONMENT.",
                "details": str(exc),
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except Exception as exc:
        return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def stk_push_callback(request):
    try:
        payload = request.data if isinstance(request.data, dict) else {}
        if not payload:
            raw_body = request.body.decode("utf-8", errors="replace")
            payload = json.loads(raw_body) if raw_body else {}

        callback = payload.get("Body", {}).get("stkCallback", {})
        callback_items = callback.get("CallbackMetadata", {}).get("Item", [])
        callback_metadata = {}

        if isinstance(callback_items, list):
            for item in callback_items:
                if isinstance(item, dict) and item.get("Name"):
                    callback_metadata[item["Name"]] = item.get("Value")

        logger.info(
            "M-Pesa callback result_code=%s checkout_request_id=%s merchant_request_id=%s metadata=%s",
            callback.get("ResultCode"),
            callback.get("CheckoutRequestID"),
            callback.get("MerchantRequestID"),
            callback_metadata,
        )

        return Response({"ResultCode": 0, "ResultDesc": "Accepted"}, status=status.HTTP_200_OK)
    except Exception as exc:
        logger.exception("Failed to process M-Pesa callback")
        return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
