import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('contact-3d-canvas');
const container = document.getElementById('contact3DContainer');

if (canvas && container) {
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 1000);
  camera.position.set(0, 0.25, 4.6);
  camera.lookAt(0, -0.1, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const ambient = new THREE.HemisphereLight(0xfff9f2, 0x3a312f, 3.8);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff4d6, 4.2);
  keyLight.position.set(2.2, 2.8, 3.5);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xcfd7ff, 2.2);
  fillLight.position.set(-2.2, 1.2, -2.5);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xffffff, 18, 12, 2);
  rimLight.position.set(0, 1.4, 2.8);
  scene.add(rimLight);

  const contactRoot = new THREE.Group();
  scene.add(contactRoot);

  let contactModel = null;
  let contactMixer = null;
  const pointer = { x: 0, y: 0 };

  function resizeRenderer() {
    const rect = container.getBoundingClientRect();
    const width = Math.max(160, rect.width);
    const height = Math.max(100, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    if (window.matchMedia('(max-width: 768px), (pointer: coarse)').matches) {
      camera.position.set(0, 0.15, 4.2);
      camera.lookAt(0, -0.15, 0);
    } else {
      camera.position.set(0, 0.25, 4.6);
      camera.lookAt(0, -0.1, 0);
    }
  }

  function setModelScale(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.15 / maxDim;
    model.scale.setScalar(scale);

    const center = box.getCenter(new THREE.Vector3());
    model.position.set(-center.x * scale, -center.y * scale - 0.7, -center.z * scale);
    model.rotation.y = Math.PI * 0.55;
    contactRoot.position.set(0.1, -0.15, 0);
  }

  new GLTFLoader().load(
    '/obssd_assets/3d_models/OBSSD_WEBSITE_CONTACT.glb',
    (gltf) => {
      contactModel = gltf.scene;
      contactModel.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = false;
          node.receiveShadow = false;
        }
      });

      const contactAnimation = THREE.AnimationClip.findByName(gltf.animations, 'Contact_Animation');
      if (contactAnimation) {
        contactMixer = new THREE.AnimationMixer(contactModel);
        const action = contactMixer.clipAction(contactAnimation);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
      }

      setModelScale(contactModel);
      contactRoot.add(contactModel);
    },
    undefined,
    (error) => {
      console.error('Unable to load OBSSD_WEBSITE_CONTACT.glb', error);
    }
  );

  container.addEventListener('pointermove', (event) => {
    const rect = container.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    pointer.x = (x - 0.5) * 2;
    pointer.y = (0.5 - y) * 2;
  });

  container.addEventListener('pointerleave', () => {
    pointer.x = 0;
    pointer.y = 0;
  });

  resizeRenderer();
  window.addEventListener('resize', resizeRenderer);

  function animate() {
    if (contactMixer) {
      contactMixer.update(0.016);
    }

    if (contactModel) {
      contactModel.rotation.y += (pointer.x * 0.7 - contactModel.rotation.y) * 0.08;
      contactModel.rotation.x = THREE.MathUtils.lerp(contactModel.rotation.x, pointer.y * 0.5, 0.08);
      contactModel.position.y = Math.sin(performance.now() * 0.0018) * 0.08;
    }

    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(animate);
}
