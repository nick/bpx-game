// Game configuration
const GAME_WIDTH = 800;
const GAME_HEIGHT = 500;
const PLAYER_SIZE = 48;
const ICON_SIZE = 32;
const COLLECT_DISTANCE = 30;

// Grid configuration for icon placement
const GRID_COLS = 8;
const GRID_ROWS = 5;
const GRID_OFFSET_X = 60;
const GRID_OFFSET_Y = 50;
const CELL_WIDTH = (GAME_WIDTH - GRID_OFFSET_X * 2) / (GRID_COLS - 1);
const CELL_HEIGHT = (GAME_HEIGHT - GRID_OFFSET_Y * 2) / (GRID_ROWS - 1);

// Lucide icons to use (matching the image)
const ICON_TYPES = [
    'lock', 'diamond', 'coffee', 'gift', 'shopping-cart', 'plane',
    'utensils', 'music', 'heart', 'star', 'key', 'home', 'car',
    'ticket', 'gamepad-2', 'shopping-bag', 'credit-card', 'smartphone',
    'headphones', 'pizza', 'book-open', 'camera', 'palette', 'dumbbell'
];

// Movement speeds (pixels per frame)
const PLAYER_SPEED = 3;
const BADDIE_SPEED = 2;

// Baddie configuration
const BADDIE_SIZE = 40;
const NUM_BADDIES = 2;

// Game state
let player = {
    gridCol: 0,  // Current grid column
    gridRow: 0,  // Current grid row
    x: 0,        // Pixel x position
    y: 0,        // Pixel y position
    moving: false,
    targetCol: 0,
    targetRow: 0,
    direction: 'right' // Current facing direction
};
let icons = [];
let baddies = [];
let score = 0;
let keysPressed = {};
let lastKeyTime = 0;
let gameLoop;
let gameWon = false;
let gameOver = false;

// Card center position (grid coordinates)
const CARD_CENTER_COL = Math.floor(GRID_COLS / 2);
const CARD_CENTER_ROW = Math.floor(GRID_ROWS / 2);

// Get pixel position from grid coordinates
function gridToPixel(col, row) {
    return {
        x: GRID_OFFSET_X + col * CELL_WIDTH,
        y: GRID_OFFSET_Y + row * CELL_HEIGHT
    };
}

// Check if a grid position is blocked by the card
function isBlockedByCard(col, row) {
    // Card occupies positions around center
    return (col >= CARD_CENTER_COL - 1 && col <= CARD_CENTER_COL + 1) &&
           (row === CARD_CENTER_ROW);
}

// Check if a grid position is valid (within bounds and not blocked)
function isValidPosition(col, row) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) {
        return false;
    }
    if (isBlockedByCard(col, row)) {
        return false;
    }
    return true;
}

// Initialize the game
function init() {
    // Start player at top-left grid position
    player.gridCol = 0;
    player.gridRow = 0;
    player.targetCol = 0;
    player.targetRow = 0;
    player.direction = 'right';
    const startPos = gridToPixel(0, 0);
    player.x = startPos.x;
    player.y = startPos.y;

    updatePlayerPosition();
    setPlayerDirection('right');
    createGrid();
    createPaths();
    createBaddies();
    setupControls();
    lucide.createIcons();
    startGameLoop();
    startBaddieMovement();
}

// Update player DOM position
function updatePlayerPosition() {
    const playerEl = document.getElementById('player');
    playerEl.style.left = (player.x - PLAYER_SIZE / 2) + 'px';
    playerEl.style.top = (player.y - PLAYER_SIZE / 2) + 'px';
}

// Create the grid of icons
function createGrid() {
    const iconsLayer = document.getElementById('icons-layer');
    iconsLayer.innerHTML = '';
    icons = [];

    // Create a shuffled list of icon types
    let shuffledIcons = [...ICON_TYPES];
    shuffleArray(shuffledIcons);

    let iconIndex = 0;

    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            // Skip positions blocked by the card
            if (isBlockedByCard(col, row)) {
                continue;
            }

            // Skip starting position
            if (col === 0 && row === 0) {
                continue;
            }

            const pos = gridToPixel(col, row);

            const iconType = shuffledIcons[iconIndex % shuffledIcons.length];
            iconIndex++;

            const iconData = {
                x: pos.x,
                y: pos.y,
                col: col,
                row: row,
                type: iconType,
                collected: false,
                element: null
            };

            const iconEl = document.createElement('div');
            iconEl.className = 'icon-item';
            iconEl.dataset.type = iconType;
            iconEl.style.left = (pos.x - ICON_SIZE / 2) + 'px';
            iconEl.style.top = (pos.y - ICON_SIZE / 2) + 'px';
            iconEl.innerHTML = `<i data-lucide="${iconType}"></i>`;

            iconsLayer.appendChild(iconEl);
            iconData.element = iconEl;
            icons.push(iconData);
        }
    }
}

