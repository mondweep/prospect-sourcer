# Technical Documentation

This document provides lower-level technical details about the Google Maps Lead Scraper application.

## Technology Stack

*   **Runtime:** Deno (v2.x recommended)
*   **Language:** TypeScript
*   **Web Framework:** Oak (for backend API and static file serving)
*   **HTML Parsing (Maps Results):** Regex targeting embedded data structures (previously used Deno DOM, but switched due to Maps rendering changes).
*   **HTML Parsing (Websites):** Basic Regex and string matching (placeholder).
*   **Google APIs:**
    *   Google AI SDK (`@google/generative-ai`): For Gemini neighborhood generation.
    *   Google API Client Library (`googleapis`): For interacting with Google Sheets API.
    *   Google Auth Library (`google-auth-library`): For handling OAuth 2.0 flow.
*   **Utilities:** Deno Standard Library (`std`) for `dotenv`, `fs`, `path`.

## Key Dependencies (`import_map.json`)

*   `std/`: Deno Standard Library modules (dotenv, fs, path).
*   `oak`: Web server framework for routing, request/response handling.
*   `google-auth-library`: Core library for Google OAuth 2.0 authentication.
*   `googleapis`: Client library for accessing Google APIs (specifically Sheets v4).
*   `dotenv`: For loading environment variables from the `.env` file.
*   `open`: Utility to automatically open URLs (like the auth URL) in the browser.
*   `@google/generative-ai`: SDK for interacting with the Google Gemini API.
*   *(Removed)* `deno-dom`: Was used for HTML parsing, now replaced by Regex for Maps results.
*   *(Removed)* `puppeteer`: Was used for browser automation, removed due to compatibility issues.
*   *(Commented Out)* `@google-cloud/local-auth`: Was used for simplified local OAuth, replaced by manual flow using `google-auth-library`.

## Environment Variables (`.env`)

The application requires a `.env` file in the project root with the following variables:

```dotenv
# Google OAuth 2.0 Credentials (Required)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE

# Google Gemini API Key (Required)
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

# Optional: Specify Gemini model (defaults to gemini-1.5-flash-latest if unset)
# GEMINI_MODEL_NAME=gemini-pro

# Optional: ScrapingBee API Key (Only needed if ScrapingBee fallback is re-enabled)
# SCRAPINGBEE_API_KEY=YOUR_SCRAPINGBEE_KEY_HERE
```

## Authentication Flow (Google OAuth 2.0)

1.  The application uses the `google-auth-library` for OAuth 2.0.
2.  Credentials (`CLIENT_ID`, `CLIENT_SECRET`) are read from the `.env` file.
3.  A predefined `REDIRECT_URI` (`http://localhost:8000/oauth2callback`) is used, which must be registered in the Google Cloud Console.
4.  **Token Check:** When a scrape is requested (`/api/scrape`), `getAuthorizedClient` in `src/auth.ts` first checks for a saved token file (`.credentials/google-sheets-token.json`).
5.  **Load Token:** If the token file exists, its contents are loaded and set on an `OAuth2Client` instance. This instance is reused.
6.  **Initiate Flow:** If no valid token is found, `getAuthorizedClient` returns `null`. `src/main.ts` then calls `startAuthFlow` which:
    *   Generates the Google authorization URL with the necessary scopes (`spreadsheets`) and `access_type=offline` (to get a refresh token).
    *   Attempts to open this URL in the user's browser using the `open` utility.
    *   The backend responds to the frontend with a 401 status, indicating authorization is needed.
7.  **User Authorization:** The user logs into Google and grants permission.
8.  **Callback:** Google redirects the user's browser to the `REDIRECT_URI` (`/oauth2callback`), including an authorization `code` in the query parameters.
9.  **Token Exchange:** The backend route handler for `/oauth2callback` in `src/main.ts` receives the request, extracts the `code`, and calls `exchangeCodeForToken` in `src/auth.ts`.
10. **Save Token:** `exchangeCodeForToken` uses the `code`, `CLIENT_ID`, and `CLIENT_SECRET` to request access and refresh tokens from Google. If successful, these tokens are saved to `.credentials/google-sheets-token.json`.
11. **Redirect:** The user is redirected back to the application's root (`/`).
12. **Subsequent Requests:** On the next scrape request, `getAuthorizedClient` will find and load the saved token, allowing the process to continue directly to scraping.

## Scraping Strategy

1.  **Neighborhood Generation:** `getNeighborhoodsFromGemini` (`src/utils.ts`) prompts the Gemini API based on the user's location input to get a list of ~10-100 areas. Includes basic JSON parsing and error handling. Falls back to using the original location string if Gemini fails.
2.  **Maps Search URL Extraction:** `scrapeMapResults` (`src/scraper.ts`) iterates through the neighborhood queries.
    *   It fetches the Google Maps search results page HTML using Deno `fetch`.
    *   It applies a **Regex** (`/null,null,\[\\"((?:https?:)?\/\/[^"]+)\\",\\"([^"]+)\\"/g`) to the raw HTML to find patterns likely containing embedded website URLs.
    *   It extracts the full URL found by the Regex.
    *   It filters the extracted URLs against `excludedUrlDomains`.
    *   It returns an array of valid website URL strings.
3.  **Domain Deduplication:** `src/main.ts` collects URLs from all neighborhood searches and uses a `Map` keyed by the normalized domain name (`www.` removed) to store only the *first* full URL encountered for each unique domain.
4.  **Website Scraping:** `scrapeBusinessWebsite` (`src/scraper.ts`) iterates through the unique, full website URLs.
    *   It fetches the HTML of the target website using Deno `fetch` with a timeout.
    *   It applies **placeholder logic** (Regex for `mailto:` and common email patterns, Regex for phone numbers, title tag for name, keyword check for address) to attempt extraction.
    *   It returns a `Partial<Omit<Lead, 'website'>>` object containing any found details, or `null` on failure.
5.  **Data Aggregation:** `src/main.ts` combines the website URL with the details scraped from the website into the final `Lead` object.
6.  **Sheet Update:** `updateSheet` (`src/sheets.ts`) formats the final `Lead[]` array and uses the Google Sheets API to append the data.

## Error Handling

*   **API Errors:** `try...catch` blocks are used around API calls (Gemini, Google Sheets, fetch). Errors are logged to the console. Specific Google API errors might include more details.
*   **Website Scrape Errors:** Common fetch errors (timeouts, DNS, network) are logged as warnings. Other errors during website scraping result in `null` being returned for that lead's details.
*   **Parsing Errors:** Errors during Gemini response parsing or Maps Regex matching are caught and logged. Failure to parse Maps results currently leads to 0 URLs being found for that query.
*   **Port Conflict:** No specific handling currently exists if port 8000 is already in use; the application will crash.
