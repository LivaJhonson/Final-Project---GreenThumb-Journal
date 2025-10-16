// client/js/plant-profile.js

// --- IMPORT THE EXTERNAL API HANDLER ---
import { getTreflePlantDetails } from './external-services.mjs'; 
// NOTE: external-services.mjs must contain the getTreflePlantDetails function and the Trefle API key.

// --- DOM Elements ---
const plantProfileName = document.getElementById('plant-profile-name');
const plantDetailsSection = document.getElementById('plant-details-section');
const loadingMessage = document.getElementById('loading-message'); // Added loading message element
const supplementalDataSection = document.getElementById('supplemental-data-section');
const tabsContainer = document.getElementById('tabs-container'); // New: Tabs container

// WEEK 8 ADDITION: Diagnosis elements
const diagnosisResultsSection = document.getElementById('diagnosis-results-section');
const diagnosisLoadingMessage = document.getElementById('diagnosis-loading-message'); // New: Diagnosis loading message

// Buttons
const deletePlantTopBtn = document.getElementById('delete-plant-top-btn');
const editPlantBtn = document.getElementById('edit-plant-btn'); // New: Edit button
const addReminderBtn = document.getElementById('add-reminder-btn'); // New: Add Reminder button
const addPhotoBtn = document.getElementById('add-photo-btn'); // New: Add Photo button
const diagnosePlantBtn = document.getElementById('diagnose-plant-btn'); // WEEK 8: Diagnose button

// Tab Content Containers
const remindersList = document.getElementById('reminders-list');
const photosGrid = document.getElementById('photos-grid');
const noRemindersMessage = document.getElementById('no-reminders-message');
const noPhotosMessage = document.getElementById('no-photos-message');

// Modals and Forms
const editPlantModal = document.getElementById('edit-plant-modal');
const setReminderModal = document.getElementById('set-reminder-modal');
const addPhotoModal = document.getElementById('add-photo-modal');

const editPlantForm = document.getElementById('edit-plant-form');
const setReminderForm = document.getElementById('set-reminder-form');
const addPhotoForm = document.getElementById('upload-photo-form'); // Corrected to match the final HTML ID

const editPlantMessage = document.getElementById('edit-plant-message');
const setReminderMessage = document.getElementById('set-reminder-message'); // Corrected to match the final HTML ID
const addPhotoMessage = document.getElementById('photo-message'); // Corrected to match the final HTML ID

let currentPlantId = null; // Store the ID globally
let currentScientificName = null; // Store the scientific name for Trefle lookup
// ADDED Trefle ID placeholder. This is where your Plant.ID result should store the Trefle ID.
let currentTrefleId = null; 

// --- UTILITY FUNCTIONS ---

/**
 * Handles opening a specific modal.
 * @param {HTMLElement} modalElement The modal to open.
 */
const openModal = (modalElement) => {
    modalElement.classList.remove('hidden');
    document.body.classList.add('modal-open'); // To prevent scrolling behind the modal
};

/**
 * Handles closing a specific modal and optionally clears the form message.
 * @param {HTMLElement} modalElement The modal to close.
 * @param {HTMLElement} formMessageElement The associated form message to clear.
 */
const closeModal = (modalElement, formMessageElement) => {
    modalElement.classList.add('hidden');
    document.body.classList.remove('modal-open');
    if (formMessageElement) {
        formMessageElement.textContent = '';
        formMessageElement.classList.remove('success', 'error');
    }
    // Reset forms when closing
    const form = modalElement.querySelector('form');
    if(form) form.reset();
};

/**
 * Sets the default date for the 'Last Completed' field in the Set Reminder Modal to today.
 */
const setTodayDate = () => {
    const today = new Date().toISOString().split('T')[0];
    // FIX: Using the correct ID from our schema plan
    const lastCompletedInput = document.getElementById('last-completed'); 
    if (lastCompletedInput) lastCompletedInput.value = today;
};

