// ╔═══════════════════════════════════════════════════════════════════╗
// ║                    ВСЕ НАСТРОЙКИ САЙТА — ЗДЕСЬ                     ║
// ╚═══════════════════════════════════════════════════════════════════╝
// Собраны в одном месте в самом начале файла, чтобы не искать нужную
// настройку по всему коду. Ниже по файлу — только логика, её менять
// для обычной подстройки внешнего вида/текстов не требуется.

// --- Адрес API, откуда сайт берёт список групп и расписание ---
const API_BASE_URL = "https://famcsschedulebot.yarashsei.workers.dev";
const SCHEDULE_ENDPOINT = "/api/schedule";
const GROUPS_ENDPOINT = "/api/groups";

// --- НАСТРОЙКА: текст информационной плашки, которая появляется ПОСЛЕ
// Субботы (под всеми днями недели), без названия дня — просто текст.
// Впишите сюда нужный текст вручную. Перенос строки внутри строки JS
// (через \n) сохранится на экране благодаря white-space: pre-wrap в
// styles.css (.info-panel-text). Пустая строка "" — плашка скрыта
// автоматически (см. renderInfoPanel ниже по файлу). ---
const INFO_PANEL_TEXT = "Поздравляем команду Team Spirit с победой на The International 2026! И Мишу Флаффи с уверенным достижением ранга Рыцарь 5!!";

// ═══════════════════════════════════════════════════════════════════
// НАСТРОЙКА: КНОПКА "НАВЕРХ" (кружок со стрелкой в правом нижнем углу)
// ═══════════════════════════════════════════════════════════════════
const SCROLL_TOP_BTN_CIRCLE_COLOR  = "#1C1C1E";
const SCROLL_TOP_BTN_ARROW_COLOR   = "#fcfaea";
const SCROLL_TOP_BTN_SIZE          = 46;
const SCROLL_TOP_BTN_OFFSET_BOTTOM = 34;
const SCROLL_TOP_BTN_OFFSET_RIGHT  = 22;
const SCROLL_TOP_DURATION_MS = 320;

// ═══════════════════════════════════════════════════════════════════
// НАСТРОЙКА: ПЛАШКА ВЫБОРА КУРСА/ГРУППЫ (bottom sheet)
// ═══════════════════════════════════════════════════════════════════
const PICKER_SHEET_ANIMATION_MS = 280;

// ═══════════════════════════════════════════════════════════════════
// НАСТРОЙКА: ПРОКРУТКА К ДНЮ НЕДЕЛИ (кнопки Пн–Сб и автопереход)
// ═══════════════════════════════════════════════════════════════════
// Зазор между прилипшей (sticky) плашкой навигации и началом дня
const DAY_SCROLL_OFFSET_PX = 6;
const DAY_SCROLL_DURATION_MS = 340;

// ═══════════════════════════════════════════════════════════════════
// НАСТРОЙКА: ЛЁГКАЯ ВИБРАЦИЯ (haptic feedback)
// ═══════════════════════════════════════════════════════════════════
const HAPTIC_LEVELS = [null, "light", "medium", "heavy", "rigid", "soft"];

const HAPTIC_PICKER_SELECT = 1;
const HAPTIC_LOAD_BUTTON   = 3;
const HAPTIC_SCROLL_TOP    = 1;

function triggerHaptic(level) {
    if (!level) return;
    const style = HAPTIC_LEVELS[level];
    if (!style) return;
    try {
        const tg = window.Telegram && window.Telegram.WebApp;
        if (tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred) {
            tg.HapticFeedback.impactOccurred(style);
        }
    } catch (e) {}
}

const appState = {
    currentCourse: null,
    currentGroup: null,
    scheduleData: null,
    isLoading: false,
};

function initApp() {
    console.log("Инициализация приложения...");
    initializeTelegramWebApp();
    setupEventListeners();
    setupCustomSelects();
    restoreSavedState();
    setupDayNavigation();
    setupStickyDayNav();
    setupScrollTopButton();
    console.log("Приложение инициализировано");
}

