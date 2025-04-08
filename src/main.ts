import { load } from "dotenv"; // Import dotenv load function
await load({ export: true }); // Load .env file into Deno.env and process.env

import { Application, Router, send } from "oak";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { randomDelay, getNeighborhoodsFromGemini } from "./utils.ts"; // Added getNeighborhoodsFromGemini
import { scrapeMapResults, scrapeBusinessWebsite, Lead } from "./scraper.ts"; // Corrected import
// Removed startAuthFlow, exchangeCodeForToken, REDIRECT_URI as Service Account flow is used
import { getAuthorizedClient } from "./auth.ts";
import { updateSheet } from "./sheets.ts";
// import { nycNeighborhoods } from "./data.ts"; // No longer needed if using Gemini

const app = new Application();
const router = new Router();

// Simple in-memory flag to prevent concurrent scrapes
let isScraping = false;

// --- API Routes ---
router.post("/api/scrape", async (ctx) => {
    if (isScraping) {
        ctx.response.status = 429; // Too Many Requests
        ctx.response.body = { message: "Scraping process already running. Please wait." };
        return;
    }

    isScraping = true;
    try {
        if (!ctx.request.hasBody) {
            ctx.response.status = 400;
             ctx.response.body = { message: "Request requires a JSON body" };
             return;
        }
        // Use the correct method to read JSON body in Oak
        const data = await ctx.request.body.json();
        console.log("Received scrape request:", data);

        // 1. Validate input
        // Read ScrapingBee key from environment instead of request
        const scrapingbeeKeyFromEnv = Deno.env.get("SCRAPINGBEE_API_KEY") || ""; // Keep for potential future use
        const { businessType, location, sheetId } = data;

        if (!businessType || typeof businessType !== 'string' || businessType.trim() === '') {
            ctx.response.status = 400;
            ctx.response.body = { message: "Missing or invalid 'businessType'" };
            return;
        }
        if (!location || typeof location !== 'string' || location.trim() === '') {
            ctx.response.status = 400;
            ctx.response.body = { message: "Missing or invalid 'location'" };
            return;
        }
        if (!sheetId || typeof sheetId !== 'string' || sheetId.trim() === '') {
            ctx.response.status = 400;
            ctx.response.body = { message: "Missing or invalid 'sheetId'" };
            return;
        }

        console.log("Input validated successfully.");

        // 2. Handle Google Auth (Service Account)
        // getAuthorizedClient now throws if auth fails (e.g., missing env var)
        console.log("Attempting Google Authentication using Service Account...");
        const authClient = await getAuthorizedClient();
        console.log("Google Authentication successful.");

        // --- Scraping Logic (New Flow with Gemini) ---

        // 3. Get Neighborhoods from Gemini
        const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
        if (!geminiApiKey) {
            ctx.response.status = 500;
            ctx.response.body = { message: "Gemini API Key not found in environment (.env file)." };
            console.error("GEMINI_API_KEY missing.");
            isScraping = false;
            return;
        }

        // Request only 10 neighborhoods for testing
        let targetNeighborhoods = await getNeighborhoodsFromGemini(location, geminiApiKey, undefined, 10);

        if (!targetNeighborhoods || targetNeighborhoods.length === 0) {
            console.error(`Failed to get neighborhoods for "${location}" from Gemini.`);
            const fallbackQuery = `${location.replace(/\s+/g, '+')}+${businessType.replace(/\s+/g, '+')}`;
            console.log(`Falling back to single search query: "${fallbackQuery}"`);
            targetNeighborhoods = [location];
        }

        // Generate Search Queries
        const searchQueries = targetNeighborhoods.map(hood =>
            `${hood.replace(/\s+/g, '+')}+${businessType.replace(/\s+/g, '+')}`
        );
        console.log(`Generated ${searchQueries.length} neighborhood search queries.`);


        // 4. Loop 1: Scrape Google Maps for Business URLs
        const uniqueDomainsMap = new Map<string, string>(); // Map domain -> full URL
        console.log("Starting Google Maps URL scraping loop...");
        let queryIndex = 0;
        for (const query of searchQueries) {
            queryIndex++;
            console.log(`--- [${queryIndex}/${searchQueries.length}] Scraping Maps for query: "${query}" ---`);

            // Attempt 1: Fetch (Gets URLs via Regex)
            const urlsFromQuery = await scrapeMapResults(query); // Returns string[]

            if (urlsFromQuery.length > 0) {
                 console.log(`Processing ${urlsFromQuery.length} potential URLs found via Fetch for query "${query}".`);
                 urlsFromQuery.forEach(fullUrl => {
                     if (fullUrl) {
                         try {
                             const urlObject = new URL(fullUrl);
                             const domain = urlObject.hostname.toLowerCase().replace(/^www\./, '');
                             if (!uniqueDomainsMap.has(domain)) {
                                 uniqueDomainsMap.set(domain, fullUrl);
                                 console.log(`Added unique domain: ${domain} (URL: ${fullUrl})`);
                             }
                         } catch (e) {
                             console.warn(`Skipping invalid website URL during domain extraction: ${fullUrl}`);
                         }
                     }
                 });
            } else {
                console.log(`Failed to find any URLs via Fetch for query "${query}".`);
                // NOTE: ScrapingBee fallback logic was here but is currently commented out/removed
            }

            console.log(`Finished query ${queryIndex}. Waiting before next...`);
            await randomDelay(3000, 8000);
        }
        const uniqueUrlsToScrape = Array.from(uniqueDomainsMap.values());
        console.log(`Finished Google Maps URL scraping. Found ${uniqueUrlsToScrape.length} unique websites to scrape.`);

        // 5. Loop 2: Scrape Individual Business Websites for Details
        const allLeads: Lead[] = [];
        console.log("Starting individual website scraping loop...");
        let siteIndex = 0;

        for (const url of uniqueUrlsToScrape) {
            siteIndex++;
            console.log(`--- [${siteIndex}/${uniqueUrlsToScrape.length}] Scraping website: ${url} ---`);

            const leadDetails = await scrapeBusinessWebsite(url); // Returns Partial<Omit<Lead, 'website'>> | null

            // Construct the final lead object
            const finalLead: Lead = {
                website: url, // Add the website URL back
                name: leadDetails?.name,
                phone: leadDetails?.phone,
                address: leadDetails?.address,
                email: leadDetails?.email
            };

            allLeads.push(finalLead);

            if (leadDetails) {
                 console.log(`Successfully extracted some details from ${url}`);
            } else {
                 console.log(`Could not extract details from ${url}.`);
            }

            console.log(`Finished website ${siteIndex}. Waiting before next...`);
            await randomDelay(2000, 5000);
        }
        console.log("Individual website scraping loop finished.");


        // 6. Aggregate & Update Google Sheet
        console.log(`Total leads collected with details: ${allLeads.length}`);
        let sheetUpdateStatus = "Skipped (no leads)";
        if (allLeads.length > 0) {
            console.log(`Attempting to update Google Sheet ID: ${sheetId}`);
            try {
                await updateSheet(authClient, sheetId, allLeads);
                sheetUpdateStatus = `Attempted update for ${allLeads.length} leads.`;
                console.log("Google Sheet update successful (or error handled in updateSheet).");
            } catch (sheetError) {
                 console.error("Unexpected error during sheet update call:", sheetError);
                 sheetUpdateStatus = "Update failed (see server logs).";
            }
        } else {
            console.log("No leads collected, skipping Google Sheet update.");
        }


        // Final response
        ctx.response.status = 200;
        ctx.response.body = {
            message: "Scraping process finished.",
            details: `Processed ${searchQueries.length} neighborhood queries. Found ${uniqueUrlsToScrape.length} unique websites to check. Extracted details for ${allLeads.length} leads. Sheet Status: ${sheetUpdateStatus}`,
            leadsFound: allLeads.length
        };
    } catch (error) {
        console.error("Error in /api/scrape:", error);
        ctx.response.status = 500;
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        ctx.response.body = { message: "Internal Server Error", error: errorMessage };
    } finally {
        isScraping = false;
    }
});

// --- OAuth Callback Route Removed (Not needed for Service Account) ---


// --- Middleware ---
app.use(async (ctx, next) => {
    await next();
    const rt = ctx.response.headers.get("X-Response-Time");
    console.log(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
});

app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.response.headers.set("X-Response-Time", `${ms}ms`);
});

app.use(oakCors({ origin: "*" }));
app.use(router.routes());
app.use(router.allowedMethods());

// --- Static File Serving ---
app.use(async (ctx) => {
    try {
        await send(ctx, ctx.request.url.pathname, {
            root: `${Deno.cwd()}/public`,
            index: "index.html",
        });
    } catch (error) {
        console.log(`Static file not found: ${ctx.request.url.pathname}`);
    }
});


// --- Start Server ---
const PORT = 8000;
console.log(`Server listening on http://localhost:${PORT}`);
await app.listen({ port: PORT });
