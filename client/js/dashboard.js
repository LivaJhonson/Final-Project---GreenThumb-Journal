// client/js/dashboard.js

// --- Global State ---
const authToken = localStorage.getItem('authToken');
let plantCollection = []; // To store the user's plants

// --- DOM Element References ---
const plantGrid = document.getElementById('plant-grid');
const reminderList = document.getElementById('reminder-list');
const identifyPlantModal = document.getElementById('identify-plant-modal');
const identifyPlantForm = document.getElementById('identify-plant-form');
const savePlantModal = document.getElementById('save-plant-modal');
const savePlantForm = document.getElementById('save-plant-form');
const noRemindersMessage = document.getElementById('no-reminders-message');

// --- Initialization and Authentication Check ---

/**
 * Checks for a valid token and initializes the dashboard.
 */
const init = () => {
    if (!authToken) {
        window.location.href = 'login.html';
        return;
    }

    // Add main event listeners
    document.getElementById('logout-button').addEventListener('click', handleLogout);
    document.getElementById('identify-plant-button').addEventListener('click', openIdentifyPlantModal);
    
    // Setup modal event listeners
    document.querySelector('.close-identify-modal').addEventListener('click', closeIdentifyPlantModal);
    document.querySelector('.close-save-modal').addEventListener('click', closeSavePlantModal);
    
    // Form submission handlers
    identifyPlantForm.addEventListener('submit', handleIdentifyPlant);
    savePlantForm.addEventListener('submit', handleSavePlant);

    // Attach listener for opening the Save modal from Identification results
    document.getElementById('open-save-plant-modal').addEventListener('click', openSavePlantModal);

    // Initial data load
    fetchPlants();
    fetchDueReminders();
};


// --- Core Data Fetching Functions ---

/**
 * Fetches the user's plant collection from the server.
 */
const fetchPlants = async () => {
    try {
        const response = await fetch('/api/plants', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            throw new Error("Failed to load plant collection.");
        }

        plantCollection = await response.json();
        renderPlantCollection(plantCollection);

    } catch (error) {
        console.error('Error fetching plants:', error);
        plantGrid.innerHTML = `<div class="error-message">${error.message}</div>`;
    }
};

/**
 * Fetches reminders that are due today or overdue.
 */
