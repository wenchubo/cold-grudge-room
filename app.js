import { createCabinAudio } from './audio.js';
import { inventory, inventoryTabs } from './inventory.js';

const storageKey = 'frost-room-records-v2';
const profileKey = 'frost-room-profile-v1';
const fireKey = 'frost-room-fire-v1';
const soundKey = 'frost-room-sound-v1';
const characters = {
  pig: {
    name: '小猪',
    calendarName: '秋日番',
    reasons: ['去和同学玩', '刷视频']
  },
  pizza: {
    name: '披萨',
    calendarName: '披萨no！',
    reasons: ['看电竞男', '敷衍']
  }
};
const $ = id => document.getElementById(id);
const room = $('room');
const reasonDialog = $('reasons');
const statistics = $('statistics');
const apple = $('apple');
const tree = $('tree');
const calendar = $('calendar');
const clock = $('wall-clock');
const giftDialog = $('gifts');
const sack = $('gift-sack');
const tray = $('stocking-tray');
const stocking = $('stocking');
const ghost = $('stocking-ghost');
const identityForm = $('identity-form');
const notice = $('notice');
const sound = createCabinAudio();
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let feedbackTimer;
let lastDate;
let lastMinute;
let selectedDate;
let visibleMonth;
let appleFall;
let profile;
let picked = false;
let drag;
let skipStockingClick = false;
let giftTimer;
let giftRecipient;
let selectedItem;
let inventoryCategory = 'all';
let noticeRead = false;
let soundWanted = true;
let audioActive = false;
let audioStarting = false;
let dvdPlaying = false;
let audioRequest = 0;
let activeReasonCharacter;
let reactionTimer;
let gifts = [];
const fullDate = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'full' });

function dateKey(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');
}

function firstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function updateClock() {
  const now = new Date();
  const hhmm = pad(now.getHours()) + ':' + pad(now.getMinutes());
  if (hhmm !== lastMinute) {
    lastMinute = hhmm;
    clock.dateTime = hhmm;
    clock.setAttribute('aria-label', '现在的时间 ' + hhmm);
    clock.firstElementChild.textContent = hhmm;
    if (calendar.open && dateKey(selectedDate) === dateKey(now)) $('calendar-clock').textContent = hhmm;
  }
  const today = dateKey(now);
  if (lastDate === today) return;
  if (calendar.open && selectedDate && dateKey(selectedDate) === lastDate) {
    selectedDate = now;
    visibleMonth = firstDayOfMonth(now);
  }
  lastDate = today;
  render();
}

function readRecords() {
  const records = JSON.parse(localStorage.getItem(storageKey) || '[]');
  return Array.isArray(records) ? records : [];
}

function loadRecords() {
  const items = readRecords();
  records = items.filter(item => item && item.kind !== 'gift' && typeof item.date === 'string');
  gifts = items.filter(item => item?.kind === 'gift');
}

function saveRecord(details) {
  try {
    const now = new Date();
    const item = { ...details, date: dateKey(now), at: now.toISOString(), actor: profile?.identity, nickname: profile?.nickname };
    localStorage.setItem(storageKey, JSON.stringify([...readRecords(), item]));
    loadRecords();
    return true;
  } catch {
    return false;
  }
}

function notify(message) {
  $('feedback').textContent = message;
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { $('feedback').textContent = ''; }, 2800);
}

let records = [];
try {
  loadRecords();
} catch {
  notify('暂时无法读取本机记录。');
}

function render() {
  const today = dateKey();
  const daily = records.filter(record => record.date === today);
  const score = daily.length * 10;
  $('meter').textContent = score;
  $('today-count').textContent = daily.length;
  $('all-count').textContent = records.length;
  $('pig-count').textContent = records.filter(record => record.character === 'pig').length;
  $('pizza-count').textContent = records.filter(record => record.character === 'pizza').length;
  room.classList.toggle('blizzard', score > 50);
  room.classList.toggle('flurry', score >= 30 && score <= 50);
  for (const id of Object.keys(characters)) {
    const favor = gifts.filter(gift => gift.character === id).length;
    const cold = daily.filter(record => record.character === id).length * 10;
    const group = $(id + '-bars');
    group.setAttribute('aria-label', characters[id].calendarName + '，好感 ' + favor + '，今日冷冰冰 ' + cold);
    setBar(group.querySelector('.favor-bar'), favor, 10);
    setBar(group.querySelector('.cold-bar'), cold, 50);
  }
  room.style.setProperty('--frost', String(Math.min(score / 105, 1)));
  $('room-hint').textContent = score > 50
    ? '雪下大了，小猪和披萨冻得直发抖。摇摇圣诞树看看次数。'
    : '点角色记一笔，摇摇圣诞树，或者打开圣诞袋。';
  $('breakdown').replaceChildren(...reasonBreakdown(records));
  if (calendar.open) renderCalendar();
}

