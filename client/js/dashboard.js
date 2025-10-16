// client/js/dashboard.js

// --- 1. DOM Elements (UPDATED to match new dashboard.html IDs) ---
const logoutBtn = document.getElementById('logout-btn');
// Correct ID for the plant cards container
const myPlantsContainer = document.getElementById('my-plants-container'); 
// Correct ID for the tasks list container
const todayTasksContainer = document.getElementById('today-tasks-list'); 

// --- 2. Authentication Check & Initialization ---

// Function to check if the user is authenticated (token exists)
const checkAuth = () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        // If no token, redirect to login page
        window.location.href = 'login.html';
    } else {
        // If authenticated, load the user's plants and tasks
        loadUserPlants();
        loadDueReminders(); 
    }
};

// --- 3. Logout Functionality ---
logoutBtn.addEventListener('click', () => {
    // Clear the JWT from local storage
    localStorage.removeItem('authToken');
    // Redirect back to the login page
    window.location.href = 'login.html';
});

// ----------------------------------------------------------------------
// --- WEEK 6: Plant Collection Features ---
// ----------------------------------------------------------------------

// --- 4. Develop 'My Plants' Dashboard Card View (Read All) ---
const loadUserPlants = async () => {
    const authToken = localStorage.getItem('authToken');
    
    // Use the placeholder class for a cleaner loading state
    myPlantsContainer.innerHTML = '<div class="placeholder-text">Loading your plants...</div>';

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
            // Use the placeholder-text class for error styling
            myPlantsContainer.innerHTML = '<div class="placeholder-text">Error loading plants: ' + (plants.message || 'Authentication failed.') + '</div>';
            if (response.status === 401 || response.status === 403) {
                // If authentication fails, force logout
                logoutBtn.click();
            }
        }
    } catch (error) {
        console.error('Network error fetching plants:', error);
        myPlantsContainer.innerHTML = '<div class="placeholder-text">Network error. Could not connect to the server.</div>';
    }
};

// Function to dynamically create and display the plant cards
const renderPlantCards = (plants) => {
    // Empty the container before adding content
    myPlantsContainer.innerHTML = '';
    
    if (plants.length === 0) {
        myPlantsContainer.innerHTML = '<div class="placeholder-text">You haven\'t added any plants yet. Use the "Add New Plant / Identify" button to get started!</div>';
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
                    <button class="btn btn-small btn-info view-details-btn" data-id="${plant.id}">Details</button>
                    <button class="btn btn-small btn-danger delete-plant-btn" data-id="${plant.id}">Delete</button>
                </div>
            </div>
        </div>
    `).join('');

    myPlantsContainer.innerHTML = cardsHtml; 

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
            loadDueReminders(); 
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


// ----------------------------------------------------------------------
// --- WEEK 7: Scheduling / Today's Tasks Widget ---
// ----------------------------------------------------------------------

// Function to fetch due/overdue reminders
const loadDueReminders = async () => {
    const authToken = localStorage.getItem('authToken');
    // Use the placeholder class for a cleaner loading state
    todayTasksContainer.innerHTML = '<div class="placeholder-text">Checking for due tasks...</div>';

    try {
        const response = await fetch('/api/reminders/due', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const reminders = await response.json();

        if (response.ok) {
            renderDueReminders(reminders);
        } else {
            // Use the placeholder-text class for error styling
            todayTasksContainer.innerHTML = '<div class="placeholder-text">Error loading tasks: ' + (reminders.message || 'Server error.') + '</div>';
        }

    } catch (error) {
        console.error('Network error fetching reminders:', error);
        todayTasksContainer.innerHTML = '<div class="placeholder-text">Network error. Could not connect to the server.</div>';
    }
};

// Function to render the due reminders list
const renderDueReminders = (reminders) => {
    // Empty the container before adding content
    todayTasksContainer.innerHTML = ''; 

    if (reminders.length === 0) {
        todayTasksContainer.innerHTML = '<div class="placeholder-text">🎉 Everything is up to date! 🎉</div>';
        return;
    }

    const tasksHtml = reminders.map(r => {
        // Determine if it's overdue
        const today = new Date().toISOString().split('T')[0];
        const isOverdue = r.next_due < today;
        const statusClass = isOverdue ? 'task-overdue' : 'task-due';
        const statusText = isOverdue ? `OVERDUE (Due ${r.next_due})` : `DUE TODAY`;

        return `
            <div class="task-item ${statusClass}" data-reminder-id="${r.reminder_id}">
                <div class="task-details">
                    <p class="task-name">
                        <i class="fas fa-seedling"></i> <strong>${r.type.toUpperCase()}</strong>: ${r.plant_name}
                    </p>
                    <p class="task-status">${statusText}</p>
                </div>
                <div class="task-actions">
                    <button class="btn btn-small btn-success complete-task-btn" data-id="${r.reminder_id}" data-plant-id="${r.plant_id}">Done</button>
                    <button class="btn btn-small btn-link task-view-btn" data-id="${r.plant_id}">View Plant</button>
                </div>
            </div>
        `;
    }).join('');

    todayTasksContainer.innerHTML = tasksHtml;

    // Add event listeners for the new task buttons
    addReminderEventListeners();
};

// Function to handle completing a reminder
const completeReminder = async (reminderId, plantId) => {
    const authToken = localStorage.getItem('authToken');

    try {
        const response = await fetch(`/api/reminders/${reminderId}/complete`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            alert('Task logged as complete! Next due date calculated.');
            loadDueReminders(); // Refresh the list of due tasks
        } else {
            const data = await response.json();
            alert('Failed to complete task: ' + (data.message || 'Server error.'));
        }
    } catch (error) {
        console.error('Network error completing task:', error);
        alert('Network error. Could not log the task completion.');
    }
};

// ----------------------------------------------------------------------
// --- 8. Event Listeners ---
// ----------------------------------------------------------------------

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

// Listener for Reminder buttons
const addReminderEventListeners = () => {
    // Listener for Complete buttons
    document.querySelectorAll('.complete-task-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const reminderId = e.target.dataset.id;
            const plantId = e.target.dataset.plantId;
            completeReminder(reminderId, plantId);
        });
    });

    // Listener for View Plant buttons
    document.querySelectorAll('.task-view-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const plantId = e.target.dataset.id;
            viewPlantDetails(plantId);
        });
    });
};


// --- Modal Handlers for "Identify New Plant" button ---
document.addEventListener('DOMContentLoaded', () => {
    const openModalBtn = document.getElementById('open-identify-modal-btn');
    const modal = document.getElementById('identify-modal');
    // Note: ID in HTML was 'close-modal-btn', but using the more specific ID from the last update
    const closeModalBtn = document.getElementById('close-identify-modal-btn'); 
    const cancelBtn = document.getElementById('cancel-identify-btn');

    if (openModalBtn && modal) {
        openModalBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            document.body.classList.add('modal-open'); // Stops body scroll
        });
    }

    if (closeModalBtn && modal) {
        closeModalBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-open');
        });
    }

    if (cancelBtn && modal) {
        cancelBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-open');
        });
    }
});


// --- 9. Initial Call ---
// Call checkAuth when the dashboard page loads
document.addEventListener('DOMContentLoaded', checkAuth);

// Make this function globally accessible so identify-plant.js can call it to refresh the list
window.loadUserPlants = loadUserPlants;
window.loadDueReminders = loadDueReminders;