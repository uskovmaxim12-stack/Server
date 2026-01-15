// Полностью независимый сервер на чистом Node.js
// Не требует установки npm пакетов!

const http = require('http');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { StringDecoder } = require('string_decoder');
const crypto = require('crypto');

class RealTimeServer {
    constructor(config = {}) {
        this.config = {
            port: config.port || 3000,
            host: config.host || '0.0.0.0',
            dataFile: config.dataFile || 'site_data.json',
            ssl: config.ssl || false,
            sslKey: config.sslKey || null,
            sslCert: config.sslCert || null,
            ...config
        };
        
        this.data = {
            users: [],
            content: {},
            config: {},
            cache: {},
            version: '1.0.0',
            lastUpdate: new Date().toISOString()
        };
        
        this.clients = new Set();
        this.sessions = new Map();
        
        this.routes = {
            GET: {},
            POST: {},
            PUT: {},
            DELETE: {},
            OPTIONS: {}
        };
        
        this.setupRoutes();
    }
    
    // Инициализация маршрутов
    setupRoutes() {
        // Главная страница
        this.routes.GET['/'] = this.handleIndex.bind(this);
        this.routes.GET['/status'] = this.handleStatus.bind(this);
        
        // API для данных
        this.routes.GET['/api/data'] = this.getAllData.bind(this);
        this.routes.GET['/api/data/:key'] = this.getData.bind(this);
        this.routes.POST['/api/data'] = this.setData.bind(this);
        this.routes.PUT['/api/data/:key'] = this.updateData.bind(this);
        this.routes.DELETE['/api/data/:key'] = this.deleteData.bind(this);
        
        // WebSocket подключение
        this.routes.GET['/ws'] = this.handleWebSocket.bind(this);
        
        // Статические файлы (CSS, JS для клиента)
        this.routes.GET['/client.js'] = this.serveClientJS.bind(this);
        this.routes.GET['/style.css'] = this.serveStyleCSS.bind(this);
        this.routes.GET['/test.html'] = this.serveTestHTML.bind(this);
    }
    
    // Запуск сервера
    async start() {
        try {
            await this.loadData();
            
            const server = this.config.ssl ? https.createServer({
                key: this.config.sslKey ? await fs.readFile(this.config.sslKey) : '',
                cert: this.config.sslCert ? await fs.readFile(this.config.sslCert) : ''
            }, this.handleRequest.bind(this)) : 
            http.createServer(this.handleRequest.bind(this));
            
            server.listen(this.config.port, this.config.host, () => {
                console.log(`🚀 Сервер запущен на ${this.config.ssl ? 'https' : 'http'}://${this.config.host === '0.0.0.0' ? 'localhost' : this.config.host}:${this.config.port}`);
                console.log(`📁 Данные хранятся в: ${this.config.dataFile}`);
                console.log(`🔌 WebSocket: ws${this.config.ssl ? 's' : ''}://${this.config.host === '0.0.0.0' ? 'localhost' : this.config.host}:${this.config.port}/ws`);
                console.log(`📡 API доступен по: ${this.config.ssl ? 'https' : 'http'}://${this.config.host === '0.0.0.0' ? 'localhost' : this.config.host}:${this.config.port}/api/data`);
                console.log(`🧪 Тестовая страница: ${this.config.ssl ? 'https' : 'http'}://${this.config.host === '0.0.0.0' ? 'localhost' : this.config.host}:${this.config.port}/test.html`);
            });
            
            server.on('upgrade', (request, socket, head) => {
                if (request.url === '/ws') {
                    this.handleWebSocketUpgrade(request, socket, head);
                } else {
                    socket.destroy();
                }
            });
            
        } catch (error) {
            console.error('❌ Ошибка запуска сервера:', error);
        }
    }
    