const fetchDueReminders = async () => {
    try {
        const response = await fetch('/api/reminders/due', { 
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            throw new Error("Failed to load due reminders.");
        }

        const reminders = await response.json();
        renderDueReminders(reminders);
    } catch (error) {
        console.error('Error fetching reminders:', error);
        noRemindersMessage.textContent = 'Failed to load reminders.';
        noRemindersMessage.classList.remove('hidden');
    }
};


// --- Rendering Functions ---

/**
 * Renders the plant collection grid.
 */
const renderPlantCollection = (plants) => {
    plantGrid.innerHTML = '';
    
    if (plants.length === 0) {
        plantGrid.innerHTML = '<p class="text-center">Your collection is empty! Click "Add New Plant / Identify" to get started.</p>';
        return;
    }

    plants.forEach(plant => {
        const plantCard = document.createElement('a');
        plantCard.href = `plant-profile.html?id=${plant.id}`;
        plantCard.className = 'plant-card';
        plantCard.innerHTML = `
            <img src="${plant.image_url || 'placeholder.jpg'}" alt="${plant.name}">
            <h3>${plant.name}</h3>
            <p>${plant.common_name || plant.scientific_name || 'Unidentified'}</p>
        `;
        plantGrid.appendChild(plantCard);
    });
};

/**
 * Renders the list of due reminders.
 */
const renderDueReminders = (reminders) => {
    reminderList.innerHTML = '';
    
    if (reminders.length === 0) {
        noRemindersMessage.classList.remove('hidden');
        noRemindersMessage.innerHTML = '✅ Everything is up to date!'; // Matches the desired dashboard look
        return;
    }

    noRemindersMessage.classList.add('hidden');

    reminders.forEach(r => {
        const item = document.createElement('div');
        item.className = 'reminder-due-item';
        item.innerHTML = `
            <p><strong>${r.plant_name}</strong>: ${r.type}</p>
            <p class="due-date">Due: ${new Date(r.next_due).toLocaleDateString()}</p>
            <button class="btn btn-sm btn-complete" data-reminder-id="${r.reminder_id}">Mark Done</button>
        `;
        reminderList.appendChild(item);
    });

    // Add event listeners to complete buttons
    reminderList.querySelectorAll('.btn-complete').forEach(button => {
        button.addEventListener('click', handleCompleteReminder);
    });
};

/**
 * Renders the results of the plant identification process into the modal.
 */
const renderIdentificationResults = (data, fileName, base64DataUrl) => {
    const resultsContainer = document.getElementById('identification-results');
    const savePlantButton = document.getElementById('open-save-plant-modal');

    // Clear previous results
    resultsContainer.innerHTML = '';
    savePlantButton.classList.add('hidden');

    // Check for success and results
    if (data.result && data.result.classification && data.result.classification.suggestions.length > 0) {
        const bestMatch = data.result.classification.suggestions[0];

        resultsContainer.innerHTML = `
            <h4>Best Match: ${bestMatch.name}</h4>
            <p><strong>Probability:</strong> ${(bestMatch.probability * 100).toFixed(2)}%</p>
            <p><strong>Common Names:</strong> ${bestMatch.details.common_names ? bestMatch.details.common_names.join(', ') : 'N/A'}</p>
            <p><strong>Scientific Name:</strong> <em>${bestMatch.scientific_name}</em></p>
            <p><strong>Source:</strong> ${bestMatch.details.url || 'N/A'}</p>
        `;

        // Store data needed for saving the plant temporarily
        savePlantButton.dataset.name = bestMatch.name;
        savePlantButton.dataset.scientificName = bestMatch.scientific_name;
        savePlantButton.dataset.commonName = bestMatch.details.common_names ? bestMatch.details.common_names[0] : bestMatch.name;
        savePlantButton.dataset.imageUrl = base64DataUrl; // The Base64 string is stored here
        savePlantButton.dataset.identificationData = JSON.stringify(data); // Store the raw data
        
        savePlantButton.classList.remove('hidden');
        document.getElementById('identification-message').textContent = 'Identification complete. Review results or save to your collection.';

    } else {
        resultsContainer.innerHTML = '<p>No confident identification found. Try a clearer photo.</p>';
        document.getElementById('identification-message').textContent = 'Identification failed to find a match.';
        savePlantButton.classList.add('hidden');
    }
};

/**
 * Prepares and opens the "Save Plant" modal using identification results.
 */
const openSavePlantModal = (event) => {
    const button = event.target;
    
    // Populate the form fields with data from the identification results
    document.getElementById('plant-name-input').value = button.dataset.name;
    document.getElementById('scientific-name-input').value = button.dataset.scientificName;
    document.getElementById('common-name-input').value = button.dataset.commonName;
    document.getElementById('image-url-data').value = button.dataset.imageUrl;
    document.getElementById('identification-data-input').value = button.dataset.identificationData;
    
    // Reset form messages and show modal
    document.getElementById('save-plant-message').textContent = '';
    savePlantModal.style.display = 'block';
    
    // Close the identification modal
    closeIdentifyPlantModal();
};

/**
 * Closes the save plant modal.
 */
const closeSavePlantModal = () => {
    savePlantModal.style.display = 'none';
};


// --- Handler Functions ---

/**
 * Logs the user out by clearing the token and redirecting.
 */
const handleLogout = () => {
    localStorage.removeItem('authToken');
    window.location.href = 'login.html';
};

/**
 * Opens the identification modal and clears previous state.
 */
const openIdentifyPlantModal = () => {
    identifyPlantForm.reset();
    document.getElementById('identification-message').textContent = '';
    document.getElementById('identification-results').innerHTML = '<p>Select an image and click "Identify Plant" to begin.</p>';
    document.getElementById('open-save-plant-modal').classList.add('hidden');
    identifyPlantModal.style.display = 'block';
};

/**
 * Closes the identification modal.
 */
const closeIdentifyPlantModal = () => {
    identifyPlantModal.style.display = 'none';
};

/**
 * Handles the identification process: reads the file, converts to Base64, and sends to the server.
 * This function contains the critical fix for the "No image data provided" error.
 */
const handleIdentifyPlant = (event) => {
    event.preventDefault();
    
    const fileInput = document.getElementById('identify-image-upload');
    const messageElement = document.getElementById('identification-message');
    
    messageElement.textContent = 'Uploading and analyzing photo...';
    messageElement.classList.remove('error', 'success');
    document.getElementById('identification-results').innerHTML = ''; // Clear results while processing
    document.getElementById('open-save-plant-modal').classList.add('hidden'); // Hide save button

    if (fileInput.files.length === 0) {
        messageElement.textContent = 'No image selected. Please upload a photo.';
        messageElement.classList.add('error');
        return;
    }

    const file = fileInput.files[0];
    
    // Use the FileReader API to convert the image to Base64
    const reader = new FileReader();

    reader.onload = async () => {
        // The result is the Base64 data URL string (e.g., "data:image/jpeg;base64,....")
        const base64DataUrl = reader.result;
        
        // **CRITICAL FIX**: Remove the data URL prefix (e.g., "data:image/jpeg;base64,") to get pure Base64
        const base64Image = base64DataUrl.split(',')[1];
        
        try {
            const response = await fetch('/api/identify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ base64Image }) // Send the pure Base64 string
            });

            const result = await response.json();

            if (response.ok) {
                messageElement.textContent = 'Identification successful!';
                messageElement.classList.add('success');
                
                // Proceed to show the results in the modal
                renderIdentificationResults(result, fileInput.files[0].name, base64DataUrl);
                
            } else {
                messageElement.textContent = `Identification failed: ${result.message || 'Server error.'}`;
                messageElement.classList.add('error');
            }

        } catch (error) {
            console.error('Network error during identification:', error);
            messageElement.textContent = 'Network error. Could not connect to identification service.';
            messageElement.classList.add('error');
        }
    };

    reader.onerror = () => {
        messageElement.textContent = 'Error reading the image file.';
        messageElement.classList.add('error');
    };

    // Start reading the file as a Data URL
    reader.readAsDataURL(file);
};


