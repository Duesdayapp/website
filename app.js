// Duesday waitlist page.

// ONE SWITCH: set this to false to hide everything about Tests & quizzes (the feature panel, the
// button in the sample Home screens, its row in the comparison table, and its line in the FAQ).
const SHOW_QUIZZES = true;

// Signups go through Supabase's join_waitlist(). The publishable key is meant to be public (the app
// ships it too). The waitlist table itself is locked down: this key can only call join_waitlist()
// and waitlist_count(), never read anyone's email.
const SUPABASE_URL = "https://nrvyxyjekigwraiduhjp.supabase.co";
const SUPABASE_KEY = "sb_publishable_efKgk345xrfdde1EVN__qA_qzRUK3vx";
const SITE_URL = "https://duesdayapp.com/";
const SAVED_EMAIL = "duesday-waitlist-email";
// The "312 students are on the list" line only shows above this many (no tiny numbers, no made-up ones).
const COUNT_SHOWS_ABOVE = 100;

window.duesdayReady = true; // tells the page's first script that this file arrived
const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

if (!SHOW_QUIZZES) $$("[data-quizzes]").forEach((element) => element.remove());

// Where the visitor came from: ?invite=<code> from a friend, ?utm_source=tiktok from a post.
const params = new URLSearchParams(location.search);
const inviteCode = (params.get("invite") || "").trim().toLowerCase();
const invited = /^[0-9a-f]{8}$/.test(inviteCode);
const source = (params.get("utm_source") || "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40);

// ---------- The sign-up forms (the same form at the top and the bottom) ----------

const forms = $$("form.join");
const cards = $$(".signup");
const done = $("#done");
let joined = false;

// "I'm studying for…" changes what the second box asks. Saved with the school, e.g. "High school: Vincent Massey" or "Other: CPA".
const KINDS = {
  uni: { placeholder: "Start typing your school", list: "schools", prefix: "", ask: "Which school are you at? It tells us which campus to visit first." },
  high: { placeholder: "Which high school?", list: "", prefix: "High school: ", ask: "Which high school are you at?" },
  other: { placeholder: "What are you studying for?", list: "exams", prefix: "Other: ", ask: "What are you studying for? An exam like the CPA or LSAT, a course, anything." },
};

forms.forEach((form) => {
  const kind = () => KINDS[form.kind.value] || KINDS.uni;
  if (invited) $(".invited", form).hidden = false;

  $$("input[name=kind]", form).forEach((chip) => chip.addEventListener("change", () => {
    const k = kind();
    form.school.placeholder = k.placeholder;
    if (k.list) form.school.setAttribute("list", k.list); else form.school.removeAttribute("list");
    form.school.value = "";
    form.school.removeAttribute("aria-invalid");
    form.school.focus();
  }));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.website.value) return; // the hidden box only bots fill in

    const email = form.email.value.trim().toLowerCase();
    const typed = form.school.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(form, "That email doesn't look quite right.", form.email);
    if (!typed) return fail(form, kind().ask, form.school);

    await join(email, (kind().prefix + typed).slice(0, 120), form);
  });

  // Typing in a box that had a problem clears its red outline.
  form.addEventListener("input", (event) => event.target.removeAttribute("aria-invalid"));
});

async function join(email, school, form) {
  if (form) setBusy(form, true);
  try {
    const result = await callSupabase("join_waitlist", {
      email, school: school || null, invited_by: invited ? inviteCode : null, source: source || null,
    });
    save(email);
    showDone(result[0], form);
  } catch (error) {
    if (!form) return; // a quiet look-up for someone coming back
    const offline = error instanceof TypeError;
    fail(form, offline ? "Couldn't reach Duesday. Check your connection and try again." : error.message);
  } finally {
    if (form) setBusy(form, false);
  }
}

async function callSupabase(name, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Something went wrong. Try again in a minute.");
  return data;
}

