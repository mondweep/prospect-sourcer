import { randomDelay } from "./utils.ts";
import { excludedUrlDomains } from "./data.ts";
// Removed deno-dom imports

// Define the structure for scraped data
// Email comes from website scrape, others might too if Maps fails
export interface Lead {
    website: string; // Website URL is the key identifier now
    name?: string;
    phone?: string;
    address?: string;
    email?: string;
}

/**
 * Builds the Google Maps search URL based on a query string.
 */
function buildSearchUrl(query: string): string {
    const encodedQuery = encodeURIComponent(query);
    return `https://www.google.com/maps/search/${encodedQuery}`;
}

/**
 * Checks if a URL belongs to an excluded domain.
 */
function isExcludedDomain(url: string): boolean {
    try {
        // Handle potential protocol-relative URLs from regex
        const absoluteUrl = url.startsWith('//') ? `https://${url}` : url;
        const hostname = new URL(absoluteUrl).hostname.toLowerCase();
        return excludedUrlDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    } catch (e) {
        console.warn(`Invalid URL encountered during domain check: ${url}`);
        return true;
    }
}

/**
 * Attempts to scrape Google Maps search results page ONLY for business website URLs using Regex.
 * @param query - The search query (e.g., "sugar hill dentist").
 * @returns An array of potential business website URLs.
 */
export async function scrapeMapResults(query: string): Promise<string[]> {
    console.log(`Attempting Maps Search URL scrape with Fetch for query: "${query}"`);
    const url = buildSearchUrl(query);
    const foundUrls: string[] = [];

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            }
        });

        if (!response.ok) {
            throw new Error(`Fetch failed with status: ${response.status}`);
        }

        const html = await response.text(); // Get the raw HTML / JS data blob
        console.log(`Fetch successful for "${query}", received ${html.length} bytes. Parsing for URLs via Regex...`);

        // --- Regex URL Extraction & Filtering ---
        // Regex targeting the pattern observed: null,null,["FULL_URL","DOMAIN",...
        // It captures the full URL in group 1. Handles optional http(s): prefix.
        const urlRegex = /null,null,\[\\"((?:https?:)?\/\/[^"]+)\\",\\"([^"]+)\\"/g;
        let match;

        while ((match = urlRegex.exec(html)) !== null) {
            if (match[1]) { // Check if group 1 (the URL) was captured
                const potentialUrl = match[1];
                if (!isExcludedDomain(potentialUrl)) {
                    console.log(`Found potential URL via Regex: ${potentialUrl}`);
                    foundUrls.push(potentialUrl);
                }
            }
        }
        // --- End Regex Extraction ---

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown fetch error";
        console.error(`Error during Maps Search URL scrape (Fetch): ${message}`);
        if (!(error instanceof Error)) { console.error("Raw fetch error:", error); }
    }

    console.log(`Maps Search URL scrape (Fetch) found ${foundUrls.length} potential URLs for "${query}".`);
    return foundUrls; // Return only the list of URLs
}

/**
 * Scrapes an individual business website for Name, Phone, Address, Email. Best effort.
 * @param url - The URL of the business website.
 * @returns A partial Lead object with found details, or null if scraping fails.
 */
export async function scrapeBusinessWebsite(url: string): Promise<Partial<Omit<Lead, 'website'>> | null> { // Return type excludes website
    console.log(`Attempting to scrape business website: ${url}`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            signal: AbortSignal.timeout(15000) // 15 seconds timeout
        });

        if (!response.ok) {
            if (response.status >= 400 && response.status < 500) {
                 console.warn(`Failed to fetch website ${url} with client error status: ${response.status}`);
                 return null;
            }
            throw new Error(`Failed to fetch website ${url} with status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.includes('text/html')) {
            console.log(`Skipping non-HTML content type (${contentType}) for ${url}`);
            return null;
        }

        const html = await response.text();
        console.log(`Successfully fetched ${url}. Parsing content...`);

        const leadData: Partial<Omit<Lead, 'website'>> = {}; // Initialize empty object for details

        // --- Placeholder Parsing Logic ---
        // Email (mailto first)
        const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
        let match = mailtoRegex.exec(html);
        if (match && match[1]) {
            leadData.email = match[1];
            console.log(`Found email (mailto): ${leadData.email}`);
        } else {
            // Email (regex fallback)
            const betterEmailRegex = /(?<!\.(?:jpg|jpeg|png|gif|svg|webp)\s*=\s*")(?<!\w:)(?<!\/)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            let bestMatch: string | null = null;
            while ((match = betterEmailRegex.exec(html)) !== null) {
                const potentialEmail = match[0];
                if (['info', 'contact', 'sales', 'hello', 'support', 'enquiries', 'office'].some(prefix => potentialEmail.toLowerCase().startsWith(prefix + '@'))) {
                    bestMatch = potentialEmail;
                    break;
                }
                if (!bestMatch) { bestMatch = potentialEmail; }
            }
            if (bestMatch) {
                leadData.email = bestMatch;
                console.log(`Found email (regex): ${leadData.email}`);
            }
        }

        // Phone
        const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        const phoneMatch = html.match(phoneRegex);
        if (phoneMatch) {
            leadData.phone = phoneMatch[0];
            console.log(`Found phone: ${leadData.phone}`);
        }

        // Address (placeholder)
        if (html.includes("Street") || html.includes("Avenue") || html.includes("Road")) {
             leadData.address = "[Address Placeholder - Found Keywords]";
             console.log(`Found potential address keywords.`);
        }

        // Name (from title)
        const titleRegex = /<title>(.*?)<\/title>/i;
        const titleMatch = html.match(titleRegex);
        if (titleMatch && titleMatch[1]) {
            leadData.name = titleMatch[1].trim();
            console.log(`Found name (from title): ${leadData.name}`);
        }
        // --- End Placeholder Parsing ---

        // Return details object only if we found something
        return Object.keys(leadData).length > 0 ? leadData : null;

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown website scrape error";
        if (!(message.includes('network error') || message.includes('dns error') || message.includes('timed out') || message.includes('aborted'))) {
             console.error(`Error scraping website ${url}: ${message}`);
             if (!(error instanceof Error)) { console.error("Raw website scrape error:", error); }
        } else {
             console.warn(`Warning scraping website ${url}: ${message}`);
        }
        return null;
    }
}