function setBar(bar, value, max) {
  bar.querySelector('.bar-value').textContent = value;
  bar.style.setProperty('--fill', Math.min(value / max, 1) * 100 + '%');
}

function showReaction(id, state) {
  const reaction = $('reaction');
  reaction.dataset.recipient = id;
  reaction.dataset.state = state;
  reaction.firstElementChild.src = './states/' + id + '-' + state + '.png';
  reaction.hidden = false;
  if (!motion.matches) {
    reaction.getAnimations().forEach(animation => animation.cancel());
    reaction.animate([
      { transform: 'translateY(6px) scale(.85)', opacity: 0 },
      { transform: 'translateY(0) scale(1)', opacity: 1, offset: .15 },
      { transform: 'translateY(-3px)', opacity: 1, offset: .84 },
      { transform: 'translateY(-8px)', opacity: 0 }
    ], { duration: 1400, easing: 'steps(12, end)' });
  }
  clearTimeout(reactionTimer);
  reactionTimer = setTimeout(() => { reaction.hidden = true; }, 1400);
}

function setFire(isOn) {
  room.classList.toggle('fire-out', !isOn);
  $('fire-switch').setAttribute('aria-pressed', String(isOn));
  $('fire-switch').setAttribute('aria-label', isOn ? '熄灭篝火' : '点燃篝火');
}

try {
  setFire(localStorage.getItem(fireKey) !== 'off');
} catch {
  setFire(true);
}
$('fire-switch').addEventListener('click', () => {
  const isOn = room.classList.contains('fire-out');
  setFire(isOn);
  try {
    localStorage.setItem(fireKey, isOn ? 'on' : 'off');
  } catch {
    // The switch still works during the current visit.
  }
  notify(isOn ? '篝火点亮了。' : '篝火熄灭了。');
});

function reasonBreakdown(items, hideEmpty = false) {
  return Object.entries(characters).map(([id, character]) => {
    const row = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = character.calendarName;
    row.append(label);
    const counts = new Map(character.reasons.map(reason => [reason, 0]));
    for (const record of items) {
      if (record.character === id && typeof record.reason === 'string') {
        counts.set(record.reason, (counts.get(record.reason) ?? 0) + 1);
      }
    }
    for (const [reason, count] of counts) {
      if (!count && hideEmpty) continue;
      const detail = document.createElement('span');
      detail.textContent = reason + ' · ' + count + ' 次';
      row.append(detail);
    }
    return row;
  }).filter(row => row.children.length > 1);
}

