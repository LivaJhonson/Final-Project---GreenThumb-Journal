// /client/js/login.js



document.addEventListener('DOMContentLoaded', () => {

    const loginForm = document.getElementById('login-form');

    const messageElement = document.getElementById('message');



    if (loginForm) {

        loginForm.addEventListener('submit', async (e) => {

            // *** CRITICAL FIX: PREVENT PAGE RELOAD ***

            e.preventDefault();



            const email = document.getElementById('email').value;

            const password = document.getElementById('password').value;

           

            messageElement.textContent = '';

           

            try {

                const response = await fetch('/api/login', {

                    method: 'POST',

                    headers: { 'Content-Type': 'application/json' },

                    body: JSON.stringify({ email, password })

                });



                const data = await response.json();



                if (response.ok) {

                    // *** CRITICAL STEP 1: VERIFY AND SAVE THE TOKEN ***

                    if (data.token) {

                        localStorage.setItem('authToken', data.token);

                       

                        messageElement.style.color = 'var(--forest-green)';

                        messageElement.textContent = "Login successful! Redirecting...";

                       

                        // *** CRITICAL STEP 2: REDIRECT TO DASHBOARD ***

                        setTimeout(() => window.location.href = 'dashboard.html', 500);

                    } else {

                        // This case means the server response was 200 OK but the token was missing

                        messageElement.style.color = 'var(--error-red)';

                        messageElement.textContent = "Server response error: Token missing.";

                    }



                } else {

                    // Handle non-200 responses (e.g., 401 Unauthorized)

                    messageElement.style.color = 'var(--error-red)';

                    messageElement.textContent = data.message || "Login failed. Check email and password.";

                }



            } catch (error) {

                messageElement.style.color = 'var(--error-red)';

                messageElement.textContent = "Network error. Could not reach server.";

                console.error("Fetch error:", error);

            }

        });

    }

});