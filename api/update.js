import json
import os
import base64
import requests
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()

# GitHub storage
GH_REPO = "xak1234/def-grok"  # Updated repo name
GH_FILE = "vault-data/state.json"
GH_TOKEN = os.getenv("GH_TOKEN")  # Set this in Lambda environment variables
HEADERS = {
    "Authorization": f"Bearer {GH_TOKEN}",
    "Accept": "application/vnd.github+json"
}

def read_state():
    logger.info("Reading state from GitHub")
    url = f"https://api.github.com/repos/{GH_REPO}/contents/{GH_FILE}"
    r = requests.get(url, headers=HEADERS)
    if r.status_code == 200:
        content = base64.b64decode(r.json()['content']).decode()
        return json.loads(content)
    elif r.status_code == 404:
        logger.info("State file not found, initializing new state")
        return None
    else:
        logger.error(f"Failed to read state: {r.status_code} - {r.text}")
        raise Exception(f"GitHub API error: {r.status_code}")
    return None

def write_state(data):
    logger.info("Writing state to GitHub")
    url = f"https://api.github.com/repos/{GH_REPO}/contents/{GH_FILE}"
    get = requests.get(url, headers=HEADERS)
    if get.status_code == 404:  # File doesn’t exist yet
        payload = {
            "message": "Initialize vault state",
            "content": base64.b64encode(json.dumps(data, indent=2).encode()).decode()
        }
    elif get.status_code == 200:
        sha = get.json()['sha']
        payload = {
            "message": f"Update vault state at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}",
            "content": base64.b64encode(json.dumps(data, indent=2).encode()).decode(),
            "sha": sha
        }
    else:
        logger.error(f"Failed to get SHA: {get.status_code} - {get.text}")
        return False

    r = requests.put(url, headers=HEADERS, data=json.dumps(payload))
    if r.status_code not in (200, 201):
        logger.error(f"Failed to write state: {r.status_code} - {r.text}")
        return False
    return True

def get_prices(ids):
    logger.info("Fetching prices from CoinGecko")
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={','.join(ids)}&vs_currencies=gbp"
    r = requests.get(url)
    if r.status_code != 200:
        logger.error(f"CoinGecko API failed: {r.status_code} - {r.text}")
        raise Exception(f"CoinGecko API failed: {r.status_code}")
    return r.json()

def calculate_portfolio(portfolio, tokens, prices):
    total = 0
    initial_total = 0
    token_data = {}
    for key, token_id in tokens.items():
        price = prices[token_id]['gbp']
        amount = portfolio[key]['amount']
        initial_price = portfolio[key].get('initial_price', price)
        value = amount * price
        initial_value = amount * initial_price
        token_data[key] = {
            "amount": round(amount, 2),
            "price": round(price, 6),
            "value": round(value, 2),
            "initial_price": round(initial_price, 6)
        }
        total += value
        initial_total += initial_value
    gain = round(((total - initial_total) / initial_total) * 100, 2) if initial_total > 0 else 0
    return round(total, 2), gain, token_data

def handler(event, context):
    if not GH_TOKEN:
        logger.error("GH_TOKEN environment variable not set")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "GH_TOKEN environment variable not set"})
        }

    stable_tokens = {
        'usde': 'ethena-usde',
        'rai': 'rai',
        'frax': 'frax',
        'alusd': 'alchemix-usd',
        'lusd': 'liquity-usd'
    }
    heaven_tokens = {
        'ethena': 'ethena-usde',
        'pendle': 'pendle',
        'gmx': 'gmx',
        'lit': 'litentry',
        'meth': 'mantle-staked-ether'
    }

    try:
        state = read_state() or {
            "stable": {k: {"amount": 1000, "initial_price": None} for k in stable_tokens},
            "heaven": {k: {"amount": 1000, "initial_price": None} for k in heaven_tokens},
            "last_updated": None
        }

        all_ids = list(set(stable_tokens.values()) | set(heaven_tokens.values()))
        prices = get_prices(all_ids)

        for portfolio in ("stable", "heaven"):
            tokens = stable_tokens if portfolio == "stable" else heaven_tokens
            for key, token_id in tokens.items():
                if state[portfolio][key]["initial_price"] is None:
                    state[portfolio][key]["initial_price"] = prices[token_id]['gbp']

        stable_total, stable_gain, stable_data = calculate_portfolio(state["stable"], stable_tokens, prices)
        heaven_total, heaven_gain, heaven_data = calculate_portfolio(state["heaven"], heaven_tokens, prices)

        state["last_updated"] = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        if not write_state(state):
            raise Exception("Failed to save state to GitHub")

        response = {
            "timestamp": state["last_updated"],
            "Stablecoin": {
                "total": f"£{stable_total}",
                "gain": f"{stable_gain}%",
                "tokens": stable_data
            },
            "Heaven": {
                "total": f"£{heaven_total}",
                "gain": f"{heaven_gain}%",
                "tokens": heaven_data
            }
        }

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps(response)
        }

    except Exception as e:
        logger.error(f"Error in handler: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)})
        }
