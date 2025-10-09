// client/js/dashboard.js

// --- 1. DOM Elements ---
const logoutBtn = document.getElementById('logout-btn');
const myPlantsContainer = document.getElementById('my-plants-container');

// --- 2. Authentication Check & Initialization ---

// Function to check if the user is authenticated (token exists)
const checkAuth = () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        // If no token, redirect to login page
        window.location.href = 'login.html';
    } else {
        // If authenticated, load the user's plants
        loadUserPlants();
    }
};

// --- 3. Logout Functionality ---
logoutBtn.addEventListener('click', () => {
    // Clear the JWT from local storage
    localStorage.removeItem('authToken');
    // Redirect back to the login page
    window.location.href = 'login.html';
});


// --- 4. Develop 'My Plants' Dashboard Card View (Read All) ---
const loadUserPlants = async () => {
    const authToken = localStorage.getItem('authToken');
    
    myPlantsContainer.innerHTML = '<h2>My Plant Collection</h2><p>Loading your plants...</p>';

    try {
        const response = await fetch('/api/plants', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`, // IMPORTANT: Send the JWT
                'Content-Type': 'application/json'
            }
        });

        const plants = await response.json();

        if (response.ok) {
            renderPlantCards(plants);
        } else {
            myPlantsContainer.innerHTML = '<h2>My Plant Collection</h2><p>Error loading plants: ' + (plants.message || 'Authentication failed.') + '</p>';
            if (response.status === 401 || response.status === 403) {
                // If authentication fails, force logout
                logoutBtn.click();
            }
        }
    } catch (error) {
        console.error('Network error fetching plants:', error);
        myPlantsContainer.innerHTML = '<h2>My Plant Collection</h2><p>Network error. Could not connect to the server.</p>';
    }
};

// Function to dynamically create and display the plant cards
const renderPlantCards = (plants) => {
    myPlantsContainer.innerHTML = '<h2>My Plant Collection</h2>'; 
    
    if (plants.length === 0) {
        myPlantsContainer.innerHTML += '<p>You haven\'t added any plants yet. Use the "Identify New Plant" button to get started!</p>';
        return;
    }

    // Build the HTML for all cards
    const cardsHtml = plants.map(plant => `
        <div class="plant-card" data-plant-id="${plant.id}">
            <img src="${plant.image_url || 'img/placeholder.png'}" alt="${plant.name}" class="plant-image">
            <div class="card-content">
                <h3 class="card-title">${plant.name}</h3>
                <p class="card-scientific-name"><em>${plant.scientific_name || 'No scientific name'}</em></p>
                <div class="card-actions">
                    <button class="btn btn-sm btn-info view-details-btn" data-id="${plant.id}">Details</button>
                    <button class="btn btn-sm btn-danger delete-plant-btn" data-id="${plant.id}">Delete</button>
                </div>
            </div>
        </div>
    `).join('');

    myPlantsContainer.innerHTML += `<div class="plant-cards-grid">${cardsHtml}</div>`;

    // Add event listeners to the dynamically created buttons
    addCardEventListeners();
};


// --- 5. Implement Plant Deletion Functionality (Delete) ---
const deletePlant = async (plantId) => {
    if (!confirm('Are you sure you want to delete this plant? This action cannot be undone.')) {
        return;
    }

    const authToken = localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`/api/plants/${plantId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}` // Required for security
            }
        });

        if (response.ok) {
            // Successfully deleted, refresh the list
            alert('Plant deleted successfully!');
            loadUserPlants(); 
        } else {
            const data = await response.json();
            alert('Failed to delete plant: ' + (data.message || 'Server error.'));
        }
    } catch (error) {
        console.error('Network error deleting plant:', error);
        alert('Network error. Could not delete the plant.');
    }
};


// --- 6. Build Detailed Plant Profile View (Conceptual Link) ---
const viewPlantDetails = (plantId) => {
    // Redirects to the detail page, passing the plant ID in the URL query parameter
    window.location.href = `plant-profile.html?id=${plantId}`;
};


// --- 7. Add Event Listeners to all dynamic buttons ---
const addCardEventListeners = () => {
    // Listener for Delete buttons
    document.querySelectorAll('.delete-plant-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const plantId = e.target.dataset.id;
            deletePlant(plantId);
        });
    });

    // Listener for Detail buttons
    document.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const plantId = e.target.dataset.id;
            viewPlantDetails(plantId);
        });
    });
};


// --- 8. Initial Call ---
// Call checkAuth when the dashboard page loads
document.addEventListener('DOMContentLoaded', checkAuth);

// Make this function globally accessible so identify-plant.js can call it to refresh the list
window.loadUserPlants = loadUserPlants;