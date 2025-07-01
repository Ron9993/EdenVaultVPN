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

// === Commands ===
bot.onText(/\/start/, (msg) => {
    const id = msg.chat.id;
    bot.sendMessage(id, '🔐 **EdenVaultVPN - Your Digital Freedom**\n\n📦 Choose your VPN Plan:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🟢 Mini (100GB) - 3000 MMK', callback_data: 'plan_mini' }],
                [{ text: '🔵 Power (300GB) - 6000 MMK', callback_data: 'plan_power' }],
                [{ text: '🔴 Ultra (500GB) - 8000 MMK', callback_data: 'plan_ultra' }]
            ]
        },
        parse_mode: 'Markdown'
    });
});

bot.on('callback_query', async (query) => {
    const id = query.message.chat.id;
    const data = query.data;

    if (data.startsWith('plan_')) {
        const key = data.split('_')[1];
        const plan = plans[key];
        userState.set(id, { plan: key });

        bot.sendMessage(id, `📦 **${plan.name}** Selected\n💾 **Data:** ${plan.gb}GB\n💰 **Price:** ${plan.price} MMK\n📅 **Duration:** ${plan.days} days\n\n🌍 Choose Server Location:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🇺🇸 US Server', callback_data: `srv_us_${key}` }],
                    [{ text: '🇸🇬 SG Server', callback_data: `srv_sg_${key}` }],
                    [{ text: '🌐 Both Servers (Split)', callback_data: `srv_both_${key}` }],
                    [{ text: '🔙 Back to Plans', callback_data: 'back_plans' }]
                ]
            },
            parse_mode: 'Markdown'
        });
    }

    if (data === 'back_plans') {
        bot.sendMessage(id, '📦 Choose your VPN Plan:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🟢 Mini (100GB) - 3000 MMK', callback_data: 'plan_mini' }],
                    [{ text: '🔵 Power (300GB) - 6000 MMK', callback_data: 'plan_power' }],
                    [{ text: '🔴 Ultra (500GB) - 8000 MMK', callback_data: 'plan_ultra' }]
                ]
            }
        });
    }

    if (data.startsWith('srv_')) {
        const [, server, planKey] = data.split('_');
        const plan = plans[planKey];
        const uid = uuidv4();
        pendingProofs.set(uid, { id, server, planKey, timestamp: new Date() });

        let serverText = '';
        if (server === 'us') {
            serverText = '🇺🇸 **US Server** - Fast speeds for Americas';
        } else if (server === 'sg') {
            serverText = '🇸🇬 **SG Server** - Fast speeds for Asia-Pacific';
        } else {
            serverText = '🌐 **Both Servers** - Best of both worlds (data split 50/50)';
        }

        bot.sendMessage(id, `💳 **Payment Required**\n\n${serverText}\n📦 **Plan:** ${plan.name}\n💾 **Data:** ${plan.gb}GB\n💰 **Amount:** ${plan.price} MMK\n\n📱 **Pay via KPay:** 09123456789\n🆔 **Reference:** ${uid.slice(-8)}\n\nAfter payment, upload your screenshot:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📤 Upload Payment Proof', callback_data: `proof_${uid}` }],
                    [{ text: '🔙 Back to Servers', callback_data: `plan_${planKey}` }]
                ]
            },
            parse_mode: 'Markdown'
        });
    }

    if (data.startsWith('proof_')) {
        const uid = data.split('_')[1];
        const proof = pendingProofs.get(uid);

        if (!proof) {
            bot.sendMessage(id, '❌ Payment session expired. Please start a new payment.');
            return;
        }

        bot.sendMessage(id, '📸 Please send your payment screenshot now.\n⏰ You have 5 minutes to upload.');

        const photoListener = async (photoMsg) => {
            if (photoMsg.chat.id !== id || !photoMsg.photo) return;

            bot.sendMessage(id, '✅ Payment proof received! Your payment is being reviewed by our team.\n⏱️ Approval usually takes 5-30 minutes.');

            const plan = plans[proof.planKey];
            let serverInfo = '';
            if (proof.server === 'us') {
                serverInfo = `🇺🇸 US Server - ${plan.gb}GB`;
            } else if (proof.server === 'sg') {
                serverInfo = `🇸🇬 SG Server - ${plan.gb}GB`;
            } else {
                serverInfo = `🌐 Both Servers - ${plan.gb/2}GB each`;
            }

            const adminText = `🔔 **New Payment for Review**\n\n👤 **User:** ${photoMsg.from.first_name} (@${photoMsg.from.username || 'No username'})\n🆔 **User ID:** ${id}\n📦 **Plan:** ${plan.name}\n🌍 **Server:** ${serverInfo}\n💰 **Amount:** ${plan.price} MMK\n🔑 **Payment ID:** ${uid}\n📅 **Time:** ${new Date().toLocaleString()}\n\nReview and approve/reject:`;

            // Forward the photo to admin
            bot.forwardMessage(ADMIN_ID, id, photoMsg.message_id);

            // Send admin the payment details with approval buttons
            bot.sendMessage(ADMIN_ID, adminText, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✅ Approve Payment', callback_data: `approve_${uid}` }],
                        [{ text: '❌ Reject Payment', callback_data: `reject_${uid}` }]
                    ]
                },
                parse_mode: 'Markdown'
            });

            bot.removeListener('photo', photoListener);
        };

        bot.on('photo', photoListener);

        // Auto-remove listener after 5 minutes
        setTimeout(() => {
            bot.removeListener('photo', photoListener);
        }, 300000);
    }

    if (data.startsWith('approve_')) {
        if (query.from.id.toString() !== ADMIN_ID) {
            bot.answerCallbackQuery(query.id, { text: '❌ Unauthorized' });
            return;
        }

        const uid = data.split('_')[1];
        const proof = pendingProofs.get(uid);
        if (!proof) {
            bot.sendMessage(id, '❌ Payment not found or already processed.');
            return;
        }

        const user = proof.id;
        const plan = plans[proof.planKey];
        const split = proof.server === 'both';
        const limitBytes = (plan.gb / (split ? 2 : 1)) * 1024 * 1024 * 1024; // GB to bytes
        const keys = [];

        try {
            async function createKey(server) {
                const response = await axios.post(`${OUTLINE[server]}/access-keys`, {
                    name: `EdenVault_${user}_${server}_${Date.now()}`
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

                return { url: response.data.accessUrl, server: server.toUpperCase(), gb: limitBytes / (1024**3) };
            }

            if (split) {
                keys.push(await createKey('us'));
                keys.push(await createKey('sg'));
            } else {
                keys.push(await createKey(proof.server));
            }

            // Send success message to user
            bot.sendMessage(user, '🎉 **Payment Approved!**\n\nYour VPN access is ready! Download **Outline** app and use the keys below:', { parse_mode: 'Markdown' });

            // Send each key with QR code
            for (const key of keys) {
                bot.sendMessage(user, `🔑 **${key.server} Server Access**\n💾 **Data Limit:** ${key.gb}GB\n\n\`${key.url}\``, { parse_mode: 'Markdown' });

                // Generate and send QR code
                const qrBuffer = await QRCode.toBuffer(key.url);
                bot.sendPhoto(user, qrBuffer, { 
                    caption: `${key.server === 'US' ? '🇺🇸' : '🇸🇬'} ${key.server} Server QR Code - Scan with Outline app` 
                });
            }

            // Send setup instructions
            bot.sendMessage(user, '📱 **Setup Instructions:**\n\n1️⃣ Download **Outline** app from your app store\n2️⃣ Copy the access key or scan QR code\n3️⃣ Paste key in Outline app\n4️⃣ Connect and enjoy secure browsing!\n\n💬 **Support:** @edenvault_88\n📧 **Email:** edenvault888@gmail.com');

            pendingProofs.delete(uid);
            bot.editMessageText(`✅ **Payment Approved & Processed**\n\nPayment ID: ${uid}\nUser: ${user}\nKeys generated successfully!`, {
                chat_id: id,
                message_id: query.message.message_id,
                parse_mode: 'Markdown'
            });

        } catch (error) {
            console.error('Error creating VPN keys:', error.message);
            bot.sendMessage(user, '❌ Error generating VPN access. Please contact support.');
            bot.sendMessage(id, `❌ Error processing payment ${uid}: ${error.message}`);
        }
    }

    if (data.startsWith('reject_')) {
        if (query.from.id.toString() !== ADMIN_ID) {
            bot.answerCallbackQuery(query.id, { text: '❌ Unauthorized' });
            return;
        }

        const uid = data.split('_')[1];
        const proof = pendingProofs.get(uid);
        if (!proof) {
            bot.sendMessage(id, '❌ Payment not found or already processed.');
            return;
        }

        bot.sendMessage(proof.id, '❌ **Payment Rejected**\n\nYour payment could not be verified. Please contact support for assistance.\n\n💬 **Support:** @edenvault_88', { parse_mode: 'Markdown' });

        pendingProofs.delete(uid);
        bot.editMessageText(`❌ **Payment Rejected**\n\nPayment ID: ${uid}\nUser: ${proof.id}\nReason: Manual rejection by admin`, {
            chat_id: id,
            message_id: query.message.message_id,
            parse_mode: 'Markdown'
        });
    }

    bot.answerCallbackQuery(query.id);
});

// Additional commands
bot.onText(/\/help/, (msg) => {
    const helpText = `🔐 **EdenVaultVPN Help**\n\n📱 **Commands:**\n/start - Start the bot\n/help - Show this help\n/support - Contact support\n\n📋 **How to use:**\n1️⃣ Choose a plan\n2️⃣ Select server location\n3️⃣ Pay via KPay\n4️⃣ Upload payment proof\n5️⃣ Get your VPN keys\n\n💬 **Need help?** Contact @edenvault_88`;
    bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

bot.onText(/\/support/, (msg) => {
    bot.sendMessage(msg.chat.id, '💬 **Support Contact**\n\nTelegram: @edenvault_88\nEmail: edenvault888@gmail.com\nResponse time: 24 hours', { parse_mode: 'Markdown' });
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