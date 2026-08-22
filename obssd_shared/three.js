import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1919');
const isMobileDevice = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

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
const eyeBones = [];
const eyeRestWorldRotations = new Map();
const eyeLookInfluence = 0.55;
const blinkMeshes = [];
const blinkDuration = 240;
let blinkStartedAt = -Infinity;
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

    const headPosition = new THREE.Vector3();
    headBone.getWorldPosition(headPosition);
    const direction = pointerTarget.clone().sub(headPosition).normalize();
    const deltaRotation = new THREE.Quaternion().setFromUnitVectors(headRestWorldForward, direction);
    const desiredWorldRotation = deltaRotation.multiply(headRestWorldRotation);
    const parentRotation = new THREE.Quaternion();

    if (headBone.parent) {
        headBone.parent.getWorldQuaternion(parentRotation);
        parentRotation.invert();
    }

    const desiredLocalRotation = parentRotation.multiply(desiredWorldRotation);
    headBone.quaternion.slerp(desiredLocalRotation, 0.18);

    headBone.updateMatrixWorld(true);
    const currentHeadWorldRotation = headBone.getWorldQuaternion(new THREE.Quaternion());
    const headRotationDelta = currentHeadWorldRotation
        .multiply(headRestWorldRotation.clone().invert());

    eyeBones.forEach((eyeBone) => {
        const inheritedEyeWorldRotation = headRotationDelta
            .clone()
            .multiply(eyeRestWorldRotations.get(eyeBone));
        const eyeDirection = pointerTarget.clone().sub(headPosition).normalize();
        const eyeForward = new THREE.Vector3(0, 1, 0)
            .applyQuaternion(inheritedEyeWorldRotation);
        const eyeLookRotation = new THREE.Quaternion().setFromUnitVectors(
            eyeForward,
            eyeDirection
        );
        const subtleEyeLookRotation = new THREE.Quaternion().slerp(
            eyeLookRotation,
            eyeLookInfluence
        );
        const desiredEyeWorldRotation = subtleEyeLookRotation
            .multiply(inheritedEyeWorldRotation);
        const eyeParentWorldRotation = eyeBone.parent
            ? eyeBone.parent.getWorldQuaternion(new THREE.Quaternion()).invert()
            : new THREE.Quaternion();
        const desiredEyeLocalRotation = eyeParentWorldRotation.multiply(desiredEyeWorldRotation);
        eyeBone.quaternion.slerp(desiredEyeLocalRotation, 0.18);
    });
}

function animate() {
    updatePointerTarget();
    updateBlink();
    renderer.render(scene, camera);
}

function updateBlink() {
    const elapsed = performance.now() - blinkStartedAt;
    const progress = Math.min(Math.max(elapsed / blinkDuration, 0), 1);
    const blinkAmount = progress < 0.5
        ? progress * 2
        : (1 - progress) * 2;

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
    }
});

window.addEventListener('resize', () => {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setSize(window.innerWidth, window.innerHeight);