// The win: your spot, your invite link, and the app's success animation.
function showDone({ spot, invite_code, total, already_joined }, form) {
  joined = true;
  document.body.classList.add("joined");
  const card = form ? form.closest(".signup") : cards[0];
  forms.forEach((each) => (each.hidden = true));
  cards.forEach((each) => {
    const note = $(".also-in", each);
    note.hidden = each === card;
    $("a", note).href = `#${card.id}`;
  });
  card.appendChild(done);
  done.hidden = false;

  $("#done-title").textContent = already_joined ? "Welcome back!" : "You're in!";
  $("#total").textContent = total > COUNT_SHOWS_ABOVE
    ? `${total.toLocaleString()} students are waiting for Duesday.`
    : "You're one of the first on the list.";
  const link = `${SITE_URL}?invite=${invite_code}`;
  $("#link").value = link;
  const pitch = "Join me on the Duesday waitlist. It turns your syllabus into a study plan.";
  $("#text-it").href = `sms:?&body=${encodeURIComponent(`${pitch} ${link}`)}`;
  if (navigator.share) $("#share").hidden = false;
  countUp($("#spot"), spot);
  if (!already_joined) confetti();
  if (form) card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
}

function fail(form, message, field) {
  const box = $(".error", form);
  box.textContent = message;
  box.hidden = false;
  $$("input", form).forEach((input) => input.removeAttribute("aria-invalid"));
  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }
  form.classList.remove("shake");
  void form.offsetWidth; // restart the shake
  form.classList.add("shake");
}

