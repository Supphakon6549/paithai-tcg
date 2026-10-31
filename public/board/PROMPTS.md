# พรอมป์ต์สำหรับสร้างภาพกระดานต่อสู้ (PaiThai TCG Board Assets Prompts)

เอกสารนี้รวบรวมพรอมป์ต์ (Prompts) แนวทางศิลปะ และการตั้งค่าการประมวลผลภาพทั้งหมดที่ใช้สร้างชิ้นส่วนกระดานต่อสู้ 3 มิติของเกม **ไพ่ไทย TCG** เพื่อให้สามารถสร้างภาพเพิ่มเติมในอนาคต (เช่น ฉากเวทสนามชุดใหม่ หรือไอคอนเพิ่ม) ให้คุมโทนเดียวกันทั้งหมด

---

## แนวทางศิลปะหลัก (Master Style Guide)

- **สไตล์หลัก**: ภาพวาดดิจิทัลแฟนตาซีไทยประเพณี (Hand-painted Thai mythical fantasy digital painting) ผสมงานช่างศิลป์ไทยโบราณ **ไม้สักลงรักปิดทอง ลายรดน้ำ และทองเปลวแกะสลักนูนต่ำ** (`gilded Thai gold leaf Lai Rod Nam on aged black lacquer`)
- **โทนสี**:
  - พื้นรักดำโบราณ (`#080605` – `#140e0a`)
  - ทองเปลว/ทองโบราณ (`#f5d77f`, `#d4af37`, `#9e731f`)
  - ชาดแดงโบราณ (`#8e1b1b`) และเขียวมรกต (`#0f6b4a`)
- **ข้อห้ามสำคัญ (Negative Prompt / Constraints)**:
  - `NO text, NO letters, NO numbers, NO watermarks, NO signatures` (ห้ามมีตัวอักษร ตัวเลข หรือลายน้ำ)
  - `NO Buddha statues, NO real monks` (ห้ามมีพระพุทธรูปหรือพระสงฆ์จริง)
  - สำหรับภาพที่ต้องโปร่งใส (`.png`): สร้างบนพื้นหลังสีดำสนิท (`PURE SOLID PITCH-BLACK #000000`) แล้วลบพื้นหลังดำออกเป็น Alpha Channel (Luminance Keying) เพื่อให้ขอบทองเปลวเนียนไม่ติดขอบขาว

---

## 1. พื้นโต๊ะ (Table Surfaces — แผนที่ไตรภูมิไร้กรอบ / Borderless Traiphum Cosmic Map)

> สำรองเวอร์ชันไม้ลงรักดำเดิมไว้ที่ `table-portrait-v1.webp` และ `table-landscape-v1.webp`

### 1.1 มือถือแนวตั้ง — `public/board/table-portrait.webp` (`1080×1920`, ≤ 250 KB)
```text
Flat orthographic direct top-down view of a Thai mythology trading card game battle board playmat inspired by the ancient Traiphum Buddhist cosmic map. Strictly overhead bird's-eye view, perfectly flat tabletop game mat, no perspective angle, no tilt. CRITICAL REQUIREMENT: STRICTLY BORDERLESS, NO OUTER FRAME, NO GOLDEN BORDER, NO CARVED CORNERS, NO WOODEN ORNAMENTATION AROUND EDGES. The deep space, celestial waters, and stars MUST extend edge-to-edge smoothly to all four canvas boundaries without any framing line or border. At the exact geometric center: a small, refined gilded gold emblem representing Mount Meru (Khao Phra Sumen) seen from directly above as a delicate golden concentric mandala / stepped peak motif. Radiating from the center across the entire playmat: the seven cosmic oceans (Thale Sithandon) and seven ring mountains (Sattaboriphan), depicted as thin, faint, elegant gold concentric circular lines and subtle delicate ripple wave patterns. Bottom half (Heaven / Deva realm): deep cosmic midnight navy blue with delicate twinkling gold stars, faint soft golden celestial clouds and distant miniature golden palace spire silhouettes along the very bottom, warm golden ambient glow. Top half (Underworld / Badan / Naga realm): deep abyssal navy and indigo-teal ocean depths, faint dark coiling Naga serpent silhouettes and ethereal deep-sea mist along the top, cold teal bioluminescent ambient glow. Middle 60% of both halves: very dark, smooth, matte, clean, low-contrast, showing only faint delicate golden concentric rings. Strict restrictions: Absolutely NO text, NO letters, NO numbers, NO border frame, NO card slots, NO Buddha statues, NO monks.
```

