from http.server import BaseHTTPRequestHandler
import json, requests, base64, os
from datetime import datetime

TOKEN = os.getenv("GH_TOKEN")
REPO = "xak1234/defi-vault-bot"
STATE_FILE = "vault-data/state.json"
HEADERS = {"Authorization": f"token {TOKEN}"}

def fetch_prices(ids):
    ids_joined = ",".join(ids)
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={ids_joined}&vs_currencies=gbp"
    return requests.get(url).json()

def load_state():
    r = requests.get(f"https://api.github.com/repos/{REPO}/contents/{STATE_FILE}", headers=HEADERS)
    if r.status_code == 200:
        content = base64.b64decode(r.json()["content"]).decode()
        sha = r.json()["sha"]
        return json.loads(content), sha
    return {"Stablecoin": {}, "Heaven": {}}, None

def save_state(state, sha):
    body = {
        "message": "Update state",
        "content": base64.b64encode(json.dumps(state).encode()).decode(),
        "sha": sha
    }
    requests.put(f"https://api.github.com/repos/{REPO}/contents/{STATE_FILE}", headers=HEADERS, data=json.dumps(body))

def calculate_portfolio(tokens, prices, holdings, initial_value):
    total = 0
    token_data = {}
    for name in tokens:
        price = prices[name]['gbp']
        amount = holdings.get(name, initial_value / len(tokens) / price)
        token_data[name] = {"price": round(price, 6), "amount": amount}
        total += amount * price
    gain = round(((total - initial_value) / initial_value) * 100, 2)
    return round(total, 2), gain, token_data

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        stable_tokens = ['usde', 'rai', 'frax', 'alusd', 'lusd']
        heaven_tokens = ['ethena-usde', 'pendle', 'gmx', 'litentry', 'mantle-staked-ether']
        prices = fetch_prices(stable_tokens + heaven_tokens)
        state, sha = load_state()

        if not state.get("Stablecoin"):  # Init holdings
            state["Stablecoin"] = {k: 5000/len(stable_tokens)/prices[k]['gbp'] for k in stable_tokens}
        if not state.get("Heaven"):
            state["Heaven"] = {k: 5000/len(heaven_tokens)/prices[k]['gbp'] for k in heaven_tokens}

        stable_total, stable_gain, stable_data = calculate_portfolio(
            stable_tokens, prices, state["Stablecoin"], 5000)
        heaven_total, heaven_gain, heaven_data = calculate_portfolio(
            heaven_tokens, prices, state["Heaven"], 5000)

        response = {
            "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "Stablecoin": {
                "total": f"£{stable_total}",
                "gain": stable_gain,
                "tokens": stable_data
            },
            "Heaven": {
                "total": f"£{heaven_total}",
                "gain": heaven_gain,
                "tokens": heaven_data
            }
        }

        save_state(state, sha)
        self.send_response(200)
        self.send_header('Content-type','application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())
