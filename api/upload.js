const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const { requireAuth } = require('./middleware');
const { 
  processImage, 
  generateThumbnail, 
  saveImage, 
  generateUniqueFilename,
  validateImage 
} = require('./utils/imageProcessor');

// Configure multer for memory storage (we'll process images before saving)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPG, PNG, WebP'), false);
    }
  }
});

function uploadSingle(fieldName) {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (error) => {
      if (!error) {
        return next();
      }

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size: 5MB' });
        }
        return res.status(400).json({ error: error.message || 'Upload failed' });
      }

      return res.status(400).json({ error: error.message || 'Upload failed' });
    });
  };
}

/**
 * Upload cover image for release
 */
exports.uploadCover = [
  requireAuth,
  uploadSingle('cover'),
  async (req, res) => {
    try {
      // Validate file
      const validation = validateImage(req.file);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Process image (compress and convert to WebP)
      const processedImage = await processImage(req.file.buffer, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 85
      });

      // Generate unique filename
      const filename = generateUniqueFilename(req.file.originalname);
      const relativePath = `uploads/covers/${filename}`;
      const fullPath = path.join(__dirname, '..', 'public', relativePath);

      // Save processed image
      const savedImagePath = await saveImage(processedImage, fullPath);

      // Optionally generate thumbnail
      const thumbnail = await generateThumbnail(req.file.buffer, 300);
      const thumbFilename = `thumb_${filename}`;
      const thumbPath = path.join(__dirname, '..', 'public', 'uploads', 'covers', thumbFilename);
      const savedThumbnailPath = await saveImage(thumbnail, thumbPath);

      res.json({
        success: true,
        imagePath: savedImagePath,
        thumbnailPath: savedThumbnailPath,
        message: 'Cover image uploaded successfully'
      });
    } catch (error) {
      console.error('Cover upload error:', error);

      if (error && error.code === 'BLOB_STORAGE_NOT_CONFIGURED') {
        return res.status(503).json({
          error: 'Image storage is not configured. Upload is temporarily unavailable.'
        });
      }

      res.status(500).json({ 
        error: 'Failed to upload cover image',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
];

/**
 * Upload artist image
 */
exports.uploadArtistImage = [
  requireAuth,
  uploadSingle('image'),
  async (req, res) => {
    try {
      // Validate file
      const validation = validateImage(req.file);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Process image (square crop for artist images)
      const processedImage = await sharp(req.file.buffer)
        .resize(800, 800, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 85 })
        .toBuffer();

      // Generate unique filename
      const filename = generateUniqueFilename(req.file.originalname);
      const relativePath = `uploads/artists/${filename}`;
      const fullPath = path.join(__dirname, '..', 'public', relativePath);

      // Save processed image
      const savedImagePath = await saveImage(processedImage, fullPath);

      res.json({
        success: true,
        imagePath: savedImagePath,
        message: 'Artist image uploaded successfully'
      });
    } catch (error) {
      console.error('Artist image upload error:', error);

      if (error && error.code === 'BLOB_STORAGE_NOT_CONFIGURED') {
        return res.status(503).json({
          error: 'Image storage is not configured. Upload is temporarily unavailable.'
        });
      }

      res.status(500).json({ 
        error: 'Failed to upload artist image',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
];

/**
 * Upload user avatar
 */
exports.uploadAvatar = [
  requireAuth,
  uploadSingle('avatar'),
  async (req, res) => {
    try {
      const { query } = require('./db');

      const rawTargetUserId = typeof req.query.userId === 'string'
        ? req.query.userId.trim()
        : '';

      let targetUserId = req.user.id;
      if (rawTargetUserId) {
        const parsedTargetUserId = Number.parseInt(rawTargetUserId, 10);
        if (!Number.isInteger(parsedTargetUserId) || parsedTargetUserId <= 0) {
          return res.status(400).json({ error: 'Invalid target user ID' });
        }

        if (req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required to update other users avatar' });
        }

        targetUserId = parsedTargetUserId;
      }
      
      // Validate file
      const validation = validateImage(req.file);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Process image (square crop for avatars)
      const processedImage = await sharp(req.file.buffer)
        .resize(400, 400, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 85 })
        .toBuffer();

      // Generate unique filename
      const filename = generateUniqueFilename(req.file.originalname);
      const relativePath = `uploads/avatars/${filename}`;
      const fullPath = path.join(__dirname, '..', 'public', relativePath);

      // Save processed image
      const savedAvatarPath = await saveImage(processedImage, fullPath);

      // Update user's avatar in database (handle missing column gracefully)
      try {
        const updateResult = await query(
          'UPDATE users SET avatar = $1 WHERE id = $2 RETURNING id',
          [savedAvatarPath, targetUserId]
        );

        if (updateResult.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
      } catch (dbError) {
        // If avatar column doesn't exist, log warning but don't fail
        if (dbError.message && dbError.message.includes('column "avatar"')) {
          console.warn('Avatar column not found in users table');
        } else {
          throw dbError;
        }
      }

      res.json({
        success: true,
        avatarPath: savedAvatarPath,
        userId: targetUserId,
        message: 'Avatar uploaded successfully'
      });
    } catch (error) {
      console.error('Avatar upload error:', error);

      if (error && error.code === 'BLOB_STORAGE_NOT_CONFIGURED') {
        return res.status(503).json({
          error: 'Image storage is not configured. Upload is temporarily unavailable.'
        });
      }

      res.status(500).json({ 
        error: 'Failed to upload avatar',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
];
