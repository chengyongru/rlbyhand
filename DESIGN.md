# Frontend Interface Design Spec

## 1. Layout and information
- No boxes inside boxes. No nested cards and no extra dividers.
- No taglines, subtitles, secondary labels or explanatory text.
- Separate levels of content with alignment and spacing, not with text that explains the interface.

## 2. Visuals, color and whitespace
- Overall reference: the minimal style of Apple's website.
- Color ratio: 90% of the area in neutral black, white and gray; 10% in one accent color that marks the core action or key data.
- No gradients, saturated colors, neon colors or cards with complex shadows.
- Weight and lightness contrast: headings bolder and darker, body text lighter and paler.
- More whitespace: set component padding and margins to 1.5 times a typical page. Leave space empty rather than filling it.

## 3. Type, grid and icons
- Font: use Geist everywhere.
- Size and weight: headings 18px and bold (weight 600 or 700); body text 16px or 14px at regular (400) or medium (500) weight.
- Text color: primary text #181818, secondary text #6A6A6A.
- Spacing grid: every spacing value is a whole multiple of 4px, with no exceptions.
- Corner radius: between 8px and 40px by component size and level (small radius for small buttons, large radius for large dialogs).
- Icons: use the Reicon icon library (https://reicon.dev/docs). Icon glyph 18px, stroke width 1.5px, inside a transparent 24px × 24px frame.

## 4. Interaction and desktop menus
- Show controls by intent: hide secondary action buttons by default; show them when the user hovers, focuses, scrolls near, or starts working in that area.
- Desktop multi-level menus: implement an open delay, a close delay and a safe triangle together. When the pointer moves from parent item A toward submenu B, form a triangle from the current pointer position and the top and bottom corners of submenu B; while the pointer is inside that triangle, keep submenu B open and hold off switching to other items it passes over.

## 5. Render acceptance
- The browser's real rendered result is the standard, not the values computed from code. After writing code, check alignment, line wrapping, whitespace and overlap in the real page.
