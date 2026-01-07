import requests
import logging
from LaundryConfig.env import env

logger = logging.getLogger(__name__)

# =========================
# CONFIG (MATCHES .env)
# =========================

ROAMTECH_BASE_URL = "https://api.v2.emalify.com"

API_KEY = env("ROAMTECH_API_KEY")
PARTNER_ID = env("ROAMTECH_PARTNER_ID")
SHORTCODE = env("SHORTCODE")

SINGLE_SMS_URL = f"{ROAMTECH_BASE_URL}/api/services/sendsms/"
BULK_SMS_URL = f"{ROAMTECH_BASE_URL}/api/services/sendbulk/"

HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json"
}


def _validate_env():
    if not API_KEY or not PARTNER_ID:
        raise ValueError("Missing Roamtech SMS credentials")


def _format_mobile(mobile):
    """
    Converts list → comma-separated string
    """
    if isinstance(mobile, list):
        return ",".join(mobile)
    return mobile


def send_single_sms(mobile: str, message: str):
    try:
        _validate_env()

        mobile = mobile.replace("+", "").strip()
        if mobile.startswith("0"):
            mobile = "254" + mobile[1:]

        payload = {
            "apikey": API_KEY,
            "partnerID": PARTNER_ID,
            "mobile": mobile,
            "message": message,
            "shortcode": SHORTCODE,
            "pass_type": "plain"
        }

        logger.info(f"📤 Sending SINGLE SMS to {mobile}")

        response = requests.post(
            SINGLE_SMS_URL,
            json=payload,
            headers=HEADERS,
            timeout=30
        )

        if not response.ok:
            logger.error(f"❌ Single SMS error {response.status_code}: {response.text}")

        response.raise_for_status()
        return True, response.text

    except Exception as e:
        logger.exception("❌ Single SMS failed")
        return False, str(e)

import uuid
import uuid

def send_bulk_sms(mobiles: list[str], message: str):
    try:
        _validate_env()

        smslist = []

        for num in mobiles:
            num = num.replace("+", "").strip()
            if num.startswith("0"):
                num = "254" + num[1:]

            smslist.append({
                "partnerID": PARTNER_ID,
                "apikey": API_KEY,
                "pass_type": "plain",
                "clientsmsid": str(uuid.uuid4()),  # REQUIRED
                "mobile": num,
                "message": message,
                "shortcode": SHORTCODE
            })

        payload = {
            "count": len(smslist),  # REQUIRED
            "smslist": smslist
        }

        logger.info(
            f"📤 Sending BULK SMS | count={payload['count']} | to={mobiles}"
        )

        response = requests.post(
            BULK_SMS_URL,
            json=payload,
            headers=HEADERS,
            timeout=30
        )

        if not response.ok:
            logger.error(f"❌ Bulk SMS error {response.status_code}: {response.text}")

        response.raise_for_status()
        return True, response.text

    except Exception as e:
        logger.exception("❌ Bulk SMS failed")
        return False, str(e)

def send_sms(mobile, message):
    """
    Auto-detect single vs bulk
    """
    if isinstance(mobile, list):
        return send_bulk_sms(mobile, message)

    return send_single_sms(mobile, message)


# =====================================================
# 4️⃣ QUERY DELIVERY REPORT (DLR)
# =====================================================
def get_delivery_report(message_id: str):
    try:
        _validate_env()

        url = (
            f"{ROAMTECH_BASE_URL}/api/services/getdlr/"
            f"?apikey={API_KEY}"
            f"&partnerID={PARTNER_ID}"
            f"&messageID={message_id}"
        )

        logger.info(f"📦 Fetching DLR for messageID={message_id}")

        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()

        return True, response.text or "No response body"

    except Exception as e:
        logger.exception("❌ Failed to fetch delivery report")
        return False, str(e)


# =====================================================
# 5️⃣ QUERY ACCOUNT BALANCE
# =====================================================
def get_account_balance():
    try:
        _validate_env()

        url = (
            f"{ROAMTECH_BASE_URL}/api/services/getbalance/index.php"
            f"?apikey={API_KEY}"
            f"&partnerID={PARTNER_ID}"
        )

        logger.info("💰 Fetching SMS account balance")

        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()

        data = response.json()
        logger.info(f"💰 Account balance fetched: {data}")

        return True, data

    except Exception as e:
        logger.exception("❌ Failed to fetch account balance")
        return False, str(e)
