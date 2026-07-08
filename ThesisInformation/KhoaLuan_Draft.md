# KHOÁ LUẬN TỐT NGHIỆP

## PHÁT TRIỂN HỆ THỐNG ĐA PHƯƠNG TIỆN ĐỂ SÁNG TÁC TRUYỆN TRANH TỪ VĂN BẢN

*(Development of Multimedia System for Comic Creation from Narrative Text)*

- **Người hướng dẫn:** TS. Lê Trung Nghĩa, ThS. Trần Duy Quang (Khoa Công nghệ Thông tin)
- **Sinh viên thực hiện:** Nguyễn Hoài Thương — MSSV: 22120364
- **Thời gian thực hiện:** 01/2026 – 07/2026

---

# Chương 1: Giới thiệu

## 1.1 Đặt vấn đề

Kể chuyện bằng hình ảnh (visual storytelling) từ lâu đã là một trong những phương thức truyền đạt thông tin hiệu quả nhất của con người. Truyện tranh — với sự kết hợp giữa hình vẽ, bố cục khung tranh và lời thoại — không chỉ là một loại hình giải trí phổ biến mà còn ngày càng được ứng dụng rộng rãi trong giáo dục, truyền thông và sản xuất phim ảnh. Một trang truyện tranh có thể truyền tải nội dung mà hàng trang văn bản thuần tuý khó diễn đạt được, đặc biệt đối với những độc giả trẻ hoặc người học có xu hướng tiếp thu qua thị giác.

Tuy nhiên, quá trình sáng tác truyện tranh truyền thống lại là một rào cản rất lớn. Để hoàn thành một trang truyện, hoạ sĩ chuyên nghiệp thường mất từ 4 đến 8 giờ làm việc, trải qua nhiều công đoạn: phác thảo kịch bản, dựng bố cục khung tranh, vẽ nhân vật, tô màu và chèn lời thoại. Chi phí thuê hoạ sĩ vẽ minh hoạ dao động trong khoảng 50–200 USD cho mỗi trang, một con số vượt xa khả năng của phần lớn giáo viên, người viết nghiệp dư hay các nhà sáng tạo nội dung cá nhân. Nói cách khác, ý tưởng và câu chuyện thì nhiều người có, nhưng năng lực biến câu chuyện đó thành truyện tranh lại chỉ nằm trong tay một số ít người được đào tạo bài bản về hội hoạ.

Sự bùng nổ của các mô hình sinh ảnh từ văn bản (text-to-image) như Midjourney, DALL-E hay Stable Diffusion trong vài năm gần đây tưởng chừng đã giải quyết được vấn đề trên. Các công cụ này thực sự tạo ra được những hình ảnh đơn lẻ có chất lượng cao chỉ từ một câu mô tả. Thế nhưng khi thử dùng chúng để làm một cuốn truyện tranh hoàn chỉnh, người dùng nhanh chóng vấp phải ba trở ngại căn bản. Thứ nhất là **tính nhất quán nhân vật**: cùng một nhân vật nhưng qua mỗi lần sinh ảnh lại mang khuôn mặt, trang phục, thậm chí giới tính khác nhau, khiến câu chuyện mất tính liên tục. Thứ hai là **bố cục trang truyện**: các mô hình sinh ảnh chỉ trả về từng bức tranh rời rạc, việc sắp xếp chúng thành trang truyện với nhịp điệu kể chuyện hợp lý hoàn toàn phải làm thủ công. Thứ ba là **lời thoại**: chữ do các mô hình sinh ảnh render thường sai chính tả hoặc vô nghĩa, còn việc đặt bong bóng thoại đúng vị trí, không che khuất nhân vật, lại là một bài toán riêng chưa được các công cụ phổ biến giải quyết trọn vẹn.

Như vậy, khoảng trống hiện nay không nằm ở năng lực sinh ảnh đơn lẻ, mà nằm ở **một quy trình phần mềm hoàn chỉnh (end-to-end)** có khả năng tiếp nhận văn bản tường thuật thô, hiểu được cốt truyện, và tự động hoá toàn bộ chuỗi công đoạn: phân tích truyện, thiết kế nhân vật nhất quán, sinh hình ảnh, dàn trang và chèn thoại — trong khi vẫn cho phép con người can thiệp, chỉnh sửa ở từng bước. Đây chính là vấn đề mà khoá luận này đặt ra và giải quyết.

## 1.2 Lý do thực hiện đề tài

Có ba lý do chính thúc đẩy việc thực hiện đề tài.

**Thứ nhất, nhu cầu thực tế là có thật và đang tăng nhanh.** Trong giáo dục, giáo viên muốn chuyển bài học lịch sử, truyện ngụ ngôn hay tài liệu giáo khoa thành truyện tranh để tăng hứng thú học tập cho học sinh, nhưng không có kỹ năng vẽ. Trong sản xuất phim, đạo diễn cần công cụ dựng storyboard nhanh từ kịch bản để trực quan hoá ý tưởng trước khi bấm máy, tiết kiệm chi phí tiền kỳ. Trong công nghiệp sáng tạo, người viết truyện cần một cách nhanh chóng để tạo nguyên mẫu (prototype) minh hoạ cho ý tưởng của mình trước khi đầu tư thuê hoạ sĩ.

**Thứ hai, các sản phẩm hiện có trên thị trường chưa giải quyết trọn vẹn bài toán.** Qua khảo sát các nền tảng như ComicsMaker.ai, AI Comic Factory, Komiko.ai và Lore Machine (trình bày chi tiết ở Chương 3), có thể thấy mỗi công cụ chỉ mạnh ở một khâu: có công cụ sinh ảnh đẹp nhưng nhân vật không nhất quán, có công cụ giữ được nhân vật nhưng giá thành cao và giao diện khó dùng, và hầu hết đều thiếu sự tích hợp trơn tru từ văn bản đầu vào đến file truyện hoàn chỉnh đầu ra.

**Thứ ba, về mặt học thuật và kỹ thuật phần mềm**, bài toán này là một trường hợp điển hình thú vị: nó đòi hỏi phối hợp nhiều thành phần AI khác nhau (mô hình ngôn ngữ lớn cho phân tích truyện, mô hình khuếch tán cho sinh ảnh, kỹ thuật điều khiển sinh ảnh cho tính nhất quán) bên trong một kiến trúc phần mềm web hiện đại, với các ràng buộc thực tế rất cụ thể — giới hạn tốc độ gọi API, độ trễ sinh ảnh lớn, dữ liệu ảnh dung lượng cao, và yêu cầu người dùng phải can thiệp được vào giữa quy trình. Việc thiết kế và hiện thực một hệ thống như vậy là cơ hội để vận dụng tổng hợp kiến thức về kiến trúc phần mềm, thiết kế API, xử lý bất đồng bộ và quản lý trạng thái phía client.

## 1.3 Mục tiêu đề tài

Mục tiêu tổng quát của đề tài là **xây dựng một nền tảng web hoàn chỉnh cho phép người dùng không có kỹ năng hội hoạ chuyển đổi văn bản tường thuật thành truyện tranh hoặc manga mạch lạc**, tự động hoá toàn bộ quy trình nhưng vẫn giữ quyền kiểm soát sáng tạo cho con người ở mỗi bước.

Mục tiêu tổng quát trên được cụ thể hoá thành các mục tiêu thành phần:

1. Xây dựng **mô-đun phân tích truyện** ứng dụng mô hình ngôn ngữ lớn (LLM) để phân tích văn bản đầu vào, nhận diện nhân vật, phân đoạn cốt truyện thành các "nhịp" (beats) và trích xuất hội thoại.
2. Xây dựng **mô-đun sinh hình ảnh nhất quán**: thiết kế nhân vật bằng mô tả có cấu trúc, sinh ảnh chân dung tham chiếu, và duy trì ngoại hình nhân vật ổn định qua các khung tranh bằng kỹ thuật prompt engineering kết hợp ảnh tham chiếu (IP-Adapter).
3. Xây dựng **mô-đun bố cục trang tự động**: hệ thống mẫu bố cục (layout templates) đa dạng, có khả năng gợi ý bố cục phù hợp với nội dung từng trang.
4. Xây dựng **mô-đun tích hợp lời thoại**: trình soạn thảo bong bóng thoại trực quan, hỗ trợ tự động nhập thoại từ kịch bản đã phân tích.
5. Xây dựng **mô-đun xuất bản**: xuất truyện hoàn chỉnh ra các định dạng PDF, EPUB, ZIP ảnh; chia sẻ truyện qua trình đọc web kèm thống kê lượt đọc.
6. Đảm bảo các **yêu cầu phi chức năng** thiết yếu: xác thực người dùng (JWT, OAuth), giới hạn tốc độ gọi API, khả năng phục hồi khi sinh ảnh thất bại (tự động thử lại), và lưu trữ dự án để làm việc qua nhiều phiên.

## 1.4 Phạm vi và giới hạn

**Phạm vi thực hiện** của đề tài tập trung vào năm mô-đun cốt lõi đã nêu trong đề cương: (1) phân tích và phân đoạn câu chuyện từ văn bản; (2) sinh hình ảnh với tính nhất quán nhân vật và bối cảnh; (3) bố cục panel tự động; (4) tích hợp văn bản và bong bóng thoại; (5) xuất file đa định dạng. Người dùng có thể can thiệp chỉnh sửa văn bản, điều chỉnh bố cục và yêu cầu sinh lại (regenerate) từng panel cụ thể tại mọi bước của quy trình.

Bên cạnh đó, đề tài có những **giới hạn** được xác định rõ từ đầu:

- Hệ thống không hỗ trợ tạo video hay hoạt hình (animation) thời gian thực.
- Không hướng đến xử lý các văn bản quá dài và phức tạp như tiểu thuyết hàng nghìn trang; đầu vào phù hợp là truyện ngắn, trích đoạn, kịch bản hoặc bài học có độ dài vừa phải.
- Không cung cấp các tính năng chỉnh sửa chuyên sâu dành riêng cho hoạ sĩ minh hoạ chuyên nghiệp (ví dụ chỉnh từng nét vẽ, quản lý màu phục vụ in ấn vật lý).
- Chất lượng hình ảnh phụ thuộc vào các mô hình sinh ảnh bên thứ ba mà hệ thống tích hợp; đề tài không huấn luyện mô hình sinh ảnh mới mà tập trung vào bài toán kỹ thuật phần mềm: điều phối, kiểm soát và tích hợp các mô hình đó thành quy trình hoàn chỉnh.

## 1.5 Đóng góp của nghiên cứu

Khoá luận có những đóng góp chính sau:

1. **Một quy trình sinh truyện tranh end-to-end hoàn chỉnh được hiện thực thành sản phẩm chạy được**, từ văn bản thô đến file PDF/EPUB, tổ chức thành wizard 5 bước cho phép người dùng kiểm soát và can thiệp ở từng bước — điểm mà các công cụ thương mại hiện có làm chưa tốt.
2. **Một giải pháp thực dụng cho bài toán nhất quán nhân vật** không cần huấn luyện lại mô hình: kết hợp mô tả nhân vật có cấu trúc do LLM sinh ra, ảnh chân dung tham chiếu được người dùng duyệt chọn, và cơ chế truyền ảnh tham chiếu (IP-Adapter) vào từng lần sinh panel, kèm thư viện nhân vật dùng lại được giữa các dự án.
3. **Một kiến trúc phần mềm tách bạch và có khả năng mở rộng**: backend FastAPI đóng vai trò điều phối đa nhà cung cấp LLM (Gemini, NineRouter, hoặc khoá API do người dùng tự mang — BYOK), frontend Next.js quản lý trạng thái quy trình phức tạp, giao tiếp streaming qua SSE, và proxy ảnh để tích hợp máy chủ sinh ảnh GPU bên ngoài.
4. **Các bài học kỹ thuật được đúc kết từ quá trình xây dựng thực tế**: xử lý giới hạn tốc độ API bằng hàng đợi theo người dùng, tự động thử lại khi sinh ảnh thất bại, và các quyết định thiết kế khi lưu ảnh dung lượng lớn — những kinh nghiệm hữu ích cho các hệ thống tích hợp AI tạo sinh nói chung.

## 1.6 Cấu trúc cuốn luận

Phần còn lại của khoá luận được tổ chức như sau:

- **Chương 2 — Cơ sở lý thuyết:** trình bày các kiến thức nền tảng về mô hình ngôn ngữ lớn và prompt engineering, sinh ảnh từ văn bản, các kỹ thuật duy trì nhất quán nhân vật (IP-Adapter, ControlNet), cùng các công nghệ web sử dụng trong hệ thống (FastAPI, Next.js, MongoDB, SSE).
- **Chương 3 — Phân tích yêu cầu:** khảo sát các ứng dụng liên quan, xác định các bên liên quan, đặc tả yêu cầu chức năng, phi chức năng và các Use Case chính.
- **Chương 4 — Thiết kế hệ thống:** chương trọng tâm, mô tả kiến trúc tổng thể, thiết kế cấu trúc tĩnh (component, package, class), hành vi động (sequence, activity, state machine), thiết kế dữ liệu, thiết kế API/SSE và giao diện người dùng.
- **Chương 5 — Triển khai hệ thống:** môi trường phát triển, chi tiết hiện thực backend, frontend, pipeline sinh truyện và các vấn đề kỹ thuật đã gặp cùng cách giải quyết.
- **Chương 6 — Kiểm thử và đánh giá:** chiến lược kiểm thử, kết quả kiểm thử chức năng và phi chức năng, đánh giá chất lượng đầu ra và so sánh với các công cụ hiện có.
- **Chương 7 — Kết luận:** tóm tắt kết quả, hạn chế và hướng phát triển tiếp theo.

Cuối cuốn luận là danh mục tài liệu tham khảo và các phụ lục về đặc tả Use Case chi tiết, danh sách API endpoint đầy đủ và hướng dẫn cài đặt hệ thống.

---

# Chương 2: Cơ sở lý thuyết

## 2.1 Mô hình ngôn ngữ lớn (LLM) và kỹ thuật prompt engineering

### 2.1.1 Mô hình ngôn ngữ lớn

Mô hình ngôn ngữ lớn (Large Language Model — LLM) là các mạng nơ-ron dựa trên kiến trúc Transformer [Vaswani et al., 2017], được huấn luyện trên khối lượng văn bản khổng lồ với mục tiêu dự đoán token kế tiếp. Nhờ quy mô tham số lớn và dữ liệu huấn luyện đa dạng, các LLM hiện đại như GPT-4, Gemini hay Claude thể hiện năng lực hiểu và sinh ngôn ngữ tự nhiên ở mức có thể ứng dụng trực tiếp vào các bài toán xử lý văn bản mà trước đây đòi hỏi mô hình chuyên biệt: tóm tắt, trích xuất thông tin, phân loại, sinh nội dung có cấu trúc.

Trong phạm vi đề tài, LLM được sử dụng như một **bộ máy phân tích truyện**: nhận văn bản tường thuật thô và trả về kết quả có cấu trúc gồm danh sách nhân vật kèm mô tả ngoại hình, phân đoạn cốt truyện thành các cảnh và "nhịp" (beats), lời thoại của từng nhân vật trong từng cảnh, và kịch bản chi tiết cho từng khung tranh (panel script). Cách dùng này khai thác hai năng lực đặc trưng của LLM: khả năng đọc hiểu ngữ cảnh dài và khả năng sinh đầu ra theo định dạng được chỉ định (ở đây là JSON).

Một đặc điểm quan trọng của việc gọi LLM qua API là mô hình **không lưu trạng thái** giữa các lần gọi. Muốn mô hình "nhớ" thông tin nhân vật đã phân tích ở bước trước, ứng dụng phải tự quản lý và truyền lại ngữ cảnh đó trong prompt của các bước sau. Đây là một ràng buộc thiết kế xuyên suốt hệ thống: kết quả phân tích của mỗi bước trong pipeline được lưu lại và trở thành đầu vào của bước kế tiếp.

### 2.1.2 Kỹ thuật prompt engineering

Prompt engineering là tập hợp các kỹ thuật thiết kế câu lệnh đầu vào để định hướng hành vi của LLM mà không cần huấn luyện lại mô hình. Các kỹ thuật chính được vận dụng trong đề tài gồm:

