const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function readArticle(googleUrl) {
    let browser;
    try {
        // Step 1: Launch Browser
        browser = await puppeteer.launch({ 
            headless: "new", // Browser background mein chalega
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        
        const page = await browser.newPage();
        
        // Real user ki tarah behave karne ke liye User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // console.log("Navigating to Google News Link...");
        
        // Step 2: Google News link par jana (Ye automatically redirect follow karega)
        // Wait until 'networkidle2' matlab jab page load hona band ho jaye
        await page.goto(googleUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Step 3: Get the Final URL after all redirects
        const finalUrl = page.url();
        // console.log("Final Destination URL:", finalUrl);

        // Step 4: Page ka HTML nikalna
        const html = await page.content();
        const $ = cheerio.load(html);

        // Kachra saaf karo
        $('script, style, nav, footer, header, noscript, ads, .sidebar, .related').remove();

        let title = $("meta[property='og:title']").attr("content") || $("h1").first().text() || $("title").text();
        
        let contentArray = [];
        // Business sites ke paragraphs aksar article ya main div mein hote hain
        $("p").each((i, el) => {
            let text = $(el).text().trim();
            if (text.length > 50) {
                contentArray.push(text);
            }
        });

        let articleContent = contentArray.join("\n\n");

        await browser.close();

        return {
            success: true,
            source: finalUrl,
            title: title.trim(),
            content: articleContent.slice(0, 5000),
        };

    } catch (error) {
        if (browser) await browser.close();
        return {
            success: false,
            error: `Puppeteer Error: ${error.message}`,
        };
    }
}

// Test Run
async function main() {
    let url = "https://news.google.com/rss/articles/CBMi4wFBVV95cUxNSjJQcTdQUTRwWGgxYnhscWZuZFI0VV9zN19hRHlBM18zR3dmbVFWaEhqMWdsdEdGemxEYUhzcDdqa0hPMUE5TGVFQWQ4RzJ1amJqa2plNlE1eTh0TlBqYjhGQVQwMmMtSGlGRktoMGVOcjA2RTY4T2lOeXhCSjdlREZreUFvYkk2c05uMFl5VGdaS0FxdUU0MVl6TTNNdUhmNnJGamFMUWl2Vy02Uk42Mm9nMjNTWGI2X0RPWUtReFc5MUdIa1ZDYk0wcTU0QkozMDdOOXYtZXFJQmhSSVdINm1sSdIB6AFBVV95cUxQQ1d6a2tJcEJ6SC1neGhWUTg3YlI5Um95Z1l6VTVhaVhKQmVCYWJqdExzd0FxeTlMMXpJSXA2ZkNoSXR4Y1VzQUhSVURZdWhzUmlmMDNTY0RuMDlGb21SOTNyMHcwUjZzV3ItaHVaRWdzdUxSTy02VDBUNVlqSi0yY083Y09KR0FUcHdubmFUQmpFeERHNWxrS25oR0NFcU5ZVnJPSm5xdDNFcVM3MnRhNnJCVXY4WHphQ2UzSEVxZUlQT0cweEVkQmhmcmtpQkE3ZkNFa2s3aVZPUHRsTUNLVlptTkdFZHZs?oc=5&hl=en-IN&gl=IN&ceid=IN:en";
    
    console.log("Starting extraction...");
    let result = await readArticle(url);
    console.log(result);
}

// main();