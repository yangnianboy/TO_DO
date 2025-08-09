const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

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
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 待办事项数据存储
let todos = [];

// IPC处理函数
const ipcHandlers = {
  // 待办事项操作
  'get-todos': () => todos,
  
  'add-todo': (event, todo) => {
    const newTodo = {
      id: Date.now(),
      text: todo.text,
      completed: false,
      createdAt: new Date().toISOString()
    };
    todos.push(newTodo);
    return newTodo;
  },
  
  'update-todo': (event, updatedTodo) => {
    const index = todos.findIndex(todo => todo.id === updatedTodo.id);
    if (index !== -1) {
      todos[index] = updatedTodo;
    }
    return updatedTodo;
  },
  
  'delete-todo': (event, id) => {
    todos = todos.filter(todo => todo.id !== id);
    return true;
  },
  
  'clear-completed': () => {
    todos = todos.filter(todo => !todo.completed);
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