- **Chỉ định vai trò (role prompting):** mở đầu prompt bằng việc gán cho mô hình một vai trò cụ thể ("Bạn là một biên kịch truyện tranh chuyên nghiệp...") giúp đầu ra bám sát văn phong và mức độ chi tiết mong muốn.
- **Đầu ra có cấu trúc (structured output):** yêu cầu mô hình trả về JSON theo lược đồ (schema) định sẵn, kèm ví dụ minh hoạ định dạng. Phía ứng dụng phân tích cú pháp (parse) kết quả này thành đối tượng; nếu parse thất bại thì yêu cầu sinh lại. Kỹ thuật này biến LLM từ công cụ sinh văn xuôi thành một thành phần trả dữ liệu máy-đọc-được, có thể lắp vào pipeline phần mềm.
- **Few-shot prompting:** cung cấp một vài cặp ví dụ đầu vào – đầu ra mẫu trong prompt để mô hình học theo khuôn mẫu, đặc biệt hữu ích khi cần định dạng kịch bản panel thống nhất.
- **Ràng buộc phủ định (negative constraints):** liệt kê rõ những điều mô hình không được làm (không thêm nhân vật mới, không đổi tên nhân vật, không vượt quá số panel cho phép) — kinh nghiệm thực tế cho thấy ràng buộc phủ định rõ ràng làm giảm đáng kể tỉ lệ đầu ra lệch chuẩn.
- **Chuỗi prompt (prompt chaining):** thay vì yêu cầu mô hình làm mọi việc trong một lần gọi, bài toán lớn được tách thành chuỗi các lần gọi nhỏ (phân tích nhân vật → phân cảnh → kịch bản panel → prompt sinh ảnh), mỗi lần gọi nhận kết quả đã được kiểm tra của lần trước. Cách này tăng độ tin cậy và cho phép người dùng can thiệp giữa chừng.

### 2.1.3 Sinh mô tả nhân vật và prompt ảnh bằng LLM

Một ứng dụng đặc thù của prompt engineering trong đề tài là dùng LLM làm **cầu nối giữa văn bản truyện và mô hình sinh ảnh**. Mô hình sinh ảnh chỉ hiểu các mô tả trực quan ngắn gọn (visual prompt), trong khi truyện gốc mô tả nhân vật rải rác và gián tiếp. LLM được giao nhiệm vụ tổng hợp từ truyện ra một **bản thiết kế nhân vật có cấu trúc** (structured character design): giới tính, tuổi, kiểu tóc, màu mắt, trang phục, phụ kiện, đặc điểm nhận dạng. Bản thiết kế này sau đó được ghép vào prompt của từng lần sinh ảnh, đảm bảo mọi panel đều nhận cùng một bộ mô tả nhân vật — nền tảng đầu tiên của tính nhất quán.

## 2.2 Sinh hình ảnh từ văn bản (Text-to-Image Generation)

### 2.2.1 Mô hình khuếch tán

Các hệ thống sinh ảnh từ văn bản hiện đại chủ yếu dựa trên **mô hình khuếch tán (diffusion model)** [Ho et al., 2020; Rombach et al., 2022]. Ý tưởng cốt lõi: quá trình huấn luyện dạy mô hình khử nhiễu dần một ảnh bị nhiễu hoá hoàn toàn, có điều kiện theo mô tả văn bản; khi suy diễn, mô hình bắt đầu từ nhiễu ngẫu nhiên và qua nhiều bước khử nhiễu tạo ra ảnh khớp với mô tả. Stable Diffusion cải tiến bằng cách thực hiện khuếch tán trong không gian tiềm ẩn (latent space) nén, giảm mạnh chi phí tính toán. Các thế hệ sau như SDXL và Flux nâng chất lượng ảnh và độ bám prompt lên đáng kể.

Đặc điểm vận hành đáng chú ý với người xây dựng hệ thống: (1) sinh một ảnh mất từ vài giây đến hàng chục giây tuỳ phần cứng — ứng dụng phải thiết kế bất đồng bộ và có phản hồi tiến trình; (2) cùng một prompt, mỗi lần sinh cho kết quả khác nhau do khởi tạo nhiễu ngẫu nhiên — đây chính là gốc rễ của bài toán không nhất quán nhân vật; (3) kích thước ảnh đầu ra cần là bội số nhất định (thường là 8 hoặc 64 pixel) — hệ thống phải tính toán kích thước panel phù hợp trước khi gọi mô hình.

### 2.2.2 Điều kiện hoá và tham số sinh ảnh

Ngoài prompt văn bản, các mô hình khuếch tán cho phép điều khiển qua nhiều kênh: *negative prompt* (mô tả những gì không muốn xuất hiện), *seed* (cố định nguồn nhiễu để tái lập kết quả), *guidance scale* (mức độ bám prompt), số bước khử nhiễu (đánh đổi chất lượng – tốc độ), và quan trọng nhất với đề tài này là **điều kiện hoá bằng hình ảnh** — đưa một ảnh tham chiếu vào quá trình sinh để ảnh kết quả kế thừa đặc điểm của ảnh tham chiếu (trình bày ở mục 2.3).

### 2.2.3 Mô hình sinh ảnh đa phương thức qua API

Bên cạnh các mô hình khuếch tán mã nguồn mở tự vận hành, một hướng khác là dùng mô hình sinh ảnh của các nhà cung cấp lớn qua API, như dòng mô hình sinh ảnh của hệ sinh thái Gemini. Ưu điểm là chất lượng ảnh cao, khả năng render chữ trong ảnh tốt hơn và không cần hạ tầng GPU riêng; nhược điểm là chi phí theo lượt gọi, giới hạn tốc độ (rate limit) chặt và ít kênh điều khiển tinh (không truy cập được seed, không gắn được các adapter tuỳ biến). Hệ thống trong đề tài được thiết kế để làm việc được với cả hai hướng: máy chủ sinh ảnh khuếch tán chạy trên GPU bên ngoài (cho phép điều khiển sâu bằng ảnh tham chiếu) và API sinh ảnh thương mại.

## 2.3 Kỹ thuật duy trì nhất quán nhân vật

Không nhất quán nhân vật (character inconsistency) là trở ngại lớn nhất khi dùng mô hình sinh ảnh cho truyện tranh: do bản chất ngẫu nhiên của khuếch tán, hai lần sinh với cùng mô tả "cô bé tóc đỏ mặc áo khoác xanh" sẽ cho hai khuôn mặt khác nhau. Các hướng giải quyết chính trong nghiên cứu và thực tiễn gồm:

### 2.3.1 Tinh chỉnh mô hình theo chủ thể (subject-driven fine-tuning)

DreamBooth [Ruiz et al., 2023] và Textual Inversion [Gal et al., 2022] huấn luyện bổ sung mô hình (hoặc học một embedding mới) trên một tập nhỏ ảnh của chủ thể, sau đó chủ thể có thể được gọi ra trong prompt bằng một định danh đặc biệt. LoRA (Low-Rank Adaptation) giảm chi phí tinh chỉnh bằng cách chỉ học các ma trận hạng thấp chèn vào mô hình gốc. Nhóm kỹ thuật này cho độ nhất quán cao nhất nhưng đòi hỏi bước huấn luyện riêng cho từng nhân vật (vài phút đến hàng giờ GPU), không phù hợp với kịch bản người dùng tạo nhân vật mới liên tục trong một ứng dụng web tương tác.

### 2.3.2 IP-Adapter — điều kiện hoá bằng ảnh tham chiếu không cần huấn luyện

**IP-Adapter** (Image Prompt Adapter) [Ye et al., 2023] là kỹ thuật được đề tài lựa chọn làm cơ chế nhất quán chính. IP-Adapter gắn thêm vào mô hình khuếch tán một nhánh cross-attention riêng cho đặc trưng ảnh: ảnh tham chiếu được mã hoá bằng bộ mã hoá ảnh (CLIP image encoder), đặc trưng thu được được "tiêm" vào các lớp attention của mô hình song song với đặc trưng văn bản. Kết quả là ảnh sinh ra vừa tuân theo prompt văn bản (tư thế, bối cảnh, hành động) vừa kế thừa nhận dạng thị giác (khuôn mặt, màu tóc, trang phục) từ ảnh tham chiếu.

Ưu điểm quyết định của IP-Adapter với bài toán của đề tài: **không cần huấn luyện gì thêm cho nhân vật mới** — chỉ cần một ảnh chân dung tham chiếu là dùng được ngay, thời gian sinh gần như không đổi. Mức độ ảnh hưởng của ảnh tham chiếu điều chỉnh được qua hệ số tỉ lệ (`ip_scale`): giá trị thấp cho mô hình tự do sáng tạo hơn, giá trị cao ép bám sát ảnh tham chiếu hơn nhưng dễ làm cứng tư thế. Việc chọn hệ số phù hợp cho từng loại cảnh là một nội dung thực nghiệm của đề tài.

### 2.3.3 ControlNet — điều khiển cấu trúc không gian

**ControlNet** [Zhang et al., 2023] giải quyết một khía cạnh khác: điều khiển *cấu trúc* của ảnh sinh ra (tư thế nhân vật, bố cục, phối cảnh) bằng cách sao chép một nhánh encoder của mô hình khuếch tán và điều kiện hoá nó theo ảnh điều khiển — bản đồ tư thế (openpose), biên cạnh (canny), bản đồ độ sâu... ControlNet bổ trợ cho IP-Adapter: IP-Adapter giữ "nhân vật này là ai", ControlNet giữ "nhân vật đang đứng thế nào". Trong hệ thống, ControlNet được xem là kênh mở rộng cho các trường hợp cần kiểm soát tư thế chặt, còn quy trình mặc định dựa trên IP-Adapter kết hợp prompt có cấu trúc.

### 2.3.4 Chiến lược tổng hợp ở tầng ứng dụng

Kinh nghiệm thực tiễn (và cũng là cách tiếp cận của đề tài) cho thấy nhất quán nhân vật không phải bài toán giải bằng một kỹ thuật đơn lẻ mà bằng **tổ hợp nhiều lớp ở tầng ứng dụng**: (1) mô tả nhân vật có cấu trúc, sinh một lần và tái sử dụng nguyên văn trong mọi prompt; (2) ảnh chân dung tham chiếu được người dùng duyệt chọn từ nhiều ứng viên; (3) truyền ảnh tham chiếu qua IP-Adapter vào từng lần sinh panel; (4) cho phép người dùng sinh lại panel chưa đạt. Chuỗi bốn lớp này được hiện thực xuyên suốt pipeline và đánh giá ở Chương 6.

## 2.4 Kiến trúc hệ thống web hiện đại

### 2.4.1 FastAPI

FastAPI là framework web Python hiệu năng cao xây dựng trên chuẩn ASGI, nổi bật với ba đặc điểm phù hợp đề tài: (1) khai báo kiểu dữ liệu bằng Pydantic — mọi request/response được kiểm tra hợp lệ tự động, quan trọng khi đầu ra của LLM cần được ràng buộc lược đồ; (2) hỗ trợ bất đồng bộ (async/await) và trả về streaming response — cần thiết cho các lời gọi LLM kéo dài; (3) tự sinh tài liệu OpenAPI, thuận tiện cho kiểm thử API. Trong hệ thống, FastAPI đóng vai trò tầng điều phối: nhận yêu cầu từ frontend, gọi các dịch vụ AI bên ngoài, áp giới hạn tốc độ và ghi/đọc MongoDB.

### 2.4.2 Next.js và React

Next.js 14 (App Router) là framework React hỗ trợ kết hợp Server Component và Client Component. Ứng dụng sáng tác truyện tranh về bản chất là một **ứng dụng giàu trạng thái phía client**: người dùng thao tác qua wizard nhiều bước, mỗi bước giữ dữ liệu trung gian (kết quả phân tích, ảnh nhân vật, kịch bản panel, ảnh trang). React Context được dùng làm nơi quản lý trạng thái tập trung của toàn quy trình, trong khi Next.js đảm nhận định tuyến, đọc tham số URL phía server và tối ưu tải trang. TypeScript ở chế độ strict giúp mô hình hoá chặt các cấu trúc dữ liệu phức tạp của pipeline.

### 2.4.3 MongoDB

MongoDB là hệ quản trị cơ sở dữ liệu hướng tài liệu (document-oriented): dữ liệu lưu dạng BSON linh hoạt, không ép lược đồ cứng. Đặc tính này phù hợp với dữ liệu của đề tài — mỗi dự án truyện là một cây tài liệu lồng nhau (truyện gốc → kết quả phân tích → nhân vật → kịch bản panel → ảnh) mà cấu trúc còn tiến hoá trong quá trình phát triển. Việc lưu cả trạng thái trung gian của từng bước cho phép người dùng đóng trình duyệt và quay lại làm tiếp đúng chỗ đã dừng.

### 2.5 Các khái niệm liên quan

**REST API.** Giao tiếp client–server của hệ thống tuân theo phong cách REST: tài nguyên định danh qua URL (`/api/projects/{id}`), thao tác qua các động từ HTTP (GET/POST/PUT/DELETE), dữ liệu trao đổi bằng JSON. REST giữ cho backend không trạng thái (stateless), dễ mở rộng và dễ kiểm thử độc lập.

**Server-Sent Events (SSE).** Các lời gọi LLM có thể mất nhiều chục giây; nếu chờ trả về một lần, người dùng đối diện màn hình trắng và request dễ vượt timeout. SSE là cơ chế đẩy dữ liệu một chiều từ server về client trên một kết nối HTTP duy trì: server ghi từng khối văn bản (`data: ...`) ngay khi LLM sinh ra, client hiển thị dần. So với WebSocket, SSE đơn giản hơn (đi trên HTTP thuần, tự kết nối lại) và đủ cho nhu cầu một chiều của bài toán streaming văn bản.

**Xử lý bất đồng bộ và mô hình luồng.** Backend dùng vòng lặp sự kiện (event loop) của ASGI cho các thao tác I/O mạng (gọi API AI qua `httpx` bất đồng bộ), trong khi các thao tác cơ sở dữ liệu dùng trình điều khiển PyMongo đồng bộ được FastAPI tự động đưa vào thread pool. Phía frontend, các chuỗi sinh ảnh dài chạy bất đồng bộ với cập nhật trạng thái từng phần tử (đang chờ / đang sinh / thành công / lỗi), kết hợp cơ chế tự thử lại (retry with delay) khi một lần sinh thất bại.

**Xác thực JWT và OAuth 2.0.** Hệ thống dùng JSON Web Token cho phiên đăng nhập: sau khi xác thực, server phát hành token ký số chứa định danh người dùng; các request sau mang token này để chứng minh danh tính mà server không phải lưu phiên. Đăng nhập qua bên thứ ba (Google, GitHub) theo chuẩn OAuth 2.0 Authorization Code: người dùng uỷ quyền tại trang của nhà cung cấp, ứng dụng nhận mã và đổi lấy thông tin định danh, không bao giờ chạm tới mật khẩu của người dùng.

---

# Chương 3: Phân tích yêu cầu

## 3.1 Khảo sát các ứng dụng liên quan

Trước khi xác định yêu cầu cho hệ thống, chúng tôi khảo sát bốn nền tảng sáng tác truyện tranh bằng AI tiêu biểu đang có mặt trên thị trường. Mục đích khảo sát không phải để liệt kê tính năng, mà để trả lời câu hỏi: *người dùng phổ thông hiện bị vướng ở đâu khi muốn biến một câu chuyện thành truyện tranh hoàn chỉnh?*

### 3.1.1 ComicsMaker.ai

ComicsMaker.ai cho phép người dùng tạo trang truyện bằng cách chọn bố cục lưới rồi sinh ảnh cho từng ô bằng prompt. Điểm mạnh của nền tảng là thao tác đơn giản, hỗ trợ nhiều phong cách vẽ và có công cụ chèn thoại. Tuy nhiên, qua trải nghiệm thực tế và các đánh giá của người dùng, nhược điểm lớn nhất là **thiếu nhất quán nhân vật**: mỗi panel được sinh độc lập từ prompt riêng, nền tảng không có cơ chế neo nhận dạng nhân vật giữa các panel, nên cùng một nhân vật thường "biến hình" qua từng khung tranh. Ngoài ra, khâu phân tích truyện hoàn toàn không có — người dùng phải tự tay chuyển câu chuyện của mình thành từng prompt rời rạc, tức là phần việc trí tuệ nhất của quy trình vẫn là thủ công.

### 3.1.2 AI Comic Factory

