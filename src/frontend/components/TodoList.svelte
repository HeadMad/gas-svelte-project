<script>
  import callServer from '../utils/callServer.js';
  import { fly } from 'svelte/transition';

  let tasks = $state([]);
  let loading = $state(true);
  let newTaskText = $state('');

  $effect(() => {
    loading = true;
    callServer('getTasks')
      .then((serverTasks) => {
        // Sort tasks by creation date
        tasks = serverTasks.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
      })
      .catch((err) => alert(`Error fetching tasks: ${err.message}`))
      .finally(() => {
        loading = false;
      });
  });

  async function addTask() {
    if (!newTaskText.trim()) return;

    const tempId = crypto.randomUUID();
    const text = newTaskText;

    // Optimistic UI update
    const newTask = {
      id: tempId,
      text,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    tasks = [...tasks, newTask];
    newTaskText = '';

    try {
      const savedTask = await callServer('addTask', text);
      // Replace temp task with the real one from the server
      const taskIndex = tasks.findIndex((t) => t.id === tempId);
      if (taskIndex !== -1) {
        tasks[taskIndex] = savedTask;
      }
    } catch (err) {
      alert(`Error adding task: ${err.message}`);
      // Revert on failure
      tasks = tasks.filter((t) => t.id !== tempId);
      newTaskText = text;
    }
  }

  async function toggleTask(task) {
    const updatedTask = { ...task, completed: !task.completed };
    const originalTask = task;

    // Optimistic UI update
    const taskIndex = tasks.findIndex((t) => t.id === task.id);
    if (taskIndex !== -1) {
      tasks[taskIndex] = updatedTask;
    }

    try {
      await callServer('updateTask', updatedTask);
    } catch (err) {
      alert(`Error updating task: ${err.message}`);
      // Revert on failure
      if (taskIndex !== -1) {
        tasks[taskIndex] = originalTask;
      }
    }
  }

  async function deleteTask(id) {
    const originalTasks = [...tasks];
    tasks = tasks.filter((t) => t.id !== id);
    try {
      await callServer('deleteTask', id);
    } catch (err) {
      alert(`Error deleting task: ${err.message}`);
      tasks = originalTasks;
    }
  }
</script>

<style>
  :global(body) {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    color: #333;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  main {
    max-width: 560px;
    margin: 4rem auto;
    padding: 2rem;
    background: white;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.07);
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    text-align: center;
    color: #222;
    margin-bottom: 2rem;
  }

  .add-task {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 2rem;
  }

  .add-task input {
    flex-grow: 1;
    padding: 0.75rem 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    font-size: 1rem;
    transition: box-shadow 0.2s, border-color 0.2s;
  }

  .add-task input:focus {
    outline: none;
    border-color: #4c82f7;
    box-shadow: 0 0 0 3px rgba(76, 130, 247, 0.2);
  }

  .add-task button {
    flex-shrink: 0;
    padding: 0.75rem 1.25rem;
    border: none;
    background-color: #2c6e49;
    color: white;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .add-task button:hover {
    background-color: #1e4d32;
  }

  .task-list {
    list-style: none;
    padding: 0;
  }

  .task-item {
    display: flex;
    align-items: center;
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid #f0f0f0;
    transition: background-color 0.2s;
  }
  
  .task-item:last-child {
      border-bottom: none;
  }

  .task-item.completed span {
    text-decoration: line-through;
    color: #999;
  }
  
  .checkbox {
    width: 20px;
    height: 20px;
    margin-right: 1rem;
    cursor: pointer;
    accent-color: #2c6e49;
  }

  .task-item span {
    flex-grow: 1;
    cursor: default;
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #aaa;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    transition: background-color 0.2s, color 0.2s;
  }

  .delete-btn:hover {
    background-color: #fce8e6;
    color: #c94a38;
  }
  
  .delete-btn svg {
      width: 18px;
      height: 18px;
  }

  .loading,
  .empty-state {
    text-align: center;
    color: #888;
    padding: 3rem 1rem;
    font-size: 1rem;
    background-color: #fcfcfc;
    border-radius: 10px;
  }
</style>

<main>
  <h1>Todo List</h1>

  <div class="add-task">
    <input
      type="text"
      placeholder="e.g. Learn Svelte 5"
      bind:value={newTaskText}
      onkeydown={(e) => e.key === 'Enter' && addTask()}
    />
    <button onclick={addTask}>Add Task</button>
  </div>

  {#if loading}
    <p class="loading">Loading tasks...</p>
  {:else if tasks.length === 0}
    <p class="empty-state">🎉<br /><br />All done! Add a new task to get started.</p>
  {:else}
    <ul class="task-list">
      {#each tasks as task (task.id)}
        <li
          class="task-item"
          class:completed={task.completed}
          in:fly={{ y: 20, duration: 300 }}
        >
          <input
            type="checkbox"
            class="checkbox"
            checked={task.completed}
            onchange={() => toggleTask(task)}
          />
          <span onclick={() => toggleTask(task)}>{task.text}</span>
          <button class="delete-btn" onclick={() => deleteTask(task.id)}>
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              ></path></svg
            >
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</main>
