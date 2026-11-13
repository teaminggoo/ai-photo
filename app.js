// ============================================================================
// Cloudinary 설정 정보 (Client-side Direct Upload)
// ============================================================================
const CLOUDINARY_CLOUD_NAME = "a3albjef";
const CLOUDINARY_UPLOAD_PRESET = "ai-photo";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// 업로드 완료 후 반환된 이미지 URL 저장
let uploadedImageUrl = "";

// DOM 요소 참조 - 1단계 업로드
const imageInput = document.getElementById("imageInput");
const dropZone = document.getElementById("dropZone");
const dropZoneDefault = document.getElementById("dropZoneDefault");
const previewContainer = document.getElementById("previewContainer");
const previewImage = document.getElementById("previewImage");

const uploadingState = document.getElementById("uploadingState");
const uploadingMessage = document.getElementById("uploadingMessage");
const uploadError = document.getElementById("uploadError");
const uploadSuccessBox = document.getElementById("uploadSuccessBox");
const uploadedUrlInput = document.getElementById("uploadedUrlInput");
const copyUrlBtn = document.getElementById("copyUrlBtn");
const changeImageBtn = document.getElementById("changeImageBtn");
const nextStepBtn = document.getElementById("nextStepBtn");

// DOM 요소 참조 - 상단 단계 바 & 섹션 전환
const stepBadge1 = document.getElementById("stepBadge1");
const stepBadge2 = document.getElementById("stepBadge2");
const uploadSection = document.getElementById("uploadSection");
const analysisSection = document.getElementById("analysisSection");
const backToUploadBtn = document.getElementById("backToUploadBtn");

// DOM 요소 참조 - 2단계 AI 분석
const analysisImage = document.getElementById("analysisImage");
const analysisImageUrlLink = document.getElementById("analysisImageUrlLink");
const analysisReadyBox = document.getElementById("analysisReadyBox");
const startAnalysisBtn = document.getElementById("startAnalysisBtn");

const analyzingState = document.getElementById("analyzingState");
const analyzingMessage = document.getElementById("analyzingMessage");
const analysisError = document.getElementById("analysisError");

const analysisResultBox = document.getElementById("analysisResultBox");
const oneLineReviewText = document.getElementById("oneLineReviewText");
const keywordsList = document.getElementById("keywordsList");
const hashtagsList = document.getElementById("hashtagsList");
const reAnalyzeBtn = document.getElementById("reAnalyzeBtn");
const uploadAnotherBtn = document.getElementById("uploadAnotherBtn");

/**
 * 선택한 이미지 파일을 Cloudinary에 업로드하고 반환된 이미지 URL을 반환합니다.
 * @param {File} file 업로드할 이미지 파일
 * @returns {Promise<string>} 업로드된 이미지의 secure_url
 */
async function uploadImageToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errData = await response.json();
      errorDetail = errData?.error?.message ? ` (${errData.error.message})` : "";
    } catch {
      // JSON 파싱 실패 시 무시
    }
    throw new Error(`이미지 업로드에 실패했습니다.${errorDetail}`);
  }

  const data = await response.json();
  return data.secure_url || data.url;
}

/**
 * 서버 측 Serverless Function(/api/analyze)을 호출하여 Gemini API 분석을 수행합니다.
 * API 키는 브라우저에 노출되지 않으며 서버 환경 변수(GEMINI_API_KEY)로 안전하게 보호됩니다.
 * @param {string} imageUrl Cloudinary 이미지 URL
 */
async function analyzeImageWithGemini(imageUrl) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageUrl }),
  });

  const rawText = await response.text();
  let result = null;
  try {
    result = rawText ? JSON.parse(rawText) : null;
  } catch (parseErr) {
    throw new Error(
      `서버 응답 오류 (HTTP ${response.status}): ${rawText || "응답이 비어있습니다."}`
    );
  }

  if (!response.ok || !result || !result.success) {
    const errorMsg =
      result?.error ||
      `AI 이미지 분석에 실패했습니다. (HTTP 상태 코드: ${response.status})`;
    throw new Error(errorMsg);
  }

  return result.data;
}

/**
 * 업로드 에러 메시지 표시
 */
function showUploadError(message) {
  uploadError.textContent = message;
  uploadError.classList.remove("hidden");
}

