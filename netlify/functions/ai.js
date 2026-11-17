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

    if (body.action === "analyze_product") {
      const apiKey = (process.env.GEMINI_API_KEY || "").trim();
      if (!apiKey) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ ok: false, error: "Пустой GEMINI_API_KEY в настройках Netlify" })
        };
      }

      const prompt = `Ты ведущий арт-директор карточек премиум-сегмента для Ozon и Wildberries.
Посмотри на фото товара (учти подсказку: "${body.title || ""}").
Определи, что это за товар, оцени композицию снимка и разработай СРАЗУ 3 РАЗНЫХ ДИЗАЙН-ВАРИАНТА карточки (без эмодзи, строгий дорогой стиль).
Верни СТРОГО валидный JSON без markdown:
{
  "productTitle": "КОРОТКОЕ НАЗВАНИЕ ТОВАРА КАПСОМ (до 22 символов)",
  "recommendedScale": 1.15,
  "qualityVerdict": "Короткий совет арт-директора (1 предложение: как лучше подать этот товар и почему выбран такой контраст)",
  "description": "Продающее SEO-описание для карточки WB/Ozon на русском (3-4 предложения, 320-450 символов, без эмодзи)",
  "variants": [
    {
      "name": "Вариант 1 • Лукбук",
      "theme": "clean_light",
      "layout": "grid_bottom",
      "bgWord": "ОДНО МОЩНОЕ СЛОВО КАПСОМ (9-13 букв)",
      "sub": "ПОДЗАГОЛОВОК ДО 30 СИМВОЛОВ",
      "items": [
        { "icon": "shield", "label": "ПУНКТ 1 ДО 16 СИМВОЛОВ" },
        { "icon": "eco", "label": "ПУНКТ 2 ДО 16 СИМВОЛОВ" },
        { "icon": "check", "label": "ПУНКТ 3 ДО 16 СИМВОЛОВ" }
      ]
    },
    {
      "name": "Вариант 2 • 3D Студия",
      "theme": "dark_graphite",
      "layout": "podium_cards",
      "bgWord": "ХИТ ПРОДАЖ",
      "sub": "КЛЮЧЕВАЯ ХАРАКТЕРИСТИКА ТОВАРА",
      "items": [
        { "icon": "battery", "label": "ФИШКА 1 ДО 16 СИМВОЛОВ" },
        { "icon": "gear", "label": "ФИШКА 2 ДО 16 СИМВОЛОВ" },
        { "icon": "star", "label": "НИЖНИЙ БАННЕР ДО 32 СИМВОЛОВ" }
      ]
    },
    {
      "name": "Вариант 3 • Детали",
      "theme": "warm_beige",
      "layout": "callouts_arrows",
      "bgWord": "КАЧЕСТВО",
      "sub": "ДЕТАЛИ ИМЕЮТ ЗНАЧЕНИЕ",
      "items": [
        { "icon": "feather", "label": "ВЫНОСКА 1 ДО 16 СИМВОЛОВ" },
        { "icon": "water", "label": "ВЫНОСКА 2 ДО 16 СИМВОЛОВ" },
        { "icon": "sparkle", "label": "НИЖНИЙ СЛОГАН ДО 28 СИМВОЛОВ" }
      ]
    }
  ]
}
Для поля "theme" используй только значения из ["clean_light", "dark_graphite", "warm_beige", "urban_cool"].
Для поля "layout" используй только значения из ["grid_bottom", "podium_cards", "callouts_arrows"].
Для поля "icon" используй только значения из ["shield", "eco", "feather", "water", "battery", "sparkle", "jeans", "dress", "shorts", "check", "star", "gear"].`;

      const parts = [{ text: prompt }];
      if (body.image) {
        const base64Data = body.image.replace(/^data:image\/\w+;base64,/, "");
        parts.push({ inline_data: { mime_type: "image/jpeg", data: base64Data } });
      }

      const models = ["gemini-3.8-flash", "gemini-3.0-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
      let lastError = "Неизвестная ошибка Gemini";

      for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        const data = await res.json();
        if (res.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          const rawText = data.candidates[0].content.parts[0].text;
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ ok: true, model, data: JSON.parse(jsonMatch[0]) })
            };
          }
        }
        lastError = data?.error?.message || `HTTP ${res.status} (${model})`;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: false, error: lastError })
      };
    }

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
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
}
