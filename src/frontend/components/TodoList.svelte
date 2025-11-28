<script>
  import { onMount } from 'svelte';
  import { callServer } from '../utils/index.js';

  let todos = [];
  let newTodoText = '';
  let isLoading = true;
  let errorMessage = '';

  onMount(async () => {
    await loadTodos();
  });

  async function loadTodos() {
    isLoading = true;
    errorMessage = '';
    try {
      todos = await callServer.getTodos();
      todos.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } catch (err) {
      errorMessage = 'Error loading tasks: ' + err.message;
    } finally {
      isLoading = false;
    }
  }

  async function handleAddTodo() {
    if (!newTodoText.trim()) return;
    
    const tempId = `temp-${Date.now()}`;
    const optimisticTodo = { id: tempId, text: newTodoText, completed: false, createdAt: new Date().toISOString() };
    todos = [...todos, optimisticTodo];
    
    const textToAdd = newTodoText;
    newTodoText = '';

    try {
      const savedTodo = await callServer.addTodo(textToAdd);
      // Replace optimistic todo with the real one from the server
      todos = todos.map(t => t.id === tempId ? savedTodo : t);
    } catch (err) {
      errorMessage = 'Error adding task: ' + err.message;
      // Rollback optimistic update
      todos = todos.filter(t => t.id !== tempId);
    }
  }

  async function handleToggleTodo(id, completed) {
    // Optimistic UI update
    todos = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    try {
      await callServer.toggleTodo(id);
    } catch (err) {
      errorMessage = 'Error updating task: ' + err.message;
      // Rollback optimistic update
      todos = todos.map(t => t.id === id ? { ...t, completed } : t);
    }
  }

  async function handleDeleteTodo(id) {
    const originalTodos = todos;
    // Optimistic UI update
    todos = todos.filter(t => t.id !== id);
    try {
      await callServer.deleteTodo(id);
    } catch (err) {
      errorMessage = 'Error deleting task: ' + err.message;
      // Rollback optimistic update
      todos = originalTodos;
    }
  }
</script>

<main>
  <h1>My Todo List</h1>

  <form on:submit|preventDefault={handleAddTodo} class="add-form">
    <input type="text" placeholder="Add a new task..." bind:value={newTodoText} />
    <button type="submit" disabled={!newTodoText.trim()}>+ Add</button>
  </form>

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}

  {#if isLoading && todos.length === 0}
    <p class="loading">Loading tasks...</p>
  {:else if todos.length === 0}
    <p class="empty-state">No tasks yet. Add one to get started!</p>
  {:else}
    <ul class="todo-list">
      {#each todos as todo (todo.id)}
        <li class:completed={todo.completed}>
          <span class="checkbox" on:click={() => handleToggleTodo(todo.id, todo.completed)}>
            {#if todo.completed}✓{/if}
          </span>
          <span class="text">{todo.text}</span>
          <button class="delete-btn" on:click={() => handleDeleteTodo(todo.id)}>✕</button>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background-color: #f4f7f9;
    color: #333;
    margin: 0;
  }

  main {
    max-width: 500px;
    margin: 2rem auto;
    padding: 1rem 2rem 2rem;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }

  h1 {
    text-align: center;
    color: #2c3e50;
    font-weight: 300;
    margin-bottom: 1.5rem;
  }

  .add-form {
    display: flex;
    margin-bottom: 1.5rem;
  }

  .add-form input {
    flex-grow: 1;
    border: 1px solid #dfe6e9;
    padding: 0.8rem;
    font-size: 1rem;
    border-radius: 6px 0 0 6px;
    outline: none;
  }
   .add-form input:focus {
     border-color: #007bff;
   }

  .add-form button {
    border: none;
    background-color: #007bff;
    color: white;
    padding: 0 1.5rem;
    font-size: 1rem;
    cursor: pointer;
    border-radius: 0 6px 6px 0;
  }
   .add-form button:disabled {
      background-color: #b2bec3;
      cursor: not-allowed;
   }
  
  .error {
      color: #d93025;
      text-align: center;
  }
  
  .loading, .empty-state {
      text-align: center;
      color: #636e72;
      padding: 2rem 0;
  }

  .todo-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .todo-list li {
    display: flex;
    align-items: center;
    padding: 0.75rem 0.25rem;
    border-bottom: 1px solid #f0f0f0;
    transition: background-color 0.2s;
  }
  
   .todo-list li:last-child {
       border-bottom: none;
   }
   
   .todo-list li.completed .text {
       text-decoration: line-through;
       color: #b2bec3;
   }
   
   .checkbox {
       width: 24px;
       height: 24px;
       border: 2px solid #b2bec3;
       border-radius: 50%;
       margin-right: 1rem;
       cursor: pointer;
       display: flex;
       align-items: center;
       justify-content: center;
       font-weight: bold;
       color: #fff;
   }
   
   .completed .checkbox {
       background-color: #28a745;
       border-color: #28a745;
   }

   .text {
       flex-grow: 1;
       line-height: 1.4;
   }
   
   .delete-btn {
       background: transparent;
       border: none;
       color: #fd79a8;
       font-size: 1.2rem;
       cursor: pointer;
       opacity: 0;
       transition: opacity 0.2s;
   }
   
   .todo-list li:hover .delete-btn {
       opacity: 1;
   }

</style>
