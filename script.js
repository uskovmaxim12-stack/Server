// =================== КОНФИГУРАЦИЯ ===================
const CONFIG = {
    // Графика
    SHADOW_SIZE: 2048,
    TEXTURE_QUALITY: 'high',
    POST_PROCESSING: true,
    
    // Физика
    PHYSICS: {
        GRAVITY: 9.82,
        SUBSTEPS: 3,
        SOLVER_ITERATIONS: 10
    },
    
    // Машина
    CAR: {
        MASS: 1500,
        POWER: {
            ENGINE: 50000,
            STEERING: 30000,
            BRAKE: 40000,
            HANDBRAKE: 20000
        },
        DRAG: 0.35,
        MAX_SPEED: 200
    },
    
    // Повреждения
    DAMAGE: {
        DEFORMATION_RATE: 0.1,
        PART_DETACH_THRESHOLD: 0.8,
        MAX_DAMAGE: 100
    },
    
    // Звук
    SOUND: {
        ENGINE_VOLUME: 0.3,
        CRASH_VOLUME: 0.7,
        SCREECH_VOLUME: 0.5
    }
};

// =================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===================
let scene, camera, renderer, composer, world;
let carGroup, carPhysicsBody, carParts = [];
let obstacles = [], lights = [];
let keys = {}, mouse = { x: 0, y: 0 };
let gameTime = 0, collisionCount = 0, maxSpeed = 0;
let cameraMode = 'chase', cameraDistance = 15;
let damageState = { front: 0, rear: 0, left: 0, right: 0 };
let audioEnabled = true, bloomEnabled = true, slowMotion = true;

// =================== ЭЛЕМЕНТЫ ИНТЕРФЕЙСА ===================
const UI = {
    // Статистика
    fpsCounter: document.getElementById('fpsCounter'),
    physicsCounter: document.getElementById('physicsCounter'),
    speedText: document.getElementById('speedText'),
    speedNeedle: document.getElementById('speedNeedle'),
    collisionCount: document.getElementById('collisionCount'),
    maxSpeed: document.getElementById('maxSpeed'),
    totalDamage: document.getElementById('totalDamage'),
    playTime: document.getElementById('playTime'),
    impactForce: document.getElementById('impactForce'),
    
    // Панели повреждений
    damageFront: document.getElementById('damageFront'),
    damageRear: document.getElementById('damageRear'),
    damageLeft: document.getElementById('damageLeft'),
    damageRight: document.getElementById('damageRight'),
    damageFrontValue: document.getElementById('damageFrontValue'),
    damageRearValue: document.getElementById('damageRearValue'),
    damageLeftValue: document.getElementById('damageLeftValue'),
    damageRightValue: document.getElementById('damageRightValue'),
    
    // Эффекты
    crashEffect: document.getElementById('crashEffect'),
    screenShake: document.getElementById('screenShake'),
    damageOverlay: document.getElementById('damageOverlay'),
    
    // Кнопки
    resetBtn: document.getElementById('resetBtn'),
    cameraBtn: document.getElementById('cameraBtn'),
    effectsBtn: document.getElementById('effectsBtn'),
    
    // Переключатели
    bloomToggle: document.getElementById('bloomToggle'),
    motionToggle: document.getElementById('motionToggle'),
    damageToggle: document.getElementById('damageToggle'),
    soundToggle: document.getElementById('soundToggle'),
    
    // Аудио
    engineSound: document.getElementById('engineSound'),
    crashSound: document.getElementById('crashSound'),
    screechSound: document.getElementById('screechSound'),
    
    // Сообщения
    welcomeMessage: document.getElementById('welcomeMessage')
};

// =================== ИНИЦИАЛИЗАЦИЯ ===================
async function init() {
    try {
        console.log('🚀 Инициализация игры...');
        
        await createScene();
        await createPhysicsWorld();
        await createEnvironment();
        await createCar();
        await setupLights();
        await setupPostProcessing();
        await setupEventListeners();
        
        // Запуск игрового цикла
        animate();
        
        // Скрываем загрузочный экран
        setTimeout(() => {
            document.getElementById('loading').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loading').style.display = 'none';
                showMessage('Игра загружена! Используйте W/A/S/D для управления.');
            }, 500);
        }, 1000);
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        document.getElementById('loading').innerHTML = `
            <div style="color: #e74c3c; text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 60px; margin-bottom: 20px;"></i>
                <h2>Ошибка загрузки</h2>
                <p>${error.message}</p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #e74c3c; border: none; color: white; border-radius: 5px; cursor: pointer;">
                    <i class="fas fa-redo"></i> Перезагрузить
                </button>
            </div>
        `;
    }
}

// =================== СОЗДАНИЕ СЦЕНЫ ===================
async function createScene() {
    console.log('🎨 Создание сцены...');
    
    // Сцена
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87CEEB, 50, 300);
    
    // Камера
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, -15);
    
    // Рендерер
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    const container = document.getElementById('gameContainer');
    container.appendChild(renderer.domElement);
    
    // Орбитальные контролы (для отладки)
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enabled = false; // Отключаем, будем управлять сами
    
    console.log('✅ Сцена создана');
}