function initializeTelegramWebApp() {
    if (typeof window.Telegram !== "undefined" && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        try {
            tg.expand();
            if (tg.disableClosingConfirmation) tg.disableClosingConfirmation();
            const headerColor = "#0f0f11";
            const bgColor = "#0f0f11";
            if (tg.setHeaderColor) tg.setHeaderColor(headerColor);
            if (tg.setBackgroundColor) tg.setBackgroundColor(bgColor);
            if (tg.setBottomBarColor) tg.setBottomBarColor(bgColor);
        } catch(e) {
            console.warn("Ошибка настройки UI Telegram:", e);
        }
        tg.ready();
    }
}

function safeGetStorage(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}
function safeSetStorage(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
}
function safeRemoveStorage(key) {
    try { localStorage.removeItem(key); } catch (e) {}
}

function setupEventListeners() {
    const courseSelect = document.getElementById("course-select");
    const groupSelect = document.getElementById("group-select");
    const loadButton = document.getElementById("load-button");

    courseSelect.addEventListener("change", async (e) => {
        const course = e.target.value;
        appState.currentCourse = course;
        appState.currentGroup = null;
        if (course) {
            safeSetStorage("selectedCourse", course);
            safeRemoveStorage("selectedGroup");
            await loadGroups(course);
        } else {
            safeRemoveStorage("selectedCourse");
            safeRemoveStorage("selectedGroup");
            groupSelect.innerHTML = '<option value="">Сначала выберите курс</option>';
            groupSelect.disabled = true;
            syncSelectTrigger(groupSelect);
        }
    });

    groupSelect.addEventListener("change", (e) => {
        appState.currentGroup = e.target.value;
        if (appState.currentGroup) {
            safeSetStorage("selectedGroup", appState.currentGroup);
        } else {
            safeRemoveStorage("selectedGroup");
        }
    });

    loadButton.addEventListener("click", () => {
        triggerHaptic(HAPTIC_LOAD_BUTTON);
        if (!appState.currentCourse || !appState.currentGroup) {
            showError("Выберите курс и группу");
            return;
        }
        loadSchedule(appState.currentCourse, appState.currentGroup);
    });
}

const PICKER_SELECT_TRIGGERS = {
    "course-select": { trigger: "course-select-trigger", text: "course-select-trigger-text", title: "Курс" },
    "group-select":  { trigger: "group-select-trigger",  text: "group-select-trigger-text",  title: "Группа" },
};

function syncSelectTrigger(selectEl) {
    if (!selectEl) return;
    const map = PICKER_SELECT_TRIGGERS[selectEl.id];
    if (!map) return;
    const trigger = document.getElementById(map.trigger);
    const textEl = document.getElementById(map.text);
    if (!trigger || !textEl) return;

    const selectedOption = selectEl.options[selectEl.selectedIndex];
    textEl.textContent = selectedOption ? selectedOption.textContent : "";
    trigger.classList.toggle("placeholder", !selectEl.value);
    trigger.disabled = selectEl.disabled;
}

