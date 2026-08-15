# HDZ Game community

Trang web tĩnh liệt kê các game `.html` của cộng đồng, sắp xếp mới nhất → cũ nhất, có ô tìm kiếm, và hỗ trợ **game ẩn** (chỉ hiện khi gõ đúng tên).

## Cấu trúc thư mục

```
├── index.html
├── style.css
├── script.js
├── data/
│   └── games.json     ← danh sách toàn bộ game (hiện + ẩn)
├── game/               ← để file .html của game HIỆN THỊ bình thường
└── hide/                ← để file .html của game ẨN (chỉ lộ khi tìm đúng tên)
```

## Cách thêm một game mới

1. Copy file `.html` của game vào thư mục `game/` (game công khai) hoặc `hide/` (game ẩn).
2. Mở `data/games.json` và thêm một dòng mới, ví dụ:

```json
{
  "name": "Tên Game Của Bạn",
  "file": "game/ten-file-game.html",
  "date": "2026-07-23",
  "hidden": false
}
```

- `name`: tên hiển thị (và cũng là "mật khẩu" tìm kiếm nếu game bị ẩn).
- `file`: đường dẫn tương đối tới file game (`game/...` hoặc `hide/...`).
- `date`: ngày thêm game, dùng để sắp xếp mới → cũ (định dạng `YYYY-MM-DD`).
- `hidden`: `true` nếu muốn game chỉ hiện khi người dùng gõ **chính xác** tên game vào ô tìm kiếm; `false` nếu muốn hiện bình thường trong danh sách.

3. Lưu file, commit và push lên GitHub — xong!

## Cách hoạt động của phần tìm kiếm

- Game **không ẩn**: luôn hiển thị, và bị lọc theo kiểu "chứa từ khoá" khi gõ vào ô tìm kiếm (không phân biệt hoa/thường).
- Game **ẩn**: không xuất hiện trong danh sách mặc định. Chỉ hiện ra (có huy hiệu "Ẩn" màu vàng) khi người dùng gõ **đúng toàn bộ tên** (không phân biệt hoa/thường, khoảng trắng đầu/cuối được bỏ qua).

## Deploy lên GitHub Pages

1. Tạo repo mới trên GitHub, đẩy toàn bộ nội dung thư mục này lên.
2. Vào **Settings → Pages**, chọn branch (thường là `main`) và thư mục gốc (`/root`).
3. Sau vài phút, trang sẽ có ở `https://<username>.github.io/<ten-repo>/`.

## Tuỳ chỉnh

- Đổi tên web / mô tả: sửa thẻ `<h1 class="site-title">` và `<p class="tagline">` trong `index.html`, cùng thẻ `<meta name="description">`.
- Đổi màu sắc chủ đạo: sửa các biến CSS trong đầu file `style.css` (`--coral`, `--gold`, `--teal`, `--bg`...).