// =================== ФИЗИЧЕСКИЙ МИР ===================
async function createPhysicsWorld() {
    console.log('⚙️ Создание физического мира...');
    
    world = new CANNON.World();
    world.gravity = new CANNON.Vec3(0, -CONFIG.PHYSICS.GRAVITY, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = CONFIG.PHYSICS.SOLVER_ITERATIONS;
    world.defaultContactMaterial.friction = 0.8;
    world.defaultContactMaterial.restitution = 0.2;
    
    console.log('✅ Физический мир создан');
}

// =================== СОЗДАНИЕ ОКРУЖЕНИЯ ===================
async function createEnvironment() {
    console.log('🌳 Создание окружения...');
    
    // Небо (градиент)
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x87CEEB) },
            bottomColor: { value: new THREE.Color(0x98D8E8) },
            offset: { value: 33 },
            exponent: { value: 0.6 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);
    
    // Земля с текстурой
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2c3e50,
        roughness: 0.8,
        metalness: 0.2
    });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    
    // Физическое тело земли
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);
    
    // Дорога
    const roadGeometry = new THREE.PlaneGeometry(100, 8);
    const roadMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x34495e,
        roughness: 0.7,
        metalness: 0.1
    });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    scene.add(road);
    
    // Разметка дороги
    for (let i = -40; i <= 40; i += 4) {
        const lineGeometry = new THREE.PlaneGeometry(0.5, 4);
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.rotation.x = -Math.PI / 2;
        line.position.set(i, 0.02, 0);
        scene.add(line);
    }
    
    // Препятствия
    await createObstacles();
    
    console.log('✅ Окружение создано');
}

async function createObstacles() {
    console.log('🚧 Создание препятствий...');
    
    const obstacleTypes = [
        {
            type: 'wall',
            size: [20, 4, 1],
            pos: [30, 2, 0],
            rot: [0, 0, 0],
            color: 0x7f8c8d
        },
        {
            type: 'pyramid',
            size: [6, 6, 6],
            pos: [-25, 3, 15],
            rot: [0, Math.PI/4, 0],
            color: 0xe74c3c
        },
        {
            type: 'cylinder',
            radius: 3,
            height: 8,
            pos: [20, 4, -20],
            rot: [0, 0, 0],
            color: 0x3498db
        },
        {
            type: 'box',
            size: [5, 6, 5],
            pos: [-15, 3, -25],
            rot: [0, Math.PI/6, 0],
            color: 0xf39c12
        },
        {
            type: 'sphere',
            radius: 4,
            pos: [35, 4, 25],
            rot: [0, 0, 0],
            color: 0x9b59b6
        },
        {
            type: 'ramp',
            size: [10, 2, 15],
            pos: [-35, 1, 30],
            rot: [0, Math.PI/2, -Math.PI/8],
            color: 0x2ecc71
        }
    ];
    
    for (const config of obstacleTypes) {
        let mesh, shape;
        
        switch (config.type) {
            case 'wall':
                mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(...config.size),
                    new THREE.MeshStandardMaterial({ 
                        color: config.color,
                        roughness: 0.7,
                        metalness: 0.3
                    })
                );
                shape = new CANNON.Box(new CANNON.Vec3(
                    config.size[0]/2, config.size[1]/2, config.size[2]/2
                ));
                break;
                
            case 'pyramid':
                const pyramidGeometry = new THREE.ConeGeometry(config.size[0]/2, config.size[1], 4);
                mesh = new THREE.Mesh(
                    pyramidGeometry,
                    new THREE.MeshStandardMaterial({ 
                        color: config.color,
                        roughness: 0.6,
                        metalness: 0.2
                    })
                );
                shape = new CANNON.Convex(pyramidGeometry.vertices.map(v => new CANNON.Vec3(v.x, v.y, v.z)));
                break;
                
            case 'cylinder':
                mesh = new THREE.Mesh(
                    new THREE.CylinderGeometry(config.radius, config.radius, config.height, 16),
                    new THREE.MeshStandardMaterial({ 
                        color: config.color,
                        roughness: 0.5,
                        metalness: 0.4
                    })
                );
                shape = new CANNON.Cylinder(config.radius, config.radius, config.height, 16);
                break;
                
            case 'box':
                mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(...config.size),
                    new THREE.MeshStandardMaterial({ 
                        color: config.color,
                        roughness: 0.8,
                        metalness: 0.1
                    })
                );
                shape = new CANNON.Box(new CANNON.Vec3(
                    config.size[0]/2, config.size[1]/2, config.size[2]/2
                ));
                break;
                
            case 'sphere':
                mesh = new THREE.Mesh(
                    new THREE.SphereGeometry(config.radius, 32, 32),
                    new THREE.MeshStandardMaterial({ 
                        color: config.color,
                        roughness: 0.3,
                        metalness: 0.7
                    })
                );
                shape = new CANNON.Sphere(config.radius);
                break;
                
            case 'ramp':
                mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(...config.size),
                    new THREE.MeshStandardMaterial({ 
                        color: config.color,
                        roughness: 0.9,
                        metalness: 0
                    })
                );
                shape = new CANNON.Box(new CANNON.Vec3(
                    config.size[0]/2, config.size[1]/2, config.size[2]/2
                ));
                break;
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
        
        obstacles.push({ mesh, body, config });
    }
    
    // Деревья и декорации
    for (let i = 0; i < 20; i++) {
        const x = (Math.random() - 0.5) * 180;
        const z = (Math.random() - 0.5) * 180;
        if (Math.abs(x) < 50 && Math.abs(z) < 8) continue; // Не ставим на дорогу
        
        const tree = createTree(x, z);
        scene.add(tree);
    }
    
    console.log('✅ Препятствия созданы');
}

