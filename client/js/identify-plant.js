// client/js/identify-plant.js

// 1. Get DOM elements
const identifyModal = document.getElementById('identify-modal');
const openModalBtn = document.getElementById('open-identify-modal-btn'); // Button on dashboard to open modal
const closeModalBtn = document.getElementById('close-identify-modal-btn');
const cancelIdentifyBtn = document.getElementById('cancel-identify-btn');
const identifyForm = document.getElementById('identify-form');
const uploadButton = document.getElementById('upload-button');
const imageInput = document.getElementById('plant-image-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const identifySubmitBtn = document.getElementById('identify-submit-btn');
const feedbackArea = document.getElementById('feedback-area');
const resultsArea = document.getElementById('identification-results');

let base64Image = null; // Variable to store the pre-processed image data

// --- Modal Functions ---
const showModal = () => {
    identifyModal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling the body
};

const hideModal = () => {
    identifyModal.classList.remove('active');
    document.body.style.overflow = '';
    // Reset form state when closing
    identifyForm.reset(); 
    identifyForm.classList.remove('hidden'); // Ensure form is visible on open
    imagePreviewContainer.classList.add('hidden');
    identifySubmitBtn.disabled = true;
    feedbackArea.textContent = '';
    resultsArea.classList.add('hidden');
    resultsArea.innerHTML = '';
    base64Image = null; // Clear image data
};

// --- Event Listeners for Modal Control ---
openModalBtn.addEventListener('click', showModal);
closeModalBtn.addEventListener('click', hideModal);
cancelIdentifyBtn.addEventListener('click', hideModal);

// Close modal if user clicks outside of it
identifyModal.addEventListener('click', (e) => {
    if (e.target === identifyModal) {
        hideModal();
    }
});


// --- Image Pre-processing (Convert to Base64) ---
// 1. Trigger the hidden file input when the styled button is clicked
uploadButton.addEventListener('click', () => {
    imageInput.click();
});

// 2. Handle file selection and conversion
imageInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
        // No file selected, reset state
        imagePreviewContainer.classList.add('hidden');
        identifySubmitBtn.disabled = true;
        base64Image = null;
        return;
    }

    const reader = new FileReader();

    reader.onloadend = () => {
        // Store the Base64 part only (remove the 'data:image/jpeg;base64,' prefix)
        base64Image = reader.result.split(',')[1]; 

        // Update the UI
        imagePreview.src = reader.result; // Display full string for preview
        imagePreviewContainer.classList.remove('hidden');
        identifySubmitBtn.disabled = false; // Enable the Identify button
        feedbackArea.textContent = 'Image ready for identification.';
    };

    // Read the file as a Data URL (which is a Base64 encoded string)
    reader.readAsDataURL(file);
});


// --- Plant.id Image Submission (Fetch to Server) ---
identifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!base64Image) {
        feedbackArea.textContent = 'Please upload an image first.';
        return;
    }

    // Disable button and show loading state
    identifySubmitBtn.disabled = true;
    feedbackArea.textContent = 'Identifying... please wait.';

    const authToken = localStorage.getItem('authToken');

    try {
        const response = await fetch('/api/identify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}` // IMPORTANT: Send the JWT
            },
            body: JSON.stringify({
                image_data: base64Image // Send the Base64 image data to your server endpoint
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Success: Display results
            feedbackArea.textContent = 'Identification complete!';
            displayIdentificationResults(data);
        } else {
            // Server or Plant.ID API error
            feedbackArea.textContent = data.message || 'Error: Could not identify the plant.';
            console.error('Identification API error:', data);
        }

    } catch (error) {
        feedbackArea.textContent = 'A network error occurred.';
        console.error('Network or client error:', error);
    } finally {
        // Only re-enable the button if we are still on the form view
        if (identifyForm.classList.contains('hidden') === false) {
             identifySubmitBtn.disabled = false;
        }
    }
});


// --- Display Results Function ---
const displayIdentificationResults = (data) => {
    // Hide the identification form and show the results area
    identifyForm.classList.add('hidden');
    resultsArea.classList.remove('hidden');

    let html = '<h4>Top Identification Results:</h4>';

    const topMatch = data.suggestions[0];

    if (topMatch) {
        // Plant.ID response structure:
        const commonName = topMatch.plant_details.common_names ? topMatch.plant_details.common_names[0] : 'Unknown';
        const scientificName = topMatch.plant_name;
        
        html += `<div class="identification-match">`;
        html += `<p><strong>Common Name:</strong> ${commonName}</p>`;
        html += `<p><strong>Scientific Name:</strong> <em>${scientificName}</em></p>`;
        html += `<p><strong>Probability:</strong> ${(topMatch.probability * 100).toFixed(2)}%</p>`;
        
        // Button to save the plant, storing the plant data in the button's data attributes
        html += `<button id="save-plant-btn" class="btn btn-success" 
                      data-name="${commonName}" 
                      data-scientific="${scientificName}">
                      Save to My Collection
                 </button>`;
        html += `</div>`;
    } else {
        html += `<p>No confident matches found. Please try a different photo.</p>`;
        identifyForm.classList.remove('hidden'); // Keep form visible if no results
    }

    resultsArea.innerHTML = html;
};


// --- Write Function: Save Plant to User Collection (WEEK 6) ---
resultsArea.addEventListener('click', async (e) => {
    // Check if the clicked element is the 'Save to My Collection' button
    if (e.target && e.target.id === 'save-plant-btn') {
        const saveBtn = e.target;
        
        // Retrieve the data stored in the button's data attributes
        const name = saveBtn.dataset.name;
        const scientificName = saveBtn.dataset.scientific;
        
        // Placeholder for the image URL. Using the image preview source temporarily.
        const imageUrl = imagePreview.src; 

        if (!name || !scientificName) {
            feedbackArea.textContent = 'Error: Missing plant data to save.';
            return;
        }

        // Disable button and show loading state
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        feedbackArea.textContent = `Saving ${name} to your collection...`;

        const authToken = localStorage.getItem('authToken');
        
        try {
            const response = await fetch('/api/plants', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}` // IMPORTANT: Send the JWT
                },
                body: JSON.stringify({
                    name: name,
                    scientific_name: scientificName,
                    common_name: name, 
                    image_url: imageUrl,
                    notes: `Identified on ${new Date().toLocaleDateString()}`
                })
            });

            const data = await response.json();

            if (response.ok) {
                feedbackArea.textContent = `${name} saved successfully!`;
                saveBtn.textContent = 'Saved! ✅';
                // Close the modal after a short delay
                setTimeout(() => {
                    hideModal();
                    // If the dashboard script is loaded, refresh the plant list
                    if (typeof loadUserPlants === 'function') {
                        loadUserPlants(); 
                    }
                }, 1500);
            } else {
                feedbackArea.textContent = data.message || 'Error: Failed to save plant.';
                saveBtn.textContent = 'Save Failed';
                saveBtn.disabled = false;
            }
        } catch (error) {
            feedbackArea.textContent = 'A network error occurred while saving.';
            console.error('Network error saving plant:', error);
            saveBtn.textContent = 'Save Failed';
            saveBtn.disabled = false;
        }
    }
}); 