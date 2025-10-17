// client/js/plant-profile.js

// --- Global Variables ---
let currentPlantId = null; 
let currentPlant = null;
const authToken = localStorage.getItem('authToken');

// DOM Elements (Selectors should match your HTML structure)
const plantDetailsContainer = document.getElementById('plant-details-container');
const generalInfoSection = document.getElementById('general-info');
const supplementalDetailsSection = document.getElementById('supplemental-details');
const remindersSection = document.getElementById('reminders-content');
const growthPhotosSection = document.getElementById('growth-photos-content');
const photosGrid = document.getElementById('photos-grid');
const noPhotosMessage = document.getElementById('no-photos-message');
const remindersList = document.getElementById('reminders-list');
const noRemindersMessage = document.getElementById('no-reminders-message');
const careReminderModal = document.getElementById('care-reminder-modal');
const addPhotoModal = document.getElementById('add-photo-modal');


// --- Utility Functions ---

/**
 * Parses URL query parameters to get the plant ID.
 */
const getPlantIdFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
};

/**
 * Clears and shows an error message in the main container.
 */
const renderError = (message) => {
    plantDetailsContainer.innerHTML = `<div class="error-message">${message}</div>`;
};

/**
 * Displays a temporary message (success or error) in a modal.
 */
const displayModalMessage = (modalId, message, isError = false) => {
    // Assuming your modals have a nested element with class 'modal-message'
    const modalElement = document.getElementById(modalId);
    if (!modalElement) return;
    const messageElement = modalElement.querySelector('.modal-message');
    
    if (!messageElement) return;
    messageElement.textContent = message;
    messageElement.className = isError ? 'modal-message error' : 'modal-message success';
    setTimeout(() => {
        messageElement.textContent = '';
        messageElement.className = 'modal-message';
    }, 5000);
};

// --- Data Fetching Functions ---

/**
 * Fetches the main plant data.
 */
const fetchPlantData = async () => {
    try {
        const response = await fetch(`/api/plants/${currentPlantId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            if (response.status === 404) {
                 throw new Error("Plant not found or access denied.");
            }
            throw new Error("Failed to load plant details.");
        }

        currentPlant = await response.json();
        renderPlantDetails(currentPlant);
        
        // Fetch supplemental details only if scientific name is available
        if (currentPlant.scientific_name) {
            fetchSupplementalDetails(currentPlant.scientific_name);
        } else {
             supplementalDetailsSection.innerHTML = '<p>No scientific name available for supplemental details.</p>';
        }

    } catch (error) {
        console.error('Error fetching plant data:', error);
        renderError(error.message);
    }
};

/**
 * Fetches supplemental Trefle data.
 */
const fetchSupplementalDetails = async (scientificName) => {
    supplementalDetailsSection.innerHTML = '<p>Fetching supplemental data...</p>';

    try {
        const response = await fetch(`/api/plant-details/${scientificName}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            supplementalDetailsSection.innerHTML = '<p>Supplemental data is not available from Trefle.io.</p>';
            return;
        }

        const data = await response.json();
        renderSupplementalDetails(data);

    } catch (error) {
        console.error('Error fetching Trefle details:', error);
        supplementalDetailsSection.innerHTML = '<p>Network error fetching supplemental details.</p>';
    }
};

/**
 * Fetches reminders for the current plant.
 */
const fetchReminders = async () => {
    try {
        const response = await fetch(`/api/plants/${currentPlantId}/reminders`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            throw new Error("Network error fetching reminders.");
        }

        const reminders = await response.json();
        renderReminders(reminders);
    } catch (error) {
        console.error('Error fetching reminders:', error);
        noRemindersMessage.textContent = error.message;
        noRemindersMessage.classList.remove('hidden');
    }
};


/**
 * Fetches growth photos for the current plant.
 */
const fetchGrowthPhotos = async () => {
    try {
        const response = await fetch(`/api/plants/${currentPlantId}/photos`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            throw new Error("Network error fetching growth photos.");
        }

        const photos = await response.json();
        renderGrowthPhotos(photos);
    } catch (error) {
        console.error('Error fetching photos:', error);
        photosGrid.innerHTML = `<div class="error-message">${error.message}</div>`;
    }
};


// --- Rendering Functions ---

/**
 * Renders the main plant details (Name, Scientific Name, Notes).
 */
