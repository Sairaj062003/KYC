# backend/src/scripts/preprocess.py
import cv2, sys, numpy as np
from PIL import Image
import os

def preprocess(input_path, output_path):
    if not os.path.exists(input_path):
        print(f"Error: Input file {input_path} not found")
        sys.exit(1)
        
    img = cv2.imread(input_path)
    if img is None:
        print(f"Error: Failed to read image {input_path}")
        sys.exit(1)
        
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Deskew using Hough transform logic (simplified from user snippet but improved)
    # Thresholding to facilitate deskewing
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(binary > 0))
    
    if len(coords) > 0:
        angle = cv2.minAreaRect(coords)[-1]
        # Correct angle calculation
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
    else:
        angle = 0
        
    (h, w) = gray.shape
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    
    # Denoise
    denoised = cv2.fastNlMeansDenoising(rotated, h=10)
    
    # Final threshold for OCR
    _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    cv2.imwrite(output_path, thresh)
    print(f"Pre-processed image saved to {output_path}")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 preprocess.py <input_path> <output_path>")
        sys.exit(1)
    preprocess(sys.argv[1], sys.argv[2])
