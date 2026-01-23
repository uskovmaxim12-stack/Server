// =================== КОНФИГУРАЦИЯ ===================
const CONFIG = {
    CAR: {
        MASS: 1500,
        ENGINE_POWER: 40000,
        STEERING_POWER: 20000,
        BRAKE_POWER: 30000,
        MAX_SPEED: 180,
        DRAG_COEFFICIENT: 0.35
    },
    PHYSICS: {
        GRAVITY: 9.82,
        TIME_STEP: 1/60,
        SOLVER_ITERATIONS: 10,
        ALLOW_SLEEP: false
    },
    DAMAGE: {
        DEFORMATION_FACTOR: 0.05,
        PART_DETACH_THRESHOLD: 0.8,
        DAMAGE_DECAY: 0.995
    },
    VISUAL: {
        CAR_COLOR: 0x2980b9,
        GROUND_COLOR: 0x2c3e50,
        OBSTACLE_COLORS: [0xe74c3c, 0x9b59b6, 0x3498db, 0xf1c40f],
        SHADOW_SIZE: 512
    }
};

// =================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===================
let scene, camera, renderer, world, controls, stats;
let carGroup, carBody, carPhysicsBody, carParts = [];
let obstacles = [], lights = [];
let keys = {}, gameStats = { damage: 0, collisions: 0, maxSpeed: 0 };
let lastCollisionTime = 0, slowMotion = true;
let physicsDebug = false, debugMeshes = [];

// =================== КОМПОНЕНТЫ ИНТЕРФЕЙСА ===================
const ui = {
    speed: document.getElementById('speed'),
    damage: document.getElementById('damage'),
    damageFill: document.getElementById('damageFill'),
    collisions: document.getElementById('collisions'),
    resetBtn: document.getElementById('resetBtn'),
    showPhysics: document.getElementById('showPhysics'),
    slowMotion: document.getElementById('slowMotion'),
    crashEffect: document.getElementById('crashEffect'),
    loading: document.getElementById('loading')
};

// =================== ИНИЦИАЛИЗАЦИЯ ===================
async function init() {
    try {
        await createScene();
        await createPhysicsWorld();
        await createEnvironment();
        await createCar();
        await setupLights();
        await setupControls();
        await setupEventListeners();
        
        setTimeout(() => {
            ui.loading.style.opacity = '0';
            setTimeout(() => ui.loading.style.display = 'none', 500);
        }, 1000);
        
        animate();
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        ui.loading.innerHTML = 'Ошибка загрузки. Пожалуйста, обновите страницу.';
    }
}

async function createScene() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0f3460, 10, 200);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 8, 15);
    
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    const container = document.getElementById('gameContainer');
    container.appendChild(renderer.domElement);
    
    stats = new Stats();
    stats.dom.style.position = 'absolute';
    stats.dom.style.top = '60px';
    stats.dom.style.right = '20px';
    container.appendChild(stats.dom);
}

