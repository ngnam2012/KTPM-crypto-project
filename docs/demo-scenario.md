# Kịch Bản Trình Diễn Hệ Thống (Demo Scenario Walkthrough)
## Crypto Strategy Lab – Đồ Án Cuối Kỳ Kiến Trúc Phần Mềm

> Tài liệu này được xây dựng dựa trên kịch bản chuẩn 10 bước trong tài liệu đặc tả đồ án (Trang 50 – 53), giúp sinh viên và nhóm phát triển tự tin trình bày toàn bộ các thành phần kiến trúc hoạt động cùng nhau trong buổi bảo vệ.

---

## 🚀 Khởi Chạy Môi Trường Trình Diễn

1. **Khởi động Backend API**:
   ```bash
   cd backend
   venv\Scripts\activate
   uvicorn src.main:app --reload --port 8000
   ```
2. **Khởi động Frontend Web Application**:
   ```bash
   cd frontend
   npm run dev
   ```
3. Mở trình duyệt tại địa chỉ: `http://localhost:5173`.

---

## 🎬 10 Bước Trình Diễn Chuẩn Theo Yêu Cầu Giảng Viên

### Bước 1: Giám Sát Thị Trường Realtime Đa Khung Thời Gian (Market Dashboard)
- **Hành động**: Mở tab **Market Dashboard** (`/`). Chọn cặp giao dịch `BTC/USDT`.
- **Thực tế hiển thị**:
  - 4 biểu đồ nến thời gian thực hiển thị đồng thời: **5m**, **15m**, **1h**, **4h**.
  - Các cây nến nhấp nháy cập nhật giá liên tục khi có tick mới từ Binance WebSocket.
  - Thay đổi khung thời gian biểu đồ 1 (từ `5m` sang `1m`) $\rightarrow$ Chỉ biểu đồ 1 cập nhật lại dữ liệu, 3 biểu đồ còn lại và toàn bộ hệ thống **không bị reload lại trang**.
- **Ý nghĩa kiến trúc**: Chứng minh kiến trúc **WebSocket Multiplexer** giúp kết nối Binance một lần và phân phối đa luồng độc lập đến từng Chart Component trên Frontend.

---

### Bước 2: Lựa Chọn Không Gian Chiến Lược Tìm Kiếm (AI Search Space)
- **Hành động**: Chuyển sang tab **AI Search** (`/search`).
- **Thực tế hiển thị**:
  - Giao diện chọn các chiến lược phân tích kỹ thuật: `Moving Average (MA)`, `RSI`, `Bollinger Bands`, `Support/Resistance`.
  - Thiết lập số lượng thế hệ (Generations), kích thước quần thể (Population) và hàm thích nghi.
- **Ý nghĩa kiến trúc**: Không gian tìm kiếm tham số được định nghĩa độc lập dưới dạng tập hợp cấu hình JSON.

---

### Bước 3: Khởi Động Quá Trình Tìm Kiếm Tự Động (Start Search)
- **Hành động**: Bấm nút **START SEARCH**.
- **Thực tế hiển thị**:
  - Nút chuyển trạng thái, hiển thị hiệu ứng quét tự động.
  - Bộ điều khiển cho phép **PAUSE / RESUME** hoặc **STOP** tiến trình tìm kiếm bất cứ lúc nào.
- **Ý nghĩa kiến trúc**: Khởi tạo tiến trình bất đồng bộ chạy ngầm (Background Task / Worker Loop) độc lập với Main UI Thread.

---

### Bước 4: Theo Dõi Tiến Trình Tìm Kiếm & Vòng Lặp Ngầm (Continuous Loop)
- **Hành động**: Quan sát màn hình trạng thái trực tiếp.
- **Thực tế hiển thị**:
  - `Candidates tested: 125+`
  - `Current Candidate: MA(20) + RSI(14) + SupportResistance (Logic: WEIGHTED)`
  - `Trạng thái: Backtesting & Evaluating...`
  - Biểu đồ tiến hóa (Fitness Curve) thể hiện hiệu quả sinh lời tăng dần qua các thế hệ của Giải thuật Di truyền (GA).
