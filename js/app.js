/* ===== STORE ===== */
const Store = {
  get(k, def) { try { const d = JSON.parse(localStorage.getItem('ma_' + k)); return d !== null ? d : def; } catch { return def; } },
  set(k, v) { localStorage.setItem('ma_' + k, JSON.stringify(v)); }
};

/* ===== DATE HELPERS ===== */
function formatDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function todayKey() { return formatDate(new Date()); }
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}
/** 目标日期规则：如果今天还没写目标 → 写今天；如果今天已有目标 → 写明天 */
function targetDate() {
  const today = todayKey();
  if (state.checkins[today]) {
    // 已打卡，肯定有目标了 → 写明天
    const d = new Date(); d.setDate(d.getDate() + 1);
    return formatDate(d);
  }
  const todayData = state.eveningData[today];
  if (todayData && todayData.actions && todayData.actions.length > 0) {
    // 今天已有目标 → 写明天
    const d = new Date(); d.setDate(d.getDate() + 1);
    return formatDate(d);
  }
  // 今天还没写 → 写今天
  return today;
}
function targetLabel() {
  return targetDate() === todayKey() ? '今天' : '明天';
}

/* ===== STATE ===== */
let state = {
  goals: [],
  eveningData: {},   // keyed by date: { goalId, actions, prompt }
  checkins: {},      // keyed by date: true/false
  todos: {},         // keyed by date: [{text, done}, ...]
  settings: { autoplay: true, slideDuration: 6 },
  onboarded: false,
  greetingShown: false
};

/* ===== DOM REFS ===== */
const $ = id => document.getElementById(id);

/* ===== NAVIGATION ===== */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelector(`[data-page="${id}"]`).classList.add('active');
}

/* ===== INIT ===== */
function loadState() {
  state.goals = Store.get('goals', []);
  state.eveningData = Store.get('evening', {});
  state.checkins = Store.get('checkins', {});
  state.todos = Store.get('todos', {});
  state.settings = Store.get('settings', { autoplay: true, slideDuration: 6 });
  state.onboarded = Store.get('onboarded', false);
  state.greetingShown = Store.get('greetingShown', false);
}
function saveState() {
  Store.set('goals', state.goals);
  Store.set('evening', state.eveningData);
  Store.set('checkins', state.checkins);
  Store.set('todos', state.todos);
  Store.set('settings', state.settings);
  Store.set('greetingShown', state.greetingShown);
}

/* ===== ONBOARDING ===== */
let onboardStep = 0;
function showOnboardStep(i) {
  document.querySelectorAll('.onboarding-slide').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
  document.querySelector(`.onboarding-slide[data-index="${i}"]`).classList.add('active');
  document.querySelector(`.dot[data-dot="${i}"]`).classList.add('active');
  onboardStep = i;
  $('onboarding-action').textContent = i < 2 ? '下一步' : '开始使用';
}
function initOnboarding() {
  showOnboardStep(0);
  $('onboarding-action').onclick = () => {
    if (onboardStep < 2) { showOnboardStep(onboardStep + 1); }
    else {
      state.onboarded = true;
      saveState();
      showPage('setup-goals');
      renderGoals();
    }
  };
}

/* ===== GOALS ===== */
function renderGoals() {
  const container = $('goals-container');
  if (state.goals.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>还没有长期目标，添加一个吧</p></div>';
    return;
  }
  container.innerHTML = state.goals.map(g =>
    `<div class="goal-item" data-id="${g.id}">
      <span class="goal-text">${escHtml(g.text)}</span>
      <button class="goal-delete" data-id="${g.id}">✕</button>
    </div>`
  ).join('');
  container.querySelectorAll('.goal-delete').forEach(btn => {
    btn.onclick = () => {
      state.goals = state.goals.filter(g => g.id !== btn.dataset.id);
      saveState();
      renderGoals();
    };
  });
}
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
function initGoals() {
  $('add-goal-btn').onclick = () => {
    $('goal-form').classList.remove('hidden');
    $('goal-input').value = '';
    $('goal-input').focus();
  };
  $('cancel-goal-btn').onclick = () => {
    $('goal-form').classList.add('hidden');
    $('goal-input').value = '';
  };
  $('save-goal-btn').onclick = () => {
    const text = $('goal-input').value.trim();
    if (!text) return;
    state.goals.push({ id: 'g_' + Date.now(), text, createdAt: todayKey() });
    saveState();
    renderGoals();
    $('goal-form').classList.add('hidden');
    $('goal-input').value = '';
  };
  $('goal-input').onkeydown = e => { if (e.key === 'Enter') $('save-goal-btn').click(); };
  $('finish-goals-btn').onclick = goHome;
}

