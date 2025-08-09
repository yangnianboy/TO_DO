const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// 创建浏览器窗口
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 300,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: false,
    backgroundColor: '#00000000',
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    transparent: true,
    hasShadow: true,
    vibrancy: 'light',
    movable: true,
    minimizable: true,
    closable: true
  });

  mainWindow.loadFile('index.html');
}

// 应用程序生命周期
app.whenReady().then(async () => {
  // 初始化数据存储
  await initializeDataStorage();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 数据存储相关函数
const dataDir = path.join(os.homedir(), '.todo-app');
const dataFile = path.join(dataDir, 'todos.json');

// 初始化数据存储
async function initializeDataStorage() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    // 检查数据文件是否存在
    try {
      await fs.access(dataFile);
    } catch {
      // 文件不存在，创建默认文件
      await fs.writeFile(dataFile, '[]', 'utf8');
    }
  } catch (error) {
    console.error('Failed to initialize data storage:', error);
  }
}

// 读取待办事项数据
async function readTodos() {
  try {
    const data = await fs.readFile(dataFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to read todos:', error);
    return [];
  }
}

// 写入待办事项数据
async function writeTodos(todos) {
  try {
    await fs.writeFile(dataFile, JSON.stringify(todos, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to write todos:', error);
  }
}

// IPC处理函数
const ipcHandlers = {
  // 待办事项操作
  'get-todos': async () => {
    return await readTodos();
  },
  
  'add-todo': async (event, todo) => {
    const todos = await readTodos();
    const newTodo = {
      id: Date.now(),
      text: todo.text,
      completed: false,
      createdAt: new Date().toISOString()
    };
    todos.push(newTodo);
    await writeTodos(todos);
    return newTodo;
  },
  
  'update-todo': async (event, updatedTodo) => {
    const todos = await readTodos();
    const index = todos.findIndex(todo => todo.id === updatedTodo.id);
    if (index !== -1) {
      todos[index] = updatedTodo;
      await writeTodos(todos);
    }
    return updatedTodo;
  },
  
  'delete-todo': async (event, id) => {
    const todos = await readTodos();
    const filteredTodos = todos.filter(todo => todo.id !== id);
    await writeTodos(filteredTodos);
    return true;
  },
  
  'clear-completed': async () => {
    const todos = await readTodos();
    const filteredTodos = todos.filter(todo => !todo.completed);
    await writeTodos(filteredTodos);
    return true;
  },
  
  // 窗口操作
  'minimize-window': (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  },
  
  'close-window': (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  }
};

// 注册IPC处理函数
Object.entries(ipcHandlers).forEach(([channel, handler]) => {
  ipcMain.handle(channel, handler);
});
