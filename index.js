// EdenVaultVPN Bot - Optimized for VPS Deployment

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const axios = require('axios');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const http = require('http');

// === ENV ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const OUTLINE = {
    us: process.env.US_OUTLINE_API || 'https://154.53.57.223:32987/W6Si53JA7hsJXZqMLsztAg',
    sg: process.env.SG_OUTLINE_API || 'https://154.26.138.68:7127/h6bsFmcBWyN8O_0i6BBJiw'
};

if (!BOT_TOKEN || !ADMIN_ID) {
    console.error('Missing BOT_TOKEN or ADMIN_ID in .env');
    process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EdenVaultVPN Bot is running');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP server listening on port ${PORT}`);
});

// === Plans ===
const plans = {
    mini_30: { name: 'Mini Vault', gb: 100, price: 3000, days: 30 },
    mini_90: { name: 'Mini Vault', gb: 100, price: 7000, days: 90 },
    power_30: { name: 'Power Vault', gb: 300, price: 6000, days: 30 },
    power_90: { name: 'Power Vault', gb: 300, price: 13000, days: 90 },
    ultra_30: { name: 'Ultra Vault', gb: 500, price: 8000, days: 30 },
    ultra_90: { name: 'Ultra Vault', gb: 500, price: 17000, days: 90 }
};

// === Users ===
const userState = new Map();
const pendingProofs = new Map();

// === FUNCTIONS ===

