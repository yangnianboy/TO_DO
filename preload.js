const { contextBridge, ipcRenderer } = require('electron');

// 定义安全的API接口
const api = {
  // 待办事项操作
  getTodos: () => ipcRenderer.invoke('get-todos'),
  addTodo: (todo) => ipcRenderer.invoke('add-todo', todo),
  updateTodo: (todo) => ipcRenderer.invoke('update-todo', todo),
  deleteTodo: (id) => ipcRenderer.invoke('delete-todo', id),
  clearCompleted: () => ipcRenderer.invoke('clear-completed'),
  reorderTodos: (idOrder) => ipcRenderer.invoke('reorder-todos', idOrder),
  
  // 窗口操作
  minimize: () => ipcRenderer.invoke('minimize-window'),
  close: () => ipcRenderer.invoke('close-window'),
  toggleZoom: () => ipcRenderer.invoke('toggle-zoom')
};

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', api);
