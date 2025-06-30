require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { 
    polling: {
        interval: 1000,
        autoStart: false
    }
});

// Bot data storage (in production, use a database)
const users = new Map();
const pendingPayments = new Map();
const activePlans = new Map();

// Server configurations
const servers = {
    us: { name: 'US Server', location: 'United States', endpoint: '154.53.57.223:8388' },
    sg: { name: 'SG Server', location: 'Singapore', endpoint: '154.26.138.68:8388' }
};

// Plan configurations
const plans = {
    mini_30: { name: 'Mini Vault', price: 3000, duration: 30, gb: 100 },
    mini_90: { name: 'Mini Vault', price: 7000, duration: 90, gb: 100 },
    power_30: { name: 'Power Vault', price: 6000, duration: 30, gb: 300 },
    power_90: { name: 'Power Vault', price: 13000, duration: 90, gb: 300 },
    ultra_30: { name: 'Ultra Vault', price: 8000, duration: 30, gb: 500 },
    ultra_90: { name: 'Ultra Vault', price: 17000, duration: 90, gb: 500 }
};

// Languages
const languages = {
    en: {
        welcome: '🌐 Welcome! Choose your language:',
        selectPlan: '📦 Select your plan:',
        paymentInfo: '💸 Payment Information',
        paymentProof: 'Please upload your payment proof screenshot:',
        paymentReceived: 'Payment received! Processing your VPN access...',
        approved: '🎉 Payment approved!',
        accessDetails: '🔑 Your VPN Access Details:',
        vault: '🔐 Your digital freedom unlocked! Welcome to secure browsing.',
        bonus: '🎁 Bonus: Share and earn!',
        mainMenu: '🏠 Main Menu',
        myPlan: '📊 My Plan',
        support: '💬 Support',
        selectServer: '🌍 Choose your server configuration:',
        fullUS: 'Full US Server',
        fullSG: 'Full SG Server',
        combined: 'Combined (Split 50/50)',
        helpTitle: '📖 Complete Setup Guide',
        helpStep1: '🔽 Step 1: Download Outline App',
        helpStep2: '💳 Step 2: Purchase VPN Plan',
        helpStep3: '🔑 Step 3: Setup Your VPN',
        helpStep4: '🌐 Step 4: Connect & Browse',
        helpDownload: 'Download Outline from your device app store',
        helpPurchase: 'Select a plan, choose server, and complete payment',
        helpSetup: 'Copy access key or scan QR code in Outline app',
        helpConnect: 'Toggle connection and enjoy secure browsing'
    },
    mm: {
        welcome: '🌐 ကြိုဆိုပါတယ်! ဘာသာစကားရွေးချယ်ပါ:',
        selectPlan: '📦 သင့်အစီအစဥ်ရွေးချယ်ပါ:',
        paymentInfo: '💸 ငွေပေးချေမှုအချက်အလက်',
        paymentProof: 'ငွေပေးချေမှုအထောက်အထား ပုံရိပ်တင်ပါ:',
        paymentReceived: 'ငွေပေးချေမှုရရှိပါပြီ! VPN ဝင်ရောက်မှုကို ပြင်ဆင်နေပါသည်...',
        approved: '🎉 ငွေပေးချေမှုအတည်ပြုပါပြီ!',
        accessDetails: '🔑 သင့် VPN ဝင်ရောက်မှုအချက်အလက်များ:',
        vault: '🔐 သင့်ဒစ်ဂျစ်တယ်လွတ်လပ်မှုကို ဖွင့်လှစ်ပါပြီ! လုံခြုံသောအင်တာနက်သုံးစွဲမှုကို ကြိုဆိုပါတယ်။',
        bonus: '🎁 ဆုလာဘ်: မျှဝေပြီး ရယူပါ!',
        mainMenu: '🏠 ပင်မမီနူး',
        myPlan: '📊 ကျွန်ုပ်၏အစီအစဥ်',
        support: '💬 အကူအညီ',
        selectServer: '🌍 သင့်ဆာဗာ ပြင်ဆင်မှုရွေးချယ်ပါ:',
        fullUS: 'US ဆာဗာအပြည့်',
        fullSG: 'SG ဆာဗာအပြည့်',
        combined: 'ပေါင်းစပ် (၅၀/၅၀ ခွဲဝေ)',
        helpTitle: '📖 အပြည့်အစုံ လမ်းညွှန်',
        helpStep1: '🔽 အဆင့် ၁: Outline အက်ပ် ဒေါင်းလုဒ်လုပ်ပါ',
        helpStep2: '💳 အဆင့် ၂: VPN အစီအစဥ် ဝယ်ယူပါ',
        helpStep3: '🔑 အဆင့် ၃: သင့် VPN ကို စတင်ပါ',
        helpStep4: '🌐 အဆင့် ၄: ချိတ်ဆက်ပြီး သုံးစွဲပါ',
        helpDownload: 'သင့်ဖုန်း App Store မှ Outline ကို ဒေါင်းလုဒ်လုပ်ပါ',
        helpPurchase: 'အစီအစဥ်ရွေး၊ ဆာဗာရွေး၊ ငွေပေးချေပါ',
        helpSetup: 'Access key ကူးယူပါ သို့မဟုတ် QR code ကို Outline တွင် စကင်န်ပါ',
        helpConnect: 'ချိတ်ဆက်မှုကို ဖွင့်ပြီး လုံခြုံသော အင်တာနက်ကို သုံးစွဲပါ'
    },
    zh: {
        welcome: '🌐 欢迎！请选择您的语言：',
        selectPlan: '📦 选择您的套餐：',
        paymentInfo: '💸 付款信息',
        paymentProof: '请上传您的付款凭证截图：',
        paymentReceived: '已收到付款！正在处理您的VPN访问权限...',
        approved: '🎉 付款已审核通过！',
        accessDetails: '🔑 您的VPN访问详情：',
        vault: '🔐 您的数字自由已解锁！欢迎享受安全浏览。',
        bonus: '🎁 奖励：分享赚取！',
        mainMenu: '🏠 主菜单',
        myPlan: '📊 我的套餐',
        support: '💬 客服支持',
        selectServer: '🌍 选择您的服务器配置：',
        fullUS: '全美国服务器',
        fullSG: '全新加坡服务器',
        combined: '组合（各50%分配）',
        helpTitle: '📖 完整设置指南',
        helpStep1: '🔽 步骤1：下载Outline应用',
        helpStep2: '💳 步骤2：购买VPN套餐',
        helpStep3: '🔑 步骤3：设置您的VPN',
        helpStep4: '🌐 步骤4：连接并浏览',
        helpDownload: '从您的设备应用商店下载Outline',
        helpPurchase: '选择套餐，选择服务器，完成付款',
        helpSetup: '复制访问密钥或在Outline应用中扫描二维码',
        helpConnect: '开启连接并享受安全浏览'
    }
};

