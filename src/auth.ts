// import { OAuth2Client, Credentials } from "google-auth-library"; // No longer using OAuth2Client directly for flow
import { GoogleAuth } from "google-auth-library";
// import { join } from "std/path/mod.ts";
// import { ensureFile } from "std/fs/ensure_file.ts";
// import { exists } from "std/fs/exists.ts";
// import { open } from "https://deno.land/x/open@v0.0.6/index.ts"; // No longer needed for interactive flow

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// const TOKEN_DIR = join(Deno.cwd(), ".credentials"); // No longer saving tokens locally
// const TOKEN_PATH = join(TOKEN_DIR, "google-sheets-token.json");

// Redirect URI is not needed for Service Account flow
// export const REDIRECT_URI = 'http://localhost:8000/oauth2callback';

// We will use GoogleAuth which handles different credential types including Service Accounts
let googleAuthInstance: GoogleAuth | null = null;
let authorizedClient: any | null = null; // Store the authorized client (type might vary)

/**
 * Initializes GoogleAuth using credentials from environment variables.
 * Prefers GOOGLE_CREDENTIALS_JSON (for service account key content).
 */
function getAuthInstance(): GoogleAuth {
    if (googleAuthInstance) {
        return googleAuthInstance;
    }

    const credentialsJson = Deno.env.get("GOOGLE_CREDENTIALS_JSON");
    let credentials;

    if (credentialsJson) {
        try {
            credentials = JSON.parse(credentialsJson);
            console.log("Using Google credentials from GOOGLE_CREDENTIALS_JSON environment variable.");
        } catch (e) {
            throw new Error("Auth Error: Failed to parse GOOGLE_CREDENTIALS_JSON. Ensure it's valid JSON.", { cause: e });
        }
    } else {
        // Fallback or alternative methods could be added here if needed,
        // but for Docker, GOOGLE_CREDENTIALS_JSON is the primary method.
        throw new Error("Auth Error: GOOGLE_CREDENTIALS_JSON environment variable not found. Please provide Service Account key JSON content.");
    }

    googleAuthInstance = new GoogleAuth({
        credentials,
        scopes: SCOPES,
    });

    return googleAuthInstance;
}

// --- Functions for interactive OAuth flow removed ---
// async function loadSavedCredentialsIfExist(): Promise<Credentials | null> { ... }
// async function saveCredentials(credentials: Credentials): Promise<void> { ... }
// function getClient(): OAuth2Client { ... }
// export function startAuthFlow(): string { ... }
// export async function exchangeCodeForToken(code: string): Promise<OAuth2Client | null> { ... }


/**
 * Gets an authorized client using Service Account credentials from environment variables.
 * Throws an error if authorization fails.
 */
export async function getAuthorizedClient(): Promise<any> { // Return type 'any' as it depends on GoogleAuth internals
    if (authorizedClient) {
        // TODO: Potentially check for token expiry if using long-lived clients,
        // but GoogleAuth often handles this internally for service accounts.
        console.log("Using existing authorized client instance.");
        return authorizedClient;
    }

    try {
        const auth = getAuthInstance();
        // getClient() attempts to get an authenticated client ready for API calls
        authorizedClient = await auth.getClient();
        console.log("Google client authorized successfully using provided credentials.");
        return authorizedClient;
    } catch (error) {
        console.error("Failed to get authorized Google client:", error);
        throw new Error("Authorization failed. Check GOOGLE_CREDENTIALS_JSON environment variable and Service Account permissions.", { cause: error });
    }
}