- **Ý nghĩa kiến trúc**: Minh chứng luồng **Generate Candidate $\rightarrow$ Simulate Trades $\rightarrow$ Evaluate Metrics $\rightarrow$ Rank Score**.

---

### Bước 5: Bảng Xếp Hạng Leaderboard Cập Nhật Tự Động (Event-Driven)
- **Hành động**: Chuyển sang tab **Leaderboard** (`/leaderboard`).
- **Thực tế hiển thị**:
  - Danh sách **Top 10 Chiến Lược Tốt Nhất** hiển thị đầy đủ thông số:
    - **#1**: `MA20 + RSI14 + SR` | Return: `+24.2%` | Win Rate: `62.0%` | MDD: `-6.1%` | Overall Score: `84.2`
    - **#2**: `MA50 + BB` | Return: `+21.7%` | Win Rate: `55.0%` | MDD: `-8.4%` | Overall Score: `78.5`
    - **#3**: `RSI + SR` | Return: `+18.4%` | Win Rate: `64.0%` | MDD: `-6.7%` | Overall Score: `75.1`
  - Khi có một ứng viên mới đạt điểm cao hơn Top 10, danh sách **tự động nhảy thứ hạng theo thời gian thực mà không cần người dùng F5 tải lại trang**.
- **Ý nghĩa kiến trúc**: Chứng minh **Event-Driven Architecture**: Sự kiện `BACKTEST_COMPLETED` được publish lên `EventBus`, `LeaderboardService` bắt sự kiện và thông báo tới Frontend qua WebSocket Channel.

---

### Bước 6: Trực Quan Hóa Tín Hiệu & Điểm Vào Lệnh Trên Biểu Đồ (Visualization)
- **Hành động**: Nhấp chọn chiến lược Top #1 trên Leaderboard hoặc chuyển sang tab **Backtest Lab** (`/backtest`).
- **Thực tế hiển thị**:
  - Biểu đồ nến kích thước lớn tự động vẽ các đường chỉ báo kỹ thuật liên quan: Đường trung bình `MA20`, vùng `Support / Resistance`, dải `Bollinger Bands`.
  - Mũi tên tín hiệu **BUY (Màu xanh)** và **SELL (Màu đỏ)** xuất hiện chính xác tại các điểm giao dịch lịch sử.
- **Ý nghĩa kiến trúc**: Tách bạch giữa tính toán tín hiệu (Strategy Engine) và hiển thị đồ họa (Chart Component).

---

### Bước 7: Bảng Chi Tiết Lệnh 12 Cột & Hạch Toán Rủi Ro (Trade Detail)
- **Hành động**: Quan sát bảng **Lịch Sử Lệnh Chi Tiết (Trade Detail Table)** bên dưới biểu đồ.
- **Thực tế hiển thị**:
  - **Khung thống kê tổng hợp**:
    - `Winrate: 40.0% (Wins: 40 | Losses: 60)`
    - `Total Profit: +$50.00 (+50.0%)`
    - `Max Drawdown: -70.0%`
    - `Profit Factor: 1.85`, `Sharpe Ratio: 1.42`
    - `Total Trades: 100`, `Tổng Phí & Trượt giá 5bps: $5.00`
  - **Bảng 12 cột chuẩn xác**:
    1. `#` (STT) | 2. `Pair/Coin` | 3. `Hướng (LONG/SHORT)` | 4. `Thời gian vào` | 5. `Giá vào` | 6. `Vốn USD ($100)` | 7. `Stoploss` | 8. `TakeProfit` | 9. `Thời gian thoát` | 10. `Giá ra` | 11. `Phí (Cost)` | 12. `Slippage (5bps)` | 13. `Net Profit ($ và %)`
  - **Tương tác trực quan**: Click vào dòng lệnh bất kỳ trong bảng $\rightarrow$ Biểu đồ tự động cuộn tới và phóng to cây nến vào/thoát lệnh tương ứng.
  - Hỗ trợ bộ lọc nhanh (*ALL, WINS, LOSSES, LONG, SHORT*) và nút **Xuất CSV**.
