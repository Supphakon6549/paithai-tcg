# TH08 — มนตราแห่งชะตา

**รีวิวภาพล่าสุด 5 ใบ:** 001ยันต์วงทอง-ขาว-ฟ้าบนผ้าดำตามรูปผู้ใช้, 008ประทีปเรียกวิญญาณกลับจากสุสาน, 012ยันต์แปดทิศ, 013คนถูกมนต์สะกดหยุดนิ่ง, 014พระเครื่องคุ้มครอง ดู TH08-IMAGE-REVIEW-2026-11-08.md ไม่เปลี่ยนเอฟเฟกต์จากภาพ โดย013ยังลดATKเฉพาะbattle ไม่ใช่ห้ามโจมตีทั้งเทิร์น

**อัปเดตภาพ 8 พ.ย. 2026:** ผู้ใช้แก้ทิศทางให้เครื่องราง/วัตถุ/ผลคาถาเป็นจุดเด่น ลดคนออกจากการ์ดเวท ใช้พระไทยสำหรับวิปัสสนากรรมฐาน เสื้อยันต์ผ้าแดง เบี้ยแก้ตามรูปแนบ และอนุญาตอิงลายยันต์จริง รายละเอียด art-originals/TH08/ART-DIRECTION.md และ prompts-object-direction-2026-11-08.json ใช้แทนแนวภาพรายใบเก่าทั้งหมด ไม่เปลี่ยนเอฟเฟกต์

ฉบับส่งงาน 7 พฤศจิกายน 2026 ตามผลรีวิวที่ผู้ใช้ตัดสินแล้วใน NEXT-SETS-HANDOFF.md และข้อความล่าสุด

## สถานะและขอบเขต

ออกแบบชุดแรก 15 ใบเท่านั้น: เวทปกติ 8 ใบ เวทคืนชีพ 1 ใบ เวทสวมใส่ 3 ใบ กับดัก 3 ใบ รวมเวท 12 / กับดัก 3 ใช้คำว่า “การ์ด” ทุกใบ ไม่มีมนต์ทายทัก ไม่มีการเพิ่มใบพักไว้เข้าเกม

ข้อมูล src/data/th08-cards.json เป็นอาร์เรย์ตามโครงข้อมูลเดิม แต่ยังไม่ import ใน src/data/cards.js จึงยังไม่เพิ่มการ์ดที่กดแล้วผลไม่ทำงานเข้าเกม Claude เป็นผู้เชื่อม engine/AI/กฎสำรับและทดสอบต่อ ภาพเป็นไฟล์ส่งงาน มิใช่หลักฐานว่าเอฟเฟกต์เชื่อมแล้ว

ข้อเสนอค่าที่ GPT กำหนดสำหรับใบที่ยังไม่มีตัวเลข: บายศรีสู่ขวัญฟื้น 800; นะจังงังลด 500; ใบคืนชีพใช้ชื่อ ประทีปคืนขวัญ และท่าโจมตี ตัวเลขรอจำลองก่อนปรับ ไม่เปลี่ยนการ์ดเดิม

## รายการ 15 ใบ

