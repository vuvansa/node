// --- START OF FILE botsunwin_with_token.js ---

const { Telegraf } = require('telegraf');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');

// --- Cấu hình Bot ---
// !!! TOKEN NÀY ĐÃ BỊ LỘ, BẠN PHẢI THU HỒI NÓ SAU KHI CHẠY THỬ !!!
const BOT_TOKEN = '7537898028:AAHZwSZpQgnG_WIj5h0nlbfpB79-IvPucXo';
const ADMIN_ID = 5524246727;
const API_URL = 'http://157.10.52.15:3000/api/sunwin?key=axotaixiu'; 
const API_INTERVAL = 3000;

// --- Cấu hình Proxy (Tùy chọn) ---
const PROXY_URL = '';

// --- Khởi tạo Bot ---
let bot;
if (PROXY_URL && PROXY_URL.startsWith('http')) {
    bot = new Telegraf(BOT_TOKEN, { telegram: { agent: new HttpsProxyAgent(PROXY_URL) } });
    console.log(`Bot khởi động với HTTP Proxy: ${PROXY_URL}`);
} else {
    bot = new Telegraf(BOT_TOKEN);
    console.log('Bot khởi động không dùng Proxy.');
}

// --- Tên file lưu trữ dữ liệu ---
const USERS_FILE = 'users.json';
const PREDICTION_HISTORY_FILE = 'prediction_history.json';

// --- Biến lưu trữ dữ liệu ---
let users = {};
let predictionHistory = [];
let lastDisplayedSession = null;

// --- Hàm đọc/ghi file ---
function loadData(filePath, defaultData) {
    if (existsSync(filePath)) {
        try {
            return JSON.parse(readFileSync(filePath, 'utf8'));
        } catch (e) {
            console.error(`Lỗi đọc file ${filePath}:`, e);
            return defaultData;
        }
    }
    return defaultData;
}

function saveData(filePath, data) {
    try {
        writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error(`Lỗi ghi file ${filePath}:`, e);
    }
}

// --- Tải dữ liệu khi khởi động ---
users = loadData(USERS_FILE, { [ADMIN_ID]: { active: true, isAdmin: true } });
predictionHistory = loadData(PREDICTION_HISTORY_FILE, []);

// --- Hàm kiểm tra quyền ---
const isAdmin = (userId) => users[userId] && users[userId].isAdmin;
const isMainAdmin = (userId) => userId === ADMIN_ID;

// --- Hàm định dạng dữ liệu ---
function formatPredictionData(data) {
    if (!data) return "Chưa có dữ liệu dự đoán.";
    const { PHIEN_TRUOC, KET_QUA, DICE, PHIEN_HIEN_TAI, DU_DOAN, CAU } = data;
    return `
🎰 *TOOl SUNWIN V1*
═════════════════════════════
*PHIÊN TRƯỚC*: \`${PHIEN_TRUOC || 'N/A'}\`
*KẾT QUẢ*: ${KET_QUA || 'N/A'}
*DICE*: ${DICE || 'N/A'}
═════════════════════════════ 
*PHIÊN HIỆN TẠI*: \`${PHIEN_HIEN_TAI || 'N/A'}\`
*DỰ ĐOÁN*: *${DU_DOAN || 'N/A'}*
*CẦU*: ${CAU || 'N/A'}
═════════════════════════════ 
`.trim();
}

