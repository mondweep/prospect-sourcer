/**
 * Generates a grid of coordinates (latitude, longitude) within a given bounding box.
 * @param northLat - Northern boundary latitude.
 * @param southLat - Southern boundary latitude.
 * @param eastLng - Eastern boundary longitude.
 * @param westLng - Western boundary longitude.
 * @param gridSize - The number of divisions along each axis (e.g., 10 means 10x10 = 100 grids).
 * @returns An array of {lat, lng} objects representing the center of each grid cell.
 */
export function generateGridCoordinates(
    northLat: number,
    southLat: number,
    eastLng: number,
    westLng: number,
    gridSize: number = 10 // Aim for roughly 100 grids (10x10)
): { lat: number; lng: number }[] {
    const coordinates: { lat: number; lng: number }[] = [];
    const latStep = (northLat - southLat) / gridSize;
    const lngStep = (eastLng - westLng) / gridSize;

    // Calculate center points of each grid cell
    for (let i = 0; i < gridSize; i++) {
        const cellSouthLat = southLat + i * latStep;
        const cellNorthLat = cellSouthLat + latStep;
        const centerLat = (cellSouthLat + cellNorthLat) / 2;

        for (let j = 0; j < gridSize; j++) {
            const cellWestLng = westLng + j * lngStep;
            const cellEastLng = cellWestLng + lngStep;
            const centerLng = (cellWestLng + cellEastLng) / 2;

            coordinates.push({ lat: centerLat, lng: centerLng });
        }
    }

    return coordinates;
}

/**
 * Placeholder function to get bounding box for a location.
 * In a real application, this would use a Geocoding API.
 * @param locationName - The name of the location (e.g., "Manhattan, New York").
 * @returns A dummy bounding box.
 */
export async function getBoundingBox(locationName: string): Promise<{ north: number; south: number; east: number; west: number }> {
    console.log(`[Placeholder] Geocoding location: ${locationName}`);
    // Replace with actual geocoding API call (e.g., OpenStreetMap Nominatim, Google Geocoding API)
    // Returning a dummy bounding box for Manhattan for now
    await Promise.resolve(); // Simulate async operation
    return {
        north: 40.88,
        south: 40.70,
        east: -73.93,
        west: -74.02,
    };
}

/**
 * Introduces a delay for a random duration between minMs and maxMs.
 * @param minMs - Minimum delay in milliseconds.
 * @param maxMs - Maximum delay in milliseconds.
 */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
    const delayTime = Math.random() * (maxMs - minMs) + minMs;
    console.log(`Waiting for ${delayTime.toFixed(0)} ms...`);
    return new Promise(resolve => setTimeout(resolve, delayTime));
}


// --- Gemini Integration ---
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

/**
 * Uses the Gemini API to generate a list of neighborhoods for a given location.
 * @param location - The location string (e.g., "Kent, England").
 * @param apiKey - The Gemini API Key.
 * @param modelName - The Gemini model name (optional, defaults if not provided).
 * @param count - The approximate number of neighborhoods to request.
 * @returns An array of neighborhood names, or null if an error occurs.
 */
export async function getNeighborhoodsFromGemini(
    location: string,
    apiKey: string,
    modelName?: string,
    count: number = 100
): Promise<string[] | null> {
    console.log(`Attempting to get ~${count} neighborhoods for "${location}" using Gemini...`);
    if (!apiKey) {
        console.error("Gemini API Key not found in environment.");
        return null;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelName || Deno.env.get("GEMINI_MODEL_NAME") || "gemini-1.5-flash-latest", // Use provided, env, or default
        // Optional: Add safety settings if needed
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ],
        generationConfig: {
            // Ensure JSON output if possible (though parsing is still needed)
            // responseMimeType: "application/json", // Might not be supported by all models/versions
            temperature: 0.3, // Lower temperature for more predictable list output
        },
    });

    const prompt = `List approximately ${count} distinct neighborhoods, districts, or well-known areas within the location "${location}". Return the list ONLY as a valid JSON array of strings, like ["Area1", "Area2", "Area3"]. Do not include any other text, explanation, or markdown formatting before or after the JSON array.`;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const responseText = response.text();
        console.log("Received response from Gemini. Attempting to parse...");
        // console.log("Raw Gemini Response Text:", responseText); // Uncomment for debugging

        // Attempt to extract JSON array from the response text
        // This regex tries to find a JSON array structure within the potentially messy response
        const jsonMatch = responseText.match(/\[\s*("([^"]|\\")*"(?:,\s*"([^"]|\\")*")*\s*)?\]/);

        if (jsonMatch && jsonMatch[0]) {
            try {
                const neighborhoods = JSON.parse(jsonMatch[0]);
                if (Array.isArray(neighborhoods) && neighborhoods.every(item => typeof item === 'string')) {
                    console.log(`Successfully parsed ${neighborhoods.length} neighborhoods from Gemini response.`);
                    return neighborhoods;
                } else {
                    console.error("Parsed JSON from Gemini is not a string array:", neighborhoods);
                }
            } catch (parseError) {
                console.error("Failed to parse JSON from Gemini response:", parseError);
                console.error("Gemini response text was:", responseText); // Log the problematic text
            }
        } else {
            console.error("Could not find a valid JSON array in Gemini response.");
            console.error("Gemini response text was:", responseText);
        }

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown Gemini API error";
        console.error(`Error calling Gemini API: ${message}`);
        if (!(error instanceof Error)) { console.error("Raw Gemini API error:", error); }
    }

    return null; // Return null if any error occurred
}
