// Serve the web application
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Todo List')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getTodos() {
  const userProperties = PropertiesService.getUserProperties();
  const todos = userProperties.getProperty('todos');
  return todos ? JSON.parse(todos) : [];
}

function saveTodos(todos) {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty('todos', JSON.stringify(todos));
}

function addTodo(text) {
  if (!text) {
    throw new Error('Todo text is required.');
  }
  const todos = getTodos();
  const newTodo = {
    id: Utilities.getUuid(),
    text,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  todos.push(newTodo);
  saveTodos(todos);
  return newTodo;
}

function toggleTodo(id) {
  const todos = getTodos();
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    saveTodos(todos);
    return todo;
  } else {
    throw new Error('Todo not found.');
  }
}

function deleteTodo(id) {
  let todos = getTodos();
  const initialLength = todos.length;
  todos = todos.filter(t => t.id !== id);
  if (todos.length === initialLength) {
      throw new Error('Todo not found to delete.');
  }
  saveTodos(todos);
  return { status: 'success', deleted: id };
};