/* ===== HOME ===== */
function goHome() {
  showPage('home');
  renderHome();
}
function renderHome() {
  const today = todayKey();

  // Greeting — only show on first visit after onboarding
  if (!state.greetingShown) {
    $('greeting').textContent = greeting() + ' 👋';
    state.greetingShown = true;
    saveState();
  } else {
    $('greeting').textContent = '';
  }

  // Streak
  $('streak-number').textContent = calcStreak();

  // Anchor card — the core entry point
  const todayData = state.eveningData[today];
  const checkedIn = state.checkins[today];
  const anchorCard = $('anchor-card');
  const anchorIcon = $('anchor-icon');
  const anchorTitle = $('anchor-title');
  const anchorSub = $('anchor-subtitle');
  const anchorBtn = $('anchor-btn');

  if (checkedIn) {
    anchorCard.className = 'anchor-card done';
    anchorIcon.innerHTML = '&#x2714;&#xfe0f;';
    anchorTitle.textContent = '今日已锚定';
    anchorSub.textContent = '你已经完成了今天的晨间锚定';
    anchorBtn.style.display = 'none';
    anchorCard.onclick = null;
  } else if (todayData && todayData.actions && todayData.actions.length > 0) {
    anchorCard.className = 'anchor-card';
    anchorIcon.innerHTML = '&#x1f304;';
    anchorTitle.textContent = '有今日目标待查看';
    anchorSub.textContent = '你写下了今天的计划和Prompt，点击进入晨间锚定';
    anchorBtn.style.display = 'inline-block';
    anchorBtn.textContent = '开始晨间锚定';
    anchorCard.onclick = () => startMorning();
    anchorBtn.onclick = (e) => { e.stopPropagation(); startMorning(); };
  } else {
    anchorCard.className = 'anchor-card waiting';
    anchorIcon.innerHTML = '&#x1f31b;';
    anchorTitle.textContent = '还没有今日目标';
    anchorSub.textContent = '点击下方"写今日目标"，开始新的一天';
    anchorBtn.style.display = 'none';
    anchorCard.onclick = null;
  }

  // Goals preview
  const goalsList = $('home-goals-list');
  if (state.goals.length === 0) {
    goalsList.innerHTML = '<p style="color:#bbb;font-size:0.85rem;">还没有设定长期目标</p>';
  } else {
    goalsList.innerHTML = state.goals.map(g =>
      `<span class="goal-chip">${escHtml(g.text)}</span>`
    ).join('');
  }

  // Today's todos — show if there are any
  const todayTodos = state.todos[today] || [];
  const todoContainer = $('today-todos');
  if (todayTodos.length > 0) {
    const doneCount = todayTodos.filter(t => t.done).length;
    todoContainer.innerHTML =
      `<div class="todo-header">
        <h3>今日待办</h3>
        <span class="todo-count">${doneCount}/${todayTodos.length}</span>
      </div>
      <div class="todo-list">
        ${todayTodos.map((t, i) => `
          <div class="todo-item ${t.done ? 'done' : ''}" data-index="${i}">
            <span class="todo-check">${t.done ? '✓' : '○'}</span>
            <span class="todo-text">${escHtml(t.text)}</span>
          </div>
        `).join('')}
      </div>`;
    todoContainer.querySelectorAll('.todo-item').forEach(el => {
      el.onclick = () => {
        const idx = parseInt(el.dataset.index);
        todayTodos[idx].done = !todayTodos[idx].done;
        state.todos[today] = todayTodos;
        saveState();
        renderHome();
      };
    });
    todoContainer.style.display = 'block';
  } else {
    todoContainer.style.display = 'none';
  }

  // Evening button
  const writeFor = targetDate();
  const btnLabel = writeFor === today ? '写今日目标' : '写明日目标';
  $('evening-write-btn').textContent = btnLabel;
  $('evening-write-btn').className = writeFor === today ? 'btn btn-primary btn-large btn-full' : 'btn btn-outline btn-full';
  $('evening-write-btn').onclick = goEvening;
}
function calcStreak() {
  const checkins = state.checkins;
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = formatDate(d);
    if (checkins[key]) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

/* ===== EVENING WRITE ===== */
function goEvening() {
  showPage('evening');
  $('evening-back').onclick = goHome;

  const writeFor = targetDate();
  const isToday = writeFor === todayKey();
  const label = isToday ? '今天' : '明天';

  // Update header
  $('evening-header-title').textContent = '写' + label + '目标';

  // Dynamic label and placeholders
  $('action-label').textContent = label + '最重要的1-3件事';
  $('action-1').placeholder = label + '第1件事';
  $('action-2').placeholder = label + '第2件事（可选）';
  $('action-3').placeholder = label + '第3件事（可选）';

  // Goal selector
  const selector = $('goal-selector');
  if (state.goals.length === 0) {
    selector.innerHTML = '<span style="color:#bbb;font-size:0.85rem;">暂无长期目标，可跳过</span>';
  } else {
    selector.innerHTML = '<span class="goal-chip-selectable" data-id="">无</span>' +
      state.goals.map(g =>
        `<span class="goal-chip-selectable" data-id="${g.id}">${escHtml(g.text)}</span>`
      ).join('');
    selector.querySelectorAll('.goal-chip-selectable').forEach(el => {
      el.onclick = () => {
        selector.querySelectorAll('.goal-chip-selectable').forEach(s => s.classList.remove('selected'));
        el.classList.add('selected');
      };
    });
  }

  // Pre-fill if editing existing data for this date
  const existing = state.eveningData[writeFor];
  if (existing) {
    $('action-1').value = existing.actions[0] || '';
    $('action-2').value = existing.actions[1] || '';
    $('action-3').value = existing.actions[2] || '';
    $('prompt-input').value = existing.prompt || '';
    if (existing.goalId) {
      selector.querySelectorAll('.goal-chip-selectable').forEach(el => {
        if (el.dataset.id === existing.goalId) el.classList.add('selected');
      });
    }
  } else {
    $('action-1').value = '';
    $('action-2').value = '';
    $('action-3').value = '';
    $('prompt-input').value = '';
  }

  $('save-evening-btn').textContent = '保存并锚定' + label;
  $('save-evening-btn').onclick = () => {
    const a1 = $('action-1').value.trim();
    if (!a1) { $('action-1').focus(); return; }
    const actions = [a1];
    const a2 = $('action-2').value.trim();
    if (a2) actions.push(a2);
    const a3 = $('action-3').value.trim();
    if (a3) actions.push(a3);
    const prompt = $('prompt-input').value.trim();
    const selectedGoal = selector.querySelector('.goal-chip-selectable.selected');
    const goalId = selectedGoal ? selectedGoal.dataset.id : null;

    state.eveningData[writeFor] = { goalId, actions, prompt, createdAt: todayKey() };

    // Initialize todos for this date (preserve existing done states if re-editing)
    const existingTodos = state.todos[writeFor] || [];
    const existingDone = {};
    existingTodos.forEach(t => { existingDone[t.text] = t.done; });
    state.todos[writeFor] = actions.map(text => ({
      text,
      done: existingDone[text] || false
    }));

    saveState();

    // If writing for today, show the plan summary (no slideshow — user just wants to see the list)
    if (isToday) {
      showPlanSummary();
    } else {
      goHome();
    }
  };
}

/** Show the day's plan as a summary card (used after writing today's goals) */
function showPlanSummary() {
  const today = todayKey();
  const data = state.eveningData[today] || {};
  showPage('focus');
  $('focus-badge').textContent = '📋 今日计划';
  if (data.goalId) {
    const goal = state.goals.find(g => g.id === data.goalId);
    $('focus-goal').textContent = goal ? '🎯 ' + goal.text : '';
  } else {
    $('focus-goal').textContent = '';
  }
  renderFocusTodos(today);
  $('focus-prompt').textContent = data.prompt ? '"' + data.prompt + '"' : '';
  $('focus-done-btn').textContent = '我知道了';
  $('focus-done-btn').onclick = goHome;
  $('focus-done-btn').style.display = 'block';
}

/** Render checkable todos in the focus summary page */
function renderFocusTodos(date) {
  const todos = state.todos[date] || [];
  const list = $('focus-todo-list');
  if (todos.length === 0) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = todos.map((t, i) =>
    `<div class="focus-todo-item ${t.done ? 'done' : ''}" data-index="${i}">
      <span class="focus-todo-check">${t.done ? '✓' : '○'}</span>
      <span class="focus-todo-text">${escHtml(t.text)}</span>
    </div>`
  ).join('');
  list.querySelectorAll('.focus-todo-item').forEach(el => {
    el.onclick = () => {
      const idx = parseInt(el.dataset.index);
      todos[idx].done = !todos[idx].done;
      state.todos[date] = todos;
      saveState();
      renderFocusTodos(date);
    };
  });
}

/* ===== MORNING DISPLAY ===== */
let mornSlide = 0;
function startMorning() {
  const today = todayKey();
  const data = state.eveningData[today];
  if (!data || !data.actions || data.actions.length === 0) { goHome(); return; }

  showPage('morning');

  // Prompt slide
  const promptText = data.prompt || '今天聚焦于最重要的那件事';
  $('morning-prompt').textContent = promptText;

  // Goal + actions slide
  if (data.goalId) {
    const goal = state.goals.find(g => g.id === data.goalId);
    $('morning-goal').textContent = goal ? goal.text : '';
  } else {
    $('morning-goal').textContent = '今日目标';
  }
  $('morning-actions').innerHTML = data.actions.map(a => `<li>${escHtml(a)}</li>`).join('');

  // Reset slide
  mornSlide = 0;
  updateMornSlide(0);

  // Container tap toggles slides
  const container = document.querySelector('.morning-container');
  container.onclick = (e) => {
    if (e.target.closest('.morning-checkin-btn')) return;
    mornSlide = mornSlide === 0 ? 1 : 0;
    updateMornSlide(mornSlide);
  };

  // Check-in button
  $('morning-checkin-btn').onclick = goCheckin;
}
function updateMornSlide(i) {
  document.querySelectorAll('.morning-slide').forEach(s => s.classList.remove('active'));
  document.querySelector(`.morning-slide[data-slide="${i}"]`).classList.add('active');
  document.querySelectorAll('.morning-dot').forEach(d => d.classList.remove('active'));
  document.querySelector(`.morning-dot[data-mdot="${i}"]`).classList.add('active');
}

/* ===== CHECK-IN ===== */
function goCheckin() {
  showPage('checkin');
  $('checkin-btn').onclick = () => {
    state.checkins[todayKey()] = true;
    saveState();
    goFocus();
  };
}

/* ===== FOCUS SUMMARY ===== */
function goFocus() {
  showPage('focus');
  const today = todayKey();
  const data = state.eveningData[today] || {};

  $('focus-badge').textContent = '✓ 今日已锚定';

  if (data.goalId) {
    const goal = state.goals.find(g => g.id === data.goalId);
    $('focus-goal').textContent = goal ? '🎯 ' + goal.text : '';
  } else {
    $('focus-goal').textContent = '';
  }
  renderFocusTodos(today);
  $('focus-prompt').textContent = data.prompt ? '"' + data.prompt + '"' : '';
  $('focus-done-btn').textContent = '返回首页';
  $('focus-done-btn').onclick = goHome;
  $('focus-done-btn').style.display = 'block';
}

/* ===== SETTINGS ===== */
function initSettings() {
  $('settings-btn').onclick = () => {
    showPage('settings');
    $('autoplay-toggle').checked = state.settings.autoplay;
    $('slide-duration').value = state.settings.slideDuration;
  };
  $('settings-back').onclick = goHome;

  $('autoplay-toggle').onchange = () => {
    state.settings.autoplay = $('autoplay-toggle').checked;
    saveState();
  };
  $('slide-duration').onchange = () => {
    state.settings.slideDuration = parseInt($('slide-duration').value);
    saveState();
  };

  $('manage-goals-btn').onclick = () => {
    showPage('setup-goals');
    renderGoals();
    $('finish-goals-btn').textContent = '返回';
    $('finish-goals-btn').onclick = goHome;
  };

  $('reset-btn').onclick = () => {
    if (confirm('确定要重置所有数据吗？此操作不可撤销。')) {
      localStorage.clear();
      location.reload();
    }
  };
}

/* ===== APP ROUTER ===== */
function boot() {
  loadState();

  if (!state.onboarded) {
    showPage('onboarding');
    initOnboarding();
    return;
  }

  const today = todayKey();
  const todayData = state.eveningData[today];
  const checkedIn = state.checkins[today];

  // Auto-route: if today has target data and not checked in → show morning
  if (todayData && todayData.actions && todayData.actions.length > 0 && !checkedIn) {
    showPage('morning');
    setTimeout(() => startMorning(), 100);
    return;
  }

  goHome();
}

/* ===== START ===== */
document.addEventListener('DOMContentLoaded', () => {
  initGoals();
  initSettings();
  boot();
});