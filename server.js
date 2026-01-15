const http = require('http');
const fs = require('fs');
const path = require('path');

// Файл с данными
const DATA_FILE = path.join(__dirname, 'data.json');

// Загружаем данные из файла
let siteData = {
  users: [],
  posts: [],
  lastUpdated: new Date().toISOString()
};

// Если файл существует, загружаем данные
if (fs.existsSync(DATA_FILE)) {
  const fileData = fs.readFileSync(DATA_FILE, 'utf8');
  siteData = JSON.parse(fileData);
} else {
  // Если файла нет, создаем его
  fs.writeFileSync(DATA_FILE, JSON.stringify(siteData, null, 2));
}

// Все подключенные клиенты
const clients = [];

// Создаем сервер
const server = http.createServer((request, response) => {
  // Разрешаем доступ с любых сайтов
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Для запросов OPTIONS (предварительных)
  if (request.method === 'OPTIONS') {
    response.writeHead(200);
    response.end();
    return;
  }
  
  // Разбираем URL
  const urlParts = request.url.split('?');
  const path = urlParts[0];
  
  // Обрабатываем разные пути
  if (request.method === 'GET' && path === '/api/data') {
    // Получить все данные
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      success: true,
      data: siteData,
      timestamp: new Date().toISOString()
    }));
    
  } else if (request.method === 'POST' && path === '/api/data') {
    // Добавить новые данные
    let body = '';
    
    request.on('data', chunk => {
      body += chunk.toString();
    });
    
    request.on('end', () => {
      try {
        const newData = JSON.parse(body);
        const collection = newData.collection || 'posts';
        
        if (!siteData[collection]) {
          siteData[collection] = [];
        }
        
        // Добавляем новую запись
        const newItem = {
          ...newData.data,
          id: Date.now().toString(),
          created: new Date().toISOString()
        };
        
        siteData[collection].push(newItem);
        siteData.lastUpdated = new Date().toISOString();
        
        // Сохраняем в файл
        fs.writeFileSync(DATA_FILE, JSON.stringify(siteData, null, 2));
        
        // Отправляем обновление всем клиентам
        sendToAllClients({
          type: 'update',
          collection: collection,
          data: newItem
        });
        
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          success: true,
          message: 'Данные сохранены',
          id: newItem.id
        }));
        
      } catch (error) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          success: false,
          error: 'Ошибка в данных'
        }));
      }
    });
    
  } else if (request.method === 'GET' && path.startsWith('/api/data/')) {
    // Получить данные по ID
    const id = path.replace('/api/data/', '');
    let found = null;
    
    // Ищем во всех коллекциях
    for (const collection in siteData) {
      if (Array.isArray(siteData[collection])) {
        found = siteData[collection].find(item => item.id === id);
        if (found) break;
      }
    }
    
    if (found) {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        success: true,
        data: found
      }));
    } else {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        success: false,
        error: 'Не найдено'
      }));
    }
    
  } else if (request.method === 'GET' && path === '/api/updates') {
    // Подключение к реальному времени (SSE - Server-Sent Events)
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    // Добавляем клиента в список
    clients.push(response);
    
    // Отправляем текущие данные
    response.write(`data: ${JSON.stringify({
      type: 'init',
      data: siteData
    })}\n\n`);
    
    // Удаляем клиента при отключении
    request.on('close', () => {
      const index = clients.indexOf(response);
      if (index !== -1) {
        clients.splice(index, 1);
      }
    });
    
  } else {
    // Для всех остальных запросов - 404
    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      success: false,
      error: 'Не найдено'
    }));
  }
});

// Функция отправки данных всем клиентам
function sendToAllClients(message) {
  const data = `data: ${JSON.stringify(message)}\n\n`;
  
  clients.forEach(client => {
    try {
      client.write(data);
    } catch (error) {
      // Если ошибка, удаляем клиента
      const index = clients.indexOf(client);
      if (index !== -1) {
        clients.splice(index, 1);
      }
    }
  });
}

// Запускаем сервер
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api/data`);
  console.log(`🔔 Реальное время: http://localhost:${PORT}/api/updates`);
  console.log(`💾 Данные хранятся в: ${DATA_FILE}`);
});