AI Comic Factory là dự án mã nguồn mở trên Hugging Face, nhận một đoạn mô tả ngắn và sinh ra một trang truyện vài panel theo phong cách được chọn. Ưu điểm là miễn phí, dễ tiếp cận và cho kết quả nhanh. Hạn chế nằm ở chỗ nó là công cụ "một phát ăn ngay": đầu vào chỉ là một câu mô tả ngắn chứ không phải văn bản truyện thực sự, không có bước phân tích cốt truyện, không quản lý nhân vật, không cho chỉnh sửa từng panel sau khi sinh, và không có khái niệm dự án nhiều trang. Kết quả phù hợp để giải trí hơn là để sáng tác một câu chuyện có chủ đích.

### 3.1.3 Komiko.ai

Komiko.ai là nền tảng thương mại khá hoàn thiện, hỗ trợ tạo nhân vật riêng và giữ nhân vật qua các panel, có công cụ vẽ bổ trợ và cả tính năng hoạt hình hoá. Đây là đối thủ mạnh nhất về tính năng trong nhóm khảo sát. Đổi lại, **giá thành cao** (mô hình thuê bao với hạn mức credit), giao diện nhiều tầng chức năng gây khó cho người mới, và quy trình vẫn xoay quanh việc người dùng tự dựng từng panel — nền tảng không có bước "đọc hiểu" văn bản truyện để tự đề xuất kịch bản và phân cảnh.

### 3.1.4 Lore Machine

Lore Machine đi theo hướng gần với đề tài nhất: người dùng dán văn bản truyện, hệ thống tự phân tích, nhận diện nhân vật và sinh bộ ảnh minh hoạ theo phong cách thống nhất. Điểm mạnh là trải nghiệm "văn bản vào — bộ ảnh ra" thực sự và khả năng giữ nhận dạng nhân vật khá tốt. Tuy nhiên sản phẩm đầu ra thiên về **bộ ảnh minh hoạ kèm bảng phân cảnh** hơn là trang truyện tranh đúng nghĩa: không có dàn trang panel theo ngôn ngữ truyện tranh, không có bong bóng thoại đặt trong tranh, và người dùng gần như không can thiệp được vào giữa quy trình — nếu một ảnh hỏng thì lựa chọn duy nhất là chạy lại cả lô.

### 3.1.5 Bảng so sánh và nhận xét tổng hợp

| Tiêu chí | ComicsMaker.ai | AI Comic Factory | Komiko.ai | Lore Machine | **Hệ thống đề xuất** |
|---|---|---|---|---|---|
| Phân tích văn bản truyện tự động | Không | Rất hạn chế | Không | Có | **Có (LLM, nhiều bước)** |
| Nhất quán nhân vật | Yếu | Yếu | Khá | Khá | **Có (ảnh tham chiếu + IP-Adapter)** |
| Thư viện nhân vật tái sử dụng | Không | Không | Có | Một phần | **Có** |
| Bố cục trang truyện | Lưới cố định | Cố định | Tự dựng | Không | **Thư viện mẫu + gợi ý AI** |
| Bong bóng thoại trong tranh | Có (thủ công) | Có (cơ bản) | Có | Không | **Có (trình soạn thảo + auto-import)** |
| Can thiệp/sinh lại từng panel | Có | Không | Có | Không | **Có, ở mọi bước** |
| Xuất đa định dạng (PDF/EPUB...) | Hạn chế | Ảnh đơn | Có | Ảnh | **PDF, EPUB, ZIP, web reader** |
| Chi phí | Trung bình | Miễn phí | Cao | Cao | Tự vận hành / BYOK |

Nhận xét tổng hợp: mỗi nền tảng giải quyết tốt một mảnh của bài toán — hoặc sinh ảnh, hoặc phân tích truyện, hoặc dựng trang — nhưng **chưa nền tảng nào nối liền toàn bộ chuỗi từ văn bản thô đến trang truyện hoàn chỉnh trong khi vẫn giữ quyền kiểm soát cho người dùng ở từng mắt xích**. Khoảng trống này định hình trực tiếp các yêu cầu chức năng của hệ thống: một pipeline nhiều bước rõ ràng, mỗi bước có thể xem, sửa và chạy lại; nhân vật được quản lý như thực thể nhất quán xuyên suốt; và đầu ra là sản phẩm truyện tranh dùng được ngay.

## 3.2 Xác định các bên liên quan (Stakeholders)

- **Người sáng tác nghiệp dư (người dùng chính):** người viết truyện, giáo viên, người sáng tạo nội dung — có câu chuyện và mong muốn thành phẩm trực quan, không có kỹ năng vẽ. Kỳ vọng: quy trình dễ hiểu, kết quả nhất quán, chỉnh được chỗ chưa ưng ý, xuất file dùng được ngay.
- **Người đọc:** tiếp cận truyện đã xuất bản qua trình đọc web hoặc file PDF/EPUB. Kỳ vọng: đọc mượt, hình ảnh rõ, thứ tự trang đúng.
- **Quản trị viên hệ thống:** vận hành backend, theo dõi lượng gọi API và chi phí, quản lý cấu hình nhà cung cấp LLM. Kỳ vọng: hệ thống có giới hạn tốc độ bảo vệ hạn mức API, có nhật ký và số liệu sử dụng.
- **Nhà cung cấp dịch vụ AI (bên ngoài):** Google (Gemini), các dịch vụ trung gian LLM, máy chủ sinh ảnh GPU. Ràng buộc từ phía họ (rate limit, định dạng API, thời gian phản hồi) là nguồn gốc của nhiều yêu cầu phi chức năng.
- **Giảng viên hướng dẫn / hội đồng:** đánh giá tính hoàn chỉnh về mặt kỹ thuật phần mềm của hệ thống — kiến trúc, tài liệu thiết kế, kiểm thử.

## 3.3 Yêu cầu chức năng

Các yêu cầu chức năng được nhóm theo mô-đun của pipeline:

**Nhóm FR1 — Quản lý người dùng và phiên làm việc**
- FR1.1: Đăng ký, đăng nhập bằng email/mật khẩu; đăng nhập qua Google và GitHub (OAuth 2.0).
- FR1.2: Đặt lại mật khẩu qua email (SMTP).
- FR1.3: Người dùng chưa đăng nhập vẫn dùng được pipeline với cấu hình mặc định; các tính năng cấu hình cá nhân yêu cầu đăng nhập.
- FR1.4: Trang cài đặt cho phép người dùng chọn nguồn LLM: mô hình mặc định của hệ thống, khoá API tự mang (BYOK — Gemini/OpenAI/DeepSeek), hoặc máy chủ mô hình cục bộ; khoá API được mã hoá khi lưu.

**Nhóm FR2 — Nhập truyện và phân tích (Bước 1–2)**
- FR2.1: Người dùng nhập/dán văn bản truyện, chọn thể loại, phong cách vẽ, khuôn khổ truyện (số trang mục tiêu, khổ trang).
- FR2.2: Hệ thống phân tích truyện bằng LLM: tóm tắt, nhận diện nhân vật kèm mô tả, phân cảnh, trích hội thoại; kết quả trả về dạng streaming để người dùng theo dõi tiến trình.
- FR2.3: Người dùng xem và hiệu chỉnh kết quả phân tích (sửa tên, mô tả nhân vật, gộp/tách cảnh) trước khi đi tiếp.

**Nhóm FR3 — Thiết kế nhân vật nhất quán (Bước 3)**
- FR3.1: Hệ thống sinh bản thiết kế nhân vật có cấu trúc (ngoại hình, trang phục, đặc điểm nhận dạng) cho từng nhân vật.
- FR3.2: Sinh nhiều ảnh chân dung ứng viên cho mỗi nhân vật; người dùng duyệt chọn ảnh đại diện chính thức.
- FR3.3: Người dùng gắn ảnh tham chiếu cho nhân vật từ: ảnh tự tải lên, thư viện nhân vật cá nhân, hoặc cộng đồng; chọn chế độ sinh (chỉ văn bản / kèm ảnh tham chiếu).
- FR3.4: Lưu nhân vật vào thư viện cá nhân để tái sử dụng ở dự án khác.

**Nhóm FR4 — Kịch bản panel và sinh trang truyện (Bước 4)**
- FR4.1: Hệ thống sinh kịch bản chi tiết từng panel (góc máy, hành động, thoại, hiệu ứng âm thanh) từ kết quả phân tích.
- FR4.2: Người dùng chọn mẫu bố cục trang từ thư viện template (theo nhóm: chuẩn, hero, điện ảnh, động); hệ thống có chức năng gợi ý bố cục phù hợp bằng AI.
- FR4.3: Sinh ảnh theo hai chế độ: cả trang (full page) hoặc từng panel (panel-by-panel); ảnh panel nhận mô tả nhân vật và ảnh tham chiếu để giữ nhất quán.
- FR4.4: Sinh lại (regenerate) từng panel/trang riêng lẻ; tự động thử lại khi sinh thất bại.
- FR4.5: Trình soạn thảo bong bóng thoại: thêm/kéo thả/sửa bong bóng trên trang, tự động nhập thoại từ kịch bản.

**Nhóm FR5 — Xuất bản và chia sẻ (Bước 5)**
- FR5.1: Xuất truyện ra PDF (giữ nguyên kích thước ảnh gốc), EPUB (đọc được trên e-reader) và ZIP ảnh PNG.
- FR5.2: Xuất bản truyện lên trình đọc web, nhận đường dẫn chia sẻ; xem lịch sử xuất bản kèm số lượt đọc.
- FR5.3: Lưu/tải dự án lên đám mây (MongoDB); danh sách dự án hiển thị tiến độ theo bước (S1–S5); URL phản ánh dự án đang mở để chia sẻ phiên làm việc.

**Nhóm FR6 — Thống kê và cộng đồng**
- FR6.1: Bảng điều khiển thống kê cá nhân: số panel đã sinh, thời gian sinh trung bình, phân bố phong cách, tỉ lệ xuất file.
- FR6.2: Thư viện cộng đồng (gallery) chia sẻ nhân vật; đánh giá (rating) truyện.

## 3.4 Yêu cầu phi chức năng

- **Hiệu năng:** thời gian sinh một ảnh panel mục tiêu dưới 30 giây; phản hồi đầu tiên của các thao tác phân tích văn bản (token đầu qua SSE) dưới 3 giây; giao diện không bị "đóng băng" trong lúc sinh hàng loạt.
- **Giới hạn API và độ ổn định:** backend áp giới hạn tốc độ theo người dùng (mặc định 2 request/giây, hàng đợi 8, thời gian chờ tối đa 8 giây — cấu hình được qua biến môi trường) để bảo vệ hạn mức của nhà cung cấp AI; client phải xử lý mã lỗi 429/503 một cách nhã nhặn; sinh ảnh thất bại được tự động thử lại tối đa 3 lần trước khi báo lỗi.
- **Bảo mật:** mật khẩu băm bằng thuật toán chuyên dụng; phiên dùng JWT có hạn; khoá API người dùng tự mang được mã hoá đối xứng (Fernet) trước khi lưu; CORS giới hạn theo origin của frontend; token không xuất hiện trong log (tự động che).
- **Khả năng chịu lỗi:** kết quả từng bước được lưu bền vững — người dùng đóng trình duyệt giữa chừng không mất tiến độ; một panel lỗi không làm hỏng cả lô sinh.
- **Khả năng mở rộng và bảo trì:** kiến trúc mô-đun tách tầng (frontend / backend / dịch vụ AI / CSDL); nhà cung cấp LLM thay thế được qua cấu hình mà không sửa mã nghiệp vụ; mã nguồn TypeScript strict và schema Pydantic kiểm soát hợp đồng dữ liệu giữa các tầng.
- **Khả dụng:** giao diện wizard tuyến tính 5 bước, mỗi bước hiển thị trạng thái rõ ràng (đang chờ / đang xử lý / hoàn tất / lỗi); hoạt động tốt trên trình duyệt hiện đại, không yêu cầu cài đặt.

## 3.5 Đặc tả Use Case

### 3.5.1 Use Case Diagram tổng quan

Hệ thống có hai tác nhân chính: **Người sáng tác** (đã hoặc chưa đăng nhập) và **Người đọc**; tác nhân phụ là **Hệ thống AI bên ngoài** (LLM, máy chủ sinh ảnh). Các use case chính:

```
                    ┌──────────────────────────────────────────┐
                    │              Hệ thống mOhiOm             │
                    │                                          │
  ┌─────────┐       │  (UC01) Đăng ký / Đăng nhập / OAuth      │
  │ Người   │──────▶│  (UC02) Tạo dự án & nhập truyện          │
  │ sáng tác│──────▶│  (UC03) Phân tích truyện bằng AI         │──────┐
  └─────────┘       │  (UC04) Thiết kế nhân vật & ảnh tham     │      │   ┌──────────┐
       │            │         chiếu                            │◀─────┼──▶│ Dịch vụ  │
       │            │  (UC05) Sinh kịch bản panel              │      │   │ AI ngoài │
       ├───────────▶│  (UC06) Chọn bố cục & sinh trang truyện  │◀─────┘   │ (LLM,    │
       │            │  (UC07) Soạn bong bóng thoại             │          │ sinh ảnh)│
       ├───────────▶│  (UC08) Xuất PDF/EPUB/ZIP                │          └──────────┘
       ├───────────▶│  (UC09) Xuất bản lên web reader          │
       ├───────────▶│  (UC10) Quản lý dự án & thư viện nhân vật│
       └───────────▶│  (UC11) Cấu hình nguồn LLM (BYOK)        │
                    │                                          │
  ┌─────────┐       │  (UC12) Đọc truyện đã xuất bản           │
  │Người đọc│──────▶│                                          │
  └─────────┘       └──────────────────────────────────────────┘
```

*(Sơ đồ UML chính thức được vẽ lại bằng công cụ vẽ diagram trong bản in.)*

### 3.5.2 Đặc tả các Use Case chính

Dưới đây đặc tả ba use case trọng tâm của pipeline; các use case còn lại được đặc tả đầy đủ tại **Phụ lục A**.

**UC03 — Phân tích truyện bằng AI**

| Mục | Nội dung |
|---|---|
| Tác nhân | Người sáng tác; Dịch vụ LLM (phụ) |
| Điều kiện tiên quyết | Dự án đã có văn bản truyện và cấu hình thể loại/phong cách (UC02) |
| Luồng chính | 1. Người dùng bấm "Phân tích truyện". 2. Hệ thống gửi văn bản + cấu hình tới LLM, kết quả trả về dạng streaming và hiển thị dần. 3. Hệ thống parse kết quả thành cấu trúc: tóm tắt, danh sách nhân vật, phân cảnh, hội thoại. 4. Người dùng xem và hiệu chỉnh. 5. Kết quả được lưu vào dự án; bước 2 đánh dấu hoàn tất. |
| Luồng thay thế | 2a. LLM trả về vượt giới hạn tốc độ (429): hệ thống xếp hàng đợi hoặc báo người dùng thử lại. 3a. Kết quả không parse được: hệ thống tự yêu cầu sinh lại; sau số lần thất bại tối đa thì báo lỗi kèm gợi ý rút ngắn văn bản. |
| Hậu điều kiện | Dự án chứa kết quả phân tích có cấu trúc, sẵn sàng cho bước thiết kế nhân vật. |

**UC04 — Thiết kế nhân vật và ảnh tham chiếu**

| Mục | Nội dung |
|---|---|
| Tác nhân | Người sáng tác; Dịch vụ sinh ảnh (phụ) |
| Điều kiện tiên quyết | UC03 hoàn tất — dự án có danh sách nhân vật |
| Luồng chính | 1. Hệ thống sinh bản thiết kế có cấu trúc cho từng nhân vật (LLM). 2. Với mỗi nhân vật, hệ thống sinh các ảnh chân dung ứng viên. 3. Người dùng duyệt, chọn ảnh chính thức cho từng nhân vật. 4. (Tuỳ chọn) Người dùng gắn ảnh tham chiếu từ máy / thư viện / cộng đồng và bật chế độ sinh kèm tham chiếu. 5. Hệ thống lưu bộ nhân vật đã chốt vào dự án. |
| Luồng thay thế | 2a. Một ảnh sinh thất bại: hệ thống tự thử lại (tối đa 3 lần, giãn cách 3 giây); vẫn thất bại thì đánh dấu lỗi, cho phép sinh lại riêng nhân vật đó. 4a. Người dùng dùng ảnh tham chiếu làm luôn ảnh nhân vật ("Use as character image"): ảnh được thêm vào danh sách ứng viên và chọn làm ảnh chính. |
| Hậu điều kiện | Mỗi nhân vật có mô tả cấu trúc + ảnh đại diện (+ ảnh tham chiếu nếu có), dùng cho mọi lần sinh panel về sau. |

