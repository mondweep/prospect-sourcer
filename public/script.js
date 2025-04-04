const form = document.getElementById('scrape-form');
const submitButton = document.getElementById('submit-button');
const statusLog = document.getElementById('status-log');

form.addEventListener('submit', async (event) => {
    event.preventDefault(); // Prevent default page reload
    submitButton.disabled = true;
    statusLog.textContent = 'Starting scraping process...\n';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        statusLog.textContent += 'Sending request to server...\n';
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        statusLog.textContent += `Server responded with status: ${response.status}\n`;

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        statusLog.textContent += '--------------------------\n';
        statusLog.textContent += `Scraping finished!\n`;
        statusLog.textContent += `Status: ${result.message}\n`;
        if (result.details) {
             statusLog.textContent += `Details: ${result.details}\n`;
        }
         if (result.error) {
             statusLog.textContent += `Error during process: ${result.error}\n`;
        }


    } catch (error) {
        console.error('Error submitting form:', error);
        statusLog.textContent += '--------------------------\n';
        statusLog.textContent += `Error: ${error.message}\n`;
    } finally {
        submitButton.disabled = false;
        statusLog.scrollTop = statusLog.scrollHeight; // Scroll to bottom
    }
});

function logStatus(message) {
    statusLog.textContent += `${new Date().toLocaleTimeString()}: ${message}\n`;
    statusLog.scrollTop = statusLog.scrollHeight; // Scroll to bottom
}

// Example of how backend might send updates (requires more setup like WebSockets)
// function handleServerUpdate(message) {
//     logStatus(message);
// }
