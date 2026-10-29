"""Export selected TH03 artwork and a contact sheet, preserving originals."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

root = Path(__file__).resolve().parents[1]
sheet = Image.new('RGB', (1200, 1384), '#111821')
draw = ImageDraw.Draw(sheet)
manifest = []
for index, n in enumerate(range(1, 20)):
    version = 2 if n in (6, 11, 12, 13, 14, 15, 16, 19) else 1
    card_id = f'th03-{n:03}'
    source = root / f'art-originals/TH03/{card_id}-showcase-v{version}.png'
    target = root / f'public/cards/showcase/{card_id}-template-v{version}.webp'
    with Image.open(source) as image:
        if abs(image.width / image.height - .75) > .005:
            raise ValueError(f'Unexpected aspect ratio: {source}')
        image.save(target, quality=92, method=6)
        thumb = image.convert('RGB')
        thumb.thumbnail((230, 307))
        x, y = (index % 5) * 240 + 5, (index // 5) * 346 + 4
        sheet.paste(thumb, (x, y))
        draw.text((x + 45, y + 312), f'{card_id.upper()} / v{version}', fill='#e9d9ad')
    manifest.append({'id': card_id, 'version': version, 'original': str(source.relative_to(root)), 'web': str(target.relative_to(root))})
sheet.save(root / 'art-originals/TH03/th03-showcase-review.jpg', quality=92)
(root / 'art-originals/TH03/showcase-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f'Exported {len(manifest)} cards and review sheet.')