let userLanguages = new Map();

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!users.has(userId)) {
        users.set(userId, {
            id: userId,
            username: msg.from.username,
            firstName: msg.from.first_name,
            joinDate: new Date()
        });
    }

    showLanguageSelection(chatId);
});



function showLanguageSelection(chatId, showBackButton = false) {
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🇺🇸 English', callback_data: 'lang_en' },
                { text: '🇲🇲 Myanmar', callback_data: 'lang_mm' }
            ],
            [
                { text: '🇨🇳 中文', callback_data: 'lang_zh' }
            ]
        ]
    };

    if (showBackButton) {
        keyboard.inline_keyboard.push([
            { text: '🔙 Back', callback_data: 'main_menu' }
        ]);
    }

    bot.sendMessage(chatId, '🌐 Welcome! Choose your language:\n🌐 ကြိုဆိုပါတယ်! ဘာသာစကားရွေးချယ်ပါ:\n🌐 欢迎！请选择您的语言：', {
        reply_markup: keyboard
    });
}



function showMainMenu(chatId, lang = 'en') {
    const text = languages[lang];
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📦 Choose Plan', callback_data: 'show_plans' },
                { text: text.myPlan, callback_data: 'my_plan' }
            ],
            [
                { text: text.support, callback_data: 'support' },
                { text: '🌐 Language', callback_data: 'change_language' }
            ]
        ]
    };

    bot.sendMessage(chatId, text.mainMenu, { reply_markup: keyboard });
}

