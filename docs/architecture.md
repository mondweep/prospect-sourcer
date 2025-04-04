# Architecture Overview

This document outlines the high-level architecture of the Google Maps Lead Scraper application.

## System Diagram

```mermaid
graph LR
    A[User via Browser] --> B(Frontend UI);
    B -- Scrape Request (JSON) --> C{Backend API (Deno/Oak)};
    C -- Location --> D{Gemini API};
    D -- Neighborhood List --> C;
    C -- Maps Search Query --> E{Google Maps Scraper};
    E -- Website URLs --> C;
    C -- Website URL --> F{Website Scraper};
    F -- Lead Details (Name, Phone, Addr, Email) --> C;
    C -- Auth Check/Flow --> G{Google OAuth 2.0};
    G -- Auth Client --> C;
    C -- Lead Data + Auth --> H{Google Sheets API};
    H -- Append Status --> C;
    C -- Status/Result --> B;
```

## Major Components

1.  **Frontend UI (`/public`)**
    *   Built with plain HTML, CSS, and JavaScript.
    *   Provides a form for user input: Business Type, Location, Google Sheet ID.
    *   Sends the scrape request to the backend API.
    *   Displays status messages received from the backend.

2.  **Backend API (`src/main.ts`)**
    *   Built with Deno and the Oak web framework.
    *   Serves the static frontend files.
    *   Provides the main `/api/scrape` endpoint to handle scraping requests.
    *   Orchestrates the overall workflow.
    *   Manages Google OAuth 2.0 authentication.
    *   Calls the Gemini API for neighborhood generation.
    *   Calls the scraping modules.
    *   Calls the Google Sheets API to write results.

3.  **Gemini Integration (`src/utils.ts`)**
    *   Contains the `getNeighborhoodsFromGemini` function.
    *   Takes the user-provided location and API key.
    *   Prompts the Gemini API to generate a list of relevant neighborhoods.
    *   Parses the Gemini response to extract the neighborhood list.
    *   Includes fallback logic if the Gemini call fails.

4.  **Google Maps Scraper (`src/scraper.ts`)**
    *   Contains the `scrapeMapResults` function.
    *   Takes a search query (neighborhood + business type).
    *   Fetches the Google Maps search results page using Deno's `fetch`.
    *   Parses the raw HTML response using **Regex** to extract potential business website URLs from embedded data structures.
    *   Filters out irrelevant domains (Google domains, etc.).
    *   *(Note: ScrapingBee fallback is currently commented out).*

5.  **Website Scraper (`src/scraper.ts`)**
    *   Contains the `scrapeBusinessWebsite` function.
    *   Takes a single business website URL.
    *   Fetches the website's HTML using Deno's `fetch`.
    *   Applies **placeholder parsing logic** (Regex, string matching) in a best-effort attempt to find Name, Phone, Address, and Email.
    *   Handles errors gracefully (timeouts, non-HTML content, fetch failures).

6.  **Google Sheets Integration (`src/sheets.ts`, `src/auth.ts`)**
    *   `src/auth.ts`: Handles the Google OAuth 2.0 flow (authorization URL generation, token exchange, token storage/retrieval). Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from `.env`.
    *   `src/sheets.ts`: Contains the `updateSheet` function. Uses the authorized client from `auth.ts` and the Google Sheets API client library (`googleapis`) to append the collected lead data to the user-specified spreadsheet.

## Data Flow Summary

1.  User submits form data (Business Type, Location, Sheet ID) to the Backend API.
2.  Backend validates input and checks/initiates Google OAuth 2.0 authentication.
3.  Backend calls Gemini API with Location to get a list of neighborhoods.
4.  Backend generates search queries (Neighborhood + Business Type).
5.  For each query, Backend calls Maps Scraper (`scrapeMapResults`) to get potential website URLs.
6.  Backend deduplicates the collected URLs based on domain.
7.  For each unique URL, Backend calls Website Scraper (`scrapeBusinessWebsite`) to get Name, Phone, Address, Email.
8.  Backend combines data and calls Sheets Integration (`updateSheet`) to append leads to the Google Sheet.
9.  Backend sends a final status message back to the Frontend UI.
