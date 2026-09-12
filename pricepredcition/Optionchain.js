const puppeteer = require('puppeteer');

async function getOptionChain(symbol) {
    // console.log(`🚀 Starting Stealth Browser...`);
    
    const browser = await puppeteer.launch({ 
        headless: "new", 
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // console.log(`🌐 Step 1: Visiting NSE Home for fresh cookies...`);
        await page.goto('https://www.nseindia.com', { waitUntil: 'networkidle2' });

        // Thoda extra wait taaki cookies stabilize ho jayein
        await new Promise(r => setTimeout(r, 3000));

        // console.log(`📡 Step 2: Fetching Data for ${symbol}...`);
        
        // Backup URL strategy
        const urls = [
            `https://www.nseindia.com/api/option-chain-indices?symbol=${symbol}`,
            `https://www.nseindia.com/api/option-chain-allindices`
        ];

        let data = null;
        for (let url of urls) {
            try {
                // console.log(`🔗 Trying URL: ${url}`);
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
            // Data extracting logic handles both formats
            const spotPrice = data.records ? data.records.underlyingValue : data.lastPrice;
            const totalCE = data.filtered ? data.filtered.CE.totOI : (data.CE ? data.CE.totOI : 0);
            const totalPE = data.filtered ? data.filtered.PE.totOI : (data.PE ? data.PE.totOI : 0);
            
            if (totalCE === 0) {
                console.log("⚠️ Market Data currently frozen (Post-market hours). Check back during LIVE market.");
                return;
            }

            const pcr = (totalPE / totalCE).toFixed(2);

            // console.log(`\n✅ --- REAL-TIME DATA --- ✅`);
            // console.log(`📊 Symbol    : ${symbol}`);
            // console.log(`💰 Spot Price : ${spotPrice}`);
            // console.log(`📈 Total CE OI: ${totalCE}`);
            // console.log(`📈 Total PE OI: ${totalPE}`);
            // console.log(`🔥 PCR Ratio  : ${pcr}`);
            // console.log(`--------------------------\n`);

        } else {
            console.log("❌ Error: NSE ne data dene se mana kar diya. Market closed ya API maintenance pe hai.");
        }

    } catch (error) {
        console.error("❌ Fatal Error:", error.message);
    } finally {
        await browser.close();
        console.log(`🧹 Browser closed.`);
    }
}

getOptionChain('NIFTY');