const renderPlantDetails = (plant) => {
    // Hide loading text
    document.querySelector('.loading-text').classList.add('hidden');
    plantDetailsContainer.classList.remove('hidden');

    // Render general info
    generalInfoSection.innerHTML = `
        <h2 id="plant-name">${plant.name}</h2>
        <p class="common-name">Common Name: ${plant.common_name || 'N/A'}</p>
        <p class="scientific-name">Scientific Name: ${plant.scientific_name || 'N/A'}</p>
        <p class="date-added">${new Date(plant.date_added).toLocaleDateString()} (Date Added)</p>
        <div class="care-needs">
            <p><strong>Last Watered:</strong> ${plant.last_watered || 'N/A'}</p>
            <p><strong>Moderate Light needs:</strong> ${plant.light_needs || 'N/A'}</p>
            <p><strong>N/A Fert/Wtr Freq:</strong> ${plant.fertilizer_frequency || 'N/A'}</p>
        </div>
        <div class="notes-area">
            <h3>Notes</h3>
            <p>${plant.notes || 'No notes added.'}</p>
        </div>
        <p class="identification-date">Identified on ${plant.identification_date ? new Date(plant.identification_date).toLocaleDateString() : new Date(plant.date_added).toLocaleDateString()}</p>
    `;
    
    // Set the main image (if available)
    document.getElementById('plant-image').src = plant.image_url || 'placeholder.jpg';
    document.getElementById('plant-image').alt = `Image of ${plant.name}`;

    // Initial fetch for tab contents
    fetchReminders();
    fetchGrowthPhotos();
};

/**
 * Renders the supplemental details fetched from Trefle.
 */
const renderSupplementalDetails = (details) => {
    supplementalDetailsSection.innerHTML = `
        <h3>Supplemental Details (from Trefle)</h3>
        <p><strong>Family:</strong> ${details.family?.name || 'N/A'}</p>
        <p><strong>Duration:</strong> ${details.duration || 'N/A'}</p>
        <p><strong>Native Status:</strong> ${details.native_status || 'N/A'}</p>
        <p><strong>Growth Habit:</strong> ${details.growth_habit || 'N/A'}</p>
        <p><strong>Toxicity:</strong> ${details.toxicity || 'N/A'}</p>
        <p><strong>Min Temp:</strong> ${details.min_temp_f ? `${details.min_temp_f}°F` : 'N/A'}</p>
        <p><strong>Common Names:</strong></p>
        <ul>
            ${details.common_names && details.common_names.length > 0 
                ? details.common_names.map(name => `<li>${name}</li>`).join('')
                : '<li>No common names listed.</li>'}
        </ul>
        <p class="data-source">Data courtesy of Trefle.io</p>
    `;
};


/**
 * Renders the list of care reminders.
 */
const renderReminders = (reminders) => {
    remindersList.innerHTML = ''; 
    
    if (reminders.length === 0) {
        noRemindersMessage.classList.remove('hidden');
        noRemindersMessage.textContent = 'No scheduled care reminders. Click "Add Reminder" to set one.';
        return;
    }
    
    noRemindersMessage.classList.add('hidden');

    reminders.forEach(r => {
        const item = document.createElement('div');
        item.className = 'reminder-item';
        item.innerHTML = `
            <p><strong>Task:</strong> ${r.type}</p>
            <p><strong>Frequency:</strong> every ${r.frequency_days} days</p>
            <p><strong>Next Due:</strong> ${new Date(r.next_due).toLocaleDateString()}</p>
            <p><strong>Last Completed:</strong> ${new Date(r.last_completed).toLocaleDateString()}</p>
            <button class="btn btn-sm btn-delete-reminder" data-reminder-id="${r.id}">Delete</button>
        `;
        remindersList.appendChild(item);
    });

    // Add event listeners to delete buttons
    remindersList.querySelectorAll('.btn-delete-reminder').forEach(button => {
        button.addEventListener('click', handleDeleteReminder);
    });
};

/**
 * Renders the grid of growth photos.
 */
