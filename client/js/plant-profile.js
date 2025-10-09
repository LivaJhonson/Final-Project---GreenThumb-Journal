// client/js/plant-profile.js

// --- DOM Elements ---
const plantProfileName = document.getElementById('plant-profile-name');
const plantDetailsSection = document.getElementById('plant-details-section');
const supplementalDataSection = document.getElementById('supplemental-data-section');
const supplementalLoadingMessage = document.getElementById('supplemental-loading-message');
const deletePlantTopBtn = document.getElementById('delete-plant-top-btn');

let currentPlantId = null; // Store the ID globally
let currentScientificName = null; // Store the scientific name for Trefle lookup


// --- 1. Get Plant ID from URL and Initialize ---
const getPlantIdFromUrl = () => {
    // Get the query string from the URL (e.g., "?id=123")
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if (!id) {
        plantDetailsSection.innerHTML = '<p class="error">Error: No plant ID provided in the URL.</p>';
        return null;
    }
    return id;
};

// --- 2. Fetch Main Plant Details (GET /api/plants/:id) ---
const fetchPlantDetails = async (plantId) => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        window.location.href = 'login.html';
        return;
    }

    currentPlantId = plantId;
    
    try {
        const response = await fetch(`/api/plants/${plantId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const plant = await response.json();

        if (response.ok) {
            currentScientificName = plant.scientific_name;
            renderMainDetails(plant);
            fetchSupplementalData(plant.scientific_name);
        } else {
            plantDetailsSection.innerHTML = `<p class="error">Error: ${plant.message || 'Could not find plant details.'}</p>`;
        }
    } catch (error) {
        console.error('Network error fetching plant:', error);
        plantDetailsSection.innerHTML = '<p class="error">A network error occurred while fetching plant data.</p>';
    }
};

// --- 3. Render Main Plant Details ---
const renderMainDetails = (plant) => {
    document.getElementById('plant-page-title').textContent = `${plant.name} Profile`;
    plantProfileName.textContent = plant.name;
    
    let html = `
        <div class="main-profile-content">
            <img src="${plant.image_url || 'img/placeholder.png'}" alt="${plant.name}" class="plant-profile-image">
            <div class="plant-info-group">
                <p><strong>Common Name:</strong> ${plant.common_name || 'N/A'}</p>
                <p><strong>Scientific Name:</strong> <em>${plant.scientific_name || 'N/A'}</em></p>
                <p><strong>Date Added:</strong> ${new Date(plant.date_added).toLocaleDateString()}</p>
                <h3>Notes</h3>
                <p class="plant-notes">${plant.notes || 'No custom notes available.'}</p>
            </div>
        </div>
    `;

    plantDetailsSection.innerHTML = html;
};


// --- 4. Fetch Supplemental Data (GET /api/plant-details/:scientific_name) ---
const fetchSupplementalData = async (scientificName) => {
    supplementalDataSection.classList.remove('hidden');
    
    if (!scientificName) {
        supplementalLoadingMessage.textContent = 'No scientific name available to fetch supplemental data.';
        return;
    }

    const authToken = localStorage.getItem('authToken');

    try {
        const response = await fetch(`/api/plant-details/${encodeURIComponent(scientificName)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (response.ok && data.data && data.data.length > 0) {
            renderSupplementalData(data.data[0]);
        } else {
            supplementalLoadingMessage.textContent = 'No supplemental data found from Trefle.';
        }
    } catch (error) {
        console.error('Error fetching supplemental data:', error);
        supplementalLoadingMessage.textContent = 'Error loading external supplemental data.';
    }
};

// --- 5. Render Supplemental Data ---
const renderSupplementalData = (trefleData) => {
    const details = trefleData.main_species;
    if (!details) {
        supplementalLoadingMessage.textContent = 'Supplemental data structure invalid or empty.';
        return;
    }

    let html = `
        <div class="supplemental-info-grid">
            <p><strong>Family:</strong> ${details.family_common_name || 'N/A'}</p>
            <p><strong>Duration:</strong> ${details.duration || 'N/A'}</p>
            <p><strong>Native Status:</strong> ${trefleData.native_status || 'N/A'}</p>
            <p><strong>Growth Habit:</strong> ${details.growth_habit || 'N/A'}</p>
            <p><strong>Toxicity:</strong> ${details.toxicity || 'N/A'}</p>
            <p><strong>Min Temp:</strong> ${details.minimum_temperature ? `${details.minimum_temperature.deg_f} °F` : 'N/A'}</p>
        </div>
        <p class="trefle-source">Data courtesy of Trefle.io</p>
    `;
    
    supplementalDataSection.innerHTML = `<h2>Supplemental Details (from Trefle)</h2>${html}`;
};

// --- 6. Implement Deletion Functionality (Same as Dashboard, but specific to this ID) ---
const deleteCurrentPlant = async () => {
    if (!currentPlantId) return;

    if (!confirm(`Are you sure you want to delete ${plantProfileName.textContent}?`)) {
        return;
    }
    
    const authToken = localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`/api/plants/${currentPlantId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            alert('Plant deleted successfully! Returning to dashboard.');
            // Redirect back to the dashboard after successful deletion
            window.location.href = 'dashboard.html'; 
        } else {
            const data = await response.json();
            alert('Failed to delete plant: ' + (data.message || 'Server error.'));
        }
    } catch (error) {
        console.error('Network error deleting plant:', error);
        alert('Network error. Could not delete the plant.');
    }
};

// --- 7. Initialization & Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    const plantId = getPlantIdFromUrl();
    if (plantId) {
        fetchPlantDetails(plantId);
    }
    
    // Add event listener to the top delete button
    deletePlantTopBtn.addEventListener('click', deleteCurrentPlant);
});