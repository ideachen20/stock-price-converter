"""Generate icons for Stock Price Converter Chrome Extension"""
from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, output_path):
    """建立通用股價轉換器圖示"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 背景 - 綠色漸層效果（保持投資/股票主題）
    for y in range(size):
        ratio = y / size
        r = int(118 * (1 - ratio) + 13 * ratio)
        g = int(185 * (1 - ratio) + 26 * ratio)
        b = int(0 * (1 - ratio) + 46 * ratio)
        for x in range(size):
            cx, cy = size // 2, size // 2
            radius = size // 2 - 1
            if (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2:
                draw.point((x, y), fill=(r, g, b, 255))
    
    # 繪製 "$↗" 符號（通用股票轉換概念）
    font_size = size // 3
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size // 2)
    except:
        font = ImageFont.load_default()
        small_font = font
    
    # 繪製 "$" 和箭頭
    text = "$"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size - text_width) // 2 - size // 8
    y = (size - text_height) // 2 - size // 10
    
    # 文字陰影
    draw.text((x + 1, y + 1), text, fill=(0, 0, 0, 128), font=font)
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)
    
    # 繪製上升箭頭
    arrow = "↗"
    bbox_a = draw.textbbox((0, 0), arrow, font=font)
    aw = bbox_a[2] - bbox_a[0]
    ax = x + text_width + size // 20
    ay = y - size // 10
    draw.text((ax + 1, ay + 1), arrow, fill=(0, 0, 0, 128), font=font)
    draw.text((ax, ay), arrow, fill=(165, 255, 0, 255), font=font)
    
    # 底部小文字 "STOCK"
    small_text = "STOCK"
    bbox2 = draw.textbbox((0, 0), small_text, font=small_font)
    sw = bbox2[2] - bbox2[0]
    sx = (size - sw) // 2
    sy = y + text_height + size // 10
    draw.text((sx, sy), small_text, fill=(255, 255, 255, 200), font=small_font)
    
    img.save(output_path, 'PNG')
    print(f"Generated: {output_path} ({size}x{size})")

# 生成各尺寸圖示
icons_dir = '/home/ubuntu/nvidia-price-converter/icons'
os.makedirs(icons_dir, exist_ok=True)

for size in [16, 48, 128]:
    create_icon(size, os.path.join(icons_dir, f'icon{size}.png'))

print("All icons generated!")