### 1.2 จอกว้างแนวนอน — `public/board/table-landscape.webp` (`1920×1080`, ≤ 250 KB)
```text
Flat orthographic direct top-down view of a Thai mythology trading card game battle board playmat in wide landscape 16:9 format, inspired by the ancient Traiphum Buddhist cosmic map. Strictly overhead bird's-eye view, perfectly flat tabletop game mat, no perspective angle, no tilt. CRITICAL REQUIREMENT: STRICTLY BORDERLESS, NO OUTER FRAME, NO GOLDEN BORDER, NO CARVED CORNERS, NO BORDER STRIPS AROUND EDGES. The deep midnight navy cosmos, waters, and stars MUST flow continuously to all four outer edges. At the exact geometric center: a small, refined gilded gold emblem depicting Mount Meru (Khao Phra Sumen) seen from above as a concentric stepped peak mandala. Radiating outward across the entire width of the battlefield: the seven concentric cosmic oceans (Thale Sithandon) and seven ring mountain chains (Sattaboriphan), rendered as thin, subtle gold concentric circular lines and delicate faint wave ripples extending across the landscape board. Bottom half (Player realm): deep midnight navy blue with faint sparkling golden stars, soft golden celestial clouds and distant miniature golden palace spire silhouettes along the bottom edge. Top half (Opponent realm): dark abyssal navy and indigo-teal deep aquatic expanse, subtle dark silhouette forms of coiling mythical Naga serpents along the top edge, cold deep-teal bioluminescent glow. Middle 60% play areas: very dark, clean, smooth, low-contrast, minimal starlight specks. Strict restrictions: Absolutely NO border, NO outer frame, NO text, NO letters, NO numbers, NO card slots, NO Buddha statues, NO monks.
```

---

## 2. ขอบโต๊ะ (Tileable Table Border)

### `public/board/table-border.png` (โปร่งใส ต่อกันเป็นแถบยาวได้)
```text
A horizontally seamless/tileable ornamental border strip (แถบลายกระจังและกนกทองบนพื้นรัก) placed across the middle of a pure #000000 black canvas. The strip shows sculpted 3D antique Thai gold leaf Krajang (lotus-leaf triangles) and flowing Kanok scrollwork along a narrow gilded molding bar, with pure #000000 black above and below the bar. Hand-painted gilded Thai gold leaf style, NO text, NO letters, NO watermarks.
```
- **การประมวลผลหลังสร้าง**: ตัดเฉพาะแถบกลาง ทำให้ขอบซ้าย-ขวาต่อกันแบบ Seamless (Horizontal Mirror/Blend) และแปลงพื้นดำ `#000000` เป็นโปร่งใส (`.png`)

---

## 3. กรอบช่องการ์ด (Card Slot Frames — สัดส่วน 2:3 ขนาด `300×450`)

### 3.1 ช่องมอนสเตอร์ (ฐานบัว) — `public/board/slot-monster.png`
```text
A rectangular 2:3 card slot border frame themed as a Thai Sacred Lotus Pedestal (กรอบช่องมอนสเตอร์ ฐานบัวทองคำ) on a pure #000000 black background. The outer edge of the 2:3 rectangle has delicate carved golden lotus petals (บัวคว่ำบัวหงาย) at the top/bottom corners and thin gold filigree side rails, while the ENTIRE CENTER 80% of the rectangle is pure empty #000000 black (with only a very faint, subtle sacred lotus yantra watermark outline near the border) so it does not compete with a card placed inside. NO text, NO numbers, NO watermarks.
```

