// Balatro-style card jiggle effect
// Cards slightly follow the cursor with inertia and smoothly return to position

export function initBalatroEffect() {
  const cards = document.querySelectorAll('.release-card:not(.release-card-placeholder)');
  
  cards.forEach(card => {
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let isHovering = false;
    let animationFrame = null;
    
    // Spring physics constants
    const stiffness = 0.12; // How quickly it follows (lower = more lag)
    const damping = 0.85; // How quickly it stops (inertia, higher = more inertia)
    const maxOffset = 6; // Maximum offset in pixels
    
    // Get card center position
    function getCardCenter() {
      const rect = card.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    }
    
    // Easing function (ease-out)
    function easeOut(t) {
      return 1 - Math.pow(1 - t, 3);
    }
    
    // Animation loop
    function animate() {
      // Calculate distance to target
      const dx = targetX - currentX;
      const dy = targetY - currentY;
      
      // Apply spring physics
      velocityX += dx * stiffness;
      velocityY += dy * stiffness;
      
      // Apply damping (inertia)
      velocityX *= damping;
      velocityY *= damping;
      
      // Update position
      currentX += velocityX;
      currentY += velocityY;
      
      // Apply transform
      card.style.transform = `translate(${currentX}px, ${currentY}px)`;
      
      // Continue animation if moving or hovering
      if (Math.abs(velocityX) > 0.01 || Math.abs(velocityY) > 0.01 || isHovering) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        // Reset to zero when stopped
        currentX = 0;
        currentY = 0;
        velocityX = 0;
        velocityY = 0;
        card.style.transform = 'translate(0, 0)';
        animationFrame = null;
      }
    }
    
    // Mouse move handler
    function handleMouseMove(e) {
      if (!isHovering) return;
      
      const cardCenter = getCardCenter();
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      
      // Calculate offset from center
      const offsetX = (mouseX - cardCenter.x) * 0.12; // Scale factor for subtle movement
      const offsetY = (mouseY - cardCenter.y) * 0.12;
      
      // Clamp to max offset
      targetX = Math.max(-maxOffset, Math.min(maxOffset, offsetX));
      targetY = Math.max(-maxOffset, Math.min(maxOffset, offsetY));
      
      // Start animation if not already running
      if (!animationFrame) {
        animationFrame = requestAnimationFrame(animate);
      }
    }
    
    // Mouse enter handler
    function handleMouseEnter(e) {
      isHovering = true;
      handleMouseMove(e);
    }
    
    // Mouse leave handler
    function handleMouseLeave() {
      isHovering = false;
      targetX = 0;
      targetY = 0;
      
      // Start animation to return to center if not already running
      if (!animationFrame) {
        animationFrame = requestAnimationFrame(animate);
      }
    }
    
    // Attach event listeners
    card.addEventListener('mouseenter', handleMouseEnter);
    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);
  });
}

