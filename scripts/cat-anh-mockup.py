# Cắt khoảng trắng thừa ở chân ảnh mockup (ảnh chụp khung cao 4200px).
# Dò từ dưới lên, dòng cuối cùng còn nội dung trong vùng giữa trang (bỏ menu trái) là chân trang.
# Chạy: python -I scripts/cat-anh-mockup.py <ảnh.png>
import sys
from PIL import Image

NEN = {(255, 255, 255), (249, 250, 251), (243, 244, 246)}  # trắng, bg-gray-50, bg-gray-100
p = sys.argv[1]
im = Image.open(p).convert('RGB')
w, h = im.size
px = im.load()
cuoi = 0
for y in range(h - 1, -1, -1):
    if any(px[x, y] not in NEN for x in range(280, w - 20, 3)):
        cuoi = y
        break
cao = min(h, max(900, cuoi + 28))
im.crop((0, 0, w, cao)).save(p)
print(f'{p}: {cao}px')
