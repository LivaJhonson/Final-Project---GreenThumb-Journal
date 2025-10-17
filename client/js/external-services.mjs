// js/external-services.mjs

// --- API Configuration ---
// NOTE: Only the Plant ID key is here because the Plant ID API is generally 
// less sensitive and is often used directly for initial identification before 
// hitting the server/database.
const PLANT_ID_API_KEY = "0ptmeSF8skJRbvHGhhxMYiKznRtOqWZHvHFXivdcj19uLJTP87";
const PLANT_ID_URL = 'https://api.plant.id/v2/identify';


// ----------------------------------------------------
// General Fetch Utilities
// ----------------------------------------------------

async function convertToJson(res) {
    if (res.ok) {
        return res.json();
    } else {
        // Attempt to get error details from the response body
        let errorBody = null;
        try {
             errorBody = await res.json();
        } catch (e) {
             errorBody = { message: "Could not parse error response." };
        }
        
        console.error(`API Error (${res.url}): ${res.statusText}`, errorBody);
        
        // Throw the error so the calling function can catch it
        throw new Error(`Bad Response from API: ${res.status} ${res.statusText} - ${errorBody.message || 'Check console for details.'}`);
    }
}

// ----------------------------------------------------
// Public Methods (Two APIs)
// ----------------------------------------------------

// 1. Plant.ID API (for identification and diagnosis) - Direct Call
export async function identifyPlant(imageBase64) {
    const payload = {
        api_key: PLANT_ID_API_KEY,
        images: [imageBase64],
        modifiers: ["similar_images"],
        plant_details: ["common_names", "taxonomy", "url"]
    };

    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };

    const response = await fetch(PLANT_ID_URL, options);
    return convertToJson(response);
}


// 2. Trefle API (for supplemental data on the plant profile) - Server Proxy
// This function calls YOUR server's protected route, which handles the Trefle key.
export async function getTreflePlantDetails(scientificName) {
    if (!scientificName) {
        throw new Error("Scientific name is required to fetch details.");
    }
    
    // Get the authentication token from local storage
    const token = localStorage.getItem('authToken'); 
    
    if (!token) {
        throw new Error("Authentication token not found. Please log in.");
    }

    // Call YOUR local server's Trefle proxy route
    const url = `/api/plant-details/${encodeURIComponent(scientificName)}`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}` // Pass auth token to YOUR server
        }
    });
    
    // The server handles the Trefle key and returns the processed data
    const data = await convertToJson(response);
    
    // Trefle data is often an array, we return the whole response for client logic
    return data; 
}