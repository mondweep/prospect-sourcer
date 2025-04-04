import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { Lead } from "./scraper.ts"; // Import the Lead interface

const sheets = google.sheets('v4');

/**
 * Appends lead data to the specified Google Sheet.
 * Assumes the sheet has columns: Name, Website, Phone, Address (in that order).
 * @param auth - The authorized OAuth2 client.
 * @param spreadsheetId - The ID of the Google Sheet.
 * @param leads - An array of Lead objects to append.
 */
export async function updateSheet(auth: OAuth2Client, spreadsheetId: string, leads: Lead[]): Promise<void> {
    console.log(`Attempting to append ${leads.length} leads to sheet ID: ${spreadsheetId}`);

    if (leads.length === 0) {
        console.log("No leads to append.");
        return;
    }

    // Format leads into a 2D array for the Sheets API
    // Ensure the order matches your sheet columns: Name, Website, Phone, Address, Email
    const values = leads.map(lead => [
        lead.name || '', // Default to empty string if undefined
        lead.website || '',
        lead.phone || '',
        lead.address || '',
        lead.email || '' // Add the email field
    ]);

    try {
        const request = {
            spreadsheetId: spreadsheetId,
            // Use a range like 'Sheet1!A1'. Append will find the first empty row after the data in this range.
            // Adjust 'Sheet1' if your sheet has a different name.
            range: 'Sheet1!A1',
            valueInputOption: 'USER_ENTERED', // Interpret values as if typed by user (e.g., for formulas, formatting)
            // Alternatively, use 'RAW' if you just want the raw strings.
            resource: {
                values: values,
            },
            auth: auth, // Pass the authorized client
        };

        const response = await sheets.spreadsheets.values.append(request);
        console.log(`Successfully appended ${response.data.updates?.updatedRows ?? 0} rows to the sheet.`);
        // console.log("Sheet update response:", response.data); // Optional: Log full response

    } catch (err: unknown) {
        // Handle unknown error type
        let errorMessage = "An unknown error occurred";
        let errorDetails: unknown = null;

        if (err instanceof Error) {
            errorMessage = err.message;
        }

        // Check if it looks like a Google API error structure
        // (This is a basic check; adjust based on actual error shapes)
        if (typeof err === 'object' && err !== null && 'response' in err) {
             const gaxiosError = err as { response?: { data?: { error?: unknown } } }; // Type assertion
             if (gaxiosError.response?.data?.error) {
                 errorDetails = gaxiosError.response.data.error;
             }
        }

        console.error(`Error updating Google Sheet (ID: ${spreadsheetId}):`, errorMessage);
        if (errorDetails) {
            console.error("Google API Error Details:", errorDetails);
        } else if (!(err instanceof Error)) {
             // Log the raw error if it wasn't an Error instance and no specific details found
             console.error("Raw error object:", err);
        }
        // Re-throw or handle as needed; here we just log it.
    }
}