async function createPhysicsWorld() {
    world = new CANNON.World();
    world.gravity = new CANNON.Vec3(0, -CONFIG.PHYSICS.GRAVITY, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = CONFIG.PHYSICS.SOLVER_ITERATIONS;
    world.allowSleep = CONFIG.PHYSICS.ALLOW_SLEEP;
}

async function createEnvironment() {
    // Земля
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
        color: CONFIG.VISUAL.GROUND_COLOR,
        side: THREE.DoubleSide
    });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);
    
    // Препятствия
    const obstacleConfigs = [
        { type: 'box', size: [3, 4, 3], pos: [15, 2, 0], rot: [0, 0, 0] },
        { type: 'cylinder', radius: 2, height: 6, pos: [-12, 3, 8], rot: [0, 0, 0] },
        { type: 'box', size: [2, 6, 2], pos: [8, 3, -10], rot: [0, Math.PI/4, 0] },
        { type: 'cylinder', radius: 1.5, height: 8, pos: [-5, 4, -15], rot: [0, 0, 0] },
        { type: 'box', size: [4, 3, 1], pos: [20, 1.5, 12], rot: [0, Math.PI/3, 0] },
        { type: 'box', size: [1, 8, 1], pos: [-18, 4, -5], rot: [0, 0, Math.PI/6] },
        { type: 'cylinder', radius: 2.5, height: 5, pos: [0, 2.5, 20], rot: [0, 0, 0] },
        { type: 'box', size: [5, 2, 5], pos: [25, 1, -8], rot: [0, Math.PI/6, 0] }
    ];
    
    obstacleConfigs.forEach((config, index) => {
        let mesh, shape;
        const color = CONFIG.VISUAL.OBSTACLE_COLORS[index % CONFIG.VISUAL.OBSTACLE_COLORS.length];
        
        if (config.type === 'box') {
            mesh = new THREE.Mesh(
                new THREE.BoxGeometry(...config.size),
                new THREE.MeshLambertMaterial({ color })
            );
            shape = new CANNON.Box(new CANNON.Vec3(
                config.size[0]/2, config.size[1]/2, config.size[2]/2
            ));
        } else {
            mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(config.radius, config.radius, config.height, 16),
                new THREE.MeshLambertMaterial({ color })
            );
            shape = new CANNON.Cylinder(config.radius, config.radius, config.height, 16);
        }
        
        mesh.position.set(...config.pos);
        mesh.rotation.set(...config.rot);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(shape);
        body.position.set(...config.pos);
        body.quaternion.setFromEuler(...config.rot);
        world.addBody(body);
        
        obstacles.push({ mesh, body });
    });
    
    // Дорога
    const roadGeometry = new THREE.PlaneGeometry(100, 8);
    const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x34495e });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    scene.add(road);
    
    // Разметка
    for (let i = -40; i <= 40; i += 4) {
        const lineGeometry = new THREE.PlaneGeometry(0.5, 4);
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.rotation.x = Math.PI / 2;
        line.position.set(i, 0.02, 0);
        scene.add(line);
    }
}