function setupCustomSelects() {
    const overlay = document.getElementById("picker-overlay");
    const sheet = document.getElementById("picker-sheet");
    const titleEl = document.getElementById("picker-sheet-title");
    const listEl = document.getElementById("picker-sheet-list");
    const closeBtn = document.getElementById("picker-sheet-close");
    if (!overlay || !sheet || !listEl) return;

    overlay.style.setProperty("--picker-anim-ms", PICKER_SHEET_ANIMATION_MS + "ms");

    let activeSelect = null;
    let closeTimer = null;

    function renderList(selectEl) {
        listEl.innerHTML = "";
        Array.from(selectEl.options).forEach(opt => {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "picker-sheet-item";
            if (!opt.value) item.classList.add("picker-sheet-item-placeholder");
            if (opt.value && opt.value === selectEl.value) item.classList.add("active");

            const labelSpan = document.createElement("span");
            labelSpan.textContent = opt.textContent;
            item.appendChild(labelSpan);

            if (opt.value && opt.value === selectEl.value) {
                item.insertAdjacentHTML("beforeend", `
                    <svg class="picker-sheet-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5"/>
                    </svg>`);
            }

            item.addEventListener("click", () => {
                triggerHaptic(HAPTIC_PICKER_SELECT);
                selectEl.value = opt.value;
                selectEl.dispatchEvent(new Event("change", { bubbles: true }));
                syncSelectTrigger(selectEl);
                closePicker();
            });

            listEl.appendChild(item);
        });
    }

    function openPicker(selectEl) {
        if (!selectEl || selectEl.disabled) return;
        clearTimeout(closeTimer);
        activeSelect = selectEl;
        const map = PICKER_SELECT_TRIGGERS[selectEl.id];
        titleEl.textContent = map ? map.title : "";
        renderList(selectEl);

        overlay.classList.remove("hidden");
        requestAnimationFrame(() => {
            overlay.classList.add("open");
        });
        document.body.style.overflow = "hidden";

        const trigger = map ? document.getElementById(map.trigger) : null;
        if (trigger) trigger.setAttribute("aria-expanded", "true");
    }

    function closePicker() {
        overlay.classList.remove("open");
        document.body.style.overflow = "";

        const map = activeSelect ? PICKER_SELECT_TRIGGERS[activeSelect.id] : null;
        const trigger = map ? document.getElementById(map.trigger) : null;
        if (trigger) trigger.setAttribute("aria-expanded", "false");

        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => {
            overlay.classList.add("hidden");
        }, PICKER_SHEET_ANIMATION_MS);
    }

    Object.keys(PICKER_SELECT_TRIGGERS).forEach(selectId => {
        const map = PICKER_SELECT_TRIGGERS[selectId];
        const trigger = document.getElementById(map.trigger);
        const selectEl = document.getElementById(selectId);
        if (!trigger || !selectEl) return;
        trigger.addEventListener("click", () => openPicker(selectEl));
        syncSelectTrigger(selectEl);
    });

    if (closeBtn) closeBtn.addEventListener("click", closePicker);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closePicker();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.classList.contains("open")) closePicker();
    });
}

function setupDayNavigation() {
    const navButtons = document.querySelectorAll('.day-nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const day = btn.getAttribute('data-day');
            scrollToDay(day);
            // Сразу снимаем фокус с кнопки после тапа — доп. страховка от
            // "залипающей" рамки/обводки, которую некоторые Android WebView
            // (в т.ч. внутри Telegram) рисуют вокруг сфокусированной кнопки
            // и не всегда корректно скрывают через одни только CSS-правила.
            btn.blur();
        });
    });
}

// Следит за маячком #day-nav-sentinel (см. index.html) через
// IntersectionObserver: как только он уходит из видимой области —
// значит #day-navigation (у неё position: sticky в styles.css) реально
// прилипла к верху экрана, и на неё добавляется класс .is-stuck
// (тень снизу — см. styles.css). Ранее эта функция была только в
// комментариях и нигде не вызывалась, поэтому класс .is-stuck никогда
// не добавлялся.
function setupStickyDayNav() {
    const sentinel = document.getElementById('day-nav-sentinel');
    const nav = document.getElementById('day-navigation');
    if (!sentinel || !nav) return;

    // root — тот же скролл-контейнер, что и у остального сайта
    // (.main-content). Если его вдруг нет в разметке, передаём null —
    // тогда IntersectionObserver будет ориентироваться на viewport.
    const root = document.querySelector('.main-content') || null;

    const observer = new IntersectionObserver(
        ([entry]) => {
            nav.classList.toggle('is-stuck', !entry.isIntersecting);
        },
        { root, threshold: 0 }
    );
    observer.observe(sentinel);
}