function showPlans(chatId, lang = 'en') {
    const text = languages[lang];
    const keyboard = {
        inline_keyboard: [
            [
                { text: `🟢 ${plans.mini_30.name} - 30 Days`, callback_data: 'plan_mini_30' },
                { text: `🟢 ${plans.mini_90.name} - 90 Days`, callback_data: 'plan_mini_90' }
            ],
            [
                { text: `🔵 ${plans.power_30.name} - 30 Days`, callback_data: 'plan_power_30' },
                { text: `🔵 ${plans.power_90.name} - 90 Days`, callback_data: 'plan_power_90' }
            ],
            [
                { text: `🔴 ${plans.ultra_30.name} - 30 Days`, callback_data: 'plan_ultra_30' },
                { text: `🔴 ${plans.ultra_90.name} - 90 Days (Most Popular)`, callback_data: 'plan_ultra_90' }
            ],
            [
                { text: '🔙 Back', callback_data: 'main_menu' }
            ]
        ]
    };

    let planDetails = `🔐 ${text.selectPlan}\n\n`;
    planDetails += `🟢 **Mini Vault**\n`;
    planDetails += `• 100GB • 30 Days - ${plans.mini_30.price} MMK\n`;
    planDetails += `• 100GB • 90 Days - ${plans.mini_90.price} MMK\n\n`;
    planDetails += `🔵 **Power Vault**\n`;
    planDetails += `• 300GB • 30 Days - ${plans.power_30.price} MMK\n`;
    planDetails += `• 300GB • 90 Days - ${plans.power_90.price} MMK\n\n`;
    planDetails += `🔴 **Ultra Vault (Most Popular)**\n`;
    planDetails += `• 500GB • 30 Days - ${plans.ultra_30.price} MMK\n`;
    planDetails += `• 500GB • 90 Days - ${plans.ultra_90.price} MMK`;

    bot.sendMessage(chatId, planDetails, { 
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

function showServerSelection(chatId, planKey, lang = 'en') {
    const text = languages[lang];
    const plan = plans[planKey];

    const keyboard = {
        inline_keyboard: [
            [
                { text: `🇺🇸 ${text.fullUS} (${plan.gb}GB)`, callback_data: `server_us_${planKey}` }
            ],
            [
                { text: `🇸🇬 ${text.fullSG} (${plan.gb}GB)`, callback_data: `server_sg_${planKey}` }
            ],
            [
                { text: `🌍 ${text.combined} (${plan.gb/2}GB each)`, callback_data: `server_combined_${planKey}` }
            ],
            [
                { text: '🔙 Back to Plans', callback_data: 'show_plans' }
            ]
        ]
    };

    const serverText = `${text.selectServer}\n\n📦 **${plan.name}** - ${plan.gb}GB Total\n\n🇺🇸 **US Server**: Fast speeds for Americas\n🇸🇬 **SG Server**: Fast speeds for Asia-Pacific\n🌍 **Combined**: Best of both worlds`;

    bot.sendMessage(chatId, serverText, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

function showPaymentOptions(chatId, planKey, serverConfig, lang = 'en') {
    const text = languages[lang];
    const plan = plans[planKey];
    const paymentId = uuidv4();

    pendingPayments.set(paymentId, {
        userId: chatId,
        plan: planKey,
        serverConfig: serverConfig,
        amount: plan.price,
        timestamp: new Date()
    });

    const keyboard = {
        inline_keyboard: [
            [
                { text: '💳 KPay', callback_data: `payment_kpay_${paymentId}` },
                { text: '🌊 Wave', callback_data: `payment_wave_${paymentId}` }
            ],
            [
                { text: '🔙 Back to Server Selection', callback_data: `plan_${planKey}` }
            ]
        ]
    };

    let serverInfo = '';
    if (serverConfig === 'us') {
        serverInfo = `🇺🇸 US Server - ${plan.gb}GB`;
    } else if (serverConfig === 'sg') {
        serverInfo = `🇸🇬 SG Server - ${plan.gb}GB`;
    } else {
        serverInfo = `🌍 Combined - ${plan.gb/2}GB US + ${plan.gb/2}GB SG`;
    }

    const paymentText = `${text.paymentInfo}\n\n📦 **${plan.name}**\n🌍 **Server**: ${serverInfo}\n💰 **Amount**: ${plan.price} MMK\n📱 **Duration**: ${plan.duration} days\n\nChoose payment method:`;

    bot.sendMessage(chatId, paymentText, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

function showPaymentDetails(chatId, method, paymentId, lang = 'en') {
    const text = languages[lang];
    const payment = pendingPayments.get(paymentId);

    if (!payment) {
        bot.sendMessage(chatId, '❌ Payment session expired. Please start a new payment.');
        showPlans(chatId, lang);
        return;
    }

    const plan = plans[payment.plan];

    if (!plan) {
        bot.sendMessage(chatId, '❌ Invalid plan. Please select a valid plan.');
        showPlans(chatId, lang);
        return;
    }

    const keyboard = {
        inline_keyboard: [
            [
                { text: '📸 Upload Payment Proof', callback_data: `upload_${paymentId}` }
            ],
            [
                { text: '🔙 Back', callback_data: 'show_plans' }
            ]
        ]
    };

    const phoneNumber = method === 'kpay' ? process.env.KPAY_NUMBER : process.env.WAVE_NUMBER;
    const methodName = method === 'kpay' ? 'KPay' : 'Wave';

    const paymentDetails = `💳 **${methodName} Payment**\n\n📞 **Phone**: ${phoneNumber}\n💰 **Amount**: ${plan.price} MMK\n📦 **Plan**: ${plan.name}\n🆔 **Reference**: ${paymentId.slice(-8)}\n\n${text.paymentProof}`;

    bot.sendMessage(chatId, paymentDetails, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

async function generateVPNAccess(userId, plan, serverConfig) {
    const axios = require('axios');
    const configs = [];

    // Outline Management API endpoints
    const outlineServers = {
        us: 'https://154.53.57.223:32987/W6Si53JA7hsJXZqMLsztAg',
        sg: 'https://154.26.138.68:7127/h6bsFmcBWyN8O_0i6BBJiw'
    };

    // Configure axios to ignore SSL certificate errors (for self-signed certs)
    const axiosConfig = {
        timeout: 10000,
        httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: false
        })
    };

    // Helper function to set data limit for a key
    async function setDataLimit(serverUrl, keyId, limitBytes) {
        try {
            await axios.put(`${serverUrl}/access-keys/${keyId}/data-limit`, {
                limit: { bytes: limitBytes }
            }, axiosConfig);
            console.log(`Data limit set for key ${keyId}: ${limitBytes} bytes (${limitBytes/1024/1024/1024}GB)`);
        } catch (error) {
            console.error(`Error setting data limit for key ${keyId}:`, error.message);
        }
    }

    try {
        if (serverConfig === 'us') {
            const response = await axios.post(`${outlineServers.us}/access-keys`, {
                name: `VPN_${plan.name}_US_${userId}`
            }, axiosConfig);

            // Set data limit (GB to bytes conversion)
            const limitBytes = plan.gb * 1024 * 1024 * 1024;
            await setDataLimit(outlineServers.us, response.data.id, limitBytes);

            configs.push({ 
                server: 'US', 
                accessKey: response.data.accessUrl, 
                gb: plan.gb,
                keyId: response.data.id
            });
        } else if (serverConfig === 'sg') {
            const response = await axios.post(`${outlineServers.sg}/access-keys`, {
                name: `VPN_${plan.name}_SG_${userId}`
            }, axiosConfig);

            // Set data limit (GB to bytes conversion)
            const limitBytes = plan.gb * 1024 * 1024 * 1024;
            await setDataLimit(outlineServers.sg, response.data.id, limitBytes);

            configs.push({ 
                server: 'SG', 
                accessKey: response.data.accessUrl, 
                gb: plan.gb,
                keyId: response.data.id
            });
        } else { // combined
            // Create US key
            const usResponse = await axios.post(`${outlineServers.us}/access-keys`, {
                name: `VPN_${plan.name}_US_${userId}`
            }, axiosConfig);

            // Create SG key
            const sgResponse = await axios.post(`${outlineServers.sg}/access-keys`, {
                name: `VPN_${plan.name}_SG_${userId}`
            }, axiosConfig);

            // Set data limits for both servers (half the total for each)
            const limitBytesPerServer = (plan.gb / 2) * 1024 * 1024 * 1024;
            await setDataLimit(outlineServers.us, usResponse.data.id, limitBytesPerServer);
            await setDataLimit(outlineServers.sg, sgResponse.data.id, limitBytesPerServer);

            configs.push({ 
                server: 'US', 
                accessKey: usResponse.data.accessUrl, 
                gb: plan.gb / 2,
                keyId: usResponse.data.id
            });
            configs.push({ 
                server: 'SG', 
                accessKey: sgResponse.data.accessUrl, 
                gb: plan.gb / 2,
                keyId: sgResponse.data.id
            });
        }

        const qrBuffers = [];
        for (const config of configs) {
            const qrBuffer = await QRCode.toBuffer(config.accessKey);
            qrBuffers.push({ server: config.server, qrBuffer, gb: config.gb });
        }

        return { configs, qrBuffers };

    } catch (error) {
        console.error('Error creating VPN access keys:', error.message);
        throw new Error('Failed to create VPN access keys. Please contact support.');
    }
}

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;

    const lang = userLanguages.get(userId) || 'en';
    const text = languages[lang];

    if (data.startsWith('lang_')) {
        const selectedLang = data.split('_')[1];
        userLanguages.set(userId, selectedLang);
        bot.editMessageText(text.welcome, {
            chat_id: chatId,
            message_id: msg.message_id
        });
        setTimeout(() => showMainMenu(chatId, selectedLang), 1000);
    }

    if (data === 'main_menu') {
        showMainMenu(chatId, lang);
    }

    if (data === 'show_plans') {
        showPlans(chatId, lang);
    }

    if (data === 'change_language') {
        showLanguageSelection(chatId, true);
    }



    if (data.startsWith('plan_')) {
        const planKey = data.substring(5); // Remove 'plan_' prefix
        showServerSelection(chatId, planKey, lang);
    }

    if (data.startsWith('server_')) {
        const parts = data.split('_');
        const serverConfig = parts[1];
        const planKey = parts.slice(2).join('_'); // Handle plan keys with underscores
        showPaymentOptions(chatId, planKey, serverConfig, lang);
    }

    if (data.startsWith('payment_')) {
        const parts = data.split('_');
        const method = parts[1];
        const paymentId = parts[2];
        showPaymentDetails(chatId, method, paymentId, lang);
    }

    if (data.startsWith('upload_')) {
        const paymentId = data.split('_')[1];
        const payment = pendingPayments.get(paymentId);

        if (!payment) {
            bot.sendMessage(chatId, '❌ Payment session expired. Please start a new payment.');
            showPlans(chatId, lang);
            return;
        }

        bot.sendMessage(chatId, text.paymentProof);
        console.log(`Waiting for payment proof from user ${chatId} for payment ${paymentId}`);

        // Set up photo listener for this specific payment
        const photoListener = async (photoMsg) => {
            if (photoMsg.chat.id === chatId && photoMsg.photo) {
                bot.sendMessage(chatId, '✅ Payment proof received! Your payment is being reviewed by our team. You will be notified once approved.');

                const payment = pendingPayments.get(paymentId);
                if (!payment) {
                    bot.sendMessage(chatId, '❌ Payment session expired. Please contact support.');
                    bot.removeListener('photo', photoListener);
                    return;
                }
                const plan = plans[payment.plan];

                let serverInfo = '';
                if (payment.serverConfig === 'us') {
                    serverInfo = `🇺🇸 US Server - ${plan.gb}GB`;
                } else if (payment.serverConfig === 'sg') {
                    serverInfo = `🇸🇬 SG Server - ${plan.gb}GB`;
                } else {
                    serverInfo = `🌍 Combined - ${plan.gb/2}GB US + ${plan.gb/2}GB SG`;
                }

                // Log payment for record keeping
                console.log('PAYMENT AWAITING APPROVAL:', {
                    paymentId,
                    userId: photoMsg.from.id,
                    username: photoMsg.from.username,
                    plan: plan.name,
                    amount: plan.price,
                    server: serverInfo,
                    timestamp: new Date().toISOString()
                });

                // Send to admin for approval
                const adminKeyboard = {
                    inline_keyboard: [
                        [
                            { text: '✅ Approve', callback_data: `approve_${paymentId}` },
                            { text: '❌ Reject', callback_data: `reject_${paymentId}` }
                        ]
                    ]
                };

                const adminMessage = `🔔 **New Payment for Review**\n\n👤 **User:** ${photoMsg.from.first_name} (@${photoMsg.from.username || 'No username'})\n🆔 **User ID:** ${photoMsg.from.id}\n📦 **Plan:** ${plan.name}\n🌍 **Server:** ${serverInfo}\n💰 **Amount:** ${plan.price} MMK\n🔑 **Payment ID:** ${paymentId}\n📅 **Time:** ${new Date().toLocaleString()}\n\nReview the payment proof and approve/reject:`;

                // Forward the photo to admin
                bot.forwardMessage(process.env.ADMIN_ID, chatId, photoMsg.message_id);

                // Send admin the payment details
                bot.sendMessage(process.env.ADMIN_ID, adminMessage, {
                    reply_markup: adminKeyboard,
                    parse_mode: 'Markdown'
                });

                // Remove the listener
                bot.removeListener('photo', photoListener);
            }
        };

        bot.on('photo', photoListener);
    }

    // Admin approval handling
    if (data.startsWith('approve_')) {
        const paymentId = data.split('_')[1];
        const payment = pendingPayments.get(paymentId);

        console.log('Admin approval attempt:', {
            paymentId,
            fromUserId: callbackQuery.from.id,
            adminId: process.env.ADMIN_ID,
            paymentExists: !!payment,
            isAdmin: callbackQuery.from.id.toString() === process.env.ADMIN_ID
        });

        if (payment && callbackQuery.from.id.toString() === process.env.ADMIN_ID) {
            const userLang = userLanguages.get(payment.userId) || 'en';
            console.log('Processing approval for payment:', paymentId);
            await approvePayment(payment.userId, paymentId, userLang);

            bot.editMessageText(`✅ **Payment Approved**\n\nPayment ID: ${paymentId}\nUser: ${payment.userId}\nProcessed successfully!`, {
                chat_id: chatId,
                message_id: msg.message_id,
                parse_mode: 'Markdown'
            });
        } else {
            console.log('Admin approval denied - not authorized or payment not found');
            bot.sendMessage(chatId, '❌ Authorization failed or payment not found');
        }
    }

    // Admin rejection handling
    if (data.startsWith('reject_')) {
        const paymentId = data.split('_')[1];
        const payment = pendingPayments.get(paymentId);

        console.log('Admin rejection attempt:', {
            paymentId,
            fromUserId: callbackQuery.from.id,
            adminId: process.env.ADMIN_ID,
            paymentExists: !!payment,
            isAdmin: callbackQuery.from.id.toString() === process.env.ADMIN_ID
        });

        if (payment && callbackQuery.from.id.toString() === process.env.ADMIN_ID) {
            const userLang = userLanguages.get(payment.userId) || 'en';
            const userText = languages[userLang];

            bot.sendMessage(payment.userId, `❌ Payment rejected. Please contact support for assistance.\n❌ ငွေပေးချေမှုကို ငြင်းပယ်ခဲ့သည်။ အကူအညီအတွက် ဆက်သွယ်ပါ။\n❌ 付款被拒绝。请联系客服寻求帮助。`);

            bot.editMessageText(`❌ **Payment Rejected**\n\nPayment ID: ${paymentId}\nUser: ${payment.userId}\nReason: Manual rejection by admin`, {
                chat_id: chatId,
                message_id: msg.message_id,
                parse_mode: 'Markdown'
            });

            pendingPayments.delete(paymentId);
        } else {
            console.log('Admin rejection denied - not authorized or payment not found');
            bot.sendMessage(chatId, '❌ Authorization failed or payment not found');
        }
    }

    if (data === 'my_plan') {
        const userPlan = activePlans.get(userId);
        if (userPlan) {
            let planInfo = `📊 **Your Active Plan**\n\n📦 Plan: ${userPlan.planName}\n📱 Expires: ${userPlan.expiryDate.toDateString()}\n🔗 Status: Active\n\n`;

            if (userPlan.configs) {
                planInfo += '🌍 **Server Access:**\n';
                userPlan.configs.forEach(config => {
                    planInfo += `${config.server === 'US' ? '🇺🇸' : '🇸🇬'} ${config.server}: ${config.gb}GB\n`;
                });
            }

            bot.sendMessage(chatId, planInfo, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, 'No active plan found. Please purchase a plan first.');
        }
    }

    if (data === 'support') {
        bot.sendMessage(chatId, '💬 **Support Contact**\n\nTelegram: @yoursupport\nEmail: support@yourvpn.com\nResponse time: 24 hours', { parse_mode: 'Markdown' });
    }



    bot.answerCallbackQuery(callbackQuery.id);
});

async function approvePayment(chatId, paymentId, lang) {
    const text = languages[lang];
    const payment = pendingPayments.get(paymentId);
    const plan = plans[payment.plan];

    // Generate VPN access
    const { configs, qrBuffers } = await generateVPNAccess(payment.userId, plan, payment.serverConfig);

    // Add to active plans
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + plan.duration);

    activePlans.set(payment.userId, {
        planName: plan.name,
        expiryDate: expiryDate,
        serverConfig: payment.serverConfig,
        configs: configs
    });

    // 1. Send approval message
    bot.sendMessage(chatId, text.approved);

    // 2. Send access details for each server
    for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        const qrData = qrBuffers[i];

        const accessMessage = `${text.accessDetails}\n\n🌍 **${config.server} Server**\n📱 **Expires:** ${expiryDate.toDateString()}\n📊 **Data Limit:** ${config.gb}GB\n\n👇 **Copy your access key below:**`;

        bot.sendMessage(chatId, accessMessage, { parse_mode: 'Markdown' });

        // 3. Send access key in a separate copyable message
        bot.sendMessage(chatId, config.accessKey);

        // 4. Send QR code
        bot.sendPhoto(chatId, qrData.qrBuffer, { 
            caption: `${config.server === 'US' ? '🇺🇸' : '🇸🇬'} ${config.server} Server QR Code - ${config.gb}GB\nScan with your VPN app` 
        });
    }

    // 5. Send bonus info
    const bonusMessage = `${text.bonus}\n\n🔗 Invite friends: t.me/yourvpnbot?start=ref_${payment.userId}\n💰 Earn 5GB for each successful referral!\n📊 Your referrals: 0`;
    bot.sendMessage(chatId, bonusMessage);

    // Clean up
    pendingPayments.delete(paymentId);
}

// Bot startup with aggressive conflict resolution
async function startBot(retryCount = 0) {
    try {
        console.log(`🤖 Starting bot (attempt ${retryCount + 1})...`);
        
        // Force stop any existing polling first
        try {
            console.log('🛑 Force stopping any existing polling...');
            bot.stopPolling({ cancel: true, reason: 'Restart' });
        } catch (e) {
            console.log('No existing polling to stop');
        }
        
        // Clear webhooks aggressively
        console.log('🧹 Clearing webhooks...');
        try {
            await bot.deleteWebHook({ drop_pending_updates: true });
            console.log('✅ Webhook cleared successfully');
        } catch (webhookError) {
            console.log('⚠️ Webhook clear failed:', webhookError.message);
        }
        
        // Wait progressively longer on retries
        const waitTime = Math.min(10000 + (retryCount * 5000), 30000);
        console.log(`⏳ Waiting ${waitTime/1000}s for complete cleanup...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Test connection first
        console.log('🔍 Testing bot connection...');
        const me = await bot.getMe();
        console.log(`✅ Bot connected: @${me.username}`);
        
        console.log('🚀 Starting bot polling...');
        await bot.startPolling({ 
            restart: true,
            polling: {
                interval: 2000, // Slower polling to avoid conflicts
                autoStart: false
            }
        });
        console.log('✅ Bot polling started successfully!');
        
        // Reset retry count on success
        startBot.retryCount = 0;
        
    } catch (error) {
        console.error('❌ Error starting bot:', error.message);
        
        if (retryCount < 5) { // Max 5 retries
            const nextRetry = Math.min(15000 + (retryCount * 10000), 60000);
            console.log(`🔄 Retrying in ${nextRetry/1000} seconds... (${retryCount + 1}/5)`);
            setTimeout(() => startBot(retryCount + 1), nextRetry);
        } else {
            console.error('🚫 Max retries reached. Bot startup failed.');
            console.log('💡 Try running: pkill -f "node index.js" then restart');
        }
    }
}

// Improved error handling with exponential backoff
let errorCount = 0;
bot.on('polling_error', (error) => {
    errorCount++;
    console.error(`⚠️ Polling error #${errorCount}:`, error.message);
    
    if (error.code === 'ETELEGRAM' && error.response?.statusCode === 409) {
        console.log('🚫 409 Conflict detected - another bot instance is running');
        console.log('⏸️ Stopping current instance...');
        
        try {
            bot.stopPolling({ cancel: true, reason: 'Conflict resolution' });
        } catch (stopError) {
            console.log('Stop polling error:', stopError.message);
        }
        
        // Exponential backoff for conflicts
        const backoffTime = Math.min(30000 * Math.pow(2, Math.min(errorCount - 1, 3)), 300000); // Max 5 minutes
        console.log(`⏳ Waiting ${backoffTime/1000}s before restart (backoff)...`);
        
        setTimeout(() => {
            console.log('🔄 Attempting restart after conflict...');
            startBot(errorCount);
        }, backoffTime);
        
    } else if (error.code === 'ETELEGRAM' && error.response?.statusCode === 429) {
        // Rate limiting
        const retryAfter = error.response?.parameters?.retry_after || 60;
        console.log(`🐌 Rate limited. Waiting ${retryAfter}s...`);
        setTimeout(() => startBot(), retryAfter * 1000);
        
    } else {
        console.log('🔄 Restarting due to other polling error...');
        setTimeout(() => startBot(errorCount), 10000);
    }
    
    // Reset error count after successful periods
    setTimeout(() => {
        if (errorCount > 0) {
            errorCount = Math.max(0, errorCount - 1);
        }
    }, 60000); // Reduce error count every minute
});

bot.on('webhook_error', (error) => {
    console.error('Webhook error:', error);
});

// Menu command
bot.onText(/\/menu/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const lang = userLanguages.get(userId) || 'en';

    showMainMenu(chatId, lang);
});

// Plans command
bot.onText(/\/plans/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const lang = userLanguages.get(userId) || 'en';

    showPlans(chatId, lang);
});

// My Plan command
bot.onText(/\/myplan/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const lang = userLanguages.get(userId) || 'en';

    const userPlan = activePlans.get(userId);
    if (userPlan) {
        let planInfo = `📊 **Your Active Plan**\n\n📦 Plan: ${userPlan.planName}\n📱 Expires: ${userPlan.expiryDate.toDateString()}\n🔗 Status: Active\n\n`;

        if (userPlan.configs) {
            planInfo += '🌍 **Server Access:**\n';
            userPlan.configs.forEach(config => {
                planInfo += `${config.server === 'US' ? '🇺🇸' : '🇸🇬'} ${config.server}: ${config.gb}GB\n`;
            });
        }

        bot.sendMessage(chatId, planInfo, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, 'No active plan found. Use /plans to purchase a plan first.');
    }
});

// Support command
bot.onText(/\/support/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '💬 **Support Contact**\n\nTelegram: @yoursupport\nEmail: support@yourvpn.com\nResponse time: 24 hours', { parse_mode: 'Markdown' });
});

