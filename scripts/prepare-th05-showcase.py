"""Export selected TH05 originals and build a review sheet."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

root = Path(__file__).resolve().parents[1]
versions = {1: 1, 2: 1, 3: 2, 4: 4, 5: 4, 6: 1, 7: 1, 8: 1}
sheet = Image.new('RGB', (1200, 1590), '#111821')
draw = ImageDraw.Draw(sheet)
manifest = []
for index, (n, version) in enumerate(versions.items()):
    card_id = f'th05-{n:03}'
    source = root / f'art-originals/TH05/{card_id}-showcase-v{version}.png'
    target = root / f'public/cards/showcase/{card_id}-template-v{version}.webp'
    with Image.open(source) as im:
        if abs(im.width / im.height - .75) > .005:
            raise ValueError(f'Unexpected ratio: {source}')
        im.save(target, quality=92, method=6)
        thumb = im.convert('RGB')
        thumb.thumbnail((370, 493))
        x, y = (index % 3) * 400 + 15, (index // 3) * 530 + 4
        sheet.paste(thumb, (x, y))
        draw.text((x + 110, y + 500), f'{card_id.upper()} / v{version}', fill='#e9d9ad')
    manifest.append({'id': card_id, 'version': version, 'original': str(source.relative_to(root)), 'web': str(target.relative_to(root))})
sheet.save(root / 'art-originals/TH05/th05-showcase-review.jpg', quality=92)
(root / 'art-originals/TH05/showcase-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f'Exported {len(manifest)} cards and review sheet.')
