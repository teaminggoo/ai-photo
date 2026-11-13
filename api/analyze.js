// api/analyze.js
// Vercel Serverless Function: Google Gemini API를 이용한 이미지 분위기/스타일 분석

/**
 * API 키로 사용 가능한 Gemini 모델을 자동 검색합니다.
 * @param {string} apiKey
 * @returns {Promise<string[]>}
 */
async function getAvailableModels(apiKey) {
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (!listRes.ok) {
      console.warn("models list 조회 실패:", listRes.status);
      return [];
    }
    const data = await listRes.json();
    const models = data.models || [];
    return models
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));
  } catch (err) {
    console.warn("models list fetch 오류:", err.message);
    return [];
  }
}

/**
 * Gemini 모델을 호출하여 이미지를 분석합니다.
 * @param {string} modelName
 * @param {string} apiKey
 * @param {string} mimeType
 * @param {string} base64Data
 */
async function callGeminiApi(modelName, apiKey, mimeType, base64Data) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const prompt = `
당신은 감각적이고 섬세한 AI 포토 무드 분석가입니다.
제공된 사진의 전체적인 분위기, 색상 톤, 배경, 의상 스타일, 인물의 표정이나 포즈, 구도를 종합적으로 분석하여 감성적이고 흥미로운 분석 결과를 작성해주세요.

[중요 지침]
1. 사람의 신원, 이름, 나이, 직업, 특정 위치 등 개인정보를 절대 추측하거나 언급하지 마세요.
2. 사진에서 시각적으로 직접 확인할 수 있는 색상, 배경, 조명, 의상, 표정, 구도와 전체적인 무드에 집중하세요.
3. 다음 4가지 항목을 반드시 포함한 순수 JSON 형태로만 응답하세요:
   - keywords: 사진의 분위기를 표현하는 키워드 3개와 각 분위기를 재미있고 센스 있게 표현한 퍼센트 숫자 (3개의 퍼센트 합은 100이 되도록 설정)
   - oneLineReview: 사진의 전체 무드를 관통하는 감각적이고 위트 있는 AI 한줄평 (한 문장)
   - hashtags: 사진과 어울리는 트렌디한 해시태그 4개 (각 해시태그는 '#'으로 시작)

[JSON 응답 형식 예시]
{
  "keywords": [
    { "keyword": "따스한 여유", "percentage": 50 },
    { "keyword": "빈티지 감성", "percentage": 30 },
    { "keyword": "도시의 차분함", "percentage": 20 }
  ],
  "oneLineReview": "은은한 오후의 햇살과 자연스러운 시선 처리가 영화의 한 장면처럼 담긴 사진이에요.",
  "hashtags": ["#감성스냅", "#오후의햇살", "#무드장인", "#내추럴바이브"]
}
`.trim();

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType || "image/jpeg",
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      parsedMsg = parsed?.error?.message || errorText;
    } catch {
      // ignore
    }
    const err = new Error(`Gemini API Error (${modelName}): ${parsedMsg}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Gemini로부터 분석 결과를 전달받지 못했습니다.");
  }

  // JSON 파싱 (코드 블록 방어)
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

module.exports = async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "허용되지 않는 메소드입니다. POST 요청을 사용해주세요.",
    });
  }

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({
      error:
        "서버에 GEMINI_API_KEY 환경 변수가 설정되어 있지 않습니다. Vercel 프로젝트 설정의 Environment Variables에 GEMINI_API_KEY를 등록해주세요.",
    });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // do nothing
      }
    }

    // 디버그 요청 지원
    if (body?.debug) {
      const available = await getAvailableModels(apiKey);
      return res.status(200).json({
        debug: true,
        availableModels: available,
        keyPrefix: apiKey.slice(0, 6) + "...",
      });
    }

    const { imageUrl } = body || {};

    if (!imageUrl || typeof imageUrl !== "string") {
      return res.status(400).json({
        error: "imageUrl이 제공되지 않았습니다. 유효한 이미지 URL을 전달해주세요.",
      });
    }

    // 1. Cloudinary 이미지 다운로드 후 Base64 변환
    let imageFetchResponse;
    try {
      imageFetchResponse = await fetch(imageUrl);
    } catch (fetchErr) {
      return res.status(400).json({
        error: `이미지 URL에 접근할 수 없습니다: ${fetchErr.message}`,
      });
    }

    if (!imageFetchResponse.ok) {
      return res.status(400).json({
        error: `이미지 다운로드에 실패했습니다. (HTTP 상태: ${imageFetchResponse.status})`,
      });
    }

    const contentType =
      imageFetchResponse.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await imageFetchResponse.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    // 2. 사용 가능한 모델 탐색 및 순차 시도
    const availableModels = await getAvailableModels(apiKey);
    console.log("계정에서 지원하는 Gemini 모델 목록:", availableModels);

    // 우선 시도할 모델 후보 목록
    const preferredOrder = [
      "gemini-2.0-flash",
      "gemini-2.0-flash-exp",
      "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash-001",
      "gemini-1.5-flash-002",
      "gemini-1.5-pro",
      "gemini-1.5-pro-latest",
    ];

    // availableModels 중에서 preferredOrder 순서대로 매칭하거나, 없으면 availableModels 전체 사용
    const targetModels = [];
    for (const pref of preferredOrder) {
      if (availableModels.includes(pref)) {
        targetModels.push(pref);
      }
    }
    for (const avail of availableModels) {
      if (!targetModels.includes(avail)) {
        targetModels.push(avail);
      }
    }

    // 만약 listModels가 빈 배열이었다면 기본 fallback 모델들 지정
    if (targetModels.length === 0) {
      targetModels.push(
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest"
      );
    }

    let analysisResult = null;
    let lastError = null;

    for (const model of targetModels) {
      try {
        console.log(`Gemini 모델 시도 중: ${model}`);
        analysisResult = await callGeminiApi(
          model,
          apiKey,
          contentType,
          base64Data
        );
        if (analysisResult) {
          console.log(`모델 ${model} 호출 성공`);
          break;
        }
      } catch (err) {
        console.warn(`모델 ${model} 실패:`, err.message);
        lastError = err;
      }
    }

    if (!analysisResult) {
      throw lastError || new Error("Gemini API 호출에 모두 실패했습니다.");
    }

    // 3. 응답 규격 점검 및 기본값 보정
    const sanitized = {
      keywords: Array.isArray(analysisResult.keywords)
        ? analysisResult.keywords.slice(0, 3)
        : [],
      oneLineReview:
        analysisResult.oneLineReview ||
        "전체적으로 균형 잡힌 구도와 자연스러운 매력이 돋보이는 사진입니다.",
      hashtags: Array.isArray(analysisResult.hashtags)
        ? analysisResult.hashtags.slice(0, 4)
        : [],
    };

    return res.status(200).json({
      success: true,
      imageUrl,
      data: sanitized,
    });
  } catch (error) {
    console.error("Gemini 이미지 분석 오류:", error);
    return res.status(500).json({
      error: error.message || "이미지 분석 중 알 수 없는 오류가 발생했습니다.",
    });
  }
};