// --- 1. Get Plant ID from URL and Initialize ---
const getPlantIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if (!id) {
        loadingMessage.textContent = 'Error: No plant ID provided in the URL.';
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
            loadingMessage.classList.add('hidden');
            plantDetailsSection.classList.remove('hidden');
            tabsContainer.classList.remove('hidden'); // Show tabs
            
            currentScientificName = plant.scientific_name;
            currentTrefleId = plant.trefle_id; // ASSUME: Your plant schema saves the Trefle ID
            
            renderMainDetails(plant);

            // Populate Edit Modal fields
            document.getElementById('edit-name').value = plant.name;
            document.getElementById('edit-scientific-name').value = plant.scientific_name || '';
            document.getElementById('edit-common-name').value = plant.common_name || '';
            document.getElementById('edit-notes').value = plant.notes || '';
            
            // Fetch related data
            fetchSupplementalData(plant.trefle_id); // CHANGED: Fetch using Trefle ID
            fetchPlantReminders();
            fetchGrowthPhotos();
            
        } else {
            loadingMessage.textContent = `Error: ${plant.message || 'Could not find plant details.'}`;
        }
    } catch (error) {
        console.error('Network error fetching plant:', error);
        loadingMessage.textContent = 'A network error occurred while fetching plant data.';
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
                <h2>${plant.name}</h2>
                <p><strong>Common Name:</strong> <span id="display-common-name">${plant.common_name || 'N/A'}</span></p>
                <p><strong>Scientific Name:</strong> <em id="display-scientific-name">${plant.scientific_name || 'N/A'}</em></p>
                
                <div class="plant-stats-grid">
                    <div class="stat-item">
                        <i class="fas fa-calendar-alt"></i>
                        <span>${new Date(plant.date_added).toLocaleDateString()}</span>
                        <small>Date Added</small>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-tint"></i>
                        <span>${plant.last_watered ? new Date(plant.last_watered).toLocaleDateString() : 'N/A'}</span>
                        <small>Last Watered</small>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-sun"></i>
                        <span>${plant.light_needs || 'Moderate'}</span>
                        <small>Light Needs</small>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-flask"></i>
                        <span>${plant.fertilizer_frequency ? plant.fertilizer_frequency + ' days' : 'N/A'}</span>
                        <small>Fertilizer Freq</small>
                    </div>
                </div>

                <h3>Notes</h3>
                <p class="plant-notes" id="display-notes">${plant.notes || 'No custom notes available.'}</p>
            </div>
        </div>
    `;

    plantDetailsSection.innerHTML = html;
};


// --- 4. Fetch Supplemental Data (USING TREFLE API DIRECTLY - Outcome 6) ---
const fetchSupplementalData = async (trefleId) => {
    supplementalDataSection.classList.remove('hidden');
    
    // Clear previous supplemental data or loading message
    supplementalDataSection.innerHTML = '<h2>Supplemental Details</h2><p id="supplemental-loading-message" class="loading-message">Fetching external data...</p>';
    const supLoadingMessage = document.getElementById('supplemental-loading-message');
    
    if (!trefleId) {
        supLoadingMessage.textContent = 'No Trefle ID available to fetch supplemental data.';
        return;
    }

    try {
        // CALL EXTERNAL API DIRECTLY (Two API requirement met)
        const trefleData = await getTreflePlantDetails(trefleId);

        supLoadingMessage.classList.add('hidden');

        if (trefleData) {
            renderSupplementalData(trefleData);
        } else {
            supplementalDataSection.innerHTML = '<h2>Supplemental Details</h2><p class="placeholder-text">No supplemental data found from Trefle.</p>';
        }
    } catch (error) {
        console.error('Error fetching supplemental data from Trefle:', error);
        supplementalDataSection.innerHTML = '<h2>Supplemental Details</h2><p class="error-message">Error loading external supplemental data from Trefle.</p>';
    }
};

// --- 5. Render Supplemental Data (Adapted for Trefle API response) ---
const renderSupplementalData = (trefleData) => {
    // Trefle API response is nested. We check for 'main_species' details
    const details = trefleData.main_species || {}; 

    // Helper to safely access nested attributes, defaulting to 'N/A'
    const getValue = (obj, path) => {
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            current = current ? current[part] : undefined;
        }
        return current || 'N/A';
    };

    let html = `
        <div class="supplemental-info-grid">
            <p><strong>Family:</strong> ${getValue(details, 'family_common_name')}</p>
            <p><strong>Duration:</strong> ${getValue(details, 'duration')}</p>
            <p><strong>Native Status:</strong> ${getValue(trefleData, 'native_status')}</p>
            <p><strong>Growth Habit:</strong> ${getValue(details, 'growth_habit')}</p>
            <p><strong>Toxicity:</strong> ${getValue(details, 'toxicity')}</p>
            <p><strong>Min Temp:</strong> ${getValue(details, 'minimum_temperature.deg_f') ? `${getValue(details, 'minimum_temperature.deg_f')} °F` : 'N/A'}</p>
        </div>
        
        <div class="common-names-list">
            <h4>Common Names</h4>
            <ul>
                ${trefleData.common_names && Array.isArray(trefleData.common_names) ? 
                    trefleData.common_names.map(name => `<li>${name}</li>`).join('') : 
                    '<li>No common names listed.</li>'}
            </ul>
        </div>
        <p class="trefle-source">Data courtesy of Trefle.io</p>
    `;
    
    supplementalDataSection.innerHTML = `<h2>Supplemental Details (from Trefle)</h2>${html}`;
};


// ----------------------------------------------------------------------
// --- WEEK 8: DISEASE DIAGNOSIS FUNCTIONS ---
// ----------------------------------------------------------------------
// NOTE: These functions remain UNCHANGED as they rely on your local /api/plant-diagnosis mock.

/**
 * Fetches the disease diagnosis results for the current plant.
 */
const fetchDiagnosisData = async () => {
    const authToken = localStorage.getItem('authToken');
    diagnosisResultsSection.classList.remove('hidden');
    
    // Clear previous results
    diagnosisResultsSection.innerHTML = '<h2>Disease Diagnosis Results</h2>';
    diagnosisLoadingMessage.textContent = 'Running diagnosis simulation...';
    diagnosisLoadingMessage.classList.remove('hidden');

    try {
        // NOTE: This endpoint is simulated to return a mocked result.
        const response = await fetch(`/api/plant-diagnosis/${currentPlantId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        diagnosisLoadingMessage.classList.add('hidden');

        if (response.ok) {
            renderDiagnosisData(data);
        } else {
            diagnosisResultsSection.innerHTML += `<p class="error-message">Error: ${data.message || 'Failed to run diagnosis.'}</p>`;
        }
    } catch (error) {
        console.error('Error fetching diagnosis data:', error);
        diagnosisLoadingMessage.classList.add('hidden');
        diagnosisResultsSection.innerHTML += '<p class="error-message">Network error connecting to diagnosis service.</p>';
    }
};

