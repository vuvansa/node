// --- START OF FILE botsunwin_fixed.js ---

const { Telegraf } = require('telegraf');
const { readFileSync, writeFileSync, existsSync } = require('fs');
// Dòng require('node-fetch') đã được XÓA ở đây.
// Chúng ta sẽ import nó theo cách khác bên dưới.

// Cài đặt một trong hai thư viện proxy này, tùy thuộc vào loại proxy bạn có
const { HttpsProxyAgent } = require('https-proxy-agent'); // Dành cho HTTP/HTTPS proxy
// const { SocksProxyAgent } = require('socks-proxy-agent'); // Dành cho SOCKS proxy

// --- Cấu hình Bot ---
// !!! QUAN TRỌNG: Hãy thay thế bằng token MỚI của bạn sau khi đã thu hồi token cũ !!!
const BOT_TOKEN = 'YOUR_NEW_BOT_TOKEN'; // THAY THẾ TOKEN CỦA BẠN VÀO ĐÂY
const ADMIN_ID = 5524246727; // ID của admin chính
const API_URL = 'http://157.10.52.15:3000/api/sunwin?key=axotaixiu'; 
const API_INTERVAL = 3000; // Tần suất gọi API (3 giây)

// --- Cấu hình Proxy (Tùy chọn) ---
const PROXY_URL = ''; // Ví dụ: 'http://user:password@your_proxy_ip:your_proxy_port'

// --- Khởi tạo Bot với cấu hình Proxy ---
let bot;
if (PROXY_URL && PROXY_URL.startsWith('http')) {
    bot = new Telegraf(BOT_TOKEN, { telegram: { agent: new HttpsProxyAgent(PROXY_URL) } });
    console.log(`Bot khởi động với HTTP Proxy: ${PROXY_URL}`);
} else if (PROXY_URL && PROXY_URL.startsWith('socks')) {
    // bot = new Telegraf(BOT_TOKEN, { telegram: { agent: new SocksProxyAgent(PROXY_URL) } });
    console.log(`Bot khởi động với SOCKS Proxy: ${PROXY_URL}`);
} else {
    bot = new Telegraf(BOT_TOKEN);
    console.log('Bot khởi động không dùng Proxy.');
}

// --- Tên file lưu trữ dữ liệu ---
const USERS_FILE = 'users.json';
const PREDICTION_HISTORY_FILE = 'prediction_history.json';

// --- Biến lưu trữ dữ liệu trong bộ nhớ ---
let users = {}; // { "user_id": { active: boolean, isAdmin: boolean } }
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

// --- Hàm định dạng dữ liệu API để hiển thị ---
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

