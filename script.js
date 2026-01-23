// =================== КОНФИГУРАЦИЯ ===================
const CONFIG = {
    CAR: {
        COLOR: 0x2980b9,
        MASS: 1500,
        POWER: 50000,
        STEERING: 30000,
        MAX_SPEED: 180
    },
    WORLD: {
        SIZE: 500,
        ROAD_WIDTH: 15,
        BUILDING_COUNT: 30,
        OBSTACLE_COUNT: 20
    }
};

// =================== ИНИЦИАЛИЗАЦИЯ ===================
let scene, camera, renderer, world, clock;
let carGroup, carPhysicsBody;
let keys = {};
let gameStats = { speed: 0, damage: 0, collisions: 0 };
let physicsEnabled = true;

// Элементы UI
const speedElement = document.getElementById('speed');
const damageElement = document.getElementById('damage');
const collisionsElement = document.getElementById('collisions');

// =================== СОЗДАНИЕ ИГРЫ ===================
function init() {
    console.log('🚀 Запуск игры...');
    
    // Создаем сцену
    createScene();
    
    // Создаем физический мир
    createPhysicsWorld();
    
    // Создаем окружение
    createEnvironment();
    
    // Создаем машину
    createCar();
    
    // Настройка освещения
    setupLighting();
    
    // Настройка управления
    setupControls();
    
    // Запускаем игровой цикл
    clock = new THREE.Clock();
    animate();
    
    console.log('✅ Игра готова!');
}

// =================== СОЗДАНИЕ СЦЕНЫ ===================
function createScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 50, 300);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, -20);
    
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Орбитальные контролы для камеры
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
}

// =================== ФИЗИЧЕСКИЙ МИР ===================
function createPhysicsWorld() {
    world = new CANNON.World();
    world.gravity = new CANNON.Vec3(0, -9.82, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = 10;
}

// =================== СОЗДАНИЕ ОКРУЖЕНИЯ ===================
function createEnvironment() {
    console.log('🌍 Создание мира...');
    
    // Земля
    const groundGeometry = new THREE.PlaneGeometry(CONFIG.WORLD.SIZE, CONFIG.WORLD.SIZE);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x3d9970 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Физическое тело земли
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);
    
    // Дорога
    const roadGeometry = new THREE.PlaneGeometry(200, CONFIG.WORLD.ROAD_WIDTH);
    const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x34495e });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    scene.add(road);
    
    // Разметка дороги
    const lineGeometry = new THREE.PlaneGeometry(0.5, 4);
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    for (let i = -80; i <= 80; i += 10) {
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.rotation.x = -Math.PI / 2;
        line.position.set(i, 0.02, 0);
        scene.add(line);
    }
    
    // Здания
    createBuildings();
    
    // Препятствия
    createObstacles();
    
    // Небо
    createSky();
    
    console.log('✅ Мир создан');
}