/**
 * Renders the diagnosis results in a user-friendly format.
 * @param {Object} diagnosisResult - The diagnosis result object.
 */
const renderDiagnosisData = (result) => {
    if (!result || !result.diagnosis || result.diagnosis.length === 0) {
        diagnosisResultsSection.innerHTML += '<p class="placeholder-text">No significant issues detected, or the diagnosis service found no common problems.</p>';
        return;
    }

    const diagnosisHtml = result.diagnosis.map(d => `
        <div class="supplemental-info-grid diagnosis-item">
            <p><strong>Potential Issue:</strong> <span style="color: var(--color-error);">${d.issue}</span></p>
            <p><strong>Confidence:</strong> ${d.confidence_score ? (d.confidence_score * 100).toFixed(1) + '%' : 'N/A'}</p>
            <p style="grid-column: 1 / -1;"><strong>Recommended Action:</strong> ${d.recommended_action || 'Consult a local gardening expert.'}</p>
        </div>
    `).join('');

    diagnosisResultsSection.innerHTML += `
        <p class="modal-description">Based on the latest data and images (if available), here are the potential issues detected:</p>
        <div style="margin-top: 20px;">
            ${diagnosisHtml}
        </div>
        <p class="trefle-source" style="text-align: left; margin-top: 30px;">
            *Diagnosis is AI-driven and for informational purposes only. Always verify with a professional.*
        </p>
    `;
};