| รหัส | ชื่อ | ประเภท | ข้อความหน้าการ์ด | กลุ่ม |
|---|---|---|---|---|
| TH08-001 | ยันต์เสริมดวง | เวทปกติ | เปิดการ์ดบนสุดของกองเราขึ้นมือ หากเป็นมอนสเตอร์ จั่วเพิ่ม 1 ใบ | กติกาย่อ |
| TH08-002 | วิปัสสนากรรมฐาน | เวทปกติ | ดูการ์ดบนกองเรา 3 ใบ เลือก 1 ใบขึ้นมือ ที่เหลือวางใต้กอง | กติกาย่อ |
| TH08-003 | นิมิตเรียกคู่หู | เวทปกติ | เผยร่างขึ้นขี่จากกองพิเศษเรา ค้นวัตถุดิบของร่างนั้นระดับ 1–4 จากกองขึ้นมือ 1 ใบ แล้วสับกอง | กติกาย่อ |
| TH08-004 | เมตตามหานิยม | เวทปกติ | เลือกมอนสเตอร์ศัตรู 1 ตัว มันโจมตีไม่ได้ในเทิร์นถัดไปของศัตรู | กติกาย่อ |
| TH08-005 | ข้าวสารเสก | เวทปกติ | เลือกมอนสเตอร์ศัตรูหงายหน้า 1 ตัว ลด ATK 500 จนจบเทิร์น | กติกาย่อ |
| TH08-006 | เสื้อยันต์ | เวทสวมใส่ | สวมให้มอนสเตอร์เผ่ามนุษย์ ผู้สวมได้รับ ATK และ DEF +300 | กติกาย่อ |
| TH08-007 | บายศรีสู่ขวัญ | เวทปกติ | ฟื้น LP ของเรา 800 | กติกาย่อ |
| TH08-008 | ประทีปคืนขวัญ | เวทคืนชีพ | อัญเชิญมอนสเตอร์จากสุสานเรา 1 ตัวลงสนามในท่าโจมตี | กติกาย่อ |
| TH08-009 | เบี้ยแก้ | เวทสวมใส่ | ผู้สวมไม่ถูกเลือกเป็นเป้าของเวทและกับดักศัตรู | เครื่องราง |
| TH08-010 | ตะกรุดคู่ชีวิต | เวทสวมใส่ | เมื่อผู้สวมจะถูกทำลาย ส่งการ์ดใบนี้ลงสุสานแทน | เครื่องราง |
| TH08-011 | มนต์สะกดวิญญาณ | เวทปกติ | อัญเชิญมอนสเตอร์ระดับ 1–4 จากสุสานศัตรูมาเป็นของเรา ออกจากสนามกลับสุสานเจ้าของ / ใช้เป็นเครื่องสังเวยหรือวัตถุดิบไม่ได้ • จำกัด 1 ใบต่อสำรับ | พลิกเกม |
| TH08-012 | แคล้วคลาด | กับดักปกติ | เมื่อมอนสเตอร์เราถูกโจมตี ยกเลิกการโจมตีนั้น แล้วเปลี่ยนตัวที่ถูกโจมตีเป็นท่าป้องกัน | กติกาเต็ม |
| TH08-013 | นะจังงัง | กับดักปกติ | เมื่อศัตรูประกาศโจมตี ลด ATK ผู้โจมตี 500 เฉพาะการต่อสู้นั้น | กติกาเต็ม |
| TH08-014 | มหาอุตม์ | กับดักปกติ | เมื่อมอนสเตอร์เราถูกโจมตี มันไม่ถูกทำลาย และเราไม่เสีย LP จากการต่อสู้นั้น | กติกาเต็ม |
| TH08-015 | มนต์ถอนอาคม | เวทปกติ | เลือกเวทหรือกับดักบนสนาม 1 ใบ ทำลายใบนั้น | กติกาเต็ม |

## กติกากลาง

- 001–008 เป็นแกนกติกาย่อ 8/15 ใบ ไม่ต้องรู้กฎกับดักหรือแพ้ทางธาตุ; โหมดต้องรองรับสวมใส่และสุสานด้วย บายศรี/คืนชีพไม่บังคับใส่ในด่านแรกก่อนสอนโซนเหล่านั้น
- เวทใช้ในเฟสหลักเราเท่านั้น กับดักวางคว่ำผ่านเทิร์นก่อน เปิดในหน้าต่างประกาศโจมตี ไม่มีการเพิ่มช่องแทรกกลางเฟสหลักศัตรู
- สวมใส่ใช้ช่องและจำนวนตามกฎเดิม สวมมอนสเตอร์หงายฝ่ายเราเท่านั้น การ์ดเครื่องรางแยก instance ของตน ออกจากสนามไปสุสานเจ้าของตน ไม่สวมให้ตัวคว่ำ
- 011 จำกัด **1 ใบต่อสำรับ** เป็นข้อจำกัดจัดสำรับ ไม่ใช่ใช้ได้ครั้งเดียวต่อเกม ห้ามเปลี่ยนเป็นยืมหนึ่งเทิร์นตามร่างเก่า
- ไม่มีข้อจำกัดเพิ่มเติมเรื่องห้ามค้นหลังจั่วหรือโควต้าชื่อละครั้งต่อเทิร์นที่ผู้ใช้ไม่ได้อนุมัติ หาก sim พบปัญหา Claude รายงานก่อนแก้ข้อความ/ตัวเลข
- ข้อความหน้าใบจัดเป็นข้อความสั้นหนึ่งย่อหน้า ยกเว้น011แบ่งเป็นสองส่วนรวมข้อจำกัด ต้องตรวจการตัดบรรทัดใน UI จริงก่อนปล่อย ไม่ลดขนาดจนอ่านยากเพื่อบังคับสองบรรทัด
- ข้อมูล element เป็นข้อมูลแสดงตาม schema ไม่เพิ่มกลไกธาตุให้เวทโดยอัตโนมัติ groupTag ใช้ spell-trap เดิม ไม่แก้เผ่าเดิม

## ข้อกำหนดรายใบและแนวภาพ

### TH08-001 ยันต์เสริมดวง