async function createCar() {
    carGroup = new THREE.Group();
    scene.add(carGroup);
    
    // Кузов (основная часть)
    const bodyGeometry = new THREE.BoxGeometry(3, 1.2, 6);
    const bodyMaterial = new THREE.MeshLambertMaterial({ 
        color: CONFIG.VISUAL.CAR_COLOR,
        roughness: 0.8,
        metalness: 0.2
    });
    carBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
    carBody.castShadow = true;
    carBody.receiveShadow = true;
    carGroup.add(carBody);
    
    // Капот (отдельная деформируемая часть)
    const hoodGeometry = new THREE.BoxGeometry(2.8, 0.6, 2);
    const hood = new THREE.Mesh(hoodGeometry, bodyMaterial);
    hood.position.set(0, 0.9, 1.8);
    hood.castShadow = true;
    carGroup.add(hood);
    
    // Багажник
    const trunkGeometry = new THREE.BoxGeometry(2.8, 0.8, 1.5);
    const trunk = new THREE.Mesh(trunkGeometry, bodyMaterial);
    trunk.position.set(0, 0.8, -2);
    trunk.castShadow = true;
    carGroup.add(trunk);
    
    // Лобовое стекло
    const windshieldGeometry = new THREE.BoxGeometry(2.6, 1, 0.1);
    const windshieldMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x87CEEB,
        transmission: 0.9,
        roughness: 0.1,
        metalness: 0,
        transparent: true,
        opacity: 0.6
    });
    const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
    windshield.position.set(0, 1.1, 0.8);
    carGroup.add(windshield);
    
    // Двери
    const doorGeometry = new THREE.BoxGeometry(0.8, 1.2, 2);
    const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x1a5276 });
    
    const leftDoor = new THREE.Mesh(doorGeometry, doorMaterial);
    leftDoor.position.set(-1.6, 0.6, 0);
    leftDoor.castShadow = true;
    carGroup.add(leftDoor);
    
    const rightDoor = new THREE.Mesh(doorGeometry, doorMaterial);
    rightDoor.position.set(1.6, 0.6, 0);
    rightDoor.castShadow = true;
    carGroup.add(rightDoor);
    
    // Регистрируем части для деформации
    const carPartsConfig = [
        { mesh: carBody, type: 'body', strength: 1.0, detachable: false },
        { mesh: hood, type: 'hood', strength: 0.7, detachable: true },
        { mesh: trunk, type: 'trunk', strength: 0.6, detachable: true },
        { mesh: leftDoor, type: 'door', strength: 0.5, detachable: true },
        { mesh: rightDoor, type: 'door', strength: 0.5, detachable: true },
        { mesh: windshield, type: 'glass', strength: 0.3, detachable: true }
    ];
    
    carPartsConfig.forEach(config => {
        carParts.push({
            mesh: config.mesh,
            type: config.type,
            strength: config.strength,
            detachable: config.detachable,
            originalScale: config.mesh.scale.clone(),
            originalPosition: config.mesh.position.clone(),
            damage: 0,
            detached: false
        });
    });
    
    // Колёса
    const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    
    const wheelPositions = [
        { x: 1.2, y: -0.3, z: 2.2 },
        { x: -1.2, y: -0.3, z: 2.2 },
        { x: 1.2, y: -0.3, z: -2.2 },
        { x: -1.2, y: -0.3, z: -2.2 }
    ];
    
    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos.x, pos.y, pos.z);
        wheel.castShadow = true;
        carGroup.add(wheel);
        
        carParts.push({
            mesh: wheel,
            type: 'wheel',
            strength: 0.8,
            detachable: true,
            originalScale: wheel.scale.clone(),
            originalPosition: wheel.position.clone(),
            damage: 0,
            detached: false
        });
    });
    
    // Физическое тело машины
    const carShape = new CANNON.Box(new CANNON.Vec3(1.5, 0.8, 3));
    carPhysicsBody = new CANNON.Body({ mass: CONFIG.CAR.MASS });
    carPhysicsBody.addShape(carShape);
    carPhysicsBody.position.set(0, 2, 0);
    carPhysicsBody.angularDamping = 0.8;
    carPhysicsBody.linearDamping = CONFIG.CAR.DRAG_COEFFICIENT;
    carPhysicsBody.material = new CANNON.Material('car');
    carPhysicsBody.material.restitution = 0.2;
    carPhysicsBody.material.friction = 0.8;
    world.addBody(carPhysicsBody);
    
    // Позиционирование камеры за машиной
    camera.position.set(0, 5, -10);
    camera.lookAt(carGroup.position);
}

async function setupLights() {
    // Основное освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(30, 50, 30);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = CONFIG.VISUAL.SHADOW_SIZE;
    directionalLight.shadow.mapSize.height = CONFIG.VISUAL.SHADOW_SIZE;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);
    lights.push(directionalLight);
    
    // Задний свет
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-20, 20, -20);
    scene.add(backLight);
    lights.push(backLight);
    
    // Неоновые огни
    const neonColors = [0xff00ff, 0x00ffff, 0xffff00];
    for (let i = 0; i < 3; i++) {
        const neonLight = new THREE.PointLight(neonColors[i], 0.5, 20);
        neonLight.position.set(
            Math.sin(i * Math.PI * 2/3) * 15,
            5,
            Math.cos(i * Math.PI * 2/3) * 15
        );
        scene.add(neonLight);
        lights.push(neonLight);
    }
}

async function setupControls() {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2, 0);
    controls.maxDistance = 50;
    controls.minDistance = 5;
    controls.maxPolarAngle = Math.PI / 2;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
}

async function setupEventListeners() {
    // Управление клавиатурой
    window.addEventListener('keydown', (e) => {
        if (e.code in keys) keys[e.code] = true;
        if (e.code === 'KeyR') resetCar();
    });
    
    window.addEventListener('keyup', (e) => {
        if (e.code in keys) keys[e.code] = false;
    });
    
    // Обработка кнопок UI
    ui.resetBtn.addEventListener('click', resetScene);
    ui.showPhysics.addEventListener('change', togglePhysicsDebug);
    ui.slowMotion.addEventListener('change', (e) => {
        slowMotion = e.target.checked;
    });
    
    // Ресайз окна
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Инициализация клавиш управления
    const controlKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
    controlKeys.forEach(key => keys[key] = false);
}