function createBuildings() {
    const buildingMaterials = [
        new THREE.MeshLambertMaterial({ color: 0x95a5a6 }),
        new THREE.MeshLambertMaterial({ color: 0x7f8c8d }),
        new THREE.MeshLambertMaterial({ color: 0x34495e }),
        new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
    ];
    
    for (let i = 0; i < CONFIG.WORLD.BUILDING_COUNT; i++) {
        const width = 10 + Math.random() * 20;
        const depth = 10 + Math.random() * 20;
        const height = 15 + Math.random() * 30;
        
        const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
        const buildingMaterial = buildingMaterials[Math.floor(Math.random() * buildingMaterials.length)];
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        
        let x, z;
        do {
            x = (Math.random() - 0.5) * 400;
            z = (Math.random() - 0.5) * 400;
        } while (Math.abs(z) < 30 && Math.abs(x) < 100);
        
        building.position.set(x, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        
        // Физическое тело здания
        const buildingShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
        const buildingBody = new CANNON.Body({ mass: 0 });
        buildingBody.addShape(buildingShape);
        buildingBody.position.set(x, height/2, z);
        world.addBody(buildingBody);
    }
}

function createObstacles() {
    console.log('🚧 Создание препятствий...');
    
    const obstacleTypes = [
        { type: 'box', size: [3, 3, 3], color: 0xe74c3c },
        { type: 'cylinder', radius: 2, height: 4, color: 0x3498db },
        { type: 'box', size: [2, 5, 2], color: 0xf1c40f },
        { type: 'box', size: [4, 2, 4], color: 0x9b59b6 }
    ];
    
    for (let i = 0; i < CONFIG.WORLD.OBSTACLE_COUNT; i++) {
        const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        let mesh, shape;
        
        if (type.type === 'box') {
            mesh = new THREE.Mesh(
                new THREE.BoxGeometry(...type.size),
                new THREE.MeshLambertMaterial({ color: type.color })
            );
            shape = new CANNON.Box(new CANNON.Vec3(type.size[0]/2, type.size[1]/2, type.size[2]/2));
        } else {
            mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(type.radius, type.radius, type.height, 16),
                new THREE.MeshLambertMaterial({ color: type.color })
            );
            shape = new CANNON.Cylinder(type.radius, type.radius, type.height, 16);
        }
        
        let x, z;
        do {
            x = (Math.random() - 0.5) * 150;
            z = (Math.random() - 0.5) * 150;
        } while (Math.abs(z) < 20 && Math.abs(x) < 50);
        
        mesh.position.set(x, type.size ? type.size[1]/2 : type.height/2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(shape);
        body.position.copy(mesh.position);
        world.addBody(body);
    }
    
    console.log(`✅ Создано препятствий: ${CONFIG.WORLD.OBSTACLE_COUNT}`);
}

function createSky() {
    // Простое небо
    scene.background = new THREE.Color(0x87CEEB);
    
    // Солнце (направленный свет)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(100, 100, 50);
    sunLight.castShadow = true;
    scene.add(sunLight);
    
    // Окружающий свет
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
}

// =================== СОЗДАНИЕ МАШИНЫ ===================
function createCar() {
    console.log('🚗 Создание машины...');
    
    carGroup = new THREE.Group();
    scene.add(carGroup);
    
    // Кузов машины
    const bodyGeometry = new THREE.BoxGeometry(2.5, 1.2, 5);
    const bodyMaterial = new THREE.MeshLambertMaterial({ 
        color: CONFIG.CAR.COLOR,
        roughness: 0.5,
        metalness: 0.5
    });
    
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    carGroup.add(body);
    
    // Капот
    const hoodGeometry = new THREE.BoxGeometry(2.2, 0.8, 1.8);
    const hood = new THREE.Mesh(hoodGeometry, bodyMaterial);
    hood.position.set(0, 0.8, 1.6);
    hood.castShadow = true;
    carGroup.add(hood);
    
    // Багажник
    const trunkGeometry = new THREE.BoxGeometry(2.2, 0.9, 1.5);
    const trunk = new THREE.Mesh(trunkGeometry, bodyMaterial);
    trunk.position.set(0, 0.75, -1.8);
    trunk.castShadow = true;
    carGroup.add(trunk);
    
    // Крыша
    const roofGeometry = new THREE.BoxGeometry(1.8, 0.8, 2.5);
    const roof = new THREE.Mesh(roofGeometry, bodyMaterial);
    roof.position.set(0, 1.6, 0);
    roof.castShadow = true;
    carGroup.add(roof);
    
    // Стекла
    const glassMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x88ccff, 
        transparent: true, 
        opacity: 0.6 
    });
    
    const windshieldGeometry = new THREE.BoxGeometry(2.1, 0.9, 0.1);
    const windshield = new THREE.Mesh(windshieldGeometry, glassMaterial);
    windshield.position.set(0, 1.6, 1);
    carGroup.add(windshield);
    
    // Колеса
    createWheels();
    
    // Физическое тело машины
    createCarPhysics();
    
    console.log('✅ Машина создана');
}

function createWheels() {
    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    
    const wheelPositions = [
        { x: 0.9, y: -0.3, z: 1.8 },
        { x: -0.9, y: -0.3, z: 1.8 },
        { x: 0.9, y: -0.3, z: -1.8 },
        { x: -0.9, y: -0.3, z: -1.8 }
    ];
    
    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos.x, pos.y, pos.z);
        wheel.castShadow = true;
        carGroup.add(wheel);
    });
}

function createCarPhysics() {
    const carShape = new CANNON.Box(new CANNON.Vec3(1.25, 0.6, 2.5));
    carPhysicsBody = new CANNON.Body({ mass: CONFIG.CAR.MASS });
    carPhysicsBody.addShape(carShape);
    carPhysicsBody.position.set(0, 2, 0);
    carPhysicsBody.angularDamping = 0.8;
    carPhysicsBody.linearDamping = 0.35;
    world.addBody(carPhysicsBody);
}

// =================== ОСВЕЩЕНИЕ ===================
function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);
}

