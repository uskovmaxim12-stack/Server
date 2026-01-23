// =================== КОНФИГУРАЦИЯ ИГРЫ ===================
const GAME_CONFIG = {
    // Графические настройки
    GRAPHICS: {
        SHADOW_QUALITY: 2048,
        TEXTURE_QUALITY: 'high',
        POST_PROCESSING: true,
        BLOOM_INTENSITY: 1.2,
        BLOOM_THRESHOLD: 0.4,
        BLOOM_RADIUS: 0.8
    },
    
    // Физические настройки
    PHYSICS: {
        GRAVITY: 9.82,
        SUBSTEPS: 3,
        SOLVER_ITERATIONS: 10,
        WORLD_SCALE: 1,
        SLEEP_SPEED_LIMIT: 0.1
    },
    
    // Настройки машины
    CAR: {
        MASS: 1500,
        DIMENSIONS: { width: 2.2, height: 1.6, length: 4.8 },
        ENGINE: {
            MAX_POWER: 60000,
            TORQUE_CURVE: [0.3, 0.6, 0.8, 0.9, 1.0, 0.95, 0.85],
            IDLE_RPM: 800,
            REDLINE_RPM: 7000
        },
        STEERING: {
            MAX_ANGLE: 0.5,
            RESPONSIVENESS: 0.8,
            ASSIST: 0.3
        },
        BRAKES: {
            FRONT_POWER: 40000,
            REAR_POWER: 20000,
            HANDBRAKE_POWER: 30000
        },
        SUSPENSION: {
            STIFFNESS: 50,
            DAMPING: 5,
            TRAVEL: 0.3
        },
        WHEELS: {
            RADIUS: 0.35,
            WIDTH: 0.25,
            FRICTION: 0.8,
            ROLL_RESISTANCE: 0.01
        },
        AERODYNAMICS: {
            DRAG_COEFFICIENT: 0.35,
            LIFT_COEFFICIENT: 0.1,
            FRONTAL_AREA: 2.2
        }
    },
    
    // Система повреждений
    DAMAGE: {
        DEFORMATION_RATE: 0.15,
        PART_DETACH_THRESHOLD: 0.85,
        MATERIAL_STRENGTH: {
            BODY: 1.0,
            DOOR: 0.6,
            HOOD: 0.5,
            TRUNK: 0.5,
            BUMPER: 0.3,
            GLASS: 0.2,
            WHEEL: 0.7
        },
        DENT_DEPTH: 0.3,
        CREASE_ANGLE: 0.5
    },
    
    // Настройки звука
    SOUND: {
        ENGINE: {
            VOLUME: 0.4,
            PITCH_RANGE: [0.5, 1.5],
            LOAD_MULTIPLIER: 0.3
        },
        COLLISION: {
            VOLUME: 0.7,
            MIN_FORCE: 100,
            MAX_FORCE: 10000
        },
        TIRE_SCREECH: {
            VOLUME: 0.5,
            MIN_SPEED: 5,
            SLIP_THRESHOLD: 0.3
        }
    },
    
    // Настройки мира
    WORLD: {
        SIZE: 500,
        ROAD_WIDTH: 12,
        BUILDING_DENSITY: 0.1,
        VEGETATION_DENSITY: 0.05,
        OBSTACLE_COUNT: 20
    }
};

// =================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===================
let scene, camera, renderer, composer, world, clock;
let carGroup, carPhysicsBody, carParts = [], carWheels = [];
let environment = { ground: null, road: null, buildings: [], obstacles: [], vegetation: [] };
let lights = [], particles = [];
let keys = {}, mouse = { x: 0, y: 0, buttons: 0 };
let gameState = {
    time: 0,
    distance: 0,
    collisions: 0,
    maxSpeed: 0,
    totalDamage: 0,
    detachedParts: 0,
    achievements: new Set()
};
let cameraMode = 'chase';
let cameraDistance = 15;
let cameraHeight = 5;
let cameraAngle = 0;
let slowMotion = false;
let bloomEnabled = true;
let audioEnabled = true;
let damageEnabled = true;

// =================== ЭЛЕМЕНТЫ ИНТЕРФЕЙСА ===================
const UI = {
    // Статистика
    fpsCounter: document.getElementById('fpsCounter'),
    physicsCounter: document.getElementById('physicsCounter'),
    gameTimer: document.getElementById('gameTimer'),
    speedValue: document.getElementById('speedValue'),
    speedFill: document.getElementById('speedFill'),
    collisionCount: document.getElementById('collisionCount'),
    maxSpeed: document.getElementById('maxSpeed'),
    totalDamage: document.getElementById('totalDamage'),
    maxImpact: document.getElementById('maxImpact'),
    detachedParts: document.getElementById('detachedParts'),
    
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
    
    // Кнопки
    resetBtn: document.getElementById('resetBtn'),
    cameraBtn: document.getElementById('cameraBtn'),
    effectsBtn: document.getElementById('effectsBtn'),
    
    // Переключатели
    bloomToggle: document.getElementById('bloomToggle'),
    slowmoToggle: document.getElementById('slowmoToggle'),
    damageToggle: document.getElementById('damageToggle'),
    soundToggle: document.getElementById('soundToggle'),
    shadowsToggle: document.getElementById('shadowsToggle'),
    
    // Аудио
    engineSound: document.getElementById('engineSound'),
    crashSound: document.getElementById('crashSound'),
    screechSound: document.getElementById('screechSound'),
    metalCrunch: document.getElementById('metalCrunch'),
    
    // Сообщения
    welcomeMsg: document.getElementById('welcomeMsg')
};

// =================== ИНИЦИАЛИЗАЦИЯ ИГРЫ ===================
async function initGame() {
    console.log('🎮 Инициализация игры...');
    
    try {
        await initializeEngine();
        await createScene();
        await createPhysicsWorld();
        await createEnvironment();
        await createCar();
        await setupLighting();
        await setupPostProcessing();
        await setupEventListeners();
        await setupAudio();
        
        // Старт игрового цикла
        clock = new THREE.Clock();
        animate();
        
        console.log('✅ Игра успешно инициализирована');
        showNotification('ИГРА ЗАГРУЖЕНА', 'Используйте W/A/S/D для управления. Врезайтесь в препятствия!');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        showError('Ошибка загрузки игры', error.message);
    }
}

async function initializeEngine() {
    console.log('⚙️ Инициализация движка...');
    
    // Сцена
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 50, 300);
    
    // Камера
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2000);
    camera.position.set(0, 8, -15);
    
    // Рендерер
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('gameCanvas'),
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.autoClear = true;
    
    console.log('✅ Движок инициализирован');
}