// =================== СИСТЕМА ПОВРЕЖДЕНИЙ ===================
function applyDamage(force, part, collisionPoint) {
    if (part.detached || part.damage >= 1) return;
    
    const impactForce = force * (1 - part.strength);
    part.damage += impactForce * CONFIG.DAMAGE.DEFORMATION_FACTOR;
    
    // Деформация (сжатие и смещение)
    const deformation = part.damage * 0.3;
    const squashFactor = 1 - deformation * Math.random();
    const stretchFactor = 1 + deformation * Math.random() * 0.5;
    
    part.mesh.scale.x = part.originalScale.x * (Math.random() > 0.5 ? squashFactor : stretchFactor);
    part.mesh.scale.y = part.originalScale.y * squashFactor;
    part.mesh.scale.z = part.originalScale.z * (Math.random() > 0.5 ? squashFactor : stretchFactor);
    
    // Смещение от удара
    const offset = deformation * 0.5;
    part.mesh.position.x = part.originalPosition.x + (Math.random() - 0.5) * offset;
    part.mesh.position.y = part.originalPosition.y + (Math.random() - 0.5) * offset;
    part.mesh.position.z = part.originalPosition.z + (Math.random() - 0.5) * offset;
    
    // Вращение от удара
    part.mesh.rotation.x = (Math.random() - 0.5) * deformation;
    part.mesh.rotation.y = (Math.random() - 0.5) * deformation;
    part.mesh.rotation.z = (Math.random() - 0.5) * deformation;
    
    // Отрыв детали при критическом повреждении
    if (part.detachable && part.damage > CONFIG.DAMAGE.PART_DETACH_THRESHOLD && !part.detached) {
        detachPart(part, collisionPoint);
    }
    
    // Обновление общего урона
    updateTotalDamage();
}

function detachPart(part, collisionPoint) {
    part.detached = true;
    
    // Создаем физическое тело для оторванной детали
    const size = new THREE.Box3().setFromObject(part.mesh).getSize(new THREE.Vector3());
    const shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
    const body = new CANNON.Body({ mass: 50 });
    body.addShape(shape);
    body.position.copy(collisionPoint || carPhysicsBody.position);
    body.velocity.copy(carPhysicsBody.velocity);
    body.angularVelocity.set(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5
    );
    world.addBody(body);
    
    // Отсоединяем от группы машины и добавляем в сцену
    carGroup.remove(part.mesh);
    scene.add(part.mesh);
    
    // Обновляем каждые кадр
    const updateDetachedPart = () => {
        if (part.detached && body) {
            part.mesh.position.copy(body.position);
            part.mesh.quaternion.copy(body.quaternion);
        }
    };
    
    // Добавляем в список для обновления
    part.updateFunc = updateDetachedPart;
}

function updateTotalDamage() {
    let total = 0;
    carParts.forEach(part => {
        if (!part.detached) {
            total += part.damage;
        }
    });
    
    gameStats.damage = Math.min(total / carParts.length * 100, 100);
    ui.damage.textContent = `${Math.round(gameStats.damage)}%`;
    ui.damageFill.style.width = `${gameStats.damage}%`;
    
    // Изменение цвета машины в зависимости от урона
    const damageColor = new THREE.Color().lerpColors(
        new THREE.Color(CONFIG.VISUAL.CAR_COLOR),
        new THREE.Color(0x333333),
        gameStats.damage / 200
    );
    
    carParts.forEach(part => {
        if (part.mesh.material && part.mesh.material.color) {
            part.mesh.material.color.lerp(damageColor, 0.1);
        }
    });
}

