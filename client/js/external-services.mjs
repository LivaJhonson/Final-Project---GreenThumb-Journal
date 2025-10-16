// js/external-services.mjs

// --- API Configuration (Using keys provided in your .env) ---
const TREFLE_API_KEY = "usr-TnSpnNZlQT1fiW_iU8ZiIAapv8ahpNyviHq3mNhtJUY";
const TREFLE_BASE_URL = 'https://trefle.io/api/v1';

const PLANT_ID_API_KEY = "0ptmeSF8skJRbvHGhhxMYiKznRtOqWZHvHFXivdcj19uLJTP87";
const PLANT_ID_URL = 'https://api.plant.id/v2/identify';


// ----------------------------------------------------
// General Fetch Utilities
// ----------------------------------------------------

async function convertToJson(res) {
    if (res.ok) {
        return res.json();
    } else {
        const errorBody = await res.json();
        console.error(`API Error (${res.url}): ${res.statusText}`, errorBody);
        throw new Error(`Bad Response from API: ${res.status} ${res.statusText}`);
    }
}

// ----------------------------------------------------
// Public Methods (Two APIs)
// ----------------------------------------------------

// 1. Plant.ID API (for identification and diagnosis)
export async function identifyPlant(imageBase64) {
    const payload = {
        api_key: PLANT_ID_API_KEY,
        images: [imageBase64],
        // You would typically include: 'organs': ['leaf', 'flower', etc.]
    };

    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };

    // Note: Fetching directly to the Plant.ID URL
    const response = await fetch(PLANT_ID_URL, options);
    return convertToJson(response);
}


// 2. Trefle API (for supplemental data on the plant profile)
// This is called by plant-profile.js using the Trefle ID saved with the plant.
export async function getTreflePlantDetails(trefleId) {
    if (!trefleId) {
        throw new Error("Trefle ID is required to fetch details.");
    }
    
    // Trefle API requires the token in the query string
    const path = `/plants/${trefleId}`;
    const url = `${TREFLE_BASE_URL}${path}?token=${TREFLE_API_KEY}`;
    
    const response = await fetch(url);
    const data = await convertToJson(response);
    
    // The details are nested under data.data
    return data.data; 
}