// Language command
bot.onText(/\/lang/, (msg) => {
    const chatId = msg.chat.id;
    showLanguageSelection(chatId, true);
});

// Debug command to clear webhooks (remove after fixing)
bot.onText(/\/clearwebhook/, async (msg) => {
    const chatId = msg.chat.id;
    if (msg.from.id.toString() === process.env.ADMIN_ID) {
        try {
            await bot.deleteWebHook();
            bot.sendMessage(chatId, '✅ Webhook cleared successfully!');
        } catch (error) {
            bot.sendMessage(chatId, `❌ Error clearing webhook: ${error.message}`);
        }
    }
});

// Debug command for admin verification
bot.onText(/\/debug/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    console.log('Debug info:', {
        chatId,
        userId,
        adminId: process.env.ADMIN_ID,
        isAdmin: userId.toString() === process.env.ADMIN_ID,
        pendingPaymentsCount: pendingPayments.size
    });
    
    if (userId.toString() === process.env.ADMIN_ID) {
        bot.sendMessage(chatId, `🔧 **Admin Debug Info**\n\nYour ID: ${userId}\nAdmin ID: ${process.env.ADMIN_ID}\nMatch: ${userId.toString() === process.env.ADMIN_ID}\nPending Payments: ${pendingPayments.size}`, {
            parse_mode: 'Markdown'
        });
    } else {
        bot.sendMessage(chatId, 'Not authorized for debug info');
    }
});

