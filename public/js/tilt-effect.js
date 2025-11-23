// 3D Tilt effect with inner glow for monthly release cards
// Replaces Balatro effect with smooth parallax tilt

export function initTiltEffect() {
  const cards = document.querySelectorAll('.release-card:not(.release-card-placeholder)');
  
  cards.forEach(card => {
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    let isHovering = false;
    let animationFrame = null;
    
    // Get tier color for glow effect
    const tier = card.dataset.tier || 'other';
    const tierColors = {
      gold: '#E3D323',
      silver: '#C0C0C0',
      bronze: '#CD7F32',
      other: '#666'
    };
    const glowColor = tierColors[tier] || '#666';
    
    // Animation constants
    const maxTilt = 8; // Maximum tilt angle in degrees
    const tiltSensitivity = 0.15; // How sensitive the tilt is
    const easing = 0.15; // Easing factor for smooth animation
    const scaleAmount = 1.02; // Slight scale on hover
    
    // Easing function
    function lerp(start, end, factor) {
      return start + (end - start) * factor;
    }
    
    // Animation loop
    function animate() {
      // Smooth interpolation
      currentX = lerp(currentX, targetX, easing);
      currentY = lerp(currentY, targetY, easing);
      
      // Calculate rotation angles
      const rotateX = -currentY * maxTilt;
      const rotateY = currentX * maxTilt;
      
      // Apply transform with 3D rotation and scale
      const scale = isHovering ? scaleAmount : 1;
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
      
      // Apply inner glow effect
      if (isHovering) {
        const intensity = Math.min(Math.abs(currentX) + Math.abs(currentY), 1);
        const alpha = Math.floor(intensity * 60 + 20).toString(16).padStart(2, '0');
        card.style.boxShadow = `inset 0 0 40px ${glowColor}${alpha}`;
      } else {
        card.style.boxShadow = '';
      }
      
      // Continue animation if moving or hovering
      if (Math.abs(targetX - currentX) > 0.01 || Math.abs(targetY - currentY) > 0.01 || isHovering) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        // Reset when stopped
        currentX = 0;
        currentY = 0;
        targetX = 0;
        targetY = 0;
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
        card.style.boxShadow = '';
        animationFrame = null;
      }
    }
    
    // Mouse move handler
    function handleMouseMove(e) {
      if (!isHovering) return;
      
      const rect = card.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2;
      const cardCenterY = rect.top + rect.height / 2;
      
      // Calculate mouse position relative to card center (-1 to 1)
      const mouseX = (e.clientX - cardCenterX) / (rect.width / 2);
      const mouseY = (e.clientY - cardCenterY) / (rect.height / 2);
      
      // Set target position with sensitivity
      targetX = mouseX * tiltSensitivity;
      targetY = mouseY * tiltSensitivity;
      
      // Clamp values
      targetX = Math.max(-1, Math.min(1, targetX));
      targetY = Math.max(-1, Math.min(1, targetY));
      
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