// Create baddies (bears) that follow the player
function createBaddies() {
    const gameArea = document.getElementById('game-area');

    // Remove existing baddies
    baddies.forEach(baddie => {
        if (baddie.element) baddie.element.remove();
    });
    baddies = [];

    // Find valid spawn positions (far from player)
    const validPositions = [];
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            if (!isBlockedByCard(col, row) && !(col === 0 && row === 0)) {
                // Prefer positions far from player start
                const dist = Math.abs(col) + Math.abs(row);
                if (dist >= 4) {
                    validPositions.push({ col, row });
                }
            }
        }
    }

    shuffleArray(validPositions);

    for (let i = 0; i < NUM_BADDIES && i < validPositions.length; i++) {
        const pos = validPositions[i];
        const pixelPos = gridToPixel(pos.col, pos.row);

        const baddie = {
            gridCol: pos.col,
            gridRow: pos.row,
            x: pixelPos.x,
            y: pixelPos.y,
            targetCol: pos.col,
            targetRow: pos.row,
            moving: false,
            element: null
        };

        const baddieEl = document.createElement('div');
        baddieEl.className = 'baddie';
        baddieEl.textContent = '🐻';
        baddieEl.style.left = (pixelPos.x - BADDIE_SIZE / 2) + 'px';
        baddieEl.style.top = (pixelPos.y - BADDIE_SIZE / 2) + 'px';

        gameArea.appendChild(baddieEl);
        baddie.element = baddieEl;
        baddies.push(baddie);
    }
}

// Start baddie movement (no longer uses interval)
function startBaddieMovement() {
    // Baddies now move continuously in the game loop
}

// Choose next target for a baddie
function chooseBaddieTarget(baddie) {
    // Calculate direction to player
    const dx = player.gridCol - baddie.gridCol;
    const dy = player.gridRow - baddie.gridRow;

    // Possible moves towards player
    const moves = [];
    if (dx > 0 && isValidBaddiePosition(baddie.gridCol + 1, baddie.gridRow, baddie)) {
        moves.push({ col: baddie.gridCol + 1, row: baddie.gridRow, priority: Math.abs(dx) });
    }
    if (dx < 0 && isValidBaddiePosition(baddie.gridCol - 1, baddie.gridRow, baddie)) {
        moves.push({ col: baddie.gridCol - 1, row: baddie.gridRow, priority: Math.abs(dx) });
    }
    if (dy > 0 && isValidBaddiePosition(baddie.gridCol, baddie.gridRow + 1, baddie)) {
        moves.push({ col: baddie.gridCol, row: baddie.gridRow + 1, priority: Math.abs(dy) });
    }
    if (dy < 0 && isValidBaddiePosition(baddie.gridCol, baddie.gridRow - 1, baddie)) {
        moves.push({ col: baddie.gridCol, row: baddie.gridRow - 1, priority: Math.abs(dy) });
    }

    if (moves.length > 0) {
        // Sort by priority (prefer the axis with greater distance)
        moves.sort((a, b) => b.priority - a.priority);
        // Add some randomness
        const move = Math.random() < 0.7 ? moves[0] : moves[Math.floor(Math.random() * moves.length)];

        baddie.targetCol = move.col;
        baddie.targetRow = move.row;
        baddie.moving = true;
    }
}

// Check if position is valid for baddie (not blocked, within bounds, not occupied by another baddie)
function isValidBaddiePosition(col, row, currentBaddie) {
    if (!isValidPosition(col, row)) {
        return false;
    }
    // Check if another baddie is at or moving to this position
    for (const baddie of baddies) {
        if (baddie === currentBaddie) continue;
        if ((baddie.gridCol === col && baddie.gridRow === row) ||
            (baddie.targetCol === col && baddie.targetRow === row)) {
            return false;
        }
    }
    return true;
}

