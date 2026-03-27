import cv2, sys, numpy as np
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
    
    # Deskewing logic
    # Thresholding to facilitate deskewing
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    # Swapping (y, x) to (x, y) for OpenCV functions
    coords = np.column_stack(np.where(binary > 0))
    if len(coords) > 0:
        # Important: np.where returns (y, x), OpenCV expects (x, y)
        coords = coords[:, ::-1] 
        
        rect = cv2.minAreaRect(coords)
        angle = rect[-1]
        
        # Modern OpenCV angle logic (v4.5+)
        # The angle returned is in [0, 90]
        if angle > 45:
            angle = angle - 90
            
        # Limit deskewing to small angles to avoid rotating landscape to portrait
        if abs(angle) > 20: 
            angle = 0
    else:
        angle = 0
        
    (h, w) = gray.shape
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    
    # 1. Enhance Contrast using CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(rotated)

    # 2. Edge-preserving Denoising (Bilateral Filter)
    denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)

    # 3. Adaptive Thresholding - Tweak parameters for cleaner text
    thresh = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY, 15, 5 # slightly higher block size and C
    )
    
    # 4. Filter small noise blobs (New step)
    # Tesseract "Image too small" often happens from tiny disconnected specks
    contours, _ = cv2.findContours(cv2.bitwise_not(thresh), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    clean_mask = np.ones(thresh.shape, dtype=np.uint8) * 255
    
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        # If the blob is extremely small (noise), fill it with white in the inverted image
        if w < 2 or h < 2 or (w * h) < 4:
            continue
        # Otherwise, keep it in our clean version
        cv2.drawContours(clean_mask, [cnt], -1, 0, -1)
    
    # Final result is already binarized and cleaned
    cv2.imwrite(output_path, clean_mask)
    print(f"Pre-processed image saved to {output_path}")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 preprocess.py <input_path> <output_path>")
        sys.exit(1)
    preprocess(sys.argv[1], sys.argv[2])
