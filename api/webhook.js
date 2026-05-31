// api/webhook.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('OK');
    
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const update = req.body;

    try {
        // 📨 INVITACIÓN DESDE MINI APP
        if (update.message?.web_app_data?.data?.startsWith('invite_')) {
            const targetId = update.message.web_app_data.data.split('_')[1];
            const inviter = update.message.from;
            
            // Enviar mensaje con botón seguro
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: targetId,
                    text: `🎮 <b>¡${inviter.first_name} te ha desafiado!</b>\n\n¿Aceptas?`,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[{
                            text: "✅ Aceptar Reto",
                            web_app: { 
                                name: "LoveVersus",
                                url: `https://love-versus.vercel.app/?accept=1&from=${inviter.id}` 
                            }
                        }]]
                    }
                })
            });
        }

        // 💰 PAGOS CON STARS
        if (['buy_stars_50','boost_perfil','entrada_torneo'].includes(update.message?.web_app_data?.data)) {
            const productos = {
                buy_stars_50: { t: '50 Fichas', a: 50, d: 'Para apostar' },
                boost_perfil: { t: 'Boost Perfil', a: 100, d: '24h destacado' },
                entrada_torneo: { t: 'Torneo', a: 200, d: 'Acceso total' }
            };
            const p = productos[update.message.web_app_data.data];
            
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendInvoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: update.message.chat.id,
                    title: p.t, description: p.d, payload: update.message.web_app_data.data,
                    provider_token: '', currency: 'XTR',
                    prices: [{ label: p.t, amount: p.a }]
                })
            });
        }

        // ⏳ PRE-CHECKOUT OBLIGATORIO
        if (update.pre_checkout_query) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true })
            });
        }

        // ✅ PAGO EXITOSO → ACTUALIZAR SUPABASE
        if (update.message?.successful_payment) {
            const userId = update.message.from.id;
            const payload = update.message.successful_payment.invoice_payload;
            const fichas = payload === 'buy_stars_50' ? 50 : (payload === 'entrada_torneo' ? 200 : 0);
            
            if (fichas > 0) {
                // Llamada segura a Supabase desde servidor
                await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/add_fichas`, {
                    method: 'POST',
                    headers: {
                        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ user_id: userId, amount: fichas })
                });
            }
        }

    } catch(e) {
        console.error('Webhook error:', e);
    }
    
    res.status(200).send('ok');
}