function createTree(x, z) {
    const treeGroup = new THREE.Group();
    
    // Ствол
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 6);
    const trunkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.9,
        metalness: 0
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.castShadow = true;
    treeGroup.add(trunk);
    
    // Крона
    const crownGeometry = new THREE.ConeGeometry(3, 8, 8);
    const crownMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2ecc71,
        roughness: 0.8,
        metalness: 0
    });
    const crown = new THREE.Mesh(crownGeometry, crownMaterial);
    crown.position.y = 7;
    crown.castShadow = true;
    treeGroup.add(crown);
    
    treeGroup.position.set(x, 3, z);
    
    return treeGroup;
}

// =================== СОЗДАНИЕ МАШИНЫ ===================
async function createCar() {
    console.log('🚗 Создание машины...');
    
    carGroup = new THREE.Group();
    scene.add(carGroup);
    
    // Цвет машины
    const carColor = 0x2980b9;
    const accentColor = 0xe74c3c;
    
    // Кузов (основная часть)
    const bodyGeometry = new THREE.BoxGeometry(3.2, 1.4, 6.4);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: carColor,
        roughness: 0.5,
        metalness: 0.8,
        envMapIntensity: 1
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    carGroup.add(body);
    
    // Капот
    const hoodGeometry = new THREE.BoxGeometry(3, 0.8, 2.2);
    const hood = new THREE.Mesh(hoodGeometry, bodyMaterial);
    hood.position.set(0, 1, 2);
    hood.castShadow = true;
    carGroup.add(hood);
    
    // Багажник
    const trunkGeometry = new THREE.BoxGeometry(3, 0.9, 1.8);
    const trunk = new THREE.Mesh(trunkGeometry, bodyMaterial);
    trunk.position.set(0, 0.9, -2.2);
    trunk.castShadow = true;
    carGroup.add(trunk);
    
    // Крыша
    const roofGeometry = new THREE.BoxGeometry(2.2, 0.8, 3);
    const roof = new THREE.Mesh(roofGeometry, bodyMaterial);
    roof.position.set(0, 1.8, 0);
    roof.castShadow = true;
    carGroup.add(roof);
    
    // Лобовое стекло
    const windshieldGeometry = new THREE.BoxGeometry(2.6, 1, 0.1);
    const windshieldMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x87CEEB,
        transmission: 0.9,
        roughness: 0.1,
        metalness: 0,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
    windshield.position.set(0, 1.6, 1);
    carGroup.add(windshield);
    
    // Заднее стекло
    const rearWindowGeometry = new THREE.BoxGeometry(2.6, 0.8, 0.1);
    const rearWindow = new THREE.Mesh(rearWindowGeometry, windshieldMaterial);
    rearWindow.position.set(0, 1.5, -1.5);
    carGroup.add(rearWindow);
    
    // Бамперы
    const bumperMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2c3e50,
        roughness: 0.8,
        metalness: 0.2
    });
    
    const frontBumperGeometry = new THREE.BoxGeometry(3.2, 0.6, 0.8);
    const frontBumper = new THREE.Mesh(frontBumperGeometry, bumperMaterial);
    frontBumper.position.set(0, 0.3, 3.2);
    frontBumper.castShadow = true;
    carGroup.add(frontBumper);
    
    const rearBumperGeometry = new THREE.BoxGeometry(3.2, 0.6, 0.8);
    const rearBumper = new THREE.Mesh(rearBumperGeometry, bumperMaterial);
    rearBumper.position.set(0, 0.3, -3.2);
    rearBumper.castShadow = true;
    carGroup.add(rearBumper);
    
    // Спойлер
    const spoilerGeometry = new THREE.BoxGeometry(2.8, 0.2, 0.8);
    const spoiler = new THREE.Mesh(spoilerGeometry, bumperMaterial);
    spoiler.position.set(0, 1.2, -3);
    carGroup.add(spoiler);
    
    // Фары
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 2 });
    
    const headlightGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const headlightPositions = [
        [1.2, 0.8, 3],
        [-1.2, 0.8, 3]
    ];
    
    headlightPositions.forEach(pos => {
        const headlight = new THREE.Mesh(headlightGeometry, lightMaterial);
        headlight.position.set(...pos);
        carGroup.add(headlight);
    });
    
    // Колёса
    await createWheels();
    
    // Регистрируем части для повреждений
    registerCarParts();
    
    // Физическое тело
    createCarPhysics();
    
    console.log('✅ Машина создана');
}

