# Google Maps Lead Scraper (Deno)

This project is a Deno-based web application designed to scrape Google Maps for business leads based on a specified business type and location. It aims to extract contact details, including email addresses, and save them to a Google Sheet.

## Features

*   **Web Interface:** Simple frontend to input Business Type, Location, and Google Sheet ID.
*   **Dynamic Neighborhood Generation:** Uses the Google Gemini API to generate a list of neighborhoods within the specified location for targeted searching.
*   **Google Maps Scraping:** Fetches Google Maps search results for each neighborhood query.
*   **Website URL Extraction:** Parses the Maps search results (using Regex on the data blob) to extract potential business website URLs.
*   **Domain Deduplication:** Ensures each business domain is processed only once.
*   **Individual Website Scraping:** Visits unique business websites to attempt scraping Name, Phone, Address, and **Email Address** (best-effort using placeholder logic).
*   **Google Sheets Integration:** Appends the collected lead data (Name, Website, Phone, Address, Email) to a specified Google Sheet using OAuth 2.0 authentication.

## Prerequisites

*   **Deno:** Ensure you have Deno installed (version 2.x recommended). [https://deno.com/](https://deno.com/)
*   **Google Cloud Project:** You need a Google Cloud project with the Google Sheets API enabled.
*   **Google OAuth 2.0 Credentials:** Create OAuth 2.0 Client ID and Secret for a "Web application" in your Google Cloud project.
    *   Ensure `http://localhost:8000` is added to "Authorized JavaScript origins".
    *   Ensure `http://localhost:8000/oauth2callback` is added to "Authorized redirect URIs".
*   **Google Gemini API Key:** Obtain an API key for the Gemini API from Google AI Studio or Google Cloud.
*   **(Optional) ScrapingBee API Key:** If you want to re-enable the ScrapingBee fallback for Maps scraping.

## Setup

1.  **Clone the repository (if applicable).**
2.  **Create `.env` file:** In the project root directory, create a file named `.env` and add your credentials:
    ```dotenv
    # .env file
    GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
    GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
    # Optional: Specify Gemini model (defaults to gemini-1.5-flash-latest if unset)
    # GEMINI_MODEL_NAME=gemini-pro
    # Optional: Add if using ScrapingBee fallback
    # SCRAPINGBEE_API_KEY=YOUR_SCRAPINGBEE_KEY_HERE
    ```
3.  **First Run / Google Authentication:** The first time you run the application and submit a scrape request, it will need to authenticate with Google Sheets.
    *   The application will print an authorization URL in the terminal and attempt to open it in your browser.
    *   Visit the URL, log in with the Google account that owns/has access to the target spreadsheet, and grant the requested permissions ("See, edit, create, and delete all your Google Sheets spreadsheets").
    *   You will be redirected back to `http://localhost:8000/oauth2callback`.
    *   A token file will be saved in `.credentials/google-sheets-token.json`. Subsequent runs will use this token.

## How to Run

1.  Navigate to the project directory in your terminal:
    ```bash
    cd /path/to/google-maps-scraper
    ```
2.  Start the development server (with file watching):
    ```bash
    deno task dev
    ```
    Alternatively, start without watching:
    ```bash
    deno task start
    ```
3.  Open your web browser and go to `http://localhost:8000`.
4.  Fill in the form and click "Start Scraping".
5.  Monitor the terminal for progress logs and the frontend for status updates.

## Running with Docker

This application can also be run inside a Docker container. This is recommended for deployment as it isolates the application and manages dependencies. Authentication uses a Google Service Account key passed via an environment variable.

**Prerequisites for Docker:**

*   **Docker:** Ensure Docker is installed and running. [https://www.docker.com/](https://www.docker.com/)
*   **Google Service Account:** Create a Service Account in your Google Cloud project.
    *   Enable the Google Sheets API for the project.
    *   Grant the Service Account appropriate permissions to edit the target Google Sheets (e.g., Editor role on the specific sheet or folder).
    *   Download the Service Account key file (JSON format). **Keep this file secure!**
*   **Google Gemini API Key:** Obtain an API key for the Gemini API.

**Steps:**

1.  **Build the Docker Image:**
    Navigate to the project root directory in your terminal and run:
    ```bash
    docker build -t google-maps-scraper .
    ```

2.  **Prepare Environment Variables:**
    *   **`GOOGLE_CREDENTIALS_JSON`:** You need to provide the *entire content* of your downloaded Service Account JSON key file as the value for this environment variable. One way is to read the file content into the variable when running the container (see example below).
    *   **`GEMINI_API_KEY`:** Your Gemini API key.

3.  **Run the Docker Container:**
    Replace `YOUR_GEMINI_API_KEY_HERE` with your actual key and `/path/to/your/service-account-key.json` with the actual path to your downloaded key file.
    ```bash
    docker run --rm -it \
      -p 8000:8000 \
      -e GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE" \
      -e GOOGLE_CREDENTIALS_JSON="$(cat /path/to/your/service-account-key.json)" \
      --name maps-scraper-app \
      google-maps-scraper
    ```
    *   `--rm`: Automatically remove the container when it exits.
    *   `-it`: Run in interactive mode with a pseudo-TTY (allows seeing logs).
    *   `-p 8000:8000`: Map port 8000 on your host to port 8000 in the container.
    *   `-e VAR="value"`: Set environment variables inside the container.
    *   `$(cat ...)`: This command substitution reads the content of your key file and passes it as the value for `GOOGLE_CREDENTIALS_JSON`. **Ensure the path is correct.**
    *   `--name maps-scraper-app`: Assign a name to the container for easier management.

4.  **Access the Application:** Open your web browser and go to `http://localhost:8000`.

## Current Limitations & Known Issues

*   **Maps Parsing:** Extracting website URLs from Google Maps results currently uses Regex on an internal data structure found in the HTML source. This is **brittle** and likely to break if Google changes its page structure or data format. The selectors used need constant verification.
*   **Website Scraping:** Extracting details (Name, Phone, Address, Email) from individual business websites uses **placeholder logic** (basic Regex, title tag). This is highly unreliable due to the vast differences in website layouts and requires significant improvement (e.g., using advanced parsing, AI, or specific selectors per site type) for accurate data. Many details, especially emails, may not be found.
*   **Neighborhood Generation:** Relies on the Gemini API to generate neighborhood lists. The quality and relevance of these lists depend on the model's knowledge of the specific location. The fallback currently just uses the main location name.
*   **Error Handling:** Basic error handling is in place, but more specific handling for different scraping failures could be added.
*   **Performance:** Scraping many websites sequentially can be slow. Concurrency could be added but increases complexity and the risk of rate limiting.
*   **Rate Limiting/Blocking:** Both Google Maps and individual websites may implement measures to block or limit automated scraping attempts. The included delays help mitigate this but are not foolproof. Using proxies or more sophisticated scraping services might be necessary for large-scale use.
