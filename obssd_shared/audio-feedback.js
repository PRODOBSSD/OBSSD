(function () {
  const storageKey = 'obssd-volume';
  const defaultVolume = 0.5;
  const volume = Number.parseFloat(localStorage.getItem(storageKey));
  let pageVolume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : defaultVolume;

  function setAudioVolume() {
    document.querySelectorAll('audio').forEach((audio) => {
      audio.volume = pageVolume;
    });
  }

  function playHoverSound() {
    const sound = new Audio('obssd_assets/audio/obssd_hit_1.wav');
    sound.volume = pageVolume;
    sound.play().catch(() => {});
    sound.addEventListener('ended', () => sound.remove(), { once: true });
  }

  function playClickSound() {
    const sound = new Audio('obssd_assets/audio/obssd_hit_2.wav');
    sound.volume = pageVolume;
    sound.play().catch(() => {});
    sound.addEventListener('ended', () => sound.remove(), { once: true });
  }

  function flash(element) {
    element.classList.remove('flash');
    void element.offsetWidth;
    element.classList.add('flash');
    window.setTimeout(() => element.classList.remove('flash'), 30);
  }

  function continueClick(element, event, pendingWindow) {
    const link = element.closest('a');
    if (link) {
      if (link.target === '_blank') {
        window.open(link.href, '_blank');
      } else {
        window.location.href = link.href;
      }
      return;
    }

    const destinations = {
      visualsButton: 'https://obssd.online/visuals',
      musicButton: 'https://obssd.online/music',
      storeButton: 'https://obssd.online/store',
      contactImageContainer: 'https://obssd.online/contact',
      contact3DContainer: 'https://obssd.online/contact',
      'contact-3d-canvas': 'https://obssd.online/contact'
    };
    if (destinations[element.id]) {
      window.location.href = destinations[element.id];
      return;
    }

    if (typeof element.onclick === 'function') {
      if (pendingWindow) {
        const inlineClick = element.getAttribute('onclick') || '';
        const destination = inlineClick.match(/window\.open\(['"]([^'"]+)['"],\s*['"]_blank['"]\)/);
        if (destination) {
          pendingWindow.location.href = destination[1];
          return;
        }
      }
      element.onclick.call(element, event);
    }
  }

  function handleClick(event) {
    let element = event.target.closest('.nav-button-container, .contact-button, #contactImageContainer, .logo-img, #contact3DContainer, #contact-3d-canvas, button');
    if (!element) return;
    if (element.id === 'contact-3d-canvas') {
      element = element.closest('#contact3DContainer') || element;
    }
    if (element.closest('#obssd-volume-control')) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    flash(element);
    playClickSound();

    element.classList.add('is-loading');
    element.style.pointerEvents = 'none';

    let pendingWindow = null;
    const inlineClick = element.getAttribute('onclick') || '';
    if (inlineClick.includes("window.open(") && inlineClick.includes("'_blank'")) {
      pendingWindow = window.open('', '_blank');
    }
    window.setTimeout(() => {
      element.classList.remove('is-loading');
      element.style.pointerEvents = '';
      continueClick(element, event, pendingWindow);
    }, 150);
  }

  function addVolumeControl() {
    if (document.getElementById('obssd-volume-control')) return;

    const wrapper = document.createElement('label');
    wrapper.id = 'obssd-volume-control';
    wrapper.title = 'Volume';
    wrapper.innerHTML = '<span aria-hidden="true">VOL</span><input type="range" min="0" max="1" step="0.01" value="' + pageVolume + '" aria-label="Volume">';
    document.body.appendChild(wrapper);

    wrapper.querySelector('input').addEventListener('input', (event) => {
      pageVolume = Number.parseFloat(event.target.value);
      localStorage.setItem(storageKey, pageVolume.toString());
      setAudioVolume();
    });
  }

  function bindHoverTargets(root = document) {
    root.querySelectorAll('.nav-button-container, .contact-button, #contactImageContainer, #contact3DContainer, .logo-img, #contact-3d-canvas').forEach((element) => {
      if (element.dataset.obssdHoverBound === 'true') return;
      element.dataset.obssdHoverBound = 'true';
      element.addEventListener('pointerenter', playHoverSound);
    });
  }

  function initialize() {
    addVolumeControl();
    setAudioVolume();
    bindHoverTargets();
    document.addEventListener('click', handleClick, true);

    new MutationObserver(() => {
      setAudioVolume();
      bindHoverTargets();
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