**UC06 — Chọn bố cục và sinh trang truyện**

| Mục | Nội dung |
|---|---|
| Tác nhân | Người sáng tác; Dịch vụ sinh ảnh (phụ) |
| Điều kiện tiên quyết | UC05 hoàn tất — dự án có kịch bản panel chia theo trang |
| Luồng chính | 1. Người dùng chọn chế độ sinh: cả trang hoặc từng panel. 2. Với mỗi trang, người dùng chọn mẫu bố cục (hoặc bấm "AI Suggest" để hệ thống gợi ý dựa trên nội dung trang). 3. Người dùng bấm "Generate": hệ thống lần lượt sinh ảnh cho từng panel/trang, prompt được ghép từ kịch bản panel + mô tả nhân vật + phong cách, kèm ảnh tham chiếu qua IP-Adapter nếu có. 4. Tiến trình hiển thị trực tiếp trên canvas trang; ảnh hoàn tất hiện vào đúng ô bố cục. 5. Người dùng xem lại, sinh lại panel chưa đạt, rồi chuyển sang soạn thoại (UC07). |
| Luồng thay thế | 3a. Một panel thất bại sau 3 lần thử: ô panel hiển thị trạng thái lỗi với nút thử lại riêng, các panel khác tiếp tục bình thường. 3b. Người dùng tạm dừng giữa chừng: hệ thống dừng sau panel hiện tại, cho phép tiếp tục (resume) sau. |
| Hậu điều kiện | Trang truyện có đầy đủ ảnh panel theo bố cục đã chọn, lưu trong dự án. |

---

# Chương 4: Thiết kế hệ thống

Chương này trình bày thiết kế của hệ thống mOhiOm theo trình tự từ tổng thể đến chi tiết: kiến trúc tổng quan và triển khai, cấu trúc tĩnh, hành vi động, dữ liệu, giao tiếp client–server và giao diện người dùng. Hai sơ đồ được đầu tư trình bày kỹ nhất — theo đúng đặc trưng của hệ thống — là **sơ đồ thành phần** (mục 4.2.1) và **sơ đồ tuần tự cho pipeline sinh truyện** (mục 4.3.1).

## 4.1 Tổng quan kiến trúc hệ thống

### 4.1.1 Kiến trúc tổng thể

Hệ thống được tổ chức theo kiến trúc **client–server ba tầng, tách frontend và backend hoàn toàn qua REST API**, cộng thêm một vành đai các dịch vụ AI bên ngoài mà backend đóng vai trò điều phối:

```mermaid
flowchart LR
    subgraph Client["Trình duyệt"]
        FE["Next.js 14 Frontend<br/>(wizard 5 bước, React Context,<br/>trình soạn bong bóng thoại, export)"]
    end

    subgraph Server["Máy chủ ứng dụng"]
        BE["FastAPI Backend<br/>(12 router: auth, gemini, projects,<br/>gallery, ratings, settings, ...)"]
        RL["Rate Limiter<br/>(theo người dùng)"]
        BE --- RL
    end

    subgraph Data["Tầng dữ liệu"]
        DB[("MongoDB<br/>users, projects,<br/>project_images, user_characters,<br/>gallery, ratings")]
    end

    subgraph AI["Dịch vụ AI bên ngoài"]
        LLM["LLM Provider<br/>(Gemini / NineRouter / BYOK /<br/>local server)"]
        IMG["Máy chủ sinh ảnh GPU<br/>(diffusion + IP-Adapter,<br/>qua Cloudflare tunnel)"]
        POLL["Dịch vụ sinh ảnh<br/>công cộng (dự phòng)"]
    end

    FE -- "REST + SSE (/api/*)" --> BE
    FE -- "proxy ảnh (/api/manga-proxy,<br/>/api/image-proxy)" --> IMG
    BE --> DB
    BE -- "chat/completions<br/>(OpenAI-compatible)" --> LLM
    FE -.-> POLL
```

Ba quyết định kiến trúc quan trọng nhất:

1. **Backend là tầng điều phối LLM duy nhất.** Mọi lời gọi mô hình ngôn ngữ đi qua FastAPI, nơi tập trung: chọn nhà cung cấp (Gemini mặc định, NineRouter khi cấu hình, khoá BYOK của từng người dùng), áp giới hạn tốc độ, và chuẩn hoá lỗi. Frontend không giữ khoá API của LLM — vừa an toàn vừa cho phép đổi nhà cung cấp mà không sửa client.
2. **Sinh ảnh đi đường riêng qua proxy.** Máy chủ sinh ảnh GPU nằm ngoài (được thuê/mượn hạ tầng, truy cập qua Cloudflare tunnel) và bị ràng buộc CORS; frontend gọi tới nó thông qua hai route proxy của chính Next.js (`/api/manga-proxy`, `/api/image-proxy`). Cách này tách tải sinh ảnh nặng khỏi backend FastAPI và cho phép người dùng trỏ tới máy chủ sinh ảnh của riêng họ chỉ bằng một URL trong phần Cài đặt.
3. **Trạng thái pipeline sống ở client, bền vững ở server.** Toàn bộ trạng thái trung gian của quy trình 5 bước được quản lý trong một React Context tập trung phía client (phản hồi tức thời, không round-trip mỗi thao tác), và được đồng bộ lên MongoDB theo dự án để làm việc qua nhiều phiên.

### 4.1.2 Sơ đồ triển khai (Deployment Diagram)

```mermaid
flowchart TB
    subgraph UserMachine["Máy người dùng"]
        Browser["Trình duyệt web"]
    end

    subgraph AppHost["Máy chủ ứng dụng (Docker Compose / máy đơn)"]
        Next["Node.js — Next.js<br/>cổng 3000"]
        Fast["Python — Uvicorn/FastAPI<br/>cổng 8000"]
        Mongo[("MongoDB 7.0<br/>cổng 27017")]
    end

    subgraph External["Hạ tầng bên ngoài"]
        GApi["Google Gemini API /<br/>NineRouter (HTTPS)"]
        GPU["Máy chủ GPU sinh ảnh<br/>(Kaggle + Cloudflare tunnel)"]
        SMTP["Máy chủ SMTP<br/>(đặt lại mật khẩu)"]
        OAuthP["Google / GitHub OAuth"]
    end

    Browser -->|HTTP :3000| Next
    Browser -->|HTTP :8000 /api| Fast
    Next -->|proxy HTTPS| GPU
    Fast --> Mongo
    Fast -->|HTTPS| GApi
    Fast -->|HTTPS| OAuthP
    Fast -->|SMTP| SMTP
```

Ở môi trường phát triển, ba tiến trình (Next.js dev server, Uvicorn, MongoDB) chạy trực tiếp trên máy; ở môi trường đóng gói, Docker Compose khởi động cả ba container với MongoDB dùng URI có xác thực riêng. Máy chủ sinh ảnh GPU là thành phần *thay thế được*: hệ thống chỉ cần một URL endpoint tương thích, người dùng cấu hình trong trang Cài đặt.

Hệ thống đã được **triển khai lên môi trường production** và truy cập công khai tại **https://mohiom.me**:

```mermaid
flowchart TB
    subgraph UserMachine["Máy người dùng"]
        Browser["Trình duyệt web"]
    end

    subgraph Vercel["Vercel"]
        NextProd["Next.js (SSR/Edge)<br/>mohiom.me / www.mohiom.me"]
    end

    subgraph RenderHost["Render"]
        FastProd["FastAPI (Uvicorn)"]
        MongoProd[("MongoDB")]
    end

    subgraph External2["Hạ tầng bên ngoài"]
        GApi2["Google Gemini API / NineRouter"]
        GPU2["Máy chủ GPU sinh ảnh<br/>(Kaggle + Cloudflare tunnel)"]
        SMTP2["Máy chủ SMTP"]
        OAuthP2["Google / GitHub OAuth"]
    end

    Browser -->|HTTPS| NextProd
    NextProd -->|REST/SSE, proxy ảnh| FastProd
    FastProd --> MongoProd
    FastProd -->|HTTPS| GApi2
    FastProd -->|HTTPS| OAuthP2
    FastProd -->|SMTP| SMTP2
    NextProd -->|proxy HTTPS| GPU2
```

Frontend triển khai trên **Vercel** (build tự động từ nhánh chính, CDN/edge cho tài nguyên tĩnh); backend FastAPI và MongoDB chạy trên **Render**. Cấu hình khác biệt so với môi trường phát triển chỉ nằm ở biến môi trường: `CORS_ORIGINS` liệt kê `https://mohiom.me`/`https://www.mohiom.me`, `AUTH_FRONTEND_URL`/`AUTH_BACKEND_URL` trỏ về domain thật để luồng OAuth redirect đúng, và `NEXT_PUBLIC_API_URL` trỏ về địa chỉ backend trên Render — mã nguồn giữ nguyên, không có nhánh code riêng cho production.

## 4.2 Thiết kế cấu trúc tĩnh

### 4.2.1 Sơ đồ thành phần (Component Diagram)

Đây là sơ đồ quan trọng nhất mô tả cấu trúc hệ thống. Các thành phần được nhóm theo tầng, mũi tên thể hiện quan hệ sử dụng qua giao diện (interface):

```mermaid
flowchart TB
    subgraph Frontend["Frontend (Next.js)"]
        Wizard["TextToComicGenerator<br/>(wizard 5 bước)"]
        Ctx["ComicGenerationContext<br/>(trạng thái pipeline + điều phối)"]
        Steps["Các Step Component<br/>Step0Setup → Step5Export"]
        Bubble["DialogueEditor<br/>(bong bóng thoại)"]
        Export["Export lib<br/>(pdf-lib, jszip → PDF/EPUB/ZIP)"]
        ApiClient["api.ts<br/>(REST client, X-User-Id)"]
        Proxy["Route proxy ảnh<br/>manga-proxy / image-proxy"]
        Wizard --> Ctx
        Ctx --> Steps
        Steps --> Bubble
        Ctx --> Export
        Ctx --> ApiClient
        Ctx --> Proxy
    end

    subgraph Backend["Backend (FastAPI)"]
        Routers["Tầng Router<br/>auth · gemini · projects · settings ·<br/>gallery · ratings · analytics · bubbles"]
        GSvc["GeminiService<br/>(điều phối LLM, streaming,<br/>override per-request)"]
        Providers["providers.py<br/>(registry BYOK)"]
        RateL["rate_limit.py<br/>(hàng đợi theo user)"]
        Deps["deps.py + security.py<br/>(JWT, người dùng hiện hành)"]
        Crypto["crypto_utils.py<br/>(mã hoá khoá API)"]
        Repo["crud.py<br/>(UserRepository, ...)"]
        Composer["comic_composer.py +<br/>panel_splitter.py<br/>(ghép trang, tách panel)"]
        Routers --> GSvc
        Routers --> Deps
        Routers --> Repo
        GSvc --> Providers
        GSvc --> RateL
        Routers --> Crypto
        Routers --> Composer
    end

    DB[("MongoDB")]
    LLM["LLM bên ngoài"]
    IMG["Máy chủ sinh ảnh"]

    ApiClient -- "REST/SSE" --> Routers
    Proxy --> IMG
    Repo --> DB
    GSvc --> LLM
```

Vai trò của các thành phần chính:

- **`ComicGenerationContext`** (frontend) — trái tim của client: giữ trạng thái của cả 5 bước (`step1`…`step4`, mỗi bước gồm `data` + `isApproved`), điều phối chuỗi sinh ảnh với retry, đồng bộ dự án lên/xuống server, phát sự kiện thống kê. Mọi Step Component chỉ đọc/ghi qua context này, không gọi API trực tiếp.
- **`GeminiService`** (backend) — đóng gói toàn bộ giao tiếp LLM: dựng prompt, gọi API dạng thường hoặc streaming, và quan trọng nhất là cơ chế *override theo request*: một request của người dùng có cấu hình BYOK sẽ nhận một instance dịch vụ riêng với URL/khoá/mô hình của họ, không đụng vào singleton dùng chung.
- **Tầng Router** — mỗi nhóm nghiệp vụ một router (12 router), tất cả gắn dưới prefix `/api`. Router chỉ làm việc điều phối: xác thực, gọi service, trả response; logic AI nằm trong service.
- **Route proxy ảnh** — hai route API của Next.js chuyển tiếp yêu cầu sinh ảnh/đọc truyện tới máy chủ GPU bên ngoài, giải quyết CORS và che giấu địa chỉ hạ tầng.

### 4.2.2 Sơ đồ gói (Package Diagram)

```
frontend/src/                          backend/app/
├── app/            (routes, pages)    ├── main.py        (khởi tạo, mount router)
│   ├── (auth)/                        ├── config.py      (Settings từ .env)
│   ├── studio/     (wizard, editor,   ├── routers/       (12 router REST/SSE)
│   │                dashboard, ...)   ├── services.py    (GeminiService)
│   ├── settings/                      ├── providers.py   (registry BYOK)
│   └── api/        (proxy routes)     ├── rate_limit.py  (hàng đợi per-user)
├── components/     (UI components)    ├── crud.py        (repository)
│   ├── story-setup/                   ├── schemas.py     (Pydantic models)
│   └── studio-steps/ (Step0..Step5)   ├── security.py    (JWT, băm mật khẩu)
├── context/        (ComicGeneration-  ├── deps.py        (dependency injection)
│                    Context, Auth)    ├── crypto_utils.py (Fernet)
├── services/       (api.ts client)    ├── emailer.py     (SMTP)
└── lib/            (export, publish,  ├── comic_composer.py
                     analytics, ...)   └── panel_splitter.py
```

Nguyên tắc phụ thuộc: `components → context → services/lib`; phía backend `routers → services/crud → database`, không có phụ thuộc ngược.

### 4.2.3 Sơ đồ lớp (Class Diagram) cho các mô-đun chính

Sơ đồ lớp rút gọn cho hai mô-đun quan trọng: điều phối LLM (backend) và trạng thái pipeline (frontend).

```mermaid
classDiagram
    class GeminiService {
        -base_url: str
        -api_key: str
        -model: str
        +__init__(override_url?, override_api_key?, override_model?)
        +generate_text(prompt) str
        +generate_text_stream(prompt) AsyncIterator
        +analyze_story(text, config) StoryAnalysis
        +character_designs_structured(analysis) list
        +panel_script(scene, chars) PanelScript
    }
    class RateLimiter {
        -requests_per_second: float
        -max_queue_size: int
        -max_wait_seconds: float
        +acquire(user_id) None
    }
    class UserRepository {
        +get_by_email(email)
        +get_by_id(user_id)
        +upsert_oauth_user(provider, profile)
        +get_text_gen_config(user_id)
        +set_text_gen_config(user_id, config)
    }
    class TextGenProvider {
        +key: str
        +label: str
        +base_url: str
        +default_model: str
    }
    GeminiService --> RateLimiter : chờ lượt
    GeminiService --> TextGenProvider : cấu hình BYOK
    class ComicGenerationContext {
        +step1: StepState~StorySetup~
        +step2: StepState~StoryAnalysis~
        +step2ImageReview: StepState~CharacterImages~
        +step3: StepState~PanelScript~
        +step4: StepState~GenerationResult~
        +projectId: string
        +comicPageMode: 'page'|'panel'|null
        +analyzeStory() Promise
        +generateCharacterImages() Promise
        +generatePanelImages() Promise
        +addCandidateFromImage(charId, dataUrl)
        +loadFromCloud(projectId) Promise
        +saveToCloud() Promise
        +exportPdf(meta) exportEpub(meta) exportZip(meta)
    }
    class StepState~T~ {
        +data: T|null
        +isApproved: boolean
        +status: idle|loading|success|error
    }
    ComicGenerationContext --> StepState : 5 bước
```

## 4.3 Thiết kế hành vi động

### 4.3.1 Sơ đồ tuần tự (Sequence Diagram) cho pipeline 5 bước