// --- Hàm gọi API và gửi thông báo ---
async function fetchAndProcessApiData() {
    try {
        // **ĐÂY LÀ THAY ĐỔI QUAN TRỌNG ĐỂ SỬA LỖI**
        // Tải thư viện node-fetch bằng import() động
        const fetch = (await import('node-fetch')).default;

        const response = await fetch(API_URL);
        if (!response.ok) {
            console.error(`Lỗi API: HTTP status ${response.status}`);
            return;
        }
        const data = await response.json();

        // Chỉ gửi khi có phiên mới
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
                            console.log(`User ${userId} đã chặn bot. Đánh dấu là inactive.`);
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

// --- Lệnh /start ---
bot.start((ctx) => {
    const userId = ctx.from.id;
    const userName = ctx.from.username || ctx.from.first_name;

    if (!users[userId]) {
        users[userId] = { active: true, isAdmin: false };
        saveData(USERS_FILE, users);
        console.log(`Người dùng mới: ${userId} (${userName})`);
    } else {
        users[userId].active = true;
        saveData(USERS_FILE, users);
    }

    if (isAdmin(userId)) {
        ctx.reply(
            `Chào mừng Admin ${userName}! 👋 Bot đã sẵn sàng.` +
            '\n\n*Lệnh Admin:*\n' +
            '/addadmin `<user_id>` - Thêm admin phụ\n' +
            '/xoaadmin `<user_id>` - Xóa admin phụ\n' +
            '/check - Xem danh sách người dùng\n' +
            '/thongbao `<tin_nhắn>` - Gửi thông báo chung\n\n' +
            '*Lệnh chung:*\n' +
            '/chaybot - Bắt đầu nhận dự đoán\n' +
            '/tatbot - Tạm dừng nhận dự đoán'
        );
    } else {
        ctx.reply(
            `Chào mừng ${userName} đến với Bot Sunwin! 🎉` +
            '\n\nBot sẽ tự động gửi dự đoán cho bạn.' +
            '\n\n*Các lệnh của bạn:*\n' +
            '/chaybot - Bật nhận dự đoán (đã bật mặc định)\n' +
            '/tatbot - Tắt nhận dự đoán'
        );
    }
});

// --- Lệnh /chaybot ---
bot.command('chaybot', (ctx) => {
    const userId = ctx.from.id;
    if (!users[userId]) {
        users[userId] = { active: true, isAdmin: false };
    }
    
    users[userId].active = true;
    saveData(USERS_FILE, users);
    ctx.reply('✅ Bạn đã bật nhận dự đoán. Bot sẽ gửi tin nhắn khi có phiên mới.');
});

// --- Lệnh /tatbot ---
bot.command('tatbot', (ctx) => {
    const userId = ctx.from.id;
    if (users[userId]) {
        users[userId].active = false;
        saveData(USERS_FILE, users);
    }
    ctx.reply('❌ Bạn đã tắt nhận dự đoán. Gõ /chaybot để bật lại.');
});


// --- Các lệnh Admin ---
bot.command('addadmin', (ctx) => {
    if (!isMainAdmin(ctx.from.id)) return ctx.reply('Chỉ admin chính mới có quyền này.');
    const targetUserId = parseInt(ctx.message.text.split(' ')[1], 10);
    if (isNaN(targetUserId)) return ctx.reply('ID người dùng không hợp lệ.');
    if (!users[targetUserId]) users[targetUserId] = { active: true, isAdmin: false };
    users[targetUserId].isAdmin = true;
    saveData(USERS_FILE, users);
    ctx.reply(`✅ Đã cấp quyền admin cho ID \`${targetUserId}\`.`);
    bot.telegram.sendMessage(targetUserId, 'Bạn đã được cấp quyền admin.').catch(()=>{});
});

bot.command('xoaadmin', (ctx) => {
    if (!isMainAdmin(ctx.from.id)) return ctx.reply('Chỉ admin chính mới có quyền này.');
    const targetUserId = parseInt(ctx.message.text.split(' ')[1], 10);
    if (isNaN(targetUserId)) return ctx.reply('ID người dùng không hợp lệ.');
    if (targetUserId === ADMIN_ID) return ctx.reply('Không thể xóa admin chính.');
    if (users[targetUserId]) users[targetUserId].isAdmin = false;
    saveData(USERS_FILE, users);
    ctx.reply(`✅ Đã gỡ quyền admin của ID \`${targetUserId}\`.`);
    bot.telegram.sendMessage(targetUserId, 'Quyền admin của bạn đã bị gỡ.').catch(()=>{});
});

bot.command('check', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply('Bạn không có quyền.');
    
    let userList = '--- *Danh sách Người dùng* ---\n\n';
    const userIds = Object.keys(users);
    
    userIds.forEach(id => {
        const user = users[id];
        const status = user.active ? '✅ Đang bật' : '❌ Đang tắt';
        const role = user.isAdmin ? (id == ADMIN_ID ? '👑 Admin Chính' : '✨ Admin Phụ') : '👤 User';
        userList += `ID: \`${id}\` | ${role} | ${status}\n`;
    });
    userList += `\n*Tổng số người dùng:* ${userIds.length}`;

    ctx.replyWithMarkdown(userList);
});

bot.command('thongbao', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply('Bạn không có quyền.');
    const message = ctx.message.text.slice('/thongbao '.length).trim();
    if (!message) return ctx.reply('Vui lòng nhập nội dung thông báo.');

    const broadcastMessage = `📣 *THÔNG BÁO TỪ ADMIN:*\n\n${message}`;
    Object.keys(users).forEach(userId => {
        bot.telegram.sendMessage(userId, broadcastMessage, { parse_mode: 'Markdown' })
            .catch(e => console.error(`Lỗi gửi thông báo tới ${userId}:`, e.message));
    });
    ctx.reply(`Đã gửi thông báo tới người dùng.`);
});

// --- Khởi động bot ---
bot.launch().then(() => {
    console.log('Bot Sunwin (phiên bản đã sửa lỗi) đã khởi động!');
    setInterval(fetchAndProcessApiData, API_INTERVAL);
    console.log(`Bắt đầu lấy dữ liệu API mỗi ${API_INTERVAL / 1000} giây.`);
    fetchAndProcessApiData();
}).catch((err) => {
    console.error('Lỗi khi khởi động Bot:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));