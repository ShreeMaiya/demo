/* ── Dark mode toggle ─────────────────────────────────────────── */
const toggleBtn  = document.getElementById('theme-toggle');
const toggleIcon = toggleBtn.querySelector('i');

function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  toggleIcon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

// load saved preference
const savedDark = localStorage.getItem('dark') === 'true';
applyTheme(savedDark);

toggleBtn.addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('dark', !isDark);
  applyTheme(!isDark);
});


/* ── Active nav link on scroll (IntersectionObserver) ─────────── */
const sections  = document.querySelectorAll('section[id]');
const navLinks  = document.querySelectorAll('nav ul li a');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        navLinks.forEach((link) => {
          link.classList.toggle(
            'active',
            link.getAttribute('href') === '#' + entry.target.id
          );
        });
      }
    });
  },
  {
    rootMargin: '-50% 0px -50% 0px', // trigger when section is centred in viewport
  }
);

sections.forEach((sec) => observer.observe(sec));


/* ── Copy-to-clipboard helper ─────────────────────────────────── */
function copyText(element) {
  const text    = element.dataset.copy;
  const tooltip = element.querySelector('.tooltip');
  if (!text || !tooltip) return;

  navigator.clipboard.writeText(text).then(() => {
    tooltip.classList.add('show');
    setTimeout(() => tooltip.classList.remove('show'), 1800);
  }).catch(() => {
    // Fallback for browsers that block clipboard API without user gesture
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.className = 'clipboard-area';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    tooltip.classList.add('show');
    setTimeout(() => tooltip.classList.remove('show'), 1800);
  });
}


/* ── Attach copy events to chip buttons & contact cards ──────── */
document.querySelectorAll('[data-copy]').forEach((el) => {
  // click
  el.addEventListener('click', () => copyText(el));

  // keyboard (Enter / Space) for accessibility
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      copyText(el);
    }
  });
});


/* ── Smooth scroll offset for sticky nav ─────────────────────── */
// Corrects anchor scroll so section heading isn't hidden under the navbar
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const navHeight = document.querySelector('nav').offsetHeight;
    const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});
