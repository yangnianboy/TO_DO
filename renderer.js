// DOM元素缓存
const elements = {
  todoInput: null,
  addTodoBtn: null,
  todoList: null,
  clearCompletedBtn: null,
  todoCountSpan: null,
  completedCountSpan: null,
  filterAll: null,
  filterActive: null,
  filterCompleted: null,
  searchInput: null,
  tagFilters: null,
  btnMinimize: null,
  btnClose: null,
  btnZoom: null
};

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  await loadTodos();
  bindEvents();
  initializeOptimizations();
  initializeDragAndDrop();
});

// 初始化DOM元素
function initializeElements() {
  elements.todoInput = document.getElementById('todoInput');
  elements.addTodoBtn = document.getElementById('addTodo');
  elements.todoList = document.getElementById('todoList');
  elements.clearCompletedBtn = document.getElementById('clearCompleted');
  elements.todoCountSpan = document.getElementById('todoCount');
  elements.completedCountSpan = document.getElementById('completedCount');
  elements.filterAll = document.getElementById('filterAll');
  elements.filterActive = document.getElementById('filterActive');
  elements.filterCompleted = document.getElementById('filterCompleted');
  elements.searchInput = document.getElementById('searchInput');
  elements.tagFilters = document.querySelector('.tag-filters');
  elements.btnMinimize = document.getElementById('btnMinimize');
  elements.btnClose = document.getElementById('btnClose');
  elements.btnZoom = document.getElementById('btnZoom');
}

// 绑定事件监听器
function bindEvents() {
  // 窗口控制按钮
  if (elements.btnMinimize) elements.btnMinimize.addEventListener('click', () => window.electronAPI?.minimize?.());
  if (elements.btnClose) elements.btnClose.addEventListener('click', () => window.electronAPI?.close?.());
  if (elements.btnZoom) elements.btnZoom.addEventListener('click', () => window.electronAPI?.toggleZoom?.());
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
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', applyCurrentFilter);
  }

  // 事件委托：处理checkbox、编辑、删除
  elements.todoList.addEventListener('click', (e) => {
    const target = e.target;
    const itemEl = target.closest('.todo-item');
    if (!itemEl) return;
    const id = Number(itemEl.dataset.id);
    if (!id) return;

    // 删除
    if (target.closest('.todo-delete-btn')) {
      deleteTodo(id, itemEl);
      return;
    }
    // 编辑
    if (target.closest('.todo-edit-btn') && !itemEl.querySelector('.edit-input')) {
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
  rebuildTagFiltersFromList();
  applyCurrentFilter();
  });

  // 过滤分段控制
  const setActive = (btn) => {
    [elements.filterAll, elements.filterActive, elements.filterCompleted].forEach(b => {
      if (!b) return;
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', String(b === btn));
    });
  };
  const applyFilter = () => applyCurrentFilter();
  [elements.filterAll, elements.filterActive, elements.filterCompleted].forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      setActive(btn);
      applyFilter();
    });
  });

  // 标签筛选按钮（动态创建，使用事件委托）
  if (elements.tagFilters) {
    elements.tagFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('.tag-filter');
      if (!btn) return;
      btn.classList.toggle('active');
      applyCurrentFilter();
    });
  }

  // 首次进入时应用一次过滤
  setTimeout(applyFilter, 0);
}

