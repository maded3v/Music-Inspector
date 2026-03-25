const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { put } = require('@vercel/blob');

/**
 * Process and compress image
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {Object} options - Processing options
 * @returns {Promise<Buffer>} - Processed image buffer
 */
async function processImage(imageBuffer, options = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 85,
    format = 'webp'
  } = options;

  try {
    const processed = await sharp(imageBuffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality })
      .toBuffer();

    return processed;
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error('Failed to process image');
  }
}

/**
 * Generate thumbnail from image
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {number} size - Thumbnail size (square)
 * @returns {Promise<Buffer>} - Thumbnail buffer
 */
async function generateThumbnail(imageBuffer, size = 300) {
  try {
    const thumbnail = await sharp(imageBuffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 80 })
      .toBuffer();

    return thumbnail;
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    throw new Error('Failed to generate thumbnail');
  }
}

/**
 * Save image to disk
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} filePath - Full file path
 * @returns {Promise<string>} - Saved file path
 */
async function saveImage(imageBuffer, filePath) {
  const blobTokenConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (blobTokenConfigured) {
    try {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const publicIndex = normalizedPath.lastIndexOf('/public/');
      const blobPath = publicIndex >= 0
        ? normalizedPath.substring(publicIndex + '/public/'.length)
        : normalizedPath.replace(/^\/+/, '');

      const uploaded = await put(blobPath, imageBuffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'image/webp'
      });

      return uploaded.url;
    } catch (error) {
      console.error('Blob upload error:', error);
      throw new Error('Failed to upload image to blob storage');
    }
  }

  try {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, imageBuffer);

    const normalizedPath = filePath.replace(/\\/g, '/');
    const publicIndex = normalizedPath.lastIndexOf('/public/');
    if (publicIndex >= 0) {
      return normalizedPath.substring(publicIndex + '/public/'.length);
    }

    return path.basename(filePath);
  } catch (error) {
    console.error('Image save error:', error);
    throw new Error('Failed to save image');
  }
}

/**
 * Generate unique filename
 * @param {string} originalName - Original filename
 * @returns {string} - Unique filename with UUID
 */
function generateUniqueFilename(originalName) {
  const { randomUUID } = require('crypto');
  const ext = path.extname(originalName) || '.webp';
  return `${randomUUID()}${ext}`;
}

/**
 * Validate image file
 * @param {Object} file - Multer file object
 * @returns {Object} - Validation result
 */
function validateImage(file) {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: 'Invalid file type. Allowed: JPG, PNG, WebP' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Maximum size: 5MB' };
  }

  return { valid: true };
}

module.exports = {
  processImage,
  generateThumbnail,
  saveImage,
  generateUniqueFilename,
  validateImage
};











