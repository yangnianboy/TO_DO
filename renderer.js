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
  if (elements.addTodoBtn) {
    elements.addTodoBtn.addEventListener('click', addTodo);
  }
  if (elements.todoInput) {
    elements.todoInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addTodo();
    });
  }
  if (elements.clearCompletedBtn) {
    elements.clearCompletedBtn.addEventListener('click', clearCompleted);
  }

  // 事件委托：处理checkbox、编辑、删除
  elements.todoList.addEventListener('click', (e) => {
    const target = e.target;
    const itemEl = target.closest('.todo-item');
    if (!itemEl) return;
    const id = Number(itemEl.dataset.id);
    if (!id) return;

    // 删除
    if (target.classList.contains('todo-delete-btn')) {
      deleteTodo(id, itemEl);
      return;
    }
    // 编辑
    if (target.classList.contains('todo-edit-btn') && !itemEl.querySelector('.edit-input')) {
      const todo = extractTodoFromElement(itemEl);
      if (todo) editTodo(itemEl, todo);
      return;
    }
  });

  // 委托变更：checkbox
  elements.todoList.addEventListener('change', async (e) => {
    const target = e.target;
    if (!target.classList.contains('todo-checkbox')) return;
    const itemEl = target.closest('.todo-item');
    if (!itemEl) return;
    const todo = extractTodoFromElement(itemEl);
    if (!todo) return;
    todo.completed = target.checked;
    itemEl.querySelector('.todo-text')?.classList.toggle('completed', todo.completed);
    await window.electronAPI.updateTodo(todo);
    updateStats();
  });
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
    addTodoToUI(newTodo, true);
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
    todos.forEach(todo => addTodoToUI(todo, false));
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
function addTodoToUI(todo, atTop = true) {
  const emptyState = elements.todoList.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const todoItem = createTodoItemElement(todo);
  if (atTop) {
    elements.todoList.prepend(todoItem);
  } else {
    elements.todoList.appendChild(todoItem);
  }
  // 事件由委托处理，无需逐项绑定
}

function editTodo(todoItem, todo) {
  const todoText = todoItem.querySelector('.todo-text');
  const currentText = todoText.textContent;

  todoItem.innerHTML = `
    <input type="text" class="edit-input" value="${escapeHtml(currentText)}">
    <div class="todo-actions">
      <button class="todo-edit-btn">保存</button>
  <button class="todo-cancel-btn">取消</button>
    </div>
  `;

  const editInput = todoItem.querySelector('.edit-input');
  const saveBtn = todoItem.querySelector('.todo-edit-btn');
  const cancelBtn = todoItem.querySelector('.todo-cancel-btn');

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
  editInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      renderTodoItem(todoItem, todo);
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
  // 事件由委托处理
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
  const completed = todos.filter(item => item.querySelector('.todo-checkbox')?.checked).length;
  const pending = total - completed;

  elements.todoCountSpan.textContent = `${pending} 个项目`;
  elements.completedCountSpan.textContent = `${completed} 个已完成`;
  if (elements.clearCompletedBtn) {
    elements.clearCompletedBtn.disabled = completed === 0;
    elements.clearCompletedBtn.setAttribute('aria-disabled', String(completed === 0));
  }
}

// 工具函数
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
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

// 从元素中还原todo对象（最小依赖渲染结构）
function extractTodoFromElement(itemEl) {
  const id = Number(itemEl.dataset.id);
  if (!id) return null;
  const textEl = itemEl.querySelector('.todo-text');
  const checkbox = itemEl.querySelector('.todo-checkbox');
  return {
    id,
    text: textEl ? textEl.textContent : '',
    completed: !!(checkbox && checkbox.checked)
  };
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