- ผล: revealTopAddThenDrawIfMonster — **ผลใหม่ ต้องเพิ่มระบบ**
- ข้อกำหนด: เปิดใบบนสุดให้ทั้งสองฝ่ายเห็น แล้วนำขึ้นมือ ไม่ใช่เลือกหรือค้น; โบนัสดูประเภทจริงของใบที่เปิด ถ้ากองเหลือใบเดียวรับใบนั้นและไม่จั่วเพิ่ม กองว่างห้ามใช้ ไม่สร้างแพ้เพราะจั่วโบนัสที่ไม่มีใบ; ไม่เพิ่มข้อจำกัดค้นหรือโควต้าเอง
- กรณีทดสอบ: มอนสเตอร์/เวท/กับดัก/พิธีกรรม; กอง 0/1/2 ใบ; เปิดแล้วนำขึ้นมือก่อนจั่ว; AI ไม่รู้กองล่วงหน้า
- แนวภาพ: วงยันต์ทอง-ขาว-ฟ้าลอยกลางอากาศโดยตรง แสงไหลจากแกนตามอักขระ ไม่มีผ้าหรือแผ่นรอง

### TH08-002 วิปัสสนากรรมฐาน

- ผล: lookTopChooseOneRestBottom — **ประยุกต์ฐานเดิม ต้องต่อทางใช้เวท/กับดัก**
- ข้อกำหนด: ดูแบบส่วนตัว ไม่เปิดให้ศัตรูเห็น เลือกได้ทุกประเภท กองเหลือ 1–2 ใบดูเท่าที่เหลือ วางที่เหลือใต้กองตามลำดับที่เราเลือก ห้ามใช้ถ้ากองว่าง; ต่อจาก onSummonLook ของป่า แต่ต้องเพิ่มทางใช้เป็นเวท ไม่ใช่ scout
- กรณีทดสอบ: กอง 0/1/2/3/4 ใบ; เลือกได้หนึ่งจริง; ใต้กองไม่หายและไม่สับ; ข้อมูลส่วนตัว
- แนวภาพ: A fictional Thai Buddhist monk, shaved head, natural mature Thai face, simple properly wrapped ochre saffron robe, no jewelry, seated calmly in cross-legged meditation on a supported low wooden platform. Meditation, not a character portrait: slightly elevated three-quarter view showing whole seated practice and hands naturally nested in lap, eyes gently closed. Main readable symbol is a tranquil pool-like circle of clear golden light around the seated position, three subtle lotus reflections with one gently bright. Quiet Thai wooden meditation hall, soft morning light through an open side; background very subordinate. Robe broad matte folds, strong 3D volume. Small knee or platform edge projects over side border. No layman, no hair, no topknot, no handsome Chinese drama hero, no action pose, no giant deity aura.

### TH08-003 นิมิตเรียกคู่หู

- ผล: revealMountSearchMaterial — **ผลใหม่ ต้องเพิ่มระบบ**
- ข้อกำหนด: เผยร่างที่ขึ้นขี่ได้จริงในกองพิเศษ แล้วเลือกมอนสเตอร์ระดับพิมพ์ 1–4 ในกองที่ตรงวัตถุดิบอย่างน้อยหนึ่งช่องของสูตรจริง ไม่ใช่ทุก fusion; สูตรอาจระบุชื่อหรือ predicate เผ่า ต้องใช้ matches เดียวกับ engine ห้ามเดาจาก flavorText/ชื่อ หรือเปิดให้สูตรที่ยังไม่มี; ไม่เรียกลงสนาม ไม่ลดต้นทุน ไม่ต้องมีวัสดุครบทุกช่องก่อนค้น เลือกแสดงเฉพาะร่างที่มีผลค้นถูกกฎอย่างน้อยหนึ่งใบ
- กรณีทดสอบ: สูตรชื่อเฉพาะ/เผ่ากว้าง/ไม่มีสูตร; ระดับพิมพ์ 4/5; เผ่ารองและเผ่าหลักตาม matcher เดิม; ไม่มีผลค้น; เปิดสูตรและผลให้คู่ต่อสู้รู้; สับครั้งเดียว
- แนวภาพ: Two small tangible carved amulets on a dark Thai altar: one upright teak figurine of a traditional Thai warrior and one crouching tiger figurine, both unmistakably crafted objects not living characters. They occupy the foreground with equal scale and are linked by one white sacred cotton thread that makes a soft loop above them; a tiny faint gold vision of the combined tiger-mounted figure is distant and subordinate, indicating a future partnership. Main meaning: finding the missing matching partner. Warm sunrise through a Thai sala, background low-detail. Tiger amulet paw and thread gently overlap the side border. No living humans, no portrait, no giant tiger, no busy forest.

