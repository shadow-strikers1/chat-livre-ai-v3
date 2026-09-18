export default async function handler(req, res) {
  // Só aceita POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed. Use POST."
    });
  }

  try {
    const { messages, provider = "gemini" } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Nenhuma mensagem foi enviada."
      });
    }

    const cleanMessages = messages
      .slice(-40)
      .map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: String(msg.content || "")
      }))
      .filter((msg) => msg.content.trim());

    if (cleanMessages.length === 0) {
      return res.status(400).json({
        error: "Mensagem vazia."
      });
    }

    // =========================
    // GEMINI
    // =========================
    if (provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY não configurada na Vercel."
        });
      }

      const contents = cleanMessages.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [
          {
            text: msg.content
          }
        ]
      }));

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error:
            data?.error?.message ||
            "Erro ao comunicar com o Gemini."
        });
      }

      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("") || "";

      if (!text) {
        return res.status(500).json({
          error: "O Gemini não retornou texto."
        });
      }

      return res.status(200).json({
        text,
        provider: "gemini"
      });
    }

    // =========================
    // OPENROUTER
    // =========================
    if (provider === "openrouter") {
      const apiKey = process.env.OPENROUTER_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          error: "OPENROUTER_API_KEY não configurada na Vercel."
        });
      }

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://chat-livre-ai-v3.vercel.app",
            "X-Title": "Chat Livre AI V3"
          },
          body: JSON.stringify({
            model: "openrouter/free",
            messages: cleanMessages,
            temperature: 0.7,
            max_tokens: 4096
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error:
            data?.error?.message ||
            "Erro ao comunicar com o OpenRouter."
        });
      }

      const text =
        data?.choices?.[0]?.message?.content || "";

      if (!text) {
        return res.status(500).json({
          error: "O OpenRouter não retornou texto."
        });
      }

      return res.status(200).json({
        text,
        provider: "openrouter"
      });
    }

    return res.status(400).json({
      error: `Provider inválido: ${provider}`
    });

  } catch (error) {
    console.error("CHAT API ERROR:", error);

    return res.status(500).json({
      error: "Erro interno da API.",
      details: error?.message || "Erro desconhecido."
    });
  }
}
