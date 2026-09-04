let toastTimer = null;

export function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3200);
}

export function setStaleNotice(visible, message = "Нет связи. Показано последнее сохранённое расписание.") {
  const notice = document.getElementById("stale-notice");
  if (!notice) return;
  notice.textContent = message;
  notice.classList.toggle("hidden", !visible);
}
