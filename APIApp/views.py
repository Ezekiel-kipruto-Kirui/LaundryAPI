from django_daraja.models import AccessToken
from django_daraja.mpesa.utils import (
    api_base_url,
    format_phone_number,
    mpesa_access_token,
)
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import get_connection, send_mail
from django.conf import settings
from django.urls import reverse
import smtplib
from urllib.parse import urlparse
from datetime import datetime
import base64
import requests
import logging


logger = logging.getLogger(__name__)


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def send_email_api(request):
    """
    Expected JSON:
    {
        "email": "user@gmail.com",
        "subject": "Your Cluster Code",
        "message": "Your code is 123456"
    }
    """

    if request.method == "GET":
        return Response(
            {
                "message": "Endpoint is active. Send a POST request to send email.",
                "required_fields": ["email", "subject", "message"],
                "supported_post_inputs": [
                    "JSON body",
                    "query parameters",
                ],
            },
            status=status.HTTP_200_OK,
        )

    try:
        def get_input_value(field_name):
            value = request.data.get(field_name)
            if value in (None, ""):
                value = request.query_params.get(field_name)
            return value.strip() if isinstance(value, str) else value

        email = get_input_value("email")
        subject = get_input_value("subject")
        message = get_input_value("message")

        if not email or not subject or not message:
            return Response(
                {"error": "Email, subject and message are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        smtp_username = str(getattr(settings, "EMAIL_HOST_USER", "")).strip()
        smtp_username = smtp_username.strip("\"'")
        from_email = str(getattr(settings, "DEFAULT_FROM_EMAIL", "")).strip() or smtp_username

        if not from_email:
            return Response(
                {"error": "Server email sender is not configured"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        raw_password = str(getattr(settings, "EMAIL_HOST_PASSWORD", "")).strip()
        raw_password = raw_password.strip("\"'")
        stripped_password = "".join(raw_password.split())

        password_candidates = []
        if stripped_password:
            password_candidates.append(stripped_password)
        if raw_password and raw_password != stripped_password:
            password_candidates.append(raw_password)

        if not smtp_username or not password_candidates:
            return Response(
                {"error": "Server SMTP credentials are not configured"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        auth_error = None

        for candidate_password in password_candidates:
            connection = get_connection(
                backend=getattr(
                    settings,
                    "EMAIL_BACKEND",
                    "django.core.mail.backends.smtp.EmailBackend",
                ),
                host=getattr(settings, "EMAIL_HOST", ""),
                port=getattr(settings, "EMAIL_PORT", 0),
                username=smtp_username,
                password=candidate_password,
                use_tls=getattr(settings, "EMAIL_USE_TLS", False),
                use_ssl=getattr(settings, "EMAIL_USE_SSL", False),
                timeout=15,
            )

            try:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=from_email,
                    recipient_list=[email],
                    fail_silently=False,
                    connection=connection,
                )
                auth_error = None
                break
            except smtplib.SMTPAuthenticationError as e:
                auth_error = e
                continue

        if auth_error is not None:
            raise auth_error

        return Response(
            {"message": "Email sent successfully"},
            status=status.HTTP_200_OK,
        )

    except smtplib.SMTPAuthenticationError as e:
        smtp_detail = (
            e.smtp_error.decode(errors="replace")
            if isinstance(e.smtp_error, (bytes, bytearray))
            else str(e.smtp_error)
        )
        return Response(
            {
                "error": (
                    "SMTP authentication failed. Check EMAIL_HOST_USER and "
                    "EMAIL_HOST_PASSWORD (Gmail app password)."
                ),
                "smtp_code": e.smtp_code,
                "smtp_detail": smtp_detail,
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except smtplib.SMTPException as e:
        return Response(
            {"error": f"SMTP error: {str(e)}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@csrf_exempt
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def stk_push(request):
    """
    Initiate STK Push using only:
    - phone_number
    - amount
    """

    if request.method == "GET":
        return Response(
            {
                "message": "Send a POST request to initiate STK Push to a user.",
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

        account_reference = "reference"
        transaction_desc = "LaundryPay"

        configured_callback = str(getattr(settings, "MPESA_CALLBACK_URL", "")).strip()
        configured_callback = configured_callback.strip("\"'")
        callback_url = configured_callback or request.build_absolute_uri(
            reverse("stk_push_callback")
        )

        if callback_url.startswith("http://"):
            callback_url = "https://" + callback_url[len("http://"):]

        parsed_callback = urlparse(callback_url)
        invalid_host = parsed_callback.hostname in {"localhost", "127.0.0.1"}
        if parsed_callback.scheme != "https" or invalid_host:
            return Response(
                {
                    "error": (
                        "Invalid callback URL. Set MPESA_CALLBACK_URL in environment "
                        "to a public HTTPS endpoint, e.g. "
                        "https://your-domain/api/daraja-emails/callback/."
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        phone_number = format_phone_number(str(phone_number))

        mpesa_environment = str(getattr(settings, "MPESA_ENVIRONMENT", "sandbox")).strip()
        if mpesa_environment == "sandbox":
            business_short_code = str(getattr(settings, "MPESA_EXPRESS_SHORTCODE", ""))
        else:
            business_short_code = str(getattr(settings, "MPESA_SHORTCODE", ""))

        passkey = str(getattr(settings, "MPESA_PASSKEY", ""))
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode(
            (business_short_code + passkey + timestamp).encode("ascii")
        ).decode("utf-8")

        shortcode_type = str(getattr(settings, "MPESA_SHORTCODE_TYPE", "paybill")).strip().lower()
        transaction_type = (
            "CustomerBuyGoodsOnline"
            if shortcode_type == "till_number"
            else "CustomerPayBillOnline"
        )

        headers = {
            "Authorization": f"Bearer {mpesa_access_token()}",
            "Content-Type": "application/json",
        }
        stk_payload = {
            "BusinessShortCode": business_short_code,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": transaction_type,
            "Amount": amount,
            "PartyA": phone_number,
            "PartyB": business_short_code,
            "PhoneNumber": phone_number,
            "CallBackURL": callback_url,
            "AccountReference": account_reference,
            "TransactionDesc": transaction_desc,
        }

        response = requests.post(
            api_base_url() + "mpesa/stkpush/v1/processrequest",
            json=stk_payload,
            headers=headers,
            timeout=30,
        )

        try:
            response_payload = response.json()
        except Exception:
            response_payload = {"raw_response": response.text}

        if (
            response.status_code >= 400
            and response_payload.get("errorCode") == "404.001.03"
        ):
            AccessToken.objects.all().delete()
            headers["Authorization"] = f"Bearer {mpesa_access_token()}"
            response = requests.post(
                api_base_url() + "mpesa/stkpush/v1/processrequest",
                json=stk_payload,
                headers=headers,
                timeout=30,
            )
            try:
                response_payload = response.json()
            except Exception:
                response_payload = {"raw_response": response.text}

        return Response(response_payload, status=response.status_code)
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def stk_push_callback(request):
    try:
        data = request.body.decode("utf-8", errors="replace")
        logger.info("M-Pesa callback payload: %s", data)
        return Response(
            {"message": "STK Push in Django", "data": data},
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
