(function () {
  'use strict';

  var STORAGE_KEY = 'todoApp.v1';
  var MAX_LENGTH = 100;
  var CATEGORIES = { work: '업무', personal: '개인', study: '공부' };

  var todos = [];
  var filter = 'all';
  var editingId = null;

  var els = {
    today: document.getElementById('today'),
    summary: document.getElementById('progress-summary'),
    track: document.getElementById('progress-track'),
    bar: document.getElementById('progress-bar'),
    categories: document.getElementById('progress-categories'),
    form: document.getElementById('add-form'),
    input: document.getElementById('add-input'),
    category: document.getElementById('add-category'),
    filters: document.getElementById('filters'),
    list: document.getElementById('todo-list'),
    empty: document.getElementById('empty-message')
  };

  // ---------- 저장소 ----------
  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data && Array.isArray(data.todos)) {
        return data.todos.filter(function (t) {
          return t && typeof t.id === 'string' && typeof t.text === 'string' && CATEGORIES[t.category];
        }).map(function (t) {
          return { id: t.id, text: t.text, category: t.category, done: !!t.done, createdAt: t.createdAt || 0 };
        });
      }
    } catch (e) { /* 손상되었거나 접근 불가: 빈 목록으로 시작 */ }
    return [];
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, todos: todos }));
    } catch (e) { /* 저장 실패해도 앱은 계속 동작 */ }
  }

  // ---------- 상태 변경 ----------
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function addTodo(text, category) {
    text = text.trim();
    if (!text) return false;
    todos.push({ id: newId(), text: text.slice(0, MAX_LENGTH), category: category, done: false, createdAt: Date.now() });
    commit();
    return true;
  }

  function updateTodo(id, changes) {
    var todo = findTodo(id);
    if (!todo) return;
    var text = typeof changes.text === 'string' ? changes.text.trim() : todo.text;
    if (!text) return; // 빈 값은 변경 취소
    todo.text = text.slice(0, MAX_LENGTH);
    if (CATEGORIES[changes.category]) todo.category = changes.category;
    commit();
  }

  function toggleTodo(id) {
    var todo = findTodo(id);
    if (!todo) return;
    todo.done = !todo.done;
    commit();
  }

  function deleteTodo(id) {
    todos = todos.filter(function (t) { return t.id !== id; });
    commit();
  }

  function findTodo(id) {
    return todos.filter(function (t) { return t.id === id; })[0];
  }

  function commit() {
    save();
    render();
  }

  // ---------- 진행률 ----------
  function getProgress() {
    var result = { total: todos.length, done: 0, percent: 0, byCategory: {} };
    Object.keys(CATEGORIES).forEach(function (key) {
      result.byCategory[key] = { total: 0, done: 0 };
    });
    todos.forEach(function (t) {
      var c = result.byCategory[t.category];
      c.total++;
      if (t.done) { c.done++; result.done++; }
    });
    result.percent = result.total ? Math.round(result.done / result.total * 100) : 0;
    return result;
  }

  // ---------- 렌더링 ----------
  function render() {
    renderProgress();
    renderFilters();
    renderList();
  }

  function renderProgress() {
    var p = getProgress();
    els.summary.textContent = p.total
      ? p.done + ' / ' + p.total + ' 완료 · ' + p.percent + '%'
      : '할 일을 추가해 보세요';
    els.bar.style.width = p.percent + '%';
    els.track.setAttribute('aria-valuenow', String(p.percent));

    els.categories.textContent = '';
    Object.keys(CATEGORIES).forEach(function (key) {
      var li = document.createElement('li');
      li.textContent = CATEGORIES[key] + ' ' + p.byCategory[key].done + '/' + p.byCategory[key].total;
      els.categories.appendChild(li);
    });
  }

  function renderFilters() {
    Array.prototype.forEach.call(els.filters.querySelectorAll('button'), function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.filter === filter));
    });
  }

  function renderList() {
    var visible = todos.filter(function (t) { return filter === 'all' || t.category === filter; });
    els.list.textContent = '';
    visible.forEach(function (t) {
      els.list.appendChild(t.id === editingId ? buildEditItem(t) : buildItem(t));
    });

    if (visible.length === 0) {
      els.empty.textContent = todos.length === 0 ? '아직 할 일이 없어요' : '이 카테고리에는 할 일이 없어요';
      els.empty.hidden = false;
    } else {
      els.empty.hidden = true;
    }

    var editInput = els.list.querySelector('.edit-input');
    if (editInput) editInput.focus();
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function iconButton(label, symbol, action, extra) {
    var btn = el('button', 'icon-btn ' + (extra || ''), symbol);
    btn.type = 'button';
    btn.dataset.action = action;
    btn.setAttribute('aria-label', label);
    return btn;
  }

  function buildItem(t) {
    var li = el('li', 'todo-item' + (t.done ? ' done' : ''));
    li.dataset.id = t.id;

    var check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = t.done;
    check.dataset.action = 'toggle';
    check.setAttribute('aria-label', t.text + ' 완료 표시');

    var text = el('span', 'todo-text', t.text);
    text.dataset.action = 'edit-text';

    li.appendChild(check);
    li.appendChild(text);
    li.appendChild(el('span', 'badge ' + t.category, CATEGORIES[t.category]));
    li.appendChild(iconButton('수정', '✎', 'edit'));
    li.appendChild(iconButton('삭제', '🗑', 'delete', 'delete'));
    return li;
  }

  function buildEditItem(t) {
    var li = el('li', 'todo-item');
    li.dataset.id = t.id;

    var input = el('input', 'edit-input');
    input.type = 'text';
    input.maxLength = MAX_LENGTH;
    input.value = t.text;
    input.setAttribute('aria-label', '할 일 수정');

    var select = el('select', 'edit-category');
    select.setAttribute('aria-label', '카테고리 변경');
    Object.keys(CATEGORIES).forEach(function (key) {
      var opt = el('option', '', CATEGORIES[key]);
      opt.value = key;
      opt.selected = key === t.category;
      select.appendChild(opt);
    });

    li.appendChild(input);
    li.appendChild(select);
    return li;
  }

  // ---------- 편집 ----------
  function finishEdit(li, save) {
    if (editingId === null) return;
    var id = editingId;
    editingId = null;
    if (save && li) {
      updateTodo(id, {
        text: li.querySelector('.edit-input').value,
        category: li.querySelector('.edit-category').value
      });
    }
    render(); // 빈 값으로 취소된 경우에도 편집 UI를 닫는다
  }

  function startEdit(id) {
    editingId = id;
    render();
  }

  // ---------- 이벤트 ----------
  els.form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (addTodo(els.input.value, els.category.value)) els.input.value = '';
    els.input.focus();
  });

  els.filters.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    filter = btn.dataset.filter;
    editingId = null;
    render();
  });

  els.list.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    var li = e.target.closest('.todo-item');
    if (!target || !li) return;
    var id = li.dataset.id;
    switch (target.dataset.action) {
      case 'edit':
        startEdit(id);
        break;
      case 'delete':
        if (confirm('이 할 일을 삭제할까요?')) deleteTodo(id);
        break;
    }
  });

  els.list.addEventListener('change', function (e) {
    if (e.target.dataset.action === 'toggle') {
      toggleTodo(e.target.closest('.todo-item').dataset.id);
    }
  });

  els.list.addEventListener('dblclick', function (e) {
    var text = e.target.closest('[data-action="edit-text"]');
    if (text) startEdit(text.closest('.todo-item').dataset.id);
  });

  els.list.addEventListener('keydown', function (e) {
    if (!e.target.classList.contains('edit-input') && !e.target.classList.contains('edit-category')) return;
    var li = e.target.closest('.todo-item');
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEdit(li, true);
    } else if (e.key === 'Escape') {
      finishEdit(li, false);
    }
  });

  // 편집 영역 밖으로 포커스가 나가면 저장
  els.list.addEventListener('focusout', function (e) {
    var li = e.target.closest('.todo-item');
    if (!li || editingId === null || li.dataset.id !== editingId) return;
    if (li.contains(e.relatedTarget)) return;
    finishEdit(li, true);
  });

  // ---------- 시작 ----------
  els.today.textContent = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  });
  todos = load();
  render();
})();