// Update baddie position (called in game loop)
function updateBaddies() {
    baddies.forEach(baddie => {
        // If not moving, choose a new target
        if (!baddie.moving) {
            chooseBaddieTarget(baddie);
        }

        if (baddie.moving) {
            const target = gridToPixel(baddie.targetCol, baddie.targetRow);
            const dx = target.x - baddie.x;
            const dy = target.y - baddie.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < BADDIE_SPEED) {
                // Arrived at target
                baddie.x = target.x;
                baddie.y = target.y;
                baddie.gridCol = baddie.targetCol;
                baddie.gridRow = baddie.targetRow;
                baddie.moving = false;
            } else {
                // Move towards target at constant speed
                baddie.x += (dx / distance) * BADDIE_SPEED;
                baddie.y += (dy / distance) * BADDIE_SPEED;
            }

            baddie.element.style.left = (baddie.x - BADDIE_SIZE / 2) + 'px';
            baddie.element.style.top = (baddie.y - BADDIE_SIZE / 2) + 'px';
        }
    });
}

// Check if player collides with baddie (using pixel distance for smooth collision)
function checkBaddieCollision() {
    const collisionDistance = 25; // pixels
    for (const baddie of baddies) {
        const dx = baddie.x - player.x;
        const dy = baddie.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < collisionDistance) {
            return true;
        }
    }
    return false;
}

// Create connecting paths between icons
function createPaths() {
    const pathsLayer = document.getElementById('paths-layer');

    let svgContent = `<svg viewBox="0 0 ${GAME_WIDTH} ${GAME_HEIGHT}" xmlns="http://www.w3.org/2000/svg">`;

    // Horizontal paths
    for (let row = 0; row < GRID_ROWS; row++) {
        const y = GRID_OFFSET_Y + row * CELL_HEIGHT;
        svgContent += `<line class="path-line" x1="${GRID_OFFSET_X}" y1="${y}" x2="${GAME_WIDTH - GRID_OFFSET_X}" y2="${y}"/>`;
    }

    // Vertical paths
    for (let col = 0; col < GRID_COLS; col++) {
        const x = GRID_OFFSET_X + col * CELL_WIDTH;
        svgContent += `<line class="path-line" x1="${x}" y1="${GRID_OFFSET_Y}" x2="${x}" y2="${GAME_HEIGHT - GRID_OFFSET_Y}"/>`;
    }

    svgContent += '</svg>';
    pathsLayer.innerHTML = svgContent;
}

// Setup keyboard controls
function setupControls() {
    document.addEventListener('keydown', (e) => {
        const key = e.key;
        const keyLower = key.toLowerCase();
        keysPressed[keyLower] = true;

        // Prevent scrolling with arrow keys
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(keyLower)) {
            e.preventDefault();
        }

        // Highlight direction keys
        highlightKey(keyLower, true);

        // Handle grid movement on keydown
        handleMovement(keyLower);
    });

    document.addEventListener('keyup', (e) => {
        const keyLower = e.key.toLowerCase();
        keysPressed[keyLower] = false;
        highlightKey(keyLower, false);
    });
}

// Highlight keyboard keys in the instructions
function highlightKey(key, active) {
    let direction = null;
    if (key === 'arrowup' || key === 'w') direction = 'up';
    else if (key === 'arrowdown' || key === 's') direction = 'down';
    else if (key === 'arrowleft' || key === 'a') direction = 'left';
    else if (key === 'arrowright' || key === 'd') direction = 'right';

    if (direction) {
        const keys = document.querySelectorAll(`kbd[data-key="${direction}"]`);
        keys.forEach(kbd => {
            if (active) {
                kbd.classList.add('active');
            } else {
                kbd.classList.remove('active');
            }
        });
    }
}

// Handle movement input - move one grid cell at a time
function handleMovement(key) {
    if (player.moving) return;

    let newCol = player.gridCol;
    let newRow = player.gridRow;
    let newDirection = player.direction;

    if (key === 'arrowup' || key === 'w') {
        newRow--;
        newDirection = 'up';
    } else if (key === 'arrowdown' || key === 's') {
        newRow++;
        newDirection = 'down';
    } else if (key === 'arrowleft' || key === 'a') {
        newCol--;
        newDirection = 'left';
    } else if (key === 'arrowright' || key === 'd') {
        newCol++;
        newDirection = 'right';
    } else {
        return;
    }

    // Update direction even if we can't move
    setPlayerDirection(newDirection);

    // Check if new position is valid
    if (isValidPosition(newCol, newRow)) {
        player.targetCol = newCol;
        player.targetRow = newRow;
        player.moving = true;
        setPlayerMoving(true);
    }
}