function renderCalendar() {
  const now = new Date();
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const prefix = year + '-' + (month + 1) + '-';
  const monthRecords = records.filter(record => record.date.startsWith(prefix));
  const monthGifts = gifts.filter(record => record.date?.startsWith(prefix));
  const counts = new Map();
  const giftCounts = new Map();
  const totals = { pig: 0, pizza: 0 };
  for (const record of monthRecords) {
    if (!Object.hasOwn(totals, record.character)) continue;
    counts.set(record.date, (counts.get(record.date) ?? 0) + 1);
    totals[record.character] += 1;
  }
  for (const gift of monthGifts) giftCounts.set(gift.date, (giftCounts.get(gift.date) ?? 0) + 1);
  const isToday = dateKey(selectedDate) === dateKey(now);
  $('calendar-today').textContent = isToday ? '今天' : '选中日期';
  $('calendar-date-number').textContent = pad(selectedDate.getMonth() + 1) + '.' + pad(selectedDate.getDate());
  $('calendar-clock').textContent = isToday ? pad(now.getHours()) + ':' + pad(now.getMinutes()) : fullDate.format(selectedDate).slice(-3);
  $('month-label').textContent = year + '年' + (month + 1) + '月';
  const summary = Object.entries(characters).map(([id, character]) => {
    const row = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = character.calendarName;
    const cold = document.createElement('span');
    cold.className = 'summary-cold';
    cold.textContent = '冷冰冰 ' + totals[id] + ' 次';
    const reward = document.createElement('span');
    reward.className = 'summary-reward';
    reward.textContent = '奖励 ' + monthGifts.filter(gift => gift.character === id).length + ' 次';
    row.append(name, cold, reward);
    return row;
  });
  $('month-summary').replaceChildren(...summary);
  $('next-month').disabled = visibleMonth >= firstDayOfMonth(now);
  const leadingDays = (visibleMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: leadingDays }, () => document.createElement('span'));
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const key = dateKey(date);
    const count = counts.get(key) ?? 0;
    const giftCount = giftCounts.get(key) ?? 0;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.day = String(day);
    button.textContent = day;
    button.setAttribute('aria-label', fullDate.format(date) + '，冷冰冰 ' + count + ' 次，奖励 ' + giftCount + ' 次');
    button.setAttribute('aria-pressed', String(key === dateKey(selectedDate)));
    if (key === dateKey(now)) button.setAttribute('aria-current', 'date');
    const badge = document.createElement('small');
    badge.textContent = count ? String(count) : '';
    if (giftCount) {
      const heart = document.createElement('span');
      heart.className = 'calendar-heart';
      heart.textContent = '♥';
      badge.append(heart);
    }
    badge.setAttribute('aria-hidden', 'true');
    button.append(badge);
    cells.push(button);
  }
  $('calendar-days').replaceChildren(...cells);
  const selectedRecords = monthRecords.filter(record => record.date === dateKey(selectedDate));
  $('selected-day').textContent = fullDate.format(selectedDate);
  const selectedGifts = monthGifts.filter(gift => gift.date === dateKey(selectedDate));
  $('day-empty').hidden = selectedRecords.length + selectedGifts.length > 0;
  $('day-breakdown').replaceChildren(...reasonBreakdown(selectedRecords, true));
  const activity = [...selectedRecords, ...selectedGifts]
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
    .map(item => {
      const row = document.createElement('li');
      const when = document.createElement('time');
      const date = item.at ? new Date(item.at) : null;
      when.textContent = date ? pad(date.getHours()) + ':' + pad(date.getMinutes()) : '—';
      if (item.at) when.dateTime = item.at;
      const detail = document.createElement('span');
      const name = characters[item.character]?.calendarName ?? '';
      const gift = inventory.find(entry => entry.id === item.gift);
      detail.textContent = item.kind === 'gift'
        ? name + '收到' + (gift?.label ?? '一份礼物')
        : name + ' · ' + item.reason;
      row.dataset.kind = item.kind === 'gift' ? 'gift' : 'grudge';
      row.append(when, detail);
      return row;
    });
  $('day-activity').replaceChildren(...activity);
}

function moveMonth(offset) {
  const month = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
  const now = new Date();
  if (month > firstDayOfMonth(now)) return;
  visibleMonth = month;
  selectedDate = month.getTime() === firstDayOfMonth(now).getTime() ? now : month;
  renderCalendar();
  if (document.activeElement === document.body) $('previous-month').focus();
}

$('wall-calendar').addEventListener('click', () => {
  selectedDate = new Date();
  visibleMonth = firstDayOfMonth(selectedDate);
  renderCalendar();
  calendar.showModal();
});
$('previous-month').addEventListener('click', () => moveMonth(-1));
$('next-month').addEventListener('click', () => moveMonth(1));
$('calendar-days').addEventListener('click', event => {
  const button = event.target.closest('button[data-day]');
  if (!button) return;
  selectedDate = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), Number(button.dataset.day));
  renderCalendar();
  $('calendar-days').querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
});

function recordGrudge(id, reason) {
  reasonDialog.close();
  if (!saveRecord({ character: id, reason, kind: 'grudge' })) {
    notify('没能存下这次记录，请检查浏览器的存储设置。');
    return;
  }
  render();
  showReaction(id, room.classList.contains('blizzard') ? 'cold' : 'angry');
  notify(characters[id].name + '记仇 +1');
}

function chooseReason(id) {
  const character = characters[id];
  activeReasonCharacter = id;
  $('other-reason').value = '';
  $('other-reason').setCustomValidity('');
  if (id === 'pig' && audioActive) sound.pig();
  $('reason-title').textContent = character.calendarName;
  $('character-favor').textContent = '好感 ♥ ' + gifts.filter(gift => gift.character === id).length;
  $('reason-list').replaceChildren(...character.reasons.map(reason => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = reason + ' · 记仇 +1';
    button.addEventListener('click', () => recordGrudge(id, reason));
    return button;
  }));
  reasonDialog.showModal();
}

