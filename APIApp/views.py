import base64
import json
import logging
from datetime import datetime
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


logger = logging.getLogger(__name__)


_TRANSACTION_TYPE_MAP = {
    "paybill": "CustomerPayBillOnline",
    "till_number": "CustomerBuyGoodsOnline",
    "customerpaybillonline": "CustomerPayBillOnline",
    "customerbuygoodsonline": "CustomerBuyGoodsOnline",
}
_LAST_CALLBACK_CACHE_KEY = "mpesa_last_stk_callback"


def _get_mpesa_setting(key, default=""):
    return str(getattr(settings, key, default)).strip()


def _daraja_base_url():
    environment = _get_mpesa_setting("MPESA_ENVIRONMENT", "sandbox").lower()
    if environment == "production":
        return "https://api.safaricom.co.ke"
    if environment == "sandbox":
        return "https://sandbox.safaricom.co.ke"
    raise ValueError("MPESA_ENVIRONMENT must be either 'sandbox' or 'production'.")


def _normalize_phone_number(phone_number):
    digits = "".join(ch for ch in str(phone_number) if ch.isdigit())

    if digits.startswith("254") and len(digits) == 12:
        return digits
    if digits.startswith("0") and len(digits) == 10:
        return f"254{digits[1:]}"
    if len(digits) == 9 and digits.startswith(("1", "7")):
        return f"254{digits}"

    raise ValueError(
        "phone_number must be a valid Kenyan mobile number in format "
        "07XXXXXXXX, 01XXXXXXXX, 7XXXXXXXX, 1XXXXXXXX, or 254XXXXXXXXX."
    )


def _normalize_shortcode(value, label):
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    if not digits:
        raise ValueError(f"{label} must be numeric.")
    return digits


def _validate_callback_url(callback_url):
    parsed = urlparse(callback_url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("callback_url must be a valid HTTPS URL.")
    if host in {"localhost", "127.0.0.1", "0.0.0.0"}:
        raise ValueError("callback_url must be publicly reachable (not localhost).")
    return callback_url


def _sanitize_text(value, default, max_length):
    raw = str(value or "").strip()
    # Keep only simple characters that Daraja consistently accepts in textual fields.
    cleaned = "".join(ch for ch in raw if ch.isalnum() or ch == " ")
    cleaned = " ".join(cleaned.split())
    if not cleaned:
        cleaned = default
    return cleaned[:max_length]


def _resolve_transaction_type(raw_value):
    key = str(raw_value or "").strip().lower()
    if not key:
        return "CustomerPayBillOnline"

    transaction_type = _TRANSACTION_TYPE_MAP.get(key)
    if not transaction_type:
        raise ValueError(
            "Invalid transaction type. Use 'CustomerPayBillOnline', "
            "'CustomerBuyGoodsOnline', 'paybill', or 'till_number'."
        )
    return transaction_type


def _alternate_transaction_type(current_type):
    if current_type == "CustomerBuyGoodsOnline":
        return "CustomerPayBillOnline"
    return "CustomerBuyGoodsOnline"


def _daraja_access_token(base_url, consumer_key, consumer_secret):
    url = f"{base_url}/oauth/v1/generate?grant_type=client_credentials"
    response = requests.get(url, auth=(consumer_key, consumer_secret), timeout=20)
    response.raise_for_status()
    body = response.json()
    token = body.get("access_token")
    if not token:
        raise ValueError("Daraja OAuth response did not include access_token.")
    return token


def _extract_callback_fields(payload):
    callback = {}
    if isinstance(payload, dict):
        callback = payload.get("Body", {}).get("stkCallback", {}) or {}

    metadata = {}
    items = callback.get("CallbackMetadata", {}).get("Item", [])
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict) and item.get("Name"):
                metadata[item["Name"]] = item.get("Value")

    return {
        "merchant_request_id": callback.get("MerchantRequestID"),
        "checkout_request_id": callback.get("CheckoutRequestID"),
        "result_code": callback.get("ResultCode"),
        "result_desc": callback.get("ResultDesc"),
        "metadata": metadata,
    }


