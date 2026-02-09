from PIL import Image, ImageDraw, ImageFont
import json, os
slides = json.load(open('docs/slides_content.json','r',encoding='utf-8'))
os.makedirs('docs/slides', exist_ok=True)
# Try to choose a common font
try:
    font_title = ImageFont.truetype('arial.ttf', 54)
    font_sub = ImageFont.truetype('arial.ttf', 28)
    font_bullet = ImageFont.truetype('arial.ttf', 26)
except Exception:
    font_title = ImageFont.load_default()
    font_sub = ImageFont.load_default()
    font_bullet = ImageFont.load_default()

for i,s in enumerate(slides):
    img = Image.new('RGB', (1280,720), color=(12,26,37))
    d = ImageDraw.Draw(img)
    # Title
    d.text((60,60), s.get('title',''), font=font_title, fill=(14,165,233))
    if s.get('subtitle'):
        d.text((60,140), s.get('subtitle'), font=font_sub, fill=(200,220,230))
    y = 240
    for b in s.get('bullets',[]):
        d.text((100,y), '• '+b, font=font_bullet, fill=(220,230,240))
        y += 46
    # small footer
    d.text((60,660), 'RishFlow — File Organizer • demo', font=font_bullet, fill=(120,140,150))
    path = f'docs/slides/slide_{i+1:02d}.png'
    img.save(path)
    print('Created', path)