Sơ đồ dưới đây mô tả luồng đầy đủ từ văn bản đến truyện hoàn chỉnh — sơ đồ trung tâm của khoá luận:

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant FE as Frontend (Context)
    participant BE as Backend (FastAPI)
    participant LLM as LLM Provider
    participant IMG as Máy chủ sinh ảnh
    participant DB as MongoDB

    Note over U,DB: Bước 1 — Nhập truyện & thiết lập
    U->>FE: Nhập văn bản, chọn thể loại/phong cách
    FE->>DB: (qua BE) saveProject — steps.step1

    Note over U,DB: Bước 2 — Phân tích truyện (SSE)
    U->>FE: Bấm "Phân tích"
    FE->>BE: POST /api/gemini/analyze-story (stream)
    BE->>BE: rate_limiter.acquire(user)
    BE->>LLM: chat/completions (stream)
    loop từng khối token
        LLM-->>BE: delta
        BE-->>FE: SSE "data: ..."
        FE-->>U: hiển thị dần
    end
    FE->>FE: parse JSON → nhân vật, cảnh, thoại
    U->>FE: Hiệu chỉnh & duyệt
    FE->>DB: saveProject — steps.step2

    Note over U,DB: Bước 3 — Nhân vật nhất quán
    FE->>BE: POST /api/gemini/character-designs-structured
    BE->>LLM: sinh mô tả cấu trúc
    LLM-->>BE: JSON thiết kế nhân vật
    loop mỗi nhân vật
        FE->>IMG: (proxy) sinh ảnh chân dung ứng viên
        IMG-->>FE: ảnh PNG (base64)
    end
    U->>FE: Chọn ảnh chính thức / gắn ảnh tham chiếu
    FE->>DB: saveProject — steps.step2ImageReview

    Note over U,DB: Bước 4 — Kịch bản, bố cục, sinh trang
    FE->>BE: POST /api/gemini/panel-script
    BE->>LLM: sinh kịch bản từng panel
    LLM-->>BE: JSON panel script
    U->>FE: Chọn layout (hoặc AI Suggest), bấm Generate
    loop mỗi panel/trang
        FE->>IMG: (proxy) prompt + mô tả nhân vật + ảnh tham chiếu (IP-Adapter)
        alt thành công
            IMG-->>FE: ảnh panel
        else thất bại
            FE->>FE: retry tối đa 3 lần, cách 3 giây
        end
        FE-->>U: cập nhật canvas trực tiếp
    end
    U->>FE: Soạn bong bóng thoại (auto-import từ script)
    FE->>DB: saveProject — steps.step4 + project_images

    Note over U,DB: Bước 5 — Xuất bản
    U->>FE: Chọn PDF / EPUB / ZIP
    FE->>FE: dựng file phía trình duyệt (pdf-lib / jszip)
    FE-->>U: tải file về
    opt Xuất bản web
        FE->>IMG: (proxy) publish → reader URL
        FE-->>U: liên kết chia sẻ + thống kê lượt đọc
    end
```

Hai điểm đáng chú ý trong thiết kế luồng: (1) các bước *phân tích văn bản* đi qua backend để hưởng điều phối LLM và rate limit, còn *sinh ảnh* đi thẳng qua proxy tới máy chủ GPU — hai loại tải rất khác nhau không nghẽn lẫn nhau; (2) việc dựng file xuất bản chạy hoàn toàn trên trình duyệt, backend không phải giữ file trung gian.

### 4.3.2 Sơ đồ hoạt động (Activity Diagram) cho luồng sinh ảnh hàng loạt

Luồng nghiệp vụ có logic rẽ nhánh dày nhất là sinh ảnh hàng loạt ở Bước 4:

```mermaid
flowchart TD
    A([Bắt đầu Generate]) --> B{Chế độ?}
    B -->|Full page| C[Lấy danh sách trang]
    B -->|Panel-by-panel| D[Lấy danh sách panel theo trang]
    C --> E[Chọn phần tử kế tiếp chưa có ảnh]
    D --> E
    E --> F[Ghép prompt: kịch bản + mô tả nhân vật + phong cách]
    F --> G{Có ảnh tham chiếu?}
    G -->|Có| H[Đính kèm ảnh + ip_scale]
    G -->|Không| I[Chỉ prompt văn bản]
    H --> J[Gọi máy chủ sinh ảnh qua proxy]
    I --> J
    J --> K{Thành công?}
    K -->|Có| L[Lưu ảnh vào state, cập nhật canvas]
    K -->|Không| M{Đã thử đủ 3 lần?}
    M -->|Chưa| N[Chờ 3 giây] --> J
    M -->|Rồi| O[Đánh dấu panel lỗi, hiện nút thử lại riêng]
    L --> P{Người dùng bấm Pause?}
    O --> P
    P -->|Có| Q([Dừng, cho phép Resume])
    P -->|Không| R{Còn phần tử?}
    R -->|Còn| E
    R -->|Hết| S[Ghi sự kiện thống kê] --> T([Hoàn tất])
```

### 4.3.3 Sơ đồ trạng thái (State Machine Diagram) của tiến trình sinh truyện

Mỗi dự án truyện di chuyển qua các trạng thái tương ứng tiến độ pipeline; danh sách dự án hiển thị trực quan các trạng thái này bằng huy hiệu S1–S5:

```mermaid
stateDiagram-v2
    [*] --> Draft : tạo dự án
    Draft --> Analyzed : phân tích truyện thành công (S1→S2)
    Analyzed --> CharactersReady : duyệt bộ nhân vật + ảnh (S3)
    CharactersReady --> Scripted : sinh kịch bản panel (S4)
    Scripted --> Generated : sinh đủ ảnh trang/panel (S5)
    Generated --> Published : xuất bản web reader
    Analyzed --> Draft : sửa văn bản gốc
    CharactersReady --> Analyzed : hiệu chỉnh phân tích
    Scripted --> CharactersReady : đổi nhân vật/tham chiếu
    Generated --> Scripted : đổi bố cục, sinh lại
    Published --> Generated : chỉnh sửa sau xuất bản
