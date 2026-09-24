const SLIDE_FOLDER = 'images/slideshow/';
const AUTO_ADVANCE_MS = 5000;

let slides = [];
let currentIndex = 0;
let autoTimer = null;

const imgEl = document.getElementById('slide-img');
const counterEl = document.getElementById('slide-counter');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const slideshowEl = document.getElementById('slideshow');

function showSlide(index) {
  if (slides.length === 0) return;
  currentIndex = (index + slides.length) % slides.length;
  imgEl.src = SLIDE_FOLDER + slides[currentIndex];
  imgEl.alt = `Romp for the Rescues gallery photo ${currentIndex + 1} of ${slides.length}`;
  counterEl.textContent = `${currentIndex + 1} / ${slides.length}`;
}

function resetAutoTimer() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = setInterval(() => showSlide(currentIndex + 1), AUTO_ADVANCE_MS);
}

prevBtn.addEventListener('click', () => {
  showSlide(currentIndex - 1);
  resetAutoTimer();
});

nextBtn.addEventListener('click', () => {
  showSlide(currentIndex + 1);
  resetAutoTimer();
});

async function loadSlides() {
  try {
    const res = await fetch(SLIDE_FOLDER + 'manifest.json');
    const data = await res.json();
    slides = Array.isArray(data.images) ? data.images : [];
  } catch (err) {
    console.error('Failed to load slideshow manifest', err);
    slides = [];
  }

  if (slides.length === 0) {
    slideshowEl.innerHTML = '<p class="empty-message">No photos yet. Add images to images/slideshow and list their filenames in images/slideshow/manifest.json.</p>';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  showSlide(0);
  resetAutoTimer();
}

loadSlides();
