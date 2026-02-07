document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "expenses";

  const SALARIES_PER_MONTH = 1;

  const PERIOD_LABELS = {
    daily: "Ежедневные",
    weekly: "Еженедельные",
    monthly: "Ежемесячные",
    yearly: "Ежегодные"
  };

  const PERIOD_ORDER = ["daily", "weekly", "monthly", "yearly"];

  const PERIOD_MULTIPLIER = {
    daily: 365 / 12,
    weekly: 52 / 12,
    monthly: 1,
    yearly: 1 / 12
  };

  const periodSelect    = document.getElementById("period");
  const titleInput      = document.getElementById("title");
  const amountInput     = document.getElementById("amount");
  const saveButton      = document.getElementById("save");

  const listEl          = document.getElementById("list");
  const mainValueEl     = document.getElementById("mainValue");
  const totalYearValueEl = document.getElementById("totalYearValue");

  const loader          = document.getElementById("loader");

  const confirmModal    = document.getElementById("confirmModal");
  const cancelDelete    = document.getElementById("cancelDelete");
  const confirmDelete   = document.getElementById("confirmDelete");

  const editModal       = document.getElementById("editModal");
  const editPeriod      = document.getElementById("editPeriod");
  const editTitle       = document.getElementById("editTitle");
  const editAmount      = document.getElementById("editAmount");
  const cancelEdit      = document.getElementById("cancelEdit");
  const confirmEdit     = document.getElementById("confirmEdit");

  const exportJsonBtn   = document.getElementById("exportJson");
  const importJsonBtn   = document.getElementById("importJson");
  const importFileInput = document.getElementById("importFile");

  let deleteId = null;
  let editId   = null;

  function formatNumber(num) {
    return Math.round(num).toLocaleString('ru-RU');
  }

  // ────────────────────────────────────────────────
  // Хранение в localStorage для PWA
  // ────────────────────────────────────────────────

  function getExpenses() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  function saveExpenses(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  // ────────────────────────────────────────────────
  // Регистрация service worker для PWA
  // ────────────────────────────────────────────────

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered', reg))
      .catch(err => console.error('Service Worker registration failed', err));
  }

  // ────────────────────────────────────────────────
  // Остальной код без изменений
  // ────────────────────────────────────────────────

  saveButton.onclick = () => {
    const title = titleInput.value.trim();
    const amount = Number(amountInput.value);
    const period = periodSelect.value;

    if (!title || amount <= 0 || isNaN(amount)) {
      alert("Заполните описание и сумму > 0");
      return;
    }

    const items = getExpenses();
    items.push({ id: crypto.randomUUID(), title, amount, period });
    saveExpenses(items);

    titleInput.value = "";
    amountInput.value = "";
    render();
  };

  async function render() {
    loader.classList.remove("hidden");

    try {
      const items = getExpenses();
      listEl.innerHTML = "";

      let monthlyTotal = 0;
      const grouped = {};
      const periodSums = { daily: 0, weekly: 0, monthly: 0, yearly: 0 };

      items.forEach(item => {
        const coef = PERIOD_MULTIPLIER[item.period] || 1;
        monthlyTotal += item.amount * coef;

        grouped[item.period] = grouped[item.period] || [];
        grouped[item.period].push(item);

        if (periodSums[item.period] !== undefined) {
          periodSums[item.period] += item.amount;
        }
      });

      Object.values(grouped).forEach(group => {
        group.sort((a, b) => b.amount - a.amount);
      });

      const needToSave = monthlyTotal / SALARIES_PER_MONTH;
      const totalPerYear = monthlyTotal * 12;

      mainValueEl.textContent     = formatNumber(needToSave) + " ₽";
      totalYearValueEl.textContent = formatNumber(totalPerYear) + " ₽";

      PERIOD_ORDER.forEach(period => {
        if (!grouped[period] || grouped[period].length === 0) return;

        const sum = periodSums[period];
        const titleLi = document.createElement("li");
        titleLi.className = "group-title";
        titleLi.innerHTML = `
          ${PERIOD_LABELS[period]}
          <strong>${formatNumber(sum)} ₽</strong>
        `;
        listEl.appendChild(titleLi);

        grouped[period].forEach(item => {
          const li = document.createElement("li");
          li.className = "item";
          li.innerHTML = `
            <span>${item.title} — ${formatNumber(item.amount)} ₽</span>
            <button class="delete-btn">✕</button>
          `;

          li.addEventListener("click", e => {
            if (e.target.classList.contains("delete-btn")) return;
            editId = item.id;
            editPeriod.value = item.period;
            editTitle.value = item.title;
            editAmount.value = item.amount;
            editModal.classList.remove("hidden");
          });

          li.querySelector(".delete-btn").onclick = e => {
            e.stopPropagation();
            deleteId = item.id;
            confirmModal.classList.remove("hidden");
          };

          listEl.appendChild(li);
        });
      });
    } catch (err) {
      console.error("Ошибка рендера:", err);
    } finally {
      loader.classList.add("hidden");
    }
  }

  cancelDelete.onclick = () => {
    deleteId = null;
    confirmModal.classList.add("hidden");
  };

  confirmDelete.onclick = () => {
    if (!deleteId) return;
    const items = getExpenses();
    saveExpenses(items.filter(i => i.id !== deleteId));
    deleteId = null;
    confirmModal.classList.add("hidden");
    render();
  };

  cancelEdit.onclick = () => {
    editId = null;
    editModal.classList.add("hidden");
  };

  confirmEdit.onclick = () => {
    if (!editId) return;

    const title = editTitle.value.trim();
    const amount = Number(editAmount.value);
    const period = editPeriod.value;

    if (!title || amount <= 0 || isNaN(amount)) {
      alert("Заполните описание и сумму > 0");
      return;
    }

    const items = getExpenses();
    const item = items.find(i => i.id === editId);
    if (item) {
      item.title = title;
      item.amount = amount;
      item.period = period;
      saveExpenses(items);
    }

    editId = null;
    editModal.classList.add("hidden");
    render();
  };

  // Экспорт JSON
  exportJsonBtn.onclick = () => {
    const items = getExpenses();
    const json = JSON.stringify(items, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expenses.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Импорт JSON
  importJsonBtn.onclick = () => {
    importFileInput.click();
  };

  importFileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm("Импорт перезапишет все текущие расходы. Продолжить?")) {
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const items = JSON.parse(event.target.result);
        if (!Array.isArray(items)) throw new Error("Неверный формат");
        // Простая валидация
        items.forEach(item => {
          if (!item.id || !item.title || isNaN(item.amount) || !PERIOD_MULTIPLIER[item.period]) {
            throw new Error("Неверные данные в файле");
          }
        });
        saveExpenses(items);
        render();
        alert("Импорт успешен");
      } catch (err) {
        alert("Ошибка импорта: " + err.message);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  render();
});