### 3.2 ช่องเวท/กับดัก (ใบเสมา) — `public/board/slot-spell.png`
```text
A rectangular 2:3 card slot border frame themed as a Thai Bai Sema temple boundary marker frame (กรอบช่องเวทและกับดัก ทรงใบเสมาทองคำ) on a pure #000000 black background. The outer edge of the 2:3 rectangle features traditional Bai Sema arched corner ornaments and delicate gold leaf Lai Thai trim, while the ENTIRE CENTER 80% of the rectangle is pure empty #000000 black so it does not compete with a card placed inside. NO text, NO numbers, NO watermarks.
```
- **การประมวลผลหลังสร้าง**: ย่อขนาดเป็น `300×450` พิกเซล ลบพื้นดำเป็นโปร่งใส และลดความทึบแสงบริเวณกลางกรอบให้จางเพื่อไม่ให้แย่งความเด่นจากการ์ด

---

## 4. ไอคอนชุดเดียวกัน 8 อัน (Cohesive UI Icons — `.png` โปร่งใส `256×256`, ≤ 40 KB)

**พรอมป์ต์คุมโทนไอคอน (ใช้ร่วมกันทุกชิ้น)**:
```text
Cohesive hand-painted 3D gilded Thai gold leaf on black lacquer style (สไตล์ทองเปลวแกะสลักนูนต่ำบนพื้นรักดำแบบไทยประเพณี). NOT flat emoji, NOT thin vector line art — rich metallic antique gold leaf (#f5d77f / #c89b3c) with warm highlights, deep shadows, and black/crimson lacquer accents. Centered single emblem filling ~75% of the square 1:1 canvas, isolated on a PURE SOLID PITCH-BLACK (#000000) background with clean outer edges. NO text, NO letters, NO numbers, NO watermarks.
```

1. **กองการ์ด (`public/board/icons/deck.png`)**:
   `A stacked mystical deck of ancient Thai gilded plaques/cards bound with a golden Thai Kanok clasp and a glowing lotus seal on top, isolated on pure #000000 black.`
2. **สุสาน (`public/board/icons/graveyard.png`)**:
   `A modern minimalist Thai sacred soul flame and spirit lotus emblem (สัญลักษณ์เปลววิญญาณและดอกบัวทิพย์) centered on a solid pure #000000 black background. Designed as a trading card game graveyard pile watermark. Elegant metallic antique gold and ethereal silver-white glowing spirit flame cradled in a stylized geometric lotus petal cup, with subtle floating spirit sparks. Sleek modern digital TCG icon, clean linework, high contrast against pure pitch-black background. Strictly NO text, NO letters, NO numbers, NO watermarks.`
3. **กองพิเศษ (`public/board/icons/extra-deck.png`)**:
   `A radiant 8-pointed Thai celestial chakra-star and blooming golden lotus crest (ดาราจักรพุ่มข้าวบิณฑ์ทองคำ) with an emerald-and-ruby gem core, isolated on pure #000000 black.`
4. **เวทสนาม (`public/board/icons/field-spell.png`)**:
   `A glowing ethereal modern Thai magic circle seal (วงแหวนเวทย์มนตร์สไตล์ไทยเรขาคณิต) centered on a solid pure #000000 black background. Designed as a trading card game field spell zone watermark. Intricate yet clean thin geometric line art in luminous gold and cyan-teal bioluminescent energy: concentric thin rings, four-point Thai Prajam-yam diamond accents, sacred geometric unalom spirals, and delicate rune rays radiating outward. Modern e-sports TCG UI style, clean vectors, sharp glowing lines, transparentable black background. Strictly NO text, NO letters, NO numbers, NO watermarks, NO solid opaque shapes in center.`
