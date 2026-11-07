const programsList = document.getElementById("programs-list");
const programsNote = document.getElementById("programs-note");
const buddyForm = document.getElementById("buddy-form");
const buddiesList = document.getElementById("buddies-list");
const buddyStatus = document.getElementById("buddy-status");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadPrograms() {
  try {
    const res = await fetch("/api/programs");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load programs");

    programsNote.textContent =
      data.note ||
      "Calgary community programs near you.";

    const programs = data.programs || [];
    if (!programs.length) {
      programsList.innerHTML = "<p>No programs listed yet.</p>";
      return;
    }

    programsList.innerHTML = programs
      .map((p) => {
        const phone = p.phone
          ? `<p class="prog-meta">Phone: ${escapeHtml(p.phone)}</p>`
          : "";
        const link = p.link
          ? `<a class="prog-link" href="${escapeHtml(p.link)}" target="_blank" rel="noopener noreferrer">Open details</a>`
          : "";
        return `
          <article class="program-card">
            <h3>${escapeHtml(p.name)}</h3>
            <p class="prog-type">${escapeHtml(p.type || "")}</p>
            <p>${escapeHtml(p.address || "")}</p>
            <p class="prog-meta"><strong>Hours:</strong> ${escapeHtml(p.hours || "See website")}</p>
            ${phone}
            ${link}
          </article>
        `;
      })
      .join("");
  } catch (err) {
    programsNote.textContent = err.message || "Failed to load programs";
  }
}

async function loadBuddies() {
  try {
    const res = await fetch("/api/buddies");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load buddies");
    const posts = data.posts || [];
    if (!posts.length) {
      buddiesList.innerHTML = "<li>No walking buddies posted yet.</li>";
      return;
    }
    buddiesList.innerHTML = posts
      .map(
        (p) => `
        <li>
          <strong>${escapeHtml(p.name)}</strong> · ${escapeHtml(p.area)} · ${escapeHtml(p.time)}
          <br />${escapeHtml(p.note)}
          <br /><span class="meta">${escapeHtml(p.createdAt || "")}</span>
        </li>`
      )
      .join("");
  } catch (err) {
    buddiesList.innerHTML = `<li>${escapeHtml(err.message || "Error")}</li>`;
  }
}

buddyForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  buddyStatus.textContent = "Posting…";
  const form = new FormData(buddyForm);
  const payload = {
    name: String(form.get("name") || "").trim(),
    area: String(form.get("area") || "").trim(),
    time: String(form.get("time") || "").trim(),
    note: String(form.get("note") || "").trim(),
  };
  try {
    const res = await fetch("/api/buddies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Post failed");
    buddyForm.reset();
    buddyStatus.textContent = "Posted — thank you!";
    await loadBuddies();
  } catch (err) {
    buddyStatus.textContent = err.message || "Post failed";
  }
});

loadPrograms();
loadBuddies();