$('other-reason').addEventListener('input', () => $('other-reason').setCustomValidity(''));
$('other-reason-form').addEventListener('submit', event => {
  event.preventDefault();
  const field = $('other-reason');
  const reason = field.value.trim();
  if (!reason) {
    field.setCustomValidity('先写一句原因吧。');
    field.reportValidity();
    return;
  }
  if (activeReasonCharacter && reasonDialog.open) recordGrudge(activeReasonCharacter, reason);
});

function pickStocking(value) {
  picked = value;
  room.classList.toggle('stocking-picked', value);
  stocking.setAttribute('aria-pressed', String(value));
  $('stocking-hint').textContent = value
    ? '小袜子拿好啦，点秋日番或披萨。'
    : '拖小袜子到角色脸上，或点一下拿起。';
}

function setTray(open) {
  if (!open) pickStocking(false);
  tray.hidden = !open;
  sack.setAttribute('aria-expanded', String(open));
}

function updateGiftSelection() {
  $('item-selection').textContent = selectedItem?.label ?? '选一件东西';
  $('send-gift').disabled = !selectedItem;
  $('send-gift').textContent = selectedItem?.category === 'player' ? '播放直播 · ♥ +1' : '送出 · ♥ +1';
  for (const slot of $('inventory-grid').querySelectorAll('button')) {
    slot.setAttribute('aria-pressed', String(slot.dataset.item === selectedItem?.id));
  }
}

function renderInventory() {
  const grid = $('inventory-grid');
  const visible = inventoryCategory === 'all'
    ? inventory : inventory.filter(item => item.category === inventoryCategory);
  const slots = visible.map(item => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'inventory-slot';
    slot.dataset.item = item.id;
    slot.setAttribute('aria-label', item.label);
    slot.title = item.label;
    const image = document.createElement('img');
    image.alt = '';
    image.src = item.image;
    image.draggable = false;
    slot.append(image);
    slot.addEventListener('click', () => {
      selectedItem = item;
      updateGiftSelection();
    });
    return slot;
  });
  grid.replaceChildren(...slots);
  for (const tab of $('inventory-tabs').querySelectorAll('button')) {
    tab.setAttribute('aria-pressed', String(tab.dataset.category === inventoryCategory));
  }
  updateGiftSelection();
}

for (const { id, label } of inventoryTabs) {
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.dataset.category = id;
  tab.textContent = label;
  tab.addEventListener('click', () => {
    inventoryCategory = id;
    if (id !== 'all' && selectedItem?.category !== id) selectedItem = null;
    renderInventory();
    $('inventory-grid').scrollTop = 0;
  });
  $('inventory-tabs').append(tab);
}

$('send-gift').addEventListener('click', () => {
  if (selectedItem && giftRecipient) giveGift(giftRecipient, selectedItem);
});

function chooseGift(id) {
  pickStocking(false);
  giftRecipient = id;
  selectedItem = null;
  inventoryCategory = 'all';
  $('gift-title').textContent = '圣诞箱 · 送给' + characters[id].calendarName;
  renderInventory();
  $('inventory-grid').scrollTop = 0;
  giftDialog.showModal();
}

function giveGift(id, gift) {
  giftDialog.close();
  if (!saveRecord({ kind: 'gift', character: id, gift: gift.id })) {
    notify('没能存下礼物，请检查浏览器的存储设置。');
    return;
  }
  setTray(false);
  render();
  showReaction(id, 'happy');
  const effect = $('gift-effect');
  effect.dataset.recipient = id;
  effect.dataset.gift = gift.category;
  const picture = document.createElement('img');
  picture.className = 'gift-pixel-icon';
  picture.src = gift.image;
  picture.alt = '';
  effect.replaceChildren(picture, document.createTextNode(gift.effect + ' · ♥ +1'));
  effect.hidden = false;
  if (!motion.matches) {
    effect.getAnimations().forEach(animation => animation.cancel());
    effect.animate([
      { transform: 'translateY(8px) scale(.92)', opacity: 0 },
      { transform: 'translateY(0) scale(1)', opacity: 1, offset: .13 },
      { transform: 'translateY(-7px)', opacity: 1, offset: .8 },
      { transform: 'translateY(-13px)', opacity: 0 }
    ], { duration: 1850, easing: 'steps(14, end)' });
  }
  clearTimeout(giftTimer);
  giftTimer = setTimeout(() => { effect.hidden = true; }, 1850);
  $(id).focus({ preventScroll: true });
  notify(characters[id].calendarName + '收到了' + gift.label + '，好感 +1');
}