function getScrollingElement() {
    const candidates = [
        document.querySelector(".main-content"),
        document.documentElement,
        document.body,
    ];
    for (const el of candidates) {
        if (el && el.scrollHeight - el.clientHeight > 1) return el;
    }
    return document.documentElement;
}

function scrollToDay(day, behavior = "smooth") {
    const target = document.getElementById(`day-${day}`);
    if (!target) return false;

    const el = getScrollingElement();
    const targetRect = target.getBoundingClientRect();
    
    // Высчитываем высоту липкой шапки навигации, чтобы дни не прятались под ней
    const nav = document.getElementById('day-navigation');
    const navHeight = nav && !nav.classList.contains('hidden') ? nav.offsetHeight : 0;

    // Вычисляем дистанцию с учётом высоты шапки
    const delta = targetRect.top - navHeight - DAY_SCROLL_OFFSET_PX;

    if (Math.abs(delta) > 0.5) {
        if (behavior === "instant") {
            el.scrollTop += delta;
        } else {
            animateScrollTo(el, el.scrollTop + delta, DAY_SCROLL_DURATION_MS);
        }
    }

    return true;
}

const WEEKDAY_NAMES_RU = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

function scrollToCurrentDay() {
    const todayIndex = new Date().getDay();
    for (let i = 0; i < 7; i++) {
        const dayName = WEEKDAY_NAMES_RU[(todayIndex + i) % 7];
        if (scrollToDay(dayName, "instant")) return;
    }
}

// ═══════════════════════════════════════════════════════════════════
// ОБРАБОТКА СКРОЛЛА (Scroll Spy и кнопка "Наверх")
// ═══════════════════════════════════════════════════════════════════

function updateScrollTopVisibility() {
    const btn = document.getElementById("scroll-top-btn");
    const controlsSection = document.querySelector(".controls-section");
    const scheduleContainer = document.getElementById("schedule-container");
    if (!btn || !controlsSection || !scheduleContainer) return;

    const scheduleVisible = !scheduleContainer.classList.contains("hidden");
    if (!scheduleVisible) {
        btn.classList.remove("visible");
        return;
    }

    // Если блок с выбором группы ушел выше экрана — показываем кнопку
    const controlsRect = controlsSection.getBoundingClientRect();
    const scrolledPastTop = controlsRect.bottom < 0;
    btn.classList.toggle("visible", scrolledPastTop);
}

// Подсвечивает текущий активный день в липкой навигации
function updateActiveDay() {
    const dayBlocks = document.querySelectorAll('.day-block');
    if (dayBlocks.length === 0) return;

    const nav = document.getElementById('day-navigation');
    if (!nav || nav.classList.contains('hidden')) return;

    const navRect = nav.getBoundingClientRect();
    // Линия срабатывания: сразу под прилипшей шапкой + небольшой буфер
    const triggerLine = navRect.bottom + DAY_SCROLL_OFFSET_PX + 20;

    let activeDay = null;
    for (const block of dayBlocks) {
        const rect = block.getBoundingClientRect();
        if (rect.top <= triggerLine) {
            activeDay = block.id.replace('day-', '');
        } else {
            break; 
        }
    }

    // Если доскроллили до самого низа (с учетом overscroll) — выделяем последний день
    const scrollEl = getScrollingElement();
    const isAtBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2;
    if (isAtBottom && dayBlocks.length > 0) {
        activeDay = dayBlocks[dayBlocks.length - 1].id.replace('day-', '');
    }

    // Если мы на самом верху и расписание видно — выделяем первый день (или снимаем выделение)
    if (!activeDay) {
        const firstBlock = dayBlocks[0];
        if (firstBlock && firstBlock.getBoundingClientRect().top < window.innerHeight) {
            activeDay = firstBlock.id.replace('day-', '');
        }
    }

    document.querySelectorAll('.day-nav-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-day') === activeDay);
    });
}

// Единый обработчик для всех зависимых от скролла функций
function handleGlobalScroll() {
    updateScrollTopVisibility();
    updateActiveDay();
}

function positionScrollTopButton() {}

