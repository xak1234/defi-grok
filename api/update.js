import json
import os
import base64
import requests
from datetime import datetime

# GitHub storage
GH_REPO = "xak1234/defi-vault-bot"
GH_FILE = "vault-data/state.json"
GH_TOKEN = os.getenv("GH_TOKEN")
HEADERS = {
    "Authorization": f"Bearer {GH_TOKEN}",
    "Accept": "application/vnd.github+json"
}

def read_state():
    url = f"https://api.github.com/repos/{GH_REPO}/contents/{GH_FILE}"
    r = requests.get(url, headers=HEADERS)
    if r.status_code == 200:
        content = base64.b64decode(r.json()['content']).decode()
        return json.loads(content)
    return None

def write_state(data):
    url = f"https://api.github.com/repos/{GH_REPO}/contents/{GH_FILE}"
    get = requests.get(url, headers=HEADERS)
    if get.status_code != 200:
        return False
    sha = get.json()['sha']
    content = base64.b64encode(json.dumps(data, indent=2).encode()).decode()

    payload = {
        "message": f"Update vault state at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}",
        "content": content,
        "sha": sha
    }
    r = requests.put(url, headers=HEADERS, data=json.dumps(payload))
    return r.status_code in (200, 201)

def get_prices(ids):
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={','.join(ids)}&vs_currencies=gbp"
    r = requests.get(url)
    if r.status_code != 200:
        raise Exception(f"Failed to fetch prices: {r.status_code}")
    return r.json()

def calculate_portfolio(portfolio, tokens, prices):
    total = 0
    initial_total = 0
    token_data = {}
    for key, token_id in tokens.items():
        price = prices[token_id]['gbp']
        amount = portfolio[key]['amount']
        initial_price = portfolio[key].get('initial_price', price)  # Use current price if no initial
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
    # Token lists
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
        # Load or initialize state
        state = read_state() or {
            "stable": {k: {"amount": 1000, "initial_price": None} for k in stable_tokens},
            "heaven": {k: {"amount": 1000, "initial_price": None} for k in heaven_tokens},
            "last_updated": None
        }

        # Fetch prices
        all_ids = list(set(stable_tokens.values()) | set(heaven_tokens.values()))
        prices = get_prices(all_ids)

        # Set initial prices on first run
        for portfolio in ("stable", "heaven"):
            tokens = stable_tokens if portfolio == "stable" else heaven_tokens
            for key, token_id in tokens.items():
                if state[portfolio][key]["initial_price"] is None:
                    state[portfolio][key]["initial_price"] = prices[token_id]['gbp']

        # Calculate portfolio values
        stable_total, stable_gain, stable_data = calculate_portfolio(state["stable"], stable_tokens, prices)
        heaven_total, heaven_gain, heaven_data = calculate_portfolio(state["heaven"], heaven_tokens, prices)

        # Update state
        state["last_updated"] = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        if not write_state(state):
            raise Exception("Failed to save state to GitHub")

        # Prepare response
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
                "Access-Control-Allow-Origin": "*"  # For CORS
            },
            "body": json.dumps(response)
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)})
        }

# For local testing (optional)
if __name__ == "__main__":
    print(handler({}, {}))
