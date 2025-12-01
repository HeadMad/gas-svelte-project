# 🌐 [Project Name] - Google Apps Script Web Application

> **[Project Name]** is a [Brief description: what it is and its purpose]. This web application provides [solution/benefits description] via a user-friendly interface.

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![GAS](https://img.shields.io/badge/platform-Google%20Apps%20Script-green.svg) ![Version](https://img.shields.io/badge/version-1.0.0-orange.svg)

<a name="toc"></a>
## 📖 Table of Contents


1. [🚀 Installation & Setup](#install)
2. [🚀 Quick Start](#quickstart)
3. [Backend API: Server Functions](#backend_api)
4. [Frontend: Client-Side Interaction](#frontend_interaction)
5. [Data Structure](#data_methods)
6. [💡 Usage Examples](#examples)
7. [⚠️ Important Notes](#notes)
8. [🎯 Best Practices](#tips)
9. [🐛 Known Limitations](#limits)

---

<a name="install"></a>
## 🚀 Installation & Setup
[menu](#toc) | [next](#quickstart) | [back](#toc)

### Install Dependencies

```bash
npm install
```

### Configure Clasp (For local development)

Install Clasp globally and login:
```bash
npm install -g @google/clasp
clasp login
```

### Link to Google Project
Create a `.clasp.json` file in the project root. This links your local project to your Google Apps Script project.
```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "./dist"
}
```

### Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Run dev server for editing frontend (HTML, Svelte) files with live reload. |
| `npm run build` | Build the project (frontend and backend) into the `dist/` folder. |
| `npm run push` | Build + Push `dist/Code.js` and `dist/*.html` files to Google Apps Script. |
| `npm run deploy` | Full release cycle: Build -> Push code to GAS -> Create a new web app deployment version. |

### Options

The build process can be configured via `build.config.json`.

| Option | Type | Description | Default |
| :--- | :--- | :--- | :--- |
| `manifest` | `string` | Path to the manifest file (`appsscript.json`). | `src/appsscript.json` |
| `package` | `string` | Path to `package.json`. | `./package.json` |
| `outDir` | `string` | The output directory for the build. | `dist` |
| `frontend.build` | `boolean` | If `true`, builds the frontend. | `true` |
| `frontend.src`| `string` | Source directory for the frontend. | `src/frontend` |
| `frontend.minify` | `boolean` | If `true`, minifies the frontend code. | `true` |
| `backend.build` | `boolean` | If `true`, builds the backend. | `true` |
| `backend.src` | `string` | Source directory for the backend. | `src/backend` |
| `backend.concatenate`| `boolean`| If `true`, concatenates backend files. | `true` |
| `backend.outFile`| `string` | Name of the concatenated output file. | `Code.js` |
| `backend.minify` | `boolean` | If `true`, minifies the backend code. | `true` |
| `backend.priorityOrder`| `string[]`| Array of files to be included first. | `[]` |
| `deployment.devDeploymentId` | `string` | Deployment ID for the dev environment (web app URL). | "" |
| `deployment.prodDeploymentId` | `string` | Deployment ID for the production environment (web app URL). | "" |

---

<a name="quickstart"></a>
## 🚀 Quick Start
[menu](#toc) | [next](#backend_api) | [back](#install)

To get your web application up and running:

1.  **Configure `.clasp.json`**: Ensure `scriptId` is set to your Google Apps Script project ID.
2.  **Deploy**: Run `npm run deploy`. This will build your project, push the code to Google Apps Script, and create a new web app deployment.
3.  **Access Web App**:
    *   After deployment, clasp will output the URL for your web app.
    *   Alternatively, go to your Google Apps Script project, click "Deploy" -> "Manage deployments", and find the URL for the deployed web app.

You can then open this URL in your browser to interact with the web application.

```javascript
// Example of a basic server-side function to serve the web app
function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('[Project Name] Web App')
      .setFaviconUrl('https://www.google.com/favicon.ico'); // Optional
}

// Example of a client-side call to a server function
// In your frontend JavaScript:
/*
google.script.run
  .withSuccessHandler(function(response) {
    console.log("Server response:", response);
  })
  .withFailureHandler(function(error) {
    console.error("Server error:", error);
  })
  .myServerFunction('someClientData');
*/
```

---

<a name="backend_api"></a>
## Backend API: Server Functions
[menu](#toc) | [next](#frontend_interaction) | [back](#quickstart)

These are the Google Apps Script functions executed on the server, typically called by the frontend via `google.script.run`.

### `doGet(e)` / `doPost(e)`
The main entry points for web app requests.
**Parameters:**
- `e` _(object)_ - Event object containing request parameters.

**Returns:** `HtmlOutput` or other content based on the request.

```javascript
function doGet(e) {
  // Handle GET requests, usually serving the main HTML file
  return HtmlService.createTemplateFromFile('index').evaluate();
}

function doPost(e) {
  // Handle POST requests, e.g., form submissions or API calls
  Logger.log('Received POST request data: ' + JSON.stringify(e.postData.contents));
  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
}
```

### `myServerFunction(arg1, arg2)`
Brief description of what this server-side function does.
- `arg1` _(type)_ - Argument description.
- `arg2` _(type)_ - Argument description.
**Returns:** `Type` (data returned to the client).

```javascript
function myServerFunction(clientData) {
  Logger.log('Client called myServerFunction with: ' + clientData);
  // Perform some server-side logic
  return "Data from server: " + clientData.toUpperCase();
}
```

---

<a name="frontend_interaction"></a>
## Frontend: Client-Side Interaction
[menu](#toc) | [next](#data_methods) | [back](#backend_api)

This section describes how the client-side (HTML, JavaScript, Svelte) interacts with the Google Apps Script backend and handles user input.

### `callServer(functionName, ...args)` (Utility function for `google.script.run`)
Method description.
**Parameters:**
- `functionName` _(string)_: Name of the server-side function to call.
- `...args` _(any)_: Arguments to pass to the server function.

**Returns:** `Promise` that resolves with the server's response.

```javascript
// Example using a utility wrapper around google.script.run
// (e.g., src/frontend/utils/callServer.js)
// In your client-side JavaScript:
// import { callServer } from './utils/callServer.js';

/*
callServer('myServerFunction', 'Hello from client!')
  .then(response => {
    document.getElementById('output').innerText = response;
  })
  .catch(error => {
    console.error('Error calling server function:', error);
  });
*/
```

---

<a name="data_methods"></a>
## Data Structure
[menu](#toc) | [next](#examples) | [back](#frontend_interaction)

Description of data objects typically passed between the frontend and backend, or used internally.

### `ClientToServerRequest` Object
```javascript
{
  action: "performAction", // Describes the action requested
  payload: {
    key: "value", // Data associated with the action
    id: 123
  }
}
```

### `ServerToClientResponse` Object
```javascript
{
  status: "success", // or "error"
  message: "Operation completed successfully.",
  data: {
    result: true // Any data returned by the server
  }
}
```

---

<a name="examples"></a>
## 💡 Usage Examples
[menu](#toc) | [next](#notes) | [back](#data_methods)

### 1. Basic Frontend to Backend Call
Description of how the frontend sends a simple request to the backend and handles the response.

```javascript
// In frontend JavaScript (e.g., in a Svelte component or index.html script)
function fetchGreeting() {
  google.script.run
    .withSuccessHandler(function(greeting) {
      document.getElementById('greeting-display').innerText = greeting;
    })
    .withFailureHandler(function(error) {
      console.error('Error fetching greeting:', error.message);
    })
    .getGreeting('World'); // Calls a server-side function named 'getGreeting'
}

// Corresponding server-side function (Code.js)
function getGreeting(name) {
  return 'Hello, ' + name + '! From the server.';
}
```

### 2. Form Submission with Data
Description of how to handle form submissions, sending data to the backend.

```html
<!-- In index.html or a Svelte component template -->
<form id="dataForm">
  <input type="text" id="nameInput" placeholder="Your Name">
  <button type="submit">Submit</button>
</form>

<script>
  document.getElementById('dataForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('nameInput').value;
    google.script.run
      .withSuccessHandler(function(response) {
        alert(response);
      })
      .withFailureHandler(function(error) {
        console.error('Form submission error:', error.message);
      })
      .processFormData(name); // Calls a server-side function 'processFormData'
  });
</script>

```
```javascript
// Corresponding server-side function (Code.js)
function processFormData(name) {
  Logger.log('Received form data - Name: ' + name);
  // Process the data, e.g., write to a Sheet
  return 'Thank you, ' + name + '! Your data has been processed.';
}
```

### 3. Integration with Google Services (e.g., Google Sheets)
Example of how the web app interacts with other Google Services.

```javascript
// Server-side function (Code.js) to read data from a Google Sheet
function getDataFromSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getDataRange();
  const values = range.getValues();
  return values;
}

// Client-side JavaScript to display the data
/*
google.script.run
  .withSuccessHandler(function(data) {
    const outputDiv = document.getElementById('sheet-data');
    outputDiv.innerHTML = '<h2>Data from Sheet:</h2>';
    data.forEach(row => {
      outputDiv.innerHTML += `<p>${row.join(', ')}</p>`;
    });
  })
  .withFailureHandler(function(error) {
    console.error('Error fetching sheet data:', error.message);
  })
  .getDataFromSheet();
*/
```

---

<a name="notes"></a>
## ⚠️ Important Notes
[menu](#toc) | [next](#tips) | [back](#examples)

1.  **Note 1**: Important nuance (e.g., Google API requirements, such as enabling specific APIs in Google Cloud Project).
2.  **Note 2**: Error handling behavior (both client-side and server-side should be robust).
3.  **Authorization**: Required OAuth Scopes for your web application. Ensure `appsscript.json` lists all necessary scopes for the services your app accesses (e.g., `https://www.googleapis.com/auth/spreadsheets`). These are automatically determined by Google, but it's good practice to review them.

---

<a name="tips"></a>
## 🎯 Best Practices
[menu](#toc) | [next](#limits) | [back](#notes)

### Performance
Tips for optimizing your web app, including minimizing client-server calls, efficient data processing on the backend, and optimizing frontend assets.

### Security
Recommendations for securing your web app, e.g., input validation on both frontend and backend, avoiding sensitive data exposure, and proper authentication.

### Extensibility
How to structure your project for easier maintenance and future feature additions (e.g., modular backend functions, reusable frontend components).

---

<a name="limits"></a>
## 🐛 Known Limitations
[menu](#toc) | [back](#tips)

1.  **Google Quotas**: This web application is subject to standard GAS quotas (e.g., script runtime, URL Fetch calls, total triggers).
2.  **Specific Limitation**: e.g., maximum payload size for `google.script.run`, browser compatibility issues, or limitations of certain Google services.