// =================== ОБРАБОТКА СТОЛКНОВЕНИЙ ===================
function checkCollisions() {
    const currentTime = Date.now();
    if (currentTime - lastCollisionTime < 500) return;
    
    let collisionDetected = false;
    
    obstacles.forEach(obstacle => {
        const distance = carPhysicsBody.position.distanceTo(obstacle.body.position);
        const collisionThreshold = 5;
        
        if (distance < collisionThreshold) {
            const relativeVelocity = carPhysicsBody.velocity.length();
            
            if (relativeVelocity > 2) {
                collisionDetected = true;
                lastCollisionTime = currentTime;
                gameStats.collisions++;
                ui.collisions.textContent = gameStats.collisions;
                
                // Визуальный эффект
                showCrashEffect();
                
                // Сила удара зависит от скорости
                const collisionForce = relativeVelocity * 0.5;
                const collisionPoint = new THREE.Vector3().copy(carPhysicsBody.position);
                
                // Применяем повреждения к случайным частям
                const affectedParts = carParts
                    .filter(p => !p.detached)
                    .sort(() => Math.random() - 0.5)
                    .slice(0, Math.floor(Math.random() * 3) + 1);
                
                affectedParts.forEach(part => {
                    applyDamage(collisionForce, part, collisionPoint);
                });
                
                // Физический отскок
                const bounceForce = relativeVelocity * 1000;
                const direction = new CANNON.Vec3().copy(carPhysicsBody.position);
                direction.vsub(obstacle.body.position, direction);
                direction.normalize();
                direction.scale(bounceForce, direction);
                carPhysicsBody.applyImpulse(direction, carPhysicsBody.position);
            }
        }
    });
    
    // Самопроизвольная деформация при высоком уроне
    if (gameStats.damage > 70 && Math.random() < 0.01) {
        const randomPart = carParts.find(p => !p.detached && p.damage < 0.5);
        if (randomPart) {
            applyDamage(10, randomPart, carPhysicsBody.position);
        }
    }
}

function showCrashEffect() {
    ui.crashEffect.classList.add('crash-flash');
    setTimeout(() => {
        ui.crashEffect.classList.remove('crash-flash');
    }, 500);
}

// =================== УПРАВЛЕНИЕ МАШИНОЙ ===================
function updateCarControls() {
    const force = new CANNON.Vec3();
    const speed = carPhysicsBody.velocity.length() * 3.6;
    const engineMultiplier = Math.max(0, 1 - speed / CONFIG.CAR.MAX_SPEED);
    
    // Движение вперед/назад
    if (keys['KeyW']) {
        force.z = -CONFIG.CAR.ENGINE_POWER * engineMultiplier;
        carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, 0));
    }
    
    if (keys['KeyS']) {
        force.z = CONFIG.CAR.ENGINE_POWER * 0.6;
        carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, 0));
    }
    
    // Поворот
    if (keys['KeyA']) {
        force.x = -CONFIG.CAR.STEERING_POWER * (speed / CONFIG.CAR.MAX_SPEED);
        carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, -2));
    }
    
    if (keys['KeyD']) {
        force.x = CONFIG.CAR.STEERING_POWER * (speed / CONFIG.CAR.MAX_SPEED);
        carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, -2));
    }
    
    // Торможение при отсутствии газа
    if (!keys['KeyW'] && !keys['KeyS']) {
        const brakeForce = carPhysicsBody.velocity.clone();
        brakeForce.scale(-CONFIG.CAR.BRAKE_POWER * 0.1, brakeForce);
        carPhysicsBody.applyForce(brakeForce, carPhysicsBody.position);
    }
    
    // Обновление скорости в UI
    ui.speed.textContent = `${Math.round(speed)} км/ч`;
    gameStats.maxSpeed = Math.max(gameStats.maxSpeed, speed);
}

