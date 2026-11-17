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

    // 1. VISION AI ЧЕРЕЗ GEMINI (журнальный арт-дирекшн + подбор векторных иконок + SEO-описание)
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
Посмотри на фото товара (учти подсказку названия, если есть: "${body.title || ""}").
Сделай строгий, дорогой минималистичный дизайн в стиле журнального лукбука (как Apple / Adidas), БЕЗ эмодзи и БЕЗ кричащего спама.
Верни СТРОГО валидный JSON без markdown:
- "theme": выбери стиль фона из ["clean_light", "dark_graphite", "warm_beige", "urban_cool"]
- "layout": выбери композицию из ["grid_bottom", "callouts_arrows"] ("grid_bottom" — 3 векторные иконки в рамке снизу; "callouts_arrows" — изогнутые стрелки-выноски на детали товара)
- "bgWord": одно мощное слово капсом на фон (9-14 букв, например: "УНИВЕРСАЛЬНОСТЬ", "ЭКОЛОГИЧНОСТЬ", "ТЕХНОЛОГИЧНОСТЬ", "КОМФОРТ", "ПРЕМИАЛЬНОСТЬ")
- "title": лаконичное название товара капсом (до 24 символов)
- "sub": точный слоган или акцент под товаром капсом (до 34 символов, например "УСТОЙЧИВЫЕ МАТЕРИАЛЫ" или "ДЕТАЛИ ИМЕЮТ ЗНАЧЕНИЕ")
- "items": массив из 3 объектов для векторных иконок/выносок, каждый вида:
  {
    "icon": выбери самую подходящую векторную иконку из ["shield", "eco", "feather", "water", "battery", "sparkle", "jeans", "dress", "shorts", "check", "star", "gear"],
    "label": короткая подпись капсом в 1-2 слова (до 20 символов, например "ПОД ДЖИНСЫ", "ПОДДЕРЖКА ПЯТКИ", "ИСКУССТВЕННАЯ КОЖА")
  }
- "description": продающее SEO-описание карточки для WB/Ozon на русском (3-4 предложения, 300-450 символов, деловой и убедительный стиль без эмодзи).`;

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

    // 2. ОТПРАВКА ГОТОВОЙ КАРТОЧКИ ПРЯМО В ЧАТ TELEGRAM
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
