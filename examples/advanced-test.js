// Advanced test file for AI analysis
// This file contains complex issues that static analysis can't detect

// 1. SQL Injection vulnerability - FIXED
async function getUserById(userId) {
  const query = 'SELECT * FROM users WHERE id = ?';
  return await database.query(query, [userId]);
}

// 2. Race condition in async code - FIXED
let accountBalance = 1000;
const balanceLock = new Map(); // Simple in-memory lock mechanism

async function withdraw(amount, accountId = 'default') {
  // Acquire lock for this account
  while (balanceLock.get(accountId)) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  balanceLock.set(accountId, true);
  
  try {
    const currentBalance = accountBalance;
    
    // Validate sufficient funds
    if (currentBalance < amount) {
      throw new Error('Insufficient funds');
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    accountBalance = currentBalance - amount;
    return accountBalance;
  } finally {
    // Always release lock
    balanceLock.delete(accountId);
  }
}

// Better approach using database transactions (commented example):
/*
async function withdrawWithDB(amount, accountId) {
  return await db.transaction(async (trx) => {
    const account = await trx.accounts.findOne({
      where: { id: accountId },
      lock: trx.LOCK.UPDATE // Row-level lock
    });
    
    if (account.balance < amount) {
      throw new Error('Insufficient funds');
    }
    
    account.balance -= amount;
    await account.save();
    return account.balance;
  });
}
*/

// 3. Memory leak - FIXED: Added cleanup method and stored bound references
class EventComponent {
  constructor() {
    // Store bound references so we can remove them later
    this.boundHandleResize = this.handleResize.bind(this);
    this.boundHandleScroll = this.handleScroll.bind(this);
    
    window.addEventListener('resize', this.boundHandleResize);
    document.addEventListener('scroll', this.boundHandleScroll);
  }
  
  handleResize() {}
  handleScroll() {}
  
  // Cleanup method to remove event listeners and prevent memory leaks
  destroy() {
    window.removeEventListener('resize', this.boundHandleResize);
    document.removeEventListener('scroll', this.boundHandleScroll);
  }
}

// 4. N+1 Query problem - FIXED: Using eager loading with JOIN
async function getUsersWithPosts() {
  // Option 1: Using ORM's include/join feature (preferred for most ORMs)
  const users = await db.users.findAll({
    include: ['posts'] // Eager load posts with a single JOIN query
  });
  
  return users;
}

// Alternative approach: Batch loading for ORMs without include support
async function getUsersWithPostsBatch() {
  // Fetch all users first
  const users = await db.users.findAll();
  
  // Extract all user IDs
  const userIds = users.map(u => u.id);
  
  // Fetch all posts for these users in a single query
  const posts = await db.posts.findByUserIds(userIds);
  
  // Create a map for efficient lookup
  const postsByUserId = posts.reduce((acc, post) => {
    if (!acc[post.userId]) {
      acc[post.userId] = [];
    }
    acc[post.userId].push(post);
    return acc;
  }, {});
  
  // Assign posts to their respective users
  users.forEach(user => {
    user.posts = postsByUserId[user.id] || [];
  });
  
  return users;
}

// 5. CSRF vulnerability - FIXED: Added authentication and authorization checks
app.post('/transfer-money', requireAuth, csrfProtection, async (req, res) => {
  try {
    // Verify user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { toAccount, amount } = req.body;
    
    // Additional validation can be added here
    if (!toAccount || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    await transferMoney(req.user.id, toAccount, amount);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Transfer failed' });
  }
});

// 6. XSS vulnerability - FIXED: Using textContent instead of innerHTML
function displayUserComment(comment) {
  // Use textContent to safely insert plain text without HTML interpretation
  // This prevents XSS attacks by treating all content as text, not HTML
  const commentsElement = document.getElementById('comments');
  const commentNode = document.createTextNode(comment);
  commentsElement.appendChild(commentNode);
  
  // Alternative: If you need to preserve line breaks, create a text node
  // or use textContent with proper formatting
  // commentsElement.textContent += comment;
}

// Alternative approach if HTML is needed (with sanitization):
/*
function displayUserCommentWithHTML(comment) {
  // If you need to allow some HTML, use a sanitization library like DOMPurify
  // npm install dompurify
  const cleanComment = DOMPurify.sanitize(comment, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  });
  document.getElementById('comments').innerHTML += cleanComment;
}
*/

// 7. Inefficient algorithm (O(n²))
function findDuplicates(array) {
  const duplicates = [];
  for (let i = 0; i < array.length; i++) {
    for (let j = i + 1; j < array.length; j++) {
      if (array[i] === array[j] && !duplicates.includes(array[i])) {
        duplicates.push(array[i]);
      }
    }
  }
  return duplicates;
}

// 8. Missing error handling - FIXED
async function fetchUserData(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`);
    
    // Check if the response was successful
    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    // Log the error for debugging purposes
    console.error('Error fetching user data:', error);
    
    // Re-throw the error so calling code can handle it appropriately
    throw error;
  }
}

// 9. Hardcoded sensitive data - FIXED: Using environment variables
const config = {
  apiKey: process.env.API_KEY,
  secretKey: process.env.SECRET_KEY,
  databasePassword: process.env.DB_PASSWORD
};

// Validate that required environment variables are set
if (!config.apiKey || !config.secretKey || !config.databasePassword) {
  throw new Error('Missing required environment variables: API_KEY, SECRET_KEY, or DB_PASSWORD');
}

// 10. Missing input validation - FIXED
async function updateUserEmail(email) {
  // Validate email format using regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Check if email exists and matches valid format
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required and must be a string');
  }
  
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
  
  // Additional security: Check email length to prevent DoS
  if (email.length > 254) {
    throw new Error('Email exceeds maximum length');
  }
  
  // Sanitize email by trimming and converting to lowercase
  const sanitizedEmail = email.trim().toLowerCase();
  
  user.email = sanitizedEmail;
  await database.save(user);
}

// 11. Improper error exposure - FIXED with input validation
app.get('/user/:id', async (req, res) => {
  try {
    // Validate and sanitize the user ID parameter
    const userId = parseInt(req.params.id, 10);
    
    // Check if the parsed value is a valid number
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Optional: Add additional validation for reasonable ID ranges
    if (userId < 1 || userId > Number.MAX_SAFE_INTEGER) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const user = await getUserById(userId);
    
    // Check if user was found
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    // Log detailed error information server-side for debugging
    console.error('Error fetching user:', error);
    // Return generic error message to client without exposing internal details
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 12. Timing attack vulnerability
function comparePasswords(input, stored) {
  if (input.length !== stored.length) return false;
  
  for (let i = 0; i < input.length; i++) {
    if (input[i] !== stored[i]) return false;
  }
  
  return true;
}

// 13. Missing rate limiting - FIXED
const rateLimit = require('express-rate-limit');

// Create rate limiter for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Optional: Skip successful requests from counting against the limit
  skipSuccessfulRequests: false,
  // Optional: Skip failed requests from counting against the limit
  skipFailedRequests: false
});

app.post('/login', loginLimiter, async (req, res) => {
  const user = await authenticate(req.body.username, req.body.password);
  if (user) {
    res.json({ token: generateToken(user) });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// 14. Uncontrolled resource consumption - FIXED
const multer = require('multer');

// Define allowed MIME types for file uploads
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/plain'
];

// Configure multer with security limits
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10, // Maximum 10 files per request
    fields: 20, // Maximum 20 non-file fields
    parts: 30 // Maximum 30 parts (files + fields)
  },
  fileFilter: (req, file, cb) => {
    // Validate file type
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`), false);
    }
  },
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      // Generate safe filename with timestamp to prevent collisions
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix);
    }
  })
});

app.post('/upload', upload.array('files'), (req, res) => {
  try {
    // Validate that files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    // Process each file
    req.files.forEach(file => {
      processFile(file);
    });
    
    res.json({ 
      success: true, 
      filesUploaded: req.files.length 
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Error handler for multer errors
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum 10 files allowed' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected field in upload' });
    }
    return res.status(400).json({ error: `Upload error: ${error.message}` });
  }
  next(error);
});

// 15. REMOVED: eval() usage - SECURITY CRITICAL
// The dangerous eval() statement has been completely removed.
// If you need to parse JSON data, use JSON.parse() instead:
// Example: const data = JSON.parse(jsonString);
//
// If you need dynamic function execution, use safer alternatives:
// - For configuration: Use object literals or JSON
// - For calculations: Use a safe expression parser library like 'expr-eval' or 'mathjs'
// - For templates: Use template literals or a templating engine
// - For plugins: Use a proper plugin system with defined interfaces
//
// Never use eval() with user input or untrusted data as it allows
// arbitrary code execution and can lead to severe security breaches.