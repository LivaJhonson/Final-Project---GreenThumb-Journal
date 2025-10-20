// /client/js/register.js
document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const messageElement = document.getElementById('message');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            messageElement.textContent = ''; 

            if (password !== confirmPassword) {
                messageElement.textContent = "Error: Passwords do not match!";
                messageElement.style.color = 'var(--error-red)';
                return;
            }

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    messageElement.style.color = 'var(--forest-green)';
                    messageElement.textContent = data.message + " Success!";
                    setTimeout(() => window.location.href = 'login.html', 1500); 
                } else {
                    messageElement.style.color = 'var(--error-red)';
                    messageElement.textContent = data.message;
                }
            } catch (error) {
                messageElement.style.color = 'var(--error-red)';
                messageElement.textContent = "Network error. Could not reach server.";
                console.error("Fetch error:", error);
            }
        });
    }
});