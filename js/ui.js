// 공용 UI 유틸: 토스트, 화면 전환
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}

const SCREENS = ['map', 'district', 'ranking', 'my'];

export function showScreen(name) {
  SCREENS.forEach((s) => {
    document.getElementById('screen-' + s).classList.toggle('active', s === name);
  });
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.screen === name);
  });
  document.dispatchEvent(new CustomEvent('screenchange', { detail: name }));
}

export function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
