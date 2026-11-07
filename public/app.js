const healthEl = document.getElementById("health");
const curriculumEl = document.getElementById("curriculum");
const sessionEl = document.getElementById("session");
const programsEl = document.getElementById("programs");
const buddiesEl = document.getElementById("buddies");
const passStepBtn = document.getElementById("pass-step");
const buddyForm = document.getElementById("buddy-form");

let currentSession = null;

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `${res.status} ${res.statusText}`);
  }
  return data;
}

function showJson(el, data) {
  el.textContent = JSON.stringify(data, null, 2);
}

function showError(el, err) {
  el.textContent = `Error: ${err.message || err}`;
}

async function loadHealth() {
  try {
    const data = await api("/api/health");
    healthEl.textContent = data.ok ? "API healthy" : "API responded oddly";
    healthEl.className = `status ${data.ok ? "ok" : "bad"}`;
  } catch (err) {
    healthEl.textContent = `API down — ${err.message}`;
    healthEl.className = "status bad";
  }
}

async function loadCurriculum() {
  try {
    const data = await api("/api/curriculum");
    const steps = (data.steps || [])
      .map(
        (step, i) =>
          `<li><strong>${i + 1}. ${step.title}</strong><br /><span class="meta">${step.id} · ${step.exercise}</span><br />${step.instruction}</li>`
      )
      .join("");
    curriculumEl.innerHTML = `<p><strong>${data.title}</strong> <span class="meta">(${data.id})</span></p><ul class="plain">${steps}</ul>`;
  } catch (err) {
    showError(curriculumEl, err);
  }
}

function renderSession(payload) {
  currentSession = payload;
  showJson(sessionEl, payload);
  const canPass = payload && !payload.done && payload.nextStep;
  passStepBtn.hidden = !canPass;
}

async function startSession() {
  try {
    const payload = await api("/api/sessions", { method: "POST" });
    renderSession(payload);
  } catch (err) {
    showError(sessionEl, err);
    passStepBtn.hidden = true;
  }
}

async function passCurrentStep() {
  if (!currentSession?.session?.sessionId || !currentSession.nextStep) return;
  try {
    const payload = await api(
      `/api/sessions/${currentSession.session.sessionId}/progress`,
      {
        method: "POST",
        body: JSON.stringify({
          stepId: currentSession.nextStep.id,
          passed: true,
        }),
      }
    );
    renderSession(payload);
  } catch (err) {
    showError(sessionEl, err);
  }
}

async function loadPrograms() {
  try {
    const data = await api("/api/programs");
    const items = (data.programs || [])
      .map(
        (p) =>
          `<li><strong>${p.name}</strong><br /><span class="meta">${p.type}</span><br />${p.address}<br />${p.hours}<br /><a href="${p.link}" target="_blank" rel="noopener noreferrer">${p.link}</a></li>`
      )
      .join("");
    const note = data.note
      ? `<p class="meta">${data.note}</p>`
      : "";
    programsEl.innerHTML = `${note}<ul class="plain">${items}</ul>`;
  } catch (err) {
    showError(programsEl, err);
  }
}

async function loadBuddies() {
  try {
    const data = await api("/api/buddies");
    const posts = data.posts || [];
    if (!posts.length) {
      buddiesEl.textContent = "No buddy posts yet.";
      return;
    }
    buddiesEl.innerHTML = `<ul class="plain">${posts
      .map(
        (p) =>
          `<li><strong>${p.name}</strong> · ${p.area} · ${p.time}<br />${p.note}<br /><span class="meta">${p.createdAt}</span></li>`
      )
      .join("")}</ul>`;
  } catch (err) {
    showError(buddiesEl, err);
  }
}

document.addEventListener("click", (event) => {
  const action = event.target.getAttribute("data-action");
  if (action === "load-curriculum") loadCurriculum();
  if (action === "load-programs") loadPrograms();
  if (action === "load-buddies") loadBuddies();
  if (action === "start-session") startSession();
});

passStepBtn.addEventListener("click", passCurrentStep);

buddyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(buddyForm);
  const latRaw = String(form.get("lat") || "").trim();
  const lngRaw = String(form.get("lng") || "").trim();
  const payload = {
    name: form.get("name"),
    area: form.get("area"),
    time: form.get("time"),
    note: form.get("note"),
  };
  if (latRaw || lngRaw) {
    payload.lat = Number(latRaw);
    payload.lng = Number(lngRaw);
  }
  try {
    await api("/api/buddies", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    buddyForm.reset();
    await loadBuddies();
  } catch (err) {
    showError(buddiesEl, err);
  }
});

loadHealth();
loadCurriculum();
loadPrograms();
loadBuddies();
