# 🧮 BÉ VUI HỌC TOÁN

> Học mà chơi – Chơi mà học.

Ứng dụng web học toán dạng trò chơi dành cho trẻ 3–5 tuổi. Phiên bản 1 gồm 2 chương:

| Chương | Mã | Nội dung |
|---|---|---|
| Làm quen mặt số | `number-recognition` | 10 thẻ số 1–10 (chữ số lớn, cách đọc, hình minh họa, giọng đọc) + bài kiểm tra 10 câu |
| Bé tập đếm | `object-counting` | Đếm 1–10 hình từ thư viện **100 hình** (động vật, cây cối, hoa, trái cây, đồ vật) + bài kiểm tra 10 câu |

Hai chương dùng chung **một bộ máy trò chơi** (sinh câu hỏi, xáo đáp án, chấm điểm theo lần trả lời đầu tiên, phản hồi đúng/sai, phần thưởng, lưu dữ liệu).

---

## Mục lục

1. [Công nghệ](#1-công-nghệ)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [Kiến trúc](#3-kiến-trúc)
4. [Cài đặt & chạy local](#4-cài-đặt--chạy-local)
5. [Database & migration](#5-database--migration)
6. [Deploy lên Vercel + Neon (từng bước)](#6-deploy-lên-vercel--neon-từng-bước)
7. [Biến môi trường](#7-biến-môi-trường)
8. [REST API](#8-rest-api)
9. [Khu vực phụ huynh & bảo mật](#9-khu-vực-phụ-huynh--bảo-mật)
10. [Sao lưu & khôi phục JSON](#10-sao-lưu--khôi-phục-json)
11. [Thêm chương học mới](#11-thêm-chương-học-mới)
12. [Thêm hình minh họa / âm thanh](#12-thêm-hình-minh-họa--âm-thanh)
13. [Quản lý dữ liệu](#13-quản-lý-dữ-liệu)
14. [Kiểm thử](#14-kiểm-thử)
15. [Chi phí & giới hạn gói miễn phí](#15-chi-phí--giới-hạn-gói-miễn-phí)

---

## 1. Công nghệ

- **Frontend:** React 18, Vite, TypeScript (strict), Tailwind CSS, Framer Motion, canvas-confetti, Lucide React, React Router. Font Baloo 2 (hỗ trợ tiếng Việt) đóng gói sẵn, không tải từ Google Fonts.
- **Backend:** Vercel Functions (Node.js, TypeScript), REST API, kiểm tra dữ liệu bằng Zod.
- **Database:** Neon PostgreSQL + Drizzle ORM + Drizzle Kit (migration).
- **Dev không cần cài PostgreSQL:** khi chưa có `DATABASE_URL`, dev server tự dùng [PGlite](https://pglite.dev) (PostgreSQL chạy bằng WebAssembly), lưu tại `.data/pglite`. Production **luôn** dùng Neon.

Hình ảnh và âm thanh đều nằm trong `public/assets/` – ứng dụng không gọi đường dẫn ngoài khi chạy.

## 2. Cấu trúc thư mục

```
api/
  router.ts                 # Vercel Function DUY NHẤT – nhận mọi /api/* (qua rewrite trong vercel.json)
server/                     # Mã chỉ chạy phía server
  router.ts                 # Bảng định tuyến REST, rate limit, chống CSRF, kiểm tra quyền phụ huynh
  db.ts                     # Kết nối PostgreSQL (pg Pool) – DATABASE_URL chỉ đọc ở đây
  auth.ts                   # PIN (scrypt), cookie phiên HttpOnly ký HMAC, khoá khi nhập sai
  rateLimit.ts, errors.ts, validation.ts
  services/                 # quiz, progress, reward, history, backup, settings
db/
  schema.ts                 # Drizzle schema
  migrations/               # File SQL migration (do drizzle-kit sinh)
dev/
  apiPlugin.ts              # Gắn API vào Vite dev server (npm run dev chạy cả frontend + API)
  localDb.ts                # PGlite cho dev/test
src/
  engine/                   # BỘ MÁY TRÒ CHƠI DÙNG CHUNG (thuần TS, dùng được ở cả client & server)
    QuizEngine.ts           #   sinh bộ câu hỏi, kiểm tra hợp lệ, chấm bài nộp (server)
    QuizSession.ts          #   máy trạng thái phiên chơi: answering → correct/wrong → finished
    QuestionGenerator.ts    #   khung sinh câu hỏi không trùng
    AnswerGenerator.ts      #   sinh 4 phương án không trùng, xáo trộn
    ScoringService.ts       #   chấm điểm theo lần trả lời đầu tiên
    RewardService.ts        #   quy tắc kẹo, sticker, hộp quà
    QuizResult.ts, messages.ts, random.ts, types.ts
  chapters/
    registry.ts             # Đăng ký chương (phần thuần – server cũng dùng)
    ui-registry.tsx         # Đăng ký giao diện chương (frontend)
    number-recognition/     # config.ts, generator.ts, components/
    object-counting/        # config.ts, generator.ts, components/
  config/rewards.ts         # Số kẹo, số kẹo/hộp quà, thành tích
  data/
    numbers/numbers.ts      # Dữ liệu thẻ số
    objects/catalog.ts      # Thư viện 100 hình
    stickers.ts             # Bộ sưu tập sticker
    voice.ts                # Danh sách câu thoại có file giọng đọc
  features/                 # home, chapter, learning, quiz, rewards, parent, audio, animation
  components/               # Mascot, CountingGrid, AppHeader, ui
  services/api.ts           # REST client
public/assets/
  images/objects/           # 100 hình đếm
  rewards/                  # kẹo, hộp quà, stickers/
  sounds/                   # numbers/, cards/, praise/, phrases/, questions/, sfx/
  mascot/                   # Mochi
scripts/                    # migrate.ts, download-images.ts, generate-voice.ts, generate-sfx.ts
tests/                      # engine.test.ts, api.test.ts
```

## 3. Kiến trúc

```
 Trình duyệt (React)                         Vercel Function (api/router.ts)            Neon PostgreSQL
 ───────────────────                         ───────────────────────────────            ───────────────
 QuizPage + useQuiz ──POST /quiz/sessions──▶ startSession: QuizEngine.generateQuiz ──▶ quiz_sessions (lưu câu hỏi)
   │  (QuizSession – trạng thái thuần)  ◀─── 10 câu hỏi
   │  bé trả lời, thử lại...
   └─POST /quiz/sessions/:id/complete ─────▶ completeSession (1 TRANSACTION):
        chỉ gửi các lần chọn                   - khoá dòng phiên (FOR UPDATE), đã xong ⇒ trả kết quả cũ
                                               - evaluateSubmission: tự chấm theo câu hỏi ĐÃ LƯU
                                               - lưu quiz_answers, cập nhật progress, chapter_progress
                                               - cộng thưởng: rewards.dedupe_key UNIQUE ⇒ không cộng trùng
```

Nguyên tắc chính:

- **Một bộ máy, nhiều chương.** Chương chỉ khai báo `ChapterDefinition` (id, tên, màu, phạm vi, số câu, generator, cấu hình thưởng, bật/tắt) và phần UI (`QuestionView`, minh họa, giọng đọc). `QuizPage`, chấm điểm, hiệu ứng, phần thưởng không cần sửa khi thêm chương.
- **Server không tin client.** Câu hỏi do server sinh và lưu; client chỉ gửi danh sách lần chọn; server kiểm tra hợp lệ (đủ câu, đáp án thuộc phương án, không lặp, câu cuối phải đúng, thời gian làm bài tối thiểu) rồi tự tính điểm.
- **Không cộng thưởng trùng.** Mỗi phần thưởng có `dedupe_key` duy nhất (`session:<id>:candy`, `achievement:first-quiz`, `gift:<id>`); gọi lại API trả về kết quả cũ.
- **Lưu bền vững.** Mọi tiến độ/phần thưởng nằm trong PostgreSQL. `localStorage` chỉ đệm tuỳ chọn âm thanh/chuyển động để hiển thị nhanh.
- **Ngoại tuyến nhẹ nhàng.** Nếu mất kết nối, bé vẫn chơi được (câu hỏi sinh tại máy), kết quả hiển thị kèm ghi chú "chưa lưu được".

### Quy tắc trò chơi

- 10 câu/bài, không trùng câu trong một bài, 4 phương án, 1 đáp án đúng, vị trí xáo trộn.
- **Điểm tính theo lần trả lời đầu tiên.** Sai rồi chọn lại đúng ⇒ câu đó vẫn tính sai, nhưng bé được thử lại để học đáp án (đáp án sai đã chọn được làm mờ). Lần thử lại không được tính là câu hỏi mới.
- Đúng: Mochi vui, pháo hoa nhỏ, âm thanh + lời khen ngẫu nhiên, tự sang câu sau. Sai: Mochi buồn nhẹ, "Không sao, bé thử lại nhé!", âm thanh trầm nhẹ.
- 10/10: pháo hoa lớn toàn màn hình, "HOAN HÔ! BÉ ĐÃ HOÀN THÀNH XUẤT SẮC!", +1 kẹo (cấu hình được), sticker lần đầu đạt 10/10 của chương.
- Đủ **10 kẹo** ⇒ mở 1 hộp quà (kẹo được tích luỹ, không bị trừ) ⇒ nhận sticker ngẫu nhiên, ưu tiên sticker chưa có.
- **Làm quen mặt số** có 10 cấp: **1–10, 11–20, …, 91–100**. Mỗi cấp có thẻ học và 2 trò chơi (bấm "Chơi ngay" để chọn): **Nhìn số** ("Đây là số mấy?") và **Tìm số** (nghe "Đâu là số năm?" rồi chọn). Từ 11 trở đi, thẻ dạy theo "chục và đơn vị" (mỗi chục là một khung 10 hình, cộng hình lẻ). Mỗi trò có sticker riêng khi đạt 10/10 lần đầu.
- **Mở khoá cấp:** mỗi cấp mở khi bé đạt **ít nhất 8/10 ở cả hai trò** của cấp ngay trước (tính điểm cao nhất, chỉ cần đạt một lần). Server kiểm tra luật này (`403 level_locked`). Ngưỡng điểm: `LEVEL_UNLOCK_MIN_SCORE` trong `src/chapters/levels.ts`.
- **Cộng trừ** có 2 cấp: **Phạm vi 5** rồi **Phạm vi 10** (mở khoá như trên). Mỗi cấp 2 trò **Phép cộng** (hai nhóm hình gộp lại) và **Phép trừ** (một nhóm hình, vài hình bị gạch bỏ). Phép tính hiện dạng "2 + 3 = ?", giọng đọc "Hai cộng ba bằng mấy?". Mỗi bài 10 phép tính khác nhau, mỗi câu một loại hình ngẫu nhiên.
- **Sân chơi trí tuệ**: thẻ trên trang chủ, bấm vào để chọn 1 trong 11 chủ đề của Sân chơi tư duy (bên dưới). 5 trò kỹ năng cũ (Quan sát, Chú ý, Tư duy, Ghi nhớ, Tưởng tượng) đã gộp vào các chủ đề nên được tắt; lịch sử cũ vẫn hiện trong khu phụ huynh.
- **Sân chơi tư duy** (nằm trong thẻ **Sân chơi trí tuệ**): 11 chủ đề – Màu sắc, Hình khối, Đếm số, Toán vui, So sánh, Phân loại, Quan sát, Quy luật (bảng 3×3, sudoku hình 4×4), Mê cung & phương hướng, Chữ cái, Thời gian (trước – sau, buổi, thứ, đồng hồ). Mỗi chủ đề 4–6 cấp, cấp sau mở khi đạt 8/10 cấp trước; sticker riêng khi đạt 10/10 cấp cuối. Một câu có thể có 2–4 phương án.
- Chương 2: hình xếp lưới tự đổi bố cục theo số lượng (vd. 7 = 4+3), xuất hiện lần lượt; bé **chạm từng hình để đếm** (hình được đánh số và đọc to).

## 4. Cài đặt & chạy local

Yêu cầu: Node.js 20 trở lên.

```bash
npm install
npm run dev          # http://localhost:5173 – chạy cả frontend và API
```

Không cần cấu hình gì thêm: khi chưa có `DATABASE_URL`, API dùng PGlite tại `.data/pglite` (migration tự chạy).

Muốn dùng Neon (hoặc PostgreSQL bất kỳ) khi dev:

```bash
cp .env.example .env.local      # rồi điền DATABASE_URL
npm run db:migrate
npm run dev
```

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Dev server (frontend + API) |
| `npm run build` | Kiểm tra kiểu TypeScript + build production vào `dist/` |
| `npm run preview` | Xem bản build (chỉ frontend) |
| `npm test` | Chạy toàn bộ kiểm thử |
| `npm run db:generate` | Sinh migration mới sau khi sửa `db/schema.ts` |
| `npm run db:migrate` | Áp dụng migration vào `DATABASE_URL` (hoặc PGlite local nếu không có) |
| `npm run db:studio` | Mở Drizzle Studio để xem dữ liệu (cần `DATABASE_URL`) |
| `npm run assets:images` | Tải hình còn thiếu (khi thêm hình mới) |
| `npm run assets:voice` | Tạo giọng đọc còn thiếu (macOS) |
| `npm run assets:sfx` | Tạo lại hiệu ứng âm thanh |

> Bạn cũng có thể chạy bằng Vercel CLI (`npx vercel dev`) – khi đó API chạy qua `api/router.ts` y như production.

## 5. Database & migration

| Bảng | Vai trò |
|---|---|
| `progress` | 1 dòng: tổng kẹo, số bài hoàn thành, tổng câu đúng/sai, số hộp quà đã mở |
| `quiz_sessions` | Mỗi bài kiểm tra: chương, trạng thái, câu hỏi (JSON), thời gian, điểm, kẹo nhận |
| `quiz_answers` | Mỗi câu: đáp án đúng, lựa chọn đầu, toàn bộ các lần chọn, số lần thử (FK → `quiz_sessions`, xoá dây chuyền) |
| `rewards` | Kẹo & sticker, `dedupe_key` UNIQUE, nguồn (phiên học hoặc hộp quà) |
| `gift_openings` | Các lần mở hộp quà (id do client sinh ⇒ chống mở trùng) |
| `chapter_progress` | Theo chương: số bài, số lần 10/10, điểm cao nhất, đúng/sai, đã học thẻ, lần chơi cuối |
| `app_settings` | 1 dòng: âm thanh, giảm chuyển động, PIN đã băm, khoá ký phiên, khoá chống dò PIN |

Có index cho các cột hay truy vấn (`chapter_id`, `status + started_at`, `completed_at`, `session_id`, `reward_type + reward_code`) và ràng buộc CHECK.

**Quy trình sửa schema:**

```bash
# 1. Sửa db/schema.ts
npm run db:generate     # 2. sinh file SQL mới trong db/migrations/ – xem lại trước khi commit
npm run db:migrate      # 3. áp dụng (dev hoặc production)
```

Migration chỉ được **thêm** vào; không sửa file migration đã chạy trên production.

## 6. Deploy lên Vercel + Neon (từng bước)

### 6.1. GitHub
1. Tạo tài khoản tại <https://github.com>.
2. Tạo repository mới (ví dụ `be-vui-hoc-toan`, để Private nếu muốn). Không tạo sẵn README.
3. Push mã nguồn:
   ```bash
   git init -b main
   git add .
   git commit -m "Bé Vui Học Toán v1"
   git remote add origin https://github.com/<tài-khoản>/be-vui-hoc-toan.git
   git push -u origin main
   ```
   File `.env*` và `.data/` đã nằm trong `.gitignore` – **không** commit chúng.

### 6.2. Neon PostgreSQL
4. Tạo tài khoản tại <https://neon.tech> (gói Free).
5. Tạo Project → chọn region gần người dùng (ví dụ `AWS Asia Pacific (Singapore)`). Neon tạo sẵn database `neondb`.
6. Vào **Dashboard → Connect**, chọn **Pooled connection**, sao chép chuỗi dạng
   `postgresql://user:password@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` – đây là `DATABASE_URL`.
7. Chạy migration từ máy bạn:
   ```bash
   cp .env.example .env.local     # dán DATABASE_URL vào .env.local
   npm run db:migrate             # ✔ Đã migrate database tại ep-xxx...
   ```

### 6.3. Vercel
8. Tạo tài khoản tại <https://vercel.com> bằng GitHub (gói Hobby).
9. **Add New → Project → Import** repository vừa tạo. Vercel tự nhận Vite (`vercel.json` đã cấu hình build `npm run build`, thư mục `dist`, function `api/router.ts`, rewrite cho SPA và API).
10. Trước khi Deploy, mở **Environment Variables**, thêm `DATABASE_URL` = chuỗi Neon (chọn cả Production và Preview). Tuỳ chọn: `PARENT_SESSION_SECRET` (chuỗi ngẫu nhiên ≥ 32 ký tự).
11. Bấm **Deploy**.

> Cách khác: dùng tích hợp Neon trong Vercel Marketplace (Storage → Neon) – Vercel tự thêm `DATABASE_URL`. Vẫn cần chạy `npm run db:migrate` một lần với chuỗi đó.

### 6.4. Kiểm tra sau deploy
12. Mở `https://<tên-dự-án>.vercel.app` – trang chủ hiện 2 chương.
13. Kiểm tra API: `https://<tên-dự-án>.vercel.app/api/health` ⇒ `{"ok":true,"database":"connected",...}`.
14. Chơi 1 bài, quay về trang chủ: số bài hoàn thành tăng.
15. **Kiểm tra dữ liệu sau redeploy:** Vercel → Deployments → ⋯ → Redeploy. Mở lại trang: số bài/kẹo vẫn còn (dữ liệu nằm ở Neon, không ở Vercel).

### 6.5. Tự động triển khai
- Push lên `main` ⇒ Vercel deploy **Production**.
- Push nhánh khác / mở Pull Request ⇒ Vercel tạo **Preview deployment** với URL riêng.
- Deploy mới không đụng tới database. Khi có migration mới, chạy `npm run db:migrate` (với `DATABASE_URL` production) **trước** khi merge vào `main`.
- Khuyến nghị: tạo một Neon **branch** riêng cho Preview (Neon → Branches) và đặt `DATABASE_URL` của môi trường Preview trỏ tới branch đó để thử nghiệm không ảnh hưởng dữ liệu thật.

## 7. Biến môi trường

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | Production: **có** | Chuỗi kết nối PostgreSQL (Neon pooled). Chỉ được đọc ở `server/db.ts`; không bao giờ vào bundle frontend (Vite chỉ đưa biến `VITE_*` vào frontend). |
| `PARENT_SESSION_SECRET` | Không | Khoá ký cookie (gia đình + phụ huynh). Bỏ trống ⇒ hệ thống tự sinh và lưu trong database. |
| `FAMILY_INVITE_CODE` | Để mời gia đình khác | **Mã mời** cần nhập khi tạo gia đình mới (từ gia đình thứ 2 trở đi). Bỏ trống ⇒ đóng đăng ký. Gửi mã này cho các gia đình bạn muốn mời. |
| `MAX_FAMILIES` | Không | Số gia đình tối đa (mặc định `10`). |

Local: đặt trong `.env.local` (đã gitignore). Vercel: Project Settings → Environment Variables.

## 8. REST API

Tất cả nằm dưới `/api/`. Mọi API (trừ các API ghi "mở") cần máy đã **đăng nhập gia đình** (cookie `bvht_family`), nếu không trả `401 family_required`; dữ liệu luôn đọc/ghi theo gia đình trong cookie. Request ghi dữ liệu phải có header `X-BVHT-Client: 1` (chống CSRF). Lỗi trả về dạng `{ "error": { "code", "message", "details?" } }`.

| Method | Đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| GET | `health` | mở | Kiểm tra kết nối database |
| GET | `chapters` | mở | Danh sách chương đang bật |
| GET | `summary` | – | Dữ liệu trang chủ (tổng kẹo, tiến độ chương, sticker) – không tải lịch sử |
| POST | `quiz/sessions` | – | `{chapterId}` ⇒ tạo phiên + 10 câu hỏi |
| POST | `quiz/sessions/:id/complete` | – | `{answers:[{questionId, attempts:number[]}]}` ⇒ server chấm điểm, lưu, cộng thưởng (idempotent) |
| POST | `learning/complete` | – | `{chapterId}` ⇒ ghi nhận đã học hết thẻ |
| GET | `rewards` | – | Kẹo, sticker, số hộp quà mở được |
| POST | `rewards/gifts/open` | – | `{giftId: uuid}` ⇒ mở hộp quà (idempotent theo `giftId`) |
| GET / PUT | `settings` | – | Âm thanh, giảm chuyển động |
| GET | `family/status` | mở | Máy đã đăng nhập gia đình chưa, có tạo thêm gia đình được không |
| POST | `family/login` | mở | `{name, code}` hoặc `{name, pin}` ⇒ đăng nhập gia đình (máy được nhớ 1 năm; dùng PIN thì vào luôn khu phụ huynh) |
| POST | `family/register` | mở | `{name, code, pin, invite?}` ⇒ tạo gia đình mới (cần mã mời từ gia đình thứ 2) |
| POST | `family/logout` | mở | Thoát gia đình trên máy này |
| PUT | `family/code` · `family/name` | Phụ huynh | Đổi mã gia đình (máy khác phải đăng nhập lại) / đổi tên |
| POST | `family/logout-all` | Phụ huynh | Mọi máy khác phải đăng nhập lại |
| GET | `parent/session` | – | PIN đã thiết lập chưa, đã xác nhận chưa |
| POST | `parent/setup` · `parent/login` · `parent/logout` | – | Thiết lập PIN / đăng nhập / đăng xuất |
| POST | `parent/change-pin` · `parent/logout-all` | Phụ huynh | Đổi PIN / thu hồi mọi phiên |
| GET | `parent/stats` | Phụ huynh | Thống kê tổng & từng chương |
| GET | `history?page=&pageSize=&chapterId=` | Phụ huynh | Lịch sử có phân trang (tối đa 50/trang) |
| GET | `history/:id` | Phụ huynh | Chi tiết từng câu của một bài |
| GET | `backup/export` | Phụ huynh | Tải JSON sao lưu |
| POST | `backup/import` | Phụ huynh | `{confirm:true, backup}` ⇒ ghi đè dữ liệu |
| POST | `backup/reset` | Phụ huynh | `{confirm:"XOA"}` ⇒ xoá toàn bộ tiến độ |

Toàn bộ API gom vào **một** Vercel Function (`api/router.ts`) để nằm trong giới hạn số Function của gói Hobby và giảm cold start.

## 9. Khu vực phụ huynh & bảo mật

**Nhiều gia đình** (tối đa `MAX_FAMILIES`, mặc định 10): mỗi gia đình có tên, mã gia đình, PIN phụ huynh, kẹo, sticker, cấp, lịch sử và sao lưu **riêng**.
- **Tạo gia đình:** màn hình đầu tiên → *Tạo gia đình mới* → tên, mã gia đình (4–8 số), PIN phụ huynh (4–6 số). Gia đình đầu tiên của hệ thống tạo tự do; từ gia đình thứ 2 cần **mã mời** (`FAMILY_INVITE_CODE` trên Vercel). Chưa đặt biến này ⇒ không ai tạo thêm được.
- **Đăng nhập trên máy mới:** *tên gia đình + mã gia đình* (không phân biệt dấu/hoa thường). Máy được nhớ **1 năm** (cookie `bvht_family`, HttpOnly, ký HMAC) – bé mở là chơi ngay. Server chặn mọi API khi chưa đăng nhập.
- Mã băm bằng scrypt; sai 5 lần ⇒ khoá 5 phút. Khu phụ huynh → Cài đặt → *Gia đình*: đổi tên, đổi mã (máy khác phải đăng nhập lại), *Đăng xuất mọi máy khác*, *Thoát gia đình trên máy này*.
- **Quên mã gia đình?** Ở màn hình đăng nhập chọn *Đăng nhập bằng PIN phụ huynh* (tên + PIN) rồi đặt mã mới.
- Dữ liệu cũ trước khi có nhiều gia đình được chuyển thành gia đình **"Gia đình 1"** (giữ PIN, mã, kẹo, lịch sử) – nên đổi tên trong khu phụ huynh.

- Lối vào: biểu tượng ổ khoá nhỏ, mờ ở góc header – phải **giữ 1,5 giây** mới mở (bàn phím: nhấn Enter 3 lần). Truy cập thẳng `/phu-huynh` vẫn phải qua cổng PIN.
- Lần đầu: thiết lập PIN 4–6 số, kèm một phép nhân "dành cho người lớn".
- PIN băm bằng **scrypt + salt ngẫu nhiên**, không lưu văn bản thuần. Sai 5 lần ⇒ khoá 5 phút (lưu trong DB).
- Sau khi xác nhận, server đặt cookie `HttpOnly; SameSite=Strict; Secure` chứa token ký HMAC, hết hạn sau 30 phút. Đổi PIN ⇒ mọi phiên cũ mất hiệu lực. Không lưu gì nhạy cảm trong `localStorage`.
- **Mã PIN ở giao diện không phải là lớp bảo mật duy nhất**: mọi API nhạy cảm (lịch sử, xuất/nhập/xoá dữ liệu, đổi PIN) đều kiểm tra token tại backend.
- Chống gửi liên tục: rate limit theo IP (trong bộ nhớ mỗi instance) + giới hạn bền vững trong DB (tối đa 40 phiên mở/10 phút, khoá PIN).
- Kiểm tra mọi dữ liệu đầu vào bằng Zod; lỗi nội bộ không lộ chi tiết ra ngoài.
- Header bảo mật (`X-Frame-Options`, `nosniff`, ...) cấu hình trong `vercel.json`.

**Quên cả PIN lẫn mã gia đình?** Người quản lý mở `npm run db:studio` (hoặc SQL Editor của Neon) và chạy (thay tên gia đình):
```sql
UPDATE families SET pin_hash = NULL, session_version = session_version + 1 WHERE name = 'Nhà Tuệ Anh';
```
Gia đình chưa có PIN thì đăng nhập bằng tên + mã gia đình, rồi vào khu phụ huynh để tạo PIN mới. Nếu quên cả mã: chạy thêm `UPDATE families SET code_hash = NULL, family_version = family_version + 1 WHERE name = '...'` – khi đó đăng nhập chỉ cần tên, hãy đặt mã mới ngay. Dữ liệu học tập không bị ảnh hưởng.

## 10. Sao lưu & khôi phục JSON

Trong **Phụ huynh → Dữ liệu**:

- **Xuất dữ liệu JSON:** tải file `be-vui-hoc-toan-YYYY-MM-DD.json` gồm tiến độ, tiến độ chương, toàn bộ bài học (kèm câu hỏi và câu trả lời), phần thưởng, hộp quà, cài đặt. **Không** chứa PIN hay khoá bí mật.
- **Nhập dữ liệu JSON:** chọn file ⇒ kiểm tra sơ bộ ⇒ hộp thoại xác nhận ghi đè ⇒ server kiểm tra đầy đủ (cấu trúc, tham chiếu, tổng kẹo khớp danh sách phần thưởng, ...) rồi ghi đè trong **một transaction**. File lỗi ⇒ báo lỗi chi tiết, dữ liệu cũ giữ nguyên.
- **Xoá toàn bộ tiến độ:** phải gõ `XOA` để xác nhận. PIN được giữ lại.

Định dạng file:
```json
{
  "format": "be-vui-hoc-toan-backup",
  "schemaVersion": 1,
  "exportedAt": "2026-11-19T06:00:00.000Z",
  "data": { "progress": {}, "chapterProgress": [], "sessions": [], "rewards": [], "giftOpenings": [], "settings": {} }
}
```
Khi thay đổi định dạng: tăng `BACKUP_SCHEMA_VERSION` và thêm bước chuyển đổi trong `upgradeBackup()` (`server/services/backupService.ts`) để file cũ vẫn nhập được. Giới hạn kích thước request của Vercel là 4,5 MB (~1.000 bài học).

## 11. Thêm chương học mới

**Mở rộng phép tính** (`src/chapters/arithmetic/`):
- *Thêm cấp* (vd. cộng trừ phạm vi 20 / 100): thêm 1 dòng vào `ARITHMETIC_LEVELS` trong `config.ts` và 1 sticker cho mỗi trò trong `ARITHMETIC_GAMES`, rồi `npm run assets:images` + `npm run assets:voice`. Cặp số được sinh tự động theo `max`.
- *Thêm phép nhân / chia*: thêm một mục vào `OPERATIONS` (`operations.ts`: ký hiệu, cách đọc, `compute`, `pairs`, `answerRange`), thêm trò vào `ARITHMETIC_GAMES`, thêm cách vẽ vào `OPERATION_VIEWS` (`components/ArithmeticViews.tsx`, vd. nhân = b nhóm × a hình). Bộ sinh câu hỏi, chấm điểm, khoá cấp, phần thưởng, API không cần sửa.

**Thêm dạng bài "Sân chơi tư duy"** (`src/chapters/dada/`): câu hỏi được mô tả bằng các khối hình (`Block`: hàng, lưới, hai tranh, hiện-rồi-úp, chữ, mê cung) và hình (`Visual`: emoji, bóng bay, màu, hình khối, chữ, nhóm, đồng hồ) trong `kit.ts`; `components/DadaViews.tsx` vẽ tất cả. Thêm dạng bài = viết 1 hàm sinh câu hỏi (dùng `choiceQ` / `numberQ`) trong `topics/<chủ đề>.ts` và thêm 1 dòng vào `levels`. Thêm chủ đề = 1 file `Topic` mới + thêm vào `TOPICS` trong `config.ts`. Giọng đọc: `npm run assets:voice` tự lấy mẫu mọi câu hỏi (file `sounds/dada/<mã băm>.m4a`); câu nào thiếu file sẽ đọc bằng giọng của máy.

**Thêm cấp số mới (ví dụ 101–110):** tăng `MAX_NUMBER` trong `src/data/numbers/numbers.ts` (và bổ sung cách đọc trong `numberWord`), thêm 1 cặp sticker vào `LEVEL_STICKERS` trong `src/chapters/number-recognition/levels.ts` (khai báo trong `src/data/stickers.ts`), rồi chạy `npm run assets:images` và `npm run assets:voice`. Thẻ số, trang chương, khoá cấp, giao diện và API tự nhận cấp mới.

Ví dụ thêm một chương hoàn toàn mới (`my-chapter`):

1. **Tạo thư mục** `src/chapters/my-chapter/`.
2. **generator.ts** – tái sử dụng engine, chỉ mô tả cách tạo 1 câu (với chương nhận biết số có thể dùng lại `numberRecognitionGenerator`):
   ```ts
   import { createQuestionGenerator } from '../../engine/QuestionGenerator.js';
   import { generateNumericOptions } from '../../engine/AnswerGenerator.js';
   // ... trả về { id, type, prompt, payload, correctAnswer, options }
   ```
   Lưu ý: mã dùng chung với server phải import kèm đuôi `.js`.
3. **config.ts** – khai báo `ChapterDefinition`: `id`, `name`, `description`, `icon`, `theme`, `order`, `enabled`, `range: {min: 11, max: 20}`, `quiz: {questionCount, optionCount, minDurationMs}`, `hasLearningStage`, `rewards`, `generator`.
4. **Đăng ký** trong `src/chapters/registry.ts` (mảng `CHAPTERS`).
5. **Giao diện** trong `src/chapters/ui-registry.tsx`: `Icon`, `Illustration`, `QuestionView`, `promptVoice`, tuỳ chọn `Learning`.
6. Thêm giọng đọc (nếu có câu thoại mới) vào `src/data/voice.ts` rồi `npm run assets:voice`.
7. Thêm kiểm thử trong `tests/` và chạy `npm test`.

Không cần sửa `QuizPage`, `useQuiz`, chấm điểm, phần thưởng, API hay database – trang chủ tự hiển thị chương mới. Tắt chương: đặt `enabled: false` (dữ liệu cũ vẫn hiện trong thống kê phụ huynh).

Phép cộng/trừ: payload kiểu `{ a, b, op }`, `correctAnswer = a ± b`, `QuestionView` hiển thị hình minh họa hai nhóm – vẫn dùng `generateNumericOptions` và toàn bộ bộ máy hiện có. `CountingGrid` đã hỗ trợ số lượng > 10.

## 12. Thêm hình minh họa / âm thanh

**Hình đếm** (`src/data/objects/catalog.ts`):
```ts
o('snowman', 'người tuyết', 'thing', 'Snowman'),
//  id       nhãn có loại từ   nhóm     tên thư mục trong repo fluentui-emoji
```
Rồi chạy:
```bash
npm run assets:images   # tải public/assets/images/objects/snowman.svg
npm run assets:voice    # tạo "Có bao nhiêu người tuyết?" (macOS)
npm test                # kiểm tra mọi hình đều có ảnh + âm thanh
```
Muốn dùng hình tự vẽ: đặt file SVG/PNG vào `public/assets/images/objects/<id>.svg` (cùng phong cách, nền trong suốt) – không cần chạy script tải. Chỉ dùng hình có giấy phép rõ ràng và ghi nguồn vào `public/assets/LICENSES.md`.

**Giọng đọc:** file `.m4a` trong `public/assets/sounds/`. Có thể thay bằng file thu âm thật (giữ nguyên tên). Nếu một file bị thiếu, ứng dụng dùng giọng tiếng Việt của trình duyệt (nếu thiết bị có).

**Sticker:** thêm vào `src/data/stickers.ts` (`kind: 'gift'` để xuất hiện trong hộp quà) rồi `npm run assets:images`.

**Cấu hình thưởng:** `src/config/rewards.ts` (`defaultCandiesForPerfect`, `candiesPerGift`, thành tích) hoặc `rewards.candiesForPerfect` trong config từng chương.

## 13. Quản lý dữ liệu

- **Xem dữ liệu:** `npm run db:studio`, hoặc Neon Console → Tables / SQL Editor.
- **Sao lưu định kỳ:** dùng nút Xuất JSON; Neon Free còn có point-in-time restore trong khoảng thời gian giới hạn của gói.
- **Dọn dẹp tự động:** phiên làm bài bỏ dở quá 24 giờ được xoá khi bắt đầu phiên mới.
- **Reset dữ liệu dev:** xoá thư mục `.data/`.

## 14. Kiểm thử

```bash
npm test
```

- `tests/engine.test.ts` – 10 thẻ số; sinh đúng 10 câu, không trùng, 4 đáp án, 1 đáp án đúng, có xáo trộn (chạy với 200 seed); chấm theo lần đầu; trả lời lại; thư viện ~100 hình đủ ảnh + âm thanh; số lượng 1–10; quy tắc kẹo/sticker/hộp quà; server từ chối bài nộp giả mạo.
- `tests/api.test.ts` – chạy API thật trên PostgreSQL (PGlite trong bộ nhớ): lưu/đọc lịch sử có phân trang, cập nhật tiến độ, **không cộng thưởng trùng** khi gọi lặp song song, hộp quà idempotent, quyền phụ huynh, PIN băm, khoá dò PIN, rate limit, xuất JSON → xoá → nhập lại khôi phục chính xác, file nhập lỗi không làm mất dữ liệu.

Kiểm tra deploy: `npm run build` thành công, sau deploy gọi `/api/health` và làm theo mục 6.4.

## 15. Chi phí & giới hạn gói miễn phí

Ứng dụng được thiết kế để vừa với gói miễn phí **tại thời điểm viết**: Vercel Hobby (1 Function, tài nguyên tĩnh có cache) và Neon Free (dữ liệu rất nhỏ – mỗi bài học vài KB). Trang chủ chỉ gọi 1 API nhẹ, lịch sử có phân trang, không polling, không dịch vụ trả phí. Hạn mức của các nhà cung cấp có thể thay đổi – hãy kiểm tra trang giá của Vercel và Neon; ứng dụng **không** đảm bảo miễn phí vĩnh viễn hay không giới hạn. Neon Free có thể "ngủ" khi không dùng, lần mở đầu tiên sau đó có thể chậm vài giây.

---

Nguồn hình ảnh & âm thanh: xem [`public/assets/LICENSES.md`](public/assets/LICENSES.md).