// Help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const lang = userLanguages.get(userId) || 'en';
    const text = languages[lang];

    const helpMessage = `📖 **Complete Setup Guide**

🔽 **Step 1: Download Outline App**
${text.helpDownload}

💳 **Step 2: Purchase VPN Plan**
${text.helpPurchase}

🔑 **Step 3: Setup Your VPN**
${text.helpSetup}

🌐 **Step 4: Connect & Browse**
${text.helpConnect}

📱 **Download Links:**
• Android: Play Store → Search "Outline"
• iOS: App Store → Search "Outline"  
• Windows/Mac: getoutline.org

💡 **Need Help?** Use /support to contact us!

🤖 **Available Commands:**
/start - Start the bot
/menu - Main menu
/plans - View VPN plans
/myplan - Check active plan
/support - Contact support
/lang - Change language`;

    const helpKeyboard = {
        inline_keyboard: [
            [
                { text: '📱 Download Outline', url: 'https://getoutline.org/get-started/' }
            ],
            [
                { text: '📦 Choose Plan', callback_data: 'show_plans' }
            ],
            [
                { text: '🏠 Main Menu', callback_data: 'main_menu' }
            ]
        ]
    };

    bot.sendMessage(chatId, helpMessage, {
        reply_markup: helpKeyboard,
        parse_mode: 'Markdown'
    });
});

// Set up menu button
bot.setMyCommands([
    { command: 'start', description: 'Start the bot' },
    { command: 'menu', description: 'Main menu' },
    { command: 'help', description: 'Setup guide & help' },
    { command: 'plans', description: 'View all VPN plans' },
    { command: 'myplan', description: 'Check your active plan' },
    { command: 'support', description: 'Contact support' },
    { command: 'lang', description: 'Change language' }
]);

// Graceful shutdown handling
process.on('SIGINT', () => {
    console.log('Bot shutting down gracefully...');
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Bot terminated gracefully...');
    bot.stopPolling();
    process.exit(0);
});

// Initialize bot
console.log('🤖 VPN Bot initializing...');
console.log('📋 Available commands: /start /menu /help /plans /myplan /support /lang');
startBot();