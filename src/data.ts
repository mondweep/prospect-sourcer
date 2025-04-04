// Sample list of New York City neighborhoods (Illustrative, not exhaustive)
// In a real application, this might come from a database or external source.
export const nycNeighborhoods: string[] = [
    "Sugar Hill",
    "Hamilton Heights",
    "Morningside Heights",
    "Upper East Side",
    "Yorkville",
    "Lenox Hill",
    "Turtle Bay",
    "Murray Hill",
    "Gramercy Park",
    "Stuyvesant Town",
    "East Village",
    "Lower East Side",
    "Soho",
    "Tribeca",
    "Financial District",
    "Battery Park City",
    "Chelsea",
    "Hell's Kitchen",
    "Midtown West",
    "Upper West Side",
    "Harlem",
    "Washington Heights",
    "Inwood",
    "Greenwich Village",
    "West Village",
    "Nolita",
    "Chinatown",
    "Little Italy",
    // Add more neighborhoods to reach ~100 if desired
    // Brooklyn examples
    "Williamsburg",
    "Greenpoint",
    "Bushwick",
    "Bedford-Stuyvesant",
    "Crown Heights",
    "Park Slope",
    "Cobble Hill",
    "Brooklyn Heights",
    "Dumbo",
    "Downtown Brooklyn",
    // Queens examples
    "Astoria",
    "Long Island City",
    "Sunnyside",
    "Woodside",
    "Jackson Heights",
    // Bronx examples
    "Riverdale",
    "Fordham",
    "South Bronx",
    // Staten Island examples
    "St. George",
    "New Dorp",
];

// List of domains to exclude when extracting business URLs from Google Maps
export const excludedUrlDomains: string[] = [
    "google.com",
    "google.co.uk", // Add variations if needed
    "gstatic.com",
    "ggpht.com",
    "schema.org",
    "example.com",
    "sentry-next.wixpress.com",
    "imli.com",
    "sentry.wixpress.com",
    "ingest.sentry.io",
    "maps.google.com",
    "support.google.com",
    // Add any other known non-business domains found during testing
];
