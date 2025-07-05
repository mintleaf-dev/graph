// --- Сервер для push-уведомлений ---
const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
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

function loadSubscriptions() {
    if (!fs.existsSync(SUBSCRIPTIONS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE));
}
function saveSubscriptions(subs) {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2));
}

// Endpoint для приёма подписки
app.post('/subscribe', (req, res) => {
    const subs = loadSubscriptions();
    // Не добавлять дубликаты
    if (!subs.find(s => s.endpoint === req.body.endpoint)) {
        subs.push(req.body);
        saveSubscriptions(subs);
    }
    res.status(201).json({});
});

// Endpoint для отправки уведомления всем подписчикам (тест)
app.post('/send', async (req, res) => {
    const subs = loadSubscriptions();
    const payload = JSON.stringify({
        title: req.body.title || 'Напоминание!',
        body: req.body.body || 'Время для следующего занятия!',
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

const PORT = 3000;
app.listen(PORT, () => console.log('Server started on port ' + PORT));