const renderGrowthPhotos = (photos) => {
    photosGrid.innerHTML = '';
    const photoCountElement = document.getElementById('photo-count');
    if (photoCountElement) {
        photoCountElement.textContent = `(${photos.length})`;
    }


    if (photos.length === 0) {
        noPhotosMessage.classList.remove('hidden');
        noPhotosMessage.textContent = 'No growth photos recorded yet. Add a new photo to track growth.';
        return;
    }
    
    noPhotosMessage.classList.add('hidden');

    const gridContent = document.createElement('div');
    gridContent.className = 'photo-grid'; 

    photos.forEach(p => {
        const item = document.createElement('div');
        item.className = 'photo-item';
        item.innerHTML = `
            <img src="${p.image_url}" alt="Growth Photo taken on ${new Date(p.date_taken).toLocaleDateString()}">
            <p class="photo-date">${new Date(p.date_taken).toLocaleDateString()}</p>
            ${p.notes ? `<p class="photo-notes">${p.notes}</p>` : ''}
        `;
        gridContent.appendChild(item);
    });

    photosGrid.appendChild(gridContent);
};


// --- Handler Functions ---

/**
 * Handles tab switching (General Info, Reminders, Photos).
 */
const handleTabSwitch = (event) => {
    const targetTab = event.target.dataset.tab;
    
    // Hide all content sections
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });

    // De-activate all tabs
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // Show the target section and activate the clicked button
    document.getElementById(targetTab).classList.remove('hidden');
    event.target.classList.add('active');

    // Re-fetch data when switching to a tab
    if (targetTab === 'reminders-content') {
        fetchReminders();
    } else if (targetTab === 'growth-photos-content') {
        fetchGrowthPhotos();
    }
    // General info is always displayed/updated by fetchPlantData
};

/**
 * Opens the "Set Care Reminder" modal.
 */
const openCareReminderModal = () => {
    // Reset form elements
    const form = document.getElementById('reminder-form');
    if (form) form.reset();

    const reminderMessage = document.getElementById('reminder-message');
    if (reminderMessage) reminderMessage.textContent = '';
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    const lastCompletedDate = document.getElementById('last-completed-date');
    if (lastCompletedDate) lastCompletedDate.value = today;

    if (careReminderModal) careReminderModal.style.display = 'block';
};

/**
 * Closes the "Set Care Reminder" modal.
 */
const closeCareReminderModal = () => {
    if (careReminderModal) careReminderModal.style.display = 'none';
};

/**
 * Handles submission of the new reminder form.
 */
const handleSetReminder = async (event) => {
    event.preventDefault();
    
    const type = document.getElementById('task-type').value;
    const frequency_days = document.getElementById('frequency-days').value;
    const last_completed = document.getElementById('last-completed-date').value;

    if (!type || !frequency_days || !last_completed) {
        displayModalMessage('care-reminder-modal', "All fields are required.", true);
        return;
    }

    try {
        const response = await fetch('/api/reminders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ 
                plant_id: currentPlantId, 
                type, 
                frequency_days: parseInt(frequency_days, 10), 
                last_completed 
            })
        });

        const result = await response.json();

        if (response.ok) {
            displayModalMessage('care-reminder-modal', "Reminder set successfully!", false);
            document.getElementById('reminder-form').reset();
            fetchReminders(); // Refresh the reminders list
            setTimeout(closeCareReminderModal, 2000); // Close after a delay
        } else {
            // Fix for the "Network error. Could not set the reminder." seen in image:
            displayModalMessage('care-reminder-modal', `Error: ${result.message || 'Could not set the reminder.'}`, true);
        }

    } catch (error) {
        console.error('Error setting reminder:', error);
        displayModalMessage('care-reminder-modal', "Network error. Could not set the reminder.", true);
    }
};

/**
 * Handles deletion of a reminder.
 */