// Update player direction class
function setPlayerDirection(direction) {
    const playerEl = document.getElementById('player');
    player.direction = direction;

    // Remove all direction classes
    playerEl.classList.remove('dir-up', 'dir-down', 'dir-left', 'dir-right');
    // Add new direction class
    playerEl.classList.add('dir-' + direction);
}

// Update player moving state
function setPlayerMoving(moving) {
    const playerEl = document.getElementById('player');
    if (moving) {
        playerEl.classList.add('moving');
    } else {
        playerEl.classList.remove('moving');
    }
}

// Game loop
function startGameLoop() {
    gameLoop = setInterval(() => {
        if (!gameWon) {
            update();
        }
    }, 1000 / 60);
}

// Update game state
function update() {
    if (gameOver) return;

    // Animate player movement
    if (player.moving) {
        const target = gridToPixel(player.targetCol, player.targetRow);
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < PLAYER_SPEED) {
            // Arrived at target
            player.x = target.x;
            player.y = target.y;
            player.gridCol = player.targetCol;
            player.gridRow = player.targetRow;
            player.moving = false;
            setPlayerMoving(false);

            // Check for continued movement if key still held
            if (keysPressed['arrowup'] || keysPressed['w']) {
                handleMovement('arrowup');
            } else if (keysPressed['arrowdown'] || keysPressed['s']) {
                handleMovement('arrowdown');
            } else if (keysPressed['arrowleft'] || keysPressed['a']) {
                handleMovement('arrowleft');
            } else if (keysPressed['arrowright'] || keysPressed['d']) {
                handleMovement('arrowright');
            }
        } else {
            // Move towards target at constant speed
            player.x += (dx / distance) * PLAYER_SPEED;
            player.y += (dy / distance) * PLAYER_SPEED;
        }

        updatePlayerPosition();
    }

    // Update baddies
    updateBaddies();

    // Check collision with baddies
    if (checkBaddieCollision()) {
        loseGame();
        return;
    }

    // Check collisions with icons
    checkCollisions();

    // Check win condition
    if (icons.length > 0 && icons.every(icon => icon.collected)) {
        winGame();
    }
}

// Check collisions between player and icons
function checkCollisions() {
    icons.forEach(icon => {
        if (icon.collected) return;

        // Check if player is at the same grid position
        if (player.gridCol === icon.col && player.gridRow === icon.row) {
            collectIcon(icon);
        }
    });
}

// Collect an icon
function collectIcon(icon) {
    icon.collected = true;
    icon.element.classList.add('collected');
    score += 10;
    updateScore();

    // Remove element after animation
    setTimeout(() => {
        icon.element.remove();
    }, 400);
}

// Update score display
function updateScore() {
    document.getElementById('score').textContent = score;
}

// Win the game
function winGame() {
    gameWon = true;

    const gameArea = document.getElementById('game-area');
    const winMessage = document.createElement('div');
    winMessage.className = 'win-message';
    winMessage.innerHTML = `
        <h2>You Win!</h2>
        <p>Final Score: ${score}</p>
        <button onclick="restartGame()">Play Again</button>
    `;
    gameArea.appendChild(winMessage);
}

// Lose the game (caught by baddie)
function loseGame() {
    gameOver = true;

    const gameArea = document.getElementById('game-area');
    const loseMessage = document.createElement('div');
    loseMessage.className = 'win-message lose-message';
    loseMessage.innerHTML = `
        <h2>Game Over!</h2>
        <p>The bear got you!</p>
        <p>Score: ${score}</p>
        <button onclick="restartGame()">Try Again</button>
    `;
    gameArea.appendChild(loseMessage);
}

// Restart the game
function restartGame() {
    // Reset state
    player.gridCol = 0;
    player.gridRow = 0;
    player.targetCol = 0;
    player.targetRow = 0;
    player.moving = false;
    player.direction = 'right';
    const startPos = gridToPixel(0, 0);
    player.x = startPos.x;
    player.y = startPos.y;

    score = 0;
    gameWon = false;
    gameOver = false;

    // Remove win/lose message
    const message = document.querySelector('.win-message');
    if (message) message.remove();

    // Reset UI
    updateScore();
    updatePlayerPosition();
    setPlayerDirection('right');
    setPlayerMoving(false);
    createGrid();
    createBaddies();
    lucide.createIcons();
    startBaddieMovement();
}

// Utility: Shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Start the game when the page loads
document.addEventListener('DOMContentLoaded', init);
