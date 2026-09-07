import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const isMobileDevice = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

if (isMobileDevice) {
    document.body.classList.add('mobile-no-webgl');
} else {
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1919');

let camera = new THREE.PerspectiveCamera(
    35,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 1.45, 7);
camera.lookAt(0, 1.25, 0);

const renderer = new THREE.WebGLRenderer({
    antialias: !isMobileDevice,
    alpha: false,
    powerPreference: isMobileDevice ? 'low-power' : 'high-performance'
});
renderer.setPixelRatio(isMobileDevice ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = !isMobileDevice;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setAnimationLoop(animate);
renderer.domElement.style.display = 'block';
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.width = '100vw';
renderer.domElement.style.height = '100vh';
renderer.domElement.style.zIndex = '0';
renderer.domElement.style.pointerEvents = 'none';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(renderer.domElement);

const pointer = new THREE.Vector2();
const pointerTarget = new THREE.Vector3();
const pointerRay = new THREE.Raycaster();
let headBone;
let headRestWorldRotation;
let headRestWorldForward;
let idleMixer;
let lastFrameTime = performance.now();
const eyeBones = [];
const eyeRestWorldRotations = new Map();
const eyeLookInfluence = 0.55;
const blinkMeshes = [];
const blinkOpenDuration = 150;
let blinkStartedAt = -Infinity;
let lastRenderTime = performance.now();
let lastPointerX = 0;
let lastPointerY = 0;
const headPosition = new THREE.Vector3();
const direction = new THREE.Vector3();
const eyeDirection = new THREE.Vector3();
const eyeForward = new THREE.Vector3();
const deltaRotation = new THREE.Quaternion();
const desiredWorldRotation = new THREE.Quaternion();
const parentRotation = new THREE.Quaternion();
const currentHeadWorldRotation = new THREE.Quaternion();
const headRotationDelta = new THREE.Quaternion();
const inheritedEyeWorldRotation = new THREE.Quaternion();
const eyeLookRotation = new THREE.Quaternion();
const subtleEyeLookRotation = new THREE.Quaternion();
const desiredEyeWorldRotation = new THREE.Quaternion();
const eyeParentWorldRotation = new THREE.Quaternion();
const desiredEyeLocalRotation = new THREE.Quaternion();
const modelRoot = new THREE.Group();
scene.add(modelRoot);

function toStandardMaterial(material) {
    const toonMaterial = new THREE.MeshToonMaterial({
        color: material.color ? material.color.clone() : 0xffffff,
        map: material.map || null,
        normalMap: material.normalMap || null,
        normalScale: material.normalScale ? material.normalScale.clone() : undefined,
        aoMap: material.aoMap || null,
        aoMapIntensity: material.aoMapIntensity ?? 1,
        emissive: material.emissive ? material.emissive.clone() : 0x000000,
        emissiveMap: material.emissiveMap || null,
        emissiveIntensity: material.emissiveIntensity ?? 1,
        transparent: material.transparent,
        opacity: material.opacity,
        alphaTest: material.alphaTest,
        side: material.side,
        depthTest: material.depthTest,
        depthWrite: material.depthWrite,
        vertexColors: material.vertexColors
    });

    toonMaterial.name = material.name;
    toonMaterial.side = THREE.FrontSide;
    toonMaterial.depthTest = true;
    toonMaterial.depthWrite = true;
    return toonMaterial;
}

new GLTFLoader().load(
    '../obssd_assets/3d_models/OBSSD_WEBSITE_VERSION.glb',
    (gltf) => {
        const model = gltf.scene;
        idleMixer = new THREE.AnimationMixer(model);
        const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'OBSSD_IDLE');
        if (idleClip) {
            idleMixer.clipAction(idleClip).setLoop(THREE.LoopRepeat, Infinity).play();
        } else {
            console.warn('OBSSD_IDLE animation not found in OBSSD_WEBSITE_VERSION.glb.');
        }
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());

        // Normalize the imported Blender scene so the fixed camera is predictable.
        const modelHeight = Math.max(size.y, 0.001);
        model.scale.setScalar(3 / modelHeight);
        model.position.sub(center.multiplyScalar(model.scale.x));
        model.position.y += 1.5;
        modelRoot.add(model);

        if (gltf.cameras && gltf.cameras.length > 0) {
            camera = gltf.cameras[0];
            camera.near = Math.max(camera.near, 0.01);
            camera.far = Math.max(camera.far, 1000);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        }

        const cameraLight = new THREE.PointLight(0xfff4e8, 28, 0, 2);
        cameraLight.castShadow = !isMobileDevice;
        cameraLight.shadow.mapSize.set(1024, 1024);
        cameraLight.shadow.bias = -0.0005;
        camera.add(cameraLight);

        const fillLight = new THREE.HemisphereLight(0xfff8ef, 0x6b6258, 0.35);
        scene.add(fillLight);

        model.traverse((node) => {
            if (node.isMesh || node.isSkinnedMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                const blinkIndex = node.morphTargetDictionary?.BLINK;
                if (blinkIndex !== undefined && node.morphTargetInfluences) {
                    blinkMeshes.push({ node, index: blinkIndex });
                }
                node.material = Array.isArray(node.material)
                    ? node.material.map(toStandardMaterial)
                    : toStandardMaterial(node.material);
            }

            const normalizedName = node.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normalizedName === 'defspine006') {
                headBone = node;
            }
            if (normalizedName === 'defeyel' || normalizedName === 'defeyer') {
                eyeBones.push(node);
            }
        });

        if (!headBone) {
            model.traverse((node) => {
                const normalizedName = node.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (normalizedName === 'spine006' || normalizedName === 'head') {
                    headBone = node;
                }
            });
        }

        model.updateMatrixWorld(true);
        if (headBone) {
            headRestWorldRotation = headBone.getWorldQuaternion(new THREE.Quaternion());
            headRestWorldForward = new THREE.Vector3(0, 0, 1);
            eyeBones.forEach((eyeBone) => {
                eyeRestWorldRotations.set(
                    eyeBone,
                    eyeBone.getWorldQuaternion(new THREE.Quaternion())
                );
            });
        } else {
            console.warn('No head bone found in OBSSD_WEBSITE_VERSION.glb.');
        }
    },
    undefined,
    (error) => console.error('Unable to load OBSSD_WEBSITE_VERSION.glb', error)
);

