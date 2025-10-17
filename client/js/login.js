/**
 * client/js/login.js
 * Handles user login and stores the authentication token.
 */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    // CRITICAL FIX: The ID must be 'login-message' to match login.html
    const loginMessage = document.getElementById('login-message'); 

    // We only attach the listener if the form exists.
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    /**
     * Attempts to log in the user and stores the JWT on success.
     */
    async function handleLogin(event) {
        event.preventDefault();
        
        // This check is now redundant since it's done before attaching the listener,
        // but it's good practice to ensure the message element is ready.
        if (!loginMessage) {
            console.error("Login message element not found in HTML. Check the ID.");
            return; 
        }

        const formData = new FormData(loginForm);
        const data = Object.fromEntries(formData.entries());

        loginMessage.textContent = 'Logging in...';
        loginMessage.className = 'form-message loading';

        try {
            // The API path '/api/login' is correct based on your local-server.js
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.token) {
                // Login successful! Store the token and redirect.
                localStorage.setItem('authToken', result.token);
                
                loginMessage.textContent = 'Login successful! Redirecting...';
                loginMessage.className = 'form-message success';

                // Redirect to the main dashboard page
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 500);

            } else {
                // Handle API error response (e.g., invalid credentials from server)
                loginMessage.textContent = `Login failed: ${result.message || 'Invalid email or password.'}`;
                loginMessage.className = 'form-message error';
            }
        } catch (error) {
            console.error('Network error during login:', error);
            loginMessage.textContent = 'A network error occurred. Please check your connection.';
            loginMessage.className = 'form-message error';
        }
    }
});