const handleDeleteReminder = async (event) => {
    const reminderId = event.target.dataset.reminderId;
    if (!confirm('Are you sure you want to delete this reminder?')) {
        return;
    }

    try {
        const response = await fetch(`/api/reminders/${reminderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            alert('Reminder deleted successfully.');
            fetchReminders(); // Refresh the list
        } else {
            const error = await response.json();
            alert(`Failed to delete reminder: ${error.message}`);
        }
    } catch (error) {
        console.error('Error deleting reminder:', error);
        alert('Network error deleting reminder.');
    }
};

/**
 * Opens the "Add Growth Photo" modal.
 */
const openAddPhotoModal = () => {
    const form = document.getElementById('add-photo-form');
    if (form) form.reset();
    
    const photoMessage = document.getElementById('photo-message');
    if (photoMessage) photoMessage.textContent = '';

    const previewElement = document.getElementById('photo-preview');
    if (previewElement) {
        // Reset the image preview
        previewElement.src = 'placeholder.jpg'; 
    }
    if (addPhotoModal) addPhotoModal.style.display = 'block';
};

/**
 * Closes the "Add Growth Photo" modal.
 */
const closeAddPhotoModal = () => {
    if (addPhotoModal) addPhotoModal.style.display = 'none';
};

/**
 * Handles the file selection and displays a preview.
 */
const handlePhotoFileSelect = (event) => {
    const file = event.target.files[0];
    const previewElement = document.getElementById('photo-preview');

    if (file && previewElement) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewElement.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
};


/**
 * Handles submission of the new growth photo form.
 */
const handleAddPhoto = async (event) => {
    event.preventDefault();
    
    const photoMessage = document.getElementById('photo-message');
    photoMessage.textContent = 'Adding photo...';
    photoMessage.className = 'modal-message';

    const fileInput = document.getElementById('photo-upload-input');
    const notes = document.getElementById('photo-notes').value;

    if (fileInput.files.length === 0) {
        displayModalMessage('add-photo-modal', "Please select an image file.", true);
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async () => {
        // Get the Base64 data URL. This is what's sent to the server for storage.
        const image_url = reader.result; 

        try {
            const response = await fetch(`/api/plants/${currentPlantId}/photos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ image_url, notes })
            });

            const result = await response.json();

            if (response.ok) {
                displayModalMessage('add-photo-modal', "Photo added successfully!", false);
                document.getElementById('add-photo-form').reset();
                fetchGrowthPhotos(); // Refresh the photos list
                setTimeout(closeAddPhotoModal, 2000);
            } else {
                displayModalMessage('add-photo-modal', `Error adding photo: ${result.message || 'Server error.'}`, true);
            }

        } catch (error) {
            console.error('Error adding photo:', error);
            displayModalMessage('add-photo-modal', "Network error. Could not add photo.", true);
        }
    };

    reader.onerror = () => {
        displayModalMessage('add-photo-modal', "Error reading the image file.", true);
    };

    reader.readAsDataURL(file); // Start the file reading process
};

/**
 * Handles the Delete Plant button click.
 */
const handleDeletePlant = async () => {
    if (!confirm('Are you sure you want to permanently delete this plant and all its data? This cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/api/plants/${currentPlantId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            alert('Plant deleted successfully. Returning to dashboard.');
            window.location.href = 'dashboard.html';
        } else {
            const error = await response.json();
            alert(`Deletion failed: ${error.message}`);
        }
    } catch (error) {
        console.error('Error deleting plant:', error);
        alert('Network error during deletion.');
    }
};


// --- Initialization ---

/**
 * Main function to set up the page.
 */
const init = () => {
    currentPlantId = getPlantIdFromUrl();

    if (!authToken) {
        window.location.href = 'login.html'; // Redirect if not logged in
        return;
    }

    if (!currentPlantId) {
        renderError("Error: Plant ID is missing from the URL.");
        return;
    }
    
    // --- Event Listeners ---
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', handleTabSwitch);
    });

    // Reminder modal
    const addReminderButton = document.getElementById('add-reminder-button');
    if (addReminderButton) addReminderButton.addEventListener('click', openCareReminderModal);
    
    const closeReminderModalButton = document.querySelector('.close-reminder-modal');
    if (closeReminderModalButton) closeReminderModalButton.addEventListener('click', closeCareReminderModal);
    
    const reminderForm = document.getElementById('reminder-form');
    if (reminderForm) reminderForm.addEventListener('submit', handleSetReminder);

    // Photo modal
    const addPhotoButton = document.getElementById('add-photo-button');
    if (addPhotoButton) addPhotoButton.addEventListener('click', openAddPhotoModal);

    const closePhotoModalButton = document.querySelector('.close-photo-modal');
    if (closePhotoModalButton) closePhotoModalButton.addEventListener('click', closeAddPhotoModal);
    
    const photoUploadInput = document.getElementById('photo-upload-input');
    if (photoUploadInput) {
        photoUploadInput.addEventListener('change', handlePhotoFileSelect);
    }
    
    const addPhotoForm = document.getElementById('add-photo-form');
    if (addPhotoForm) addPhotoForm.addEventListener('submit', handleAddPhoto);
    
    // Action buttons
    document.getElementById('delete-plant-button').addEventListener('click', handleDeletePlant);
    document.getElementById('back-to-dashboard').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });


    // Start data fetching
    fetchPlantData();
};

document.addEventListener('DOMContentLoaded', init);