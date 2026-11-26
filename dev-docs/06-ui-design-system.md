# 06 · UI Design System & Bilingual Architecture

## Aesthetic Direction (`DESIGN.md`)

All frontend components conform to the 5-module spec in [`DESIGN.md`](../DESIGN.md) (based on `https://zacharyzhang.com/blog/ai-frontend-design-rules`):

1. **Layout & Information Hierarchy**: Flat single-level surfaces only—zero nested bordered cards, zero decorative `<Divider />` lines, zero taglines, subtitles, or interface-explaining copy. Hierarchy comes from alignment, whitespace, and font weight contrast.
2. **Visuals, Color & Whitespace**: Apple-minimal neutral canvas (`#FFFFFF` / `#F5F5F7` light; `#0F0F10` / `#18181B` dark) following a strict **90% neutral / 10% single accent (`#0071E3`)** ratio. Component padding and spacing are set at ~1.5× standard density (`24px`–`40px`).
3. **Typography, 4px Grid & Reicon**:
   - **Geist** (`@fontsource/geist-sans` + `@fontsource/geist-mono`) everywhere, with `tabular-nums` on every live number.
   - Headings `18px` bold (`600`–`700`, `#181818`); body `16px` / `14px` regular–medium (`400`–`500`, `#181818` / `#6A6A6A`).
   - Strict **4px spacing grid** across all margins, paddings, and gaps; corner radii scale from `8px` (buttons/inputs) to `16px` (panels) and `24px` (modals).
   - **Reicon (`reicon-react`)** wrapped by `LabIcon.tsx`: `18px` glyph, `1.5px` stroke inside a fixed transparent `24px × 24px` frame.
4. **Interaction & Desktop Menus**:
   - Secondary actions (`Diff`, `Load Ablation`, `Reset`, `Import/Export JSON`, `Try again`) are hidden by default via `.intent-zone .intent-controls` and appear on hover/focus.
   - Desktop Lesson Menu in `HeaderBar.tsx` implements open delay (`120ms`), close delay (`220ms`), and a geometric **safe triangle** (`hooks/useSafeTriangle.ts`) toward the preset submenu.
5. **Render Acceptance**: Verified visually via headless Chrome screenshots across Light/Dark, ZH/EN, Dashboard, Microscope, and Code Lab views.