// =================== УПРАВЛЕНИЕ ===================
function setupControls() {
    // Клавиатура
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.code === 'KeyR') resetCar();
    });
    
    window.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });
    
    // Инициализируем ключи управления
    const controlKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
    controlKeys.forEach(key => keys[key] = false);
    
    // Ресайз окна
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// =================== ОБНОВЛЕНИЕ МАШИНЫ ===================
function updateCar(deltaTime) {
    if (!carPhysicsBody) return;
    
    const force = new CANNON.Vec3();
    const currentSpeed = carPhysicsBody.velocity.length() * 3.6;
    
    // Движение вперед/назад
    if (keys['KeyW']) {
        force.z = -CONFIG.CAR.POWER;
        carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, 0));
    }
    
    if (keys['KeyS']) {
        force.z = CONFIG.CAR.POWER * 0.6;
        carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, 0));
    }
    
    // Поворот
    if (keys['KeyA']) {
        force.x = -CONFIG.CAR.STEERING * (currentSpeed / CONFIG.CAR.MAX_SPEED);
        carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, -1.5));
    }
    
    if (keys['KeyD']) {
        force.x = CONFIG.CAR.STEERING * (currentSpeed / CONFIG.CAR.MAX_SPEED);
        carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, -1.5));
    }
    
    // Обновление скорости в UI
    gameStats.speed = Math.round(currentSpeed);
    speedElement.textContent = gameStats.speed;
    
    // Проверка столкновений
    checkCollisions();
    
    // Обновление позиции машины
    updateCarPosition();
}

function checkCollisions() {
    // Простая проверка скорости для обнаружения столкновений
    const speed = carPhysicsBody.velocity.length();
    
    if (speed > 5) {
        // Проверяем наклоны и резкие изменения скорости
        const angularSpeed = carPhysicsBody.angularVelocity.length();
        
        if (angularSpeed > 2) {
            // Регистрируем столкновение
            gameStats.collisions++;
            collisionsElement.textContent = gameStats.collisions;
            
            // Увеличиваем повреждения
            gameStats.damage = Math.min(gameStats.damage + speed * 0.5, 100);
            damageElement.textContent = `${Math.round(gameStats.damage)}%`;
            
            // Эффект столкновения
            showCrashEffect();
        }
    }
}

function updateCarPosition() {
    if (carGroup && carPhysicsBody) {
        carGroup.position.copy(carPhysicsBody.position);
        carGroup.quaternion.copy(carPhysicsBody.quaternion);
    }
}

function showCrashEffect() {
    const effect = document.createElement('div');
    effect.className = 'crash-effect';
    effect.style.animation = 'crash 0.5s';
    document.body.appendChild(effect);
    
    setTimeout(() => {
        effect.remove();
    }, 500);
}

// =================== СБРОС МАШИНЫ ===================
function resetCar() {
    if (!carPhysicsBody) return;
    
    carPhysicsBody.position.set(0, 2, 0);
    carPhysicsBody.velocity.set(0, 0, 0);
    carPhysicsBody.angularVelocity.set(0, 0, 0);
    carPhysicsBody.quaternion.set(0, 0, 0, 1);
    
    // Сброс статистики
    gameStats.damage = 0;
    gameStats.collisions = 0;
    damageElement.textContent = '0%';
    collisionsElement.textContent = '0';
    
    // Сброс камеры
    camera.position.set(0, 10, -20);
    camera.lookAt(0, 2, 0);
}

function togglePhysics() {
    physicsEnabled = !physicsEnabled;
    alert(`Физика ${physicsEnabled ? 'включена' : 'выключена'}`);
}

// =================== ИГРОВОЙ ЦИКЛ ===================
function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = clock.getDelta();
    
    if (physicsEnabled) {
        world.step(1/60);
        updateCar(deltaTime);
    }
    
    // Обновление камеры
    camera.lookAt(carGroup ? carGroup.position : new THREE.Vector3(0, 0, 0));
    
    renderer.render(scene, camera);
}

// =================== ЗАПУСК ИГРЫ ===================
// Запускаем игру после загрузки страницы
window.addEventListener('load', () => {
    console.log('🎮 Инициализация игры...');
    
    // Скрываем курсор для лучшего игрового опыта
    document.body.style.cursor = 'none';
    
    // Запускаем игру
    init();
    
    // Показываем инструкции
    setTimeout(() => {
        alert('Игра загружена!\n\nУправление:\nW/S - Движение вперед/назад\nA/D - Поворот\nR - Респавн машины\nМышь - Вращение камеры\n\nВрезайтесь в препятствия для теста физики!');
    }, 1000);
});

// Экспорт функций для кнопок
window.resetCar = resetCar;
window.togglePhysics = togglePhysics;