### TH08-004 เมตตามหานิยม

- ผล: lockEnemyAttack — **ประยุกต์ฐานเดิม ต้องต่อทางใช้เวท/กับดัก**
- ข้อกำหนด: เลือกศัตรูหงายหน้า 1 ตัวในเฟสหลักเรา ห้ามประกาศโจมตีจนจบเทิร์นถัดไปของผู้ควบคุมตอนถูกเลือก ไม่ปิดความสามารถ ไม่ยกเลิกการโจมตีที่เกิดแล้ว ผูกกับ instance ออกสนามแล้วหมดผล ไม่ยืดระยะถ้าเปลี่ยนฝ่าย ใช้ lockAttack เป็นฐาน ไม่เพิ่มเงื่อนไขเราโจมตีแล้วปลดล็อกตามร่างเก่า
- กรณีทดสอบ: ห้ามโจมตีเทิร์นศัตรูถัดไปแล้วหมด; ไม่ปิดสกิล; ออกกลับ/ย้ายฝ่าย; กดซ้ำไม่ทบระยะ
- แนวภาพ: One fresh white jasmine garland and pale pink lotus on a brass ritual tray in sharp foreground. A dark curved Thai sword lies visibly lowered and at rest behind the garland, its formerly harsh dark aura dissolving into one soft warm rose-gold wave around the lotus. This is a calm-anger charm: flower and gentle blessing are the focal subject, the weapon distinctly secondary, no romantic heart icons. Soft old Thai courtyard at morning in background. Garland end projects over frame side. No people, faces, hands or bodies.

### TH08-005 ข้าวสารเสก

- ผล: temporaryEnemyAtkReduction — **ประยุกต์ฐานเดิม ต้องต่อทางใช้เวท/กับดัก**
- ข้อกำหนด: ลดเฉพาะ ATK หงายศัตรูหนึ่งตัวจนจบเทิร์นเรา ไม่ปิดความสามารถ ไม่ต้องทิ้งการ์ด ใช้กฎค่าต่ำสุดเดิม ต้องเพิ่มเวทเรียกผล debuff
- กรณีทดสอบ: ATK ต่ำกว่า500; จบเทิร์นหมดผล; เป้าคว่ำไม่ถูกเลือก; ไม่มี discard
- แนวภาพ: Consecrated uncooked white rice grains are the ENTIRE subject: many natural elongated rice grains rest in a small plain bronze cup near the lower art edge, a short graceful arc of a few individual rice grains rises prominently into the center, each grain clearly rice rather than glitter or pearls. Cool white-blue glow only on the tips of a few grains, fine gold dust minimal. Main focus on three large crisp grains closest to camera, shallow depth, rest of rice realistically smaller. Dim blurred Thai wooden altar with warm directional light, no figures or spirits. A few grains cross over left frame edge with shadows. No people, face, hand, ghost, human silhouette, spoon held by someone or generic particle storm.

### TH08-006 เสื้อยันต์

- ผล: humanEquipStats — **ประยุกต์ฐานเดิม ต้องต่อทางใช้เวท/กับดัก**
- ข้อกำหนด: สวมเฉพาะมอนสเตอร์หงายที่นับเป็นมนุษย์ตามตัวกรองปัจจุบัน ตรวจ HUMAN_TRIBES และกฎ livingHuman เดิม ไม่ใช่ใครมีหน้าคนก็ได้ หากเป็นเผ่ารองให้ใช้กฎมนุษย์เดียวกับสูตรขึ้นขี่; เพิ่ม DEF จาก equip เพราะ registry เดิมที่อ่านระบุ ATK/ธาตุ/XP ไม่ยืนยันรองรับ DEF แล้ว ไม่เพิ่มเผ่าใหม่
- กรณีทดสอบ: มนุษย์ทุกเผ่าปัจจุบัน; ผี/อสูร/เทวดาไม่ผ่านเพียงเพราะรูปร่างคน; +300 ทั้งสองค่า; ถอดแล้วคืนค่า; stackตามกฎสวมเดิม
- แนวภาพ: ONLY a traditional Thai sleeveless protective yantra vest, carefully based on the flat shape and authentic ink diagram layout in Image2. Color must be deep BRICK RED / vermilion red cotton, aged but clean, not white, cream or orange. Round wide neck opening, straight side edges, no standing collar, no frog buttons, no sleeves. Front has intricate BLACK hand-inked Khom-style yantra inscriptions: central square monkey/tiger-like sacred figure exactly guided by reference motif, square and circular seals, rows of small script and spired yantra near lower part. Copy the visual diagram structure from the supplied image, omit its brand mark and ordinary caption. Shown as a hollow garment suspended on a discreet wooden rod, gentle broad folds for sculptural volume, no mannequin body visible. Bright angled light isolates red fabric from soft near-black Thai teak shrine background; tiny restrained warm rim glow. One hem corner projects over side frame. No human, head, torso, hand, person wearing it or tailor.

