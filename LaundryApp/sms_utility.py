import logging
from twilio.rest import Client
from LaundryConfig.env import env

logger = logging.getLogger(__name__)

def send_sms(to_number: str, message: str):
    """
    Send SMS via Twilio using Messaging Service SID
    """
    try:
        account_sid = env("TWILIO_ACCOUNT_SID")
        auth_token = env("TWILIO_AUTH_TOKEN")
        messaging_service_sid = env("TWILIO_MESSAGING_SERVICE_SID")

        if not all([account_sid, auth_token, messaging_service_sid]):
            raise ValueError("Missing Twilio environment variables")

        client = Client(account_sid, auth_token)

        logger.info(f"📤 Sending SMS to {to_number}")

        sms = client.messages.create(
            body=message,
            messaging_service_sid=messaging_service_sid,
            to=to_number
        )

        logger.info(f"✅ SMS sent successfully: SID={sms.sid}")
        return True, sms.sid

    except Exception as e:
        logger.error("❌ Twilio SMS send failed", exc_info=True)
        return False, str(e)
