# Crypto Strategy Lab – Nền Tảng Phân Tích, Kết Hợp & Đánh Giá Chiến Lược Giao Dịch Crypto

> **Đồ án môn học**: Kiến trúc Phần mềm (Software Architecture) – HK3 25-26  
> **Trường Đại học Khoa học Tự nhiên – ĐHQG-HCM (HCMUS)**  
> **Trọng tâm**: Thiết kế Kiến trúc Phần mềm mở rộng (Plugin Architecture), xử lý thời gian thực bất đồng bộ (WebSocket Multiplexing), giải thuật di truyền tối ưu hóa (Genetic Algorithm), hạch toán rủi ro định lượng (Stop Loss / Take Profit / 5bps Slippage) và xử lý ngôn ngữ tự nhiên (NLP FinBERT & AI Strategy Studio).

---

## 📌 Các Module Tính Năng Chính (System Capabilities)

### 1. 📈 Giám Sát Thị Trường Realtime Đa Khung Thời Gian (Market Dashboard)
- **4 Biểu đồ nến đồng thời**: Theo dõi đồng thời 4 khung thời gian độc lập (`5m`, `15m`, `1h`, `4h` hoặc `1m`, `30m`, `1d`).
- **WebSocket Multiplexing**: Kết nối luồng Binance WSS một lần ở Backend và phân phối đa luồng tới các component Frontend mà không gây tải phụ cho sàn.
- **Đổi Timeframe động**: Thay đổi khung thời gian của từng biểu đồ độc lập mà không cần reload toàn bộ trang web.

### 2. 🧪 Phòng Thí Nghiệm Backtest Chuyên Sâu (Backtest Workbench - `/backtest`)
- **Tách riêng thành Tab độc lập**: Tối ưu không gian làm việc rộng rãi, toàn màn hình.
- **Cấu hình kiểm thử 6 thông số chuẩn xác**:
  - Chọn Pair/Coin (`BTC/USDT`, `ETH/USDT`, `SOL/USDT`, `BNB/USDT`, `XRP/USDT`...).
  - Chọn Timeframe (`1m`, `5m`, `15m`, `1h`, `4h`, `1d`).
  - Chọn Vốn ban đầu (Mặc định `$100.00`).
  - Phí giao dịch (`0.05%`) và Giả lập **Slippage 5bps** (`0.05%`).
  - Khoảng thời gian kiểm thử (`From - To` Date Range) kèm phím chọn nhanh `7D`, `30D`, `90D`, `ALL`.
  - Quản trị rủi ro: **Stop Loss (%)**, **Take Profit (%)**, **Trailing Stop (%)**.
  - Chiến lược Đơn / Đa hợp nhất (`AND`, `OR`, `WEIGHTED` có thanh trượt trọng số).
- **Bảng lịch sử lệnh chi tiết 12 cột**: `#`, `Pair/Coin`, `Hướng (LONG/SHORT)`, `Thời gian vào`, `Giá vào`, `Vốn USD`, `Stoploss`, `TakeProfit`, `Thời gian ra`, `Giá ra`, `Phí (Cost)`, `Slippage (5bps)`, `Net Profit ($ & %)`.
- **Khung thống kê tổng hợp**: Winrate (Wins / Losses), Total Net Profit ($ & %), Max Drawdown (MDD), Profit Factor, Sharpe Ratio, Total Trades, Tổng Phí + Slippage.
- **Trực quan hóa trên Chart**: Đánh dấu mũi tên **BUY (Xanh)** và **SELL (Đỏ)**, click vào dòng lệnh trong bảng để zoom và highlight nến tương ứng.

### 3. 🤖 AI Strategy Studio & Natural Language Parser (`/strategy-studio`)
- **Thiết kế 4 cột chuyên dụng chuẩn theo slide giảng viên**:
  - **Cột 1: Input**: Nhập mô tả chiến lược bằng ngôn ngữ tự nhiên (prompt) hoặc dán link bài viết phân tích kỹ thuật / TradingView để crawl tự động.
  - **Cột 2: Strategy Đã Phân Tích**: Bóc tách tự động điều kiện LONG, điều kiện SHORT, Quản trị rủi ro (Stop Loss 2%, Take Profit 4%), Khung thời gian và Cặp coin áp dụng.
  - **Cột 3: Định Nghĩa Strategy (JSON)**: Hiển thị mã JSON chuẩn hóa có cấu trúc và nút **Sao chép** (Copy JSON).
  - **Cột 4: Kiểm Tra & Validation + Lưu Thư Viện**: Checklist kiểm tra thiếu trường, kiểm tra logic, chỉ báo hỗ trợ, trạng thái hợp lệ, form lưu tên/version/tags và nút **"Chạy Backtest Ngay"**.

