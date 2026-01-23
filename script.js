// =================== НАСТРОЙКИ ===================
const CAR_COLOR = 0x2980b9;        // Цвет машины
const GROUND_COLOR = 0x2ecc71;     // Цвет земли
const OBSTACLE_COLOR = 0xe74c3c;   // Цвет препятствий

// =================== ИНИЦИАЛИЗАЦИЯ ===================
let scene, camera, renderer, world, stats, controls;
let carBody, carPhysicsBody, carParts = [];
let obstacles = [];
let keys = {};
let speedElement, damageElement;
let totalDamage = 0;

init();

function init() {
    // 1. Сцена
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    // 2. Камера
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 15);

    // 3. Рендерер
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('container').appendChild(renderer.domElement);

    // 4. Органы управления камерой
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2, 0);
    controls.update();

    // 5. Статистика (FPS)
    stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    // 6. Физический мир (Cannon.js)
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;

    // 7. Освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    scene.add(directionalLight);

    // 8. Создание мира
    createGround();
    createObstacles();
    createCar();

    // 9. Элементы интерфейса
    speedElement = document.getElementById('speed');
    damageElement = document.getElementById('damage');

    // 10. Обработчики событий
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', (e) => { keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyR') resetCar();
    });

    // 11. Запуск игрового цикла
    animate();
}

// =================== СОЗДАНИЕ МИРА ===================
function createGround() {
    // Визуальная часть
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: GROUND_COLOR });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Физическая часть
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);
}

function createObstacles() {
    const obstaclePositions = [
        { x: 10, y: 2, z: 0 },
        { x: -8, y: 1, z: 8 },
        { x: 5, y: 3, z: -7 },
        { x: -12, y: 2, z: -5 }
    ];

    obstaclePositions.forEach(pos => {
        // Визуальная часть
        const geometry = new THREE.BoxGeometry(4, 4, 4);
        const material = new THREE.MeshLambertMaterial({ color: OBSTACLE_COLOR });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        // Физическая часть
        const shape = new CANNON.Box(new CANNON.Vec3(2, 2, 2));
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(shape);
        body.position.set(pos.x, pos.y, pos.z);
        world.addBody(body);

        obstacles.push({ mesh, body });
    });
}

// =================== СОЗДАНИЕ МАШИНЫ ===================
function createCar() {
    // 1. Визуальная модель (состоит из частей для деформации)
    const carGroup = new THREE.Group();
    scene.add(carGroup);

    // Кузов
    const bodyGeometry = new THREE.BoxGeometry(3, 1.5, 6);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: CAR_COLOR });
    carBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
    carBody.castShadow = true;
    carBody.receiveShadow = true;
    carGroup.add(carBody);

    // Капот (отдельная часть для деформации)
    const hoodGeometry = new THREE.BoxGeometry(2.5, 0.8, 2);
    const hoodMaterial = new THREE.MeshLambertMaterial({ color: 0x3498db });
    const hood = new THREE.Mesh(hoodGeometry, hoodMaterial);
    hood.position.set(0, 0.9, 1.5);
    hood.castShadow = true;
    carGroup.add(hood);

    // Сохраняем части для деформации
    carParts.push({ mesh: carBody, originalScale: new THREE.Vector3(1, 1, 1) });
    carParts.push({ mesh: hood, originalScale: new THREE.Vector3(1, 1, 1) });

    // 2. Физическое тело
    const carShape = new CANNON.Box(new CANNON.Vec3(1.5, 0.75, 3));
    carPhysicsBody = new CANNON.Body({ mass: 800 });
    carPhysicsBody.addShape(carShape);
    carPhysicsBody.position.set(0, 2, 0);
    carPhysicsBody.angularDamping = 0.8; // Стабилизация
    carPhysicsBody.linearDamping = 0.5;
    world.addBody(carPhysicsBody);

    // 3. Колёса (упрощённо)
    const wheelPositions = [
        { x: 1.2, y: -0.5, z: 2 },
        { x: -1.2, y: -0.5, z: 2 },
        { x: 1.2, y: -0.5, z: -2 },
        { x: -1.2, y: -0.5, z: -2 }
    ];

    wheelPositions.forEach(pos => {
        const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos.x, pos.y, pos.z);
        wheel.castShadow = true;
        carGroup.add(wheel);
        carParts.push({ mesh: wheel, originalScale: new THREE.Vector3(1, 1, 1) });
    });
}