// --- Hàm gọi API ---
async function fetchAndProcessApiData() {
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(API_URL);
        if (!response.ok) {
            console.error(`Lỗi API: HTTP status ${response.status}`);
            return;
        }
        const data = await response.json();

        if (data && data.PHIEN_HIEN_TAI && data.PHIEN_HIEN_TAI !== lastDisplayedSession) {
            console.log(`Phiên mới: ${data.PHIEN_HIEN_TAI}. Gửi thông báo...`);
            lastDisplayedSession = data.PHIEN_HIEN_TAI;

            predictionHistory.push({
                timestamp: new Date().toISOString(),
                session: data.PHIEN_HIEN_TAI,
                data: data
            });
            saveData(PREDICTION_HISTORY_FILE, predictionHistory);

            const formattedMessage = formatPredictionData(data);
            
            for (const userId in users) {
                if (users[userId].active) {
                    bot.telegram.sendMessage(userId, formattedMessage, { parse_mode: 'Markdown' }).catch(e => {
                        console.error(`Không thể gửi tin nhắn tới user ${userId}:`, e.message);
                        if (e.code === 403) {
                            users[userId].active = false;
                            saveData(USERS_FILE, users);
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu API:', error.message);
    }
}

// --- Các lệnh của Bot ---
bot.start((ctx) => {
    const userId = ctx.from.id;
    const userName = ctx.from.username || ctx.from.first_name;

    if (!users[userId]) {
        users[userId] = { active: true, isAdmin: false };
        saveData(USERS_FILE, users);
    } else {
        users[userId].active = true;
        saveData(USERS_FILE, users);
    }

    if (isAdmin(userId)) {
        ctx.reply(
            `Chào mừng Admin ${userName}! 👋` +
            '\n\n*Lệnh Admin:*\n/addadmin <id> | /xoaadmin <id> | /check | /thongbao <msg>' +
            '\n\n*Lệnh chung:*\n/chaybot | /tatbot'
        );
    } else {
        ctx.reply(
            `Chào mừng ${userName} đến với Bot Sunwin! 🎉` +
            '\n\nBot sẽ tự động gửi dự đoán cho bạn.' +
            '\nSử dụng /tatbot để dừng và /chaybot để bật lại.'
        );
    }
});

bot.command('chaybot', (ctx) => {
    const userId = ctx.from.id;
    if (!users[userId]) users[userId] = { active: true, isAdmin: false };
    users[userId].active = true;
    saveData(USERS_FILE, users);
    ctx.reply('✅ Đã bật nhận dự đoán.');
});

bot.command('tatbot', (ctx) => {
    const userId = ctx.from.id;
    if (users[userId]) users[userId].active = false;
    saveData(USERS_FILE, users);
    ctx.reply('❌ Đã tắt nhận dự đoán.');
});

bot.command('addadmin', (ctx) => {
    if (!isMainAdmin(ctx.from.id)) return;
    const targetUserId = parseInt(ctx.message.text.split(' ')[1], 10);
    if (!isNaN(targetUserId)) {
        if (!users[targetUserId]) users[targetUserId] = { active: true, isAdmin: false };
        users[targetUserId].isAdmin = true;
        saveData(USERS_FILE, users);
        ctx.reply(`✅ Đã cấp quyền admin cho ID \`${targetUserId}\`.`);
    }
});

bot.command('xoaadmin', (ctx) => {
    if (!isMainAdmin(ctx.from.id)) return;
    const targetUserId = parseInt(ctx.message.text.split(' ')[1], 10);
    if (!isNaN(targetUserId) && targetUserId !== ADMIN_ID) {
        if (users[targetUserId]) users[targetUserId].isAdmin = false;
        saveData(USERS_FILE, users);
        ctx.reply(`✅ Đã gỡ quyền admin của ID \`${targetUserId}\`.`);
    }
});

bot.command('check', (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const userIds = Object.keys(users);
    let userList = `--- *Danh sách Người dùng* (${userIds.length}) ---\n\n`;
    userIds.forEach(id => {
        const user = users[id];
        const status = user.active ? '✅' : '❌';
        const role = user.isAdmin ? (id == ADMIN_ID ? '👑' : '✨') : '👤';
        userList += `${status} ${role} ID: \`${id}\`\n`;
    });
    ctx.replyWithMarkdown(userList);
});

bot.command('thongbao', (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const message = ctx.message.text.slice('/thongbao '.length).trim();
    if (!message) return;
    const broadcastMessage = `📣 *THÔNG BÁO:*\n\n${message}`;
    Object.keys(users).forEach(userId => {
        bot.telegram.sendMessage(userId, broadcastMessage, { parse_mode: 'Markdown' }).catch(()=>{});
    });
    ctx.reply(`Đã gửi thông báo.`);
});

// --- Khởi động bot ---
bot.launch().then(() => {
    console.log('Bot Sunwin đã khởi động!');
    setInterval(fetchAndProcessApiData, API_INTERVAL);
    fetchAndProcessApiData();
}).catch((err) => {
    console.error('Lỗi khi khởi động Bot:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));