async function createWheels() {
    console.log('🛞 Создание колёс...');
    
    const wheelMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a,
        roughness: 0.9,
        metalness: 0.1
    });
    
    const rimMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x7f8c8d,
        roughness: 0.3,
        metalness: 0.7
    });
    
    const wheelPositions = [
        { x: 1.2, y: -0.3, z: 2.2 },   // Переднее правое
        { x: -1.2, y: -0.3, z: 2.2 },  // Переднее левое
        { x: 1.2, y: -0.3, z: -2.2 },  // Заднее правое
        { x: -1.2, y: -0.3, z: -2.2 }  // Заднее левое
    ];
    
    wheelPositions.forEach((pos, index) => {
        // Шина
        const tireGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
        const tire = new THREE.Mesh(tireGeometry, wheelMaterial);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(pos.x, pos.y, pos.z);
        tire.castShadow = true;
        carGroup.add(tire);
        
        // Диск
        const rimGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.41, 16);
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.rotation.z = Math.PI / 2;
        rim.position.set(pos.x, pos.y, pos.z);
        carGroup.add(rim);
        
        // Болты
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const boltGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8);
            const bolt = new THREE.Mesh(boltGeometry, rimMaterial);
            bolt.position.set(
                pos.x + Math.cos(angle) * 0.4,
                pos.y,
                pos.z + Math.sin(angle) * 0.4
            );
            bolt.rotation.z = Math.PI / 2;
            carGroup.add(bolt);
        }
    });
}

function registerCarParts() {
    const parts = carGroup.children.filter(child => child.type === 'Mesh');
    
    parts.forEach((mesh, index) => {
        // Определяем тип части по её позиции
        let partType = 'body';
        let strength = 1.0;
        
        if (mesh.position.z > 1.5) {
            partType = 'front';
            strength = 0.6;
        } else if (mesh.position.z < -1.5) {
            partType = 'rear';
            strength = 0.7;
        } else if (mesh.position.x > 0.5) {
            partType = 'right';
            strength = 0.5;
        } else if (mesh.position.x < -0.5) {
            partType = 'left';
            strength = 0.5;
        }
        
        // Проверяем, является ли часть стеклом
        if (mesh.material.transparent) {
            partType = 'glass';
            strength = 0.2;
        }
        
        // Проверяем, является ли часть колесом
        if (mesh.geometry.type.includes('Cylinder') && Math.abs(mesh.position.y + 0.3) < 0.5) {
            partType = 'wheel';
            strength = 0.8;
        }
        
        carParts.push({
            mesh: mesh,
            type: partType,
            strength: strength,
            originalScale: mesh.scale.clone(),
            originalPosition: mesh.position.clone(),
            originalRotation: mesh.rotation.clone(),
            damage: 0,
            detached: false,
            isWheel: partType === 'wheel'
        });
    });
}

function createCarPhysics() {
    // Основное тело машины
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1.6, 0.9, 3.2));
    carPhysicsBody = new CANNON.Body({ mass: CONFIG.CAR.MASS });
    carPhysicsBody.addShape(chassisShape);
    carPhysicsBody.position.set(0, 2, 0);
    carPhysicsBody.angularDamping = 0.8;
    carPhysicsBody.linearDamping = CONFIG.CAR.DRAG;
    carPhysicsBody.material = new CANNON.Material('car');
    carPhysicsBody.material.friction = 0.8;
    carPhysicsBody.material.restitution = 0.1;
    
    // Формы для колёс
    const wheelShapes = [
        new CANNON.Sphere(0.45),  // Переднее правое
        new CANNON.Sphere(0.45),  // Переднее левое
        new CANNON.Sphere(0.45),  // Заднее правое
        new CANNON.Sphere(0.45)   // Заднее левое
    ];
    
    const wheelOffsets = [
        new CANNON.Vec3(1.2, -0.3, 2.2),
        new CANNON.Vec3(-1.2, -0.3, 2.2),
        new CANNON.Vec3(1.2, -0.3, -2.2),
        new CANNON.Vec3(-1.2, -0.3, -2.2)
    ];
    
    wheelShapes.forEach((shape, index) => {
        carPhysicsBody.addShape(shape, wheelOffsets[index]);
    });
    
    world.addBody(carPhysicsBody);
}

// =================== ОСВЕЩЕНИЕ ===================
async function setupLights() {
    console.log('💡 Настройка освещения...');
    
    // Окружающий свет
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    // Основной направленный свет (солнце)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(50, 100, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = CONFIG.SHADOW_SIZE;
    sunLight.shadow.mapSize.height = CONFIG.SHADOW_SIZE;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);
    lights.push(sunLight);
    
    // Заполняющий свет
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-30, 50, -30);
    scene.add(fillLight);
    lights.push(fillLight);
    
    // Свет от неба
    const skyLight = new THREE.HemisphereLight(0x87CEEB, 0x2c3e50, 0.5);
    scene.add(skyLight);
    lights.push(skyLight);
    
    // Точечные огни для эффектов
    for (let i = 0; i < 4; i++) {
        const pointLight = new THREE.PointLight(0xffaa00, 0.5, 50);
        pointLight.position.set(
            Math.sin(i * Math.PI / 2) * 30,
            10,
            Math.cos(i * Math.PI / 2) * 30
        );
        scene.add(pointLight);
        lights.push(pointLight);
    }
    
    console.log('✅ Освещение настроено');
}