// Show language selection
function showLanguageSelection(chatId) {
    const welcomeText = '🔐 *EdenVaultVPN*\n\nPlease select your language:\n请选择您的语言：\nကျေးဇူးပြု၍ သင့်ဘာသာစကားကို ရွေးချယ်ပါ：';
    const keyboard = {
        inline_keyboard: [
            [{ text: '🇺🇸 English', callback_data: 'lang_en' }],
            [{ text: '🇨🇳 中文', callback_data: 'lang_cn' }],
            [{ text: '🇲🇲 မြန်မာ', callback_data: 'lang_mm' }]
        ]
    };
    
    bot.sendMessage(chatId, welcomeText, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

// Show main menu with 4 main options
function showMainMenu(chatId, lang = 'en') {
    const texts = {
        en: {
            welcome: '🔐 *EdenVaultVPN - Your Digital Freedom*\n\nWelcome to secure VPN service!',
            choosePlan: '📦 Choose Plan',
            myPlan: '👤 My Plan',
            support: '💬 Support',
            language: '🌐 Language'
        },
        cn: {
            welcome: '🔐 *EdenVaultVPN - 您的数字自由*\n\n欢迎使用安全VPN服务！',
            choosePlan: '📦 选择套餐',
            myPlan: '👤 我的套餐',
            support: '💬 客服支持',
            language: '🌐 语言'
        },
        mm: {
            welcome: '🔐 *EdenVaultVPN - သင့်ဒစ်ဂျစ်တယ်လွတ်လပ်မှု*\n\nလုံခြုံသော VPN ဝန်ဆောင်မှုသို့ ကြိုဆိုပါသည်！',
            choosePlan: '📦 အစီအစဥ်ရွေးရန်',
            myPlan: '👤 ကျွန်ုပ်၏အစီအစဥ်',
            support: '💬 အကူအညီ',
            language: '🌐 ဘာသာစကား'
        }
    };

    const text = texts[lang];
    const keyboard = {
        inline_keyboard: [
            [
                { text: text.choosePlan, callback_data: `choose_plans_${lang}` },
                { text: text.myPlan, callback_data: `my_plan_${lang}` }
            ],
            [
                { text: text.support, callback_data: `support_${lang}` },
                { text: text.language, callback_data: 'change_lang' }
            ]
        ]
    };
    
    bot.sendMessage(chatId, text.welcome, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

// Show available plans for selection
function showPlansMenu(chatId, lang = 'en') {
    const texts = {
        en: {
            title: '🔐 📦 *Select your plan:*',
            back: '🔙 Back to Menu'
        },
        cn: {
            title: '🔐 📦 *选择您的套餐:*',
            back: '🔙 返回菜单'
        },
        mm: {
            title: '🔐 📦 *သင့်အစီအစဥ်ကို ရွေးချယ်ပါ:*',
            back: '🔙 မီနူးသို့ပြန်'
        }
    };

    const text = texts[lang];
    const planText = `${text.title}\n\n🟢 **Mini Vault**\n• 100GB • 30 Days - 3000 MMK\n• 100GB • 90 Days - 7000 MMK\n\n🔵 **Power Vault**\n• 300GB • 30 Days - 6000 MMK\n• 300GB • 90 Days - 13000 MMK\n\n🔴 **Ultra Vault (Most Popular)**\n• 500GB • 30 Days - 8000 MMK\n• 500GB • 90 Days - 17000 MMK`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🟢 Mini 30D', callback_data: `plan_mini_30_${lang}` },
                { text: '🟢 Mini 90D', callback_data: `plan_mini_90_${lang}` }
            ],
            [
                { text: '🔵 Power 30D', callback_data: `plan_power_30_${lang}` },
                { text: '🔵 Power 90D', callback_data: `plan_power_90_${lang}` }
            ],
            [
                { text: '🔴 Ultra 30D', callback_data: `plan_ultra_30_${lang}` },
                { text: '🔴 Ultra 90D', callback_data: `plan_ultra_90_${lang}` }
            ],
            [{ text: text.back, callback_data: `back_main_${lang}` }]
        ]
    };
    
    bot.sendMessage(chatId, planText, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

// Show user's current plan status
function showMyPlan(chatId, lang = 'en') {
    const texts = {
        en: {
            title: '👤 *My Plan Status*',
            noPlan: 'You don\'t have an active plan yet.\n\nClick "Choose Plan" to purchase a VPN plan.',
            back: '🔙 Back to Menu'
        },
        cn: {
            title: '👤 *我的套餐状态*',
            noPlan: '您还没有激活的套餐。\n\n点击"选择套餐"来购买VPN套餐。',
            back: '🔙 返回菜单'
        },
        mm: {
            title: '👤 *ကျွန်ုပ်၏အစီအစဥ်အခြေအနေ*',
            noPlan: 'သင့်တွင် ရရှိနေသောအစီအစဥ်မရှိသေးပါ။\n\nVPN အစီအစဥ်ဝယ်ယူရန် "အစီအစဥ်ရွေးရန်" ကိုနှိပ်ပါ။',
            back: '🔙 မီနူးသို့ပြန်'
        }
    };

    const text = texts[lang];
    const keyboard = {
        inline_keyboard: [
            [{ text: text.back, callback_data: `back_main_${lang}` }]
        ]
    };
    
    bot.sendMessage(chatId, `${text.title}\n\n${text.noPlan}`, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

// Show plan details and server selection
function showPlanDetails(chatId, planKey, lang = 'en') {
    const plan = plans[planKey];
    userState.set(chatId, { plan: planKey, lang: lang });

    const texts = {
        en: {
            selected: 'Selected',
            data: 'Data',
            price: 'Price',
            duration: 'Duration',
            days: 'days',
            choose: 'Choose Server Location:',
            us: '🇺🇸 US Server',
            sg: '🇸🇬 SG Server',
            both: '🌐 Both Servers (Split)',
            back: '🔙 Back to Plans'
        },
        cn: {
            selected: '已选择',
            data: '流量',
            price: '价格',
            duration: '时长',
            days: '天',
            choose: '选择服务器位置：',
            us: '🇺🇸 美国服务器',
            sg: '🇸🇬 新加坡服务器',
            both: '🌐 双服务器 (分割)',
            back: '🔙 返回套餐'
        },
        mm: {
            selected: 'ရွေးချယ်ပြီး',
            data: 'ဒေတာ',
            price: 'စျေးနှုန်း',
            duration: 'ကြာချိန်',
            days: 'ရက်',
            choose: 'ဆာဗာတည်နေရာကို ရွေးချယ်ပါ：',
            us: '🇺🇸 US ဆာဗာ',
            sg: '🇸🇬 SG ဆာဗာ',
            both: '🌐 ဆာဗာနှစ်ခုလုံး (ခွဲဝေ)',
            back: '🔙 အစီအစဥ်များသို့ပြန်'
        }
    };

    const text = texts[lang];
    const planText = `📦 *${plan.name}* ${text.selected}\n💾 *${text.data}:* ${plan.gb}GB\n💰 *${text.price}:* ${plan.price} MMK\n📅 *${text.duration}:* ${plan.days} ${text.days}\n\n🌍 ${text.choose}`;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: text.us, callback_data: `srv_us_${planKey}_${lang}` }],
            [{ text: text.sg, callback_data: `srv_sg_${planKey}_${lang}` }],
            [{ text: text.both, callback_data: `srv_both_${planKey}_${lang}` }],
            [{ text: text.back, callback_data: `back_plans_${lang}` }]
        ]
    };

    bot.sendMessage(chatId, planText, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

// Show payment details
function showPaymentDetails(chatId, server, planKey) {
    const plan = plans[planKey];
    const uid = uuidv4();
    pendingProofs.set(uid, { id: chatId, server, planKey, timestamp: new Date() });

    let serverText = '';
    if (server === 'us') {
        serverText = '🇺🇸 *US Server* - Fast speeds for Americas';
    } else if (server === 'sg') {
        serverText = '🇸🇬 *SG Server* - Fast speeds for Asia-Pacific';
    } else {
        serverText = '🌐 *Both Servers* - Best of both worlds (data split 50/50)';
    }

    const paymentText = `💳 *Payment Required*\n\n${serverText}\n📦 *Plan:* ${plan.name}\n💾 *Data:* ${plan.gb}GB\n💰 *Amount:* ${plan.price} MMK\n\n📱 *Pay via KPay:* 09123456789\n🆔 *Reference:* ${uid.slice(-8)}\n\nAfter payment, upload your screenshot:`;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '📤 Upload Payment Proof', callback_data: `proof_${uid}` }],
            [{ text: '🔙 Back to Servers', callback_data: `plan_${planKey}` }]
        ]
    };

    bot.sendMessage(chatId, paymentText, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

// Handle payment proof upload
function handlePaymentProof(chatId, uid) {
    const proof = pendingProofs.get(uid);

    if (!proof) {
        bot.sendMessage(chatId, '❌ Payment session expired. Please start a new payment.');
        return;
    }

    bot.sendMessage(chatId, '📸 Please send your payment screenshot now.\n⏰ You have 5 minutes to upload.');

    const photoListener = async (photoMsg) => {
        if (photoMsg.chat.id !== chatId || !photoMsg.photo) return;

        await processPaymentProof(photoMsg, proof, uid);
        bot.removeListener('photo', photoListener);
    };

    bot.on('photo', photoListener);

    // Auto-remove listener after 5 minutes
    setTimeout(() => {
        bot.removeListener('photo', photoListener);
    }, 300000);
}

// Process payment proof and notify admin
async function processPaymentProof(photoMsg, proof, uid) {
    const chatId = photoMsg.chat.id;
    const plan = plans[proof.planKey];
    
    bot.sendMessage(chatId, '✅ Payment proof received! Your payment is being reviewed by our team.\n⏱️ Approval usually takes 5-30 minutes.');

    let serverInfo = '';
    if (proof.server === 'us') {
        serverInfo = `🇺🇸 US Server - ${plan.gb}GB`;
    } else if (proof.server === 'sg') {
        serverInfo = `🇸🇬 SG Server - ${plan.gb}GB`;
    } else {
        serverInfo = `🌐 Both Servers - ${plan.gb/2}GB each`;
    }

    const adminText = `🔔 *New Payment for Review*\n\n👤 *User:* ${photoMsg.from.first_name} (@${photoMsg.from.username || 'No username'})\n🆔 *User ID:* ${chatId}\n📦 *Plan:* ${plan.name}\n🌍 *Server:* ${serverInfo}\n💰 *Amount:* ${plan.price} MMK\n🔑 *Payment ID:* ${uid}\n📅 *Time:* ${new Date().toLocaleString()}\n\nReview and approve/reject:`;

    // Forward the photo to admin
    bot.forwardMessage(ADMIN_ID, chatId, photoMsg.message_id);

    // Send admin the payment details with approval buttons
    const adminKeyboard = {
        inline_keyboard: [
            [{ text: '✅ Approve Payment', callback_data: `approve_${uid}` }],
            [{ text: '❌ Reject Payment', callback_data: `reject_${uid}` }]
        ]
    };

    bot.sendMessage(ADMIN_ID, adminText, {
        reply_markup: adminKeyboard,
        parse_mode: 'Markdown'
    });
}

// Create VPN access key
async function createVPNKey(server, userId, limitBytes) {
    const response = await axios.post(`${OUTLINE[server]}/access-keys`, {
        name: `EdenVault_${userId}_${server}_${Date.now()}`
    }, { 
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: 10000 
    });

    // Set data limit
    await axios.put(`${OUTLINE[server]}/access-keys/${response.data.id}/data-limit`, {
        limit: { bytes: limitBytes }
    }, { 
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: 10000 
    });

    return { 
        url: response.data.accessUrl, 
        server: server.toUpperCase(), 
        gb: limitBytes / (1024**3) 
    };
}

// Send VPN keys to user
async function sendVPNKeys(userId, keys) {
    bot.sendMessage(userId, '🎉 *Payment Approved!*\n\nYour VPN access is ready! Download *Outline* app and use the keys below:', { parse_mode: 'Markdown' });

    // Send each key with QR code
    for (const key of keys) {
        bot.sendMessage(userId, `🔑 *${key.server} Server Access*\n💾 *Data Limit:* ${key.gb}GB\n\n\`${key.url}\``, { parse_mode: 'Markdown' });

        // Generate and send QR code
        const qrBuffer = await QRCode.toBuffer(key.url);
        bot.sendPhoto(userId, qrBuffer, { 
            caption: `${key.server === 'US' ? '🇺🇸' : '🇸🇬'} ${key.server} Server QR Code - Scan with Outline app` 
        });
    }

    // Send setup instructions
    const instructions = '📱 *Setup Instructions:*\n\n1️⃣ Download *Outline* app from your app store\n2️⃣ Copy the access key or scan QR code\n3️⃣ Paste key in Outline app\n4️⃣ Connect and enjoy secure browsing!\n\n💬 *Support:* @edenvault\\_88\n📧 *Email:* edenvault888@gmail.com';
    bot.sendMessage(userId, instructions, { parse_mode: 'Markdown' });
}

// Approve payment and generate keys
async function approvePayment(adminChatId, messageId, uid) {
    const proof = pendingProofs.get(uid);
    if (!proof) {
        bot.sendMessage(adminChatId, '❌ Payment not found or already processed.');
        return;
    }

    const user = proof.id;
    const plan = plans[proof.planKey];
    const split = proof.server === 'both';
    const limitBytes = (plan.gb / (split ? 2 : 1)) * 1024 * 1024 * 1024;
    const keys = [];

    try {
        if (split) {
            keys.push(await createVPNKey('us', user, limitBytes));
            keys.push(await createVPNKey('sg', user, limitBytes));
        } else {
            keys.push(await createVPNKey(proof.server, user, limitBytes));
        }

        await sendVPNKeys(user, keys);

        pendingProofs.delete(uid);
        bot.editMessageText(`✅ *Payment Approved & Processed*\n\nPayment ID: ${uid}\nUser: ${user}\nKeys generated successfully!`, {
            chat_id: adminChatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        });

    } catch (error) {
        console.error('Error creating VPN keys:', error.message);
        bot.sendMessage(user, '❌ Error generating VPN access. Please contact support.');
        bot.sendMessage(adminChatId, `❌ Error processing payment ${uid}: ${error.message}`);
    }
}

// Reject payment
function rejectPayment(adminChatId, messageId, uid) {
    const proof = pendingProofs.get(uid);
    if (!proof) {
        bot.sendMessage(adminChatId, '❌ Payment not found or already processed.');
        return;
    }

    bot.sendMessage(proof.id, '❌ *Payment Rejected*\n\nYour payment could not be verified. Please contact support for assistance.\n\n💬 *Support:* @edenvault\\_88', { parse_mode: 'Markdown' });

    pendingProofs.delete(uid);
    bot.editMessageText(`❌ *Payment Rejected*\n\nPayment ID: ${uid}\nUser: ${proof.id}\nReason: Manual rejection by admin`, {
        chat_id: adminChatId,
        message_id: messageId,
        parse_mode: 'Markdown'
    });
}

// Show help information
function showHelp(chatId) {
    const helpText = `🔐 *EdenVaultVPN Help*\n\n📱 *Commands:*\n/start - Start the bot\n/help - Show this help\n/support - Contact support\n\n📋 *How to use:*\n1️⃣ Choose a plan\n2️⃣ Select server location\n3️⃣ Pay via KPay\n4️⃣ Upload payment proof\n5️⃣ Get your VPN keys\n\n💬 *Need help?* Contact @edenvault\\_88`;
    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

// Show support information
function showSupport(chatId) {
    const supportText = '💬 *Support Contact*\n\nTelegram: @edenvault\\_88\nEmail: edenvault888@gmail.com\nResponse time: 24 hours';
    bot.sendMessage(chatId, supportText, { parse_mode: 'Markdown' });
}

// === BOT HANDLERS ===

// Start command
bot.onText(/\/start/, (msg) => {
    showLanguageSelection(msg.chat.id);
});

// Help command
bot.onText(/\/help/, (msg) => {
    showHelp(msg.chat.id);
});

// Support command
bot.onText(/\/support/, (msg) => {
    showSupport(msg.chat.id);
});

// Callback query handler
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith('lang_')) {
        const lang = data.split('_')[1];
        showMainMenu(chatId, lang);
    }

    if (data === 'change_lang') {
        showLanguageSelection(chatId);
    }

    if (data.startsWith('choose_plans_')) {
        const lang = data.split('_')[2] || 'en';
        showPlansMenu(chatId, lang);
    }

    if (data.startsWith('my_plan_')) {
        const lang = data.split('_')[2] || 'en';
        showMyPlan(chatId, lang);
    }

    if (data.startsWith('support_')) {
        const lang = data.split('_')[1] || 'en';
        showSupport(chatId);
    }

    if (data.startsWith('back_main_')) {
        const lang = data.split('_')[2] || 'en';
        showMainMenu(chatId, lang);
    }

    if (data.startsWith('plan_')) {
        const parts = data.split('_');
        if (parts.length >= 3) {
            const planKey = `${parts[1]}_${parts[2]}`;
            const lang = parts[3] || 'en';
            showPlanDetails(chatId, planKey, lang);
        }
    }

    if (data.startsWith('back_plans_')) {
        const lang = data.split('_')[2] || 'en';
        showPlansMenu(chatId, lang);
    }

    if (data.startsWith('srv_')) {
        const parts = data.split('_');
        const server = parts[1];
        const planKey = `${parts[2]}_${parts[3]}`;
        const lang = parts[4] || 'en';
        showPaymentDetails(chatId, server, planKey, lang);
    }

    if (data.startsWith('proof_')) {
        const uid = data.split('_')[1];
        handlePaymentProof(chatId, uid);
    }

    if (data.startsWith('approve_')) {
        if (query.from.id.toString() !== ADMIN_ID) {
            bot.answerCallbackQuery(query.id, { text: '❌ Unauthorized' });
            return;
        }

        const uid = data.split('_')[1];
        await approvePayment(chatId, query.message.message_id, uid);
    }

    if (data.startsWith('reject_')) {
        if (query.from.id.toString() !== ADMIN_ID) {
            bot.answerCallbackQuery(query.id, { text: '❌ Unauthorized' });
            return;
        }

        const uid = data.split('_')[1];
        rejectPayment(chatId, query.message.message_id, uid);
    }

    bot.answerCallbackQuery(query.id);
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.message);
    process.exit(1);
});

console.log('🤖 EdenVaultVPN Bot started successfully!');
console.log(`🌐 Health check server running on port ${PORT}`);
console.log('📱 Bot is ready to receive messages...');
