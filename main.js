const { app, BrowserWindow, ipcMain, screen } = require('electron');
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

// 数据存储相关函数（使用 Electron userData）
function getDataFilePath() {
  const userDir = app.getPath('userData');
  return path.join(userDir, 'todos.json');
}
const legacyDataFile = path.join(os.homedir(), '.todo-app', 'todos.json');

// 初始化数据存储
async function initializeDataStorage() {
  try {
    const dataFile = getDataFilePath();
    // 确保目录存在
    await fs.mkdir(path.dirname(dataFile), { recursive: true });
    // 一次性迁移旧路径数据
    try {
      await fs.access(dataFile);
    } catch {
      // 新路径还不存在时，尝试从旧路径复制
      try {
        const legacy = await fs.readFile(legacyDataFile, 'utf8');
        await fs.writeFile(dataFile, legacy, 'utf8');
      } catch {
        // 旧数据不存在则初始化
        await fs.writeFile(dataFile, '[]', 'utf8');
      }
    }
  } catch (error) {
    console.error('Failed to initialize data storage:', error);
  }
}

// 读取待办事项数据
async function readTodos() {
  try {
  const data = await fs.readFile(getDataFilePath(), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to read todos:', error);
    return [];
  }
}

// 写入待办事项数据
async function writeTodos(todos) {
  try {
  await fs.writeFile(getDataFilePath(), JSON.stringify(todos, null, 2), 'utf8');
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

  // 重新排序（持久化拖拽后的顺序）
  'reorder-todos': async (event, idOrder) => {
    if (!Array.isArray(idOrder)) return false;
    const todos = await readTodos();
    const byId = new Map(todos.map(t => [t.id, t]));
    const normalized = idOrder.map(id => Number(id)).filter(id => byId.has(id));
    const reordered = normalized.map(id => byId.get(id));
    // 追加任何遗漏的（容错），保持原顺序
    const missing = todos.filter(t => !normalized.includes(t.id));
    const finalList = [...reordered, ...missing];
    await writeTodos(finalList);
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
  },

  // mac 风格“缩放”行为：在两种尺寸间切换
  'toggle-zoom': (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    try {
      const [w, h] = win.getSize();
      const display = screen.getDisplayMatching(win.getBounds());
      const maxW = Math.min(820, Math.floor(display.workArea.width * 0.7));
      const maxH = Math.min(900, Math.floor(display.workArea.height * 0.8));
      const isCompact = w <= 450 && h <= 700;
      if (isCompact) {
        win.setSize(Math.max(600, maxW), Math.max(760, Math.min(maxH, 900)), true);
      } else {
        win.setSize(400, 600, true);
      }
    } catch (e) {
      console.error('toggle-zoom failed:', e);
    }
  }
};

// 注册IPC处理函数
Object.entries(ipcHandlers).forEach(([channel, handler]) => {
  ipcMain.handle(channel, handler);
});