### TH08-007 บายศรีสู่ขวัญ

- ผล: healSpell — **ประยุกต์ฐานเดิม ต้องต่อทางใช้เวท/กับดัก**
- ข้อกำหนด: ฟื้น LP เรา 800 ไม่เพิ่มเพดาน ถ้าเกมมีเพดานให้ใช้ของเดิม เป็นเวทใช้ครั้งเดียว ไม่ใช่ activated บนสนามหลายครั้ง
- กรณีทดสอบ: LP ปกติ/ใกล้เพดาน; ไม่ได้ฟื้นซ้ำ; ไม่มีค่าร่ายทิ้งการ์ด
- แนวภาพ: ONLY a beautiful Thai bai sri banana-leaf ceremonial arrangement on a brass phan pedestal tray. Fresh folded green banana leaves, tiers of delicate white jasmine blossoms, a single slender yellow candle and neatly arranged white blessing threads. Make unmistakable handmade Thai leaf folding and tactile 3D detail. Soft warm white life-restoring light rises gently from the candle and base, no massive aura. Soft sunlit Thai timber sala background and distant rice fields, low detail. Brass tray edge and thread overlap side gold frame. No people, hands, human silhouettes, craftsperson or portrait.

### TH08-008 ประทีปคืนขวัญ

- ผล: reviveSpell — **ประยุกต์ฐานเดิม ต้องต่อทางใช้เวท/กับดัก**
- ข้อกำหนด: ชื่อออกแบบใหม่ ประทีปคืนขวัญ ใช้ฐาน reviveSpell เดิม ไม่กำหนดระดับสูงสุดเพิ่มเอง; เรียกหนึ่งตัวที่คืนชีพได้ตามกฎอัญเชิญเดิม ไม่ข้าม fusion/ritual/summonOnlyBy หรือลักลอบได้ภูมิคุ้มกันธาตุมืดของน้ำมนต์เดิม; ต้องมีช่องว่าง ไม่ใช้อัญเชิญปกติเพิ่ม เมื่อเป็นวัสดุขึ้นขี่ใช้กฎเดิม
- กรณีทดสอบ: ช่องเต็ม/ว่าง; มอนสเตอร์ธรรมดา/สังเวย; fusion/ritual/onlyBy ถูกกรอง; ไม่ติด darkImmune; สุสานว่าง
- แนวภาพ: ประทีปส่งแสงไปยังสุสาน วิญญาณนักรบไทยหนึ่งตนกำลังก่อตัวกลับเป็นร่าง ชี้ความหมายคืนชีพชัดเจน

### TH08-009 เบี้ยแก้

- ผล: equipEnemySpellTrapTargetProtection — **ผลใหม่ ต้องเพิ่มระบบ**
- ข้อกำหนด: ป้องกันเฉพาะการเลือกผู้สวมเป็นเป้าของเวทและกับดักศัตรู ยังโจมตีได้ มอนสเตอร์ศัตรูใช้สกิลเลือกได้ เวทของเรายังเลือกได้ ผลไม่เลือกเป้า/ล้างสนามยังโดน ไม่คุ้มครองตัวเบี้ยแก้เองและไม่ยกเลิกผลเก่าที่ติดแล้ว ต้องต่อกรองทุก UI/action validation ไม่ใช้ shroud เดิมตรง ๆ ที่กว้างเป็นความสามารถ
- กรณีทดสอบ: เวท/กับดักเลือกเป้าถูกกัน; monster skill/โจมตี/ล้างสนามไม่กัน; ทำลายตัวเบี้ยได้; หลังถอดเลือกผู้สวมได้ทันที; AI เคารพเป้า
- แนวภาพ: A single realistic THAI BIA KAE amulet, based on Image2, especially the BOTTOM LEFT example with visible amber-spotted shell held in an aged black braided lacquered surround. SMALL compact oval cowrie form, three-quarter view shows the smooth amber-brown spotted convex shell BACK partially exposed within thick black-brown woven cord and aged lacquer/resin rim. One tiny dark cord suspension loop, no ornate golden jewelry cage. Black surround has coarse handmade tactile braid and subtle worn wax sheen. Match user's amulet anatomy and materials, do NOT depict a huge white open toothed cowrie slit as the main face. Place it on folded deep burgundy cloth atop a plain old wooden altar; main object occupies about half the art area, close-up crisp detail. One subdued transparent protective contour deflects a single violet thread at the edge, no neon loops around everything. Dark muted Thai shrine background, dramatic warm raking light. Cord slightly crosses left frame. NO humans, hands, prayer scene, big rope necklace, gold caps or fantasy shell ornament.

