# Tasks & Future Work

This document lists potential improvements, known issues, and future tasks for the Google Maps Lead Scraper project.

## High Priority / Core Functionality

*   **Improve Maps URL Extraction:**
    *   The current Regex (`/null,null,\[\\"((?:https?:)?\/\/[^"]+)\\",\\"([^"]+)\\"/g`) used in `scrapeMapResults` is based on limited observation and is likely brittle.
    *   **Task:** Thoroughly analyze the structure of the data blob within the fetched Google Maps HTML (`temp_map_result.html`) to find a more reliable pattern or marker for identifying business website URLs. Refine the Regex accordingly. Consider edge cases.
*   **Improve Website Scraping (`scrapeBusinessWebsite`):**
    *   The current logic uses very basic Regex and keyword checks (placeholders).
    *   **Task:** Implement more robust parsing for Name, Phone, Address, and Email. This likely requires:
        *   Integrating an HTML parsing library like `deno-dom`.
        *   Identifying common HTML structures/patterns for contact information (e.g., elements with classes like "contact", "footer", specific microdata/schema.org markup).
        *   Looking for dedicated "Contact Us" pages and scraping those if the initial page lacks info.
        *   Improving Regex patterns for phone numbers and emails.
        *   Handling different international phone/address formats.
*   **Refine Address Parsing (Maps):**
    *   The current logic in `scrapeMapResults` for extracting address parts is very basic and might miss parts or join them incorrectly.
    *   **Task:** Analyze the structure within `div.W4Efsd` more closely to reliably extract and format the address components found on the Maps results page.

## Medium Priority / Enhancements

*   **Dynamic Neighborhoods/Locations:**
    *   Currently, the Gemini prompt asks for neighborhoods within the input location, but there's no guarantee of relevance or completeness. The fallback is just the main location name.
    *   **Task:** Research and potentially integrate a dedicated Geocoding or Geographical Data API (e.g., OpenStreetMap Nominatim, Geoapify, Pelias) to:
        *   Get a reliable bounding box for the input location (replace placeholder `getBoundingBox`).
        *   Potentially retrieve administrative boundaries or sub-regions more reliably than Gemini's freeform text generation.
*   **User Feedback during Scraping:**
    *   Long scraping processes provide limited feedback to the frontend.
    *   **Task:** Implement real-time updates using WebSockets or Server-Sent Events (SSE) to show progress (e.g., "Scraping neighborhood X/Y", "Found Z leads", "Scraping website A/B").
*   **Error Handling & Reporting:**
    *   Error handling is basic `try...catch` logging.
    *   **Task:** Implement more granular error handling. Distinguish between recoverable errors (e.g., single website timeout) and fatal errors (e.g., auth failure). Provide clearer error messages to the frontend. Consider adding retry logic for certain fetch errors.
    *   Add specific error handling for the "Address already in use" error on startup, guiding the user.
*   **Concurrency:**
    *   Scraping happens sequentially (one neighborhood query, then one website at a time).
    *   **Task:** Explore adding concurrency (e.g., using `Promise.all` or worker threads) to speed up the scraping of individual websites. **Caution:** This significantly increases the risk of rate limiting or IP blocking. Implement carefully with adjustable concurrency limits and longer delays.

## Low Priority / Nice-to-Haves

*   **Configuration Options:** Allow users to configure delays, timeouts, number of neighborhoods via the UI or a config file instead of hardcoding them.
*   **Proxy Support:** Add options to use HTTP/SOCKS proxies to mitigate IP blocking for larger scrapes.
*   **Testing:** Implement unit and integration tests for key functions (parsing, API calls, data handling).
*   **UI Improvements:** Enhance the frontend with better loading indicators, progress bars, and result display.
*   **ScrapingBee Integration (Refined):** If direct fetch proves too unreliable for Maps results, properly refactor `scrapeMapSearchForUrlsWithScrapingBee` to return `Partial<Lead>[]` and uncomment the fallback logic in `main.ts`.
