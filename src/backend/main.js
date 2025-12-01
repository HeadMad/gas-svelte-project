const HTML_FILE = 'index.html';

function doGet() {
  return HtmlService.createHtmlOutputFromFile(HTML_FILE)
  .setTitle('Todo List')
  .addMetaTag('viewport', 'user-scalable=no, width=device-width, initial-scale=1')
  .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

const _getStore = () => {
  const user = Session.getActiveUser().getEmail();
  const properties = PropertiesService.getUserProperties();
  const get = () => JSON.parse(properties.getProperty(user) || '[]');
  const set = (data) => properties.setProperty(user, JSON.stringify(data));
  return { get, set };
};

function getTasks() {
  return _getStore().get();
}

function addTask(text) {
  const store = _getStore();
  const tasks = store.get();
  const newTask = {
    id: Utilities.getUuid(),
    text,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  store.set([...tasks, newTask]);
  return newTask;
}

function updateTask(task) {
  const store = _getStore();
  const tasks = store.get();
  const index = tasks.findIndex((t) => t.id === task.id);
  if (index === -1) throw new Error('Task not found');
  tasks[index] = { ...tasks[index], ...task };
  store.set(tasks);
  return tasks[index];
}

function deleteTask(id) {
  const store = _getStore();
  const tasks = store.get();
  const newTasks = tasks.filter((t) => t.id !== id);
  if (tasks.length === newTasks.length) throw new Error('Task not found');
  store.set(newTasks);
  return true;
}