for (const id of Object.keys(characters)) {
  $(id).addEventListener('click', () => {
    if (picked) {
      chooseGift(id);
      return;
    }
    chooseReason(id);
  });
}

sack.addEventListener('click', () => {
  setTray(tray.hidden);
  if (!tray.hidden) stocking.focus({ preventScroll: true });
});
$('open-sack').addEventListener('click', () => {
  reasonDialog.close();
  setTray(true);
  stocking.focus({ preventScroll: true });
});
stocking.addEventListener('click', () => {
  if (skipStockingClick) return;
  pickStocking(!picked);
  if (picked) notify('点秋日番或披萨，选一份礼物。');
});

function recipientAt(x, y) {
  return Object.keys(characters).find(id => {
    const hit = $(id).getBoundingClientRect();
    return x >= hit.left && x <= hit.right && y >= hit.top && y <= hit.bottom;
  });
}

stocking.addEventListener('pointerdown', event => {
  if (drag || !event.isPrimary || event.button !== 0) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  stocking.setPointerCapture(event.pointerId);
});

stocking.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 7) return;
  if (!drag.moved) pickStocking(true);
  drag.moved = true;
  ghost.hidden = false;
  ghost.style.left = event.clientX + 'px';
  ghost.style.top = event.clientY + 'px';
  const over = recipientAt(event.clientX, event.clientY);
  for (const id of Object.keys(characters)) $(id).classList.toggle('drop-target', id === over);
});

function endDrag(event) {
  if (drag?.id !== event.pointerId) return;
  const moved = drag.moved;
  drag = null;
  ghost.hidden = true;
  for (const id of Object.keys(characters)) $(id).classList.remove('drop-target');
  if (!moved || event.type !== 'pointerup') return;
  const over = recipientAt(event.clientX, event.clientY);
  skipStockingClick = true;
  setTimeout(() => { skipStockingClick = false; }, 300);
  if (over) chooseGift(over);
}
stocking.addEventListener('pointerup', endDrag);
stocking.addEventListener('pointercancel', endDrag);
stocking.addEventListener('lostpointercapture', endDrag);

tree.addEventListener('click', () => {
  if (!apple.hidden) {
    apple.focus();
    return;
  }
  tree.classList.add('shake');
  apple.hidden = false;
  room.classList.add('apple-dropped');
  tree.setAttribute('aria-expanded', 'true');
  if (!motion.matches) {
    appleFall?.cancel();
    appleFall = apple.animate([
      { transform: 'translate(-180%, -305%) rotate(-20deg)' },
      { transform: 'translate(-105%, -185%) rotate(12deg)', offset: .53 },
      { transform: 'translateY(0) rotate(-8deg)', offset: .82 },
      { transform: 'translateY(-10%)', offset: .90 },
      { transform: 'translateY(0)' }
    ], { duration: 620, easing: 'ease-in' });
  }
  notify('掉下来一个苹果。');
});
tree.addEventListener('animationend', () => tree.classList.remove('shake'));

apple.addEventListener('click', () => {
  render();
  statistics.showModal();
});

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => button.closest('dialog').close());
});

window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  try {
    loadRecords();
    render();
  } catch {
    notify('暂时无法读取本机记录。');
  }
});
window.addEventListener('focus', updateClock);
setInterval(updateClock, 1000);

// Keep the animated flakes inside the window frame.
const snow = $('snow');
for (let i = 0; i < 72; i += 1) {
  const flake = document.createElement('i');
  if (i >= 36) flake.className = 'heavy-snow';
  else if (i >= 18) flake.className = 'medium-snow';
  flake.style.setProperty('--x', (i * 37 % 100) + '%');
  flake.style.setProperty('--y', (i * 29 % 100) + '%');
  flake.style.setProperty('--size', (2 + i % 4) + 'px');
  flake.style.setProperty('--delay', -(i * .37) + 's');
  flake.style.setProperty('--time', (3.5 + i % 7 / 1.7) + 's');
  snow.append(flake);
}
try {
  const settings = JSON.parse(localStorage.getItem(soundKey) || 'null');
  if (settings) {
    noticeRead = settings.noticeRead === true;
    soundWanted = settings.soundWanted !== false;
  }
} catch {
  // The default setting is used if the browser cannot read storage.
}

function saveSoundPreference() {
  try {
    localStorage.setItem(soundKey, JSON.stringify({ noticeRead, soundWanted }));
  } catch {
    // Sound and the notice still work for the current visit.
  }
}