// =================== ПОСТОБРАБОТКА ===================
async function setupPostProcessing() {
    console.log('✨ Настройка постобработки...');
    
    if (!CONFIG.POST_PROCESSING) return;
    
    try {
        composer = new THREE.EffectComposer(renderer);
        const renderPass = new THREE.RenderPass(scene, camera);
        composer.addPass(renderPass);
        
        // Bloom эффект
        const bloomPass = new THREE.BloomPass(1.5, 25, 5);
        composer.addPass(bloomPass);
        
        // Film эффект (зернистость)
        const filmPass = new THREE.FilmPass(0.35, 0.5, 648, false);
        composer.addPass(filmPass);
        
        console.log('✅ Постобработка настроена');
    } catch (error) {
        console.warn('⚠️ Постобработка недоступна:', error.message);
        CONFIG.POST_PROCESSING = false;
    }
}

// =================== ОБРАБОТЧИКИ СОБЫТИЙ ===================
async function setupEventListeners() {
    console.log('🎮 Настройка управления...');
    
    // Клавиатура
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        
        // Визуальная обратная связь для кнопок
        if (e.code === 'KeyW') document.body.classList.add('engine-on');
        if (e.code === 'KeyS') document.body.classList.add('braking');
        
        // Быстрые действия
        if (e.code === 'KeyR') resetCar();
        if (e.code === 'KeyC') switchCamera();
        if (e.code === 'Space') handbrake(true);
    });
    
    window.addEventListener('keyup', (e) => {
        keys[e.code] = false;
        
        if (e.code === 'KeyW') document.body.classList.remove('engine-on');
        if (e.code === 'KeyS') document.body.classList.remove('braking');
        if (e.code === 'Space') handbrake(false);
    });
    
    // Мышь
    window.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    
    window.addEventListener('mousedown', () => {
        if (audioEnabled && UI.engineSound.paused) {
            UI.engineSound.play().catch(console.warn);
        }
    });
    
    // Кнопки UI
    UI.resetBtn.addEventListener('click', resetCar);
    UI.cameraBtn.addEventListener('click', switchCamera);
    UI.effectsBtn.addEventListener('click', toggleEffects);
    
    UI.bloomToggle.addEventListener('change', (e) => {
        bloomEnabled = e.target.checked;
        console.log('Bloom:', bloomEnabled ? 'ВКЛ' : 'ВЫКЛ');
    });
    
    UI.motionToggle.addEventListener('change', (e) => {
        slowMotion = e.target.checked;
        console.log('Замедление:', slowMotion ? 'ВКЛ' : 'ВЫКЛ');
    });
    
    UI.damageToggle.addEventListener('change', (e) => {
        console.log('Деформация:', e.target.checked ? 'ВКЛ' : 'ВЫКЛ');
    });
    
    UI.soundToggle.addEventListener('change', (e) => {
        audioEnabled = e.target.checked;
        UI.engineSound.volume = audioEnabled ? CONFIG.SOUND.ENGINE_VOLUME : 0;
        console.log('Звук:', audioEnabled ? 'ВКЛ' : 'ВЫКЛ');
    });
    
    // Закрытие сообщений
    document.querySelector('.message-close')?.addEventListener('click', () => {
        UI.welcomeMessage.style.display = 'none';
    });
    
    // Ресайз окна
    window.addEventListener('resize', onWindowResize);
    
    // Предотвращаем контекстное меню
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    
    console.log('✅ Управление настроено');
}

// =================== ФИЗИКА И УПРАВЛЕНИЕ ===================
function updatePhysics(deltaTime) {
    if (!carPhysicsBody) return;
    
    // Применяем замедление времени
    const timeScale = slowMotion ? 0.3 : 1;
    const scaledDelta = deltaTime * timeScale;
    
    // Шаги физики
    const steps = CONFIG.PHYSICS.SUBSTEPS;
    for (let i = 0; i < steps; i++) {
        world.step(scaledDelta / steps);
    }
    
    // Обновление UI физики
    UI.physicsCounter.textContent = Math.round(60 / timeScale);
    
    // Управление машиной
    updateCarControls(scaledDelta);
    
    // Проверка столкновений
    checkCollisions();
    
    // Обновление позиции машины
    updateCarPosition();
    
    // Обновление камеры
    updateCamera();
    
    // Обновление звуков
    updateSounds();
}

function updateCarControls(deltaTime) {
    const force = new CANNON.Vec3();
    const currentSpeed = carPhysicsBody.velocity.length() * 3.6; // км/ч
    
    // Ограничиваем максимальную скорость
    const speedFactor = Math.max(0, 1 - currentSpeed / CONFIG.CAR.MAX_SPEED);
    
    // Движение вперед
    if (keys['KeyW']) {
        force.z = -CONFIG.CAR.POWER.ENGINE * speedFactor;
        carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, 0));
    }
    
    // Торможение/движение назад
    if (keys['KeyS']) {
        if (currentSpeed > 5) {
            // Торможение
            const brakeForce = carPhysicsBody.velocity.clone();
            brakeForce.scale(-CONFIG.CAR.POWER.BRAKE, brakeForce);
            carPhysicsBody.applyForce(brakeForce, carPhysicsBody.position);
        } else {
            // Движение назад
            force.z = CONFIG.CAR.POWER.ENGINE * 0.5;
            carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, 0));
        }
    }
    
    // Поворот
    const steeringMultiplier = Math.min(1, currentSpeed / 50);
    if (keys['KeyA']) {
        force.x = -CONFIG.CAR.POWER.STEERING * steeringMultiplier;
        carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, -2));
    }
    
    if (keys['KeyD']) {
        force.x = CONFIG.CAR.POWER.STEERING * steeringMultiplier;
        carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, -2));
    }
    
    // Обновление спидометра
    updateSpeedometer(currentSpeed);
    
    // Обновление максимальной скорости
    if (currentSpeed > maxSpeed) {
        maxSpeed = currentSpeed;
        UI.maxSpeed.textContent = `${Math.round(maxSpeed)} км/ч`;
    }
}

