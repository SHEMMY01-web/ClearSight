const fs = require('fs');
const path = require('path');

async function syncMarketPulse() {
    try {
        // 1. Fetch Exchange Rate (Open Access - No Key)
        // Note: er-api returns rates against USD
        const fxResponse = await fetch('https://open.er-api.com/v6/latest/USD');
        const fxData = await fxResponse.json();
        const usdToNgn = fxData.rates.NGN;

        // 2. Fetch Inflation (World Bank - No Key)
        const infResponse = await fetch('http://api.worldbank.org/v2/country/NG/indicator/FP.CPI.TOTL.ZG?format=json');
        const infData = await infResponse.json();
        // Index [1][0] gets the most recent year's data
        let inflationRate = 0.1538; // Default fallback to user's marker
        if (infData && infData[1] && infData[1][0] && infData[1][0].value) {
            inflationRate = infData[1][0].value / 100;
        }

        // 3. Construct the Pulse Object
        const marketPulse = {
            last_updated: new Date().toISOString().split('T')[0],
            macro: {
                inflation_rate: inflationRate,
                treasury_bill_yield: 0.1595, // Manually updated via CBN
                fx_rate: usdToNgn
            },
            industry: {
                // RPM in NGN (USD Benchmark * Current FX Rate)
                spotify_rpm_ngn: 0.35 * usdToNgn, 
                apple_music_rpm_ngn: 0.45 * usdToNgn
            }
        };

        const pulsePath = path.join(__dirname, '../data/market_pulse.json');
        fs.writeFileSync(pulsePath, JSON.stringify(marketPulse, null, 2));

        console.log("🚀 ClearSight Market Pulse Updated:", marketPulse);
        return marketPulse;

    } catch (error) {
        console.error("Pulse Sync Failed:", error);
        return null;
    }
}

module.exports = { syncMarketPulse };

// If run directly
if (require.main === module) {
    syncMarketPulse();
}