### TH08-010 ตะกรุดคู่ชีวิต

- ผล: equipDestructionReplacement — **ผลใหม่ ต้องเพิ่มระบบ**
- ข้อกำหนด: ก่อนผู้สวมจะถูกทำลายจากต่อสู้หรือเอฟเฟกต์ ผู้ควบคุมเลือกส่งตะกรุดแทนได้ครั้งนั้น ไม่กัน LP ไม่กันคืนมือ/สังเวย/วัตถุดิบ/ส่งสุสานที่ไม่ใช่ทำลาย การส่งตะกรุดเป็นการแทนที่ไม่ใช่ทำลายตะกรุด หากหลายตะกรุดใช้ใบเดียวต่อเหตุการณ์ หากผู้สวมและตะกรุดจะถูกทำลายพร้อมกัน ห้ามใช้ตะกรุดในชุดทำลายเดียวกันมาป้องกัน; ข้อความไม่ต้องเพิ่มผูกเพื่อนตามร่างเก่า
- กรณีทดสอบ: ต่อสู้/เอฟเฟกต์; ยังเสียLP; ไม่กันคืนมือหรือสังเวย; หลายใบ; ล้างสนามทั้งเครื่องรางและตัว; ไม่วนทริกเกอร์ทำลาย
- แนวภาพ: ONLY two compact tightly rolled metal Thai TAKRUT tubes, one aged copper-brass and one dull silver, lashed side-by-side by simple worn dark-red cotton cord. Clearly visible concentric rolled sheet edges, realistic small talisman craft, fine incised yantra traces, not industrial pipes. One brass tube has a fine crack at its tip and catches one tiny golden impact spark, while the other remains whole: absorbing harm in place of its bearer. Resting on a soft dark woven Thai cloth, muted timber altar background, warm sculptural light. Short cord end overlaps side frame. No person, hands, background portrait, human silhouette, dragon relief or gaudy gold.

### TH08-011 มนต์สะกดวิญญาณ

- ผล: summonFromEnemyGraveWithOwnerRouting — **ผลใหม่ ต้องเพิ่มระบบ**
- ข้อกำหนด: ไม่จำกัดหนึ่งเทิร์นและไม่คืนตอนจบเทิร์น ไม่มีโควต้าชื่อต่อเทิร์นเพิ่มนอกรีวิว; ownerId เดิมไม่เปลี่ยน controllerId เป็นเรา ย้าย physical instance จริง ห้าม copy ใช้สกิลและโจมตีตามกฎอัญเชิญเดิมได้; ทุกเส้นทางออกสนามต้อง route ไปสุสานเจ้าของเดิม: ทำลาย ส่ง คืนมือ คืนกอง ขับออก ฯลฯ และไม่ปล่อยเอฟเฟกต์ 'คืนสำเร็จ' ทั้งที่ไม่ได้คืนจริง; ห้ามสังเวยทุกชนิดและวัสดุ ritual/fusion/mount/evolution หรือจ่ายต้นทุนที่เทียบเท่า ห้ามเลี่ยงด้วย UI อื่น ข้อห้ามติดตัวที่ยืมจนออกสนาม; ใช้ original owner คงที่ใน save/replay/grave bookkeeping, equip ของเราออกไปสุสานเจ้าของเครื่องราง ไม่ไปตามมอนสเตอร์
- กรณีทดสอบ: ระดับ1/4/5; ช่องเต็ม; summonOnlyBy; ทุกทางออกสนาม/ต้นทุน/มาสก์AI; 1สำเนาต่อสำรับทุกช่องทาง; owner/controller/save/replay; สุสานผู้เล่นถูกต้อง; death triggers ครั้งเดียว ไม่เกิด return-hand trigger ปลอม
- แนวภาพ: ONLY an old Thai ritual earthenware spirit pot with small cloth-covered mouth, a red-brown sai-sin-like binding cord stretched between its rim and ONE small blue-white spirit flame rising from within. The compact flame is constrained by a simple golden yantra loop, a clear binding effect, NOT a human or ghost figure. Earthen pot and binding cord dominate, surrounding scene is muted moonlit Thai ruined shrine, two stone slabs secondary. Cord near foreground crosses frame edge, contrast makes pot and flame clear, smoke minimal. No people, sorcerer, face, humanoid silhouette, chained soldier, Chinese urn or jiangshi.