function updateCarPosition() {
    if (!carGroup || !carPhysicsBody) return;
    
    // Синхронизация позиции
    carGroup.position.copy(carPhysicsBody.position);
    carGroup.quaternion.copy(carPhysicsBody.quaternion);
    
    // Вращение колёс
    const wheelSpeed = carPhysicsBody.velocity.length() * 10;
    carParts.forEach(part => {
        if (part.isWheel && !part.detached) {
            part.mesh.rotation.x += wheelSpeed * 0.01;
        }
    });
    
    // Обновление препятствий (если они двигаются)
    obstacles.forEach(obj => {
        obj.mesh.position.copy(obj.body.position);
        obj.mesh.quaternion.copy(obj.body.quaternion);
    });
}

// =================== СИСТЕМА ПОВРЕЖДЕНИЙ ===================
function checkCollisions() {
    const currentTime = Date.now();
    let collisionForce = 0;
    
    obstacles.forEach(obstacle => {
        // Упрощенная проверка столкновений
        const distance = carPhysicsBody.position.distanceTo(obstacle.body.position);
        const collisionRadius = 5; // Радиус для упрощенной проверки
        
        if (distance < collisionRadius) {
            const relativeVelocity = carPhysicsBody.velocity.length();
            
            if (relativeVelocity > 2) { // Минимальная скорость для регистрации удара
                collisionForce = relativeVelocity;
                collisionCount++;
                
                // Обновление UI
                UI.collisionCount.textContent = collisionCount;
                UI.impactForce.textContent = `${Math.round(collisionForce * 1000)} Н`;
                
                // Эффекты
                triggerCrashEffects(collisionForce);
                
                // Применение повреждений
                applyDamage(collisionForce, obstacle.body.position);
                
                // Физический отскок
                const bounceDirection = new CANNON.Vec3().copy(carPhysicsBody.position);
                bounceDirection.vsub(obstacle.body.position, bounceDirection);
                bounceDirection.normalize();
                bounceDirection.scale(collisionForce * 500, bounceDirection);
                carPhysicsBody.applyImpulse(bounceDirection, carPhysicsBody.position);
            }
        }
    });
}

function applyDamage(force, collisionPoint) {
    if (!UI.damageToggle.checked) return;
    
    // Определяем, в какую часть машины пришелся удар
    const localPoint = new THREE.Vector3().copy(collisionPoint);
    localPoint.sub(carGroup.position);
    carGroup.worldToLocal(localPoint);
    
    // Обновляем состояние повреждений
    if (localPoint.z > 0) {
        damageState.front = Math.min(damageState.front + force * 0.1, 100);
        UI.damageFront.style.width = `${damageState.front}%`;
        UI.damageFrontValue.textContent = `${Math.round(damageState.front)}%`;
    } else {
        damageState.rear = Math.min(damageState.rear + force * 0.1, 100);
        UI.damageRear.style.width = `${damageState.rear}%`;
        UI.damageRearValue.textContent = `${Math.round(damageState.rear)}%`;
    }
    
    if (localPoint.x > 0) {
        damageState.right = Math.min(damageState.right + force * 0.08, 100);
        UI.damageRight.style.width = `${damageState.right}%`;
        UI.damageRightValue.textContent = `${Math.round(damageState.right)}%`;
    } else {
        damageState.left = Math.min(damageState.left + force * 0.08, 100);
        UI.damageLeft.style.width = `${damageState.left}%`;
        UI.damageLeftValue.textContent = `${Math.round(damageState.left)}%`;
    }
    
    // Общий урон
    const totalDamage = (damageState.front + damageState.rear + damageState.left + damageState.right) / 4;
    UI.totalDamage.textContent = `${Math.round(totalDamage)}%`;
    
    // Применяем визуальную деформацию к частям
    carParts.forEach(part => {
        if (part.detached) return;
        
        // Расстояние до точки удара
        const distance = part.mesh.getWorldPosition(new THREE.Vector3())
            .distanceTo(new THREE.Vector3().copy(collisionPoint));
        
        if (distance < 3) {
            const damageAmount = force * (1 - part.strength) * CONFIG.DAMAGE.DEFORMATION_RATE;
            part.damage = Math.min(part.damage + damageAmount, 1);
            
            // Деформация
            deformPart(part);
            
            // Проверка на отрыв
            if (part.damage > CONFIG.DAMAGE.PART_DETACH_THRESHOLD && part.type !== 'body') {
                detachPart(part, collisionPoint);
            }
        }
    });
}

