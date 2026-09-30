# UTA 应用图标

由内置 imagegen 生成；PNG 原图位于 `src/assets/uta-app-icon.png`，网页图标位于 `public/uta-icon.png`，Windows 多尺寸 ICO 位于本目录 `uta.ico`。

初版提示词：

Use case: logo-brand. Asset type: production Windows desktop app icon and small header logo for UTA, a Japanese song learning application. Create ONE square, centered original icon, no presentation sheet. A rounded-square deep forest green tile containing a large warm ivory open-book silhouette whose right page gracefully becomes a musical eighth note, with one small muted amber accent. Elegant Japanese stationery aesthetic, soft rounded geometry, flat clean design with extremely restrained shading, crisp simple silhouette readable at 32 pixels. Tile fills most of the square with very small transparent outer margin. No text, no letters, no watermark, no mockup, no additional decoration. Genuine transparent outside the rounded tile. Balanced bold shapes, not thin lines.

修复版最终提示词（内置 imagegen 编辑模式）：

Use case: precise-object-edit. Image 1 is the edit target, UTA app icon. Keep the ivory open book, musical note and small golden center accent unchanged in shape, position and proportions. Repair the deep green rounded-square tile: remove the two damaged dark/transparent patches below the book completely, filling them seamlessly with green. Make the ENTIRE rounded-square tile a perfectly uniform flat solid deep forest green (#174832), fully opaque everywhere inside the rounded tile, including below the book. Absolutely NO holes, no cut-outs, no missing patches, no mottled texture, no noise, no dark smudges, no drop shadows. Only the area OUTSIDE the rounded square is transparent. Keep clean smooth rounded edges. The book symbol stays ivory, with crisp smooth edges. Single icon, no text, no watermark.

ICO 仅进行缩放与格式转换，保留透明通道；使用 `scripts/build-app-icon.ps1 -SourcePath <原图路径>` 可重新生成，包含 16 / 24 / 32 / 48 / 64 / 128 / 256 像素图层。