// 拖拽排序（HTML5 DnD）
function initializeDragAndDrop() {
  const list = elements.todoList;
  if (!list) return;

  let dragEl = null;
  let placeholder = document.createElement('div');
  placeholder.className = 'drop-placeholder';
  // 整卡可拖，但避免在交互元素上启动拖动
  
  const onDragStart = (e) => {
  const badStart = e.target.closest('input,button,.icon-btn,.todo-actions,.edit-input');
  if (badStart) { e.preventDefault(); return; }
  const item = e.target.closest('.todo-item');
    if (!item) return;
    dragEl = item;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.id || '');
    // 设置占位符高度以减少布局跳动
    const h = item.getBoundingClientRect().height;
    placeholder.style.height = h + 'px';
    list.classList.add('drag-active');
    requestAnimationFrame(() => item.classList.add('dragging'));
  };

  const onDragOver = (e) => {
    if (!dragEl) return;
    e.preventDefault();
  autoScroll(list, e.clientY);
    const after = getDragAfterElement(list, e.clientY);
    const currentIndex = Array.from(list.children).indexOf(placeholder);
    let targetIndex;
    if (after == null) {
      targetIndex = list.children.length;
    } else {
      targetIndex = Array.from(list.children).indexOf(after);
    }
    if (currentIndex !== targetIndex) {
      if (!placeholder.isConnected) placeholder.classList.add('animated');
      if (after == null) {
        list.appendChild(placeholder);
      } else {
        list.insertBefore(placeholder, after);
      }
      // 下一帧移除动画类，避免持续触发
      requestAnimationFrame(() => placeholder.classList.remove('animated'));
    }
  };

  const onDrop = async (e) => {
    e.preventDefault();
    if (!dragEl) return;
    // 将拖拽元素插入占位符位置
    if (placeholder.parentElement === list) {
      list.insertBefore(dragEl, placeholder);
      placeholder.remove();
    }
    dragEl.classList.remove('dragging');
  list.classList.remove('drag-active');
    const idOrder = Array.from(list.querySelectorAll('.todo-item'))
      .filter(el => !el.classList.contains('empty-state'))
      .map(el => el.dataset.id)
      .filter(Boolean);
    if (window.electronAPI?.reorderTodos) {
      await window.electronAPI.reorderTodos(idOrder);
    }
    dragEl = null;
    applyCurrentFilter();
  };

  const onDragEnd = () => {
  if (dragEl) dragEl.classList.remove('dragging');
  list.classList.remove('drag-active');
    placeholder.remove();
    dragEl = null;
  };

  list.addEventListener('dragstart', onDragStart);
  list.addEventListener('dragover', onDragOver);
  list.addEventListener('drop', onDrop);
  list.addEventListener('dragend', onDragEnd);

  // 开启每个 item 可拖动
  const enableDraggable = () => {
    list.querySelectorAll('.todo-item').forEach(item => {
      item.setAttribute('draggable', 'true');
    });
  };
  enableDraggable();

  // 当列表变更时，重新开启 draggable
  const mo = new MutationObserver(() => enableDraggable());
  mo.observe(list, { childList: true, subtree: false });
}