async function createPhysicsWorld() {
    console.log('🌍 Создание физического мира...');
    
    world = new CANNON.World();
    world.gravity = new CANNON.Vec3(0, -GAME_CONFIG.PHYSICS.GRAVITY, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = GAME_CONFIG.PHYSICS.SOLVER_ITERATIONS;
    world.defaultContactMaterial.friction = 0.8;
    world.defaultContactMaterial.restitution = 0.2;
    world.defaultContactMaterial.contactEquationStiffness = 1e7;
    world.defaultContactMaterial.contactEquationRelaxation = 3;
    
    // Материалы
    const groundMaterial = new CANNON.Material('ground');
    const carMaterial = new CANNON.Material('car');
    const obstacleMaterial = new CANNON.Material('obstacle');
    
    // Контактные материалы
    const groundCarCM = new CANNON.ContactMaterial(groundMaterial, carMaterial, {
        friction: 0.8,
        restitution: 0.1,
        contactEquationStiffness: 1e7
    });
    
    const carObstacleCM = new CANNON.ContactMaterial(carMaterial, obstacleMaterial, {
        friction: 0.6,
        restitution: 0.3,
        contactEquationStiffness: 1e7
    });
    
    world.addContactMaterial(groundCarCM);
    world.addContactMaterial(carObstacleCM);
    
    console.log('✅ Физический мир создан');
}

// =================== СОЗДАНИЕ ОКРУЖЕНИЯ ===================
async function createEnvironment() {
    console.log('🏙️ Создание игрового мира...');
    
    // Создаем небо
    createSky();
    
    // Создаем землю
    createGround();
    
    // Создаем дорогу
    createRoad();
    
    // Создаем городские постройки
    createCity();
    
    // Создаем препятствия
    createObstacles();
    
    // Создаем растительность
    createVegetation();
    
    // Создаем барьеры
    createBarriers();
    
    console.log('✅ Игровой мир создан');
}

function createSky() {
    // Небосклон (градиентное небо)
    const vertexShader = `
        varying vec3 vWorldPosition;
        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
    
    const fragmentShader = `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        uniform float offset;
        varying vec3 vWorldPosition;
        
        void main() {
            float h = normalize(vWorldPosition + offset).y;
            vec3 color;
            
            if (h > 0.0) {
                color = mix(horizonColor, topColor, h);
            } else {
                color = mix(bottomColor, horizonColor, h + 1.0);
            }
            
            gl_FragColor = vec4(color, 1.0);
        }
    `;
    
    const skyGeometry = new THREE.SphereGeometry(1000, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x87CEEB) },
            horizonColor: { value: new THREE.Color(0x98D8E8) },
            bottomColor: { value: new THREE.Color(0xB0E0E6) },
            offset: { value: 33 }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.BackSide
    });
    
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);
    
    // Облака (плоскости с текстурой)
    for (let i = 0; i < 15; i++) {
        const cloudGeometry = new THREE.PlaneGeometry(40 + Math.random() * 40, 15 + Math.random() * 15);
        const cloudMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6 + Math.random() * 0.3,
            side: THREE.DoubleSide
        });
        
        const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
        cloud.position.set(
            (Math.random() - 0.5) * 400,
            100 + Math.random() * 50,
            (Math.random() - 0.5) * 400
        );
        cloud.rotation.x = Math.PI / 2;
        scene.add(cloud);
    }
}

function createGround() {
    // Основная земля
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x3d9970,
        roughness: 0.9,
        metalness: 0
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
    
    environment.ground = { mesh: groundMesh, body: groundBody };
    
    // Трава (декоративные плоскости)
    const grassGeometry = new THREE.PlaneGeometry(2, 2);
    const grassMaterial = new THREE.MeshStandardMaterial({
        color: 0x2ecc71,
        side: THREE.DoubleSide,
        roughness: 0.8
    });
    
    for (let i = 0; i < 100; i++) {
        const grass = new THREE.Mesh(grassGeometry, grassMaterial);
        const x = (Math.random() - 0.5) * 480;
        const z = (Math.random() - 0.5) * 480;
        
        // Не ставим траву на дороге
        if (Math.abs(z) < 30 && Math.abs(x) < 150) continue;
        
        grass.position.set(x, 0.01, z);
        grass.rotation.x = -Math.PI / 2;
        grass.rotation.z = Math.random() * Math.PI;
        scene.add(grass);
        environment.vegetation.push(grass);
    }
}

function createRoad() {
    // Основное дорожное полотно
    const roadGeometry = new THREE.PlaneGeometry(300, 12);
    const roadMaterial = new THREE.MeshStandardMaterial({
        color: 0x34495e,
        roughness: 0.7,
        metalness: 0.1
    });
    
    const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.y = 0.02;
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);
    
    environment.road = roadMesh;
    
    // Разметка
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 3
    });
    
    // Центральная прерывистая линия
    for (let z = -140; z <= 140; z += 10) {
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-0.2, 0.03, z),
            new THREE.Vector3(-0.2, 0.03, z + 5)
        ]);
        
        const line = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(line);
        
        const line2 = new THREE.Line(lineGeometry.clone(), lineMaterial);
        line2.position.x = 0.4;
        scene.add(line2);
    }
    
    // Боковые линии
    const sideLineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-6, 0.03, -150),
        new THREE.Vector3(-6, 0.03, 150)
    ]);
    
    const leftLine = new THREE.Line(sideLineGeometry, lineMaterial);
    scene.add(leftLine);
    
    const rightLine = new THREE.Line(sideLineGeometry.clone(), lineMaterial);
    rightLine.position.x = 12;
    scene.add(rightLine);
    
    // Дорожные знаки
    createRoadSigns();
}

function createRoadSigns() {
    // Материал для знаков
    const signMaterial = new THREE.MeshStandardMaterial({
        color: 0xf1c40f,
        roughness: 0.3,
        metalness: 0.7
    });
    
    const poleMaterial = new THREE.MeshStandardMaterial({
        color: 0x7f8c8d,
        roughness: 0.8
    });
    
    // Несколько дорожных знаков
    const signPositions = [
        { x: -8, z: 50, type: 'stop' },
        { x: 8, z: 100, type: 'speed' },
        { x: -8, z: -50, type: 'warning' },
        { x: 8, z: -100, type: 'stop' }
    ];
    
    signPositions.forEach(pos => {
        // Столб
        const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 3);
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.set(pos.x, 1.5, pos.z);
        pole.castShadow = true;
        scene.add(pole);
        
        // Знак
        let signGeometry;
        switch (pos.type) {
            case 'stop':
                signGeometry = new THREE.CircleGeometry(0.8, 32);
                break;
            case 'speed':
                signGeometry = new THREE.BoxGeometry(1.2, 1.2, 0.1);
                break;
            case 'warning':
                signGeometry = new THREE.CircleGeometry(0.8, 3); // Треугольник
                break;
        }
        
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(pos.x, 3, pos.z);
        sign.castShadow = true;
        scene.add(sign);
    });
}

function createCity() {
    console.log('🏢 Создание городских построек...');
    
    const buildingMaterials = [
        new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.5 }),
        new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.4 })
    ];
    
    const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0x3498db,
        emissive: 0x3498db,
        emissiveIntensity: 0.3,
        roughness: 0.1,
        metalness: 0.9
    });
    
    // Создаем здания по сетке
    for (let x = -200; x <= 200; x += 50) {
        for (let z = -200; z <= 200; z += 50) {
            // Пропускаем центральную зону с дорогой
            if (Math.abs(z) < 40 && Math.abs(x) < 100) continue;
            if (Math.abs(x) < 25 && Math.abs(z) < 25) continue; // Место для старта
            
            const width = 15 + Math.random() * 20;
            const depth = 15 + Math.random() * 20;
            const height = 20 + Math.random() * 50;
            
            // Основное здание
            const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
            const buildingMaterial = buildingMaterials[Math.floor(Math.random() * buildingMaterials.length)];
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            
            building.position.set(
                x + (Math.random() - 0.5) * 20,
                height / 2,
                z + (Math.random() - 0.5) * 20
            );
            
            building.castShadow = true;
            building.receiveShadow = true;
            scene.add(building);
            environment.buildings.push(building);
            
            // Окна
            const windowRows = Math.floor(height / 4);
            const windowCols = Math.floor(width / 3);
            
            for (let row = 0; row < windowRows; row++) {
                for (let col = 0; col < windowCols; col++) {
                    if (Math.random() > 0.7) continue; // Случайные пустые окна
                    
                    const windowGeometry = new THREE.BoxGeometry(1.5, 2, 0.1);
                    const window = new THREE.Mesh(windowGeometry, windowMaterial);
                    
                    window.position.set(
                        building.position.x - width/2 + col * 3 + 1.5,
                        building.position.y - height/2 + row * 4 + 2,
                        building.position.z + depth/2 + 0.1
                    );
                    
                    scene.add(window);
                }
            }
            
            // Крыша
            if (Math.random() > 0.5) {
                const roofGeometry = new THREE.ConeGeometry(width/2, 5, 4);
                const roof = new THREE.Mesh(roofGeometry, buildingMaterial);
                roof.position.set(
                    building.position.x,
                    building.position.y + height/2 + 2.5,
                    building.position.z
                );
                roof.rotation.y = Math.PI / 4;
                scene.add(roof);
            }
        }
    }
    
    console.log(`✅ Создано зданий: ${environment.buildings.length}`);
}

function createObstacles() {
    console.log('🚧 Создание препятствий...');
    
    const obstacleTypes = [
        {
            name: 'Бетонный блок',
            geometry: new THREE.BoxGeometry(4, 4, 4),
            material: new THREE.MeshStandardMaterial({ 
                color: 0x95a5a6,
                roughness: 0.9
            })
        },
        {
            name: 'Металлическая бочка',
            geometry: new THREE.CylinderGeometry(1.5, 1.5, 3, 16),
            material: new THREE.MeshStandardMaterial({ 
                color: 0xe74c3c,
                roughness: 0.4,
                metalness: 0.6
            })
        },
        {
            name: 'Деревянный поддон',
            geometry: new THREE.BoxGeometry(3, 0.5, 2),
            material: new THREE.MeshStandardMaterial({ 
                color: 0x8B4513,
                roughness: 0.8
            })
        },
        {
            name: 'Шлакоблок',
            geometry: new THREE.BoxGeometry(2, 1, 1),
            material: new THREE.MeshStandardMaterial({ 
                color: 0x7f8c8d,
                roughness: 0.7
            })
        },
        {
            name: 'Стальной контейнер',
            geometry: new THREE.BoxGeometry(5, 3, 3),
            material: new THREE.MeshStandardMaterial({ 
                color: 0x3498db,
                roughness: 0.3,
                metalness: 0.7
            })
        }
    ];
    
    // Распределяем препятствия по миру
    for (let i = 0; i < GAME_CONFIG.WORLD.OBSTACLE_COUNT; i++) {
        const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        const obstacle = new THREE.Mesh(type.geometry, type.material);
        
        // Позиционируем в случайном месте, но не на дороге
        let x, z;
        do {
            x = (Math.random() - 0.5) * 200;
            z = (Math.random() - 0.5) * 200;
        } while (Math.abs(z) < 30 && Math.abs(x) < 100); // Избегаем дороги
        
        obstacle.position.set(x, type.geometry.parameters.height/2, z);
        obstacle.rotation.y = Math.random() * Math.PI;
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        
        scene.add(obstacle);
        
        // Физическое тело
        let shape;
        if (type.geometry.type === 'BoxGeometry') {
            const size = type.geometry.parameters;
            shape = new CANNON.Box(new CANNON.Vec3(
                size.width/2, size.height/2, size.depth/2
            ));
        } else if (type.geometry.type === 'CylinderGeometry') {
            const size = type.geometry.parameters;
            shape = new CANNON.Cylinder(size.radiusTop, size.radiusBottom, size.height, 16);
        }
        
        const body = new CANNON.Body({ 
            mass: 100,
            material: world.materials.obstacle
        });
        body.addShape(shape);
        body.position.copy(obstacle.position);
        body.quaternion.copy(obstacle.quaternion);
        world.addBody(body);
        
        environment.obstacles.push({
            mesh: obstacle,
            body: body,
            name: type.name,
            health: 100
        });
    }
    
    console.log(`✅ Создано препятствий: ${environment.obstacles.length}`);
}

function createVegetation() {
    console.log('🌳 Создание растительности...');
    
    // Деревья
    const treeTrunkMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        roughness: 0.9
    });
    
    const treeFoliageMaterial = new THREE.MeshStandardMaterial({
        color: 0x27ae60,
        roughness: 0.8
    });
    
    for (let i = 0; i < 50; i++) {
        const x = (Math.random() - 0.5) * 400;
        const z = (Math.random() - 0.5) * 400;
        
        // Не ставим деревья на дороге или слишком близко к старту
        if (Math.abs(z) < 40 && Math.abs(x) < 120) continue;
        if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;
        
        // Ствол
        const trunkHeight = 4 + Math.random() * 6;
        const trunkRadius = 0.3 + Math.random() * 0.3;
        const trunkGeometry = new THREE.CylinderGeometry(trunkRadius, trunkRadius * 1.2, trunkHeight, 8);
        const trunk = new THREE.Mesh(trunkGeometry, treeTrunkMaterial);
        trunk.position.set(x, trunkHeight/2, z);
        trunk.castShadow = true;
        scene.add(trunk);
        
        // Крона
        const foliageRadius = 2 + Math.random() * 3;
        const foliageGeometry = new THREE.SphereGeometry(foliageRadius, 8, 6);
        const foliage = new THREE.Mesh(foliageGeometry, treeFoliageMaterial);
        foliage.position.set(x, trunkHeight + foliageRadius * 0.7, z);
        foliage.castShadow = true;
        scene.add(foliage);
        
        environment.vegetation.push(trunk, foliage);
    }
    
    // Кусты
    const bushMaterial = new THREE.MeshStandardMaterial({
        color: 0x2ecc71,
        roughness: 0.9
    });
    
    for (let i = 0; i < 30; i++) {
        const x = (Math.random() - 0.5) * 400;
        const z = (Math.random() - 0.5) * 400;
        
        if (Math.abs(z) < 40 && Math.abs(x) < 120) continue;
        
        const bushSize = 1 + Math.random() * 2;
        const bushGeometry = new THREE.SphereGeometry(bushSize, 6, 4);
        const bush = new THREE.Mesh(bushGeometry, bushMaterial);
        bush.position.set(x, bushSize, z);
        bush.castShadow = true;
        scene.add(bush);
        
        environment.vegetation.push(bush);
    }
    
    console.log(`✅ Создано растительности: ${environment.vegetation.length} объектов`);
}

function createBarriers() {
    // Барьерные ограждения вдоль дороги
    const barrierMaterial = new THREE.MeshStandardMaterial({
        color: 0xf1c40f,
        roughness: 0.5,
        metalness: 0.5
    });
    
    // Левая сторона
    for (let z = -150; z <= 150; z += 5) {
        const barrierGeometry = new THREE.BoxGeometry(0.2, 1, 4);
        const barrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
        barrier.position.set(-6, 0.5, z);
        barrier.castShadow = true;
        scene.add(barrier);
        
        // Физическое тело
        const barrierBody = new CANNON.Body({ mass: 0 });
        barrierBody.addShape(new CANNON.Box(new CANNON.Vec3(0.1, 0.5, 2)));
        barrierBody.position.copy(barrier.position);
        world.addBody(barrierBody);
        
        environment.obstacles.push({
            mesh: barrier,
            body: barrierBody,
            name: 'Барьер',
            health: 50
        });
    }
    
    // Правая сторона
    for (let z = -150; z <= 150; z += 5) {
        const barrierGeometry = new THREE.BoxGeometry(0.2, 1, 4);
        const barrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
        barrier.position.set(6, 0.5, z);
        barrier.castShadow = true;
        scene.add(barrier);
        
        // Физическое тело
        const barrierBody = new CANNON.Body({ mass: 0 });
        barrierBody.addShape(new CANNON.Box(new CANNON.Vec3(0.1, 0.5, 2)));
        barrierBody.position.copy(barrier.position);
        world.addBody(barrierBody);
        
        environment.obstacles.push({
            mesh: barrier,
            body: barrierBody,
            name: 'Барьер',
            health: 50
        });
    }
}

// =================== СОЗДАНИЕ МАШИНЫ ===================
async function createCar() {
    console.log('🚗 Создание детализированной машины...');
    
    carGroup = new THREE.Group();
    scene.add(carGroup);
    
    // Основные материалы
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x2980b9,
        roughness: 0.4,
        metalness: 0.8,
        envMapIntensity: 1.2
    });
    
    const accentMaterial = new THREE.MeshStandardMaterial({
        color: 0x2c3e50,
        roughness: 0.6,
        metalness: 0.4
    });
    
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x88ccff,
        transmission: 0.9,
        roughness: 0.1,
        metalness: 0,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    
    const tireMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.9,
        metalness: 0
    });
    
    const rimMaterial = new THREE.MeshStandardMaterial({
        color: 0x7f8c8d,
        roughness: 0.3,
        metalness: 0.7
    });
    
    const lightMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffcc,
        emissive: 0xffffcc,
        emissiveIntensity: 2
    });
    
    // 1. КУЗОВ
    const chassisGeometry = new THREE.BoxGeometry(2.2, 1.0, 4.8);
    const chassis = new THREE.Mesh(chassisGeometry, bodyMaterial);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    carGroup.add(chassis);
    
    // 2. КАПОТ
    const hoodGeometry = new THREE.BoxGeometry(2.0, 0.6, 1.5);
    const hood = new THREE.Mesh(hoodGeometry, bodyMaterial);
    hood.position.set(0, 0.8, 1.8);
    hood.castShadow = true;
    carGroup.add(hood);
    
    // 3. БАГАЖНИК
    const trunkGeometry = new THREE.BoxGeometry(2.0, 0.7, 1.3);
    const trunk = new THREE.Mesh(trunkGeometry, bodyMaterial);
    trunk.position.set(0, 0.75, -2.0);
    trunk.castShadow = true;
    carGroup.add(trunk);
    
    // 4. КРЫША
    const roofGeometry = new THREE.BoxGeometry(1.8, 0.8, 2.5);
    const roof = new THREE.Mesh(roofGeometry, bodyMaterial);
    roof.position.set(0, 1.6, 0.2);
    roof.castShadow = true;
    carGroup.add(roof);
    
    // 5. БАМПЕРЫ
    const bumperGeometry = new THREE.BoxGeometry(2.3, 0.4, 0.6);
    
    // Передний бампер
    const frontBumper = new THREE.Mesh(bumperGeometry, accentMaterial);
    frontBumper.position.set(0, 0.3, 2.5);
    frontBumper.castShadow = true;
    carGroup.add(frontBumper);
    
    // Задний бампер
    const rearBumper = new THREE.Mesh(bumperGeometry, accentMaterial);
    rearBumper.position.set(0, 0.3, -2.5);
    rearBumper.castShadow = true;
    carGroup.add(rearBumper);
    
    // 6. СТЕКЛА
    // Лобовое стекло
    const windshieldGeometry = new THREE.BoxGeometry(1.9, 0.8, 0.1);
    const windshield = new THREE.Mesh(windshieldGeometry, glassMaterial);
    windshield.position.set(0, 1.6, 1.2);
    carGroup.add(windshield);
    
    // Заднее стекло
    const rearWindowGeometry = new THREE.BoxGeometry(1.9, 0.7, 0.1);
    const rearWindow = new THREE.Mesh(rearWindowGeometry, glassMaterial);
    rearWindow.position.set(0, 1.5, -1.0);
    carGroup.add(rearWindow);
    
    // Боковые стекла
    const sideWindowGeometry = new THREE.BoxGeometry(0.1, 0.6, 1.2);
    const leftWindow = new THREE.Mesh(sideWindowGeometry, glassMaterial);
    leftWindow.position.set(-1.0, 1.6, 0.3);
    carGroup.add(leftWindow);
    
    const rightWindow = new THREE.Mesh(sideWindowGeometry, glassMaterial);
    rightWindow.position.set(1.0, 1.6, 0.3);
    carGroup.add(rightWindow);
    
    // 7. ДВЕРИ
    const doorGeometry = new THREE.BoxGeometry(0.8, 1.2, 1.0);
    
    // Левая дверь
    const leftDoor = new THREE.Mesh(doorGeometry, bodyMaterial);
    leftDoor.position.set(-1.3, 0.6, 0.3);
    leftDoor.castShadow = true;
    carGroup.add(leftDoor);
    
    // Правая дверь
    const rightDoor = new THREE.Mesh(doorGeometry, bodyMaterial);
    rightDoor.position.set(1.3, 0.6, 0.3);
    rightDoor.castShadow = true;
    carGroup.add(rightDoor);
    
    // 8. ФАРЫ
    const headlightGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    
    // Передние фары
    const frontHeadlights = [
        { x: 0.8, y: 0.7, z: 2.4 },
        { x: -0.8, y: 0.7, z: 2.4 }
    ];
    
    frontHeadlights.forEach(pos => {
        const headlight = new THREE.Mesh(headlightGeometry, lightMaterial);
        headlight.position.set(pos.x, pos.y, pos.z);
        carGroup.add(headlight);
    });
    
    // Задние фары
    const tailLightGeometry = new THREE.BoxGeometry(0.3, 0.4, 0.1);
    const tailLightMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3333,
        emissive: 0xff3333,
        emissiveIntensity: 3
    });
    
    const rearLights = [
        { x: 0.6, y: 0.7, z: -2.4 },
        { x: -0.6, y: 0.7, z: -2.4 }
    ];
    
    rearLights.forEach(pos => {
        const tailLight = new THREE.Mesh(tailLightGeometry, tailLightMaterial);
        tailLight.position.set(pos.x, pos.y, pos.z);
        carGroup.add(tailLight);
    });
    
    // 9. ЗЕРКАЛА
    const mirrorGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.1);
    const leftMirror = new THREE.Mesh(mirrorGeometry, bodyMaterial);
    leftMirror.position.set(-1.2, 1.4, 0.8);
    carGroup.add(leftMirror);
    
    const rightMirror = new THREE.Mesh(mirrorGeometry, bodyMaterial);
    rightMirror.position.set(1.2, 1.4, 0.8);
    carGroup.add(rightMirror);
    
    // 10. СПОЙЛЕР
    const spoilerGeometry = new THREE.BoxGeometry(1.8, 0.15, 0.4);
    const spoiler = new THREE.Mesh(spoilerGeometry, accentMaterial);
    spoiler.position.set(0, 1.8, -2.2);
    carGroup.add(spoiler);
    
    // 11. КОЛЕСА
    createWheels(tireMaterial, rimMaterial);
    
    // 12. ВЫХЛОПНАЯ СИСТЕМА
    const exhaustGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8);
    const exhaustMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.2,
        metalness: 0.8
    });
    
    const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
    exhaust.position.set(-0.4, 0.2, -2.4);
    exhaust.rotation.z = Math.PI / 2;
    carGroup.add(exhaust);
    
    // Регистрируем все части для системы повреждений
    registerCarParts();
    
    // Создаем физическое тело машины
    createCarPhysics();
    
    console.log('✅ Машина создана');
}

function createWheels(tireMaterial, rimMaterial) {
    const wheelPositions = [
        { x: 0.85, y: -0.3, z: 1.5, name: 'frontRight' },
        { x: -0.85, y: -0.3, z: 1.5, name: 'frontLeft' },
        { x: 0.85, y: -0.3, z: -1.5, name: 'rearRight' },
        { x: -0.85, y: -0.3, z: -1.5, name: 'rearLeft' }
    ];
    
    wheelPositions.forEach(pos => {
        // Шина
        const tireGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16);
        const tire = new THREE.Mesh(tireGeometry, tireMaterial);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(pos.x, pos.y, pos.z);
        tire.castShadow = true;
        carGroup.add(tire);
        
        // Диск
        const rimGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.26, 12);
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.rotation.z = Math.PI / 2;
        rim.position.set(pos.x, pos.y, pos.z);
        carGroup.add(rim);
        
        // Болты
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const boltGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6);
            const bolt = new THREE.Mesh(boltGeometry, rimMaterial);
            bolt.position.set(
                pos.x + Math.cos(angle) * 0.2,
                pos.y,
                pos.z + Math.sin(angle) * 0.2
            );
            bolt.rotation.z = Math.PI / 2;
            carGroup.add(bolt);
        }
        
        carWheels.push({
            tire: tire,
            rim: rim,
            position: pos,
            steering: pos.z > 0,
            drive: pos.z < 0
        });
    });
}

function registerCarParts() {
    const partsConfig = [
        // Кузов и основные части
        { mesh: carGroup.children[0], type: 'chassis', strength: 1.0, detachable: false },
        { mesh: carGroup.children[1], type: 'hood', strength: 0.5, detachable: true },
        { mesh: carGroup.children[2], type: 'trunk', strength: 0.5, detachable: true },
        { mesh: carGroup.children[3], type: 'roof', strength: 0.8, detachable: false },
        { mesh: carGroup.children[4], type: 'bumper', strength: 0.3, detachable: true },
        { mesh: carGroup.children[5], type: 'bumper', strength: 0.3, detachable: true },
        
        // Стекла
        { mesh: carGroup.children[6], type: 'glass', strength: 0.2, detachable: true },
        { mesh: carGroup.children[7], type: 'glass', strength: 0.2, detachable: true },
        { mesh: carGroup.children[8], type: 'glass', strength: 0.2, detachable: true },
        { mesh: carGroup.children[9], type: 'glass', strength: 0.2, detachable: true },
        
        // Двери
        { mesh: carGroup.children[10], type: 'door', strength: 0.6, detachable: true },
        { mesh: carGroup.children[11], type: 'door', strength: 0.6, detachable: true },
        
        // Фары и зеркала
        { mesh: carGroup.children[12], type: 'light', strength: 0.1, detachable: true },
        { mesh: carGroup.children[13], type: 'light', strength: 0.1, detachable: true },
        { mesh: carGroup.children[16], type: 'mirror', strength: 0.1, detachable: true },
        { mesh: carGroup.children[17], type: 'mirror', strength: 0.1, detachable: true },
        
        // Спойлер
        { mesh: carGroup.children[18], type: 'spoiler', strength: 0.4, detachable: true },
        
        // Выхлоп
        { mesh: carGroup.children[19], type: 'exhaust', strength: 0.3, detachable: true }
    ];
    
    partsConfig.forEach((config, index) => {
        carParts.push({
            mesh: config.mesh,
            type: config.type,
            strength: config.strength,
            detachable: config.detachable,
            originalScale: config.mesh.scale.clone(),
            originalPosition: config.mesh.position.clone(),
            originalRotation: config.mesh.rotation.clone(),
            damage: 0,
            detached: false,
            physicsBody: null,
            index: index
        });
    });
    
    // Добавляем колеса отдельно
    carWheels.forEach((wheel, index) => {
        carParts.push({
            mesh: wheel.tire,
            type: 'wheel',
            strength: 0.7,
            detachable: true,
            originalScale: wheel.tire.scale.clone(),
            originalPosition: wheel.tire.position.clone(),
            originalRotation: wheel.tire.rotation.clone(),
            damage: 0,
            detached: false,
            physicsBody: null,
            isWheel: true,
            wheelIndex: index
        });
    });
}

function createCarPhysics() {
    // Основное тело (шасси)
    const chassisShape = new CANNON.Box(new CANNON.Vec3(
        GAME_CONFIG.CAR.DIMENSIONS.width / 2,
        GAME_CONFIG.CAR.DIMENSIONS.height / 3,
        GAME_CONFIG.CAR.DIMENSIONS.length / 2
    ));
    
    carPhysicsBody = new CANNON.Body({ 
        mass: GAME_CONFIG.CAR.MASS,
        material: world.materials.car
    });
    
    carPhysicsBody.addShape(chassisShape);
    carPhysicsBody.position.set(0, 2, 0);
    carPhysicsBody.linearDamping = GAME_CONFIG.CAR.AERODYNAMICS.DRAG_COEFFICIENT;
    carPhysicsBody.angularDamping = 0.8;
    carPhysicsBody.updateMassProperties();
    
    // Добавляем формы для колес
    const wheelShape = new CANNON.Sphere(GAME_CONFIG.CAR.WHEELS.RADIUS);
    const wheelPositions = [
        new CANNON.Vec3(0.85, -0.3, 1.5),
        new CANNON.Vec3(-0.85, -0.3, 1.5),
        new CANNON.Vec3(0.85, -0.3, -1.5),
        new CANNON.Vec3(-0.85, -0.3, -1.5)
    ];
    
    wheelPositions.forEach(pos => {
        carPhysicsBody.addShape(wheelShape, pos);
    });
    
    world.addBody(carPhysicsBody);
}

// =================== ОСВЕЩЕНИЕ ===================
async function setupLighting() {
    console.log('💡 Настройка освещения...');
    
    // Окружающий свет
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    lights.push(ambientLight);
    
    // Основное направленное освещение (солнце)
    const sunLight = new THREE.DirectionalLight(0xffffcc, 1.0);
    sunLight.position.set(100, 200, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = GAME_CONFIG.GRAPHICS.SHADOW_QUALITY;
    sunLight.shadow.mapSize.height = GAME_CONFIG.GRAPHICS.SHADOW_QUALITY;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);
    lights.push(sunLight);
    
    // Заполняющий свет
    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.3);
    fillLight.position.set(-50, 100, -50);
    scene.add(fillLight);
    lights.push(fillLight);
    
    // Свет от неба
    const skyLight = new THREE.HemisphereLight(0x87CEEB, 0x3d9970, 0.6);
    scene.add(skyLight);
    lights.push(skyLight);
    
    // Точечные огни для зданий
    for (let i = 0; i < 10; i++) {
        const pointLight = new THREE.PointLight(0xffaa33, 0.5, 50);
        pointLight.position.set(
            (Math.random() - 0.5) * 300,
            10 + Math.random() * 20,
            (Math.random() - 0.5) * 300
        );
        scene.add(pointLight);
        lights.push(pointLight);
    }
    
    console.log('✅ Освещение настроено');
}

// =================== ПОСТОБРАБОТКА ===================
async function setupPostProcessing() {
    console.log('✨ Настройка постобработки...');
    
    if (!GAME_CONFIG.GRAPHICS.POST_PROCESSING) return;
    
    try {
        composer = new THREE.EffectComposer(renderer);
        const renderPass = new THREE.RenderPass(scene, camera);
        composer.addPass(renderPass);
        
        // Bloom эффект
        const bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            GAME_CONFIG.GRAPHICS.BLOOM_INTENSITY,
            GAME_CONFIG.GRAPHICS.BLOOM_RADIUS,
            GAME_CONFIG.GRAPHICS.BLOOM_THRESHOLD
        );
        composer.addPass(bloomPass);
        
        console.log('✅ Постобработка настроена');
    } catch (error) {
        console.warn('⚠️ Постобработка недоступна:', error.message);
    }
}

// =================== АУДИО ===================
async function setupAudio() {
    console.log('🔊 Настройка аудио...');
    
    // Устанавливаем начальные громкости
    UI.engineSound.volume = GAME_CONFIG.SOUND.ENGINE.VOLUME;
    UI.crashSound.volume = GAME_CONFIG.SOUND.COLLISION.VOLUME;
    UI.screechSound.volume = GAME_CONFIG.SOUND.TIRE_SCREECH.VOLUME;
    UI.metalCrunch.volume = GAME_CONFIG.SOUND.COLLISION.VOLUME;
    
    // Предзагрузка звуков
    await preloadAudio();
    
    console.log('✅ Аудио настроено');
}

async function preloadAudio() {
    const audioElements = [
        UI.engineSound,
        UI.crashSound,
        UI.screechSound,
        UI.metalCrunch
    ];
    
    const promises = audioElements.map(audio => {
        return new Promise((resolve, reject) => {
            audio.addEventListener('canplaythrough', () => resolve(), { once: true });
            audio.addEventListener('error', (e) => reject(e), { once: true });
        });
    });
    
    try {
        await Promise.all(promises);
        console.log('✅ Все звуки предзагружены');
    } catch (error) {
        console.warn('⚠️ Некоторые звуки не загрузились:', error);
    }
}

// =================== ОБРАБОТЧИКИ СОБЫТИЙ ===================
async function setupEventListeners() {
    console.log('🎮 Настройка управления...');
    
    // Клавиатура
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Мышь
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleMouseWheel);
    
    // Касания (для мобильных)
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchmove', handleTouchMove);
    
    // Кнопки UI
    UI.resetBtn.addEventListener('click', resetCar);
    UI.cameraBtn.addEventListener('click', switchCameraMode);
    UI.effectsBtn.addEventListener('click', toggleEffects);
    
    UI.bloomToggle.addEventListener('change', (e) => {
        bloomEnabled = e.target.checked;
        showMessage(`Bloom эффекты: ${bloomEnabled ? 'ВКЛ' : 'ВЫКЛ'}`);
    });
    
    UI.slowmoToggle.addEventListener('change', (e) => {
        slowMotion = e.target.checked;
        showMessage(`Замедление: ${slowMotion ? 'ВКЛ' : 'ВЫКЛ'}`);
    });
    
    UI.damageToggle.addEventListener('change', (e) => {
        damageEnabled = e.target.checked;
        showMessage(`Деформация: ${damageEnabled ? 'ВКЛ' : 'ВЫКЛ'}`);
    });
    
    UI.soundToggle.addEventListener('change', (e) => {
        audioEnabled = e.target.checked;
        UI.engineSound.volume = audioEnabled ? GAME_CONFIG.SOUND.ENGINE.VOLUME : 0;
        showMessage(`Звук: ${audioEnabled ? 'ВКЛ' : 'ВЫКЛ'}`);
    });
    
    UI.shadowsToggle.addEventListener('change', (e) => {
        renderer.shadowMap.enabled = e.target.checked;
        lights.forEach(light => {
            if (light.castShadow !== undefined) {
                light.castShadow = e.target.checked;
            }
        });
        showMessage(`Тени: ${e.target.checked ? 'ВКЛ' : 'ВЫКЛ'}`);
    });
    
    // Ресайз окна
    window.addEventListener('resize', handleResize);
    
    // Предотвращаем стандартное поведение
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
        }
    });
    
    console.log('✅ Управление настроено');
}

function handleKeyDown(event) {
    keys[event.code] = true;
    
    // Визуальная обратная связь
    switch (event.code) {
        case 'KeyW':
            document.body.classList.add('accelerating');
            break;
        case 'KeyS':
            document.body.classList.add('braking');
            break;
        case 'KeyR':
            resetCar();
            break;
        case 'KeyC':
            switchCameraMode();
            break;
        case 'Space':
            applyHandbrake(true);
            break;
    }
}

function handleKeyUp(event) {
    keys[event.code] = false;
    
    switch (event.code) {
        case 'KeyW':
            document.body.classList.remove('accelerating');
            break;
        case 'KeyS':
            document.body.classList.remove('braking');
            break;
        case 'Space':
            applyHandbrake(false);
            break;
    }
}

function handleMouseDown(event) {
    mouse.buttons = event.buttons;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function handleMouseUp(event) {
    mouse.buttons = 0;
}

function handleMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function handleMouseWheel(event) {
    cameraDistance = Math.max(5, Math.min(30, cameraDistance + event.deltaY * 0.01));
}

function handleTouchStart(event) {
    event.preventDefault();
    if (event.touches.length > 0) {
        const touch = event.touches[0];
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        mouse.buttons = 1;
    }
}

function handleTouchEnd(event) {
    event.preventDefault();
    mouse.buttons = 0;
}

function handleTouchMove(event) {
    event.preventDefault();
    if (event.touches.length > 0) {
        const touch = event.touches[0];
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    }
}

function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }
}

// =================== ФИЗИКА И УПРАВЛЕНИЕ МАШИНОЙ ===================
function updatePhysics(deltaTime) {
    if (!carPhysicsBody) return;
    
    // Применяем замедление времени
    const timeScale = slowMotion ? 0.3 : 1.0;
    const scaledDelta = deltaTime * timeScale;
    
    // Выполняем несколько шагов физики для стабильности
    const steps = GAME_CONFIG.PHYSICS.SUBSTEPS;
    const stepDelta = scaledDelta / steps;
    
    for (let i = 0; i < steps; i++) {
        updateCarControls(stepDelta);
        world.step(stepDelta);
        checkCollisions();
    }
    
    // Обновление UI физики
    UI.physicsCounter.textContent = Math.round(60 / timeScale);
    
    // Синхронизация позиции машины
    updateCarPosition();
    
    // Обновление камеры
    updateCamera();
    
    // Обновление звуков
    updateSounds(deltaTime);
}

function updateCarControls(deltaTime) {
    const force = new CANNON.Vec3();
    const currentSpeed = carPhysicsBody.velocity.length() * 3.6; // км/ч
    
    // Ограничение максимальной скорости
    const speedFactor = Math.max(0, 1 - currentSpeed / 200);
    
    // Движение вперед (W)
    if (keys['KeyW']) {
        const enginePower = GAME_CONFIG.CAR.ENGINE.MAX_POWER * speedFactor;
        force.z = -enginePower;
        carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, 0));
    }
    
    // Торможение/движение назад (S)
    if (keys['KeyS']) {
        if (currentSpeed > 5) {
            // Торможение
            const brakeForce = carPhysicsBody.velocity.clone();
            brakeForce.scale(-GAME_CONFIG.CAR.BRAKES.FRONT_POWER, brakeForce);
            carPhysicsBody.applyForce(brakeForce, carPhysicsBody.position);
        } else {
            // Движение назад
            force.z = GAME_CONFIG.CAR.ENGINE.MAX_POWER * 0.4;
            carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, 0));
        }
    }
    
    // Поворот (A/D)
    const steeringMultiplier = Math.min(1, currentSpeed / 50);
    const steeringPower = GAME_CONFIG.CAR.STEERING.MAX_ANGLE * steeringMultiplier;
    
    if (keys['KeyA']) {
        force.x = -steeringPower * 10000;
        carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, -1.5));
    }
    
    if (keys['KeyD']) {
        force.x = steeringPower * 10000;
        carPhysicsBody.applyLocalForce(force, new CANNON.Vec3(0, 0, -1.5));
    }
    
    // Обновление спидометра
    updateSpeedometer(currentSpeed);
    
    // Обновление максимальной скорости
    if (currentSpeed > gameState.maxSpeed) {
        gameState.maxSpeed = currentSpeed;
        UI.maxSpeed.textContent = `${Math.round(gameState.maxSpeed)} км/ч`;
        
        // Достижение скорости
        if (gameState.maxSpeed >= 100 && !gameState.achievements.has('speed100')) {
            gameState.achievements.add('speed100');
            unlockAchievement('speed100');
        }
    }
}

function applyHandbrake(active) {
    if (!carPhysicsBody) return;
    
    if (active) {
        carPhysicsBody.angularDamping = 0.95;
        carPhysicsBody.linearDamping = 0.9;
    } else {
        carPhysicsBody.angularDamping = 0.8;
        carPhysicsBody.linearDamping = GAME_CONFIG.CAR.AERODYNAMICS.DRAG_COEFFICIENT;
    }
}

function updateCarPosition() {
    if (!carGroup || !carPhysicsBody) return;
    
    // Синхронизация позиции и вращения
    carGroup.position.copy(carPhysicsBody.position);
    carGroup.quaternion.copy(carPhysicsBody.quaternion);
    
    // Вращение колес в зависимости от скорости
    const wheelSpeed = carPhysicsBody.velocity.length() * 20;
    const steeringAngle = 0;
    
    carWheels.forEach(wheel => {
        if (wheel.tire && wheel.rim) {
            // Вращение колес
            wheel.tire.rotation.x += wheelSpeed * deltaTime;
            wheel.rim.rotation.x += wheelSpeed * deltaTime;
            
            // Поворот передних колес
            if (wheel.steering) {
                if (keys['KeyA']) {
                    wheel.tire.rotation.y = Math.PI / 6;
                    wheel.rim.rotation.y = Math.PI / 6;
                } else if (keys['KeyD']) {
                    wheel.tire.rotation.y = -Math.PI / 6;
                    wheel.rim.rotation.y = -Math.PI / 6;
                } else {
                    wheel.tire.rotation.y = 0;
                    wheel.rim.rotation.y = 0;
                }
            }
        }
    });
    
    // Обновление оторванных деталей
    updateDetachedParts();
}

function updateDetachedParts() {
    carParts.forEach(part => {
        if (part.detached && part.physicsBody) {
            part.mesh.position.copy(part.physicsBody.position);
            part.mesh.quaternion.copy(part.physicsBody.quaternion);
        }
    });
}

// =================== СИСТЕМА ПОВРЕЖДЕНИЙ ===================
function checkCollisions() {
    let maxImpactForce = 0;
    
    environment.obstacles.forEach(obstacle => {
        // Упрощенная проверка столкновений
        const distance = carPhysicsBody.position.distanceTo(obstacle.body.position);
        const collisionThreshold = 3; // Радиус для проверки столкновений
        
        if (distance < collisionThreshold) {
            const relativeVelocity = carPhysicsBody.velocity.length();
            const impactForce = relativeVelocity * GAME_CONFIG.CAR.MASS;
            
            if (impactForce > GAME_CONFIG.SOUND.COLLISION.MIN_FORCE) {
                // Регистрируем столкновение
                gameState.collisions++;
                UI.collisionCount.textContent = gameState.collisions;
                
                // Обновляем максимальную силу удара
                if (impactForce > maxImpactForce) {
                    maxImpactForce = impactForce;
                    UI.maxImpact.textContent = `${Math.round(maxImpactForce)} Н`;
                }
                
                // Эффекты столкновения
                triggerCollisionEffects(impactForce, obstacle.body.position);
                
                // Применение повреждений
                if (damageEnabled) {
                    applyDamage(impactForce, obstacle.body.position);
                }
                
                // Физический отскок
                applyCollisionForce(impactForce, obstacle.body.position);
                
                // Повреждение препятствия
                damageObstacle(obstacle, impactForce);
                
                // Достижение первой аварии
                if (gameState.collisions === 1 && !gameState.achievements.has('firstCrash')) {
                    gameState.achievements.add('firstCrash');
                    unlockAchievement('firstCrash');
                }
            }
        }
    });
}

function applyDamage(force, collisionPoint) {
    // Конвертируем точку столкновения в локальные координаты машины
    const localPoint = new THREE.Vector3().copy(collisionPoint);
    localPoint.sub(carGroup.position);
    carGroup.worldToLocal(localPoint);
    
    // Обновляем индикаторы повреждений по зонам
    updateDamageIndicators(localPoint, force);
    
    // Находим ближайшие части для повреждения
    const affectedParts = findAffectedParts(localPoint, force);
    
    // Применяем повреждения к найденным частям
    affectedParts.forEach(part => {
        if (part.detached) return;
        
        const distance = part.mesh.getWorldPosition(new THREE.Vector3())
            .distanceTo(collisionPoint);
        
        const damageMultiplier = Math.max(0, 1 - distance / 3);
        const damageAmount = (force / 10000) * (1 - part.strength) * damageMultiplier;
        
        part.damage = Math.min(part.damage + damageAmount, 1);
        
        // Деформация части
        if (part.damage > 0.1) {
            deformPart(part, damageAmount);
        }
        
        // Проверка на отрыв
        if (part.detachable && part.damage > GAME_CONFIG.DAMAGE.PART_DETACH_THRESHOLD) {
            detachPart(part, collisionPoint);
        }
    });
    
    // Обновляем общий урон
    updateTotalDamage();
}

function updateDamageIndicators(localPoint, force) {
    const damageAmount = Math.min(force / 5000, 10);
    
    if (localPoint.z > 0) {
        // Передняя часть
        const current = parseFloat(UI.damageFrontValue.textContent) || 0;
        const newValue = Math.min(current + damageAmount, 100);
        UI.damageFront.style.width = `${newValue}%`;
        UI.damageFrontValue.textContent = `${Math.round(newValue)}%`;
    } else {
        // Задняя часть
        const current = parseFloat(UI.damageRearValue.textContent) || 0;
        const newValue = Math.min(current + damageAmount, 100);
        UI.damageRear.style.width = `${newValue}%`;
        UI.damageRearValue.textContent = `${Math.round(newValue)}%`;
    }
    
    if (localPoint.x > 0) {
        // Правый бок
        const current = parseFloat(UI.damageRightValue.textContent) || 0;
        const newValue = Math.min(current + damageAmount * 0.8, 100);
        UI.damageRight.style.width = `${newValue}%`;
        UI.damageRightValue.textContent = `${Math.round(newValue)}%`;
    } else {
        // Левый бок
        const current = parseFloat(UI.damageLeftValue.textContent) || 0;
        const newValue = Math.min(current + damageAmount * 0.8, 100);
        UI.damageLeft.style.width = `${newValue}%`;
        UI.damageLeftValue.textContent = `${Math.round(newValue)}%`;
    }
}

function findAffectedParts(localPoint, force) {
    // Сортируем части по расстоянию до точки удара
    return carParts
        .filter(part => !part.detached)
        .map(part => {
            const worldPos = part.mesh.getWorldPosition(new THREE.Vector3());
            const distance = worldPos.distanceTo(
                new THREE.Vector3().copy(localPoint).add(carGroup.position)
            );
            return { part, distance };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3) // Берем 3 ближайшие части
        .map(item => item.part);
}

function deformPart(part, damageAmount) {
    // Случайная деформация
    const deformation = damageAmount * GAME_CONFIG.DAMAGE.DEFORMATION_RATE;
    
    // Изменение масштаба (вмятины)
    const squashX = 1 - deformation * Math.random() * 0.5;
    const squashY = 1 - deformation * Math.random() * 0.3;
    const squashZ = 1 - deformation * Math.random() * 0.5;
    
    part.mesh.scale.x = part.originalScale.x * squashX;
    part.mesh.scale.y = part.originalScale.y * squashY;
    part.mesh.scale.z = part.originalScale.z * squashZ;
    
    // Смещение (искривление)
    const offset = deformation * 0.3;
    part.mesh.position.x = part.originalPosition.x + (Math.random() - 0.5) * offset;
    part.mesh.position.y = part.originalPosition.y + (Math.random() - 0.5) * offset * 0.5;
    part.mesh.position.z = part.originalPosition.z + (Math.random() - 0.5) * offset;
    
    // Вращение (скручивание)
    part.mesh.rotation.x = part.originalRotation.x + (Math.random() - 0.5) * deformation;
    part.mesh.rotation.y = part.originalRotation.y + (Math.random() - 0.5) * deformation;
    part.mesh.rotation.z = part.originalRotation.z + (Math.random() - 0.5) * deformation;
    
    // Изменение цвета (потемнение)
    if (part.mesh.material && part.mesh.material.color) {
        const darken = 1 - damageAmount * 0.3;
        part.mesh.material.color.multiplyScalar(darken);
    }
}

function detachPart(part, collisionPoint) {
    part.detached = true;
    gameState.detachedParts++;
    UI.detachedParts.textContent = gameState.detachedParts;
    
    // Создаем физическое тело для оторванной детали
    const size = new THREE.Box3().setFromObject(part.mesh).getSize(new THREE.Vector3());
    const shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
    
    part.physicsBody = new CANNON.Body({ 
        mass: 10,
        material: world.materials.car
    });
    
    part.physicsBody.addShape(shape);
    part.physicsBody.position.copy(collisionPoint);
    part.physicsBody.velocity.copy(carPhysicsBody.velocity);
    part.physicsBody.angularVelocity.set(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5
    );
    
    world.addBody(part.physicsBody);
    
    // Отсоединяем от группы машины
    carGroup.remove(part.mesh);
    scene.add(part.mesh);
    
    // Достижение тотального урона
    if (gameState.detachedParts >= 3 && !gameState.achievements.has('totalDamage')) {
        gameState.achievements.add('totalDamage');
        unlockAchievement('totalDamage');
    }
}

function updateTotalDamage() {
    let total = 0;
    let count = 0;
    
    // Считаем урон только по основным зонам из UI
    const zones = ['damageFrontValue', 'damageRearValue', 'damageLeftValue', 'damageRightValue'];
    
    zones.forEach(zoneId => {
        const value = parseFloat(UI[zoneId].textContent) || 0;
        total += value;
        count++;
    });
    
    gameState.totalDamage = total / count;
    UI.totalDamage.textContent = `${Math.round(gameState.totalDamage)}%`;
}

function damageObstacle(obstacle, force) {
    // Уменьшаем здоровье препятствия
    obstacle.health -= force / 100;
    
    // Если здоровье кончилось, разрушаем препятствие
    if (obstacle.health <= 0) {
        destroyObstacle(obstacle);
    } else {
        // Визуальный эффект повреждения
        obstacle.mesh.material.emissive = new THREE.Color(0xff0000);
        obstacle.mesh.material.emissiveIntensity = 0.5;
        
        setTimeout(() => {
            obstacle.mesh.material.emissiveIntensity = 0;
        }, 200);
    }
}

function destroyObstacle(obstacle) {
    // Удаляем из мира
    world.removeBody(obstacle.body);
    scene.remove(obstacle.mesh);
    
    // Удаляем из массива
    const index = environment.obstacles.indexOf(obstacle);
    if (index > -1) {
        environment.obstacles.splice(index, 1);
    }
    
    // Эффект разрушения
    createDestructionEffect(obstacle.mesh.position);
}

function createDestructionEffect(position) {
    // Создаем частицы разрушения
    for (let i = 0; i < 20; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.1 + Math.random() * 0.2, 4, 4);
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: 0x7f8c8d
        });
        
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(position);
        
        // Случайное направление
        particle.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            Math.random() * 10,
            (Math.random() - 0.5) * 10
        );
        
        particle.userData.life = 1.0;
        scene.add(particle);
        particles.push(particle);
    }
}

function applyCollisionForce(force, collisionPoint) {
    const direction = new CANNON.Vec3().copy(carPhysicsBody.position);
    direction.vsub(collisionPoint, direction);
    direction.normalize();
    
    // Учитываем текущую скорость
    const speedMultiplier = carPhysicsBody.velocity.length() / 10;
    const totalForce = force * 100 * (1 + speedMultiplier);
    
    direction.scale(totalForce, direction);
    carPhysicsBody.applyImpulse(direction, carPhysicsBody.position);
}

// =================== ЭФФЕКТЫ И АНИМАЦИИ ===================
function triggerCollisionEffects(force, position) {
    // Визуальные эффекты
    UI.crashEffect.classList.add('crash-active');
    UI.screenShake.classList.add('shake-active');
    
    setTimeout(() => {
        UI.crashEffect.classList.remove('crash-active');
        UI.screenShake.classList.remove('shake-active');
    }, 500);
    
    // Звуковые эффекты
    if (audioEnabled) {
        const volume = Math.min(force / 5000, 1) * GAME_CONFIG.SOUND.COLLISION.VOLUME;
        
        // Звук удара
        UI.crashSound.volume = volume;
        UI.crashSound.currentTime = 0;
        UI.crashSound.play().catch(console.warn);
        
        // Звук скрипа металла для сильных ударов
        if (force > 2000) {
            UI.metalCrunch.volume = volume * 0.7;
            UI.metalCrunch.currentTime = 0;
            UI.metalCrunch.play().catch(console.warn);
        }
        
        // Звук скрипа шин
        const speed = carPhysicsBody.velocity.length();
        if (speed > GAME_CONFIG.SOUND.TIRE_SCREECH.MIN_SPEED) {
            UI.screechSound.volume = GAME_CONFIG.SOUND.TIRE_SCREECH.VOLUME * Math.min(speed / 20, 1);
            UI.screechSound.currentTime = 0;
            UI.screechSound.play().catch(console.warn);
        }
    }
    
    // Частицы искр
    createSparkEffect(position, force);
}

function createSparkEffect(position, force) {
    const sparkCount = Math.min(Math.floor(force / 500), 50);
    
    for (let i = 0; i < sparkCount; i++) {
        const sparkGeometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            0, 0, 0,
            (Math.random() - 0.5) * 0.5,
            Math.random() * 0.5,
            (Math.random() - 0.5) * 0.5
        ]);
        
        sparkGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        
        const sparkMaterial = new THREE.LineBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        
        const spark = new THREE.Line(sparkGeometry, sparkMaterial);
        spark.position.copy(position);
        
        spark.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            Math.random() * 5,
            (Math.random() - 0.5) * 10
        );
        
        spark.userData.life = 1.0;
        scene.add(spark);
        particles.push(spark);
    }
}

function updateParticles(deltaTime) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        
        particle.userData.life -= deltaTime;
        
        if (particle.userData.life <= 0) {
            scene.remove(particle);
            particles.splice(i, 1);
            continue;
        }
        
        // Обновление позиции
        particle.position.add(particle.userData.velocity.clone().multiplyScalar(deltaTime));
        
        // Гравитация
        particle.userData.velocity.y -= 9.82 * deltaTime;
        
        // Затухание
        particle.userData.velocity.multiplyScalar(0.98);
        
        // Обновление прозрачности
        if (particle.material.opacity !== undefined) {
            particle.material.opacity = particle.userData.life;
        }
    }
}

// =================== КАМЕРА ===================
function updateCamera() {
    if (!carPhysicsBody) return;
    
    const carPosition = carPhysicsBody.position;
    const carVelocity = carPhysicsBody.velocity;
    
    switch (cameraMode) {
        case 'chase':
            // Камера преследования
            const targetPosition = new THREE.Vector3(
                carPosition.x,
                carPosition.y + cameraHeight,
                carPosition.z - cameraDistance
            );
            
            // Сглаживание движения камеры
            camera.position.lerp(targetPosition, 0.1);
            camera.lookAt(carPosition.x, carPosition.y + 2, carPosition.z);
            break;
            
        case 'orbit':
            // Орбитальная камера
            cameraAngle += 0.01;
            const orbitRadius = cameraDistance;
            const orbitHeight = cameraHeight + 5;
            
            camera.position.set(
                carPosition.x + Math.cos(cameraAngle) * orbitRadius,
                carPosition.y + orbitHeight,
                carPosition.z + Math.sin(cameraAngle) * orbitRadius
            );
            camera.lookAt(carPosition);
            break;
            
        case 'hood':
            // Камера на капоте
            const hoodOffset = new THREE.Vector3(0, 1.5, 2);
            const worldHoodOffset = hoodOffset.applyQuaternion(carGroup.quaternion);
            
            camera.position.copy(carPosition).add(worldHoodOffset);
            camera.quaternion.copy(carGroup.quaternion);
            break;
            
        case 'free':
            // Свободная камера (управляется мышью)
            if (mouse.buttons === 1) {
                cameraAngle += mouse.x * 0.1;
                cameraDistance = Math.max(5, Math.min(50, cameraDistance + mouse.y * 2));
            }
            
            const freeX = carPosition.x + Math.cos(cameraAngle) * cameraDistance;
            const freeZ = carPosition.z + Math.sin(cameraAngle) * cameraDistance;
            
            camera.position.set(freeX, carPosition.y + 10, freeZ);
            camera.lookAt(carPosition);
            break;
    }
}

function switchCameraMode() {
    const modes = ['chase', 'orbit', 'hood', 'free'];
    const currentIndex = modes.indexOf(cameraMode);
    cameraMode = modes[(currentIndex + 1) % modes.length];
    
    const modeNames = {
        'chase': 'Преследование',
        'orbit': 'Орбитальная',
        'hood': 'Капот',
        'free': 'Свободная'
    };
    
    showMessage(`Камера: ${modeNames[cameraMode]}`);
}

// =================== АУДИО ===================
function updateSounds(deltaTime) {
    if (!audioEnabled || !carPhysicsBody) return;
    
    const speed = carPhysicsBody.velocity.length() * 3.6; // км/ч
    
    // Двигатель
    updateEngineSound(speed, deltaTime);
    
    // Автозапуск звука двигателя
    if (UI.engineSound.paused && speed > 1) {
        UI.engineSound.play().catch(console.warn);
    }
}

function updateEngineSound(speed, deltaTime) {
    const targetVolume = Math.min(speed / 100, 1) * GAME_CONFIG.SOUND.ENGINE.VOLUME;
    const targetPitch = 0.5 + (speed / 200);
    
    // Плавное изменение громкости и тона
    UI.engineSound.volume += (targetVolume - UI.engineSound.volume) * deltaTime * 5;
    UI.engineSound.playbackRate += (targetPitch - UI.engineSound.playbackRate) * deltaTime * 5;
    
    // Эффект нагрузки при ускорении
    if (keys['KeyW'] && speed < 100) {
        UI.engineSound.playbackRate += 0.1;
    }
}

// =================== ИНТЕРФЕЙС ===================
function updateSpeedometer(speed) {
    UI.speedValue.textContent = Math.round(speed);
    UI.speedFill.style.width = `${Math.min(speed / 2, 100)}%`;
    
    // Изменение цвета при высокой скорости
    if (speed > 120) {
        UI.speedValue.style.color = '#e74c3c';
        UI.speedFill.classList.add('high-speed');
    } else if (speed > 80) {
        UI.speedValue.style.color = '#f1c40f';
        UI.speedFill.classList.remove('high-speed');
    } else {
        UI.speedValue.style.color = '#ffffff';
        UI.speedFill.classList.remove('high-speed');
    }
}

function updateGameTimer(deltaTime) {
    gameState.time += deltaTime;
    
    const minutes = Math.floor(gameState.time / 60);
    const seconds = Math.floor(gameState.time % 60);
    
    UI.gameTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function unlockAchievement(achievementId) {
    const achievement = document.querySelector(`[data-id="${achievementId}"]`);
    if (achievement) {
        achievement.classList.add('unlocked');
        
        // Анимация разблокировки
        achievement.style.animation = 'none';
        setTimeout(() => {
            achievement.style.animation = 'popIn 0.5s ease';
        }, 10);
        
        showNotification('ДОСТИЖЕНИЕ РАЗБЛОКИРОВАНО', getAchievementName(achievementId));
    }
}

function getAchievementName(id) {
    const names = {
        'firstCrash': 'Первая авария',
        'speed100': 'Скорость 100 км/ч',
        'totalDamage': 'Тотальный урон'
    };
    return names[id] || 'Неизвестное достижение';
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
    resetDamage();
    
    // Восстановление оторванных деталей
    restoreDetachedParts();
    
    // Сброс статистики
    resetStats();
    
    // Эффект
    showMessage('Машина восстановлена!');
    createRespawnEffect();
}

function resetDamage() {
    // Сброс индикаторов повреждений
    const damageElements = [
        'damageFront', 'damageRear', 'damageLeft', 'damageRight',
        'damageFrontValue', 'damageRearValue', 'damageLeftValue', 'damageRightValue'
    ];
    
    damageElements.forEach(id => {
        const element = UI[id];
        if (id.includes('Value')) {
            element.textContent = '0%';
        } else {
            element.style.width = '0%';
        }
    });
    
    UI.totalDamage.textContent = '0%';
}

function restoreDetachedParts() {
    carParts.forEach(part => {
        if (part.detached) {
            // Удаляем физическое тело
            if (part.physicsBody) {
                world.removeBody(part.physicsBody);
                part.physicsBody = null;
            }
            
            // Удаляем из сцены
            scene.remove(part.mesh);
            
            // Возвращаем в исходное состояние
            part.detached = false;
            part.damage = 0;
            part.mesh.scale.copy(part.originalScale);
            part.mesh.position.copy(part.originalPosition);
            part.mesh.rotation.copy(part.originalRotation);
            
            // Возвращаем в группу машины
            carGroup.add(part.mesh);
        } else {
            // Сбрасываем деформацию
            part.damage = 0;
            part.mesh.scale.copy(part.originalScale);
            part.mesh.position.copy(part.originalPosition);
            part.mesh.rotation.copy(part.originalRotation);
            
            // Восстанавливаем цвет
            if (part.mesh.material && part.mesh.material.color) {
                part.mesh.material.color.set(0x2980b9);
            }
        }
    });
    
    // Сброс счетчика оторванных деталей
    gameState.detachedParts = 0;
    UI.detachedParts.textContent = '0';
}

function resetStats() {
    // Сброс счетчика столкновений
    gameState.collisions = 0;
    UI.collisionCount.textContent = '0';
    UI.maxImpact.textContent = '0 Н';
}

function createRespawnEffect() {
    // Эффект появления
    const respawnGeometry = new THREE.SphereGeometry(5, 16, 16);
    const respawnMaterial = new THREE.MeshBasicMaterial({
        color: 0x3498db,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    
    const respawnEffect = new THREE.Mesh(respawnGeometry, respawnMaterial);
    respawnEffect.position.copy(carPhysicsBody.position);
    
    scene.add(respawnEffect);
    
    // Анимация исчезновения
    let opacity = 0.5;
    const fadeOut = () => {
        opacity -= 0.02;
        respawnEffect.material.opacity = opacity;
        
        if (opacity > 0) {
            requestAnimationFrame(fadeOut);
        } else {
            scene.remove(respawnEffect);
        }
    };
    
    fadeOut();
}

function toggleEffects() {
    bloomEnabled = !bloomEnabled;
    UI.bloomToggle.checked = bloomEnabled;
    showMessage(`Эффекты: ${bloomEnabled ? 'ВКЛ' : 'ВЫКЛ'}`);
}

// =================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===================
function showNotification(title, message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <h3>${title}</h3>
        <p>${message}</p>
    `;
    
    document.body.appendChild(notification);
    
    // Автоудаление
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

function showMessage(text) {
    const message = document.createElement('div');
    message.className = 'message';
    message.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <span>${text}</span>
        <button class="close-btn">&times;</button>
    `;
    
    const messagesContainer = document.getElementById('systemMessages');
    messagesContainer.appendChild(message);
    
    // Кнопка закрытия
    message.querySelector('.close-btn').addEventListener('click', () => {
        message.style.opacity = '0';
        setTimeout(() => message.remove(), 500);
    });
    
    // Автоудаление
    setTimeout(() => {
        if (message.parentElement) {
            message.style.opacity = '0';
            setTimeout(() => message.remove(), 500);
        }
    }, 5000);
}

function showError(title, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'notification';
    errorDiv.style.backgroundColor = 'rgba(231, 76, 60, 0.9)';
    errorDiv.innerHTML = `
        <h3>${title}</h3>
        <p>${message}</p>
        <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 16px; background: white; color: #e74c3c; border: none; border-radius: 5px; cursor: pointer;">
            Перезагрузить
        </button>
    `;
    
    document.body.appendChild(errorDiv);
}

// =================== ИГРОВОЙ ЦИКЛ ===================
let lastTime = 0;
let frameCount = 0;
let fps = 60;

function animate(currentTime = 0) {
    requestAnimationFrame(animate);
    
    // Расчет deltaTime
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;
    
    // Расчет FPS
    frameCount++;
    if (currentTime > lastTime + 1000) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        frameCount = 0;
        lastTime = currentTime;
    }
    
    UI.fpsCounter.textContent = fps;
    
    // Обновление таймера игры
    updateGameTimer(deltaTime);
    
    // Обновление физики
    updatePhysics(deltaTime);
    
    // Обновление частиц
    updateParticles(deltaTime);
    
    // Обновление анимаций
    updateAnimations(deltaTime);
    
    // Рендеринг
    if (bloomEnabled && composer) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

function updateAnimations(deltaTime) {
    // Анимация облаков
    scene.children.forEach(child => {
        if (child.material && child.material.opacity === 0.6) {
            // Это облако
            child.position.x += 0.1 * deltaTime;
            if (child.position.x > 250) {
                child.position.x = -250;
            }
        }
    });
    
    // Анимация освещения (закат/рассвет)
    const timeOfDay = (gameState.time % 120) / 120; // 2-минутный цикл
    
    if (lights[1] && lights[1].isDirectionalLight) {
        const sunHeight = Math.sin(timeOfDay * Math.PI) * 100 + 100;
        lights[1].position.y = sunHeight;
        
        // Изменение цвета солнца
        const sunColor = new THREE.Color();
        if (timeOfDay < 0.25 || timeOfDay > 0.75) {
            // Ночь/утро/вечер
            sunColor.setHSL(0.05, 0.5, 0.5);
        } else {
            // День
            sunColor.setHSL(0.1, 0.2, 0.9);
        }
        lights[1].color.copy(sunColor);
    }
}

// =================== ЗАПУСК ИГРЫ ===================
// Запускаем игру после полной загрузки страницы
window.addEventListener('load', () => {
    console.log('🚀 Запуск игры...');
    
    // Предотвращаем прокрутку страницы
    document.body.style.overflow = 'hidden';
    
    // Инициализация игры
    initGame().catch(error => {
        console.error('Критическая ошибка:', error);
        showError('Критическая ошибка', 'Игра не может быть запущена. Пожалуйста, обновите страницу.');
    });
    
    // Скрываем загрузочный экран через 3 секунды максимум
    setTimeout(() => {
        const loading = document.getElementById('loading');
        if (loading.style.display !== 'none') {
            loading.style.opacity = '0';
            setTimeout(() => {
                loading.style.display = 'none';
                showNotification('ИГРА ЗАГРУЖЕНА', 'Управление: W/A/S/D');
            }, 500);
        }
    }, 3000);
});

// Глобальные функции для отладки
window.debug = {
    getCarPosition: () => carPhysicsBody ? carPhysicsBody.position : null,
    getCarSpeed: () => carPhysicsBody ? carPhysicsBody.velocity.length() * 3.6 : 0,
    getCarDamage: () => gameState.totalDamage,
    resetGame: () => {
        resetCar();
        showNotification('ОТЛАДКА', 'Игра сброшена');
    },
    setSlowMotion: (enabled) => {
        slowMotion = enabled;
        UI.slowmoToggle.checked = enabled;
    },
    spawnObstacle: (x, y, z) => {
        // Функция для спавна препятствия в указанных координатах
        console.log(`Спавн препятствия в (${x}, ${y}, ${z})`);
    }
};

console.log('✨ Игра инициализирована. Удачи!');