5. **LP หัวใจ/ดวงชะตา (`public/board/icons/lp.png`)**:
   `A sacred Thai heart-shaped Bodhi leaf and glowing crimson-gold soul gem (ดวงชะตาใบโพธิ์ทองคำประดับมณีแดง) cradled by twin golden Kanok flame wings, isolated on pure #000000 black.`
6. **การ์ดในมือ (`public/board/icons/hand.png`)**:
   `A fan of three ornate golden Thai talisman cards (ไพ่ทองคำลายไทยเรียงพัด 3 ใบ) with Phum Khao Bin diamond motifs, isolated on pure #000000 black.`
7. **เทิร์น (`public/board/icons/turn.png`)**:
   `An ancient Thai celestial sundial-wheel and golden hourglass talisman (กงล้อกาลเวลาสุริยัน-จันทราลายไทยทองคำ) with swirling Kanok sunbeams, isolated on pure #000000 black.`
8. **บันทึกการต่อสู้ (`public/board/icons/battle-log.png`)**:
   `An ancient Thai royal palm-leaf manuscript scroll (คัมภีร์ใบลานลงรักปิดทองและเหล็กจาร) partially unrolled with golden Thai floral filigree, isolated on pure #000000 black.`

---

## 5. หลังการ์ด (Card Back — Geometric Prajam-yam)

> สำรองเวอร์ชันพุ่มข้าวบิณฑ์เดิมไว้ที่ `card-back-v1.webp`

### `public/board/card-back.webp` (สัดส่วน 2:3 ขนาด `600×900`, ≤ 200 KB)
```text
2:3 portrait card back, Modern Thai Minimal Sacred aesthetic. Dark obsidian blue/black textured matte card surface with subtle ambient depth. In the center: a modernized geometric 4-petal Thai Prajam-yam floral star/diamond emblem crafted with sharp, faceted gold crystal lines, enclosed inside a crisp thin circular gold ring with subtle four-point compass accents. Sleek, international modern TCG collectible vibe with distinct Thai geometry heritage. Clean generous negative space, sleek single-line gold border near the card edges. No text, no letters, no numbers, no watermarks, no Buddha statues, no monks, no photorealistic faces.
```

---

## 6. ฉากเวทสนาม 3 ภาพ (Field Spell Environments — `public/board/fields/<cardId>.webp`)

### 6.1 กรุงลงกา (`public/board/fields/th04-007.webp`)
```text
High-angle battlefield view of the mythical demon fortress city of Krung Longka at twilight, aspect ratio 16:9. Along the perimeter rise grand obsidian-and-gold Thai Yaksha fortress walls, spiked golden spires, and glowing crimson braziers under a volcanic ember-filled dark sky, while the central stone courtyard is dark scorched obsidian with faint glowing crimson runes so cards placed on top remain clearly readable. Hand-painted Thai mythical digital painting style, NO text, NO watermarks.
```

### 6.2 วิมานเหนือเมฆ (`public/board/fields/th05-007.webp`)
```text
High-angle celestial view of a divine Thai heavenly realm above the clouds, aspect ratio 16:9. Along the borders, golden Thai Vimana palace spires and white Naga balustrades emerge from luminous golden-white clouds and warm sunbeams, while the central sky-courtyard is a calm, deep twilight-indigo and soft gold cloudscape so cards stand out clearly. Hand-painted Thai mythical digital painting style, NO text, NO watermarks.
```

### 6.3 ป่าช้าวัดร้าง (`public/board/fields/th06-011.webp`)
```text
High-angle atmospheric view of an ancient mist-shrouded ruined Thai forest cemetery at midnight, aspect ratio 16:9. Along the outer edges stand weathered stone chedi stupas, gnarled banyan tree roots with faded cloth ties, and floating ghostly blue-emerald spirit wisps (ดวงไฟวิญญาณ), while the central ground is dark mossy earth and mist so cards remain easy to read. Hand-painted Thai mythical digital painting style, NO text, NO watermarks, NO Buddha statues, NO monks.
```
