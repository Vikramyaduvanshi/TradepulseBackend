const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

async function getOptionChain(symbol) {
    const browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await page.goto('https://www.nseindia.com', { waitUntil: 'networkidle2' });

        // Thoda extra wait taaki cookies stabilize ho jayein
        await new Promise(r => setTimeout(r, 3000));

        // Backup URL strategy
        const urls = [
            `https://www.nseindia.com/api/option-chain-indices?symbol=${symbol}`,
            `https://www.nseindia.com/api/option-chain-allindices`
        ];

        let data = null;
        for (let url of urls) {
            try {
                const response = await page.goto(url, { waitUntil: 'networkidle2' });
                data = await response.json();

                // Agar NIFTY ka data is list me hai (allindices ke case me)
                if (url.includes('allindices')) {
                    data = data.data.find(d => d.indexSymbol === symbol);
                }

                if (data && (data.records || data.lastPrice)) break;
            } catch (e) {
                continue;
            }
        }

        if (data) {
            const spotPrice = data.records ? data.records.underlyingValue : data.lastPrice;
            const totalCE = data.filtered ? data.filtered.CE.totOI : (data.CE ? data.CE.totOI : 0);
            const totalPE = data.filtered ? data.filtered.PE.totOI : (data.PE ? data.PE.totOI : 0);

            if (totalCE === 0) {
                console.log("Market Data currently frozen (Post-market hours). Check back during LIVE market.");
                return { success: false, message: "Market data frozen (post-market hours)" };
            }

            const pcr = (totalPE / totalCE).toFixed(2);

            return {
                success: true,
                symbol,
                spotPrice,
                totalCE,
                totalPE,
                pcr,
            };
        } else {
            console.log("Error: NSE ne data dene se mana kar diya. Market closed ya API maintenance pe hai.");
            return { success: false, message: "NSE did not return data (market closed or API maintenance)" };
        }

    } catch (error) {
        console.error("Fatal Error:", error.message);
        return { success: false, message: error.message };
    } finally {
        await browser.close();
    }
}

module.exports = getOptionChain;