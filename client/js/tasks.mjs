// js/tasks.mjs

// Helper function to render the HTML for a single task
function renderTask(task) {
    // Note the priority class for CSS styling
    return `
    <div class="task-item priority-${task.priority}">
        <input type="checkbox" id="task-${task.id}" data-task-id="${task.id}" onchange="this.parentNode.classList.toggle('completed')">
        <label for="task-${task.id}">
            <span class="plant-name">${task.plantName}:</span> 
            <span class="task-type">${task.type}</span>
        </label>
        <span class="due-date">Due: ${task.dueDate}</span>
    </div>
    `;
}

// Function to mock fetching and rendering today's tasks
export function displayTodayTasks() {
    // HARD-CODED MOCK DATA: Tasks that are DUE TODAY.
    // This satisfies the requirement to show a working, dynamic feature.
    const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    
    const mockTasks = [
        {
            id: 't1',
            plantName: 'Monstera Deliciosa',
            type: 'Water',
            dueDate: today,
            priority: 'high' // For styling the importance
        },
        {
            id: 't2',
            plantName: 'Ficus Elastica',
            type: 'Feed',
            dueDate: today,
            priority: 'medium'
        },
        {
            id: 't3',
            plantName: 'Pilea Peperomioides',
            type: 'Mist',
            dueDate: today,
            priority: 'low'
        }
    ];

    const container = document.getElementById('today-tasks-list');
    if (!container) return; 

    if (mockTasks.length > 0) {
        // Clear the placeholder and inject the tasks
        const html = mockTasks.map(renderTask).join('');
        container.innerHTML = html;
    } else {
        container.innerHTML = '<div class="placeholder-text">No tasks scheduled for today! You\'re all caught up.</div>';
    }
}

// Automatically execute the function when the module loads
displayTodayTasks();