function deformPart(part) {
    const damage = part.damage;
    
    // Случайное сжатие/растяжение
    const squash = 1 - damage * 0.3 * Math.random();
    const stretch = 1 + damage * 0.2 * Math.random();
    
    part.mesh.scale.x = part.originalScale.x * (Math.random() > 0.5 ? squash : stretch);
    part.mesh.scale.y = part.originalScale.y * squash;
    part.mesh.scale.z = part.originalScale.z * (Math.random() > 0.5 ? squash : stretch);
    
    // Смещение
    const offset = damage * 0.5;
    part.mesh.position.x = part.originalPosition.x + (Math.random() - 0.5) * offset;
    part.mesh.position.y = part.originalPosition.y + (Math.random() - 0.5) * offset * 0.5;
    part.mesh.position.z = part.originalPosition.z + (Math.random() - 0.5) * offset;
    
    // Вращение
    part.mesh.rotation.x = part.originalRotation.x + (Math.random() - 0.5) * damage;
    part.mesh.rotation.y = part.originalRotation.y + (Math.random() - 0.5) * damage;
    part.mesh.rotation.z = part.originalRotation.z + (Math.random() - 0.5) * damage;
    
    // Изменение цвета при повреждении
    if (part.mesh.material && part.mesh.material.color) {
        const darken = 1 - damage * 0.5;
        part.mesh.material.color.multiplyScalar(darken);
    }
}

function detachPart(part, collisionPoint) {
    part.detached = true;
    
    // Создаем физическое тело для оторванной детали
    const size = new THREE.Box3().setFromObject(part.mesh).getSize(new THREE.Vector3());
    const shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
    const body = new CANNON.Body({ mass: 50 });
    body.addShape(shape);
    body.position.copy(collisionPoint);
    body.velocity.copy(carPhysicsBody.velocity);
    body.angularVelocity.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
    );
    world.addBody(body);
    
    // Отсоединяем от группы и добавляем в сцену
    carGroup.remove(part.mesh);
    scene.add(part.mesh);
    
    // Сохраняем ссылку для обновления
    part.physicsBody = body;
}

// =================== ЭФФЕКТЫ ===================
function triggerCrashEffects(force) {
    // Визуальные эффекты
    UI.crashEffect.classList.add('crash-active');
    UI.screenShake.classList.add('shake-active');
    UI.damageOverlay.classList.add('damage-active');
    
    setTimeout(() => {
        UI.crashEffect.classList.remove('crash-active');
        UI.screenShake.classList.remove('shake-active');
        UI.damageOverlay.classList.remove('damage-active');
    }, 500);
    
    // Звуковые эффекты
    if (audioEnabled) {
        UI.crashSound.volume = Math.min(force * 0.1, CONFIG.SOUND.CRASH_VOLUME);
        UI.crashSound.currentTime = 0;
        UI.crashSound.play().catch(console.warn);
        
        if (force > 5) {
            UI.screechSound.volume = CONFIG.SOUND.SCREECH_VOLUME;
            UI.screechSound.currentTime = 0;
            UI.screechSound.play().catch(console.warn);
        }
    }
}

function updateSpeedometer(speed) {
    UI.speedText.textContent = Math.round(speed);
    
    // Поворот стрелки спидометра
    const angle = (speed / CONFIG.CAR.MAX_SPEED) * 270 - 135; // от -135° до 135°
    UI.speedNeedle.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
    
    // Изменение цвета при высокой скорости
    if (speed > 120) {
        UI.speedText.style.color = '#e74c3c';
        UI.speedNeedle.style.background = '#e74c3c';
    } else if (speed > 80) {
        UI.speedText.style.color = '#f39c12';
        UI.speedNeedle.style.background = '#f39c12';
    } else {
        UI.speedText.style.color = '#ffffff';
        UI.speedNeedle.style.background = '#e74c3c';
    }
}

function updateCamera() {
    if (cameraMode === 'chase') {
        // Камера следует за машиной
        const carPos = carPhysicsBody.position;
        const carVelocity = carPhysicsBody.velocity;
        
        // Целевая позиция камеры
        const targetPos = new THREE.Vector3(
            carPos.x,
            carPos.y + 3,
            carPos.z - cameraDistance
        );
        
        // Плавное движение камеры
        camera.position.lerp(targetPos, 0.1);
        camera.lookAt(carPos.x, carPos.y + 1, carPos.z);
    }
    // Другие режимы камеры можно добавить здесь
}

function updateSounds() {
    if (!audioEnabled) return;
    
    const speed = carPhysicsBody.velocity.length() * 3.6;
    
    // Громкость двигателя зависит от скорости
    const targetVolume = Math.min(speed / 100, 1) * CONFIG.SOUND.ENGINE_VOLUME;
    UI.engineSound.volume = targetVolume;
    
    // Pitch двигателя зависит от скорости
    const targetPlaybackRate = 0.5 + (speed / CONFIG.CAR.MAX_SPEED) * 0.5;
    UI.engineSound.playbackRate = targetPlaybackRate;
    
    // Автозапуск звука двигателя
    if (UI.engineSound.paused && speed > 1) {
        UI.engineSound.play().catch(console.warn);
    }
}