- **Ý nghĩa kiến trúc**: `TradeSimulator` hạch toán chi tiết chi phí và quản trị rủi ro Stop Loss / Take Profit theo tiêu chuẩn tài chính định lượng.

---

### Bước 8: Thu Thập & Phân Tích Cảm Xúc Tin Tức (News NLP Sentiment)
- **Hành động**: Chuyển sang tab **News Feed** (`/news`).
- **Thực tế hiển thị**:
  - Danh sách tin tức realtime từ CryptoPanic, Cointelegraph, Binance News.
  - Đồng hồ cảm xúc thị trường (**Market Sentiment Gauge**) và phân bổ sắc thái:
    - `Positive (Tích cực): 42%`
    - `Neutral (Trung lập): 38%`
    - `Negative (Tiêu cực): 20%`
  - Từng bài viết có điểm số `sentiment_score` do mô hình NLP FinBERT chấm điểm.
- **Ý nghĩa kiến trúc**: Dữ liệu phi cấu trúc (Văn bản tin tức) được chuẩn hóa thành dạng số liệu định lượng (Numeric Sentiment Score).

---

### Bước 9: Mở Rộng Không Gian Chiến Lược Với NLP Sentiment (SentimentStrategy)
- **Hành động**: Thêm chiến lược `NewsSentimentStrategy` vào tổ hợp giao dịch.
- **Thực tế hiển thị**:
  - `NewsSentimentStrategy` kết hợp điều kiện: Nếu `Average Sentiment 1h > 0.65` thì BUY, nếu `< 0.35` thì SELL.
  - Chạy thử nghiệm chiến lược đa yếu tố: `MA + RSI + News Sentiment`.
- **Ý nghĩa kiến trúc**: Chứng minh tính **Extensibility** – Hệ thống không bị giới hạn ở phân tích kỹ thuật (TA) mà dễ dàng tích hợp thêm các yếu tố cơ bản (FA) và cảm xúc xã hội.

---

### Bước 10: AI Strategy Studio & Tạo Chiến Lược Từ Ngôn Ngữ Tự Nhiên (Studio AI)
- **Hành động**: Mở tab **AI Strategy Studio** (`/strategy-studio`).
- **Thực tế hiển thị**:
  - **Cột 1**: Nhập câu lệnh: *"RSI 30 và giá nằm dưới Bollinger Lower Band 20, Stop loss 2%, take profit 4%"* hoặc dán link bài viết TradingView $\rightarrow$ Nhấn **"Phân tích bằng LLM"**.
  - **Cột 2**: Hiển thị trực quan điều kiện Long/Short và Quản trị rủi ro (SL 2%, TP 4%).
  - **Cột 3**: Hiển thị code JSON chuẩn hóa cấu trúc có thể sao chép.
  - **Cột 4**: Hiển thị kết quả **Validation hợp lệ 100%** $\rightarrow$ Bấm **"Lưu vào Thư Viện"** và nhấn **"Chạy Backtest Ngay"** để chuyển thẳng sang chạy mô phỏng.
- **Ý nghĩa kiến trúc**: Chứng minh khả năng tự động hóa chuyển đổi từ ý tưởng người dùng sang đặc tả phần mềm chuẩn hóa có thể thực thi ngay lập tức.

---

## 🏆 Tổng Kết Buổi Demo
Qua 10 bước trên, giảng viên và hội đồng có thể kiểm chứng đầy đủ 6 trụ cột cốt lõi của đồ án:
1. **Realtime System**: WebSocket stream độ trễ thấp, không gián đoạn.
2. **Plugin Architecture**: Đăng ký và mở rộng chiến lược không sửa core engine.
3. **Composite Strategy**: Hợp nhất đa chiến lược linh hoạt (AND/OR/WEIGHTED).
4. **Genetic Algorithm & Search Loop**: Tối ưu hóa tham số tự động.
5. **FinBERT NLP Sentiment & Smart Crawler**: Tự động học tag schema và lượng hóa tin tức.
6. **AI Studio & Backtest 12 Cột**: Chuẩn hóa JSON, quản trị rủi ro SL/TP và hạch toán tài chính chính xác.
