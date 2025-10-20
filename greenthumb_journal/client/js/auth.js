// client/js/auth.js

// --- 1. Get DOM Elements ---
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authMessage = document.getElementById('auth-message'); // Used for both login and register messages
const loginButton = document.getElementById('login-btn');
const registerButton = document.getElementById('register-btn');


// --- 2. Utility Functions ---

/**
 * Helper to display feedback messages to the user.
 * @param {string} message The text content of the message.
 * @param {string} type 'success' or 'error' for styling.
 */
const showMessage = (message, type) => {
    if (!authMessage) return;
    authMessage.textContent = message;
    authMessage.className = `auth-message ${type}`;
};

/**
 * Handles toggling the disabled state of buttons during submission.
 * @param {boolean} disabled True to disable, False to enable.
 */
const toggleButtons = (disabled) => {
    if (loginButton) loginButton.disabled = disabled;
    if (registerButton) registerButton.disabled = disabled;
};


// --- 3. Registration Handler ---

const handleRegister = async (event) => {
    event.preventDefault();

    if (!registerForm) return;
    
    const formData = new FormData(registerForm);
    const data = Object.fromEntries(formData.entries());

    // Basic password confirmation check
    if (data.password !== data.confirm_password) {
        showMessage('Passwords do not match.', 'error');
        return;
    }

    if (!data.username || !data.password || !data.email) {
        showMessage('All fields are required.', 'error');
        return;
    }
    
    // Disable UI and show loading message
    toggleButtons(true);
    showMessage('Registering user...', 'loading');

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            showMessage('Registration successful! Redirecting to login...', 'success');
            // If the user is on the register page, redirect them to login
            setTimeout(() => {
                window.location.href = 'login.html'; 
            }, 1500);
        } else {
            // Display server-side error message
            showMessage(result.message || 'Registration failed. Please try again.', 'error');
            toggleButtons(false);
        }
    } catch (error) {
        console.error('Network error during registration:', error);
        showMessage('A network error occurred. Please check your connection.', 'error');
        toggleButtons(false);
    }
};


// --- 4. Login Handler ---

const handleLogin = async (event) => {
    event.preventDefault();

    if (!loginForm) return;

    const formData = new FormData(loginForm);
    const data = Object.fromEntries(formData.entries());

    if (!data.username || !data.password) {
        showMessage('Username and password are required.', 'error');
        return;
    }

    // Disable UI and show loading message
    toggleButtons(true);
    showMessage('Logging in...', 'loading');

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok && result.token) {
            // IMPORTANT: Store the JWT token securely (in localStorage for simplicity)
            localStorage.setItem('authToken', result.token); 
            
            showMessage('Login successful! Redirecting...', 'success');
            
            // Redirect to the dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html'; 
            }, 500);

        } else {
            // Display server-side error message (e.g., Invalid credentials)
            showMessage(result.message || 'Login failed. Invalid credentials.', 'error');
            toggleButtons(false);
        }
    } catch (error) {
        console.error('Network error during login:', error);
        showMessage('A network error occurred. Please check your connection.', 'error');
        toggleButtons(false);
    }
};


// --- 5. Logout Function (for header/dashboard) ---

/**
 * Clears the JWT token and redirects the user to the login page.
 */
window.logout = () => {
    localStorage.removeItem('authToken');
    // Clear any user-specific cached data if necessary
    // localStorage.removeItem('userPlants'); 
    
    // Redirect to login page
    window.location.href = 'login.html';
};


// --- 6. Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    // Check if the user is on the login page
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    } 
    
    // Check if the user is on the register page
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    // Attach logout functionality to the logout button in the header (if present)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', window.logout);
    }
});