// =================== УПРАВЛЕНИЕ ИГРОЙ ===================
function resetCar() {
    console.log('🔄 Респавн машины');
    
    // Сброс позиции и скорости
    carPhysicsBody.position.set(0, 2, 0);
    carPhysicsBody.velocity.set(0, 0, 0);
    carPhysicsBody.angularVelocity.set(0, 0, 0);
    carPhysicsBody.quaternion.set(0, 0, 0, 1);
    
    // Сброс повреждений
    damageState = { front: 0, rear: 0, left: 0, right: 0 };
    
    // Сброс визуальных повреждений
    UI.damageFront.style.width = '0%';
    UI.damageRear.style.width = '0%';
    UI.damageLeft.style.width = '0%';
    UI.damageRight.style.width = '0%';
    
    UI.damageFrontValue.textContent = '0%';
    UI.damageRearValue.textContent = '0%';
    UI.damageLeftValue.textContent = '0%';
    UI.damageRightValue.textContent = '0%';
    
    UI.totalDamage.textContent = '0%';
    
    // Восстановление оторванных частей
    carParts.forEach(part => {
        if (part.detached && part.physicsBody) {
            world.removeBody(part.physicsBody);
            scene.remove(part.mesh);
        }
        
        // Восстановление оригинального состояния
        part.detached = false;
        part.damage = 0;
        part.mesh.scale.copy(part.originalScale);
        part.mesh.position.copy(part.originalPosition);
        part.mesh.rotation.copy(part.originalRotation);
        
        // Возвращаем в группу машины
        if (!carGroup.children.includes(part.mesh)) {
            scene.remove(part.mesh);
            carGroup.add(part.mesh);
        }
        
        // Восстановление цвета
        if (part.mesh.material && part.mesh.material.color) {
            part.mesh.material.color.set(part.type === 'body' ? 0x2980b9 : 0x2c3e50);
        }
    });
    
    // Сброс счетчика столкновений
    collisionCount = 0;
    UI.collisionCount.textContent = '0';
    
    // Эффект респавна
    showMessage('Машина восстановлена!');
}

function switchCamera() {
    const modes = ['chase', 'orbit', 'hood', 'free'];
    const currentIndex = modes.indexOf(cameraMode);
    cameraMode = modes[(currentIndex + 1) % modes.length];
    
    switch (cameraMode) {
        case 'chase':
            cameraDistance = 15;
            showMessage('Камера: Слежение');
            break;
        case 'orbit':
            cameraDistance = 20;
            showMessage('Камера: Орбитальная');
            break;
        case 'hood':
            cameraDistance = 5;
            showMessage('Камера: Капот');
            break;
        case 'free':
            showMessage('Камера: Свободная');
            break;
    }
}

function toggleEffects() {
    bloomEnabled = !bloomEnabled;
    UI.bloomToggle.checked = bloomEnabled;
    showMessage(`Эффекты Bloom: ${bloomEnabled ? 'ВКЛ' : 'ВЫКЛ'}`);
}

function handbrake(active) {
    if (active) {
        carPhysicsBody.angularDamping = 0.95;
        carPhysicsBody.linearDamping = 0.9;
    } else {
        carPhysicsBody.angularDamping = 0.8;
        carPhysicsBody.linearDamping = CONFIG.CAR.DRAG;
    }
}

function showMessage(text) {
    const messages = document.getElementById('messages');
    const message = document.createElement('div');
    message.className = 'message';
    message.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <span>${text}</span>
        <button class="message-close">&times;</button>
    `;
    
    messages.appendChild(message);
    
    // Автоудаление через 5 секунд
    setTimeout(() => {
        message.style.opacity = '0';
        setTimeout(() => message.remove(), 500);
    }, 5000);
    
    // Кнопка закрытия
    message.querySelector('.message-close').addEventListener('click', () => {
        message.style.opacity = '0';
        setTimeout(() => message.remove(), 500);
    });
}

// =================== ИГРОВОЙ ЦИКЛ ===================
let clock = new THREE.Clock();
let lastTime = 0;
let fps = 60;

function animate() {
    requestAnimationFrame(animate);
    
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    // Расчет FPS
    fps = Math.round(1 / deltaTime);
    UI.fpsCounter.textContent = fps;
    
    // Обновление времени игры
    gameTime += deltaTime;
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    UI.playTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Обновление физики
    updatePhysics(deltaTime);
    
    // Обновление анимации огней
    updateLights(deltaTime);
    
    // Рендеринг
    if (CONFIG.POST_PROCESSING && bloomEnabled && composer) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

function updateLights(deltaTime) {
    // Анимация точечных огней
    lights.forEach((light, index) => {
        if (light.type === 'PointLight') {
            light.intensity = 0.5 + Math.sin(Date.now() * 0.001 + index) * 0.3;
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }
}

// =================== ЗАПУСК ИГРЫ ===================
// Запускаем игру после загрузки страницы
window.addEventListener('load', () => {
    console.log('🎮 Запуск игры...');
    init();
    
    // Предупреждение о управлении
    console.log('Управление:');
    console.log('W/S - Газ/Тормоз');
    console.log('A/D - Поворот');
    console.log('R - Респавн');
    console.log('C - Смена камеры');
    console.log('Space - Ручной тормоз');
});

// Предотвращаем прокрутку страницы при игре
document.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }
});
