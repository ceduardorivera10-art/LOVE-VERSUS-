import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const update = req.body;
    
    // 🔑 Token temporal (SOLO PARA PRUEBAS, REVOCAR DESPUÉS)
    const BOT_TOKEN = '8347165317:AAEvzDeIksjNU25vDQX03AgNXy1dmBISQaE';

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Señal desde la Mini App
    if (update.message?.web_app_data) {
        const chatId = update.message.chat.id;
        const data = update.message.web_app_data.data;

        // Mensaje de confirmación
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: '✅ Señal de compra recibida. Preparando factura...'
            })
        });

        let producto = {};
        if (data === 'buy_stars_50') producto = { titulo: '50 Fichas', amount: 50, desc: 'Para apostar en partidas' };
        else if (data === 'boost_perfil') producto = { titulo: 'Boost de Perfil', amount: 100, desc: '24h destacado' };
        else if (data === 'entrada_torneo') producto = { titulo: 'Entrada Torneo', amount: 200, desc: 'Acceso total' };

        if (producto.titulo) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendInvoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    title: producto.titulo,
                    description: producto.desc,
                    payload: data,
                    provider_token: '',
                    currency: 'XTR',
                    prices: [{ label: producto.titulo, amount: producto.amount }]
                })
            });
        }
    }

    // 2. Pre-checkout
    if (update.pre_checkout_query) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pre_checkout_query_id: update.pre_checkout_query.id,
                ok: true
            })
        });
    }

    // 3. Pago exitoso
    if (update.message?.successful_payment) {
        const userId = update.message.from.id;
        const payload = update.message.successful_payment.invoice_payload;
        const chatId = update.message.chat.id;

        let fichas = 0;
        if (payload === 'buy_stars_50') fichas = 50;
        else if (payload === 'entrada_torneo') fichas = 200;

        if (fichas > 0) {
            await supabase.rpc('add_fichas', { user_id: userId, amount: fichas });
        }

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: `✅ ¡Pago exitoso! Se han añadido ${fichas} fichas a tu cuenta. 🪙`
            })
        });
    }

    res.status(200).send('ok');
}