### 4. 🧬 AI Search Engine & Continuous Strategy Loop (`/search`)
- Tự động sinh và tối ưu hóa hàng ngàn tổ hợp tham số chiến lược.
- Tích hợp 2 thuật toán: **Random Search** và **Genetic Algorithm (Giải thuật Di truyền - GA)** qua các thế hệ tiến hóa.
- Quản lý vòng lặp ngầm: Bắt đầu, Tạm dừng (Pause), Tiếp tục (Resume) và Dừng khi đạt điều kiện dừng (Stop Condition).

### 5. 🏆 Bảng Xếp Hạng Động Theo Sự Kiện (Leaderboard - `/leaderboard`)
- Xếp hạng **Top-10 Chiến Lược Vượt Trội** dựa trên hàm mục tiêu tổng hợp (*Overall Score = 0.4 Return + 0.3 Winrate + 0.2 MDD + 0.1 Sharpe*).
- **Kiến trúc hướng sự kiện (Event-Driven)**: Tự động cập nhật bảng xếp hạng tức thì qua Pub/Sub khi có ứng viên mới phá vỡ kỷ lục mà không cần refresh trình duyệt.

### 6. 📰 Thu Thập Tin Tức Thông Minh & NLP Sentiment Analysis (`/news`)
- **Smart Web Crawler**: Tự động nhận diện cấu trúc thẻ HTML bài viết và lưu schema vào SQLite (`crawler_tag_schemas`) để tái sử dụng.
- **NLP Sentiment Engine**: Sử dụng mô hình Machine Learning **FinBERT** (`distilroberta-finetuned-financial-news-sentiment-analysis`) chấm điểm cảm xúc tin tức và kích hoạt chiến lược `NewsSentimentStrategy`.

---

## 🏛️ Sơ Đồ Kiến Trúc Hệ Thống (Software Architecture Diagram)

```mermaid
graph TD
    subgraph "Frontend Client (React 19 + TypeScript + Vite)"
        Dashboard["Market Dashboard (4-Timeframe Live)"]
        Backtest["Backtest Workbench (/backtest)"]
        Studio["AI Strategy Studio (/strategy-studio)"]
        Search["AI Search Engine (/search)"]
        Leaderboard["Leaderboard Top-K (/leaderboard)"]
        News["News Feed & Sentiment (/news)"]
    end

    subgraph "FastAPI Backend & Interface Adapters"
        REST["REST API Endpoints"]
        WSMultiplexer["WebSocket Multiplexer Manager"]
    end

    subgraph "Application Core & Trading Engine"
        Registry["Strategy Registry (Plugin Architecture)"]
        Composite["Composite Strategy (AND/OR/WEIGHTED)"]
        Simulator["Trade Simulator (SL/TP/Fee/5bps Slippage)"]
        Evaluator["Financial Metrics Evaluator"]
        SearchManager["Search Engine (Random & Genetic GA)"]
        SmartCrawler["Smart HTML Crawler & Tag Learner"]
        Sentiment["FinBERT ML Sentiment Service"]
        NLPParser["AI Natural Language Strategy Parser"]
    end

    subgraph "Message Broker & Data Tier"
        EventBus[("EventBus / Redis Message Broker")]
        DB[("Database (SQLite / PostgreSQL)")]
    end

    subgraph "External Providers"
        BinanceAPI["Binance REST API"]
        BinanceWS["Binance WebSocket Feed"]
        NewsSources["Crypto News & RSS Sources"]
    end

    Frontend Client <-->|HTTP REST| REST
    Frontend Client <-->|WebSocket Stream| WSMultiplexer

    REST --> Application Core & Trading Engine
    WSMultiplexer --> BinanceWS

    Application Core & Trading Engine --> EventBus
    EventBus --> Leaderboard
    EventBus --> WSMultiplexer

    Application Core & Trading Engine --> DB
    Application Core & Trading Engine --> BinanceAPI
    Application Core & Trading Engine --> NewsSources
```

---

## ⚡ Các Vấn Đề Kiến Trúc & Giải Pháp Cốt Lõi (Architectural Drivers)

| Vấn đề Kiến trúc | Giải pháp Thực thi Cụ thể |
| :--- | :--- |
| **Modifiability (Mở rộng)** | **Plugin Architecture & Registry**: Bổ sung chiến lược mới chỉ cần kế thừa `BaseStrategy` và đăng ký vào `StrategyRegistry`. Hoàn toàn không sửa Controller, Backtester hay Leaderboard. |
| **Decoupling (Lỏng khớp)** | **Event-Driven Architecture (EventBus)**: `BacktestEvaluator` publish sự kiện `BACKTEST_COMPLETED`, `LeaderboardService` tự lắng nghe và cập nhật mà không gọi trực tiếp hàm của nhau. |
| **Realtime Low-latency** | **WebSocket Multiplexing**: Một kết nối Binance duy nhất tại Backend phục vụ đồng thời nhiều Client và nhiều biểu đồ, tránh chạm giới hạn Rate Limit của sàn. |
| **Scalability (Chịu tải)** | **Celery Worker Pool & Redis Streams**: Tách các tác vụ tìm kiếm hàng ngàn thế hệ di truyền ra các tiến trình chạy ngầm phân tán. |
| **Reproducibility (Tái lập)** | **Strategy Versioning & Schema Persistence**: Mọi kết quả trên Leaderboard liên kết chặt chẽ với bản ghi `strategy_definitions` lưu đầy đủ JSON cấu hình, phiên bản và tham số. |
| **Fault Tolerance (Khả năng chịu lỗi)** | **Isolated Fault Domains**: Lỗi crawl tin tức hay lỗi kết nối mạng không làm ảnh hưởng đến luồng WebSocket biểu đồ nến. |

