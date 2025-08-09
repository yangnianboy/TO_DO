// DOM元素缓存
const elements = {
  todoInput: null,
  addTodoBtn: null,
  todoList: null,
  clearCompletedBtn: null,
  todoCountSpan: null,
  completedCountSpan: null
};

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  await loadTodos();
  bindEvents();
  initializeOptimizations();
});

// 初始化DOM元素
function initializeElements() {
  elements.todoInput = document.getElementById('todoInput');
  elements.addTodoBtn = document.getElementById('addTodo');
  elements.todoList = document.getElementById('todoList');
  elements.clearCompletedBtn = document.getElementById('clearCompleted');
  elements.todoCountSpan = document.getElementById('todoCount');
  elements.completedCountSpan = document.getElementById('completedCount');
}

// 绑定事件监听器
function bindEvents() {
  elements.addTodoBtn.addEventListener('click', addTodo);
  elements.todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTodo();
  });
  elements.clearCompletedBtn.addEventListener('click', clearCompleted);
}

// 初始化性能优化
function initializeOptimizations() {
  optimizeScroll();
  optimizeResize();
  ensureListContainer();
  
  // 监听内容变化
  const observer = new MutationObserver(checkScrollbarNeeded);
  observer.observe(elements.todoList, { childList: true, subtree: true });
  
  setTimeout(checkScrollbarNeeded, 100);
  setTimeout(() => {
    elements.todoList.style.overflowY = 'auto';
    elements.todoList.style.overflowX = 'hidden';
  }, 500);
}

// 待办事项操作
async function addTodo() {
  const text = elements.todoInput.value.trim();
  if (text) {
    const newTodo = await window.electronAPI.addTodo({ text });
    addTodoToUI(newTodo);
    elements.todoInput.value = '';
    updateStats();
    
    if (elements.todoList.scrollTop > 0) {
      elements.todoList.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

async function loadTodos() {
  const todos = await window.electronAPI.getTodos();
  elements.todoList.innerHTML = '';
  
  if (todos.length === 0) {
    showEmptyState();
  } else {
    todos.forEach(todo => addTodoToUI(todo));
  }
  
  updateStats();
}

async function deleteTodo(id, todoItem) {
  await window.electronAPI.deleteTodo(id);
  todoItem.remove();
  updateStats();
  
  if (elements.todoList.children.length === 0) {
    showEmptyState();
  }
}

async function clearCompleted() {
  await window.electronAPI.clearCompleted();
  const completedItems = elements.todoList.querySelectorAll('.todo-item .todo-checkbox:checked');
  completedItems.forEach(checkbox => {
    const todoItem = checkbox.closest('.todo-item');
    todoItem.remove();
  });
  
  updateStats();
  
  if (elements.todoList.children.length === 0 || 
      (elements.todoList.children.length === 1 && elements.todoList.querySelector('.empty-state'))) {
    showEmptyState();
  }
}

// UI操作
function addTodoToUI(todo) {
  const emptyState = elements.todoList.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const todoItem = createTodoItemElement(todo);
  elements.todoList.prepend(todoItem);
  bindTodoItemEvents(todoItem, todo);
}

function editTodo(todoItem, todo) {
  const todoText = todoItem.querySelector('.todo-text');
  const currentText = todoText.textContent;

  todoItem.innerHTML = `
    <input type="text" class="edit-input" value="${escapeHtml(currentText)}">
    <div class="todo-actions">
      <button class="todo-edit-btn">保存</button>
      <button class="todo-delete-btn">取消</button>
    </div>
  `;

  const editInput = todoItem.querySelector('.edit-input');
  const saveBtn = todoItem.querySelector('.todo-edit-btn');
  const cancelBtn = todoItem.querySelector('.todo-delete-btn');

  editInput.focus();
  editInput.select();

  saveBtn.addEventListener('click', async () => {
    const newText = editInput.value.trim();
    if (newText && newText !== currentText) {
      todo.text = newText;
      await window.electronAPI.updateTodo(todo);
      renderTodoItem(todoItem, todo);
    } else {
      renderTodoItem(todoItem, todo);
    }
  });

  cancelBtn.addEventListener('click', () => {
    renderTodoItem(todoItem, todo);
  });

  editInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveBtn.click();
    }
  });
}