function animateScrollTo(el, targetTop, duration) {
    const startTop = el.scrollTop;
    const distance = targetTop - startTop;
    if (Math.abs(distance) < 1) return;

    const startTime = performance.now();
    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    function step(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        el.scrollTop = startTop + distance * easeOutCubic(t);
        if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function scrollAppToTop() {
    animateScrollTo(getScrollingElement(), 0, SCROLL_TOP_DURATION_MS);
}

function setupScrollTopButton() {
    const btn = document.getElementById("scroll-top-btn");
    const wrapper = document.getElementById("scroll-top-btn-position");
    if (!btn || !wrapper) return;

    btn.style.width = SCROLL_TOP_BTN_SIZE + "px";
    btn.style.height = SCROLL_TOP_BTN_SIZE + "px";
    btn.style.backgroundColor = SCROLL_TOP_BTN_CIRCLE_COLOR;
    btn.style.color = SCROLL_TOP_BTN_ARROW_COLOR;

    wrapper.style.right  = `calc(${SCROLL_TOP_BTN_OFFSET_RIGHT}px + env(safe-area-inset-right, 0px))`;
    wrapper.style.bottom = `calc(${SCROLL_TOP_BTN_OFFSET_BOTTOM}px + env(safe-area-inset-bottom, 0px))`;

    btn.addEventListener("click", () => {
        triggerHaptic(HAPTIC_SCROLL_TOP);
        scrollAppToTop();
    });

    const scrollContainer = document.querySelector(".main-content");
    if (scrollContainer) {
        scrollContainer.addEventListener("scroll", handleGlobalScroll, { passive: true });
    }
    window.addEventListener("scroll", handleGlobalScroll, { passive: true });
    window.addEventListener("resize", handleGlobalScroll);

    handleGlobalScroll();
}

async function restoreSavedState() {
    const savedCourse = safeGetStorage("selectedCourse");
    const savedGroup = safeGetStorage("selectedGroup");
    if (savedCourse) {
        appState.currentCourse = savedCourse;
        const courseSelect = document.getElementById("course-select");
        courseSelect.value = savedCourse;
        syncSelectTrigger(courseSelect);
        const groupsLoaded = await loadGroups(savedCourse);
        if (groupsLoaded && savedGroup) {
            const groupSelect = document.getElementById("group-select");
            if (Array.from(groupSelect.options).some(opt => opt.value === savedGroup)) {
                appState.currentGroup = savedGroup;
                groupSelect.value = savedGroup;
                syncSelectTrigger(groupSelect);
                await loadSchedule(savedCourse, savedGroup);
                requestAnimationFrame(scrollToCurrentDay);
            }
        }
    }
}

async function loadGroups(course) {
    const groupSelect = document.getElementById("group-select");
    groupSelect.innerHTML = '<option value="">Загрузка...</option>';
    groupSelect.disabled = true;
    syncSelectTrigger(groupSelect);
    hideError();
    try {
        const url = new URL(API_BASE_URL + GROUPS_ENDPOINT);
        url.searchParams.append("course", course);
        const response = await fetch(url);
        if (!response.ok) throw new Error("Ошибка при загрузке групп");
        const result = await response.json();
        
        if (result.success && result.data.groups) {
            groupSelect.innerHTML = '<option value="">Выберите группу</option>';
            
            const sortedGroups = result.data.groups.sort((a, b) => 
                a.groupName.localeCompare(b.groupName, 'ru', { numeric: true })
            );

            sortedGroups.forEach(group => {
                const option = document.createElement("option");
                option.value = group.groupName;
                option.textContent = group.groupName;
                groupSelect.appendChild(option);
            });
            groupSelect.disabled = false;
            syncSelectTrigger(groupSelect);
            return true;
        } else {
            throw new Error("Группы не найдены");
        }
    } catch (error) {
        console.error(error);
        // ИСПРАВЛЕНО: Человечная ошибка сети, если fetch выкинул TypeError (нет интернета)
        const msg = error.name === "TypeError" ? "Проверьте подключение к интернету" : error.message;
        showError(`Не удалось загрузить список групп: ${msg}`);
        groupSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
        syncSelectTrigger(groupSelect);
        return false;
    }
}

async function loadSchedule(course, group) {
    showLoading(true);
    hideError();
    try {
        const url = new URL(API_BASE_URL + SCHEDULE_ENDPOINT);
        url.searchParams.append("course", course);
        url.searchParams.append("group", group);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
        const data = await response.json();

        // ИСПРАВЛЕНО: Защита от состояния гонки (Race condition)
        // Если юзер быстро нажал на другую группу пока летел запрос — игнорируем ответ
        if (appState.currentCourse !== String(course) || appState.currentGroup !== String(group)) {
            return; 
        }

        if (data.success) {
            appState.scheduleData = data.data;
            displaySchedule(data.data);
        } else {
            throw new Error(data.message || "Ошибка при получении данных");
        }
    } catch (error) {
        console.error(error);
        // ИСПРАВЛЕНО: Человечная ошибка сети, если fetch выкинул TypeError (нет интернета)
        const msg = error.name === "TypeError" ? "Проверьте подключение к интернету" : error.message;
        showError(`Ошибка загрузки: ${msg}`);
    } finally {
        showLoading(false);
    }
}

function renderInfoPanel() {
    const panel = document.getElementById("info-panel");
    const textEl = document.getElementById("info-panel-text");
    if (!panel || !textEl) return;

    const text = (INFO_PANEL_TEXT || "").trim();
    if (text) {
        textEl.textContent = INFO_PANEL_TEXT;
        panel.classList.remove("hidden");
    } else {
        panel.classList.add("hidden");
    }
}

function formatTime(time) {
    if (time === null || time === undefined) return '';
    return String(time).replace(/\./g, ':');
}

function timeToMinutes(time) {
    if (time === null || time === undefined) return Infinity;
    const match = String(time).trim().match(/^(\d{1,2})[:.](\d{2})$/);
    if (!match) return Infinity;
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    return hours * 60 + minutes;
}

function displaySchedule(scheduleData) {
    const scheduleContainer = document.getElementById("schedule-container");
    const welcomeSection = document.getElementById("welcome-section");
    const scheduleDays = document.getElementById("schedule-days");
    const emptyState = document.getElementById("empty-state");
    const scheduleTitle = document.getElementById("schedule-title");
    const scheduleMetadata = document.getElementById("schedule-metadata");
    const dayNavigation = document.getElementById("day-navigation");

    welcomeSection.classList.add("hidden");
    scheduleContainer.classList.remove("hidden");
    dayNavigation.classList.remove("hidden");
    renderInfoPanel();

    const groupSelect = document.getElementById("group-select");
    const selectedGroupName = groupSelect.options[groupSelect.selectedIndex].text;
    scheduleTitle.textContent = `Расписание: ${selectedGroupName}`;
    scheduleMetadata.textContent = `Курс: ${appState.currentCourse} | Обновлено: ${new Date().toLocaleString("ru-RU")}`;

    scheduleDays.innerHTML = "";
    const classes = scheduleData.classes || [];

    if (classes.length === 0) {
        emptyState.classList.remove("hidden");
        handleGlobalScroll();
        return;
    }
    emptyState.classList.add("hidden");

    const groupedByDay = new Map();
    classes.forEach(cls => {
        const day = cls.dayOfWeekName;
        if (!groupedByDay.has(day)) groupedByDay.set(day, []);
        groupedByDay.get(day).push(cls);
    });

    groupedByDay.forEach(dayClasses => {
        dayClasses.sort((a, b) => {
            const diff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
            if (diff !== 0) return diff;
            return timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
        });
    });

    groupedByDay.forEach((dayClasses, day) => {
        const dayBlock = document.createElement("div");
        dayBlock.className = "day-block";
        dayBlock.id = `day-${day}`;

        const dayHeader = document.createElement("div");
        dayHeader.className = "day-header";
        dayHeader.innerHTML = `<span class="day-name">${escapeHtml(day)}</span>`;
        dayBlock.appendChild(dayHeader);

        const classesContainer = document.createElement("div");
        classesContainer.className = "classes-container";

        dayClasses.forEach(cls => {
            const slotDiv = document.createElement("div");
            slotDiv.className = "class-slot" + (cls.isLecture ? " is-lecture" : "");

            const timeDiv = document.createElement("div");
            timeDiv.className = "class-time";
            const timeStart = document.createElement("span");
            timeStart.className = "time-start";

            timeStart.textContent = formatTime(cls.startTime);

            const timeEnd = document.createElement("span");
            timeEnd.className = "time-end";

            timeEnd.textContent   = formatTime(cls.endTime);

            timeDiv.appendChild(timeStart);
            timeDiv.appendChild(timeEnd);
            slotDiv.appendChild(timeDiv);

            const infoDiv = document.createElement("div");
            infoDiv.className = "class-info";

            if (cls.isCommon) {
                infoDiv.classList.add("class-common");
                infoDiv.innerHTML = buildClassInfoHTML(cls.subgroupA, cls.isLecture);
            } else {
                infoDiv.classList.add("class-split");
                const left = document.createElement("div");
                left.className = "subgroup subgroup-a";
                left.innerHTML = buildClassInfoHTML(cls.subgroupA, cls.isLecture);
                const right = document.createElement("div");
                right.className = "subgroup subgroup-b";
                right.innerHTML = buildClassInfoHTML(cls.subgroupB, cls.isLecture);
                infoDiv.appendChild(left);
                infoDiv.appendChild(right);
            }
            slotDiv.appendChild(infoDiv);
            classesContainer.appendChild(slotDiv);
        });

        dayBlock.appendChild(classesContainer);
        scheduleDays.appendChild(dayBlock);
    });

    // Сразу после отрисовки расписания обновляем липкую навигацию
    requestAnimationFrame(handleGlobalScroll);
}

function buildClassInfoHTML(subgroup, isLecture = false) {
    if (!subgroup || (!subgroup.classTitle && !subgroup.professorName && !subgroup.classroom)) {
        return '<div style="color: var(--ink-faint); font-size: 16px; margin: auto;">—</div>';
    }

    const professorHTML = subgroup.professorName
        ? `<div class="class-professor">${escapeHtml(subgroup.professorName)}</div>`
        : '';

    const footerHTML = (isLecture || subgroup.classroom)
        ? `<div class="class-footer">
            ${isLecture ? '<span class="class-type">Лекция</span>' : ''}
            ${subgroup.classroom ? `<span class="class-room">${escapeHtml(subgroup.classroom)}</span>` : ''}
        </div>`
        : '';

    let html = `
        <div class="class-detail">
            <span class="class-title">${escapeHtml(subgroup.classTitle || "")}</span>
        </div>
        ${professorHTML}
        ${footerHTML}`;

    if (subgroup.comments) {
        html += `
        <div class="class-comments">${escapeHtml(subgroup.comments)}</div>`;
    }

    return html;
}

function showLoading(show) {
    document.getElementById("loading-spinner").classList.toggle("hidden", !show);
    document.getElementById("load-button").disabled = show;
}

function showError(msg) {
    const el = document.getElementById("error-message");
    if (el) {
        el.textContent = msg;
        el.classList.remove("hidden");
    }
}

function hideError() {
    const el = document.getElementById("error-message");
    if (el) el.classList.add("hidden");
}

function escapeHtml(text) {
    if (typeof text !== "string") return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

window.addEventListener("error", e => {
    if (e.message && (e.message.includes('Telegram') || e.message.includes('Script error'))) return;
    showError("Произошла неожиданная ошибка. Попробуйте обновить страницу.");
});
window.addEventListener("unhandledrejection", e => {
    console.error(e.reason);
});
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}