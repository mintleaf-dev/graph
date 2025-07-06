// --- Сервер для push-уведомлений и синхронизации ---
const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(bodyParser.json());

// === ВСТАВЬТЕ СЮДА СВОИ VAPID КЛЮЧИ ===
const VAPID_PUBLIC_KEY = 'BIQ5PVV-TXsTlnXI1IthlAALnsmXyQSnqJ6BHa3vzvmSmdZNOHzeN4r-QqfVOex06OfRlk3VVcIuGZN8sGv8IdQ';
const VAPID_PRIVATE_KEY = 'CzqYh9qOI-ejv5U20_M-p_JRT8hZ8OH-H_mfHHc8fLE';

webpush.setVapidDetails(
  'mailto:your@email.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const SUBSCRIPTIONS_FILE = 'subscriptions.json';
const SCHEDULE_FILE = 'schedule.json';

function loadSubscriptions() {
    if (!fs.existsSync(SUBSCRIPTIONS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE));
}
function saveSubscriptions(subs) {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2));
}
function loadSchedule() {
    if (!fs.existsSync(SCHEDULE_FILE)) return {};
    return JSON.parse(fs.readFileSync(SCHEDULE_FILE));
}
function saveSchedule(data) {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2));
}

// Endpoint для приёма подписки
app.post('/subscribe', (req, res) => {
    const subs = loadSubscriptions();
    if (!subs.find(s => s.endpoint === req.body.endpoint)) {
        subs.push(req.body);
        saveSubscriptions(subs);
    }
    res.status(201).json({});
});

// Endpoint для получения/сохранения расписания (REST API)
app.get('/schedule', (req, res) => {
    res.json(loadSchedule());
});
app.post('/schedule', (req, res) => {
    saveSchedule(req.body);
    io.emit('schedule-update', req.body); // синхронизация
    res.json({ ok: true });
});

// Endpoint для отправки уведомления всем подписчикам (тест)
app.post('/send', async (req, res) => {
    const subs = loadSubscriptions();
    const payload = JSON.stringify({
        title: req.body.title || 'Напоминание!',
        body: req.body.body || 'Время для следующего занятия!',
        requireInteraction: true,
    });
    let sent = 0;
    for (const sub of subs) {
        try {
            await webpush.sendNotification(sub, payload);
            sent++;
        } catch (err) {
            // Можно удалить невалидную подписку
        }
    }
    res.json({ sent });
});

// Для статики (отдавать index.html и т.д.)
app.use(express.static(__dirname));

// --- WebSocket для синхронизации ---
io.on('connection', (socket) => {
    // Отправить актуальное расписание при подключении
    socket.emit('schedule-update', loadSchedule());
    // При получении обновления от клиента — сохранить и разослать всем
    socket.on('schedule-update', (data) => {
        saveSchedule(data);
        socket.broadcast.emit('schedule-update', data);
    });
});

// --- Автоматическая отправка push по расписанию ---
setInterval(async () => {
    const schedule = loadSchedule();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const dayTypes = Object.keys(schedule);
    for (const dayType of dayTypes) {
        for (const row of schedule[dayType] || []) {
            if (!row.time) continue;
            const timeRange = row.time.split('-');
            const [h, m] = timeRange[0].split(':');
            if (h === undefined || m === undefined) continue;
            const rowMinutes = parseInt(h, 10) * 60 + parseInt(m, 10);
            if (rowMinutes === currentMinutes) {
                // Отправить push всем подписчикам
                const subs = loadSubscriptions();
                const payload = JSON.stringify({
                    title: 'Напоминание',
                    body: row.activity || 'Время для следующего занятия!',
                    requireInteraction: true,
                });
                for (const sub of subs) {
                    try {
                        await webpush.sendNotification(sub, payload);
                    } catch (err) {}
                }
            }
        }
    }
}, 60000); // каждую минуту

const PORT = 3000;
server.listen(PORT, () => console.log('Server started on port ' + PORT));