/**
 * Handles saving the identified plant to the user's collection.
 */
const handleSavePlant = async (event) => {
    event.preventDefault();

    const messageElement = document.getElementById('save-plant-message');
    messageElement.textContent = 'Saving plant...';
    messageElement.className = 'modal-message';

    const name = document.getElementById('plant-name-input').value;
    const scientific_name = document.getElementById('scientific-name-input').value;
    const common_name = document.getElementById('common-name-input').value;
    const image_url = document.getElementById('image-url-data').value; // Base64 data URL
    const notes = document.getElementById('notes-input').value;
    const identification_data = document.getElementById('identification-data-input').value;

    if (!name) {
        messageElement.textContent = 'Plant name is required.';
        messageElement.classList.add('error');
        return;
    }

    try {
        const response = await fetch('/api/plants', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name, scientific_name, common_name, image_url, notes, identification_data })
        });

        const result = await response.json();

        if (response.ok) {
            messageElement.textContent = 'Plant saved successfully!';
            messageElement.classList.add('success');
            fetchPlants(); // Refresh the plant list
            setTimeout(closeSavePlantModal, 1500);
        } else {
            messageElement.textContent = `Error saving plant: ${result.message || 'Server error.'}`;
            messageElement.classList.add('error');
        }

    } catch (error) {
        console.error('Network error saving plant:', error);
        messageElement.textContent = 'Network error. Could not save plant.';
        messageElement.classList.add('error');
    }
};

/**
 * Handles marking a due reminder as complete.
 */
const handleCompleteReminder = async (event) => {
    const reminderId = event.target.dataset.reminderId;

    try {
        const response = await fetch(`/api/reminders/${reminderId}/complete`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            // Optimistically remove the item and refresh the list
            event.target.closest('.reminder-due-item').remove();
            fetchDueReminders(); 
        } else {
            const error = await response.json();
            alert(`Failed to complete task: ${error.message}`);
        }
    } catch (error) {
        console.error('Error completing reminder:', error);
        alert('Network error completing task.');
    }
};

// --- Attach Listeners ---
document.addEventListener('DOMContentLoaded', init);