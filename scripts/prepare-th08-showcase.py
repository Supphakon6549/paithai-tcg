"""Export TH08 approved-direction image outputs and a local review gallery.
Reads generated-sources.json; never edits engine, existing sets or image content.
"""
from pathlib import Path
import json, shutil
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
art = root / 'art-originals/TH08'
cards = json.loads((root / 'src/data/th08-cards.json').read_text(encoding='utf-8'))
sources = json.loads((art / 'generated-sources.json').read_text(encoding='utf-8'))
by_id = {c['id']: c for c in cards}
out = root / 'public/cards/showcase'
out.mkdir(parents=True, exist_ok=True)
sheet = Image.new('RGB', (1500, 2140), '#101720')
draw = ImageDraw.Draw(sheet)
fontpath = Path('C:/Windows/Fonts/tahoma.ttf')
font = ImageFont.truetype(str(fontpath), 19) if fontpath.exists() else ImageFont.load_default()
manifest = []
for index, entry in enumerate(sources):
    cid, version = entry['id'], entry['version']
    original = art / f'{cid}-showcase-v{version}.png'
    if Path(entry['source']).resolve() != original.resolve():
        shutil.copy2(entry['source'], original)
    with Image.open(original) as im:
        if abs(im.width / im.height - .75) > .005:
            raise ValueError(f'Unexpected image ratio: {original} {im.size}')
        web = out / f'{cid}-template-v{version}.webp'
        im.convert('RGB').save(web, quality=92, method=6)
        # Secondary conventional scene asset: inside art window only.
        scene = root / f'public/cards/{cid}.jpg'
        im.crop((round(im.width*.12), round(im.height*.08), round(im.width*.88), round(im.height*.525))).convert('RGB').save(scene, quality=94)
        thumb = im.convert('RGB')
        thumb.thumbnail((280, 374))
        x, y = (index % 5)*300+10, (index//5)*710+8
        # Larger scene preview above miniature complete-frame view, useful for identity review.
        preview = Image.open(scene)
        preview.thumbnail((280, 230))
        sheet.paste(preview, (x, y))
        sheet.paste(thumb, (x, y+240))
        draw.text((x, y+622), cid.upper(), font=font, fill='#f3d99f')
        draw.text((x, y+651), by_id[cid]['name'], font=font, fill='#eeeeee')
        manifest.append({'id':cid, 'name':by_id[cid]['name'], 'version':version,
                         'original':str(original.relative_to(root)).replace('\\','/'),
                         'web':'/cards/showcase/'+web.name, 'scene':by_id[cid]['image'],
                         'size':list(im.size), 'status':'generated-reviewed-direction-not-user-final-approved'})
sheet.save(art / 'th08-showcase-review.jpg', quality=93)
(art / 'showcase-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
payload = json.dumps([dict(c, showcase=next(m['web'] for m in manifest if m['id']==c['id'])) for c in cards if any(m['id']==c['id'] for m in manifest)], ensure_ascii=False)
html = """<!doctype html><html lang="th"><meta charset="utf-8"><title>TH08 — มนตราแห่งชะตา</title>
<style>*{box-sizing:border-box}body{margin:0;background:#101720;color:#f6edda;font:16px Tahoma,sans-serif;padding:30px}h1{font-size:25px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:25px;max-width:1500px;margin:auto}.card{position:relative;aspect-ratio:3/4;cursor:zoom-in}.card img{width:100%;height:100%;display:block}.name,.rules,.type,.code{position:absolute;text-align:center;left:19%;width:62%;margin:0}.name{top:56%;font-size:clamp(13px,1.3vw,21px);color:#ffe8ae}.type{top:62%;font-size:11px}.rules{top:75%;font-size:clamp(11px,1vw,16px);line-height:1.5;white-space:pre-line}.code{top:93%;font-size:10px}dialog{background:#101720;color:white;border:1px solid #c79c48;max-width:94vw;max-height:96vh;padding:14px}dialog::backdrop{background:#000d}dialog .card{width:min(650px,78vw);cursor:zoom-out}dialog .name{font-size:27px}dialog .rules{font-size:22px}button{float:right;background:#d8bb76;border:0;padding:8px;cursor:pointer}p{color:#c2c9d0}</style>
<h1>TH08 — มนตราแห่งชะตา · 15 ใบ</h1><p>ภาพและข้อความสำหรับตรวจงาน • ยังไม่เชื่อมผลในเกม • คลิกการ์ดเพื่อขยาย</p><main></main><dialog><button>ปิด</button><section></section></dialog>
<script>const cards=PAYLOAD;
function render(c){const e=document.createElement('article');e.className='card';const img=document.createElement('img');img.src='../../public'+c.showcase;img.alt=c.name;e.append(img);for(const [cls,txt] of [['name',c.name],['type',c.spellSubtypeName||c.trapSubtypeName],['rules',c.effectText],['code',c.setCode]]){const p=document.createElement('p');p.className=cls;p.textContent=txt;e.append(p)}return e}
const d=document.querySelector('dialog');document.querySelector('button').onclick=()=>d.close();for(const c of cards){const el=render(c);el.onclick=()=>{d.querySelector('section').replaceChildren(render(c));d.showModal()};document.querySelector('main').append(el)}d.querySelector('section').onclick=()=>d.close();
</script></html>""".replace('PAYLOAD',payload)
(art / 'TH08-REVIEW.html').write_text(html, encoding='utf-8')
print(f'Exported {len(manifest)}/{len(cards)} images, sheet and review gallery.')