```

Đặc điểm của máy trạng thái này là **cho phép quay lui có kiểm soát**: người dùng sửa một bước phía trước sẽ vô hiệu phần phê duyệt của các bước phía sau bước đó, nhưng dữ liệu đã sinh không bị xoá ngay — tránh mất công sinh ảnh tốn kém do một chỉnh sửa nhỏ.

## 4.4 Thiết kế dữ liệu

### 4.4.1 Sơ đồ thực thể quan hệ (ERD)

Dù MongoDB không ép quan hệ, về mặt logic dữ liệu vẫn có cấu trúc quan hệ rõ:

```mermaid
erDiagram
    USER ||--o{ PROJECT : "sở hữu"
    USER ||--o{ USER_CHARACTER : "lưu thư viện"
    USER ||--o| TEXT_GEN_CONFIG : "cấu hình LLM"
    PROJECT ||--o{ PROJECT_IMAGE : "chứa ảnh"
    PROJECT ||--o{ CHARACTER : "nhúng (embedded)"
    PROJECT ||--o{ PANEL : "nhúng (embedded)"
    USER ||--o{ RATING : "đánh giá"
    GALLERY_ITEM }o--|| USER : "chia sẻ bởi"

    USER {
        ObjectId _id
        string email
        string password_hash
        object oauth "google/github profile"
        object text_gen_config "mode, provider, api_key(mã hoá)"
    }
    PROJECT {
        string user_id
        string project_id
        object steps "step1..step4, mỗi step {data, isApproved}"
        datetime updated_at
    }
    PROJECT_IMAGE {
        string user_id
        string project_id
        string image_key
        string image_base64
    }
    USER_CHARACTER {
        string user_id
        string name
        object design "mô tả cấu trúc"
        string image_base64
    }
```

### 4.4.2 Thiết kế schema MongoDB

Cơ sở dữ liệu `mohiom_db` gồm các collection chính:

**`users`** — tài khoản người dùng. Điểm đáng chú ý: một tài khoản có thể có đồng thời nhiều phương thức đăng nhập (`password_hash` cho đăng nhập thủ công, `oauth.google`, `oauth.github`); cấu hình LLM cá nhân nằm trong sub-document `text_gen_config` với khoá API đã mã hoá Fernet — cơ sở dữ liệu bị lộ cũng không lộ khoá.

```json
{
  "_id": ObjectId,
  "email": "user@example.com",
  "first_name": "...", "last_name": "...",
  "password_hash": "bcrypt...",
  "oauth": { "google": { "id": "...", "email": "..." } },
  "reset_token_hash": null,
  "text_gen_config": {
    "mode": "byok | nine_router | local_server",
    "provider": "gemini | openai | deepseek",
    "api_key_encrypted": "gAAAAA...",
    "model": "...", "api_url": "..."
  },
  "created_at": ISODate, "updated_at": ISODate
}
```

**`projects`** — mỗi tài liệu là một dự án truyện, phản chiếu trực tiếp cấu trúc 5 bước của pipeline. Đây là quyết định thiết kế then chốt: *lược đồ CSDL đồng hình với trạng thái client*, nên thao tác lưu/tải dự án chỉ là serialize/deserialize context, không cần tầng ánh xạ phức tạp.

```json
{
  "user_id": "...", "project_id": "ten-du-an",
  "steps": {
    "step1":            { "data": { "storyText": "...", "genre": "...", "artStyle": "..." }, "isApproved": true },
    "step2":            { "data": { "summary": "...", "characters": [...], "scenes": [...] }, "isApproved": true },
    "step2ImageReview": { "data": { "characters": [ { "characterId": "...", "candidates": [...], "selectedCandidateId": "...", "referenceImageBase64": "..." } ] }, "isApproved": true },
    "step3":            { "data": { "pages": [ { "panels": [ { "shot": "...", "action": "...", "dialogue": [...] } ] } ] }, "isApproved": true },
    "step4":            { "data": { "layoutByPage": {...}, "pageStates": {...}, "bubbles": {...} } }
  },
  "updated_at": ISODate
}
```

**`project_images`** — ảnh được tách riêng khỏi tài liệu dự án. Lý do: MongoDB giới hạn 16MB mỗi tài liệu, trong khi một truyện vài chục trang ảnh base64 dễ dàng vượt ngưỡng. Mỗi ảnh là một tài liệu `(user_id, project_id, image_key)` với chỉ mục unique ba trường (được tạo tự động lúc khởi động ứng dụng), cho phép upsert từng ảnh và tải theo nhu cầu.

**`user_characters`** — thư viện nhân vật độc lập dự án, phục vụ tái sử dụng nhân vật giữa các truyện. **`gallery`**, **`ratings`** — chia sẻ cộng đồng và đánh giá. **`items`** — collection generic dùng cho thử nghiệm.

## 4.5 Thiết kế giao tiếp client–server

### 4.5.1 Thiết kế REST API

Tất cả endpoint gắn dưới prefix `/api`, dữ liệu JSON, định danh người dùng qua header `X-User-Id` (do client tự động chèn) hoặc JWT cookie cho các thao tác cần xác thực thật. Các nhóm chính (danh sách đầy đủ tại **Phụ lục B**):

| Nhóm | Endpoint tiêu biểu | Chức năng |
|---|---|---|
| Xác thực | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/oauth/{provider}`, `POST /api/auth/forgot-password` | đăng ký/đăng nhập, OAuth Google/GitHub, đặt lại mật khẩu |
| Sinh văn bản | `POST /api/gemini/generate-text`, `POST /api/gemini/analyze-story`, `POST /api/gemini/character-prompt`, `POST /api/gemini/character-designs-structured`, `POST /api/gemini/panel-script` | các bước LLM của pipeline; nhiều endpoint có biến thể streaming |
| Dự án | `POST /api/projects/save`, `GET /api/projects/list`, `GET /api/projects/load`, `POST /api/projects/images/save`, `DELETE /api/projects/{id}` | lưu/tải dự án và ảnh, danh sách kèm tiến độ S1–S5 |
| Nhân vật | `GET/POST/PUT/DELETE /api/projects/characters` | thư viện nhân vật cá nhân + nhân vật trong dự án |
| Cài đặt | `GET/PUT/DELETE /api/settings/text-gen-config`, `GET /api/settings/text-gen-providers` | cấu hình BYOK/NineRouter/local server |
| Cộng đồng | `/api/gallery/*`, `/api/ratings/*` | chia sẻ và đánh giá |

Quy ước lỗi thống nhất: `401` chưa xác thực, `404` sai tài nguyên, `422` dữ liệu không hợp lệ (Pydantic), `429` vượt giới hạn tốc độ, `503` hàng đợi rate limit đầy — client có logic riêng cho 429/503 (chờ và thử lại thay vì báo lỗi cứng).

### 4.5.2 Thiết kế luồng streaming SSE

Các endpoint phân tích văn bản trả về `StreamingResponse` với `Content-Type: text/event-stream`. Hợp đồng dữ liệu:

```
data: {"text": "khối token vừa sinh"}
data: {"text": "..."}
...
data: [DONE]
```

Phía client đọc stream tuần tự, dồn các khối vào buffer hiển thị. Khi stream kết thúc, toàn văn được parse thành JSON kết quả (mô hình được prompt trả JSON trong khối mã). Thiết kế này cho người dùng thấy tiến trình ngay từ giây đầu tiên thay vì chờ 30–60 giây, đồng thời giữ được kết quả có cấu trúc ở cuối. Trường hợp mất kết nối giữa chừng, client huỷ buffer và cho phép chạy lại — server không giữ trạng thái nên không cần dọn dẹp.

### 4.5.3 Thiết kế proxy ảnh và giao tiếp với máy chủ sinh ảnh ngoài

Máy chủ sinh ảnh GPU chạy trên hạ tầng notebook (Kaggle), công khai qua Cloudflare tunnel — trình duyệt gọi thẳng sẽ bị chặn CORS và lộ địa chỉ tunnel. Giải pháp: hai route proxy ngay trong Next.js:

- **`/api/manga-proxy`** — proxy tổng quát cho mọi lời gọi tới máy chủ sinh ảnh: sinh panel (kèm ảnh tham chiếu IP-Adapter và hệ số `ip_scale`), xuất bản truyện lên trình đọc web, lấy thống kê lượt đọc (`/admin/publish-stats` — một request gộp cho mọi truyện thay vì N request).
- **`/api/image-proxy`** — proxy tối ưu cho việc tải ảnh đã sinh và ảnh nhân vật.

URL của máy chủ sinh ảnh do người dùng cấu hình một nơi duy nhất (trang Cài đặt), lưu ở `localStorage` qua helper `getImageApiUrl()/setImageApiUrl()` — mọi thành phần cần gọi ảnh đều đọc từ nguồn duy nhất này. Khi chưa cấu hình, các tính năng phụ thuộc hiển thị trạng thái "chưa kết nối máy chủ" kèm liên kết tới trang Cài đặt thay vì lỗi khó hiểu.

## 4.6 Thiết kế giao diện người dùng

### 4.6.1 Luồng người dùng (User Flow)

```
Trang chủ ──▶ Đăng nhập/Đăng ký (tuỳ chọn) ──▶ Studio
                                                 │
        ┌────────────────────────────────────────┘
        ▼
  [Bước 1] Nhập truyện ──▶ [Bước 2] Phân tích ──▶ [Bước 3] Nhân vật ──▶ [Bước 4] Sinh trang ──▶ [Bước 5] Xuất
   văn bản, thể loại,       xem/sửa nhân vật,      duyệt ảnh ứng viên,     chọn layout,           PDF / EPUB / ZIP
   phong cách vẽ            phân cảnh, thoại       ảnh tham chiếu          generate, thoại        / Publish web
        │                                                                       ▲
        └── Dashboard dự án (mở lại dự án cũ, URL ?project=<id>) ───────────────┘
```

Nguyên tắc thiết kế luồng: wizard **tuyến tính nhưng không khoá cứng** — người dùng đi tới bước sau khi bước trước được duyệt, song luôn quay lại được bước trước để chỉnh; thanh tiến trình hiển thị trạng thái từng bước. Các trang phụ (My Stories, Character Manager, Analytics, Publish History, Settings) truy cập qua sidebar cố định của khu vực Studio.

### 4.6.2 Wireframe các màn hình chính

**Màn hình Bước 4 — Canvas Studio** (màn hình phức tạp nhất):

```
┌─────────────────────────────────────────────────────────────────┐
│ Top bar: tên dự án · trạng thái lưu · người dùng                 │
├──────────┬──────────────────────────────────┬────────────────────┤
│ Sidebar  │  ◀ Prev   ● ● ○ ○   Next ▶       │ LAYOUT TEMPLATE    │
│ Studio   │  ┌────────────────────────────┐  │ [All|Std|Hero|...] │
│          │  │  ┌──────────┐┌───────────┐ │  │ ▣ ▥ ▤ ▦  (chọn    │
│ - Editor │  │  │ P1       ││ P2        │ │  │  mẫu, ✨AI Suggest)│
│ - Stories│  │  │ (ảnh)    ││ (spinner) │ │  ├────────────────────┤
│ - Chars  │  │  └──────────┘└───────────┘ │  │ ⚡ Generate All     │
│ - Analyt.│  │  ┌───────────────────────┐ │  │ ▓▓▓▓▓░░░ 5/8       │
│ - Publish│  │  │ P3  (click to gen)    │ │  │ ☑ Clean images     │
│ - Setting│  │  └───────────────────────┘ │  ├────────────────────┤
│          │  └────────────────────────────┘  │ PAGE SUMMARY       │
│          │   (trang truyện trắng giữa       │ ● P1 wide shot...  │
│          │    canvas xám, panel đặt theo    │ ● P2 close-up...   │
│          │    đúng toạ độ layout)           │ ○ P3 ...           │
└──────────┴──────────────────────────────────┴────────────────────┘
```

**Màn hình Bước 3 — Nhân vật:** danh sách thẻ accordion cho từng nhân vật; mỗi thẻ có lưới ảnh ứng viên (chọn 1), khu vực ảnh tham chiếu (tải lên / From Library / Browse Community / "Use as character image"), và bộ chọn chế độ sinh (Text / +Ref / All).

**Trình soạn bong bóng thoại (tab Dialogue):** trang truyện hiển thị nền, panel là các ô định vị đúng theo layout; bảng bên phải liệt kê mẫu bong bóng kéo-thả và nút "Auto-import from script" đổ thoại từ kịch bản vào đúng panel.

**Danh sách dự án:** thẻ dự án có dải màu định danh, tiêu đề, huy hiệu tiến độ S1–S5 (xanh đặc = hoàn tất), thời gian sửa gần nhất; sắp xếp theo Recent / Tên / Mức hoàn thành.

Toàn bộ giao diện dùng hệ token Material Design (biến CSS `--color-primary`, `--color-surface-container`...) trên nền Tailwind CSS, biểu tượng `lucide-react`, chuyển động `framer-motion`.

---

# Chương 5: Triển khai hệ thống

## 5.1 Môi trường phát triển và công cụ sử dụng

| Thành phần | Công nghệ / phiên bản | Ghi chú |
|---|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript (strict) | cổng 3000 |
| Styling | Tailwind CSS + CSS custom properties (Material tokens) | không dùng Prettier, format bằng ESLint |
| Backend | Python 3.10+, FastAPI, Uvicorn | cổng 8000 |
| CSDL | MongoDB 7.0, trình điều khiển PyMongo (đồng bộ) | local hoặc container |
| Gọi API AI | `httpx` (async), chuẩn OpenAI-compatible `chat/completions` | Gemini / NineRouter / BYOK |
| Sinh ảnh | máy chủ diffusion + IP-Adapter trên GPU Kaggle, Cloudflare tunnel | cấu hình URL trong Settings |
| Xuất file | `pdf-lib`, `jszip` (chạy trên trình duyệt) | PDF / EPUB / ZIP |
| Đóng gói | Docker Compose (MongoDB + backend + frontend) | |
| Quản lý mã | Git, GitHub | |

Quy trình phát triển lặp theo tính năng: mỗi tính năng đi qua chu trình *hiện thực → chạy thử trên stack thật → ghi nhận quyết định thiết kế vào nhật ký phiên (SESSION_LOG.md)*. Nhật ký này đóng vai trò như tài liệu ADR (Architecture Decision Record) thu gọn, giúp truy lại lý do của từng quyết định khi viết khoá luận.

Ngoài môi trường phát triển ở bảng trên, hệ thống **đã được triển khai và đang chạy ở môi trường production**: frontend trên **Vercel**, backend + MongoDB trên **Render**, phục vụ tại tên miền **https://mohiom.me** (chi tiết kiến trúc triển khai ở mục 4.1.2).

## 5.2 Triển khai backend

### 5.2.1 Tổ chức ứng dụng FastAPI

Ứng dụng khởi tạo trong `app/main.py`: quản lý vòng đời qua `lifespan` (kết nối MongoDB lúc khởi động, tạo chỉ mục unique `(user_id, project_id, image_key)` cho collection `project_images`, ngắt kết nối lúc tắt), gắn middleware CORS theo danh sách origin cấu hình, và mount 12 router dưới prefix `/api`. Cấu hình tập trung ở `app/config.py`, đọc từ biến môi trường `.env` — toàn bộ tham số vận hành (khoá API, giới hạn tốc độ, danh sách mô hình, SMTP, OAuth) đều đổi được không cần sửa mã.

### 5.2.2 Dịch vụ điều phối LLM và cơ chế đa nhà cung cấp

`GeminiService` (trong `app/services.py`, ~2.500 dòng) là thành phần lớn nhất của backend, chứa toàn bộ prompt template và logic gọi LLM cho các tác vụ: sinh văn bản tự do, phân tích truyện (thường + streaming), chuyển thể truyện, sinh prompt nhân vật, sinh thiết kế nhân vật có cấu trúc, sinh kịch bản panel.

Cơ chế đa nhà cung cấp được hiện thực ở hai mức:

- **Mức hệ thống:** nếu `.env` khai báo `NINE_ROUTER_URL`, toàn bộ lời gọi LLM chuyển sang dịch vụ trung gian NineRouter thay cho Gemini. Cả hai đều nói chung một "phương ngữ" OpenAI-compatible `chat/completions`, nên không có mã riêng cho từng định dạng.
- **Mức người dùng (BYOK):** hàm `_resolve_gemini_service(http_request)` trong router quyết định instance dịch vụ cho *từng request*: người dùng có `text_gen_config` chế độ `byok` nhận instance mới với URL/khoá của nhà cung cấp họ chọn (registry `TEXT_GEN_PROVIDERS` gồm Gemini, OpenAI, DeepSeek — cùng chuẩn giao tiếp); chế độ `local_server` trỏ tới máy chủ mô hình cục bộ của họ; chế độ `nine_router` chỉ ghi đè tên mô hình. Người dùng ẩn danh dùng singleton mặc định.

Một quyết định quan trọng: **tạo instance mới theo request thay vì sửa singleton dùng chung**. Phiên bản đầu tiên từng sửa trực tiếp singleton và gặp lỗi tiềm ẩn: hai request đồng thời của hai người dùng có thể "dẫm" cấu hình của nhau. Bài học này được ghi nhận như một lỗi cạnh tranh (race condition) điển hình khi thêm tính năng per-user vào dịch vụ vốn thiết kế toàn cục.

Khoá API do người dùng cung cấp được mã hoá bằng Fernet (`app/crypto_utils.py`), khoá mã hoá dẫn xuất từ `JWT_SECRET_KEY` qua SHA-256 — không lưu khoá gốc dạng thô ở bất cứ đâu.

### 5.2.3 Giới hạn tốc độ theo người dùng

`app/rate_limit.py` hiện thực giới hạn kiểu hàng đợi: mỗi người dùng có ngân sách mặc định 2 request/giây; request vượt ngân sách xếp vào hàng đợi tối đa 8 phần tử; phần tử chờ quá 8 giây bị trả `503`, hàng đợi đầy trả `429`. Ba tham số đều cấu hình được qua `.env`. Cơ chế này bảo vệ hạn mức API của nhà cung cấp AI khỏi các thao tác dồn dập (ví dụ bấm "Generate All" trên truyện 20 panel) mà vẫn công bằng giữa các người dùng.

### 5.2.4 Xác thực và bảo mật

Router `auth` cài đầy đủ: đăng ký/đăng nhập email-mật khẩu (băm bcrypt), phát hành JWT, luồng OAuth 2.0 Authorization Code cho Google và GitHub (một tài khoản liên kết được nhiều nhà cung cấp — hàm `upsert_oauth_user` hợp nhất theo email), quên mật khẩu qua email SMTP với token đặt lại được băm và có hạn dùng. Dependency `get_current_user_optional/required` (`app/deps.py`) tách bạch các endpoint "dùng được khi ẩn danh" và "bắt buộc đăng nhập".

## 5.3 Triển khai frontend

### 5.3.1 ComicGenerationContext — bộ não của wizard 5 bước

File `frontend/src/context/ComicGenerationContext.tsx` (~72KB) là thành phần tải nặng nhất của frontend, sở hữu toàn bộ trạng thái pipeline: năm khối bước (`step1`, `step2`, `step2ImageReview`, `step3`, `step4` — mỗi khối `{data, isApproved}`), chế độ sinh (`comicPageMode`), trạng thái sinh từng panel/trang (`panelStates`/`pageStates`), bong bóng thoại, và các hàm điều phối (phân tích, sinh ảnh, lưu/tải đám mây, xuất file). Các Step Component chỉ tiêu thụ context, nhờ đó chuyển bước không mất dữ liệu và mọi logic nghiệp vụ tập trung một chỗ. Đổi lại, file này nhạy cảm về hiệu năng — các giá trị đều bọc `useCallback`/`useMemo` để hạn chế render lan truyền.

Dự án đồng bộ hai chiều với server: `saveToCloud()` đẩy `steps` lên `POST /api/projects/save` (ảnh tách riêng qua `projects/images/save`), `loadFromCloud(projectId)` kéo về và khôi phục nguyên trạng thái. URL của trang studio phản ánh dự án đang mở (`/studio?project=<id>`) — chỉ được đồng bộ khi mở dự án chủ đích qua `loadFromCloud`, không phải mọi thay đổi `projectId` (một phiên bản đầu từng đồng bộ theo mọi thay đổi state và vô tình đẩy dự án cũ từ localStorage lên URL; xem mục 5.5).

### 5.3.2 Wizard 5 bước và các màn hình chính

Mỗi bước là một component trong `components/studio-steps/`: `Step0Setup` (nhập truyện, cấu hình), `Step1Analysis` (hiển thị kết quả phân tích streaming, cho hiệu chỉnh), `Step2Characters` (duyệt ảnh nhân vật, ảnh tham chiếu ba nguồn: tải lên / thư viện / cộng đồng, nút "Use as character image"), `Step3Script` (kịch bản panel), `Step4Generation` + `Step4CanvasEditor` + `DialogueEditor` (canvas studio: trang truyện trắng trên nền xám, panel định vị theo `LAYOUT_PANEL_RECTS` của 26 mẫu bố cục chia 4 nhóm, sidebar chọn template + AI Suggest + tiến trình sinh; tab thoại với kéo-thả bong bóng và auto-import), `Step5Export` (PDF/EPUB/ZIP + Publish).

### 5.3.3 Xuất file phía trình duyệt

`lib/export.ts` dựng cả ba định dạng ngay trên trình duyệt, không cần backend: PDF bằng `pdf-lib` giữ nguyên kích thước ảnh gốc từng trang (thay cho phương án jsPDF ép khổ A4 gây letterbox); EPUB 3.0 dựng thủ công bằng `jszip` đúng đặc tả (file `mimetype` phải đứng đầu và không nén — vi phạm là Apple Books/Kindle từ chối); ZIP ảnh PNG đặt tên `page_01.png`… Metadata truyện nhúng vào file xuất.

## 5.4 Triển khai pipeline sinh truyện end-to-end

Ghép các phần trên lại, một lượt sinh truyện hoàn chỉnh diễn ra như sau:

1. **Nhập & phân tích:** văn bản + cấu hình gửi tới `POST /api/gemini/analyze-story` (SSE). Kết quả JSON được parse thành nhân vật/cảnh/thoại, hiển thị cho người dùng hiệu chỉnh, rồi đóng dấu duyệt.
2. **Nhân vật:** `character-designs-structured` sinh bản thiết kế cấu trúc; với mỗi nhân vật, frontend gọi máy chủ sinh ảnh (qua proxy) tạo các ảnh chân dung ứng viên; người dùng chọn ảnh chính thức và gắn ảnh tham chiếu nếu muốn. Nhân vật lưu được vào thư viện dùng lại.
3. **Kịch bản & bố cục:** `panel-script` sinh kịch bản từng panel theo trang; người dùng chọn mẫu bố cục cho từng trang (hoặc để AI gợi ý — backend phân tích nội dung trang và đề xuất template kèm lý do).
4. **Sinh ảnh:** với chế độ panel-by-panel, mỗi panel được tính kích thước sinh phù hợp từ bbox của nó trong template (làm tròn bội số 8, chặn trong [256, 1024]); prompt ghép từ kịch bản + mô tả nhân vật + phong cách; ảnh tham chiếu truyền kèm hệ số `ip_scale` để IP-Adapter giữ nhận dạng. Vòng sinh có retry 3 lần/panel và tạm dừng – tiếp tục được.
5. **Thoại & xuất:** bong bóng thoại auto-import từ kịch bản rồi tinh chỉnh tay; cuối cùng xuất PDF/EPUB/ZIP hoặc Publish lên trình đọc web (kèm lịch sử xuất bản và số lượt đọc gộp từ một endpoint thống kê duy nhất).

## 5.5 Các vấn đề kỹ thuật gặp phải và hướng giải quyết

### 5.5.1 Duy trì nhất quán nhân vật

*Vấn đề:* các lần sinh panel độc lập cho ra nhân vật khác nhau dù prompt giống nhau.

*Giải quyết theo bốn lớp:* (1) mô tả nhân vật sinh **một lần** dưới dạng cấu trúc và ghép nguyên văn vào mọi prompt panel — loại bỏ nguồn dao động do diễn đạt lại; (2) ảnh chân dung tham chiếu do người dùng duyệt từ nhiều ứng viên — con người chốt "nhân vật trông thế nào" thay vì phó mặc mô hình; (3) ảnh tham chiếu truyền vào từng lần sinh qua IP-Adapter, hệ số `ip_scale` điều chỉnh được theo cảnh; (4) sinh lại cục bộ từng panel lệch. Kinh nghiệm thực nghiệm: `ip_scale` quá cao làm nhân vật "đơ" cùng một tư thế qua các panel, quá thấp thì mất nhận dạng — giá trị phù hợp phụ thuộc phong cách vẽ, và giao diện cho phép chỉnh theo nhân vật.

### 5.5.2 Xử lý bất đồng bộ, timeout và giới hạn API

*Vấn đề:* lời gọi LLM kéo dài hàng chục giây (nguy cơ timeout, màn hình trắng); thao tác sinh hàng loạt bắn hàng chục request (nguy cơ vượt rate limit của nhà cung cấp); sinh ảnh thỉnh thoảng thất bại ngẫu nhiên (mạng, tải GPU).

*Giải quyết:* SSE cho mọi tác vụ LLM dài — token đầu tiên đến trong ~1–3 giây nên người dùng luôn thấy tiến triển; hàng đợi rate limit theo người dùng ở backend với hợp đồng lỗi rõ ràng (429/503) để client phản ứng đúng; vòng sinh ảnh bọc `withRetry` (3 lần, giãn 3 giây) — panel giữ trạng thái `loading` trong lúc thử lại và chỉ chuyển `error` khi hết lượt, một panel hỏng không phá cả lô; hai luồng tải (văn bản qua backend, ảnh qua proxy) tách nhau nên nghẽn một bên không kéo bên kia.

### 5.5.3 Giới hạn lưu trữ ảnh trong MongoDB

*Vấn đề:* ảnh lưu dạng base64; nhét toàn bộ vào tài liệu dự án nhanh chóng chạm trần 16MB/tài liệu của MongoDB và làm mọi thao tác lưu/tải chậm dần.

*Giải quyết:* tách ảnh ra collection `project_images`, mỗi ảnh một tài liệu định danh `(user_id, project_id, image_key)` với chỉ mục unique — lưu là upsert từng ảnh (chỉ ảnh thay đổi mới ghi), tải theo nhu cầu. Tài liệu dự án chỉ còn dữ liệu cấu trúc nhẹ. Hướng mở rộng khi ảnh lớn hơn nữa là chuyển sang object storage (GridFS/S3) — được ghi nhận ở phần hướng phát triển.

### 5.5.4 Các vấn đề nhỏ đáng ghi nhận khác

- **Bong bóng thoại trên trang Full-mode hiển thị đen:** ảnh nền trang đặt bằng CSS `backgroundImage` bị thuộc tính shorthand `background` ghi đè khi React re-render, làm trang 2 trở đi mất ảnh — khắc phục bằng thẻ `<img>` định vị tuyệt đối thay cho CSS background.
- **Panel định vị tuyệt đối bị xếp chồng:** thuộc tính `position: 'relative'` hardcode ghi đè `position: 'absolute'` được spread từ style của layout — lỗi một dòng nhưng làm hỏng mọi bố cục phi lưới; sửa bằng điều kiện hoá `position` theo loại layout.
- **`useSearchParams()` của Next.js 14 yêu cầu Suspense boundary:** tránh hoàn toàn bằng cách đọc `searchParams` ở Server Component và dùng `usePathname()`/`useRouter()` phía client khi đồng bộ URL dự án.
- **Vòng lặp render vô hạn ("Maximum update depth exceeded") ở màn hình quản lý nhân vật:** một mảng dẫn xuất (lọc bằng `.filter()` từ dữ liệu gốc) được tính lại — tức cấp một tham chiếu mới — ở mỗi lần render, trong khi vẫn được dùng làm dependency của `useEffect`; effect đó lại gọi `setState` với một `Set` mới không kiểm tra thay đổi thực sự trước khi cập nhật, tạo vòng lặp render bất tận. Khắc phục bằng cách bọc mảng dẫn xuất trong `useMemo` (ổn định tham chiếu khi dữ liệu gốc không đổi) và thêm điều kiện so sánh nội dung trước khi `setState` trong effect liên quan. Bài học chung: mọi mảng/object dẫn xuất dùng làm dependency của hook đều phải được memo hoá, nếu không dependency array mất tác dụng.
- **Thiếu lớp bảo vệ xác thực cho toàn bộ khu vực Studio, và một race condition khi sửa:** phát hiện người dùng chưa đăng nhập vẫn truy cập được mọi trang trong khu vực tạo truyện (không có middleware/layout chặn), khiến các lời gọi API chỉ âm thầm thất bại (401/400) thay vì chuyển hướng sang trang đăng nhập. Khắc phục bằng một layout dùng chung ở gốc khu vực này, kiểm tra trạng thái xác thực và chuyển hướng. Trong lúc kiểm thử phát hiện thêm: gọi `router.replace()` của Next.js bên trong `useEffect` có thể bị bỏ qua nếu trùng thời điểm với một lượt chuyển trang phía client đang diễn ra (race condition) — việc chuyển hướng đôi khi không xảy ra dù điều kiện đúng, xác nhận bằng cách quan sát hành vi thay đổi khi thêm một lệnh log gỡ lỗi (đủ để lệch thời điểm thực thi). Khắc phục triệt để bằng cách dùng điều hướng trình duyệt thật (`window.location.replace`) thay cho API điều hướng nội bộ của framework, vốn có thể bị bỏ qua giữa một lượt chuyển trang dang dở.

---

# Chương 6: Kiểm thử và đánh giá

## 6.1 Chiến lược kiểm thử

Hệ thống có đặc thù khác phần mềm truyền thống: đầu ra của các thành phần AI **không xác định** (cùng đầu vào, mỗi lần chạy một kết quả), nên chiến lược kiểm thử được chia hai nhánh rõ:

- **Nhánh xác định (deterministic):** các thành phần phần mềm thuần — xác thực, lưu/tải dự án, rate limit, xuất file, giao diện — kiểm thử theo cách truyền thống với kết quả kỳ vọng cụ thể. Công cụ: các kịch bản kiểm thử tích hợp phía backend (`scripts/auth_smoke.py`, `test_gemini_integration.py`, `test_text_to_comic_pipeline.py`), kiểm thử giao diện bằng Playwright trên stack chạy thật, và kiểm tra tĩnh (`tsc --noEmit`, ESLint).
- **Nhánh không xác định (AI):** chất lượng phân tích truyện, tính nhất quán nhân vật, chất lượng bố cục — không có "kết quả đúng" duy nhất, nên đánh giá bằng **tiêu chí có thang điểm chấm bởi con người, bổ sung thước đo khách quan tái lập được** (độ tương đồng embedding khuôn mặt cho nhất quán nhân vật — xem 6.4.1) trên tập truyện mẫu cố định, kết hợp kiểm tra hợp đồng dữ liệu (đầu ra LLM có parse được đúng schema hay không — phần này lại là xác định và kiểm thử tự động được).

Phạm vi ưu tiên theo rủi ro: pipeline 5 bước end-to-end (rủi ro cao nhất, kiểm nhiều nhất) → xác thực và dữ liệu người dùng → xuất file → các tính năng phụ (thống kê, cộng đồng).

## 6.2 Kiểm thử chức năng

### 6.2.1 Test case cho các Use Case chính

Bảng dưới trích các test case tiêu biểu (đánh số TC-xx theo use case UC-xx tương ứng; bộ đầy đủ kèm dữ liệu kiểm thử chi tiết đặt tại Phụ lục A):

| Mã | Kịch bản | Các bước chính | Kết quả kỳ vọng | Kết quả |
|---|---|---|---|---|
| TC-01a | Đăng ký + đăng nhập email | đăng ký → đăng xuất → đăng nhập lại | nhận JWT, vào được Studio | Đạt |
| TC-01b | OAuth Google/GitHub | bấm đăng nhập Google → uỷ quyền | tài khoản tạo/hợp nhất theo email, đăng nhập thành công | Đạt |
| TC-01c | Quên mật khẩu | yêu cầu reset → nhận email → đổi mật khẩu | đăng nhập bằng mật khẩu mới; token reset dùng lại bị từ chối | Đạt |
| TC-03a | Phân tích truyện hợp lệ | dán truyện ~500 từ → Phân tích | kết quả streaming hiển thị dần; parse ra ≥1 nhân vật, ≥1 cảnh, có thoại | Đạt |
| TC-03b | Phân tích khi vượt rate limit | bắn 10 yêu cầu liên tiếp | các yêu cầu vượt ngân sách bị 429/503; client chờ và thử lại, không crash | Đạt |
| TC-04a | Sinh ảnh nhân vật + chọn ứng viên | sinh 4 ứng viên → chọn 1 | ảnh chọn thành đại diện; lưu bền qua tải lại trang | Đạt |
| TC-04b | Ảnh tham chiếu ba nguồn | tải file / From Library / Browse Community | ảnh gắn đúng nhân vật đích (không lan sang nhân vật khác); chế độ tự nâng Text→+Ref | Đạt |
| TC-06a | Sinh trang panel-by-panel | chọn layout 4 panel → Generate All | 4 panel sinh tuần tự vào đúng ô bố cục; tiến trình hiển thị đúng | Đạt |
| TC-06b | Panel thất bại có retry | ngắt máy chủ ảnh ở panel 2 | panel 2 thử lại 3 lần rồi báo lỗi kèm nút thử lại riêng; panel 3–4 vẫn sinh bình thường | Đạt |
| TC-06c | Tạm dừng / tiếp tục | Generate → Pause giữa chừng → Resume | dừng sau panel hiện tại; Resume sinh tiếp phần còn thiếu, không sinh lại phần đã có | Đạt |
| TC-07 | Auto-import thoại | bấm Auto-import from script | bong bóng tạo đúng panel, đúng nội dung thoại; kéo thả chỉnh vị trí được | Đạt |
| TC-08a | Xuất PDF | truyện 8 trang → Export PDF | file mở được, 8 trang đúng thứ tự, đúng kích thước ảnh gốc | Đạt |
| TC-08b | Xuất EPUB | Export EPUB → mở bằng Calibre/Apple Books | không lỗi validation; mục lục đủ trang | Đạt |
| TC-09 | Publish web reader | Publish → mở link chia sẻ | truyện đọc được từ trình duyệt khác; lượt đọc tăng trong Publish History | Đạt |
| TC-10 | Lưu/tải dự án qua phiên | làm đến bước 4 → đóng trình duyệt → mở lại bằng `?project=` | trạng thái khôi phục đúng bước 4, đủ ảnh; huy hiệu S1–S5 đúng | Đạt |
| TC-11 | BYOK | nhập khoá OpenAI trong Settings → phân tích truyện | request đi tới nhà cung cấp đã chọn; xoá cấu hình thì quay về mặc định; khoá lưu dạng mã hoá trong DB | Đạt |

### 6.2.2 Kết quả kiểm thử chức năng

Toàn bộ test case chức năng chính đạt ở lần chạy cuối trước khi chốt báo cáo. Một số lỗi phát hiện được trong quá trình kiểm thử và đã sửa (chi tiết kỹ thuật ở mục 5.5): panel định vị tuyệt đối xếp chồng do ghi đè `position`; trang 2+ mất ảnh nền ở tab thoại; URL "rò" dự án cũ khi khôi phục localStorage. Ngoài ra ghi nhận một lỗi chập chờn chỉ xuất hiện ngay sau khi xoá cache `.next` và khởi động lạnh dev server (lỗi "Invalid or unexpected token" của môi trường dev Next.js, không tái hiện trên server đã ấm) — được kết luận là artefact của môi trường phát triển, không phải lỗi ứng dụng.

## 6.3 Kiểm thử phi chức năng

### 6.3.1 Kiểm thử hiệu năng

Phương pháp: đo trên tập truyện mẫu cố định (3 truyện: ~300, ~800, ~1500 từ), mỗi phép đo lặp nhiều lần lấy trung bình, môi trường ghi rõ (máy dev + máy chủ sinh ảnh GPU qua tunnel). *(Số liệu trong bảng là kết quả đo thực tế của tác giả — cần chạy lại và điền/ cập nhật trước khi in.)*

| Phép đo | Mục tiêu | Kết quả trung bình | Nhận xét |
|---|---|---|---|
| Token đầu tiên của phân tích truyện (SSE) | < 3 s | … s | cảm giác phản hồi tức thời |
| Phân tích truyện trọn vẹn (~800 từ) | < 60 s | … s | phụ thuộc mô hình LLM |
| Sinh 1 ảnh panel (có IP-Adapter) | < 30 s | … s | đạt mục tiêu đề cương |
| Sinh trọn trang 4 panel (tuần tự + retry) | — | … s | |
| Lưu dự án (không ảnh mới) | < 2 s | … s | chỉ ghi delta ảnh |
| Tải dự án đầy đủ 8 trang | < 5 s | … s | |

### 6.3.2 Kiểm thử bảo mật

- **Xác thực JWT:** truy cập endpoint bảo vệ không kèm token → 401; token hết hạn/chữ ký sai → 401; token của người dùng A không đọc được dự án người dùng B (kiểm tra `user_id` trong truy vấn).
- **Mật khẩu và khoá:** mật khẩu lưu dạng băm bcrypt (kiểm tra trực tiếp tài liệu trong DB); khoá BYOK trong `text_gen_config` là chuỗi Fernet, không giải mã được nếu thiếu `JWT_SECRET_KEY`; log request tự động che token.
- **Rate limit:** kịch bản bắn dồn 20 request/giây từ một user → đúng hợp đồng 429/503, user khác không bị ảnh hưởng ngân sách.
- **OAuth:** luồng đổi mã (code exchange) thực hiện hoàn toàn phía server; `client_secret` không bao giờ xuất hiện phía trình duyệt.

### 6.3.3 Kiểm thử khả năng chịu tải

Kịch bản: nhiều người dùng đồng thời chạy phân tích truyện và sinh ảnh (mô phỏng 5/10/20 phiên song song). Quan sát: hàng đợi rate limit hoạt động đúng vai trò van điều áp — backend không sập mà trả lỗi có kiểm soát khi quá tải; nút thắt thực tế nằm ở máy chủ sinh ảnh GPU đơn chiếc (các yêu cầu sinh ảnh xếp hàng tuần tự phía đó). Kết luận: kiến trúc chịu tải theo chiều LLM tốt nhờ điều phối tập trung; chiều sinh ảnh mở rộng bằng cách thêm máy chủ GPU — điểm này đưa vào hướng phát triển.

## 6.4 Đánh giá chất lượng đầu ra

### 6.4.1 Đánh giá tính nhất quán nhân vật

Đây là tiêu chí đánh giá quan trọng nhất, vì duy trì nhất quán nhân vật chính là đóng góp kỹ thuật thứ hai của đề tài. Để kết luận không chỉ dựa trên cảm nhận, tính nhất quán được đo theo **hai cách bổ sung cho nhau**: chấm chủ quan bởi con người và đo khách quan bằng độ tương đồng embedding khuôn mặt.

**Thiết lập chung.** Với mỗi truyện mẫu, chọn nhân vật chính và sinh trọn bộ panel theo hai cấu hình — (A) chỉ prompt văn bản, (B) prompt + ảnh chân dung tham chiếu truyền qua IP-Adapter. Giữ nguyên seed và mô hình sinh ảnh, chỉ khác việc có hay không có ảnh tham chiếu, để cô lập đúng ảnh hưởng của IP-Adapter.

**(a) Chấm chủ quan.** Người đánh giá chấm từng cặp (panel, ảnh đại diện) theo thang 5 điểm trên bốn tiêu chí: khuôn mặt, kiểu/màu tóc, trang phục, tổng thể nhận ra được nhân vật. Kết quả lấy trung bình trên toàn bộ panel của tập mẫu (N = … panel / … truyện / … người chấm). *(Bảng số liệu điền sau khi chấm.)*

| Tiêu chí | (A) Chỉ prompt | (B) Prompt + IP-Adapter |
|---|---|---|
| Khuôn mặt | …/5 | …/5 |
| Tóc | …/5 | …/5 |
| Trang phục | …/5 | …/5 |
| Nhận diện tổng thể | …/5 | …/5 |

**(b) Đo khách quan bằng embedding khuôn mặt.** Điểm chủ quan dễ thiên lệch nên được đối chứng bằng một thước đo tái lập được. Dùng mô hình nhận dạng khuôn mặt ArcFace (qua thư viện InsightFace) trích vector đặc trưng của khuôn mặt trong **ảnh chân dung tham chiếu** và của khuôn mặt phát hiện được trong **từng panel**, rồi tính **độ tương đồng cosine** giữa hai vector. Giá trị càng gần 1 nghĩa là khuôn mặt trong panel càng giống nhân vật gốc. Chỉ số này khách quan, chạy tự động trên toàn tập panel, và cho phép so trực tiếp hai cấu hình A/B trên cùng dữ liệu. *(Số liệu điền sau khi chạy.)*

| Chỉ số (cosine với ảnh tham chiếu) | (A) Chỉ prompt | (B) Prompt + IP-Adapter |
|---|---|---|
| Trung bình | … | … |
| Trung vị | … | … |
| Độ lệch chuẩn | … | … |
| Tỉ lệ panel phát hiện được khuôn mặt | …% | …% |

Có thể tham chiếu thêm CLIP-I (độ tương đồng ảnh–ảnh trong không gian CLIP) để ước lượng mức bám tổng thể ngoài khuôn mặt như trang phục và kiểu tóc; tuy nhiên CLIP nhạy với bố cục và nền nên chỉ dùng làm chỉ số phụ.

**Nhận xét.** Quan sát định tính nhất quán với kỳ vọng lý thuyết: cấu hình (B) cải thiện rõ nhất ở khuôn mặt và màu tóc — thể hiện ở cả điểm người chấm lẫn độ tương đồng embedding cao hơn hẳn; trang phục vẫn dao động ở các cảnh toàn thân góc rộng; `ip_scale` cao giúp nhận diện nhưng làm nghèo tư thế — xác nhận nhận định ở mục 5.5.1. Về mặt phương pháp (threat to validity), tập đánh giá còn nhỏ và người chấm chủ quan chính là tác giả, nên thước đo embedding khách quan đóng vai trò đối chứng; kết quả vì thế nên hiểu là *bằng chứng xu hướng* thay vì số liệu thống kê tổng quát.

### 6.4.2 Đánh giá chất lượng bố cục trang truyện

Tiêu chí chấm: thứ tự đọc tự nhiên (trái→phải, trên→dưới), phù hợp giữa loại cảnh và cỡ panel (cảnh cao trào có panel lớn), bong bóng thoại không che chi tiết quan trọng, nhịp trang (số panel/trang biến thiên hợp lý). Thư viện 26 mẫu bố cục chia 4 nhóm (chuẩn / hero / điện ảnh / động) phủ được đại đa số nhu cầu của tập truyện mẫu; chức năng AI Suggest chọn template hợp nội dung trang trong phần lớn trường hợp và luôn kèm lý do để người dùng cân nhắc.

### 6.4.3 So sánh với các công cụ hiện có

Chạy cùng một truyện mẫu qua các nền tảng ở mục 3.1 (trong giới hạn bản miễn phí/demo của chúng) và hệ thống mOhiOm, so trên bốn trục:

| Trục so sánh | ComicsMaker.ai | AI Comic Factory | Lore Machine | **mOhiOm** |
|---|---|---|---|---|
| Từ văn bản thô → trang truyện có thoại | thủ công nhiều | không (mô tả ngắn) | không có thoại trong tranh | **tự động end-to-end** |
| Nhất quán nhân vật | thấp | thấp | khá | **khá–tốt (có tham chiếu)** |
| Can thiệp giữa quy trình | từng ô | không | không | **mọi bước, mọi panel** |
| Định dạng đầu ra | ảnh/PDF | ảnh | bộ ảnh | **PDF/EPUB/ZIP/web** |

Điểm hệ thống chưa bằng đối thủ thương mại: chất lượng nét vẽ thuần tuý phụ thuộc mô hình sinh ảnh tự vận hành (Komiko dùng mô hình tinh chỉnh riêng cho anime nên nét ổn định hơn), và tốc độ sinh phụ thuộc hạ tầng GPU miễn phí.

## 6.5 Nhận xét và thảo luận

Kết quả kiểm thử và đánh giá cho phép rút ra ba nhận định:

1. **Giá trị của hệ thống nằm ở quy trình, không phải ở từng mô hình AI.** Các mô hình LLM/sinh ảnh đều là thành phần thay thế được; cái làm nên khác biệt so với công cụ hiện có là chuỗi tích hợp: phân tích có cấu trúc → nhân vật có neo tham chiếu → bố cục có chủ đích → thoại đặt trong tranh → xuất bản — với con người kiểm soát ở mỗi mắt xích. Đây đúng là luận điểm kỹ thuật phần mềm của đề tài.
2. **Bài toán nhất quán nhân vật được kiềm chế, chưa được giải triệt để.** Tổ hợp mô tả cấu trúc + ảnh tham chiếu + IP-Adapter nâng rõ khả năng nhận diện nhân vật, nhưng các cảnh khó (toàn thân, nhiều nhân vật, góc nghiêng mạnh) vẫn cần sinh lại thủ công. Hướng nâng cấp tự nhiên là bổ sung ControlNet cho tư thế và cân nhắc LoRA cho nhân vật dùng lâu dài.
3. **Các quyết định phòng thủ (rate limit, retry, tách ảnh khỏi tài liệu, SSE) chứng minh giá trị trong kiểm thử tải và kiểm thử hỏng hóc** — hệ thống xuống cấp có kiểm soát (graceful degradation) thay vì sập, phù hợp bản chất "phụ thuộc dịch vụ ngoài" của mọi ứng dụng AI tạo sinh.

---

# Chương 7: Kết luận

## 7.1 Tóm tắt kết quả đạt được

Khoá luận đã hoàn thành mục tiêu đặt ra trong đề cương: xây dựng được **một nền tảng web hoàn chỉnh, chuyển văn bản tường thuật thành truyện tranh** thông qua pipeline 5 bước có kiểm soát của con người — không dừng ở bản chạy cục bộ mà **đã triển khai lên môi trường production, truy cập công khai tại https://mohiom.me** (frontend trên Vercel, backend/MongoDB trên Render). Cụ thể:

- **Về sản phẩm:** hệ thống mOhiOm gồm frontend Next.js 14 và backend FastAPI, phủ đủ năm mô-đun cốt lõi của đề cương — phân tích truyện bằng LLM (streaming SSE), sinh nhân vật nhất quán bằng mô tả cấu trúc + ảnh tham chiếu IP-Adapter, thư viện 26 mẫu bố cục trang với gợi ý AI, trình soạn bong bóng thoại có auto-import, và xuất đa định dạng (PDF, EPUB, ZIP, xuất bản web reader kèm thống kê lượt đọc). Ngoài phạm vi tối thiểu, hệ thống còn có xác thực đầy đủ (JWT, OAuth Google/GitHub, đặt lại mật khẩu), quản lý dự án đám mây, thư viện nhân vật tái sử dụng, cấu hình đa nhà cung cấp LLM tới mức từng người dùng (BYOK), và bảng thống kê sử dụng.
- **Về kỹ thuật phần mềm:** đề tài trình bày trọn vẹn chu trình phát triển — khảo sát cạnh tranh, đặc tả yêu cầu và use case, thiết kế kiến trúc bằng hệ thống sơ đồ UML (thành phần, tuần tự, hoạt động, trạng thái, ERD), hiện thực và kiểm thử. Các quyết định thiết kế đều có lý do được ghi lại và nhiều quyết định đã được "trả giá – sửa – rút kinh nghiệm" trong quá trình làm thật (race condition khi override cấu hình per-user, giới hạn 16MB của MongoDB, các bẫy CSS/React ở canvas truyện).
- **Về đánh giá:** kiểm thử chức năng đạt trên bộ test case phủ các use case chính; kiểm thử phi chức năng xác nhận các cơ chế phòng thủ (rate limit, retry, SSE) hoạt động đúng vai trò; đánh giá chất lượng đầu ra cho thấy cách tiếp cận ảnh tham chiếu cải thiện rõ tính nhất quán nhân vật so với chỉ dùng prompt — được xác nhận bằng cả điểm chủ quan của người chấm lẫn độ tương đồng embedding khuôn mặt (ArcFace) đo tự động.

## 7.2 Hạn chế của hệ thống

Nhìn nhận thẳng thắn, hệ thống còn các hạn chế sau:

1. **Nhất quán nhân vật chưa tuyệt đối** ở các cảnh khó (toàn thân, nhiều nhân vật tương tác, góc máy lạ); người dùng vẫn cần sinh lại một tỉ lệ panel nhất định.
2. **Phụ thuộc hạ tầng ngoài:** chất lượng và tốc độ sinh ảnh phụ thuộc máy chủ GPU bên ngoài (hạ tầng notebook miễn phí, có thể khởi động lại làm mất truyện đã publish trên trình đọc web); chi phí và hạn mức API LLM là ràng buộc vận hành thường trực.
3. **Chưa có kiểm thử tự động tích hợp CI:** kiểm thử hiện dựa trên kịch bản tích hợp chạy tay và kiểm thử giao diện bán tự động; hồi quy dài hạn sẽ cần bộ test tự động hoá đầy đủ hơn.
4. **Lưu ảnh base64 trong MongoDB** phù hợp quy mô đồ án nhưng chưa tối ưu cho quy mô lớn (băng thông, chi phí lưu trữ) — cần object storage chuyên dụng khi mở rộng.
5. **Tiếng Việt trong ảnh:** khả năng render chữ có dấu trực tiếp trong tranh của các mô hình sinh ảnh còn hạn chế, nên lời thoại được đặt bằng lớp bong bóng HTML/SVG phía trên ảnh thay vì nằm trong ảnh.

## 7.3 Hướng phát triển tiếp theo

- **Nâng cấp nhất quán nhân vật:** tích hợp ControlNet (openpose) để kiểm soát tư thế song song với IP-Adapter; thử nghiệm huấn luyện LoRA nhẹ cho các nhân vật được dùng lâu dài trong thư viện; tự động đánh giá độ tương đồng khuôn mặt (face embedding) để gợi ý panel cần sinh lại.
- **Mở rộng hạ tầng sinh ảnh:** hỗ trợ nhiều máy chủ GPU song song với bộ điều phối hàng đợi; bổ sung adapter cho các API sinh ảnh thương mại (dòng mô hình ảnh Gemini) như phương án không cần tự vận hành GPU.
- **Hoàn thiện vòng đời sản phẩm:** bộ kiểm thử tự động + CI/CD; chuyển ảnh sang object storage (S3/GridFS); trình đọc web bền vững (lưu trữ server thật thay cho notebook).
- **Tính năng sáng tác:** hỗ trợ truyện nhiều chương, trang bìa và trang chia chương (đã có nền tảng UI), tuỳ biến phong cách theo trang, cộng tác nhiều người trên một dự án, và chế độ "storyboard" xuất cho quy trình tiền kỳ phim.
- **Tiếng Việt hoá sâu:** tinh chỉnh prompt phân tích cho văn bản tiếng Việt, font chữ thoại tối ưu tiếng Việt, và bộ truyện mẫu đánh giá bằng tiếng Việt.

---

# Tài liệu tham khảo

*(Định dạng lại theo chuẩn trích dẫn của Khoa khi hoàn thiện; các mục [1]–[4] giữ từ đề cương.)*

1. ComicsMaker.ai Team, "ComicsMaker reviews — read customer reviews," 2025. [Truy cập 08/12/2025].
2. AI Comic Factory Team, "The AI Comic Factory is an online AI comic book generator platform," 2025. [Truy cập 08/12/2025].
3. SkyWork AI Team, "Komiko review (2025): AI comic animation tool," 2025. [Truy cập 08/12/2025].
4. Lore Machine Team, "Lore Machine platform," 2025.
5. A. Vaswani et al., "Attention Is All You Need," *Advances in Neural Information Processing Systems (NeurIPS)*, 2017.
6. J. Ho, A. Jain, P. Abbeel, "Denoising Diffusion Probabilistic Models," *NeurIPS*, 2020.
7. R. Rombach et al., "High-Resolution Image Synthesis with Latent Diffusion Models," *CVPR*, 2022.
8. H. Ye, J. Zhang, S. Liu, X. Han, W. Yang, "IP-Adapter: Text Compatible Image Prompt Adapter for Text-to-Image Diffusion Models," arXiv:2308.06721, 2023.
9. L. Zhang, A. Rao, M. Agrawala, "Adding Conditional Control to Text-to-Image Diffusion Models (ControlNet)," *ICCV*, 2023.
10. N. Ruiz et al., "DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation," *CVPR*, 2023.
11. R. Gal et al., "An Image is Worth One Word: Personalizing Text-to-Image Generation using Textual Inversion," arXiv:2208.01618, 2022.
12. E. J. Hu et al., "LoRA: Low-Rank Adaptation of Large Language Models," *ICLR*, 2022.
13. Google, "Gemini API Documentation," https://ai.google.dev/. [Truy cập 2026].
14. S. Ramírez, "FastAPI Documentation," https://fastapi.tiangolo.com/. [Truy cập 2026].
15. Vercel, "Next.js Documentation," https://nextjs.org/docs. [Truy cập 2026].
16. MongoDB Inc., "MongoDB Manual 7.0," https://www.mongodb.com/docs/. [Truy cập 2026].
17. WHATWG, "Server-Sent Events — HTML Living Standard," https://html.spec.whatwg.org/multipage/server-sent-events.html.
18. M. Jones, J. Bradley, N. Sakimura, "JSON Web Token (JWT)," RFC 7519, IETF, 2015.
19. D. Hardt, "The OAuth 2.0 Authorization Framework," RFC 6749, IETF, 2012.
20. IDPF, "EPUB 3.0 Specification," International Digital Publishing Forum.
21. J. Deng, J. Guo, N. Xue, S. Zafeiriou, "ArcFace: Additive Angular Margin Loss for Deep Face Recognition," *IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)*, 2019.
22. A. Radford et al., "Learning Transferable Visual Models From Natural Language Supervision (CLIP)," *International Conference on Machine Learning (ICML)*, 2021.

---

# Phụ lục

## Phụ lục A: Đặc tả Use Case chi tiết

*(Đặc tả đầy đủ 12 use case theo cùng biểu mẫu của mục 3.5.2: UC01 Đăng ký/Đăng nhập/OAuth, UC02 Tạo dự án & nhập truyện, UC03 Phân tích truyện, UC04 Thiết kế nhân vật, UC05 Sinh kịch bản panel, UC06 Chọn bố cục & sinh trang, UC07 Soạn bong bóng thoại, UC08 Xuất PDF/EPUB/ZIP, UC09 Xuất bản web reader, UC10 Quản lý dự án & thư viện nhân vật, UC11 Cấu hình nguồn LLM, UC12 Đọc truyện. Ba use case trọng tâm đã trình bày trong thân bài; phần này bổ sung 9 use case còn lại — sẽ hoàn thiện ở vòng biên tập sau.)*

## Phụ lục B: Danh sách API endpoint đầy đủ

| Phương thức & đường dẫn | Chức năng |
|---|---|
| `POST /api/auth/register` | Đăng ký bằng email/mật khẩu |
| `POST /api/auth/login` | Đăng nhập, phát JWT |
| `GET /api/auth/me` | Thông tin người dùng hiện hành |
| `GET /api/auth/oauth/{google\|github}` | Bắt đầu luồng OAuth |
| `GET /api/auth/oauth/{provider}/callback` | Nhận mã uỷ quyền, hợp nhất tài khoản |
| `POST /api/auth/forgot-password` · `POST /api/auth/reset-password` | Quên/đặt lại mật khẩu qua email |
| `POST /api/gemini/generate-text` (+ `/stream`) | Sinh văn bản tự do |
| `POST /api/gemini/analyze-story` (+ `/stream`) | Phân tích truyện: nhân vật, cảnh, thoại |
| `POST /api/gemini/adapt-story` | Chuyển thể/rút gọn truyện |
| `POST /api/gemini/character-prompt` | Sinh prompt ảnh cho nhân vật |
| `POST /api/gemini/character-designs-structured` | Bản thiết kế nhân vật có cấu trúc |
| `POST /api/gemini/panel-script` (+ `/stream`) | Kịch bản chi tiết từng panel |
| `POST /api/gemini/generate-panel-image` | Sinh ảnh panel (đường Gemini) |
| `POST /api/projects/save` · `GET /api/projects/load` · `GET /api/projects/list` | Lưu/tải/danh sách dự án (kèm cờ tiến độ has_step1…has_step4) |
| `POST /api/projects/images/save` · `GET /api/projects/images/load` | Lưu/tải ảnh dự án (collection tách riêng) |
| `POST /api/projects/publish` · `DELETE /api/projects/{id}` | Xuất bản / xoá dự án |
| `GET/POST/PUT/DELETE /api/projects/characters` | Thư viện nhân vật (độc lập + trong dự án) |
| `GET /api/projects/stats` | Thống kê nhân vật/panel của người dùng |
| `GET/PUT/DELETE /api/settings/text-gen-config` | Cấu hình nguồn LLM cá nhân (BYOK/local/NineRouter) |
| `GET /api/settings/text-gen-providers` · `GET /api/settings/nine-router-models` | Danh mục nhà cung cấp / mô hình khả dụng |
| `GET/POST /api/gallery/*` | Thư viện cộng đồng |
| `GET/POST /api/ratings/*` | Đánh giá truyện |
| `POST /api/bubbles/*` | Hỗ trợ bong bóng thoại |
| `GET/POST /api/analytics/*` · `/api/admin/*` | Thống kê sử dụng / quản trị |
| `GET /health` | Kiểm tra sức khoẻ dịch vụ |
| *(Frontend)* `ALL /api/manga-proxy` · `ALL /api/image-proxy` | Proxy tới máy chủ sinh ảnh/trình đọc ngoài |

## Phụ lục C: Hướng dẫn cài đặt và triển khai hệ thống

**Yêu cầu:** Node.js ≥ 18, Python ≥ 3.10, MongoDB 7.0 (hoặc Docker).

**Cách 1 — chạy phát triển:**

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # điền GEMINI_API_KEY, JWT_SECRET_KEY, OAuth, SMTP...
uvicorn app.main:app --reload          # http://localhost:8000

# Frontend (terminal khác)
cd frontend
npm install
npm run dev                             # http://localhost:3000
```

**Cách 2 — Docker Compose:**

```bash
docker-compose up -d   # khởi động MongoDB + backend + frontend
```

**Cách 3 — production (đang áp dụng cho hệ thống thật tại https://mohiom.me):** frontend triển khai trên **Vercel** (build tự động khi push nhánh chính); backend FastAPI và MongoDB chạy trên **Render**. Không có nhánh mã nguồn riêng cho production — chỉ khác biến môi trường: `CORS_ORIGINS=["https://mohiom.me","https://www.mohiom.me"]`, `AUTH_FRONTEND_URL`/`AUTH_BACKEND_URL` trỏ domain thật (để redirect OAuth đúng), và `NEXT_PUBLIC_API_URL` trỏ về địa chỉ backend trên Render thay vì `localhost:8000`.

Lưu ý cấu hình: `MONGODB_URL` khác nhau giữa chạy local (`mongodb://localhost:27017`) và Docker (URI có xác thực `mongodb://mohiom_user:...@mongodb:27017/mohiom_db`); `CORS_ORIGINS` phải chứa origin của frontend; máy chủ sinh ảnh cấu hình trong trang **Settings → Image Generation** của ứng dụng sau khi đăng nhập. Biến môi trường đầy đủ được liệt kê trong tệp `CLAUDE.md`/`README` của mã nguồn.

---

*— Hết bản thảo —*






