# 📚 [Project Name] - Google Apps Script Library

> **[Project Name]** is a [Brief description: what it is and its purpose]. This library solves [problem description] by [solution/benefits description].

![License](https://img.shields.io/badge/license-MIT-blue.svg)![GAS](https://img.shields.io/badge/platform-Google%20Apps%20Script-green.svg)![Version](https://img.shields.io/badge/version-1.0.0-orange.svg)

<a name="toc"></a>
## 📖 Table of Contents

1. [🚀 Installation & Setup](#install)
2. [🚀 Quick Start](#quickstart)
3. [API: Core Methods](#core_methods)
4. [API: Helper Classes](#sub_methods)
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
Create a `.clasp.json` file in the project root:
```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "./dist"
}
```

### Scripts

| Command | Description |
| :--- | :--- |
| `npm run build` | Build the project into the `dist/` folder. |
| `npm run push` | Build + Push code to Google Drive. |
| `npm run deploy` | Full release cycle (Build -> Push -> Version). |

### Adding the library to your project:

1. Open your Google Apps Script project.
2. Click **Editor** → **Libraries** (`+` icon on the left).
3. Enter the Library Script ID: `[INSERT_LIBRARY_SCRIPT_ID]`
4. Click **Look up**.
5. Select the latest version.
6. Set "Identifier" to `[ShortName]` (e.g., `MyLib`).
7. Click **Add**.

---

<a name="quickstart"></a>
## 🚀 Quick Start
[menu](#toc) | [next](#core_methods) | [back](#install)

```javascript
function run() {
  // Initialization
  const app = MyLib.init();
  
  // Execute main method
  app.doSomething({
    option: 'value'
  });

  // Process results
  const result = app.process();
  Logger.log(result);
}
```

---

<a name="core_methods"></a>
## API: Core Methods [Main Class]
[menu](#toc) | [next](#sub_methods) | [back](#quickstart)

Description of static methods or main class methods.

### `init(config)`
The main entry point.
**Parameters:**
- `config` _(object)_ - Configuration object.

**Returns:** Instance of `Main` class.

```javascript
const app = MyLib.init({ debug: true });
```

### `methodName(arg1, arg2)`
Brief description of what the method does.
- `arg1` _(type)_ - Argument description.
- `arg2` _(type)_ - Argument description.
**Returns:** `Type`.

```javascript
app.methodName('value', 123);
```

---

<a name="sub_methods"></a>
## API: Helper Classes [Sub Class]
[menu](#toc) | [next](#data_methods) | [back](#core_methods)

Description of secondary class methods (if applicable).

### `subMethod(handler)`
Method description.
**Parameters:**
- `handler` _(function)_: Callback function.

**Returns:** `void`.

---

<a name="data_methods"></a>
## Data Structure
[menu](#toc) | [next](#examples) | [back](#sub_methods)

Description of data objects returned by the library or used internally.

### `Config` Object
```javascript
{
  key: "value", // Field description
  isEnabled: true // Field description
}
```

---

<a name="examples"></a>
## 💡 Usage Examples
[menu](#toc) | [next](#notes) | [back](#data_methods)

### 1. Basic Scenario
Description of the simplest usage scenario.

```javascript
function simpleUsage() {
  const lib = MyLib.init();
  lib.performAction();
}
```

### 2. Advanced Scenario (With Options)
Description of a more complex case.

```javascript
function advancedUsage() {
  const lib = MyLib.init();
  
  try {
    lib.complexMethod((item) => {
      return item.value > 10;
    });
  } catch (e) {
    Logger.log('Error: ' + e.message);
  }
}
```

### 3. Integration
Example of how the library works with Sheets, Gmail, or Forms.

```javascript
// Your code here
```

---

<a name="notes"></a>
## ⚠️ Important Notes
[menu](#toc) | [next](#tips) | [back](#examples)

1.  **Note 1**: Important nuance (e.g., Google API requirements).
2.  **Note 2**: Error handling behavior.
3.  **Authorization**: Required OAuth Scopes.

---

<a name="tips"></a>
## 🎯 Best Practices
[menu](#toc) | [next](#limits) | [back](#notes)

### Performance
Tips for optimizing code when using this library.

### Extensibility
How to add custom functionality or plugins.

---

<a name="limits"></a>
## 🐛 Known Limitations
[menu](#toc) | [back](#tips)

1.  **Google Quotas**: This library is subject to standard GAS quotas (runtime, URL Fetch, etc.).
2.  **Specific Limitation**: e.g., maximum file size or supported formats.