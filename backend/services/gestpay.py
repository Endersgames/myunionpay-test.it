import os
import httpx
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger("gestpay")

SHOP_LOGIN = os.environ.get("GESTPAY_SHOP_LOGIN")
API_KEY = os.environ.get("GESTPAY_API_KEY")
IS_SANDBOX = os.environ.get("GESTPAY_SANDBOX", "true").lower() == "true"

BASE_URL = "https://sandbox.gestpay.net" if IS_SANDBOX else "https://ecomms2s.sella.it"

HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"apikey {API_KEY}",
}


async def create_payment(amount: float, shop_transaction_id: str, buyer_email: str = None, buyer_name: str = None) -> dict:
    """
    Step 1: Create payment session → returns paymentToken + paymentID
    """
    url = f"{BASE_URL}/api/v1/payment/create/"
    payload = {
        "shopLogin": SHOP_LOGIN,
        "amount": f"{amount:.2f}",
        "currency": "EUR",
        "shopTransactionID": shop_transaction_id,
    }

    if buyer_email:
        payload["buyerEmail"] = buyer_email
    if buyer_name:
        payload["buyerName"] = buyer_name

    logger.info(f"GestPay create_payment: {shop_transaction_id}, amount={amount}")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=HEADERS)
            data = resp.json()

        logger.info(f"GestPay create_payment response: {resp.status_code}")

        if data.get("error", {}).get("code") == "0":
            return {
                "success": True,
                "payment_token": data["payload"]["paymentToken"],
                "payment_id": data["payload"]["paymentID"],
            }
        else:
            error_desc = data.get("error", {}).get("description", "Errore sconosciuto")
            logger.error(f"GestPay create_payment error: {error_desc}")
            return {"success": False, "error": error_desc}

    except Exception as e:
        logger.error(f"GestPay create_payment exception: {e}")
        return {"success": False, "error": str(e)}


async def submit_payment(payment_token: str, card_number: str, exp_month: str, exp_year: str, cvv: str, buyer_email: str = None, buyer_name: str = None) -> dict:
    """
    Step 2: Submit card details → processes the payment
    """
    url = f"{BASE_URL}/api/v1/payment/submit/"

    payload = {
        "shopLogin": SHOP_LOGIN,
        "paymentTypeDetails": {
            "creditcard": {
                "number": card_number.replace(" ", "").replace("-", ""),
                "expMonth": exp_month.zfill(2),
                "expYear": exp_year[-2:] if len(exp_year) > 2 else exp_year,
                "CVV": cvv,
            }
        },
    }

    if buyer_email or buyer_name:
        payload["buyer"] = {}
        if buyer_email:
            payload["buyer"]["email"] = buyer_email
        if buyer_name:
            payload["buyer"]["name"] = buyer_name

    headers = {**HEADERS, "paymentToken": payment_token}

    logger.info(f"GestPay submit_payment with token: {payment_token[:20]}...")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            data = resp.json()

        logger.info(f"GestPay submit_payment response: {resp.status_code}")

        error_code = data.get("error", {}).get("code", "")
        if error_code == "0":
            p = data.get("payload", {})
            return {
                "success": True,
                "transaction_result": p.get("transactionResult"),
                "bank_transaction_id": p.get("bankTransactionID"),
                "authorization_code": p.get("authorizationCode"),
                "payment_id": p.get("paymentID"),
                "error_code": p.get("errorCode", "0"),
                "error_description": p.get("errorDescription", ""),
            }
        else:
            error_desc = data.get("error", {}).get("description", "Errore pagamento")
            logger.error(f"GestPay submit error: {error_desc}")
            return {"success": False, "error": error_desc, "error_code": error_code}

    except Exception as e:
        logger.error(f"GestPay submit exception: {e}")
        return {"success": False, "error": str(e)}


async def process_card_payment(amount: float, card_number: str, exp_month: str, exp_year: str, cvv: str, buyer_email: str = None, buyer_name: str = None) -> dict:
    """
    Full flow: create + submit in one call
    """
    tx_id = f"MUP-{uuid.uuid4().hex[:12].upper()}"

    # Step 1: Create
    create_result = await create_payment(amount, tx_id, buyer_email, buyer_name)
    if not create_result["success"]:
        return {
            "success": False,
            "error": create_result["error"],
            "shop_transaction_id": tx_id,
        }

    # Step 2: Submit
    submit_result = await submit_payment(
        create_result["payment_token"],
        card_number, exp_month, exp_year, cvv,
        buyer_email, buyer_name
    )

    return {
        **submit_result,
        "shop_transaction_id": tx_id,
        "payment_id": create_result.get("payment_id"),
    }