@csrf_exempt
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def index(request):
    payload = request.query_params if request.method == "GET" else request.data

    phone_number = payload.get("phone") or payload.get("phone_number")
    amount_value = payload.get("amount")

    if request.method == "GET" and not phone_number and amount_value in (None, ""):
        return Response(
            {
                "detail": "Provide phone and amount to trigger STK push.",
                "required_parameters": ["phone", "amount"],
                "example_get": "/api/daraja-emails/stk-push/?phone=0712345678&amount=1",
                "example_post": {"phone": "0712345678", "amount": 1},
                "callback_url_from_env": _get_mpesa_setting("MPESA_CALLBACK_URL"),
                "last_callback": cache.get(_LAST_CALLBACK_CACHE_KEY),
            },
            status=200,
        )

    if not phone_number:
        return Response({"detail": "phone is required."}, status=400)

    try:
        normalized_phone = _normalize_phone_number(phone_number)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=400)

    if amount_value in (None, ""):
        return Response({"detail": "amount is required."}, status=400)

    try:
        amount = int(amount_value)
    except (TypeError, ValueError):
        return Response({"detail": "amount must be an integer."}, status=400)

    if amount <= 0:
        return Response({"detail": "amount must be greater than 0."}, status=400)

    account_reference = _sanitize_text(payload.get("account_reference"), "LaundryPay", 12)
    transaction_desc = _sanitize_text(payload.get("transaction_desc"), "LaundryPay", 13)

    callback_url = str(payload.get("callback_url") or _get_mpesa_setting("MPESA_CALLBACK_URL")).strip()
    if not callback_url:
        return Response(
            {
                "detail": (
                    "MPESA_CALLBACK_URL is not configured. Set it in environment/settings "
                    "or pass callback_url in the request."
                )
            },
            status=500,
        )
    try:
        callback_url = _validate_callback_url(callback_url)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=400)

    try:
        base_url = _daraja_base_url()
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=500)

    environment = _get_mpesa_setting("MPESA_ENVIRONMENT", "sandbox").lower()
    business_short_code = _get_mpesa_setting(
        "MPESA_EXPRESS_SHORTCODE" if environment == "sandbox" else "MPESA_SHORTCODE"
    )
    passkey = _get_mpesa_setting("MPESA_PASSKEY")
    consumer_key = _get_mpesa_setting("MPESA_CONSUMER_KEY")
    consumer_secret = _get_mpesa_setting("MPESA_CONSUMER_SECRET")

    if not business_short_code:
        return Response({"detail": "MPESA_SHORTCODE/MPESA_EXPRESS_SHORTCODE is not configured."}, status=500)
    if not passkey:
        return Response({"detail": "MPESA_PASSKEY is not configured."}, status=500)
    if not consumer_key or not consumer_secret:
        return Response({"detail": "MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET is not configured."}, status=500)

    raw_transaction_type = payload.get("transaction_type", _get_mpesa_setting("MPESA_SHORTCODE_TYPE"))
    try:
        transaction_type = _resolve_transaction_type(raw_transaction_type)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=400)

    try:
        business_short_code = _normalize_shortcode(business_short_code, "BusinessShortCode")
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=400)

    # Daraja sandbox shortcode 174379 expects CustomerPayBillOnline.
    if environment == "sandbox" and business_short_code == "174379" and "transaction_type" not in payload:
        transaction_type = "CustomerPayBillOnline"

    party_b = payload.get("party_b", business_short_code)
    try:
        party_b = _normalize_shortcode(party_b, "PartyB")
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=400)

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password_bytes = f"{business_short_code}{passkey}{timestamp}".encode("ascii")
    password = base64.b64encode(password_bytes).decode("ascii")

    stk_payload = {
        "BusinessShortCode": business_short_code,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": transaction_type,
        "Amount": amount,
        "PartyA": normalized_phone,
        "PartyB": party_b,
        "PhoneNumber": normalized_phone,
        "CallBackURL": callback_url,
        "AccountReference": account_reference,
        "TransactionDesc": transaction_desc,
    }

    try:
        access_token = _daraja_access_token(base_url, consumer_key, consumer_secret)
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        response = requests.post(
            f"{base_url}/mpesa/stkpush/v1/processrequest",
            json=stk_payload,
            headers=headers,
            timeout=30,
        )
        try:
            retry_body = response.json()
        except ValueError:
            retry_body = {}

        if (
            response.status_code >= 400
            and isinstance(retry_body, dict)
            and retry_body.get("errorCode") == "400.002.02"
            and "Invalid TransactionType" in str(retry_body.get("errorMessage", ""))
        ):
            stk_payload["TransactionType"] = _alternate_transaction_type(stk_payload["TransactionType"])
            response = requests.post(
                f"{base_url}/mpesa/stkpush/v1/processrequest",
                json=stk_payload,
                headers=headers,
                timeout=30,
            )
            try:
                retry_body = response.json()
            except ValueError:
                retry_body = {}

        # Production sometimes rejects custom remarks; retry once with a minimal safe remark.
        if (
            response.status_code >= 400
            and isinstance(retry_body, dict)
            and retry_body.get("errorCode") == "400.002.02"
            and "Invalid Remarks" in str(retry_body.get("errorMessage", ""))
        ):
            stk_payload["TransactionDesc"] = "Payment"
            response = requests.post(
                f"{base_url}/mpesa/stkpush/v1/processrequest",
                json=stk_payload,
                headers=headers,
                timeout=30,
            )
    except requests.RequestException as exc:
        logger.exception("Daraja request failed: %s", exc)
        return Response({"detail": "Failed to connect to Daraja API.", "error": str(exc)}, status=502)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=502)

    try:
        response_body = response.json()
    except ValueError:
        response_body = {"raw_response": response.text}

    logger.info("Daraja STK response status=%s body=%s", response.status_code, response_body)
    return Response(response_body, status=response.status_code)


@csrf_exempt
def stk_push_callback(request):
    if request.method == "GET":
        return JsonResponse(
            {
                "detail": "STK callback endpoint is running.",
                "callback_url_from_env": _get_mpesa_setting("MPESA_CALLBACK_URL"),
                "last_callback": cache.get(_LAST_CALLBACK_CACHE_KEY),
            },
            status=200,
        )

    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed."}, status=405)

    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON body."}, status=400)

    parsed = _extract_callback_fields(payload)
    cache.set(
        _LAST_CALLBACK_CACHE_KEY,
        {
            "received_at": timezone.now().isoformat(),
            "parsed": parsed,
            "raw": payload,
        },
        timeout=86400,
    )
    logger.info("Daraja STK callback payload parsed=%s raw=%s", parsed, payload)
    return JsonResponse({"ResultCode": 0, "ResultDesc": "Accepted"}, status=200)
