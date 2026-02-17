from django_daraja.mpesa.core import MpesaClient
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import get_connection, send_mail
from django.conf import settings
import smtplib



@api_view(["GET", "POST"])
@permission_classes([AllowAny])  # Testing only
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
@api_view(['POST'])
@permission_classes([AllowAny])  # 👈 Allow any request
def stk_push(request):
    try:
        phone_number = request.data.get('phone_number')
        amount = request.data.get('amount')

        if not phone_number or not amount:
            return Response(
                {"error": "Phone number and amount are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        cl = MpesaClient()

        account_reference = 'reference'
        transaction_desc = 'Payment Description'
        callback_url = 'https://yourdomain.com/api/mpesa/callback/'

        response = cl.stk_push(
            phone_number,
            amount,
            account_reference,
            transaction_desc,
            callback_url
        )

        return Response(response, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])  # 👈 Allow Safaricom callback
def stk_push_callback(request):
    try:
        data = request.data
        print("M-Pesa Callback Data:", data)

        return Response(
            {"message": "Callback received successfully"},
            status=status.HTTP_200_OK
        )

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
