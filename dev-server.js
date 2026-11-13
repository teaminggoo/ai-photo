// dev-server.js: 로컬 테스트용 경량 개발 서버 (추가 패키지 설치 불필요)
const http = require("http");
const fs = require("fs");
const path = require("path");

// .env 파일 자동 로드
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
  console.log("로컬 .env 파일 환경 변수 로드 완료");
}

const PORT = process.env.PORT || 3000;
const analyzeHandler = require("./api/analyze.js");

const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "text/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // 1. API 라우트 처리 (/api/analyze)
  if (pathname === "/api/analyze") {
    let bodyData = "";
    req.on("data", (chunk) => {
      bodyData += chunk;
    });

    req.on("end", async () => {
      try {
        req.body = bodyData ? JSON.parse(bodyData) : {};
      } catch {
        req.body = bodyData;
      }

      // Vercel Serverless Function 스타일 래퍼
      const mockRes = {
        _status: 200,
        _headers: {},
        setHeader(name, value) {
          res.setHeader(name, value);
          this._headers[name] = value;
          return this;
        },
        status(code) {
          this._status = code;
          res.statusCode = code;
          return this;
        },
        json(data) {
          res.statusCode = this._status;
          res.setHeader("Content-Type", "application/json; charset=UTF-8");
          res.end(JSON.stringify(data));
        },
        end(data) {
          res.statusCode = this._status;
          res.end(data);
        },
      };

      try {
        await analyzeHandler(req, mockRes);
      } catch (err) {
        console.error("API Error:", err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        }
      }
    });
    return;
  }

  // 2. 정적 파일 서빙
  let filePath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(path.join(__dirname, filePath));

  if (!safePath.startsWith(__dirname)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(safePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`로컬 개발 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