function updatePointerTarget() {
    pointerRay.setFromCamera(pointer, camera);
    pointerTarget.copy(pointerRay.ray.origin).add(pointerRay.ray.direction.multiplyScalar(1.5));

    if (!headBone) {
        return;
    }

    headBone.getWorldPosition(headPosition);
    direction.copy(pointerTarget).sub(headPosition).normalize();
    deltaRotation.setFromUnitVectors(headRestWorldForward, direction);
    desiredWorldRotation.copy(deltaRotation).multiply(headRestWorldRotation);

    if (headBone.parent) {
        headBone.parent.getWorldQuaternion(parentRotation);
        parentRotation.invert();
    } else {
        parentRotation.identity();
    }

    const desiredLocalRotation = parentRotation.multiply(desiredWorldRotation);
    headBone.quaternion.slerp(desiredLocalRotation, 0.18);

    headBone.updateMatrixWorld(true);
    headBone.getWorldQuaternion(currentHeadWorldRotation);
    headRotationDelta.copy(currentHeadWorldRotation).multiply(headRestWorldRotation.clone().invert());

    eyeBones.forEach((eyeBone) => {
        inheritedEyeWorldRotation.copy(headRotationDelta).multiply(eyeRestWorldRotations.get(eyeBone));
        eyeDirection.copy(pointerTarget).sub(headPosition).normalize();
        eyeForward.set(0, 1, 0).applyQuaternion(inheritedEyeWorldRotation);
        eyeLookRotation.setFromUnitVectors(
            eyeForward,
            eyeDirection
        );
        subtleEyeLookRotation.identity().slerp(eyeLookRotation, eyeLookInfluence);
        desiredEyeWorldRotation.copy(subtleEyeLookRotation).multiply(inheritedEyeWorldRotation);
        if (eyeBone.parent) {
            eyeBone.parent.getWorldQuaternion(eyeParentWorldRotation);
            eyeParentWorldRotation.invert();
        } else {
            eyeParentWorldRotation.identity();
        }
        desiredEyeLocalRotation.copy(eyeParentWorldRotation).multiply(desiredEyeWorldRotation);
        eyeBone.quaternion.slerp(desiredEyeLocalRotation, 0.18);
    });
}

function animate() {
    const currentTime = performance.now();
    const elapsed = currentTime - lastRenderTime;
    if (elapsed < 33) return;

    if (idleMixer) {
        idleMixer.update(Math.min((currentTime - lastFrameTime) / 1000, 0.1));
    }
    lastFrameTime = currentTime;
    if (pointer.x !== lastPointerX || pointer.y !== lastPointerY) {
        updatePointerTarget();
        lastPointerX = pointer.x;
        lastPointerY = pointer.y;
    }
    updateBlink();
    renderer.render(scene, camera);
    lastRenderTime = currentTime;
}

function updateBlink() {
    const elapsed = performance.now() - blinkStartedAt;
    const blinkAmount = Math.max(1 - (elapsed / blinkOpenDuration), 0);

    blinkMeshes.forEach(({ node, index }) => {
        node.morphTargetInfluences[index] = blinkAmount;
    });
}

window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('click', () => {
    if (blinkMeshes.length > 0) {
        blinkStartedAt = performance.now();
        blinkMeshes.forEach(({ node, index }) => {
            node.morphTargetInfluences[index] = 1;
        });
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        renderer.setAnimationLoop(null);
    } else {
        lastFrameTime = performance.now();
        lastRenderTime = lastFrameTime - 33;
        renderer.setAnimationLoop(animate);
    }
});

window.addEventListener('resize', () => {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setSize(window.innerWidth, window.innerHeight);
}