### TH08-012 แคล้วคลาด

- ผล: attackCancelThenDefenseTrap — **ประยุกต์ฐานเดิม ต้องต่อทางใช้เวท/กับดัก**
- ข้อกำหนด: เลือกได้เมื่อถูกโจมตีทั้งหงายและคว่ำ ไม่โจมตีตรง; ยกเลิกครั้งนั้นแล้วเปลี่ยนผู้ถูกโจมตีเป็นป้องกัน หงายอยู่คงหงาย คว่ำอยู่คงคว่ำ ไม่เปิด flip โดยไม่จำเป็น ไม่ฟื้นสิทธิ์โจมตีผู้โจมตี ต้องผ่านเทิร์นตั้งกับดักตามกฎเดิม
- กรณีทดสอบ: หงายโจมตี/หงายป้องกัน/คว่ำ; โจมตีตรงไม่ขึ้น; ไม่พลิกคว่ำ; ผู้โจมตีใช้สิทธิ์แล้ว
- แนวภาพ: ยันต์หมูทองแดงรูปหมูด้านข้าง เส้นอักขระไขว้ในลำตัวและยอดยันต์เหนือหลัง เป็นแสงทองแดงลอย ไม่มีผ้าหรือแผ่นรอง

### TH08-013 นะจังงัง

- ผล: battleOnlyAttackerAtkDownTrap — **ประยุกต์ฐานเดิม ต้องต่อทางใช้เวท/กับดัก**
- ข้อกำหนด: ลด ATK ผู้โจมตี500 เฉพาะการต่อสู้ครั้งนี้ รวมการโจมตีตรง ถ้ายกเลิกการโจมตีก็หมดผล ไม่ติดถึงโจมตีเพิ่ม ไม่ปิดความสามารถ ตัดผลปิดความสามารถจากแนวคิดเก่าออก
- กรณีทดสอบ: โจมตีตรง/มอนสเตอร์; ATKต่ำ; การโจมตีถูกยกเลิก; ตีซ้ำไม่ติดลด; ไม่ปิดสกิล
- แนวภาพ: นักรบไทยถูกมนต์สะกดค้างกลางก้าว ดวงตาตื่นตัวแต่ร่างหยุดนิ่ง ไม่ใช่ภาพโชว์นักรบ

### TH08-014 มหาอุตม์

- ผล: oneBattleInvulnerabilityTrap — **ประยุกต์ฐานเดิม ต้องต่อทางใช้เวท/กับดัก**
- ข้อกำหนด: เฉพาะมอนสเตอร์เราที่ถูกโจมตีและLPที่เกิดจากการต่อสู้นั้น ไม่ยกเลิกการโจมตี ไม่กันเอฟเฟกต์หรือทั้งเทิร์น ใช้แนวคิด wardShield เดิมเป็นฐานแต่ต้องเรียกจากกับดักและหมดผลหลัง battle; ผู้ถูกโจมตีคว่ำเปิดตามขั้นต่อสู้ปกติ
- กรณีทดสอบ: ATKแพ้/เสมอ/ตั้งรับ; ไม่เสียLP; ไม่กันเอฟเฟกต์หลังต่อสู้; ไม่มีเกราะค้าง; โจมตีตรงเปิดไม่ได้
- แนวภาพ: พระเครื่องโลหะปิดตาในท่านั่งสมาธิเป็นวัตถุหลัก มีม่านคุ้มครองหยุดคมอาวุธด้านหน้า

### TH08-015 มนต์ถอนอาคม

- ผล: destroyOneSpellOrTrap — **ประยุกต์ฐานเดิม ต้องต่อทางใช้เวท/กับดัก**
- ข้อกำหนด: เฟสหลักเรา เลือกเวทหรือกับดักบนสนามหนึ่งใบ รวมสวมใส่/ต่อเนื่อง/สนาม/คว่ำ และของตนได้ ไม่เปิดดูคว่ำเพื่อเลือกก่อนใช้ ไม่เลือกเวทใบนี้ที่กำลังแก้ผล ไม่ใช่ destroySpellsTraps เดิมที่กวาดทั้งหมด ต้องเพิ่มตัวเลือกหนึ่งใบ ไม่ทำลายมอนสเตอร์
- กรณีทดสอบ: เวทสนาม/สวม/ต่อเนื่อง/กับดัก/คว่ำ; 1ใบจริง; ของตน; ไม่ดูคว่ำล่วงหน้า; ถอดบัฟถูกต้อง
- แนวภาพ: ONLY a dark aged Thai palm-leaf / wooden talisman tablet bound in a tight black cord knot. One slender brass ritual blade lies diagonally beneath it, no hand holding it. A clean white-gold thread of light unravels the black knot; talisman breaks into just two substantial pieces as the dark spell evaporates gently. Clear cause-and-effect: dismantling an enemy spell. Controlled illumination, quiet muted Thai shrine table and stone steps behind, no busy ornament. Cord end and blade tip project over frame sides. No person, head, body, human silhouette, portrait or dense debris.


