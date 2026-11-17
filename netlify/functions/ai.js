const BOT_TOKEN = "9263036364:AAHNAVNpYxImmaGBqKVz0x0rsbILDBAJMrY";

export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

  try {
    const body = JSON.parse(event.body || "{}");

    // 1. VISION AI ЧЕРЕЗ GEMINI (распознавание товара по фото + подбор иконок и SEO-описания)
    if (body.action === "analyze_product") {
      const apiKey = process.env.GEMINI_API_KEY || "";
      const prompt = `Ты топ-дизайнер карточек Wildberries и Ozon. Посмотри на фото товара (и учти подсказку названия, если она есть: "${body.title || ""}"). Определи, что это за товар, и придумай продающую инфографику и SEO-описание на русском языке.
Верни СТРОГО валидный JSON без markdown с полями:
- "theme": выбери лучшую тему из ["wb_bright", "dark_luxury", "tech_blue", "eco_minimal", "sale_red", "mint_fresh"]
- "badge": стикер капсом до 18 символов (например "ХИТ СЕЗОНА 2026")
- "title": название товара капсом до 22 символов
- "sub": ключевая характеристика до 36 символов
- "b1": подходящая эмодзи-иконка + преимущество 1 (до 18 символов)
- "b2": подходящая эмодзи-иконка + преимущество 2 (до 18 символов)
- "b3": подходящая эмодзи-иконка + нижний УТП-баннер (до 38 символов)
- "description": продающее SEO-описание товара для WB/Ozon (3-4 предложения, 300-450 символов).`;

      const parts = [{ text: prompt }];
      if (body.image) {
        const base64Data = body.image.replace(/^data:image\/\w+;base64,/, "");
        parts.push({ inline_data: { mime_type: "image/jpeg", data: base64Data } });
      }

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Gemini API error");

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed = JSON.parse(rawText);

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: parsed }) };
    }

    // 2. ОТПРАВКА ГОТОВОЙ КАРТОЧКИ ПРЯМО В ЧАТ TELEGRAM (решает проблему скачивания на телефонах)
    if (body.action === "send_to_chat") {
      const base64Data = body.image.replace(/^data:image\/\w+;base64,/, "");
      const imgBuffer = Buffer.from(base64Data, "base64");

      const formData = new FormData();
      formData.append("chat_id", String(body.chat_id));
      formData.append("document", new Blob([imgBuffer], { type: "image/png" }), body.filename || "card-900x1200.png");
      formData.append("caption", body.caption || "🎨 Ваша карточка 900×1200 px из MP Design Studio");

      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
        method: "POST",
        body: formData
      });
      const tgData = await tgRes.json();
      return { statusCode: 200, headers, body: JSON.stringify(tgData) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Unknown action" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
}
