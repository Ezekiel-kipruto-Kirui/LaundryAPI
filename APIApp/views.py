import base64
import json
import logging
import re
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django_daraja.models import AccessToken
from django_daraja.mpesa.utils import api_base_url, format_phone_number, mpesa_access_token
from rest_framework.exceptions import ParseError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


logger = logging.getLogger(__name__)
LOCAL_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0"}
STK_ENDPOINT = "mpesa/stkpush/v1/processrequest"
MSISDN_PATTERN = re.compile(r"^2547\d{8}$")


def _setting(name, default=""):
    value = str(getattr(settings, name, default) or "").strip()
    return value.strip("\"'")


def _resolve_callback_url(request):
    callback_url = _setting("MPESA_CALLBACK_URL")
    if not callback_url:
        callback_url = request.build_absolute_uri(reverse("stk_push_callback"))

    parsed = urlparse(callback_url)
    invalid_host = (parsed.hostname or "").lower() in LOCAL_HOSTS
    if parsed.scheme != "https" or invalid_host or not parsed.netloc:
        raise ValueError(
            "Invalid callback URL. Set MPESA_CALLBACK_URL to a public HTTPS endpoint."
        )
    return callback_url


def _resolve_shortcode():
    environment = _setting("MPESA_ENVIRONMENT", "sandbox").lower()
    express_shortcode = _setting("MPESA_EXPRESS_SHORTCODE")
    shortcode = _setting("MPESA_SHORTCODE")
    if environment == "sandbox":
        return express_shortcode or shortcode
    return shortcode or express_shortcode


def _transaction_type():
    shortcode_type = _setting("MPESA_SHORTCODE_TYPE", "paybill").lower()
    if shortcode_type in {"till", "till_number", "buygoods"}:
        return "CustomerBuyGoodsOnline"
    return "CustomerPayBillOnline"


def _build_stk_payload(phone_number, amount, callback_url):
    shortcode = _resolve_shortcode()
    passkey = _setting("MPESA_PASSKEY")

    missing = []
    if not _setting("MPESA_CONSUMER_KEY"):
        missing.append("MPESA_CONSUMER_KEY")
    if not _setting("MPESA_CONSUMER_SECRET"):
        missing.append("MPESA_CONSUMER_SECRET")
    if not shortcode:
        missing.append("MPESA_SHORTCODE/MPESA_EXPRESS_SHORTCODE")
    if not passkey:
        missing.append("MPESA_PASSKEY")
    if missing:
        raise ValueError("Missing Daraja configuration: " + ", ".join(sorted(missing)))

    timestamp = timezone.localtime().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(f"{shortcode}{passkey}{timestamp}".encode("ascii")).decode(
        "utf-8"
    )

    return {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": _transaction_type(),
        "Amount": amount,
        "PartyA": phone_number,
        "PartyB": shortcode,
        "PhoneNumber": phone_number,
        "CallBackURL": callback_url,
        "AccountReference": "LaundryPay",
        "TransactionDesc": "Laundry Payment",
    }


def _response_json(response):
    try:
        return response.json()
    except Exception:
        return {"raw_response": response.text}


def _daraja_post(path, payload):
    headers = {
        "Authorization": f"Bearer {mpesa_access_token()}",
        "Content-Type": "application/json",
    }
    url = f"{api_base_url().rstrip('/')}/{path.lstrip('/')}"
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    body = _response_json(response)

    if response.status_code >= 400 and body.get("errorCode") == "404.001.03":
        AccessToken.objects.all().delete()
        headers["Authorization"] = f"Bearer {mpesa_access_token()}"
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        body = _response_json(response)

    return response, body


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
        request_payload = request.data if isinstance(request.data, dict) else {}
    except ParseError as exc:
        return Response(
            {
                "error": (
                    "Invalid JSON body. Ensure each key/value uses double quotes "
                    "and a ':' separator."
                ),
                "details": str(exc),
                "example": {"phone_number": "254712345678", "amount": 1},
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not request_payload:
        request_payload = request.query_params

    phone_number = request_payload.get("phone_number")
    amount = request_payload.get("amount")
    account_reference = str(request_payload.get("account_reference", "LaundryPay") or "").strip()
    transaction_desc = str(request_payload.get("transaction_desc", "Laundry Payment") or "").strip()

    if not phone_number:
        return Response({"error": "phone_number is required"}, status=status.HTTP_400_BAD_REQUEST)
    if amount in (None, ""):
        return Response({"error": "amount is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        amount = int(amount)
    except (TypeError, ValueError):
        return Response({"error": "Amount must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

    if amount <= 0:
        return Response(
            {"error": "Amount must be greater than 0"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        callback_url = _resolve_callback_url(request)
        raw_phone = "".join(ch for ch in str(phone_number).strip() if ch.isdigit())
        formatted_phone = format_phone_number(raw_phone)
        if not MSISDN_PATTERN.match(formatted_phone):
            return Response(
                {"error": "Invalid phone_number. Use Safaricom format 07XXXXXXXX or 2547XXXXXXXX."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        payload = _build_stk_payload(formatted_phone, amount, callback_url)
        if account_reference:
            payload["AccountReference"] = account_reference[:20]
        if transaction_desc:
            payload["TransactionDesc"] = transaction_desc[:80]

        response, response_payload = _daraja_post(STK_ENDPOINT, payload)
        if (
            response.status_code >= 400
            and isinstance(response_payload, dict)
            and response_payload.get("errorCode") == "400.002.02"
        ):
            response_payload["hint"] = (
                "PartyA/PhoneNumber must be a valid Safaricom MSISDN in format 2547XXXXXXXX."
            )
        return Response(response_payload, status=response.status_code)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
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
        try:
            payload = request.data if isinstance(request.data, dict) else {}
        except ParseError:
            payload = {}
        if not payload:
            raw_body = request.body.decode("utf-8", errors="replace")
            try:
                payload = json.loads(raw_body) if raw_body else {}
            except json.JSONDecodeError:
                return Response(
                    {"error": "Invalid callback JSON payload"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        callback = payload.get("Body", {}).get("stkCallback", {})
        metadata_items = callback.get("CallbackMetadata", {}).get("Item", [])
        metadata = {}
        if isinstance(metadata_items, list):
            for item in metadata_items:
                if isinstance(item, dict) and item.get("Name"):
                    metadata[item["Name"]] = item.get("Value")

        logger.info(
            "M-Pesa callback result_code=%s checkout_request_id=%s merchant_request_id=%s metadata=%s",
            callback.get("ResultCode"),
            callback.get("CheckoutRequestID"),
            callback.get("MerchantRequestID"),
            metadata,
        )
        return Response({"ResultCode": 0, "ResultDesc": "Accepted"}, status=status.HTTP_200_OK)
    except Exception as exc:
        logger.exception("Failed to process M-Pesa callback")
        return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