## ส่งงาน Claude

ผลใหม่ชัดเจน: **001 จั่วตามประเภทที่เปิด, 003 ค้นวัตถุดิบจากสูตรขึ้นขี่, 009 ป้องกันเป้าเฉพาะเวท/กับดักผ่านเครื่องราง, 010 เครื่องรางรับการทำลายแทน, 011 ยืมสุสานศัตรูพร้อม owner/routing/ห้ามวัสดุ/จำกัดสำรับ**

ใบอื่นประยุกต์ฐานเดิม ไม่ได้หมายความว่าใส่ JSON แล้วทำงานทันที: 002 onSummonLook→เวท; 004 lockAttack→เวท; 005 debuff→เวท; 006 equip เพิ่มDEFและกรองมนุษย์; 007 heal→เวท; 008 reviveSpell กรองข้อห้าม; 012–014 หน้าต่างกับดักและเกราะเฉพาะbattle; 015 ทำลายเลือกหนึ่งแทนกวาดทั้งหมด

ไฟล์ docs/TH08-EFFECTS.json เป็น specification ไม่ใช่ effect registry ที่พร้อมรัน ห้ามอ้างชื่อ kind ในเอกสารว่า export จาก engine แล้ว ตรวจ src/engine/effects.js, game.js, ai.js ณวันอ่านก่อน implement; scout ที่มีอยู่คือดูกับดักคว่ำศัตรู ไม่ใช่ดูบนกอง

หลังเชื่อมให้ทดสอบกฎ/AI/ข้อมูลลับ/สถานะหมดอายุและจำลองเด็คตามเป้าใน handoff 40–60% ก่อนเสนอปรับตัวเลข โดยชุดนี้ไม่มีมอนสเตอร์ จึงไม่สร้างเด็ค TH08 ล้วน ให้ผสมในเด็คเดิมและคู่หู ตรวจขอบเขต 011 ทุกทางก่อนเผยแพร่

## ภาพและไฟล์

- ต้นฉบับล่าสุด: 001v6, 002–003v3, 008v3, 012v6 (ยันต์หมูทองแดง), 013–014v3, ใบอื่นv2 — ใช้ showcase-manifest.json เป็นรายการกลาง
- ภาพเว็บพร้อมกรอบ: public/cards/showcase/th08-XXX-template-vN.webp
- ภาพฉากสำหรับ schema เดิม: public/cards/th08-XXX.jpg ครอปเฉพาะช่องภาพ ไม่รวมป้ายข้อความ
- รายการผลจริงและสถานะ: art-originals/TH08/showcase-manifest.json
- คำสั่งภาพรายใบ: art-originals/TH08/prompts.json
- แผ่นดูรวม: art-originals/TH08/th08-showcase-review.jpg

แนวภาพล่าสุด 8 พ.ย.: วัตถุหรือผลคาถาเป็นจุดเด่น ไม่มีคนโชว์เครื่องราง พระไทยนั่งสมาธิเป็นข้อยกเว้นของ002 ใช้รูปทรงเบี้ยแก้และลายยันต์จากภาพผู้ใช้ เสื้อยันต์สีแดง ฉากหลังนุ่ม มีมิติและส่วนทะลุขอบด้านข้าง ไม่บังป้าย ดู ART-DIRECTION.md

## ตัดและพัก

ตัด: มนต์ทายทัก

พักชุดขั้นสูง: มนต์สับจิต, อาคมสะท้อนกลับ, กสิณห้าธาตุ, เปลี่ยนดวงชะตา, เนตรสุริยัน, พิธีตัดกรรม, มนต์สะกดกาล, มนต์คืนรูป, ยันต์เสือเผ่น, ยันต์เก้ายอด, มนต์สะกดทัพ, ยันต์ห้าแถว, มนต์บังตา, ยันต์เสือหัวขาด, ตำราพิชัยสงคราม, กายาเหล็กไหล

หากนำกายาเหล็กไหลกลับมา: เปลี่ยนเป็นกับดักหรือให้คงผลจนจบเทิร์นถัดไปศัตรู เพราะเวทปกติใช้เฉพาะเทิร์นเรา