// =================== ДЕФОРМАЦИЯ ===================
function applyDeformation(collisionForce) {
    // Увеличиваем общий урон
    totalDamage = Math.min(totalDamage + collisionForce * 0.1, 100);
    damageElement.textContent = `Повреждение: ${Math.round(totalDamage)}%`;

    // Деформируем каждую часть машины
    carParts.forEach(part => {
        const scaleFactor = 1 - Math.random() * collisionForce * 0.02;
        part.mesh.scale.x = part.originalScale.x * scaleFactor;
        part.mesh.scale.y = part.originalScale.y * (1 - Math.random() * collisionForce * 0.01);
        part.mesh.scale.z = part.originalScale.z * scaleFactor;

        // Случайное смещение для эффекта "вмятины"
        part.mesh.position.x += (Math.random() - 0.5) * collisionForce * 0.05;
        part.mesh.position.y += (Math.random() - 0.5) * collisionForce * 0.03;
        part.mesh.position.z += (Math.random() - 0.5) * collisionForce * 0.05;
    });
}

// =================== УПРАВЛЕНИЕ ===================
function updateCar() {
    const force = 500;
    const steeringForce = 300;
    const speed = carPhysicsBody.velocity.length();

    // Движение вперёд/назад
    if (keys['KeyW']) carPhysicsBody.applyForce(new CANNON.Vec3(0, 0, -force), carPhysicsBody.position);
    if (keys['KeyS']) carPhysicsBody.applyForce(new CANNON.Vec3(0, 0, force), carPhysicsBody.position);

    // Поворот
    if (keys['KeyA']) carPhysicsBody.applyForce(new CANNON.Vec3(-steeringForce, 0, 0), carPhysicsBody.position);
    if (keys['KeyD']) carPhysicsBody.applyForce(new CANNON.Vec3(steeringForce, 0, 0), carPhysicsBody.position);

    // Отображение скорости
    speedElement.textContent = `Скорость: ${Math.round(speed * 3.6)} км/ч`;

    // Проверка столкновений
    obstacles.forEach(obstacle => {
        const distance = carPhysicsBody.position.distanceTo(obstacle.body.position);
        if (distance < 5) {
            const relativeVelocity = carPhysicsBody.velocity.length();
            if (relativeVelocity > 2) {
                applyDeformation(relativeVelocity);
            }
        }
    });
}

// =================== СБРОС МАШИНЫ ===================
function resetCar() {
    carPhysicsBody.position.set(0, 2, 0);
    carPhysicsBody.velocity.setZero();
    carPhysicsBody.angularVelocity.setZero();
    carPhysicsBody.quaternion.set(0, 0, 0, 1);

    // Сброс деформации
    totalDamage = 0;
    damageElement.textContent = 'Повреждение: 0%';
    carParts.forEach(part => {
        part.mesh.scale.copy(part.originalScale);
        part.mesh.position.set(0, 0, 0);
    });
}

// =================== ИГРОВОЙ ЦИКЛ ===================
function animate() {
    requestAnimationFrame(animate);
    stats.begin();

    // Обновление физики
    world.step(1 / 60);

    // Синхронизация машины
    if (carBody && carPhysicsBody) {
        carBody.position.copy(carPhysicsBody.position);
        carBody.quaternion.copy(carPhysicsBody.quaternion);
        updateCar();
    }

    // Обновление препятствий
    obstacles.forEach(obj => {
        obj.mesh.position.copy(obj.body.position);
        obj.mesh.quaternion.copy(obj.body.quaternion);
    });

    controls.update();
    renderer.render(scene, camera);
    stats.end();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
