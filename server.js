// Простой автономный сервер для хранения данных
const http = require('http');
const fs = require('fs');
const path = require('path');

// Файл для хранения данных
const DATA_FILE = 'site_data.json';
let siteData = {};

// Загружаем сохраненные данные
if (fs.existsSync(DATA_FILE)) {
  const savedData = fs.readFileSync(DATA_FILE, 'utf8');
  if (savedData.trim()) {
    siteData = JSON.parse(savedData);
  }
}

// Функция сохранения данных
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(siteData, null, 2));
}

// Создаем сервер
const server = http.createServer((req, res) => {
  // Разрешаем запросы с любого сайта
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Обрабатываем OPTIONS запросы для CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Получаем путь запроса
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  
  // Обрабатываем POST запрос для сохранения данных
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const category = url.searchParams.get('category') || 'default';
        
        // Если категории нет, создаем ее
        if (!siteData[category]) {
          siteData[category] = [];
        }
        
        // Добавляем временную метку
        data._timestamp = new Date().toISOString();
        data._id = Date.now() + Math.random().toString(36).substr(2, 9);
        
        // Сохраняем данные
        siteData[category].push(data);
        saveData();
        
        // Отправляем ответ
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Данные сохранены',
          id: data._id 
        }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Неверный формат данных' 
        }));
      }
    });
    
    return;
  }
  
  // Обрабатываем GET запрос для получения данных
  if (req.method === 'GET' && path === '/data') {
    const category = url.searchParams.get('category');
    
    if (category && siteData[category]) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(siteData[category]));
    } else if (!category) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(siteData));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Категория не найдена' }));
    }
    return;
  }
  
  // Запрос на очистку данных (только для тестирования)
  if (req.method === 'DELETE' && path === '/clear') {
    const category = url.searchParams.get('category');
    
    if (category && siteData[category]) {
      siteData[category] = [];
      saveData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Данные очищены' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Категория не найдена' }));
    }
    return;
  }
  
  // Простая HTML страница для тестирования
  if (req.method === 'GET' && path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Сервер данных</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          input, textarea, button { 
            display: block; 
            margin: 10px 0; 
            padding: 10px; 
            width: 300px; 
          }
          .result { 
            background: #f0f0f0; 
            padding: 10px; 
            margin: 10px 0; 
          }
        </style>
      </head>
      <body>
        <h1>Сервер для хранения данных</h1>
        
        <h3>1. Сохранить данные</h3>
        <input type="text" id="category" placeholder="Категория (например: users)" value="users">
        <textarea id="data" placeholder='{"name": "Иван", "age": 25}'>{"name": "Иван", "age": 25}</textarea>
        <button onclick="saveData()">Сохранить данные</button>
        
        <h3>2. Получить данные</h3>
        <input type="text" id="getCategory" placeholder="Категория (оставьте пустым для всех)">
        <button onclick="getData()">Получить данные</button>
        
        <div id="result" class="result"></div>
        
        <script>
          const serverUrl = 'http://${req.headers.host}';
          
          async function saveData() {
            const category = document.getElementById('category').value;
            const data = document.getElementById('data').value;
            
            try {
              const response = await fetch(\`\${serverUrl}/?category=\${category}\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: data
              });
              
              const result = await response.json();
              document.getElementById('result').innerHTML = 
                \`<strong>✓ Данные сохранены:</strong><br>\${JSON.stringify(result, null, 2)}\`;
            } catch (error) {
              document.getElementById('result').innerHTML = 
                \`<strong>✗ Ошибка:</strong> \${error}\`;
            }
          }
          
          async function getData() {
            const category = document.getElementById('getCategory').value;
            const url = category ? \`\${serverUrl}/data?category=\${category}\` : \`\${serverUrl}/data\`;
            
            try {
              const response = await fetch(url);
              const data = await response.json();
              document.getElementById('result').innerHTML = 
                \`<strong>Данные:</strong><br>\${JSON.stringify(data, null, 2)}\`;
            } catch (error) {
              document.getElementById('result').innerHTML = 
                \`<strong>✗ Ошибка:</strong> \${error}\`;
            }
          }
        </script>
      </body>
      </html>
    `);
    return;
  }
  
  // Обработка остальных запросов
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Страница не найдена');
});

// Запускаем сервер
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`📁 Данные сохраняются в файле: ${DATA_FILE}`);
  console.log(`🌐 Откройте в браузере: http://localhost:${PORT}`);
  console.log(`📤 Для отправки данных с сайта используйте POST запросы`);
});
