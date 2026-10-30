// Duesday waitlist: joins through Supabase's join_waitlist() and shows your spot and invite link.
// The publishable key is meant to be public (the app ships it too). The waitlist table itself is
// locked down: this key can only call join_waitlist(), never read anyone's email.
const SUPABASE_URL = "https://nrvyxyjekigwraiduhjp.supabase.co";
const SUPABASE_KEY = "sb_publishable_efKgk345xrfdde1EVN__qA_qzRUK3vx";
const SITE_URL = "https://duesdayapp.com/";
const SAVED_EMAIL = "duesday-waitlist-email";

const form = document.getElementById("join");
const button = form.querySelector("button[type=submit]");
const errorBox = document.getElementById("error");
const done = document.getElementById("done");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const inviteCode = (new URLSearchParams(location.search).get("invite") || "").trim().toLowerCase();
if (/^[0-9a-f]{8}$/.test(inviteCode)) document.getElementById("invited").hidden = false;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (form.website.value) return; // the hidden box only bots fill in

  const email = form.email.value.trim().toLowerCase();
  const school = form.school.value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("That email doesn't look quite right.", form.email);
  if (!school) return fail("Which school are you at? It tells us which campus to visit first.", form.school);

  await join(email, school);
});

async function join(email, school, quiet = false) {
  setBusy(true);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/join_waitlist`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, school: school || null, invited_by: inviteCode || null }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || "Something went wrong. Try again in a minute.");
    const [result] = body;
    save(email);
    showDone(result);
  } catch (error) {
    if (quiet) return;
    const offline = error instanceof TypeError;
    fail(offline ? "Couldn't reach Duesday. Check your connection and try again." : error.message);
  } finally {
    setBusy(false);
  }
}

function showDone({ spot, invite_code, total, already_joined }) {
  form.hidden = true;
  done.hidden = false;
  done.classList.add("fade-in");
  document.getElementById("done-title").textContent = already_joined ? "Welcome back!" : "You're in!";
  document.getElementById("total").textContent =
    total === 1 ? "You're the first student on the list." : `${total.toLocaleString()} students are waiting for Duesday.`;
  document.getElementById("link").value = `${SITE_URL}?invite=${invite_code}`;
  if (navigator.share) document.getElementById("share").hidden = false;
  countUp(document.getElementById("spot"), spot);
  if (!already_joined) confetti();
}

function fail(message, field) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  form.querySelectorAll("input").forEach((input) => input.removeAttribute("aria-invalid"));
  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }
  form.classList.remove("shake");
  void form.offsetWidth; // restart the shake
  form.classList.add("shake");
}

function setBusy(busy) {
  button.disabled = busy;
  button.classList.toggle("loading", busy);
  if (busy) {
    errorBox.hidden = true;
    form.querySelectorAll("input").forEach((input) => input.removeAttribute("aria-invalid"));
  }
}

// Typing in a box that had a problem clears its red outline.
form.addEventListener("input", (event) => event.target.removeAttribute("aria-invalid"));

function countUp(element, target) {
  if (reduceMotion) return (element.textContent = target.toLocaleString());
  const start = performance.now();
  const duration = 700;
  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.max(1, Math.round(target * eased)).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function confetti() {
  if (reduceMotion) return;
  const colours = ["--green", "--orange", "--blue", "--red"].map((name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  const origin = document.querySelector(".check").getBoundingClientRect();
  for (let i = 0; i < 48; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.background = colours[i % colours.length];
    document.body.appendChild(piece);
    const angle = Math.random() * Math.PI * 2;
    const distance = 120 + Math.random() * 220;
    const x = origin.left + origin.width / 2;
    const y = origin.top + origin.height / 2;
    piece.animate([
      { transform: `translate(${x}px, ${y}px) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${x + Math.cos(angle) * distance}px, ${y + Math.sin(angle) * distance + 160}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 600, easing: "cubic-bezier(.2,.7,.4,1)" }).onfinish = () => piece.remove();
  }
}

// Copy and share the invite link.
const copyButton = document.getElementById("copy");
copyButton.addEventListener("click", async () => {
  const link = document.getElementById("link");
  try {
    await navigator.clipboard.writeText(link.value);
  } catch {
    link.select();
    document.execCommand("copy");
  }
  copyButton.textContent = "Copied!";
  copyButton.animate([{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }],
    { duration: reduceMotion ? 1 : 300, easing: "cubic-bezier(.34,1.56,.64,1)" });
  setTimeout(() => (copyButton.textContent = "Copy"), 1800);
});

document.getElementById("share").addEventListener("click", () => {
  navigator.share({
    title: "Duesday",
    text: "Join me on the Duesday waitlist. It turns your syllabus into a study plan.",
    url: document.getElementById("link").value,
  }).catch(() => {});
});

// Coming back later shows your spot again (saved only in this browser).
function save(email) {
  try { localStorage.setItem(SAVED_EMAIL, email); } catch {}
}
try {
  const saved = localStorage.getItem(SAVED_EMAIL);
  if (saved) join(saved, null, true);
} catch {}