---

## 🛠️ Hướng Dẫn Cài Đặt & Khởi Chạy (Installation & Quick Start)

### 1. Yêu Cầu Môi Trường
- **Python**: `>= 3.10`
- **Node.js**: `>= 18.x`

### 2. Cài Đặt & Chạy Backend
```bash
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Tạo và kích hoạt môi trường ảo Python
# Windows:
python -m venv venv
venv\Scripts\activate
# Linux/macOS:
# python3 -m venv venv
# source venv/bin/activate

# 3. Cài đặt các thư viện phụ thuộc
pip install -r requirements.txt

# 4. Khởi chạy FastAPI Server
uvicorn src.main:app --reload --port 8000
```
- API Documentation (Swagger UI): [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Cài Đặt & Chạy Frontend
```bash
# 1. Di chuyển vào thư mục frontend
cd frontend

# 2. Cài đặt các gói npm
npm install

# 3. Khởi chạy Vite Dev Server
npm run dev
```
- Truy cập giao diện người dùng: [http://localhost:5173](http://localhost:5173)

---

## 🧪 Chạy Test Suite Tự Động (Automated Testing)

Chạy bộ kiểm thử tự động kiểm tra toàn bộ API Endpoints, Composite Strategy Logic và Financial Evaluator:

```bash
# Chạy tại thư mục gốc của dự án:
$env:PYTHONPATH="backend"; pytest backend/src/tests/test_main_api.py backend/src/strategies/test_composite.py backend/src/services/backtest/test_evaluator.py
```

---

## 📚 Danh Mục Tài Liệu Bàn Giao (Deliverables Documentation)

Tất cả các tài liệu kỹ thuật chi tiết đã được biên soạn đầy đủ trong thư mục [`docs/`](file:///c:/Users/admin/Documents/HCMUS/HK3%2025-26/KTPM/Project/docs/):

1. 📄 **[Tài Liệu Kiến Trúc Tổng Thể (docs/architecture.md)](file:///c:/Users/admin/Documents/HCMUS/HK3%2025-26/KTPM/Project/docs/architecture.md)**: Chi tiết bối cảnh hệ thống C4 Model, phân rã container/module, phân tích luồng dữ liệu và giải đáp 8 câu hỏi kiến trúc cốt lõi.
2. 🎬 **[Kịch Bản Trình Diễn 10 Bước (docs/demo-scenario.md)](file:///c:/Users/admin/Documents/HCMUS/HK3%2025-26/KTPM/Project/docs/demo-scenario.md)**: Kịch bản demo từng bước chuẩn theo tài liệu giảng viên từ Market Live $\rightarrow$ AI Search $\rightarrow$ Leaderboard $\rightarrow$ Backtest 12 cột $\rightarrow$ News NLP $\rightarrow$ AI Studio.
3. 📝 **Danh Sách Các Quyết Định Kiến Trúc (Architecture Decision Records - ADRs)**:
   - [ADR-001: Adoption of FastAPI & Async Architecture](file:///c:/Users/admin/Documents/HCMUS/HK3%2025-26/KTPM/Project/docs/adr/ADR-001.md)
   - [ADR-002: Plugin Architecture for Strategy Discovery](file:///c:/Users/admin/Documents/HCMUS/HK3%2025-26/KTPM/Project/docs/adr/ADR-002.md)
   - [ADR-003: Composite Strategy Pattern (AND/OR/WEIGHTED)](file:///c:/Users/admin/Documents/HCMUS/HK3%2025-26/KTPM/Project/docs/adr/ADR-003.md)
   - [ADR-004: Event-Driven Architecture (EventBus)](file:///c:/Users/admin/Documents/HCMUS/HK3%2025-26/KTPM/Project/docs/adr/ADR-004.md)
   - [ADR-005: Database Selection & Schema Migrations](file:///c:/Users/admin/Documents/HCMUS/HK3%2025-26/KTPM/Project/docs/adr/ADR-005.md)
   - [ADR-006: Dedicated Backtest Workbench & AI Strategy Studio with Standardized JSON](file:///c:/Users/admin/Documents/HCMUS/HK3%2025-26/KTPM/Project/docs/adr/ADR-006.md)