function clearUploadError() {
  uploadError.textContent = "";
  uploadError.classList.add("hidden");
}

/**
 * 분석 에러 메시지 표시
 */
function showAnalysisError(message) {
  analysisError.textContent = message;
  analysisError.classList.remove("hidden");
}

function clearAnalysisError() {
  analysisError.textContent = "";
  analysisError.classList.add("hidden");
}

/**
 * 업로드 완료 후 다음 분석 단계 화면으로 전환합니다.
 * @param {string} imageUrl Cloudinary에서 반환된 이미지 URL
 */
function goToAnalysisStep(imageUrl) {
  if (!imageUrl) return;

  // 상단 단계 배지 업데이트
  stepBadge1.classList.remove("active");
  stepBadge1.classList.add("completed");
  stepBadge2.classList.add("active");

  // 분석 단계 영역에 반환된 Cloudinary 이미지 URL 세팅
  analysisImage.src = imageUrl;
  analysisImageUrlLink.href = imageUrl;
  analysisImageUrlLink.textContent = imageUrl;

  // 분석 상태 초기화
  clearAnalysisError();
  analyzingState.classList.add("hidden");
  analysisResultBox.classList.add("hidden");
  analysisReadyBox.classList.remove("hidden");

  // 분석 섹션 표시 및 부드러운 스크롤 이동
  analysisSection.classList.remove("hidden");
  analysisSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Gemini로부터 전달받은 분석 결과를 화면에 렌더링합니다.
 * @param {object} data
 */
function renderAnalysisResult(data) {
  // 1. AI 한줄평 렌더링
  oneLineReviewText.textContent =
    data.oneLineReview || "자연스러운 매력과 균형 잡힌 구도가 돋보이는 사진입니다.";

  // 2. 분위기 키워드 3개 & 퍼센트 바 렌더링
  keywordsList.innerHTML = "";
  const keywords = Array.isArray(data.keywords) ? data.keywords.slice(0, 3) : [];
  keywords.forEach((item) => {
    const rawPct = typeof item.percentage === "number"
      ? item.percentage
      : parseInt(item.percentage, 10) || 30;
    const pctValue = Math.min(100, Math.max(0, rawPct));

    const itemEl = document.createElement("div");
    itemEl.className = "keyword-item";
    itemEl.innerHTML = `
      <div class="keyword-meta">
        <span class="keyword-name">${item.keyword || "매력적인 무드"}</span>
        <span class="keyword-pct">${pctValue}%</span>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-bar" style="width: 0%"></div>
      </div>
    `;
    keywordsList.appendChild(itemEl);

    // 부드러운 게이지 채우기 애니메이션
    requestAnimationFrame(() => {
      setTimeout(() => {
        const bar = itemEl.querySelector(".progress-bar");
        if (bar) bar.style.width = `${pctValue}%`;
      }, 50);
    });
  });

  // 3. 추천 해시태그 4개 렌더링
  hashtagsList.innerHTML = "";
  const hashtags = Array.isArray(data.hashtags) ? data.hashtags.slice(0, 4) : [];
  hashtags.forEach((tag) => {
    const cleanTag = tag.startsWith("#") ? tag : `#${tag}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-btn";
    btn.textContent = cleanTag;
    btn.setAttribute("title", "클릭하여 복사");

    // 클릭 시 해시태그 클립보드 복사
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(cleanTag);
        const originalText = btn.textContent;
        btn.textContent = "복사됨! ✓";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove("copied");
        }, 1200);
      } catch {
        // clipboard 실패 시 fallback
      }
    });

    hashtagsList.appendChild(btn);
  });

  // 결과 화면 노출
  analysisReadyBox.classList.add("hidden");
  analyzingState.classList.add("hidden");
  analysisResultBox.classList.remove("hidden");
  analysisResultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * AI 사진 분석 실행 함수
 */
async function triggerAnalysis() {
  if (!uploadedImageUrl) {
    showAnalysisError("분석할 이미지 URL이 존재하지 않습니다. 이미지를 먼저 업로드해주세요.");
    return;
  }

  clearAnalysisError();
  analysisReadyBox.classList.add("hidden");
  analysisResultBox.classList.add("hidden");

  // 분석 중에는 'AI가 사진을 분석하고 있습니다.'라는 메시지를 보여줌
  analyzingMessage.textContent = "AI가 사진을 분석하고 있습니다.";
  analyzingState.classList.remove("hidden");

  try {
    const analysisData = await analyzeImageWithGemini(uploadedImageUrl);
    renderAnalysisResult(analysisData);
  } catch (err) {
    console.error("분석 실패:", err);
    analyzingState.classList.add("hidden");
    analysisReadyBox.classList.remove("hidden");
    showAnalysisError(
      err.message || "이미지 분석 중 오류가 발생했습니다. Vercel 환경 변수(GEMINI_API_KEY) 설정을 확인해주세요."
    );
  }
}

/**
 * 사용자가 선택한 파일을 검증하고 Cloudinary 업로드를 수행합니다.
 * @param {File} file
 */
async function handleFileSelect(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showUploadError("이미지 파일(JPG, PNG, WEBP 등)만 업로드할 수 있습니다.");
    return;
  }

  clearUploadError();
  uploadSuccessBox.classList.add("hidden");
  analysisSection.classList.add("hidden");

  // 로컬 미리보기 표시
  const localPreviewUrl = URL.createObjectURL(file);
  previewImage.src = localPreviewUrl;
  dropZoneDefault.classList.add("hidden");
  previewContainer.classList.remove("hidden");

  // 업로드 진행 중 메시지 표시 ('이미지를 업로드하고 있습니다.')
  uploadingMessage.textContent = "이미지를 업로드하고 있습니다.";
  uploadingState.classList.remove("hidden");

  try {
    const imageUrl = await uploadImageToCloudinary(file);
    uploadedImageUrl = imageUrl;
    window.uploadedImageUrl = imageUrl;

    // 업로드된 실제 Cloudinary URL로 미리보기 및 입력창 업데이트
    previewImage.src = imageUrl;
    uploadedUrlInput.value = imageUrl;
    uploadSuccessBox.classList.remove("hidden");

    // 업로드 완료 시 다음 분석 단계로 전환
    goToAnalysisStep(imageUrl);
  } catch (error) {
    console.error("Cloudinary 업로드 오류:", error);
    showUploadError(
      error.message ||
        "이미지 업로드 중 오류가 발생했습니다. Cloud Name과 Upload Preset 설정을 확인해주세요."
    );
  } finally {
    uploadingState.classList.add("hidden");
    URL.revokeObjectURL(localPreviewUrl);
  }
}

// ============================================================================
// 이벤트 리스너 등록
// ============================================================================

// 파일 입력 변경 이벤트
imageInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) {
    handleFileSelect(file);
  }
});

// 드래그 앤 드롭 이벤트
dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    handleFileSelect(file);
  }
});

// 다른 이미지 선택 버튼
changeImageBtn.addEventListener("click", () => {
  imageInput.value = "";
  imageInput.click();
});

// URL 복사 버튼
copyUrlBtn.addEventListener("click", async () => {
  if (!uploadedImageUrl) return;
  try {
    await navigator.clipboard.writeText(uploadedImageUrl);
    const originalText = copyUrlBtn.textContent;
    copyUrlBtn.textContent = "복사 완료!";
    setTimeout(() => {
      copyUrlBtn.textContent = originalText;
    }, 1800);
  } catch {
    uploadedUrlInput.select();
    document.execCommand("copy");
  }
});

// 다음 분석 단계로 이동 버튼
nextStepBtn.addEventListener("click", () => {
  goToAnalysisStep(uploadedImageUrl);
});

// 이미지 다시 선택 버튼
function resetToUpload() {
  stepBadge2.classList.remove("active");
  stepBadge1.classList.remove("completed");
  stepBadge1.classList.add("active");
  uploadSection.scrollIntoView({ behavior: "smooth", block: "start" });
  imageInput.value = "";
  imageInput.click();
}

backToUploadBtn.addEventListener("click", resetToUpload);
uploadAnotherBtn.addEventListener("click", resetToUpload);

// AI 분석 시작하기 버튼
startAnalysisBtn.addEventListener("click", triggerAnalysis);

// 다시 분석하기 버튼
reAnalyzeBtn.addEventListener("click", triggerAnalysis);
