// Тренажёр: темы → подтемы → задания. Данные: data/topics.json + data/tasks/<id>.json (грузятся по требованию).
// Прогресс пока хранится в браузере (localStorage). После подключения личного кабинета - на сервере.
(function () {
  const tg = window.Telegram && Telegram.WebApp;
  if (tg && tg.initData) {
    tg.ready(); tg.expand();
    document.documentElement.dataset.theme = tg.colorScheme === "dark" ? "dark" : "light";
  }

  const $ = (s, el = document) => el.querySelector(s);
  const view = $("#view");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---- хранилище прогресса ----
  const KEY = "trainer.progress.v1";
  let P = {};
  try { P = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { P = {}; }
  // P = { done: {taskId: true|false}, last: "subId/n" }
  P.done = P.done || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };

  // ---- данные ----
  let INDEX = null;
  const cache = {};
  const loadIndex = () => INDEX ? Promise.resolve(INDEX) : fetch("data/topics.json").then((r) => r.json()).then((d) => (INDEX = d));
  const loadSub = (id) => cache[id] ? Promise.resolve(cache[id]) : fetch("data/tasks/" + id + ".json").then((r) => { if (!r.ok) throw 0; return r.json(); }).then((d) => (cache[id] = d));
  const findSub = (id) => { for (const t of INDEX.topics) for (const s of t.subs) if (s.id === id) return { t, s }; return null; };

  const subStat = (s) => {
    let ok = 0, tried = 0;
    for (let i = 1; i <= s.count; i++) {
      const v = P.done[s.id + "-" + i];
      if (v !== undefined) { tried++; if (v) ok++; }
    }
    return { ok, tried, total: s.count };
  };
  const topicStat = (t) => t.subs.reduce((a, s) => { const x = subStat(s); a.ok += x.ok; a.tried += x.tried; a.total += x.total; return a; }, { ok: 0, tried: 0, total: 0 });
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const bar = (a, b) => `<div class="progress"><i style="width:${pct(a, b)}%"></i></div>`;

  // ---- меню разделов ----
  const menu = $("#menu"), overlay = $("#overlay"), search = $("#search");
  const openMenu = () => { menu.classList.add("open"); menu.setAttribute("aria-hidden", "false"); overlay.hidden = false; };
  const closeMenu = () => { menu.classList.remove("open"); menu.setAttribute("aria-hidden", "true"); overlay.hidden = true; };
  $("#openMenu").onclick = openMenu;
  $("#closeMenu").onclick = closeMenu;
  overlay.onclick = closeMenu;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  function renderTree() {
    const q = search.value.trim().toLowerCase();
    const cur = (location.hash.match(/^#\/s\/([^/]+)/) || [])[1];
    let html = "";
    for (const t of INDEX.topics) {
      const tHit = !q || t.name.toLowerCase().includes(q);
      const subs = t.subs.filter((s) => tHit || s.name.toLowerCase().includes(q));
      if (!subs.length) continue;
      const open = q || subs.some((s) => s.id === cur) ? " open" : "";
      html += `<details${open}><summary>${esc(t.name)}</summary>` +
        subs.map((s) => { const x = subStat(s); return `<a href="#/s/${s.id}"${s.id === cur ? ' class="active"' : ""}><span>${esc(s.name)}</span><span class="muted small">${x.ok}/${x.total}</span></a>`; }).join("") +
        `</details>`;
    }
    $("#tree").innerHTML = html || `<div class="empty muted">Ничего не найдено</div>`;
  }
  search.oninput = renderTree;
  $("#tree").addEventListener("click", (e) => { if (e.target.closest("a")) closeMenu(); });

  // ---- экраны ----
  function home() {
    let ok = 0, tried = 0, total = 0;
    INDEX.topics.forEach((t) => { const x = topicStat(t); ok += x.ok; tried += x.tried; total += x.total; });
    let cont = "";
    if (P.last) {
      const [sid, n] = P.last.split("/");
      const f = findSub(sid);
      if (f) cont = `<div class="note"><div class="muted small">Продолжить</div><a href="#/s/${sid}/${n}"><b>${esc(f.s.name)}</b></a> <span class="muted">· задание ${n}</span></div>`;
    }
    view.innerHTML = `
      <h1>Обзор</h1>
      <p class="muted">Выберите тему ниже или откройте «Разделы».</p>
      <div class="stats">
        <div class="stat"><b>${ok}</b><span>решено верно</span></div>
        <div class="stat"><b>${tried}</b><span>попыток</span></div>
        <div class="stat"><b>${total}</b><span>всего заданий</span></div>
      </div>
      ${cont}
      <h2>Темы</h2>
      <div class="list">${INDEX.topics.map((t) => {
        const x = topicStat(t);
        return `<a class="row" href="#/t/${t.id}"><div style="flex:1"><div class="row-title">${esc(t.name)}</div>${bar(x.ok, x.total)}</div><div class="row-meta">${t.subs.length} подтем · ${x.ok}/${x.total}</div></a>`;
      }).join("")}</div>`;
  }

  function topic(id) {
    const t = INDEX.topics.find((t) => t.id === id);
    if (!t) return notFound();
    view.innerHTML = `
      <div class="crumbs"><a href="#/">Обзор</a> / ${esc(t.name)}</div>
      <h1>${esc(t.name)}</h1>
      <h2>Подтемы</h2>
      <div class="list">${t.subs.map((s) => {
        const x = subStat(s);
        return `<a class="row" href="#/s/${s.id}"><div style="flex:1"><div class="row-title">${esc(s.name)}</div>${bar(x.ok, x.total)}</div><div class="row-meta">${x.ok}/${x.total}</div></a>`;
      }).join("")}</div>`;
  }

  async function sub(id) {
    const f = findSub(id);
    if (!f) return notFound();
    const d = await loadSub(id);
    const x = subStat(f.s);
    view.innerHTML = `
      <div class="crumbs"><a href="#/">Обзор</a> / <a href="#/t/${f.t.id}">${esc(f.t.name)}</a> / ${esc(d.name)}</div>
      <h1>${esc(d.name)}</h1>
      <p class="muted">${x.ok} из ${x.total} решено верно</p>
      ${d.theory ? `<div class="theory">${esc(d.theory)}</div>` : ""}
      <h2>Задания</h2>
      <div class="grid">${d.tasks.map((t, i) => {
        const v = P.done[t.id];
        return `<a class="cell${v === true ? " ok" : v === false ? " bad" : ""}" href="#/s/${id}/${i + 1}">${i + 1}</a>`;
      }).join("")}</div>
      <div class="legend"><span><i style="color:var(--ok)"></i>верно</span><span><i style="color:var(--bad)"></i>неверно</span><span><i style="color:var(--line)"></i>не решено</span></div>
      <div class="nav"><span></span><a class="btn primary" href="#/s/${id}/${firstOpen(d)}">Начать</a></div>`;
  }
  const firstOpen = (d) => { const i = d.tasks.findIndex((t) => P.done[t.id] !== true); return i < 0 ? 1 : i + 1; };

  const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, "").replace(",", ".").replace(/−/g, "-");

  async function task(id, n) {
    const f = findSub(id);
    if (!f) return notFound();
    const d = await loadSub(id);
    n = Math.max(1, Math.min(d.tasks.length, n | 0));
    const t = d.tasks[n - 1];
    P.last = id + "/" + n; save();
    const prev = n > 1 ? `<a class="btn" href="#/s/${id}/${n - 1}">Назад</a>` : `<span></span>`;
    const next = n < d.tasks.length ? `<a class="btn" href="#/s/${id}/${n + 1}">Дальше</a>` : `<a class="btn" href="#/s/${id}">К списку</a>`;
    const input = t.type === "choice"
      ? `<div class="opts">${t.options.map((o) => `<label class="opt"><input type="radio" name="o" value="${esc(o)}"><span>${esc(o)}</span></label>`).join("")}</div>`
      : `<div class="answer"><input class="field" id="ans" inputmode="text" autocomplete="off" placeholder="Ваш ответ"></div>`;
    view.innerHTML = `
      <div class="crumbs"><a href="#/">Обзор</a> / <a href="#/t/${f.t.id}">${esc(f.t.name)}</a> / <a href="#/s/${id}">${esc(d.name)}</a></div>
      <h1>Задание ${n} <span class="muted" style="font-weight:400">из ${d.tasks.length}</span></h1>
      <form class="task" id="tf">
        <div class="task-q">${esc(t.q)}</div>
        ${input}
        <p class="verdict" id="verdict" hidden></p>
        <div class="actions"><button class="btn primary" id="check" type="submit" disabled>Проверить</button></div>
      </form>
      <div class="nav">${prev}${next}</div>`;

    const form = $("#tf"), btn = $("#check"), ver = $("#verdict");
    const value = () => t.type === "choice" ? (($("input[name=o]:checked", form) || {}).value || "") : $("#ans").value;
    form.addEventListener("input", () => { btn.disabled = !value().trim(); });
    if (t.type !== "choice") $("#ans").focus({ preventScroll: true });
    form.onsubmit = (e) => {
      e.preventDefault();
      const v = value();
      if (!v.trim()) return;
      const ok = t.a.some((a) => norm(a) === norm(v));
      P.done[t.id] = ok; save();
      ver.hidden = false;
      ver.className = "verdict " + (ok ? "ok" : "bad");
      ver.textContent = ok ? "Верно." : "Неверно. Правильный ответ: " + t.a[0];
      if (t.type === "choice") form.querySelectorAll(".opt").forEach((l) => {
        const val = $("input", l).value;
        if (t.a.includes(val)) l.classList.add("ok"); else if (val === v) l.classList.add("bad");
      });
      form.querySelectorAll("input").forEach((i) => (i.disabled = true));
      btn.outerHTML = n < d.tasks.length ? `<a class="btn primary" href="#/s/${id}/${n + 1}">Следующее задание</a>` : `<a class="btn primary" href="#/s/${id}">Завершить подтему</a>`;
      if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred(ok ? "success" : "error");
    };
  }

  function cabinet() {
    const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    let ok = 0, tried = 0, total = 0;
    INDEX.topics.forEach((t) => { const x = topicStat(t); ok += x.ok; tried += x.tried; total += x.total; });
    view.innerHTML = `
      <div class="crumbs"><a href="#/">Обзор</a> / Личный кабинет</div>
      <h1>Личный кабинет</h1>
      <p class="muted">${u ? esc([u.first_name, u.last_name].filter(Boolean).join(" ")) : "Гость"}</p>
      <div class="note">Вход в личный кабинет выдаётся отдельно. Сейчас прогресс сохраняется только на этом устройстве.</div>
      <div class="stats">
        <div class="stat"><b>${pct(ok, total)}%</b><span>курса пройдено</span></div>
        <div class="stat"><b>${tried ? pct(ok, tried) : 0}%</b><span>точность</span></div>
        <div class="stat"><b>${ok}</b><span>верных ответов</span></div>
      </div>
      <h2>По темам</h2>
      <div class="list">${INDEX.topics.map((t) => { const x = topicStat(t); return `<a class="row" href="#/t/${t.id}"><div style="flex:1"><div class="row-title">${esc(t.name)}</div>${bar(x.ok, x.total)}</div><div class="row-meta">${pct(x.ok, x.total)}%</div></a>`; }).join("")}</div>
      <h2>Данные</h2>
      <button class="btn" id="reset">Сбросить прогресс</button>`;
    $("#reset").onclick = () => { if (confirm("Сбросить весь прогресс на этом устройстве?")) { P = { done: {} }; save(); cabinet(); } };
  }

  function notFound() { view.innerHTML = `<h1>Страница не найдена</h1><p><a href="#/">На главную</a></p>`; }

  // ---- маршруты ----
  async function route() {
    await loadIndex();
    closeMenu();
    const h = location.hash.replace(/^#\/?/, "").split("/");
    $("#cabBtn").toggleAttribute("aria-current", h[0] === "cabinet");
    try {
      if (!h[0]) home();
      else if (h[0] === "t") topic(h[1]);
      else if (h[0] === "s" && h[2]) await task(h[1], +h[2]);
      else if (h[0] === "s") await sub(h[1]);
      else if (h[0] === "cabinet") cabinet();
      else notFound();
    } catch (e) { view.innerHTML = `<h1>Не удалось загрузить</h1><p class="muted">Проверьте интернет и обновите страницу.</p>`; }
    renderTree();
    window.scrollTo(0, 0);
    if (tg && tg.BackButton && tg.initData) { h[0] ? tg.BackButton.show() : tg.BackButton.hide(); }
  }
  if (tg && tg.BackButton) tg.BackButton.onClick(() => history.back());
  window.addEventListener("hashchange", route);
  route();
})();