// ----------------------------------------------------------------------
// --- WEEK 7: PLANT MANAGEMENT FUNCTIONS (Edit/Delete) ---
// ----------------------------------------------------------------------

/**
 * Handles the submission of the Edit Plant form. (Update)
 */
const handleEditPlant = async (event) => {
    event.preventDefault();
    const formData = new FormData(editPlantForm);
    const data = Object.fromEntries(formData.entries());
    const authToken = localStorage.getItem('authToken');
    
    editPlantMessage.textContent = 'Saving...';
    editPlantMessage.classList.remove('success', 'error');

    try {
        const response = await fetch(`/api/plants/${currentPlantId}`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            editPlantMessage.textContent = 'Details updated successfully!';
            editPlantMessage.classList.add('success');
            
            // Update the display without a full page reload
            document.getElementById('plant-profile-name').textContent = data.name;
            document.getElementById('plant-page-title').textContent = `${data.name} Profile`;
            
            // Update visible fields on the profile
            document.getElementById('display-common-name').textContent = data.common_name || 'N/A';
            document.getElementById('display-scientific-name').textContent = data.scientific_name || 'N/A';
            document.getElementById('display-notes').textContent = data.notes || 'No custom notes available.';
            
            // If scientific name changed, refresh supplemental data
            if (currentScientificName !== data.scientific_name) {
                currentScientificName = data.scientific_name;
                // If you had a way to map the scientific name to a Trefle ID, 
                // you would call fetchSupplementalData(newTrefleId) here.
                // For simplicity, we just reload the whole page to force a fresh fetch
                // window.location.reload(); 
            }

            setTimeout(() => {
                closeModal(editPlantModal, editPlantMessage);
            }, 1000);

        } else {
            editPlantMessage.textContent = `Error: ${result.message || 'Failed to update plant details.'}`;
            editPlantMessage.classList.add('error');
        }

    } catch (error) {
        console.error('Network error updating plant:', error);
        editPlantMessage.textContent = 'Network error. Could not update the plant.';
        editPlantMessage.classList.add('error');
    }
};


/**
 * Implements Plant Deletion Functionality (Delete)
 */
