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
    const sound = new Audio('obssd_assets/audio/obssd_hit_1.mp3');
    sound.volume = pageVolume;
    sound.play().catch(() => {});
    sound.addEventListener('ended', () => sound.remove(), { once: true });
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

  function initialize() {
    addVolumeControl();
    setAudioVolume();

    document.querySelectorAll('.nav-button-container, .contact-button, #contactImageContainer').forEach((element) => {
      element.addEventListener('pointerenter', playHoverSound);
    });

    new MutationObserver(setAudioVolume).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