    // Обработчик HTTP запросов
    async handleRequest(req, res) {
        const decoder = new StringDecoder('utf-8');
        let buffer = '';
        
        req.on('data', (data) => {
            buffer += decoder.write(data);
        });
        
        req.on('end', async () => {
            buffer += decoder.end();
            
            try {
                const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
                const pathname = parsedUrl.pathname;
                const query = Object.fromEntries(parsedUrl.searchParams);
                
                // Настройка CORS
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                res.setHeader('Access-Control-Max-Age', 86400);
                
                // Обработка preflight запросов
                if (req.method === 'OPTIONS') {
                    res.writeHead(200);
                    res.end();
                    return;
                }
                
                // Поиск обработчика маршрута
                const route = this.findRoute(req.method, pathname);
                
                if (route) {
                    const params = route.params || {};
                    const body = buffer ? this.safeParseJSON(buffer) : {};
                    
                    const request = {
                        method: req.method,
                        url: pathname,
                        query,
                        params,
                        body,
                        headers: req.headers,
                        ip: req.socket.remoteAddress
                    };
                    
                    const response = {
                        json: (data, status = 200) => {
                            res.writeHead(status, {
                                'Content-Type': 'application/json',
                                'Cache-Control': 'no-cache, no-store, must-revalidate'
                            });
                            res.end(JSON.stringify(data, null, 2));
                        },
                        send: (data, status = 200, contentType = 'text/html') => {
                            res.writeHead(status, {
                                'Content-Type': contentType,
                                'Cache-Control': 'no-cache, no-store, must-revalidate'
                            });
                            res.end(data);
                        },
                        error: (message, status = 500) => {
                            res.writeHead(status, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: true, message }));
                        }
                    };
                    
                    try {
                        await route.handler(request, response);
                    } catch (error) {
                        console.error('Ошибка обработчика:', error);
                        response.error('Внутренняя ошибка сервера', 500);
                    }
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: true, message: 'Маршрут не найден' }));
                }
                
            } catch (error) {
                console.error('Ошибка обработки запроса:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: true, message: 'Ошибка сервера' }));
            }
        });
    }
    
    // Поиск маршрута с параметрами
    findRoute(method, pathname) {
        const methodRoutes = this.routes[method];
        if (!methodRoutes) return null;
        
        // Прямое совпадение
        if (methodRoutes[pathname]) {
            return { handler: methodRoutes[pathname] };
        }
        
        // Поиск с параметрами
        for (const [route, handler] of Object.entries(methodRoutes)) {
            if (route.includes(':')) {
                const routeParts = route.split('/');
                const pathParts = pathname.split('/');
                
                if (routeParts.length !== pathParts.length) continue;
                
                const params = {};
                let match = true;
                
                for (let i = 0; i < routeParts.length; i++) {
                    if (routeParts[i].startsWith(':')) {
                        const paramName = routeParts[i].substring(1);
                        params[paramName] = pathParts[i];
                    } else if (routeParts[i] !== pathParts[i]) {
                        match = false;
                        break;
                    }
                }
                
                if (match) {
                    return { handler, params };
                }
            }
        }
        
        return null;
    }
    
    // Безопасный парсинг JSON
    safeParseJSON(str) {
        try {
            return JSON.parse(str);
        } catch {
            return {};
        }
    }
    
    // Загрузка данных из файла
    async loadData() {
        try {
            const data = await fs.readFile(this.config.dataFile, 'utf8');
            this.data = JSON.parse(data);
            console.log('✅ Данные загружены из файла');
        } catch (error) {
            console.log('📝 Создание нового файла данных...');
            await this.saveData();
        }
    }
    
    // Сохранение данных в файл
    async saveData() {
        try {
            this.data.lastUpdate = new Date().toISOString();
            await fs.writeFile(
                this.config.dataFile, 
                JSON.stringify(this.data, null, 2),
                'utf8'
            );
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения данных:', error);
            return false;
        }
    }
    
    // Рассылка обновлений всем клиентам
    broadcast(type, data) {
        const message = JSON.stringify({
            type,
            data,
            timestamp: Date.now()
        });
        
        for (const client of this.clients) {
            if (client.readyState === 1) { // OPEN
                client.send(message);
            }
        }
    }
    
    // ============ ОБРАБОТЧИКИ МАРШРУТОВ ============
    
    async handleIndex(req, res) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>RealTime Server</title>
                <link rel="stylesheet" href="/style.css">
            </head>
            <body>
                <div class="container">
                    <h1>✅ Сервер работает!</h1>
                    <p>Время: ${new Date().toLocaleString()}</p>
                    <p>Клиентов подключено: ${this.clients.size}</p>
                    <p>Всего записей: ${Object.keys(this.data).reduce((acc, key) => 
                        Array.isArray(this.data[key]) ? acc + this.data[key].length : acc, 0)}</p>
                    <a href="/test.html" class="btn">Тестовая страница</a>
                </div>
            </body>
            </html>
        `);
    }
    
    async handleStatus(req, res) {
        res.json({
            status: 'online',
            version: this.data.version,
            clients: this.clients.size,
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            dataSize: JSON.stringify(this.data).length,
            lastUpdate: this.data.lastUpdate
        });
    }
    
    async getAllData(req, res) {
        res.json({
            success: true,
            data: this.data,
            timestamp: Date.now()
        });
    }
    
    async getData(req, res) {
        const { key } = req.params;
        const { field } = req.query;
        
        if (this.data[key] !== undefined) {
            if (field && this.data[key][field] !== undefined) {
                res.json({
                    success: true,
                    data: this.data[key][field],
                    timestamp: Date.now()
                });
            } else {
                res.json({
                    success: true,
                    data: this.data[key],
                    timestamp: Date.now()
                });
            }
        } else {
            res.error('Ключ не найден', 404);
        }
    }
    
    async setData(req, res) {
        const { key, value } = req.body;
        
        if (!key) {
            return res.error('Ключ обязателен', 400);
        }
        
        this.data[key] = value || req.body;
        const saved = await this.saveData();
        
        if (saved) {
            // Рассылаем обновление
            this.broadcast('DATA_UPDATED', {
                key,
                value: this.data[key],
                operation: 'set'
            });
            
            res.json({
                success: true,
                message: 'Данные сохранены',
                key,
                timestamp: Date.now()
            });
        } else {
            res.error('Ошибка сохранения', 500);
        }
    }
    
    async updateData(req, res) {
        const { key } = req.params;
        const updates = req.body;
        
        if (this.data[key] === undefined) {
            return res.error('Ключ не найден', 404);
        }
        
        if (typeof this.data[key] === 'object' && !Array.isArray(this.data[key])) {
            this.data[key] = { ...this.data[key], ...updates };
        } else if (Array.isArray(this.data[key])) {
            const { id, ...itemUpdates } = updates;
            if (id) {
                const index = this.data[key].findIndex(item => item.id === id);
                if (index !== -1) {
                    this.data[key][index] = { ...this.data[key][index], ...itemUpdates };
                }
            } else {
                this.data[key].push(updates);
            }
        } else {
            this.data[key] = updates;
        }
        
        const saved = await this.saveData();
        
        if (saved) {
            this.broadcast('DATA_UPDATED', {
                key,
                value: this.data[key],
                operation: 'update'
            });
            
            res.json({
                success: true,
                message: 'Данные обновлены',
                key,
                timestamp: Date.now()
            });
        } else {
            res.error('Ошибка сохранения', 500);
        }
    }
    
    async deleteData(req, res) {
        const { key } = req.params;
        const { field, id } = req.query;
        
        if (this.data[key] === undefined) {
            return res.error('Ключ не найден', 404);
        }
        
        if (field && this.data[key][field] !== undefined) {
            delete this.data[key][field];
        } else if (id && Array.isArray(this.data[key])) {
            this.data[key] = this.data[key].filter(item => item.id !== id);
        } else {
            delete this.data[key];
        }
        
        const saved = await this.saveData();
        
        if (saved) {
            this.broadcast('DATA_UPDATED', {
                key,
                operation: 'delete'
            });
            
            res.json({
                success: true,
                message: 'Данные удалены',
                key,
                timestamp: Date.now()
            });
        } else {
            res.error('Ошибка сохранения', 500);
        }
    }
    
    async serveClientJS(req, res) {
        const js = `
            class RealtimeClient {
                constructor(url = '') {
                    this.url = url || \`ws://\${window.location.host}/ws\`;
                    this.socket = null;
                    this.listeners = {};
                    this.reconnectAttempts = 0;
                    this.maxReconnectAttempts = 10;
                }
                
                connect() {
                    this.socket = new WebSocket(this.url);
                    
                    this.socket.onopen = () => {
                        console.log('🔌 WebSocket подключен');
                        this.reconnectAttempts = 0;
                        this.emit('connect');
                    };
                    
                    this.socket.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data);
                            this.emit('message', data);
                            if (data.type) {
                                this.emit(data.type, data.data);
                            }
                        } catch (error) {
                            console.error('Ошибка парсинга сообщения:', error);
                        }
                    };
                    
                    this.socket.onclose = () => {
                        console.log('🔌 WebSocket отключен');
                        this.emit('disconnect');
                        this.reconnect();
                    };
                    
                    this.socket.onerror = (error) => {
                        console.error('WebSocket ошибка:', error);
                        this.emit('error', error);
                    };
                }
                
                reconnect() {
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                        console.log(\`Попытка переподключения \${this.reconnectAttempts} через \${delay}ms\`);
                        
                        setTimeout(() => {
                            if (this.socket.readyState !== WebSocket.OPEN) {
                                this.connect();
                            }
                        }, delay);
                    }
                }
                
                on(event, callback) {
                    if (!this.listeners[event]) {
                        this.listeners[event] = [];
                    }
                    this.listeners[event].push(callback);
                }
                
                emit(event, data) {
                    if (this.listeners[event]) {
                        this.listeners[event].forEach(callback => callback(data));
                    }
                }
                
                send(type, data) {
                    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                        this.socket.send(JSON.stringify({ type, data }));
                        return true;
                    }
                    return false;
                }
                
                disconnect() {
                    if (this.socket) {
                        this.socket.close();
                    }
                }
                
                // API методы
                async getData(key = '') {
                    const url = key ? \`/api/data/\${key}\` : '/api/data';
                    const response = await fetch(url);
                    return await response.json();
                }
                
                async setData(key, value) {
                    const response = await fetch('/api/data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key, value })
                    });
                    return await response.json();
                }
                
                async updateData(key, updates) {
                    const response = await fetch(\`/api/data/\${key}\`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updates)
                    });
                    return await response.json();
                }
                
                async deleteData(key) {
                    const response = await fetch(\`/api/data/\${key}\`, {
                        method: 'DELETE'
                    });
                    return await response.json();
                }
            }
            
            // Глобальный экспорт
            window.RealtimeClient = RealtimeClient;
            window.realtime = new RealtimeClient();
            window.realtime.connect();
        `;
        
        res.send(js, 200, 'application/javascript');
    }
    
    async serveStyleCSS(req, res) {
        const css = `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 30px;
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            
            h1 {
                color: #333;
                margin-bottom: 20px;
                font-size: 2.5em;
            }
            
            .btn {
                display: inline-block;
                padding: 12px 24px;
                background: #667eea;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
                margin: 10px 5px;
                transition: all 0.3s ease;
            }
            
            .btn:hover {
                background: #5a67d8;
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            }
            
            .data-panel {
                margin-top: 30px;
                padding: 20px;
                background: #f7fafc;
                border-radius: 10px;
                border: 1px solid #e2e8f0;
            }
            
            .status {
                padding: 10px;
                border-radius: 5px;
                margin: 10px 0;
                font-weight: bold;
            }
            
            .online { background: #c6f6d5; color: #22543d; }
            .offline { background: #fed7d7; color: #742a2a; }
            
            .client-list {
                display: grid;
                gap: 10px;
                margin-top: 20px;
            }
            
            .client-item {
                padding: 15px;
                background: white;
                border: 2px solid #e2e8f0;
                border-radius: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
        `;
        
        res.send(css, 200, 'text/css');
    }
    
    async serveTestHTML(req, res) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Тест RealTime Server</title>
                <link rel="stylesheet" href="/style.css">
                <script src="/client.js" defer></script>
            </head>
            <body>
                <div class="container">
                    <h1>🧪 Тестовая страница RealTime Server</h1>
                    
                    <div class="status" id="connectionStatus">
                        Статус подключения: <span id="statusText">Проверка...</span>
                    </div>
                    
                    <div class="btn-group">
                        <button class="btn" onclick="testGetData()">Получить данные</button>
                        <button class="btn" onclick="testSetData()">Записать данные</button>
                        <button class="btn" onclick="testRealtime()">Тест realtime</button>
                    </div>
                    
                    <div class="data-panel">
                        <h3>📊 Данные:</h3>
                        <pre id="dataOutput">Нажмите "Получить данные"</pre>
                    </div>
                    
                    <div class="data-panel">
                        <h3>🔄 RealTime события:</h3>
                        <div id="eventsOutput" style="max-height: 300px; overflow-y: auto;"></div>
                    </div>
                    
                    <script>
                        // Глобальные переменные
                        let eventCount = 0;
                        
                        // Подписка на события
                        realtime.on('connect', () => {
                            updateStatus('online', '✅ Подключено');
                            addEvent('🔌 WebSocket подключен');
                        });
                        
                        realtime.on('disconnect', () => {
                            updateStatus('offline', '❌ Отключено');
                            addEvent('🔌 WebSocket отключен');
                        });
                        
                        realtime.on('DATA_UPDATED', (data) => {
                            addEvent(\`🔄 Данные обновлены: \${data.key} (\${data.operation})\`);
                            testGetData(); // Автоматически обновляем данные
                        });
                        
                        // Функции тестирования
                        async function testGetData() {
                            try {
                                const result = await realtime.getData();
                                document.getElementById('dataOutput').textContent = 
                                    JSON.stringify(result.data, null, 2);
                                addEvent('📥 Данные получены');
                            } catch (error) {
                                addEvent(\`❌ Ошибка получения данных: \${error}\`);
                            }
                        }
                        
                        async function testSetData() {
                            const testData = {
                                timestamp: new Date().toISOString(),
                                message: 'Тест из браузера',
                                random: Math.random()
                            };
                            
                            try {
                                const result = await realtime.setData('test', testData);
                                addEvent(\`📝 Данные записаны: \${result.message}\`);
                            } catch (error) {
                                addEvent(\`❌ Ошибка записи: \${error}\`);
                            }
                        }
                        
                        function testRealtime() {
                            // Отправляем сообщение через WebSocket
                            realtime.send('TEST_EVENT', {
                                message: 'Тестовое событие',
                                count: ++eventCount
                            });
                            addEvent('🎯 Тестовое событие отправлено');
                        }
                        
                        // Вспомогательные функции
                        function updateStatus(status, text) {
                            const el = document.getElementById('connectionStatus');
                            el.className = 'status ' + status;
                            document.getElementById('statusText').textContent = text;
                        }
                        
                        function addEvent(text) {
                            const el = document.getElementById('eventsOutput');
                            const eventEl = document.createElement('div');
                            eventEl.className = 'client-item';
                            eventEl.textContent = \`[\${new Date().toLocaleTimeString()}] \${text}\`;
                            el.prepend(eventEl);
                            
                            // Ограничиваем количество событий
                            if (el.children.length > 10) {
                                el.removeChild(el.lastChild);
                            }
                        }
                        
                        // Автоматическое тестирование при загрузке
                        window.addEventListener('load', () => {
                            setTimeout(testGetData, 1000);
                            setInterval(() => {
                                if (realtime.socket.readyState === WebSocket.OPEN) {
                                    updateStatus('online', '✅ Подключено');
                                }
                            }, 5000);
                        });
                    </script>
                </div>
            </body>
            </html>
        `;
        
        res.send(html);
    }
    
    // Обработчик WebSocket (HTTP)
    handleWebSocket(req, res) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <body>
                <h1>WebSocket endpoint</h1>
                <p>Подключитесь через WebSocket клиент</p>
                <p>URL: ws://${req.headers.host}/ws</p>
            </body>
            </html>
        `);
    }
    
    // Обновление протокола для WebSocket
    handleWebSocketUpgrade(req, socket, head) {
        // Проверка WebSocket ключа
        const acceptKey = req.headers['sec-websocket-key'];
        if (!acceptKey) {
            socket.destroy();
            return;
        }
        
        // Генерация accept ключа
        const sha1 = crypto.createHash('sha1');
        sha1.update(acceptKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
        const accept = sha1.digest('base64');
        
        // Отправка заголовков обновления
        const headers = [
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${accept}`
        ];
        
        socket.write(headers.join('\r\n') + '\r\n\r\n');
        
        // Создание WebSocket клиента
        const client = {
            send: (data) => {
                if (socket.writable) {
                    // Простая реализация WebSocket фрейма
                    const buffer = Buffer.from(data);
                    const header = Buffer.alloc(2);
                    header[0] = 0x81; // FIN + текстовый фрейм
                    header[1] = buffer.length;
                    
                    socket.write(Buffer.concat([header, buffer]));
                }
            },
            readyState: 1, // OPEN
            ip: socket.remoteAddress
        };
        
        // Сохраняем сокет
        socket.client = client;
        this.clients.add(client);
        
        // Отправляем приветственное сообщение
        client.send(JSON.stringify({
            type: 'WELCOME',
            data: {
                message: 'Добро пожаловать на RealTime сервер',
                timestamp: Date.now(),
                clients: this.clients.size
            }
        }));
        
        // Обработка входящих сообщений
        socket.on('data', (data) => {
            try {
                // Простейший парсинг WebSocket фрейма
                // В реальном проекте нужно использовать библиотеку
                const payloadLength = data[1] & 127;
                const maskStart = 2;
                const dataStart = maskStart + 4;
                
                if (payloadLength > 0) {
                    const payload = Buffer.alloc(payloadLength);
                    
                    // Демаскировка данных
                    for (let i = 0; i < payloadLength; i++) {
                        payload[i] = data[dataStart + i] ^ data[maskStart + (i % 4)];
                    }
                    
                    const message = payload.toString('utf8');
                    const parsed = JSON.parse(message);
                    
                    // Обработка сообщений от клиента
                    this.handleClientMessage(client, parsed);
                }
            } catch (error) {
                console.error('Ошибка обработки WebSocket сообщения:', error);
            }
        });
        
        // Очистка при отключении
        socket.on('close', () => {
            this.clients.delete(client);
            console.log(`Клиент отключен: ${client.ip}`);
        });
        
        socket.on('error', (error) => {
            console.error('WebSocket ошибка:', error);
            this.clients.delete(client);
        });
        
        console.log(`Новый WebSocket клиент: ${client.ip}`);
    }
    
    // Обработка сообщений от клиента
    handleClientMessage(client, message) {
        const { type, data } = message;
        
        switch (type) {
            case 'PING':
                client.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
                break;
                
            case 'SUBSCRIBE':
                // Подписка на определенные события
                client.send(JSON.stringify({
                    type: 'SUBSCRIBED',
                    data: { channels: data.channels || [] }
                }));
                break;
                
            default:
                // Эхо-ответ для тестирования
                client.send(JSON.stringify({
                    type: 'ECHO',
                    data: message,
                    timestamp: Date.now()
                }));
        }
    }
}

// ============ ЗАПУСК СЕРВЕРА ============

// Создаем и запускаем сервер
const server = new RealTimeServer({
    port: process.env.PORT || 3000,
    host: '0.0.0.0',
    dataFile: 'site_data.json'
});

// Обработка сигналов завершения
process.on('SIGINT', () => {
    console.log('\n🛑 Остановка сервера...');
    // Сохраняем данные перед выходом
    server.saveData().then(() => {
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Получен сигнал завершения...');
    server.saveData().then(() => {
        process.exit(0);
    });
});

// Запуск сервера
server.start();

// Экспорт для тестирования
if (require.main === module) {
    // Это основной файл, запускаем сервер
} else {
    // Импортируется как модуль
    module.exports = RealTimeServer;
}