const deleteCurrentPlant = async () => {
    if (!currentPlantId) return;

    if (!confirm(`Are you sure you want to delete ${plantProfileName.textContent}? This action cannot be undone.`)) {
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

// ----------------------------------------------------------------------
// --- WEEK 7: REMINDER FUNCTIONS (CRUD) ---
// ----------------------------------------------------------------------

// ... (Reminder functions remain UNCHANGED) ...
/**
 * Fetches and renders all reminders for the current plant. (Read All)
 */
const fetchPlantReminders = async () => {
    const authToken = localStorage.getItem('authToken');
    remindersList.innerHTML = '<p class="loading-message">Loading reminders...</p>';
    noRemindersMessage.classList.add('hidden');
    document.getElementById('reminder-count').textContent = '';

    try {
        // NOTE: Assuming this route is functional on the backend
        const response = await fetch(`/api/plants/${currentPlantId}/reminders`, { 
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const reminders = await response.json();

        if (response.ok && Array.isArray(reminders)) {
            renderReminders(reminders);
        } else {
            remindersList.innerHTML = `<p class="error">Error loading reminders: ${reminders.message || 'Server error.'}</p>`;
        }
    } catch (error) {
        console.error('Error fetching reminders:', error);
        remindersList.innerHTML = '<p class="error">Network error fetching reminders.</p>';
    }
};

/**
 * Renders the list of reminders.
 */
const renderReminders = (reminders) => {
    remindersList.innerHTML = '';
    document.getElementById('reminder-count').textContent = `(${reminders.length})`;

    if (reminders.length === 0) {
        noRemindersMessage.classList.remove('hidden');
        return;
    }

    // Using a simple date comparison for status
    const today = new Date().toISOString().split('T')[0];

    reminders.forEach(r => {
        // NOTE: In SQLite, the column is `next_due`, not `next_due_date`
        const nextDueDate = r.next_due; 
        const isOverdue = nextDueDate < today; 
        const isDueToday = nextDueDate === today;
        const statusClass = isOverdue ? 'reminder-item-overdue' : (isDueToday ? 'reminder-item-due' : 'reminder-item-scheduled');
        const statusText = isOverdue ? 'OVERDUE' : (isDueToday ? 'DUE TODAY' : 'Scheduled');

        const item = document.createElement('div');
        item.className = `reminder-item ${statusClass}`;
        item.innerHTML = `
            <div>
                <strong><i class="fas fa-bell"></i> ${r.type}</strong> 
                <span class="frequency-label">(${r.frequency_days} days)</span>
            </div>
            <div class="reminder-dates">
                <p>Next Due: 
                    <span class="${isOverdue ? 'due-date-danger' : 'due-date-normal'}">
                        ${nextDueDate} (${statusText})
                    </span>
                </p>
                <p>Last Done: ${r.last_completed || 'Never'}</p>
            </div>
            <div class="reminder-actions">
                <button class="btn btn-small btn-primary complete-btn" data-reminder-id="${r.id}">
                    Complete Now
                </button>
                <button class="btn btn-small btn-danger delete-reminder-btn" data-reminder-id="${r.id}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </div>
        `;
        remindersList.appendChild(item);
    });

    // Attach event listeners for the new buttons
    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', handleCompleteReminder);
    });
    document.querySelectorAll('.delete-reminder-btn').forEach(btn => {
        btn.addEventListener('click', handleDeleteReminder);
    });
};


/**
 * Handles the form submission to create a new reminder. (Create)
 */
const handleSetReminder = async (event) => {
    event.preventDefault();
    const formData = new FormData(setReminderForm);
    const data = Object.fromEntries(formData.entries());
    const authToken = localStorage.getItem('authToken');
    
    data.plant_id = currentPlantId;
    data.frequency_days = parseInt(data.frequency_days);

    // Minor validation check
    if (!data.type || !data.frequency_days || isNaN(data.frequency_days) || !data.last_completed) {
        setReminderMessage.textContent = 'Please fill in the Type, Frequency, and Last Completed Date.';
        setReminderMessage.classList.add('error');
        return;
    }
    
    setReminderMessage.textContent = 'Setting reminder...';
    setReminderMessage.classList.remove('success', 'error');

    try {
        const response = await fetch(`/api/reminders`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            setReminderMessage.textContent = 'Reminder successfully set!';
            setReminderMessage.classList.add('success');
            
            fetchPlantReminders(); // Refresh the list
            // NOTE: window.loadDueReminders is a function expected to be in dashboard.js
            if (window.loadDueReminders) window.loadDueReminders(); 
            
            setTimeout(() => {
                closeModal(setReminderModal, setReminderMessage);
            }, 1000);

        } else {
            setReminderMessage.textContent = `Error: ${result.message || 'Failed to set reminder.'}`;
            setReminderMessage.classList.add('error');
        }

    } catch (error) {
        console.error('Network error setting reminder:', error);
        setReminderMessage.textContent = 'Network error. Could not set the reminder.';
        setReminderMessage.classList.add('error');
    }
};


/**
 * Logs a reminder completion event and updates the next due date. (Update)
 */
const handleCompleteReminder = async (event) => {
    const reminderId = event.target.dataset.reminderId;
    if (!confirm("Are you sure you want to mark this task as completed today?")) return;

    const authToken = localStorage.getItem('authToken');
    const completion_date = new Date().toISOString().split('T')[0]; // Send completion date

    try {
        // Optimistic update: disable the button
        event.target.textContent = 'Updating...';
        event.target.disabled = true;

        const response = await fetch(`/api/reminders/${reminderId}/complete`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}` 
            },
            body: JSON.stringify({ completion_date }) // Send completion date in the body
        });

        if (response.ok) {
            // Re-fetch the list to show the new next_due date
            fetchPlantReminders(); 
            if (window.loadDueReminders) window.loadDueReminders(); 
        } else {
            const data = await response.json();
            alert('Failed to complete task: ' + (data.message || 'Server error.'));
            // Revert changes on failure
            event.target.textContent = 'Complete Now';
            event.target.disabled = false;
        }
    } catch (error) {
        console.error('Network error completing task:', error);
        alert('Network error. Could not log task completion.');
        // Revert changes on failure
        event.target.textContent = 'Complete Now';
        event.target.disabled = false;
    }
};

/**
 * Handles the deletion of a specific reminder. (Delete)
 */
const handleDeleteReminder = async (event) => {
    // Traverse up to get the button if the icon was clicked
    let targetButton = event.target.closest('.delete-reminder-btn');
    if (!targetButton) return;
    
    const reminderId = targetButton.dataset.reminderId;
    if (!confirm("Are you sure you want to delete this recurring reminder?")) return;

    const authToken = localStorage.getItem('authToken');

    try {
        const response = await fetch(`/api/reminders/${reminderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            fetchPlantReminders(); 
            if (window.loadDueReminders) window.loadDueReminders(); 
        } else {
            const data = await response.json();
            alert('Failed to delete reminder: ' + (data.message || 'Server error.'));
        }
    } catch (error) {
        console.error('Network error deleting reminder:', error);
        alert('Network error. Could not delete the reminder.');
    }
};


// ----------------------------------------------------------------------
// --- WEEK 7: PHOTO FUNCTIONS (Growth Photo Upload) ---
// ----------------------------------------------------------------------

// ... (Photo functions remain UNCHANGED) ...
/**
 * Fetches and renders all growth photos for the current plant. (Read All)
 */
const fetchGrowthPhotos = async () => {
    const authToken = localStorage.getItem('authToken');
    photosGrid.innerHTML = '<p class="loading-message">Loading photos...</p>';
    noPhotosMessage.classList.add('hidden');
    document.getElementById('photo-count').textContent = '';
    
    try {
        const response = await fetch(`/api/plants/${currentPlantId}/photos`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const photos = await response.json();

        if (response.ok && Array.isArray(photos)) {
            renderGrowthPhotos(photos);
        } else {
            photosGrid.innerHTML = `<p class="error">Error loading photos: ${photos.message || 'Server error.'}</p>`;
        }
    } catch (error) {
        console.error('Error fetching photos:', error);
        photosGrid.innerHTML = '<p class="error">Network error fetching photos.</p>';
    }
};

/**
 * Renders the grid of growth photos.
 */
const renderGrowthPhotos = (photos) => {
    photosGrid.innerHTML = '';
    document.getElementById('photo-count').textContent = `(${photos.length})`;

    if (photos.length === 0) {
        noPhotosMessage.classList.remove('hidden');
        return;
    }

    const gridContent = document.createElement('div');
    gridContent.className = 'photo-grid'; // Use the class name for the grid layout

    photos.forEach(p => {
        const item = document.createElement('div');
        item.className = 'photo-item';
        // NOTE: The backend schema uses 'image_url', while the frontend rendering uses 'photo_url' and 'caption'
        // We will assume the photo object returned here has 'image_url' and 'notes' from the database:
        item.innerHTML = `
            <img src="${p.image_url}" alt="Growth Photo taken on ${new Date(p.date_taken).toLocaleDateString()}">
            <p class="photo-date">${new Date(p.date_taken).toLocaleDateString()}</p>
            ${p.notes ? `<p class="photo-notes">${p.notes}</p>` : ''}
        `;
        gridContent.appendChild(item);
    });

    photosGrid.appendChild(gridContent);
};


/**
 * Handles the form submission to add a new growth photo. (Create)
 * NOTE: This is a simplified implementation that uses the URL input from the modal.
 */
const handleAddPhoto = async (event) => {
    event.preventDefault();
    // Use the correct ID for the URL input from the HTML
    const photoUrlInput = document.getElementById('photo-url');
    const captionInput = document.getElementById('photo-caption');

    const image_url = photoUrlInput.value; // Use image_url to match backend payload
    const notes = captionInput.value;       // Use notes to match backend payload
    const authToken = localStorage.getItem('authToken');
    
    addPhotoMessage.textContent = 'Saving photo...';
    addPhotoMessage.classList.remove('success', 'error');

    if (!image_url) {
        addPhotoMessage.textContent = 'Please enter an image URL.';
        addPhotoMessage.classList.add('error');
        return;
    }
    
    // Data payload for the backend (which expects JSON with the URL)
    const data = {
        image_url: image_url,
        notes: notes
    };

    try {
        const response = await fetch(`/api/plants/${currentPlantId}/photos`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', // Backend expects JSON with the URL
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            addPhotoMessage.textContent = 'Photo saved successfully!';
            addPhotoMessage.classList.add('success');
            
            fetchGrowthPhotos(); // Refresh the photo grid
            setTimeout(() => {
                closeModal(addPhotoModal, addPhotoMessage);
            }, 1000);

        } else {
            addPhotoMessage.textContent = `Error: ${result.message || 'Failed to save photo.'}`;
            addPhotoMessage.classList.add('error');
        }

    } catch (error) {
        console.error('Network error saving photo:', error);
        addPhotoMessage.textContent = 'Network error. Could not save the photo.';
        addPhotoMessage.classList.add('error');
    }
};

// ----------------------------------------------------------------------
// --- INITIALIZATION & EVENT LISTENERS ---
// ----------------------------------------------------------------------

/**
 * Function to handle tab switching
 */
const handleTabSwitch = (event) => {
    // Traverse up to find the .tab-button parent if an icon or span inside was clicked
    let target = event.target;
    while (target && !target.classList.contains('tab-button') && target !== tabsContainer) {
        target = target.parentNode;
    }
    
    if (!target || !target.classList.contains('tab-button')) return;

    const tabName = target.dataset.tab;
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Remove active class from all buttons and hide all content
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.add('hidden'));

    // Add active class to the clicked button
    target.classList.add('active');

    // Show the corresponding content
    document.getElementById(`${tabName}-tab-content`).classList.remove('hidden');
};


document.addEventListener('DOMContentLoaded', () => {
    const plantId = getPlantIdFromUrl();
    if (plantId) {
        fetchPlantDetails(plantId);
    }

    // --- Tab Switching Listener (Delegation) ---
    const tabsNav = document.querySelector('.tabs-nav');
    if (tabsNav) {
        tabsNav.addEventListener('click', handleTabSwitch);
    }
    
    // --- General Action Buttons ---
    if (deletePlantTopBtn) deletePlantTopBtn.addEventListener('click', deleteCurrentPlant);
    if (diagnosePlantBtn) diagnosePlantBtn.addEventListener('click', fetchDiagnosisData);
    if (editPlantBtn) editPlantBtn.addEventListener('click', () => openModal(editPlantModal));
    
    // --- Modal Control Buttons ---
    document.querySelectorAll('.close-btn').forEach(btn => {
        const modalId = btn.dataset.modalId;
        if (modalId) {
            const modal = document.getElementById(modalId);
            const message = document.getElementById(modalId.replace('-modal', '-message'));
            btn.addEventListener('click', () => closeModal(modal, message));
        }
    });

    // --- Tab-specific Modals ---
    if (addReminderBtn) addReminderBtn.addEventListener('click', () => {
        setTodayDate();
        openModal(setReminderModal);
    });
    if (addPhotoBtn) addPhotoBtn.addEventListener('click', () => openModal(addPhotoModal));
    
    // --- Form Submissions ---
    if (editPlantForm) editPlantForm.addEventListener('submit', handleEditPlant);
    if (setReminderForm) setReminderForm.addEventListener('submit', handleSetReminder);
    if (addPhotoForm) addPhotoForm.addEventListener('submit', handleAddPhoto);

});