function updateSoundControls() {
  const toggle = $('toggle-sound');
  const dvd = $('dvd-switch');
  const enabled = audioActive || audioStarting;
  toggle.setAttribute('aria-pressed', String(enabled));
  toggle.textContent = enabled ? '关闭声音' : '开启声音';
  dvd.setAttribute('aria-pressed', String(dvdPlaying));
  dvd.setAttribute('aria-label', dvdPlaying ? '停止 DVD 圣诞音乐' : '用 DVD 播放圣诞音乐');
}

function stopAudio() {
  audioRequest += 1;
  audioActive = false;
  audioStarting = false;
  dvdPlaying = false;
  sound.setRoom(false);
  updateSoundControls();
}

async function startAudio(feedback) {
  const request = ++audioRequest;
  audioStarting = true;
  updateSoundControls();
  try {
    await sound.unlock();
    if (request !== audioRequest || !soundWanted || $('house').hidden) return;
    sound.setRoom(true);
    audioStarting = false;
    audioActive = true;
    sound.setMusic(dvdPlaying);
    if (feedback) sound[feedback]();
    updateSoundControls();
  } catch {
    if (request !== audioRequest) return;
    stopAudio();
    notify('当前浏览器暂时无法播放声音。');
  }
}

function openNotice() {
  $('notice-sound').checked = soundWanted;
  $('close-notice').hidden = !noticeRead;
  if (!notice.open) notice.showModal();
}

$('notice-form').addEventListener('submit', event => {
  event.preventDefault();
  noticeRead = true;
  soundWanted = $('notice-sound').checked;
  saveSoundPreference();
  notice.close();
  if (!soundWanted) stopAudio();
  else if (!$('house').hidden) startAudio();
});

notice.addEventListener('cancel', event => {
  if (!noticeRead) event.preventDefault();
});
$('close-notice').addEventListener('click', () => notice.close());
$('reopen-notice').addEventListener('click', openNotice);
$('toggle-sound').addEventListener('click', () => {
  soundWanted = !(audioActive || audioStarting);
  saveSoundPreference();
  if (soundWanted) startAudio();
  else stopAudio();
});

$('dvd-switch').addEventListener('click', () => {
  dvdPlaying = !dvdPlaying;
  if (!dvdPlaying) {
    sound.setMusic(false);
    updateSoundControls();
  } else {
    soundWanted = true;
    saveSoundPreference();
    updateSoundControls();
    startAudio();
  }
});

document.addEventListener('click', event => {
  const button = event.target.closest?.('button');
  if (!button || button.id === 'toggle-sound' || button.id === 'dvd-switch' ||
      button.closest('#notice') || $('house').hidden || !noticeRead || !soundWanted) return;
  if (!audioActive) startAudio(button.id === 'pig' ? 'pig' : 'click');
  else if (button.id !== 'pig') sound.click();
}, true);

function showHouse() {
  $('welcome').hidden = true;
  $('house').hidden = false;
  $('change-identity').textContent = profile.nickname + ' · 切换';
  updateClock();
}

function showWelcome() {
  stopAudio();
  $('house').hidden = true;
  $('welcome').hidden = false;
  for (const input of identityForm.querySelectorAll('input[type="radio"]')) {
    input.checked = profile?.identity === input.value;
  }
  $('nickname').value = profile?.nickname ?? '';
}

try {
  const saved = JSON.parse(localStorage.getItem(profileKey) || 'null');
  if (saved && Object.hasOwn(characters, saved.identity) && typeof saved.nickname === 'string' && saved.nickname.trim()) profile = saved;
} catch {
  // An unreadable profile can be entered again.
}

identityForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(identityForm);
  const nickname = $('nickname').value.trim();
  if (!nickname) {
    $('nickname').setCustomValidity('填一个昵称再进屋吧。');
    identityForm.reportValidity();
    return;
  }
  const identity = data.get('identity');
  if (!Object.hasOwn(characters, identity)) return;
  profile = { nickname, identity };
  try {
    localStorage.setItem(profileKey, JSON.stringify(profile));
  } catch {
    notify('本机存储不可用，刷新后需要重新选择身份。');
  }
  showHouse();
  if (soundWanted && noticeRead) startAudio();
  $('change-identity').focus({ preventScroll: true });
});
$('nickname').addEventListener('input', () => $('nickname').setCustomValidity(''));
$('change-identity').addEventListener('click', () => {
  setTray(false);
  showWelcome();
  $('nickname').focus({ preventScroll: true });
});
if (profile) showHouse();
else updateClock();
updateSoundControls();
if (!noticeRead) openNotice();
