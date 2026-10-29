"""Export the selected TH04 showcase versions and a review sheet."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

root = Path(__file__).resolve().parents[1]
versions = {n: (3 if n == 4 else 2 if n in (2, 5) else 1) for n in range(1, 10)}
sheet = Image.new('RGB', (1200, 1590), '#111821')
draw = ImageDraw.Draw(sheet)
manifest = []
for index, (n, version) in enumerate(versions.items()):
    card_id = f'th04-{n:03}'
    source = root / f'art-originals/TH04/{card_id}-showcase-v{version}.png'
    target = root / f'public/cards/showcase/{card_id}-template-v{version}.webp'
    with Image.open(source) as image:
        if abs(image.width / image.height - .75) > .005:
            raise ValueError(f'Unexpected aspect ratio: {source}')
        image.save(target, quality=92, method=6)
        thumb = image.convert('RGB')
        thumb.thumbnail((370, 493))
        x, y = (index % 3) * 400 + 15, (index // 3) * 530 + 4
        sheet.paste(thumb, (x, y))
        draw.text((x + 110, y + 500), f'{card_id.upper()} / v{version}', fill='#e9d9ad')
    manifest.append({'id': card_id, 'version': version, 'original': str(source.relative_to(root)), 'web': str(target.relative_to(root))})
sheet.save(root / 'art-originals/TH04/th04-showcase-review.jpg', quality=92)
(root / 'art-originals/TH04/showcase-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f'Exported {len(manifest)} cards and review sheet.')