function renderTodoItem(todoItem, todo) {
  todoItem.innerHTML = `
    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
    <span class="todo-text ${todo.completed ? 'completed' : ''}">${escapeHtml(todo.text)}</span>
    <div class="todo-actions">
      <button class="todo-edit-btn">编辑</button>
      <button class="todo-delete-btn">删除</button>
    </div>
  `;

  bindTodoItemEvents(todoItem, todo);
}

function showEmptyState() {
  elements.todoList.innerHTML = `
    <div class="empty-state">
      <p>还没有待办事项</p>
      <p class="empty-subtext">添加你的第一个任务开始吧！</p>
    </div>
  `;
}

function updateStats() {
  const todos = Array.from(elements.todoList.querySelectorAll('.todo-item'));
  const total = todos.length;
  const completed = todos.filter(item => 
    item.querySelector('.todo-checkbox').checked
  ).length;
  const pending = total - completed;

  elements.todoCountSpan.textContent = `${pending} 个项目`;
  elements.completedCountSpan.textContent = `${completed} 个已完成`;
}

// 工具函数
function escapeHtml(text) {
  const map = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function createTodoItemElement(todo) {
  const todoItem = document.createElement('div');
  todoItem.className = 'todo-item';
  todoItem.dataset.id = todo.id;
  todoItem.innerHTML = `
    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
    <span class="todo-text ${todo.completed ? 'completed' : ''}">${escapeHtml(todo.text)}</span>
    <div class="todo-actions">
      <button class="todo-edit-btn">编辑</button>
      <button class="todo-delete-btn">删除</button>
    </div>
  `;
  return todoItem;
}

function bindTodoItemEvents(todoItem, todo) {
  const checkbox = todoItem.querySelector('.todo-checkbox');
  const todoText = todoItem.querySelector('.todo-text');
  const editBtn = todoItem.querySelector('.todo-edit-btn');
  const deleteBtn = todoItem.querySelector('.todo-delete-btn');

  checkbox.addEventListener('change', async () => {
    todo.completed = checkbox.checked;
    todoText.classList.toggle('completed', todo.completed);
    await window.electronAPI.updateTodo(todo);
    updateStats();
  });

  editBtn.addEventListener('click', () => editTodo(todoItem, todo));
  deleteBtn.addEventListener('click', () => deleteTodo(todo.id, todoItem));
}

// 性能优化函数
function optimizeScroll() {
  let ticking = false;
  const todoListContainer = elements.todoList.parentElement;
  
  elements.todoList.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        ticking = false;
        if (elements.todoList.scrollTop > 0) {
          todoListContainer.classList.add('scrolling');
        } else {
          todoListContainer.classList.remove('scrolling');
        }
      });
      ticking = true;
    }
  });
  
  elements.todoList.addEventListener('scroll', () => {
    clearTimeout(elements.todoList.scrollTimer);
    elements.todoList.scrollTimer = setTimeout(() => {
      todoListContainer.classList.remove('scrolling');
    }, 150);
  });
}

function optimizeResize() {
  let resizeTimeout;
  
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      elements.todoList.style.willChange = 'transform';
      setTimeout(() => {
        elements.todoList.style.willChange = 'auto';
      }, 300);
    }, 100);
  });
}

function checkScrollbarNeeded() {
  const todoListContainer = elements.todoList.parentElement;
  if (elements.todoList.scrollHeight > elements.todoList.clientHeight) {
    todoListContainer.setAttribute('data-scrollable', 'true');
  } else {
    todoListContainer.setAttribute('data-scrollable', 'false');
  }
}

function ensureListContainer() {
  const todoListContainer = elements.todoList.parentElement;
  todoListContainer.style.flex = '1';
  todoListContainer.style.display = 'flex';
  todoListContainer.style.flexDirection = 'column';
  todoListContainer.style.overflow = 'hidden';
  
  elements.todoList.style.flex = '1';
  elements.todoList.style.overflowY = 'auto';
  elements.todoList.style.overflowX = 'hidden';
}