function getDragAfterElement(container, y) {
  const elements = [...container.querySelectorAll('.todo-item:not(.dragging)')]
    .filter(el => el.offsetParent !== null);
  return elements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 自动滚屏：拖拽接近边缘时平滑滚动
function autoScroll(list, clientY) {
  const rect = list.getBoundingClientRect();
  const threshold = 36;
  const maxSpeed = 16;
  let delta = 0;
  if (clientY < rect.top + threshold) {
    delta = -Math.min(maxSpeed, (rect.top + threshold - clientY) / 2);
  } else if (clientY > rect.bottom - threshold) {
    delta = Math.min(maxSpeed, (clientY - (rect.bottom - threshold)) / 2);
  }
  if (delta !== 0) list.scrollTop += delta;
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
  rebuildTagFiltersFromList();
    
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
  rebuildTagFiltersFromList();
}

async function deleteTodo(id, todoItem) {
  await window.electronAPI.deleteTodo(id);
  // 离场动画
  todoItem.classList.add('leaving');
  const removeNow = () => {
    todoItem.remove();
    updateStats();
    if (elements.todoList.children.length === 0) {
      showEmptyState();
    }
  rebuildTagFiltersFromList();
  applyCurrentFilter();
  };
  const onEnd = (e) => {
    if (e.animationName === 'cardOut') {
      todoItem.removeEventListener('animationend', onEnd);
      removeNow();
    }
  };
  todoItem.addEventListener('animationend', onEnd);
  // 兜底：若动画事件未触发
  setTimeout(() => {
    if (document.contains(todoItem)) removeNow();
  }, 260);
}

async function clearCompleted() {
  await window.electronAPI.clearCompleted();
  const completedItems = Array.from(elements.todoList.querySelectorAll('.todo-item .todo-checkbox:checked'))
    .map(cb => cb.closest('.todo-item'));

  if (completedItems.length === 0) {
    updateStats();
    applyCurrentFilter();
    return;
  }

  let remaining = completedItems.length;
  const afterOneRemoved = () => {
    remaining -= 1;
    if (remaining === 0) {
      updateStats();
      if (elements.todoList.children.length === 0 ||
          (elements.todoList.children.length === 1 && elements.todoList.querySelector('.empty-state'))) {
        showEmptyState();
      }
  rebuildTagFiltersFromList();
  applyCurrentFilter();
    }
  };

  completedItems.forEach(item => {
    if (!item) return;
    item.classList.add('leaving');
    const onEnd = (e) => {
      if (e.animationName === 'cardOut') {
        item.removeEventListener('animationend', onEnd);
        item.remove();
        afterOneRemoved();
  rebuildTagFiltersFromList();
      }
    };
    item.addEventListener('animationend', onEnd);
    setTimeout(() => {
      if (document.contains(item)) {
        item.remove();
        afterOneRemoved();
  rebuildTagFiltersFromList();
      }
    }, 260);
  });
}

// UI操作
function addTodoToUI(todo) {
  const emptyState = elements.todoList.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const todoItem = createTodoItemElement(todo);
  // 入场动画
  todoItem.classList.add('enter');
  const onEnd = (e) => {
    if (e.animationName === 'cardIn') {
      todoItem.removeEventListener('animationend', onEnd);
      todoItem.classList.remove('enter');
    }
  };
  todoItem.addEventListener('animationend', onEnd);
  elements.todoList.prepend(todoItem);
  // 应用当前过滤模式（例如在“已完成”视图下隐藏新添加的未完成项）
  applyCurrentFilter();
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
  rebuildTagFiltersFromList();
  applyCurrentFilter();
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
  const meta = parseMeta(todo.text);
  todoItem.setAttribute('data-tags', meta.tags.join(','));
  todoItem.setAttribute('data-priority', meta.priority || '');
  todoItem.setAttribute('data-due', meta.due || '');
  todoItem.setAttribute('data-fulltext', todo.text || '');
  todoItem.setAttribute('tabindex', '0');
  todoItem.innerHTML = `
    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
    <span class="todo-text ${todo.completed ? 'completed' : ''}">${escapeHtml(meta.textOnly)}</span>
    <div class="todo-actions">
      <button class="icon-btn todo-edit-btn" title="编辑" aria-label="编辑"><span class="icon-glyph">✎</span></button>
      <button class="icon-btn todo-delete-btn" title="删除" aria-label="删除"><span class="icon-glyph">🗑</span></button>
    </div>
    ${renderMetaChips(meta)}
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
  // 显示为：x个项目 · y个已完成 · x-y个未完成
  elements.todoCountSpan.textContent = `${total} 个项目 · ${completed} 个已完成 · ${pending} 个未完成`;
  // 兼容旧结构：隐藏分隔符与旧的“已完成”独立计数
  const sep = document.querySelector('.stats-sep');
  if (sep) sep.style.display = 'none';
  if (elements.completedCountSpan) {
    elements.completedCountSpan.textContent = '';
    elements.completedCountSpan.style.display = 'none';
  }
  if (elements.clearCompletedBtn) {
    elements.clearCompletedBtn.disabled = completed === 0;
    elements.clearCompletedBtn.setAttribute('aria-disabled', String(completed === 0));
  }
}

// 应用当前过滤模式（供外部调用）
function applyCurrentFilter() {
  const mode = document.querySelector('.segment.active')?.dataset.filter || 'all';
  const query = (elements.searchInput?.value || '').trim().toLowerCase();
  const activeTags = Array.from(document.querySelectorAll('.tag-filter.active')).map(b => b.dataset.tag?.toLowerCase()).filter(Boolean);
  const items = elements.todoList.querySelectorAll('.todo-item');
  items.forEach(item => {
    const checked = item.querySelector('.todo-checkbox')?.checked;
    let show = true;
    if (mode === 'active') show = !checked;
    if (mode === 'completed') show = !!checked;
    if (show && query) {
      const text = (item.getAttribute('data-fulltext') || item.querySelector('.todo-text')?.textContent || '').toLowerCase();
      const tags = (item.getAttribute('data-tags') || '').toLowerCase();
      show = text.includes(query) || tags.includes(query);
    }
    if (show && activeTags.length > 0) {
      const itemTags = (item.getAttribute('data-tags') || '').toLowerCase().split(',').filter(Boolean);
      show = activeTags.every(t => itemTags.includes(t));
    }
    item.style.display = show ? '' : 'none';
  });
}

// 根据当前列表动态生成标签筛选按钮
function rebuildTagFiltersFromList() {
  if (!elements.tagFilters) return;
  const items = Array.from(elements.todoList.querySelectorAll('.todo-item'));
  const tagSet = new Set();
  items.forEach(item => {
    const tags = (item.getAttribute('data-tags') || '').split(',').filter(Boolean);
    tags.forEach(t => tagSet.add(t));
  });
  const active = new Set(Array.from(elements.tagFilters.querySelectorAll('.tag-filter.active')).map(b => b.dataset.tag));
  elements.tagFilters.innerHTML = '';
  if (tagSet.size === 0) {
    elements.tagFilters.style.display = 'none';
    return;
  }
  elements.tagFilters.style.display = '';
  tagSet.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag-filter';
    btn.dataset.tag = tag;
    btn.textContent = tag;
    if (active.has(tag)) btn.classList.add('active');
    elements.tagFilters.appendChild(btn);
  });
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
  const meta = parseMeta(todo.text);
  todoItem.setAttribute('data-tags', meta.tags.join(','));
  todoItem.setAttribute('data-priority', meta.priority || '');
  todoItem.setAttribute('data-due', meta.due || '');
  todoItem.setAttribute('data-fulltext', todo.text || '');
  todoItem.setAttribute('tabindex', '0');
  todoItem.innerHTML = `
    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
    <span class="todo-text ${todo.completed ? 'completed' : ''}">${escapeHtml(meta.textOnly)}</span>
    <div class="todo-actions">
      <button class="icon-btn todo-edit-btn" title="编辑" aria-label="编辑"><span class="icon-glyph">✎</span></button>
      <button class="icon-btn todo-delete-btn" title="删除" aria-label="删除"><span class="icon-glyph">🗑</span></button>
    </div>
    ${renderMetaChips(meta)}
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
  text: itemEl.getAttribute('data-fulltext') || (textEl ? textEl.textContent : ''),
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

// 解析文本中的标签/优先级/截止日期
function parseMeta(text) {
  const tags = Array.from(text.matchAll(/#([\w-]+)/g)).map(m => m[1]);
  const pr = (text.match(/!([123])/ )||[])[1] || '';
  const due = (text.match(/>(\d{4}-\d{2}-\d{2})/)||[])[1] || '';
  const textOnly = text
    .replace(/#([\w-]+)/g, '')
    .replace(/!([123])/, '')
    .replace(/>(\d{4}-\d{2}-\d{2})/, '')
    .trim();
  return { tags, priority: pr, due, textOnly };
}

function renderMetaChips(meta) {
  const tagsHtml = meta.tags.map((t, i) => `<span class="tag-chip" data-color="${(i%3)+1}">#${escapeHtml(t)}</span>`).join('');
  const prHtml = meta.priority ? `<span class="priority"><span class="priority-dot priority-p${meta.priority}"></span>P${meta.priority}</span>` : '';
  const dueHtml = meta.due ? `<span class="tag-chip" data-color="2">${escapeHtml(meta.due)}</span>` : '';
  const any = tagsHtml || prHtml || dueHtml;
  return any ? `<div class="meta">${prHtml}${tagsHtml}${dueHtml}</div>` : '';
}

// 键盘替代拖拽：Ctrl/Cmd + ArrowUp/Down 交换相邻项
document.addEventListener('keydown', async (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  const focused = document.activeElement?.closest?.('.todo-item');
  if (!focused) return;
  e.preventDefault();
  const list = elements.todoList;
  if (e.key === 'ArrowUp' && focused.previousElementSibling) {
    list.insertBefore(focused, focused.previousElementSibling);
  } else if (e.key === 'ArrowDown' && focused.nextElementSibling) {
    list.insertBefore(focused.nextElementSibling, focused);
  }
  const idOrder = Array.from(list.querySelectorAll('.todo-item')).map(el => el.dataset.id).filter(Boolean);
  if (window.electronAPI?.reorderTodos) await window.electronAPI.reorderTodos(idOrder);
});
