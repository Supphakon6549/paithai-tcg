from PIL import Image
from pathlib import Path
import shutil
root = Path(__file__).resolve().parents[1]
source = Path('D:/User/user/.codex/generated_images/01a14a1d-205a-7e13-b685-19e8c0d7d460/exec-eec9c7a3-8cd1-48bf-91be-dd233968eae4.png')
original = root / 'art-originals/shared/showcase-frame-v1.png'
original.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(source, original)
im = Image.open(source).convert('RGBA')
print(im.size, im.getpixel((im.width//2, im.height//3)))
im.save(root / 'public/cards/showcase/shared-frame-v1.webp', quality=90, method=6)
