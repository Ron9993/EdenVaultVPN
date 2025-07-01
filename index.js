
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
    mini: { name: 'Mini Vault', gb: 100, price: 3000, days: 30 },
    power: { name: 'Power Vault', gb: 300, price: 6000, days: 30 },
    ultra: { name: 'Ultra Vault', gb: 500, price: 8000, days: 30 }
};

// === Users ===
const userState = new Map();
const pendingProofs = new Map();

// === FUNCTIONS ===

// Show main menu with plans
function showMainMenu(chatId) {
    const welcomeText = '🔐 *EdenVaultVPN - Your Digital Freedom*\n\n📦 Choose your VPN Plan:';
    const keyboard = {
        inline_keyboard: [
            [{ text: '🟢 Mini (100GB) - 3000 MMK', callback_data: 'plan_mini' }],
            [{ text: '🔵 Power (300GB) - 6000 MMK', callback_data: 'plan_power' }],
            [{ text: '🔴 Ultra (500GB) - 8000 MMK', callback_data: 'plan_ultra' }]
        ]
    };
    
    bot.sendMessage(chatId, welcomeText, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

// Show plan details and server selection
function showPlanDetails(chatId, planKey) {
    const plan = plans[planKey];
    userState.set(chatId, { plan: planKey });

    const planText = `📦 *${plan.name}* Selected\n💾 *Data:* ${plan.gb}GB\n💰 *Price:* ${plan.price} MMK\n📅 *Duration:* ${plan.days} days\n\n🌍 Choose Server Location:`;
    const keyboard = {
        inline_keyboard: [
            [{ text: '🇺🇸 US Server', callback_data: `srv_us_${planKey}` }],
            [{ text: '🇸🇬 SG Server', callback_data: `srv_sg_${planKey}` }],
            [{ text: '🌐 Both Servers (Split)', callback_data: `srv_both_${planKey}` }],
            [{ text: '🔙 Back to Plans', callback_data: 'back_plans' }]
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
    showMainMenu(msg.chat.id);
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

    if (data.startsWith('plan_')) {
        const planKey = data.split('_')[1];
        showPlanDetails(chatId, planKey);
    }

    if (data === 'back_plans') {
        showMainMenu(chatId);
    }

    if (data.startsWith('srv_')) {
        const [, server, planKey] = data.split('_');
        showPaymentDetails(chatId, server, planKey);
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
