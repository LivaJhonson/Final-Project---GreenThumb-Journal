/**
 * client/js/register.js
 * Handles user registration via API submission.
 */

document.addEventListener('DOMContentLoaded', () => {
    // These IDs now correctly match the client/register.html file
    const registerForm = document.getElementById('register-form');
    const registerMessage = document.getElementById('register-message');

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
    }

    /**
     * Attempts to register a new user with the provided credentials.
     */
    async function handleRegistration(event) {
        event.preventDefault();
        
        const formData = new FormData(registerForm);
        const data = Object.fromEntries(formData.entries());

        registerMessage.textContent = 'Registering user...';
        registerMessage.className = 'form-message loading';

        // Basic client-side validation
        if (data.password !== data.confirm_password) {
            registerMessage.textContent = 'Error: Passwords do not match.';
            registerMessage.className = 'form-message error';
            return;
        }

        // NOTE: The API path must be corrected to match your server route: /api/register
        // Since your local-server.js uses app.post('/api/register', ...), we must change /api/auth/register to /api/register
        try {
            const response = await fetch('/api/register', { // <--- FIXED API PATH
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: data.email, 
                    password: data.password,
                })
            });

            const result = await response.json();

            if (response.ok) {
                registerMessage.textContent = 'Registration successful! Redirecting to login...';
                registerMessage.className = 'form-message success';
                
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            } else {
                registerMessage.textContent = `Registration failed: ${result.message || 'Server error.'}`;
                registerMessage.className = 'form-message error';
            }
        } catch (error) {
            console.error('Network error during registration:', error);
            registerMessage.textContent = 'A network error occurred. Please try again.';
            registerMessage.className = 'form-message error';
        }
    }
});