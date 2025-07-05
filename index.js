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
const userPlans = new Map(); // Store user plans: userId -> { planKey, server, keys, purchaseDate, expiryDate, dataUsed }
const userLanguages = new Map(); // Store user's preferred language

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
            back: '🔙 Menu သို့ပြန်'
        }
    };

    const text = texts[lang];
    const planText = `${text.title}\n\n🟢 **Mini Vault**\n• 100GB • 30 Days - 3000 MMK\n• 100GB • 90 Days - 7000 MMK\n\n🔵 **Power Vault**\n• 300GB • 30 Days - 6000 MMK\n• 300GB • 90 Days - 13000 MMK\n\n🔴 **Ultra Vault**\n• 500GB • 30 Days - 8000 MMK *(Most Popular)*\n• 500GB • 90 Days - 17000 MMK`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🟢 Mini Vault - 30 Days', callback_data: `plan_mini_30_${lang}` },
                { text: '🟢 Mini Vault - 90 Days', callback_data: `plan_mini_90_${lang}` }
            ],
            [
                { text: '🔵 Power Vault - 30 Days', callback_data: `plan_power_30_${lang}` },
                { text: '🔵 Power Vault - 90 Days', callback_data: `plan_power_90_${lang}` }
            ],
            [
                { text: '🔴 Ultra Vault - 30 Days', callback_data: `plan_ultra_30_${lang}` },
                { text: '🔴 Ultra Vault - 90 Days', callback_data: `plan_ultra_90_${lang}` }
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
    const userPlan = userPlans.get(chatId);
    
    const texts = {
        en: {
            title: '👤 *My Plan Status*',
            noPlan: 'You don\'t have an active plan yet.\n\nClick "Choose Plan" to purchase a VPN plan.',
            plan: 'Plan',
            server: 'Server',
            dataLimit: 'Data Limit',
            purchased: 'Purchased',
            expires: 'Expires',
            status: 'Status',
            active: '✅ Active',
            expired: '❌ Expired',
            daysLeft: 'days left',
            back: '🔙 Back to Menu',
            buyMore: '📦 Buy More Plans'
        },
        cn: {
            title: '👤 *我的套餐状态*',
            noPlan: '您还没有激活的套餐。\n\n点击"选择套餐"来购买VPN套餐。',
            plan: '套餐',
            server: '服务器',
            dataLimit: '流量限制',
            purchased: '购买日期',
            expires: '到期日期',
            status: '状态',
            active: '✅ 有效',
            expired: '❌ 已过期',
            daysLeft: '天剩余',
            back: '🔙 返回菜单',
            buyMore: '📦 购买更多套餐'
        },
        mm: {
            title: '👤 *ကျွန်ုပ်၏ Plan အခြေအနေ*',
            noPlan: 'သင့်တွင် ရရှိနေသော Plan မရှိသေးပါ။\n\nVPN Planဝယ်ယူရန် "အစီအစဥ်ရွေးရန်" ကိုနှိပ်ပါ။',
            plan: 'Plan',
            server: 'Server',
            dataLimit: 'ဒေတာကန့်သတ်ချက်',
            purchased: 'ဝယ်ယူသည့်ရက်',
            expires: 'သက်တမ်းကုန်ရက်',
            status: 'အခြေအနေ',
            active: '✅ အသုံးပြုနိုင်',
            expired: '❌ သက်တမ်းကုန်',
            daysLeft: 'ရက်ကျန်',
            back: '🔙 Menu သို့ပြန်',
            buyMore: '📦 Package ထပ်ဝယ်'
        }
    };

    const text = texts[lang];
    
    if (!userPlan) {
        const keyboard = {
            inline_keyboard: [
                [{ text: text.buyMore, callback_data: `choose_plans_${lang}` }],
                [{ text: text.back, callback_data: `back_main_${lang}` }]
            ]
        };
        
        bot.sendMessage(chatId, `${text.title}\n\n${text.noPlan}`, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        return;
    }

    const plan = plans[userPlan.planKey];
    const now = new Date();
    const isActive = now < userPlan.expiryDate;
    const daysLeft = Math.ceil((userPlan.expiryDate - now) / (1000 * 60 * 60 * 24));
    
    let serverText = '';
    if (userPlan.server === 'us') {
        serverText = '🇺🇸 US Server';
    } else if (userPlan.server === 'sg') {
        serverText = '🇸🇬 SG Server';
    } else {
        serverText = '🌐 Both Servers';
    }

    const statusText = isActive ? 
        `${text.active} (${daysLeft} ${text.daysLeft})` : 
        text.expired;

    const planText = `${text.title}\n\n📦 *${text.plan}:* ${plan.name}\n🌍 *${text.server}:* ${serverText}\n💾 *${text.dataLimit}:* ${plan.gb}GB\n📅 *${text.purchased}:* ${userPlan.purchaseDate.toLocaleDateString()}\n⏰ *${text.expires}:* ${userPlan.expiryDate.toLocaleDateString()}\n📊 *${text.status}:* ${statusText}`;

    const keyboard = {
        inline_keyboard: [
            [{ text: text.buyMore, callback_data: `choose_plans_${lang}` }],
            [{ text: text.back, callback_data: `back_main_${lang}` }]
        ]
    };
    
    bot.sendMessage(chatId, planText, {
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
    
    const halfData = plan.gb / 2;
    const keyboard = {
        inline_keyboard: [
            [{ text: `🇺🇸 US Server (${plan.gb}GB)`, callback_data: `srv_us_${planKey}_${lang}` }],
            [{ text: `🇸🇬 SG Server (${plan.gb}GB)`, callback_data: `srv_sg_${planKey}_${lang}` }],
            [{ text: `🌐 Both Servers (${halfData}GB each)`, callback_data: `srv_both_${planKey}_${lang}` }],
            [{ text: text.back, callback_data: `back_plans_${lang}` }]
        ]
    };

    bot.sendMessage(chatId, planText, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

// Show payment method selection
function showPaymentMethods(chatId, server, planKey, lang = 'en') {
    const plan = plans[planKey];
    
    let serverText = '';
    let dataDetails = '';
    
    if (server === 'us') {
        serverText = '🇺🇸 *US Server* - Fast speeds for Americas';
        dataDetails = `💾 *Data:* ${plan.gb}GB (US Server only)`;
    } else if (server === 'sg') {
        serverText = '🇸🇬 *SG Server* - Fast speeds for Asia-Pacific';
        dataDetails = `💾 *Data:* ${plan.gb}GB (SG Server only)`;
    } else {
        const halfData = plan.gb / 2;
        serverText = '🌐 *Both Servers* - Best of both worlds';
        dataDetails = `💾 *Data Distribution:*\n   • 🇺🇸 US Server: ${halfData}GB\n   • 🇸🇬 SG Server: ${halfData}GB\n   • *Total:* ${plan.gb}GB`;
    }

    const texts = {
        en: {
            title: '💳 *Choose Payment Method*',
            back: '🔙 Back to Servers'
        },
        cn: {
            title: '💳 *选择支付方式*',
            back: '🔙 返回服务器'
        },
        mm: {
            title: '💳 *ငွေပေးချေမှုနည်းလမ်းရွေးချယ်ပါ*',
            back: '🔙 ဆာဗာများသို့ပြန်'
        }
    };

    const text = texts[lang];
    const paymentText = `${text.title}\n\n${serverText}\n📦 *Plan:* ${plan.name}\n${dataDetails}\n💰 *Amount:* ${plan.price} MMK\n\nSelect your preferred payment method:`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📱 KPay', callback_data: `pay_kpay_${server}_${planKey}_${lang}` },
                { text: '🌊 Wave Pay', callback_data: `pay_wave_${server}_${planKey}_${lang}` }
            ],
            [
                { text: '🏦 Bank Transfer & Others', callback_data: `pay_bank_${server}_${planKey}_${lang}` }
            ],
            [{ text: text.back, callback_data: `plan_${planKey}_${lang}` }]
        ]
    };

    bot.sendMessage(chatId, paymentText, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

// Show payment details for selected method
function showPaymentDetails(chatId, paymentMethod, server, planKey, lang = 'en') {
    const plan = plans[planKey];
    const uid = uuidv4();
    pendingProofs.set(uid, { id: chatId, server, planKey, paymentMethod, timestamp: new Date() });

    let serverText = '';
    let dataDetails = '';
    
    if (server === 'us') {
        serverText = '🇺🇸 *US Server* - Fast speeds for Americas';
        dataDetails = `💾 *Data:* ${plan.gb}GB (US Server only)`;
    } else if (server === 'sg') {
        serverText = '🇸🇬 *SG Server* - Fast speeds for Asia-Pacific';
        dataDetails = `💾 *Data:* ${plan.gb}GB (SG Server only)`;
    } else {
        const halfData = plan.gb / 2;
        serverText = '🌐 *Both Servers* - Best of both worlds';
        dataDetails = `💾 *Data Distribution:*\n   • 🇺🇸 US Server: ${halfData}GB\n   • 🇸🇬 SG Server: ${halfData}GB\n   • *Total:* ${plan.gb}GB`;
    }

    // Payment method details
    const paymentMethods = {
        kpay: { name: '📱 KPay', number: '09760301586', holder: 'Win Thuzar' },
        wave: { name: '🌊 Wave Pay', number: '09760301586', holder: 'Zar Zar Phoo' },
        bank: { name: '🏦 Bank Transfer & Others', contact: true }
    };

    const selectedMethod = paymentMethods[paymentMethod];
    let paymentInfo = '';
    let paymentText = '';
    
    if (selectedMethod.contact) {
        // Special handling for bank transfer and other methods
        paymentText = `🏦 *Bank Transfer & Other Payment Methods*\n\n${serverText}\n📦 *Plan:* ${plan.name}\n${dataDetails}\n💰 *Amount:* ${plan.price} MMK\n\n💬 *Contact Admin for Payment Details:*\n📱 **Telegram:** @edenvault\\_88\n📧 **Email:** edenvault888@gmail.com\n\n📋 *Available Methods:*\n• Bank Transfer\n• International Transfer\n• Cryptocurrency\n• Other digital wallets\n\n🆔 *Reference:* ${uid.slice(-8)}\n\n*Please contact admin first before making payment*`;
    } else {
        paymentInfo = `${selectedMethod.name}\n📱 *Number:* ${selectedMethod.number}`;
        if (selectedMethod.holder) {
            paymentInfo += `\n👤 *Account Name:* ${selectedMethod.holder}`;
        }
        paymentText = `💳 *Payment Required*\n\n${serverText}\n📦 *Plan:* ${plan.name}\n${dataDetails}\n💰 *Amount:* ${plan.price} MMK\n\n${paymentInfo}\n🆔 *Reference:* ${uid.slice(-8)}\n\nAfter payment, upload your screenshot:`;
    }
    
    let keyboard;
    if (selectedMethod.contact) {
        keyboard = {
            inline_keyboard: [
                [{ text: '💬 Contact Admin', url: 'https://t.me/edenvault_88' }],
                [{ text: '📤 Upload Payment Proof', callback_data: `proof_${uid}` }],
                [{ text: '🔙 Back to Payment Methods', callback_data: `srv_${server}_${planKey}_${lang}` }]
            ]
        };
    } else {
        keyboard = {
            inline_keyboard: [
                [{ text: '📤 Upload Payment Proof', callback_data: `proof_${uid}` }],
                [{ text: '🔙 Back to Payment Methods', callback_data: `srv_${server}_${planKey}_${lang}` }]
            ]
        };
    }

    bot.sendMessage(chatId, paymentText, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

// Handle payment proof upload
function handlePaymentProof(chatId, uid) {
    const proof = pendingProofs.get(uid);
    const userLang = userLanguages.get(chatId) || 'en';

    const texts = {
        en: {
            expired: '❌ Payment session expired. Please start a new payment.',
            upload: '📸 Please send your payment screenshot now.\n⏰ You have 5 minutes to upload.'
        },
        cn: {
            expired: '❌ 支付会话已过期。请重新开始新的支付。',
            upload: '📸 请现在发送您的付款截图。\n⏰ 您有5分钟时间上传。'
        },
        mm: {
            expired: '❌ ငွေပေးချေမှု session သက်တမ်းကုန်သွားပါပြီ။ ငွေပေးချေမှုအသစ်စတင်ပါ။',
            upload: '📸 သင့်ငွေပေးချေမှုဓာတ်ပုံကို ယခုပေးပို့ပါ။\n⏰ တင်ရန် ၅မိနစ်အချိန်ရှိပါသည်။'
        }
    };

    if (!proof) {
        bot.sendMessage(chatId, texts[userLang].expired);
        return;
    }

    bot.sendMessage(chatId, texts[userLang].upload);

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
    const userLang = userLanguages.get(chatId) || 'en';
    
    const confirmTexts = {
        en: '✅ Payment proof received! Your payment is being reviewed by our team.\n⏱️ Approval usually takes 5-30 minutes.',
        cn: '✅ 收到付款凭证！我们的团队正在审核您的付款。\n⏱️ 通常需要5-30分钟进行批准。',
        mm: '✅ ငွေပေးချေမှုအထောက်အထားရရှိပါပြီ! ကျွန်ုပ်တို့အဖွဲ့မှ သင့်ငွေပေးချေမှုကို စစ်ဆေးနေပါသည်။\n⏱️ များသောအားဖြင့် ၅-၃၀ မိနစ်ကြာပါသည်။'
    };
    
    bot.sendMessage(chatId, confirmTexts[userLang]);

    let serverInfo = '';
    if (proof.server === 'us') {
        serverInfo = `🇺🇸 US Server - ${plan.gb}GB`;
    } else if (proof.server === 'sg') {
        serverInfo = `🇸🇬 SG Server - ${plan.gb}GB`;
    } else {
        serverInfo = `🌐 Both Servers - ${plan.gb/2}GB each`;
    }

    const paymentMethods = {
        kpay: '📱 KPay',
        wave: '🌊 Wave Pay',
        bank: '🏦 Bank Transfer & Others'
    };

    const methodName = paymentMethods[proof.paymentMethod] || 'Unknown';
    const adminText = `🔔 *New Payment for Review*\n\n👤 *User:* ${photoMsg.from.first_name} (@${photoMsg.from.username || 'No username'})\n🆔 *User ID:* ${chatId}\n📦 *Plan:* ${plan.name}\n🌍 *Server:* ${serverInfo}\n💳 *Payment Method:* ${methodName}\n💰 *Amount:* ${plan.price} MMK\n🔑 *Payment ID:* ${uid}\n📅 *Time:* ${new Date().toLocaleString()}\n\nReview and approve/reject:`;

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
    const userLang = userLanguages.get(userId) || 'en';
    
    const texts = {
        en: {
            approved: '🎉 *Payment Approved!*\n\nYour VPN access is ready! Download *Outline* app and use the keys below:',
            access: 'Server Access',
            dataLimit: 'Data Limit',
            qrCaption: 'Server QR Code - Scan with Outline app',
            instructions: '📱 *Setup Instructions:*\n\n1️⃣ Download *Outline* app from your app store\n2️⃣ Copy the access key or scan QR code\n3️⃣ Paste key in Outline app\n4️⃣ Connect and enjoy secure browsing!\n\n💬 *Support:* @edenvault\\_88\n📧 *Email:* edenvault888@gmail.com'
        },
        cn: {
            approved: '🎉 *付款已批准！*\n\n您的VPN访问已准备就绪！下载 *Outline* 应用并使用下面的密钥：',
            access: '服务器访问',
            dataLimit: '流量限制',
            qrCaption: '服务器二维码 - 使用Outline应用扫描',
            instructions: '📱 *设置说明：*\n\n1️⃣ 从应用商店下载 *Outline* 应用\n2️⃣ 复制访问密钥或扫描二维码\n3️⃣ 在Outline应用中粘贴密钥\n4️⃣ 连接并享受安全浏览！\n\n💬 *支持：* @edenvault\\_88\n📧 *邮箱：* edenvault888@gmail.com'
        },
        mm: {
            approved: '🎉 *ငွေပေးချေမှုအတည်ပြုပါပြီ！*\n\nသင့် VPN အသုံးပြုခွင့်အဆင်သင့်ဖြစ်ပါပြီ! *Outline* အက်ပ်ကို download လုပ်၍ အောက်ပါ keys များကိုအသုံးပြုပါ：',
            access: 'ဆာဗာအသုံးပြုခွင့်',
            dataLimit: 'ဒေတာကန့်သတ်ချက်',
            qrCaption: 'ဆာဗာ QR ကုဒ် - Outline အက်ပ်ဖြင့် scan လုပ်ပါ',
            instructions: '📱 *သတ်မှတ်ရန်လမ်းညွှန်များ：*\n\n1️⃣ သင့် app store မှ *Outline* အက်ပ်ကို download လုပ်ပါ\n2️⃣ access key ကို copy လုပ်ပါ သို့မဟုတ် QR code ကို scan လုပ်ပါ\n3️⃣ Outline အက်ပ်တွင် key ကို paste လုပ်ပါ\n4️⃣ ချိတ်ဆက်၍ လုံခြုံသော browsing ကို ပျော်ရွှင်ပါ!\n\n💬 *အကူအညီ：* @edenvault\\_88\n📧 *အီးမေးလ်：* edenvault888@gmail.com'
        }
    };
    
    const text = texts[userLang];
    
    bot.sendMessage(userId, text.approved, { parse_mode: 'Markdown' });

    // Send each key with QR code
    for (const key of keys) {
        bot.sendMessage(userId, `🔑 *${key.server} ${text.access}*\n💾 *${text.dataLimit}:* ${key.gb}GB\n\n\`${key.url}\``, { parse_mode: 'Markdown' });

        // Generate and send QR code
        const qrBuffer = await QRCode.toBuffer(key.url);
        bot.sendPhoto(userId, qrBuffer, { 
            caption: `${key.server === 'US' ? '🇺🇸' : '🇸🇬'} ${key.server} ${text.qrCaption}` 
        });
    }

    // Send setup instructions
    bot.sendMessage(userId, text.instructions, { parse_mode: 'Markdown' });
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

        // Save user plan data
        const purchaseDate = new Date();
        const expiryDate = new Date(purchaseDate.getTime() + (plan.days * 24 * 60 * 60 * 1000));
        
        userPlans.set(user, {
            planKey: proof.planKey,
            server: proof.server,
            keys: keys,
            purchaseDate: purchaseDate,
            expiryDate: expiryDate,
            dataUsed: 0
        });

        pendingProofs.delete(uid);
        bot.editMessageText(`✅ *Payment Approved & Processed*\n\nPayment ID: ${uid}\nUser: ${user}\nPlan: ${plan.name}\nServer: ${proof.server}\nExpiry: ${expiryDate.toLocaleDateString()}\nKeys generated successfully!`, {
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

    const userLang = userLanguages.get(proof.id) || 'en';
    const rejectionTexts = {
        en: '❌ *Payment Rejected*\n\nYour payment could not be verified. Please contact support for assistance.\n\n💬 *Support:* @edenvault\\_88',
        cn: '❌ *付款被拒绝*\n\n您的付款无法验证。请联系客服寻求帮助。\n\n💬 *客服：* @edenvault\\_88',
        mm: '❌ *ငွေပေးချေမှုငြင်းပယ်ခံရပါသည်*\n\nသင့်ငွေပေးချေမှုကို အတည်ပြု၍မရပါ။ အကူအညီအတွက် support ကိုဆက်သွယ်ပါ။\n\n💬 *အကူအညီ：* @edenvault\\_88'
    };

    bot.sendMessage(proof.id, rejectionTexts[userLang], { parse_mode: 'Markdown' });

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
function showSupport(chatId, lang = 'en') {
    const texts = {
        en: {
            title: '💬 *EdenVaultVPN Support*',
            needHelp: '🔧 *Need Help?*',
            telegram: '📱 **Telegram:**',
            email: '📧 **Email:**',
            responseTime: '⏰ **Response Time:** Usually within 24 hours',
            commonIssues: '❓ *Common Issues:*',
            issues: '• Payment problems - Send screenshot\n• Connection issues - Check your internet\n• App setup help - We\'ll guide you!\n• Refund requests - Valid within 7 days',
            quickCommands: '🚀 *Quick Commands:*',
            commands: '/help - Full command guide\n/plans - View packages\n/status - Check your plan\n/servers - Server locations',
            available: '📞 We\'re here to help 24/7!'
        },
        cn: {
            title: '💬 *EdenVaultVPN 客服支持*',
            needHelp: '🔧 *需要帮助？*',
            telegram: '📱 **Telegram:**',
            email: '📧 **邮箱:**',
            responseTime: '⏰ **响应时间:** 通常24小时内',
            commonIssues: '❓ *常见问题：*',
            issues: '• 付款问题 - 发送截图\n• 连接问题 - 检查网络\n• 应用设置帮助 - 我们来指导！\n• 退款请求 - 7天内有效',
            quickCommands: '🚀 *快速命令：*',
            commands: '/help - 完整命令指南\n/plans - 查看套餐\n/status - 检查您的计划\n/servers - 服务器位置',
            available: '📞 我们24/7为您服务！'
        },
        mm: {
            title: '💬 *EdenVaultVPN အကူအညီ*',
            needHelp: '🔧 *အကူအညီလိုပါသလား？*',
            telegram: '📱 **Telegram:**',
            email: '📧 **အီးမေးလ်:**',
            responseTime: '⏰ **တုံ့ပြန်ချိန်:** များသောအားဖြင့် ၂၄နာရီအတွင်း',
            commonIssues: '❓ *အဖြစ်များသောပြဿနာများ：*',
            issues: '• ငွေပေးချေမှုပြဿနာများ - ဓာတ်ပုံပေးပို့ပါ\n• ချိတ်ဆက်မှုပြဿနာများ - အင်တာနက်စစ်ဆေးပါ\n• အက်ပ်သတ်မှတ်ခြင်းအကူအညီ - ကျွန်ုပ်တို့လမ်းညွှန်ပေးပါမည်!\n• ငွေပြန်အမ်းတောင်းခံခြင်း - ၇ရက်အတွင်းတရားဝင်',
            quickCommands: '🚀 *မြန်ဆန်သောလမ်းညွှန်များ：*',
            commands: '/help - အပြည့်အစုံလမ်းညွှန်\n/plans - အစီအစဥ်များကြည့်ရှုရန်\n/status - သင့်အစီအစဥ်စစ်ဆေးရန်\n/servers - ဆာဗာတည်နေရာများ',
            available: '📞 ကျွန်ုပ်တို့ ၂၄/၇ အကူအညီပေးပါသည်!'
        }
    };

    const text = texts[lang];
    const supportText = `${text.title}\n\n${text.needHelp}\n\n${text.telegram} @edenvault\\_88\n${text.email} edenvault888@gmail.com\n${text.responseTime}\n\n${text.commonIssues}\n${text.issues}\n\n${text.quickCommands}\n${text.commands}\n\n${text.available}`;
    
    bot.sendMessage(chatId, supportText, { parse_mode: 'Markdown' });
}

// === BOT HANDLERS ===

// Start command
bot.onText(/\/start/, (msg) => {
    showLanguageSelection(msg.chat.id);
});

// Help command - comprehensive guide
bot.onText(/\/help/, (msg) => {
    const userLang = userLanguages.get(msg.chat.id) || 'en';
    
    const helpTexts = {
        en: `🔐 *EdenVaultVPN - Command Guide*\n\n📱 *Available Commands:*\n\n/start - Start the bot and select language\n/menu - Open main menu\n/plans - View all VPN plans\n/help - Show this help guide\n/support - Contact support\n/status - Check your plan status\n/pricing - View pricing details\n/servers - Server locations info\n\n📋 *Quick Start Guide:*\n1️⃣ Use /plans to see available packages\n2️⃣ Choose your preferred plan\n3️⃣ Select server location (US/SG/Both)\n4️⃣ Choose payment method\n5️⃣ Pay and upload screenshot\n6️⃣ Get your VPN keys instantly!\n\n🌍 *Server Locations:*\n🇺🇸 US Server - Americas & Europe\n🇸🇬 SG Server - Asia Pacific\n🌐 Both Servers - Global coverage\n\n💬 *Need help?* Use /support or contact @edenvault\\_88`,
        
        cn: `🔐 *EdenVaultVPN - 命令指南*\n\n📱 *可用命令：*\n\n/start - 启动机器人并选择语言\n/menu - 打开主菜单\n/plans - 查看所有VPN套餐\n/help - 显示此帮助指南\n/support - 联系客服\n/status - 检查您的套餐状态\n/pricing - 查看价格详情\n/servers - 服务器位置信息\n\n📋 *快速入门指南：*\n1️⃣ 使用 /plans 查看可用套餐\n2️⃣ 选择您喜欢的套餐\n3️⃣ 选择服务器位置 (美国/新加坡/双服务器)\n4️⃣ 选择支付方式\n5️⃣ 付款并上传截图\n6️⃣ 立即获取您的VPN密钥!\n\n🌍 *服务器位置：*\n🇺🇸 美国服务器 - 美洲和欧洲\n🇸🇬 新加坡服务器 - 亚太地区\n🌐 双服务器 - 全球覆盖\n\n💬 *需要帮助？* 使用 /support 或联系 @edenvault\\_88`,
        
        mm: `🔐 *EdenVaultVPN - လမ်းညွှန်*\n\n📱 *အသုံးပြုနိုင်သောလမ်းညွှန်များ：*\n\n/start - ဘော့စတင်၍ ဘာသာစကားရွေးချယ်ရန်\n/menu - ပင်မမီနူး\n/plans - VPN အစီအစဥ်များအားလုံးကြည့်ရန်\n/help - ဤအကူအညီလမ်းညွှန်ပြရန်\n/support - အကူအညီဆက်သွယ်ရန်\n/status - သင့်အစီအစဥ်အခြေအနေစစ်ရန်\n/pricing - စျေးနှုန်းအသေးစိတ်ကြည့်ရန်\n/servers - ဆာဗာတည်နေရာအချက်အလက်\n\n📋 *မြန်ဆန်သောစတင်လမ်းညွှန်：*\n1️⃣ /plans သုံး၍ရရှိနိုင်သော package များကြည့်ပါ\n2️⃣ သင်နှစ်သက်သောအစီအစဥ်ကိုရွေးပါ\n3️⃣ ဆာဗာတည်နေရာရွေးချယ်ပါ (US/SG/နှစ်ခုလုံး)\n4️⃣ ငွေပေးချေမှုနည်းလမ်းရွေးပါ\n5️⃣ ငွေပေးချေ၍ ဓာတ်ပုံတင်ပါ\n6️⃣ သင့်VPN keys များကို ချက်ချင်းရယူပါ!\n\n🌍 *ဆာဗာတည်နေရာများ：*\n🇺🇸 US ဆာဗာ - အမေရိကတိုက်နှင့် ဥရောပ\n🇸🇬 SG ဆာဗာ - အာရှပစိဖိတ်\n🌐 ဆာဗာနှစ်ခုလုံး - ကမ္ဘာ့ကွန်ယက်\n\n💬 *အကူအညီလိုပါသလား？* /support သုံးပါ သို့မဟုတ် @edenvault\\_88 ကိုဆက်သွယ်ပါ`
    };
    
    bot.sendMessage(msg.chat.id, helpTexts[userLang], { parse_mode: 'Markdown' });
});

// Menu command - direct access to main menu
bot.onText(/\/menu/, (msg) => {
    const userLang = userLanguages.get(msg.chat.id) || 'en';
    showMainMenu(msg.chat.id, userLang);
});

// Plans command - direct access to plans
bot.onText(/\/plans/, (msg) => {
    const userLang = userLanguages.get(msg.chat.id) || 'en';
    showPlansMenu(msg.chat.id, userLang);
});

// Status command - check current plan
bot.onText(/\/status/, (msg) => {
    const userLang = userLanguages.get(msg.chat.id) || 'en';
    showMyPlan(msg.chat.id, userLang);
});

// Pricing command - detailed pricing info
bot.onText(/\/pricing/, (msg) => {
    const userLang = userLanguages.get(msg.chat.id) || 'en';
    
    const pricingTexts = {
        en: `💰 *EdenVaultVPN Pricing*\n\n🟢 **Mini Vault** - Perfect for light users\n• 100GB • 30 Days - **3,000 MMK**\n• 100GB • 90 Days - **7,000 MMK**\n\n🔵 **Power Vault** - Great for regular users\n• 300GB • 30 Days - **6,000 MMK**\n• 300GB • 90 Days - **13,000 MMK**\n\n🔴 **Ultra Vault** - Best value! *(Most Popular)*\n• 500GB • 30 Days - **8,000 MMK**\n• 500GB • 90 Days - **17,000 MMK**\n\n💳 *Payment Methods:*\n📱 KPay • 🌊 Wave Pay • 🏦 Bank Transfer & Others\n\n🌍 *Server Options:*\n🇺🇸 US Server (Full data)\n🇸🇬 SG Server (Full data)\n🌐 Both Servers (Split 50/50)\n\n📱 Use /plans to purchase now!`,
        
        cn: `💰 *EdenVaultVPN 价格*\n\n🟢 **Mini Vault** - 适合轻度用户\n• 100GB • 30天 - **3,000 MMK**\n• 100GB • 90天 - **7,000 MMK**\n\n🔵 **Power Vault** - 适合常规用户\n• 300GB • 30天 - **6,000 MMK**\n• 300GB • 90天 - **13,000 MMK**\n\n🔴 **Ultra Vault** - 最超值! *(最受欢迎)*\n• 500GB • 30天 - **8,000 MMK**\n• 500GB • 90天 - **17,000 MMK**\n\n💳 *支付方式：*\n📱 KPay • 🌊 Wave Pay • 🏦 银行转账及其他\n\n🌍 *服务器选项：*\n🇺🇸 美国服务器 (完整流量)\n🇸🇬 新加坡服务器 (完整流量)\n🌐 双服务器 (流量分割 50/50)\n\n📱 使用 /plans 立即购买!`,
        
        mm: `💰 *EdenVaultVPN စျေးနှုန်း*\n\n🟢 **Mini Vault** - သေးသေးလေးအသုံးပြုသူများအတွက်\n• 100GB • 30 ရက် - **3,000 MMK**\n• 100GB • 90 ရက် - **7,000 MMK**\n\n🔵 **Power Vault** - ပုံမှန်အသုံးပြုသူများအတွက်\n• 300GB • 30 ရက် - **6,000 MMK**\n• 300GB • 90 ရက် - **13,000 MMK**\n\n🔴 **Ultra Vault** - အကောင်းဆုံးတန်ဖိုး! *(အရေပြားဆုံး)*\n• 500GB • 30 ရက် - **8,000 MMK**\n• 500GB • 90 ရက် - **17,000 MMK**\n\n💳 *ငွေပေးချေမှုနည်းလမ်းများ：*\n📱 KPay • 🌊 Wave Pay • 🏦 ဘဏ်လွှဲနှင့် အခြားများ\n\n🌍 *ဆာဗာရွေးချယ်စရာများ：*\n🇺🇸 US ဆာဗာ (ဒေတာအပြည့်)\n🇸🇬 SG ဆာဗာ (ဒေတာအပြည့်)\n🌐 ဆာဗာနှစ်ခုလုံး (ဒေတာခွဲဝေ 50/50)\n\n📱 ယခုပင်ဝယ်ယူရန် /plans သုံးပါ!`
    };
    
    bot.sendMessage(msg.chat.id, pricingTexts[userLang], { parse_mode: 'Markdown' });
});

// Servers command - server information
bot.onText(/\/servers/, (msg) => {
    const userLang = userLanguages.get(msg.chat.id) || 'en';
    
    const serversTexts = {
        en: `🌍 *Server Locations & Features*\n\n🇺🇸 **US Server**\n• Location: United States\n• Best for: Americas, Europe\n• Speed: Ultra-fast\n• Streaming: Netflix, Hulu, HBO\n\n🇸🇬 **SG Server**\n• Location: Singapore\n• Best for: Asia Pacific\n• Speed: Lightning fast\n• Streaming: Netflix, Disney+\n\n🌐 **Both Servers (Recommended)**\n• Get access to both locations\n• Data split equally (e.g., 250GB each for 500GB plan)\n• Maximum flexibility\n• Best global coverage\n\n⚡ *All servers offer:*\n✅ 24/7 uptime\n✅ Military-grade encryption\n✅ No logs policy\n✅ Unlimited device connections\n✅ High-speed streaming\n\n📱 Ready to start? Use /plans`,
        
        cn: `🌍 *服务器位置和功能*\n\n🇺🇸 **美国服务器**\n• 位置：美国\n• 最适合：美洲、欧洲\n• 速度：超快\n• 流媒体：Netflix、Hulu、HBO\n\n🇸🇬 **新加坡服务器**\n• 位置：新加坡\n• 最适合：亚太地区\n• 速度：闪电般快速\n• 流媒体：Netflix、Disney+\n\n🌐 **双服务器 (推荐)**\n• 可访问两个位置\n• 流量平均分配 (例如500GB套餐各250GB)\n• 最大灵活性\n• 最佳全球覆盖\n\n⚡ *所有服务器提供：*\n✅ 24/7 正常运行时间\n✅ 军事级加密\n✅ 无日志政策\n✅ 无限设备连接\n✅ 高速流媒体\n\n📱 准备开始了吗？使用 /plans`,
        
        mm: `🌍 *ဆာဗာတည်နေရာများနှင့် လုပ်ဆောင်ချက်များ*\n\n🇺🇸 **US ဆာဗာ**\n• တည်နေရာ： အမေရိကန်\n• အကောင်းဆုံးအတွက်： အမေရိကတိုက်၊ ဥရောပ\n• အမြန်နှုန်း： အလွန်မြန်\n• Streaming: Netflix, Hulu, HBO\n\n🇸🇬 **SG ဆာဗာ**\n• တည်နေရာ： စင်္ကာပူ\n• အကောင်းဆုံးအတွက်： အာရှပစိဖိတ်\n• အမြန်နှုန်း： လျှပ်စီးကြောင်းလိုမြန်\n• Streaming: Netflix, Disney+\n\n🌐 **ဆာဗာနှစ်ခုလုံး (အကြံပြုထားသော)**\n• နေရာနှစ်ခုလုံးကို အသုံးပြုနိုင်\n• ဒေတာညီမျှခွဲဝေ (ဥပမာ 500GB အစီအစဥ်တွင် တစ်ခုစီ 250GB)\n• အများဆုံးပြောင်းလွယ်ပြင်လွယ်မှု\n• အကောင်းဆုံးကမ္ဘာ့လွှမ်းခြုံမှု\n\n⚡ *ဆာဗာအားလုံးပေးပို့သည်：*\n✅ 24/7 အလုပ်လုပ်ချိန်\n✅ စစ်တပ်အဆင့် encryption\n✅ မှတ်တမ်းမရှိ မူဝါဒ\n✅ ကန့်သတ်မရှိ စက်ပစ္စည်းချိတ်ဆက်မှု\n✅ အမြန်နှုန်းမြင့် streaming\n\n📱 စတင်ရန်အဆင်သင့်ဖြစ်ပြီလား？ /plans သုံးပါ`
    };
    
    bot.sendMessage(msg.chat.id, serversTexts[userLang], { parse_mode: 'Markdown' });
});

// Support command
bot.onText(/\/support/, (msg) => {
    const userLang = userLanguages.get(msg.chat.id) || 'en';
    showSupport(msg.chat.id, userLang);
});

// Admin command to view all users (admin only)
bot.onText(/\/users/, (msg) => {
    if (msg.from.id.toString() !== ADMIN_ID) {
        const userLang = userLanguages.get(msg.chat.id) || 'en';
        const deniedTexts = {
            en: '❌ Access denied.',
            cn: '❌ 访问被拒绝。',
            mm: '❌ အသုံးပြုခွင့်မရှိပါ။'
        };
        bot.sendMessage(msg.chat.id, deniedTexts[userLang]);
        return;
    }

    if (userPlans.size === 0) {
        bot.sendMessage(msg.chat.id, '📊 *Admin Panel*\n\nNo users with active plans found.');
        return;
    }

    let usersList = '📊 *All Users with Plans*\n\n';
    let count = 0;
    
    for (const [userId, userPlan] of userPlans) {
        count++;
        const plan = plans[userPlan.planKey];
        const isActive = new Date() < userPlan.expiryDate;
        const status = isActive ? '✅ Active' : '❌ Expired';
        const daysLeft = Math.ceil((userPlan.expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        
        let serverText = '';
        if (userPlan.server === 'us') {
            serverText = '🇺🇸 US';
        } else if (userPlan.server === 'sg') {
            serverText = '🇸🇬 SG';
        } else {
            serverText = '🌐 Both';
        }

        usersList += `${count}. *User ${userId}*\n   📦 ${plan.name} | ${serverText} | ${plan.gb}GB\n   ${status}`;
        if (isActive) {
            usersList += ` (${daysLeft}d left)`;
        }
        usersList += '\n\n';
    }

    bot.sendMessage(msg.chat.id, usersList, { parse_mode: 'Markdown' });
});



// Callback query handler
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith('lang_')) {
        const lang = data.split('_')[1];
        userLanguages.set(chatId, lang); // Store user's language preference
        showMainMenu(chatId, lang);
    }

    if (data === 'change_lang') {
        showLanguageSelection(chatId);
    }

    if (data.startsWith('choose_plans_')) {
        const lang = data.split('_')[2] || userLanguages.get(chatId) || 'en';
        showPlansMenu(chatId, lang);
    }

    if (data.startsWith('my_plan_')) {
        const lang = data.split('_')[2] || userLanguages.get(chatId) || 'en';
        showMyPlan(chatId, lang);
    }

    if (data.startsWith('support_')) {
        const lang = data.split('_')[1] || userLanguages.get(chatId) || 'en';
        showSupport(chatId, lang);
    }

    if (data.startsWith('back_main_')) {
        const lang = data.split('_')[2] || userLanguages.get(chatId) || 'en';
        showMainMenu(chatId, lang);
    }

    if (data.startsWith('plan_')) {
        const parts = data.split('_');
        if (parts.length >= 3) {
            const planKey = `${parts[1]}_${parts[2]}`;
            const lang = parts[3] || userLanguages.get(chatId) || 'en';
            showPlanDetails(chatId, planKey, lang);
        }
    }

    if (data.startsWith('back_plans_')) {
        const lang = data.split('_')[2] || userLanguages.get(chatId) || 'en';
        showPlansMenu(chatId, lang);
    }

    if (data.startsWith('srv_')) {
        const parts = data.split('_');
        const server = parts[1];
        const planKey = `${parts[2]}_${parts[3]}`;
        const lang = parts[4] || userLanguages.get(chatId) || 'en';
        showPaymentMethods(chatId, server, planKey, lang);
    }

    if (data.startsWith('pay_')) {
        const parts = data.split('_');
        const paymentMethod = parts[1];
        const server = parts[2];
        const planKey = `${parts[3]}_${parts[4]}`;
        const lang = parts[5] || userLanguages.get(chatId) || 'en';
        showPaymentDetails(chatId, paymentMethod, server, planKey, lang);
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