// =================== СБРОС И ПЕРЕЗАПУСК ===================
function resetCar() {
    carPhysicsBody.position.set(0, 2, 0);
    carPhysicsBody.velocity.set(0, 0, 0);
    carPhysicsBody.angularVelocity.set(0, 0, 0);
    carPhysicsBody.quaternion.set(0, 0, 0, 1);
    
    // Сброс повреждений
    carParts.forEach(part => {
        if (part.detached) {
            scene.remove(part.mesh);
        } else {
            part.mesh.scale.copy(part.originalScale);
            part.mesh.position.copy(part.originalPosition);
            part.mesh.rotation.set(0, 0, 0);
            part.damage = 0;
            part.detached = false;
            
            if (part.mesh.material && part.mesh.material.color) {
                part.mesh.material.color.set(CONFIG.VISUAL.CAR_COLOR);
            }
        }
    });
    
    // Удаляем оторванные части
    carParts = carParts.filter(part => !part.detached);
    
    // Сброс статистики
    gameStats.damage = 0;
    updateTotalDamage();
}

function resetScene() {
    resetCar();
    gameStats.collisions = 0;
    gameStats.maxSpeed = 0;
    ui.collisions.textContent = '0';
    
    // Перемещаем камеру
    camera.position.set(0, 8, 15);
    controls.target.set(0, 2, 0);
    controls.update();
}

// =================== ОТЛАДКА ФИЗИКИ ===================
function togglePhysicsDebug() {
    physicsDebug = ui.showPhysics.checked;
    
    if (physicsDebug && debugMeshes.length === 0) {
        // Создаем визуализацию физических тел
        world.bodies.forEach(body => {
            if (body.shapes.length > 0) {
                const shape = body.shapes[0];
                
                if (shape instanceof CANNON.Box) {
                    const size = shape.halfExtents;
                    const geometry = new THREE.BoxGeometry(size.x * 2, size.y * 2, size.z * 2);
                    const material = new THREE.MeshBasicMaterial({
                        color: 0xff0000,
                        wireframe: true,
                        transparent: true,
                        opacity: 0.3
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    scene.add(mesh);
                    debugMeshes.push({ mesh, body });
                }
            }
        });
    } else if (!physicsDebug) {
        // Удаляем визуализацию
        debugMeshes.forEach(item => scene.remove(item.mesh));
        debugMeshes = [];
    }
}

function updateDebugMeshes() {
    if (physicsDebug) {
        debugMeshes.forEach(item => {
            item.mesh.position.copy(item.body.position);
            item.mesh.quaternion.copy(item.body.quaternion);
        });
    }
}

// =================== ГЛАВНЫЙ ЦИКЛ ИГРЫ ===================
function animate() {
    requestAnimationFrame(animate);
    stats.begin();
    
    // Замедленная съемка
    const timeStep = slowMotion ? CONFIG.PHYSICS.TIME_STEP * 0.3 : CONFIG.PHYSICS.TIME_STEP;
    
    // Обновление физики
    world.step(timeStep);
    
    // Обновление машины
    if (carBody && carPhysicsBody) {
        carGroup.position.copy(carPhysicsBody.position);
        carGroup.quaternion.copy(carPhysicsBody.quaternion);
        
        updateCarControls();
        checkCollisions();
        
        // Обновление оторванных деталей
        carParts.forEach(part => {
            if (part.detached && part.updateFunc) {
                part.updateFunc();
            }
        });
    }
    
    // Обновление препятствий
    obstacles.forEach(obj => {
        obj.mesh.position.copy(obj.body.position);
        obj.mesh.quaternion.copy(obj.body.quaternion);
    });
    
    // Обновление отладочной визуализации
    updateDebugMeshes();
    
    // Анимация неоновых огней
    lights.forEach((light, i) => {
        if (light instanceof THREE.PointLight) {
            light.intensity = 0.5 + Math.sin(Date.now() * 0.001 + i) * 0.3;
        }
    });
    
    // Плавное затухание урона
    if (gameStats.damage > 0 && Math.random() < 0.1) {
        gameStats.damage *= CONFIG.DAMAGE.DAMAGE_DECAY;
        updateTotalDamage();
    }
    
    controls.update();
    renderer.render(scene, camera);
    stats.end();
}

// =================== ЗАПУСК ИГРЫ ===================
init();
