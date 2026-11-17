const BOT_TOKEN = "9263036364:AAHNAVNpYxImmaGBqKVz0x0rsbILDBAJMrY";

export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  // 1. Создание счета на оплату в Telegram Stars
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters || {};
    const stars = Number(params.stars || 150);
    const title = params.title || "PRO-доступ MP Design Studio";

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
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  // 2. Webhook от Telegram: автоматическое подтверждение оплаты
  if (event.httpMethod === "POST") {
    const update = JSON.parse(event.body || "{}");
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
    return { statusCode: 200, headers, body: "OK" };
  }
}