function setBusy(form, busy) {
  const button = $("button[type=submit]", form);
  button.disabled = busy;
  button.classList.toggle("loading", busy);
  if (busy) {
    $(".error", form).hidden = true;
    $$("input", form).forEach((input) => input.removeAttribute("aria-invalid"));
  }
}

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
  const colours = ["#2F7D4A", "#63BE7E", "#CDBE9E", "#FFE27A", "#22603A"];
  const origin = $(".check").getBoundingClientRect();
  for (let i = 0; i < 56; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.background = colours[i % colours.length];
    document.body.appendChild(piece);
    const angle = Math.random() * Math.PI * 2;
    const distance = 120 + Math.random() * 240;
    const x = origin.left + origin.width / 2;
    const y = origin.top + origin.height / 2;
    piece.animate([
      { transform: `translate(${x}px, ${y}px) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${x + Math.cos(angle) * distance}px, ${y + Math.sin(angle) * distance + 170}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 950 + Math.random() * 650, easing: "cubic-bezier(.2,.7,.4,1)" }).onfinish = () => piece.remove();
  }
}

// Copy and share the invite link.
const copyButton = $("#copy");
copyButton.addEventListener("click", async () => {
  const link = $("#link");
  try {
    await navigator.clipboard.writeText(link.value);
  } catch {
    link.select();
    document.execCommand("copy");
  }
  copyButton.textContent = "Copied!";
  setTimeout(() => (copyButton.textContent = "Copy"), 1800);
});

$("#share").addEventListener("click", () => {
  navigator.share({
    title: "Duesday",
    text: "Join me on the Duesday waitlist. It turns your syllabus into a study plan.",
    url: $("#link").value,
  }).catch(() => {});
});

// Coming back later shows your spot again (your email is saved only in this browser).
function save(email) {
  try { localStorage.setItem(SAVED_EMAIL, email); } catch {}
}
try {
  const saved = localStorage.getItem(SAVED_EMAIL);
  if (saved) join(saved, null, null);
} catch {}

// How many students are on the list: real, from the database, and only once it's a real crowd.
callSupabase("waitlist_count", {}).then((count) => {
  if (typeof count !== "number" || count <= COUNT_SHOWS_ABOVE) return;
  $$(".live-count").forEach((line) => {
    line.textContent = `${count.toLocaleString()} students are already on the list.`;
    line.classList.add("fade-in");
  });
}).catch(() => {});

// ---------- Scroll: things animate in once, and the little app screens only loop while visible ----------

const reveals = $$(".reveal");
const loops = $$(".loop");
if (!("IntersectionObserver" in window) || reduceMotion) {
  reveals.forEach((element) => element.classList.add("in"));
} else {
  const seen = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("in");
    seen.unobserve(entry.target);
  }), { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  reveals.forEach((element) => seen.observe(element));

  loops.forEach((element) => element.classList.add("paused"));
  const playing = new IntersectionObserver((entries) => entries.forEach((entry) => {
    entry.target.classList.toggle("paused", !entry.isIntersecting);
  }), { threshold: 0.05 });
  loops.forEach((element) => playing.observe(element));

  // The slim "Join the waitlist" bar on phones: only while neither form is on screen.
  const bar = $(".stickybar");
  const visibleCards = new Set();
  const cardWatch = new IntersectionObserver((entries) => {
    entries.forEach((entry) => (entry.isIntersecting ? visibleCards.add(entry.target) : visibleCards.delete(entry.target)));
    bar.classList.toggle("show", visibleCards.size === 0 && !joined);
  });
  cards.forEach((card) => cardWatch.observe(card));
  $("a", bar).addEventListener("click", (event) => {
    // Jump to whichever form is closer.
    const nearTop = scrollY < (root.scrollHeight - innerHeight) / 2;
    const card = nearTop ? cards[0] : cards[cards.length - 1];
    event.preventDefault();
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    const email = $("input[name=email]", card);
    if (email) setTimeout(() => email.focus({ preventScroll: true }), 650);
  });
}

// ---------- "What do I need?": real sliders with the app's real math (GradeMath) ----------
// A sample class part-way through the term, a little under its goal. Everything still to come needs the
// same average. Drag one slider and it becomes a "what if"; the rest move to what you'd then need.

const need = $("#need");
if (need) {
  const goal = { letter: "B+", percent: 77 };
  const marked = [[5, 72], [10, 78], [25, 68]]; // [weight %, mark %] for what's been marked so far
  const letters = [[90, "A+"], [85, "A"], [80, "A-"], [77, "B+"], [73, "B"], [70, "B-"], [67, "C+"], [63, "C"], [60, "C-"], [50, "D"], [0, "F"]];
  const letterFor = (percent) => letters.find(([cutoff]) => percent >= cutoff)[1];
  const earned = marked.reduce((sum, [weight, mark]) => sum + (weight * mark) / 100, 0); // points banked out of 100
  const thumb = 28; // px, so the coloured part of the track ends under the middle of the thumb

  const rows = $$(".need-row", need).map((row) => ({
    row, range: $("input", row), out: $("output", row),
    weight: Number(row.dataset.weight), name: $("label", row).firstChild.textContent.trim(), whatIf: null,
  }));
  const cap = $("#need-cap");
  const big = $("#need-big");
  const sub = $("#need-sub");
  const reset = $("#need-reset");

  const show = (item, value, word) => {
    item.range.value = value;
    item.range.style.setProperty("--p", `calc(${value}% + ${(0.5 - value / 100) * thumb}px)`);
    item.row.classList.toggle("pinned", item.whatIf !== null);
    item.out.innerHTML = `<small>${word}</small>${value}%`;
    item.range.setAttribute("aria-valuetext", `${item.name}: ${word} ${value}%`);
  };

  const update = () => {
    const pinned = rows.filter((item) => item.whatIf !== null);
    const open = rows.filter((item) => item.whatIf === null);
    const banked = earned + pinned.reduce((sum, item) => sum + (item.weight * item.whatIf) / 100, 0);
    const openWeight = open.reduce((sum, item) => sum + item.weight, 0);
    const needed = open.length ? ((goal.percent - banked) / openWeight) * 100 : 0;
    pinned.forEach((item) => show(item, item.whatIf, "what if"));

    let lines;
    if (!open.length) {
      // every item has a what-if: this is where you'd finish
      const short = goal.percent - banked;
      lines = ["You'd finish with about", `${banked.toFixed(1)}%`, short <= 0
        ? `${letterFor(banked)}. That reaches your ${goal.letter}.`
        : `${letterFor(banked)}. About ${short.toFixed(1)} points short of your ${goal.letter}.`];
    } else if (needed <= 0) {
      open.forEach((item) => show(item, 0, "even"));
      lines = [`Your ${goal.letter} is`, "locked in", `Even zeros on the rest finish at about ${banked.toFixed(1)}%.`];
    } else if (needed > 100) {
      const best = banked + openWeight;
      open.forEach((item) => show(item, 100, "even"));
      lines = [`A ${goal.letter} is out of reach from here. Still in play:`, letterFor(best), `The best possible finish is about ${best.toFixed(1)}%.`];
    } else {
      open.forEach((item) => show(item, Math.round(needed), "need"));
      lines = [`For your ${goal.letter} you need about`, `${Math.round(needed)}%`, `on the ${pinned.length ? "other " : ""}${openWeight}% that's left`];
    }
    cap.textContent = lines[0];
    sub.textContent = lines[2];
    if (big.textContent !== lines[1]) {
      big.textContent = lines[1];
      big.classList.remove("pop");
      void big.offsetWidth;
      big.classList.add("pop");
    }
    reset.hidden = !pinned.length;
  };

  rows.forEach((item) => item.range.addEventListener("input", () => {
    item.whatIf = Number(item.range.value);
    update();
  }));
  reset.addEventListener("click", () => {
    rows.forEach((item) => (item.whatIf = null));
    update();
  });
  update();
}
