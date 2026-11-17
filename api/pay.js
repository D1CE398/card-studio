const BOT_TOKEN = "9263036364:AAFQuaLSd28HEULbdGHwoKN_rXbILfzpbcA";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // 1. Создание счета на оплату в Telegram Stars
  if (req.method === "GET") {
    const stars = Number(req.query.stars || 150);
    const title = req.query.title || "PRO-доступ MP Design Studio";

    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title,
        description: "Снятие водяного знака и скачивание карточек в HD (900×1200 PNG)",
        payload: `pro_${stars}_${Date.now()}`,
        currency: "XTR",
        prices: [{ label: title, amount: stars }]
      })
    });

    const data = await tgRes.json();
    return res.status(200).json(data);
  }

  // 2. Webhook от Telegram: подтверждение оплаты
  if (req.method === "POST") {
    const update = req.body;
    if (update?.pre_checkout_query) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pre_checkout_query_id: update.pre_checkout_query.id,
          ok: true
        })
      });
    }
    return res.status(200).send("OK");
  }
}
