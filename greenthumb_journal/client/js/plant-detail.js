// --- /client/js/plant-detail.js ---

const plantId = new URLSearchParams(window.location.search).get('id');
const authToken = localStorage.getItem('authToken');

// --- Utility Functions ---

function getPlantEndpoint(path = '') {
    return `/api/plants/${plantId}${path}`;
}

async function fetchData(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            ...options.headers,
        }
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `API call failed: ${response.status}`);
    }
    return response.json();
}

// --- Task 1: Fetch and Display Plant Details ---
async function renderPlantDetails() {
    if (!plantId || !authToken) {
        alert("Invalid URL or not logged in.");
        window.location.href = 'dashboard.html';
        return;
    }

    try {
        const plant = await fetchData(getPlantEndpoint());
        
        // Render Header
        document.getElementById('plant-header').insertAdjacentHTML('afterbegin', 
            `<h2>${plant.name} (${plant.scientific_name || 'No scientific name'})</h2>`
        );

        // Render Plant Info
        document.getElementById('plant-info').innerHTML = `
            <h2>${plant.name}</h2>
            <p><strong>Common Name:</strong> ${plant.common_name || 'N/A'}</p>
            <p><strong>Scientific Name:</strong> <em>${plant.scientific_name || 'N/A'}</em></p>
            <p><strong>Notes:</strong> ${plant.notes || 'No notes yet.'}</p>
            <p><strong>Added:</strong> ${new Date(plant.date_added).toLocaleDateString()}</p>
            <img src="${plant.image_url}" alt="${plant.name}" style="width: 100%; max-height: 200px; object-fit: cover; margin-top: 10px;">
        `;
        
        // Task: Develop Disease Diagnosis Result Display
        renderDiseaseDiagnosis(plant.identification_data);
        
        // Render Reminders and Photos
        renderReminders();
        renderPhotos();

    } catch (error) {
        console.error("Failed to load plant details:", error);
        alert("Error loading plant details. See console.");
    }
}

// --- Task 2: Develop Disease Diagnosis Result Display ---
function renderDiseaseDiagnosis(data) {
    const diagnosisSection = document.getElementById('disease-diagnosis');
    // Assuming identification_data contains the identification result with health information
    const healthAssessment = data?.health_assessment; 

    if (healthAssessment?.is_healthy) {
        diagnosisSection.querySelector('h2').textContent = 'Health Status: Healthy ✅';
        diagnosisSection.innerHTML += '<p>The plant appears to be healthy based on the last scan.</p>';
        diagnosisSection.classList.remove('hidden');
    } else if (healthAssessment?.diseases?.length) {
        diagnosisSection.querySelector('h2').textContent = 'Diagnosis Found! ⚠️';
        const disease = healthAssessment.diseases[0];
        diagnosisSection.innerHTML += `
            <p><strong>Primary Issue:</strong> ${disease.name}</p>
            <p><strong>Confidence:</strong> ${(disease.confidence * 100).toFixed(1)}%</p>
            <p><strong>Treatment:</strong> ${disease.treatment_suggestions || 'Consult a local expert.'}</p>
        `;
        diagnosisSection.classList.remove('hidden');
    }
}


// --- Task 3: Reminder Management (GET, Log Event, Delete) ---
async function renderReminders() {
    const list = document.getElementById('reminders-list');
    list.innerHTML = '';
    
    try {
        const reminders = await fetchData(getPlantEndpoint('/reminders'));
        
        if (reminders.length === 0) {
            list.innerHTML = '<p>No reminders set for this plant yet.</p>';
            return;
        }

        reminders.forEach(r => {
            const isDue = new Date(r.next_due) <= new Date();
            const dueText = isDue ? `<span class="due-today">DUE NOW!</span>` : `Due: ${r.next_due}`;

            const item = document.createElement('div');
            item.className = 'task-item';
            item.innerHTML = `
                <span>${r.type.toUpperCase()} every ${r.frequency_days} days | ${dueText}</span>
                <div class="task-actions">
                    <button class="btn btn-sm btn-success complete-btn" data-id="${r.id}">Mark Complete</button>
                    <button class="btn btn-sm btn-danger delete-reminder-btn" data-id="${r.id}">Delete</button>
                </div>
            `;
            list.appendChild(item);
        });

        // Attach event listeners for completion and deletion
        list.querySelectorAll('.complete-btn').forEach(btn => 
            btn.addEventListener('click', logTaskCompletion)
        );
        list.querySelectorAll('.delete-reminder-btn').forEach(btn => 
            btn.addEventListener('click', deleteReminder)
        );

    } catch (error) {
        list.innerHTML = `<p class="error-message">Error loading reminders.</p>`;
    }
}

