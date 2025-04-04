import { OAuth2Client, Credentials } from "google-auth-library";
import { join } from "std/path/mod.ts";
import { ensureFile } from "std/fs/ensure_file.ts";
import { exists } from "std/fs/exists.ts";
import { open } from "https://deno.land/x/open@v0.0.6/index.ts"; // To open browser

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_DIR = join(Deno.cwd(), ".credentials");
const TOKEN_PATH = join(TOKEN_DIR, "google-sheets-token.json");

// Redirect URI must match one configured in Google Cloud Console for your client ID
// We'll handle this route in main.ts
export const REDIRECT_URI = 'http://localhost:8000/oauth2callback';

let oauth2ClientInstance: OAuth2Client | null = null;

function getClient(): OAuth2Client {
    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error("Auth Error: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not found in environment.");
    }
    return new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

async function loadSavedCredentialsIfExist(): Promise<Credentials | null> {
    try {
        if (await exists(TOKEN_PATH)) {
            const content = await Deno.readTextFile(TOKEN_PATH);
            const credentials = JSON.parse(content);
            console.log("Loaded saved Google credentials from:", TOKEN_PATH);
            return credentials;
        }
    } catch (err) {
        console.error("Error loading saved credentials:", err);
    }
    return null;
}

async function saveCredentials(credentials: Credentials): Promise<void> {
    try {
        await ensureFile(TOKEN_PATH);
        const payload = JSON.stringify(credentials);
        await Deno.writeTextFile(TOKEN_PATH, payload);
        console.log("Saved Google credentials to:", TOKEN_PATH);
    } catch (err) {
        console.error("Error saving credentials:", err);
    }
}

/**
 * Gets the authorized client. If not authorized, initiates the flow.
 * Returns null if authorization is needed (user needs to be redirected).
 */
export async function getAuthorizedClient(): Promise<OAuth2Client | null> {
    if (oauth2ClientInstance) {
        // TODO: Add check for token expiry and refresh if necessary
        // For simplicity, we assume the token is valid or refreshable
        console.log("Using existing authorized client instance.");
        return oauth2ClientInstance;
    }

    const savedCredentials = await loadSavedCredentialsIfExist();
    if (savedCredentials) {
        oauth2ClientInstance = getClient();
        oauth2ClientInstance.setCredentials(savedCredentials);
        console.log("Client authorized using saved credentials.");
        return oauth2ClientInstance;
    }

    // If no saved credentials, signal that authorization flow needs to start
    console.log("No valid credentials found. Authorization required.");
    return null;
}

/**
 * Generates the Google Auth URL and attempts to open it.
 * Call this when getAuthorizedClient() returns null.
 */
export function startAuthFlow(): string {
    const client = getClient();
    const authUrl = client.generateAuthUrl({
        access_type: 'offline', // Request refresh token
        scope: SCOPES,
        prompt: 'consent', // Force consent screen for refresh token on first auth
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    // Try to open the URL automatically
    open(authUrl).catch((err: unknown) => console.error("Failed to open browser automatically:", err));
    return authUrl; // Return URL in case automatic opening fails
}

/**
 * Exchanges the authorization code for tokens and saves them.
 */
export async function exchangeCodeForToken(code: string): Promise<OAuth2Client | null> {
     try {
        const client = getClient();
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);
        console.log("Successfully exchanged code for tokens.");
        await saveCredentials(tokens);
        oauth2ClientInstance = client; // Store the authorized client
        return client;
    } catch (err) {
        console.error('Error exchanging code for token:', err);
        return null;
    }
}
