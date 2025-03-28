const fetch = require('node-fetch');

const STABLECOINS = {
  'usde': 'ethena-usde',
  'rai': 'rai',
  'frax': 'frax',
  'alusd': 'alchemix-usd',
  'lusd': 'liquity-usd'
};

const HEAVENS = {
  'ethena': 'ethena-usde',
  'pendle': 'pendle',
  'gmx': 'gmx',
  'lit': 'litentry',
  'meth': 'mantle-staked-ether'
};

async function fetchPrices() {
  const combined = { ...STABLECOINS, ...HEAVENS };
  const ids = Object.values(combined).join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=gbp`;
  const response = await fetch(url);
  return response.json();
}

function calculateValue(prices, mapping, allocations) {
  let total = 0;
  const values = {};
  for (const [key, coingeckoId] of Object.entries(mapping)) {
    const price = prices[coingeckoId]?.gbp || 0;
    const amount = allocations[key] || 0;
    values[key] = { price: Number(price.toFixed(6)), value: Number((price * amount).toFixed(2)) };
    total += price * amount;
  }
  return [Number(total.toFixed(2)), values];
}

module.exports = async (req, res) => {
  try {
    const prices = await fetchPrices();

    // Default state (same as your Python fallback)
    const state = {
      Stablecoin: {
        initial: 5000,
        allocations: { usde: 1293.03, rai: 210.97, frax: 1293.03, alusd: 1050.00, lusd: 1152.97 }
      },
      Heaven: {
        initial: 5000,
        allocations: { ethena: 3242.92, pendle: 143.29, gmx: 99.29, lit: 2200.44, meth: 3.23 }
      }
    };

    const [stableTotal, stableValues] = calculateValue(prices, STABLECOINS, state.Stablecoin.allocations);
    const [heavenTotal, heavenValues] = calculateValue(prices, HEAVENS, state.Heaven.allocations);

    const stableGain = Number(((stableTotal - state.Stablecoin.initial) / state.Stablecoin.initial * 100).toFixed(2));
    const heavenGain = Number(((heavenTotal - state.Heaven.initial) / state.Heaven.initial * 100).toFixed(2));

    const result = {
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      stablecoin: {
        total: `£${stableTotal.toFixed(2)}`,
        gain: `${stableGain}%`,
        tokens: stableValues
      },
      heaven: {
        total: `£${heavenTotal.toFixed(2)}`,
        gain: `${heavenGain}%`,
        tokens: heavenValues
      }
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
};