async function logTaskCompletion(e) {
    const reminderId = e.target.dataset.id;
    if (!confirm("Are you sure you want to mark this task as completed today?")) return;

    try {
        await fetchData(`/api/reminders/${reminderId}/complete`, { method: 'POST' });
        alert("Task logged successfully! New due date calculated.");
        renderReminders(); // Refresh the list
        // Note: You should also refresh the dashboard widget
    } catch (error) {
        alert(error.message);
    }
}

async function deleteReminder(e) {
    const reminderId = e.target.dataset.id;
    if (!confirm("Are you sure you want to delete this reminder?")) return;

    try {
        await fetchData(`/api/reminders/${reminderId}`, { method: 'DELETE' });
        alert("Reminder deleted.");
        renderReminders(); // Refresh the list
    } catch (error) {
        alert(error.message);
    }
}

// --- Task 4: Develop Growth Photo Upload Feature (Fetch & Save) ---
async function renderPhotos() {
    const gallery = document.getElementById('photo-gallery');
    gallery.innerHTML = '<p>Photo gallery feature not fully implemented (requires GET endpoint for photos).</p>'; 
    // You would need to add a GET /api/plants/:id/photos endpoint to the server
    // For now, we only implement the UPLOAD logic.
}

// --- Task 5: Handle Modals and Forms ---
document.addEventListener('DOMContentLoaded', () => {
    renderPlantDetails();

    // Reminder Modal Logic (Set Reminder Modal UI)
    const reminderModal = document.getElementById('reminder-modal');
    document.getElementById('set-reminder-btn').onclick = () => reminderModal.classList.remove('hidden');
    reminderModal.querySelectorAll('.close-modal').forEach(btn => 
        btn.onclick = () => reminderModal.classList.add('hidden')
    );
    
    // Photo Upload Modal Logic (Upload Photo Feature)
    const photoModal = document.getElementById('photo-upload-modal');
    document.getElementById('upload-photo-btn').onclick = () => photoModal.classList.remove('hidden');
    photoModal.querySelectorAll('.close-modal').forEach(btn => 
        btn.onclick = () => photoModal.classList.add('hidden')
    );

    // Form Submission: Set Reminder
    document.getElementById('reminder-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.plant_id = parseInt(plantId);

        try {
            await fetchData('/api/reminders', { 
                method: 'POST', 
                body: JSON.stringify(data) 
            });
            alert("New reminder set!");
            reminderModal.classList.add('hidden');
            renderReminders();
        } catch (error) {
            alert(error.message);
        }
    });

    // Form Submission: Upload Photo
    document.getElementById('photo-upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        try {
            await fetchData(getPlantEndpoint('/photos'), { 
                method: 'POST', 
                body: JSON.stringify(data) 
            });
            alert("Photo saved!");
            photoModal.classList.add('hidden');
            renderPhotos();
        } catch (error) {
            alert(error.message);
        }
    });
    
    // Plant Deletion
    document.getElementById('delete-plant-btn').addEventListener('click', async () => {
        if (!confirm("WARNING: Are you sure you want to delete this plant and all associated data?")) return;
        try {
            await fetchData(getPlantEndpoint(), { method: 'DELETE' });
            alert("Plant deleted successfully!");
            window.location.href = 'dashboard.html';
        } catch (error) {
            alert(error.message);
        }
    });
    
    // Plant Editing (Requires a modal/form, simplified here)
    document.getElementById('edit-plant-btn').addEventListener('click', () => {
        alert("Editing functionality requires a separate PATCH form/modal which is a client-side design task.");
        // Implement modal to PATCH /api/plants/:id
    });
});