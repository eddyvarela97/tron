// GAME SETUP - Getting ready to draw the game
// ============================================

// Get the canvas element from the HTML page where we'll draw the game
// Think of canvas as a digital drawing board
const canvas = document.getElementById('gameCanvas');

// Get the "context" which is like picking up our drawing tools (pencils, brushes)
// '2d' means we're drawing in 2 dimensions (flat, not 3D)
const ctx = canvas.getContext('2d');

// GAME DIMENSIONS - How big is our playing field?
// ================================================

// The game area is 600 pixels wide and tall (pixels are tiny dots on screen)
const GRID_SIZE = 600;

// Each "cell" in our game grid is 5 pixels wide
// The light cycles move from cell to cell, like moving on a chess board
const CELL_SIZE = 5;

// Calculate how many cells fit in our grid (600 ÷ 5 = 120 cells)
// So our game board is 120x120 cells
const GRID_CELLS = GRID_SIZE / CELL_SIZE;

// Set the actual size of our canvas/drawing area
canvas.width = GRID_SIZE;   // 600 pixels wide
canvas.height = GRID_SIZE;  // 600 pixels tall

// GAME STATE VARIABLES - Keeping track of what's happening
// =========================================================

// Is the game currently playing? (true = yes, false = no)
let gameRunning = false;

// Has the game been started at least once? (for intro screen)
let gameStarted = false;

// Game mode: '2player' or 'ares'
let gameMode = null;

// Ares AI bot instance
let aresBot = null;

// This will store the ID of our animation (used to stop the game later)
let animationId = null;

// Game recording for training
let gameRecording = {
    frames: [],
    startTime: null,
    winner: null,
    deathCause: null
};

// Statistics tracking
let aresStats = {
    gamesPlayed: 0,
    wins: 0,
    totalDecisions: 0,
    totalSurvivalTime: 0,
    modelVersion: 1
};

// PLAYER DATA - Information about each player's light cycle
// ==========================================================
// This is an "object" that stores all data about both players
const players = {
    // Player 1 (Cyan/Blue light cycle)
    player1: {
        x: 30,                    // Starting position: 30 cells from left edge
        y: GRID_CELLS / 2,        // Starting position: middle of the screen vertically
        dx: 1,                    // Direction moving horizontally (1 = right, -1 = left, 0 = not moving horizontally)
        dy: 0,                    // Direction moving vertically (1 = down, -1 = up, 0 = not moving vertically)
        color: '#0ff',            // Cyan color in hexadecimal (web color format)
        trail: [],                // Array that stores all positions the player has been (the light trail)
        score: 0,                 // How many games this player has won
        alive: true               // Is this player still in the game? (haven't crashed yet)
    },
    // Player 2 (Magenta/Pink light cycle)
    player2: {
        x: GRID_CELLS - 30,      // Starting position: 30 cells from right edge
        y: GRID_CELLS / 2,        // Starting position: middle of the screen vertically
        dx: -1,                   // Starting direction: moving left
        dy: 0,                    // Not moving vertically at start
        color: '#f0f',            // Magenta color in hexadecimal
        trail: [],                // Empty trail at start
        score: 0,                 // Starting score
        alive: true               // Starts alive
    }
};

// KEYBOARD TRACKING - Which keys are currently being pressed?
// ============================================================
// This object keeps track of whether each key is pressed (true) or not (false)
const keys = {
    // Player 1 controls (WASD keys)
    w: false,          // W key - moves up
    a: false,          // A key - moves left
    s: false,          // S key - moves down
    d: false,          // D key - moves right

    // Player 2 controls (Arrow keys)
    ArrowUp: false,    // Up arrow - moves up
    ArrowLeft: false,  // Left arrow - moves left
    ArrowDown: false,  // Down arrow - moves down
    ArrowRight: false  // Right arrow - moves right
};

// KEYBOARD INPUT HANDLERS - Detecting when players press/release keys
// ====================================================================

// This "listens" for when any key is pressed down
document.addEventListener('keydown', (e) => {
    // Check if game hasn't started yet (intro screen is showing)
    if (!gameStarted) {
        // Check if spacebar or P key was pressed to start the game
        if (e.key === ' ' || e.key.toLowerCase() === 'p') {
            startGameFromIntro();
            e.preventDefault();
        }
        return;  // Don't process other keys while intro is showing
    }

    // Check if spacebar was pressed (spacebar restarts the game after it's over)
    if (e.key === ' ') {
        // Only restart if game is not currently running
        if (!gameRunning) {
            resetGame();  // Start a new game
        }
        e.preventDefault();  // Prevent spacebar from scrolling the page
    }

    // Check if the pressed key is one of our game controls
    // hasOwnProperty checks if the key exists in our 'keys' object
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;  // Mark this key as "pressed"
        e.preventDefault();  // Prevent default browser behavior for this key
    }
});

// This "listens" for when any key is released
document.addEventListener('keyup', (e) => {
    // Check if the released key is one of our game controls
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;  // Mark this key as "not pressed"
        e.preventDefault();
    }
});

// HANDLE PLAYER INPUT - Convert key presses into player movements
// ================================================================
function handleInput() {
    // PLAYER 1 CONTROLS (WASD)
    // -------------------------
    // Important rule: Players can't turn 180 degrees (can't go back on themselves)
    // The "dy === 0" check means "only turn up/down if not already moving vertically"
    // The "dx === 0" check means "only turn left/right if not already moving horizontally"

    // W key pressed - Turn UP (only if not moving up or down already)
    if (keys.w && players.player1.dy === 0) {
        players.player1.dx = 0;   // Stop moving horizontally
        players.player1.dy = -1;  // Start moving up (negative Y is up)
    }
    // S key pressed - Turn DOWN (only if not moving up or down already)
    if (keys.s && players.player1.dy === 0) {
        players.player1.dx = 0;   // Stop moving horizontally
        players.player1.dy = 1;   // Start moving down (positive Y is down)
    }
    // A key pressed - Turn LEFT (only if not moving left or right already)
    if (keys.a && players.player1.dx === 0) {
        players.player1.dx = -1;  // Start moving left (negative X is left)
        players.player1.dy = 0;   // Stop moving vertically
    }
    // D key pressed - Turn RIGHT (only if not moving left or right already)
    if (keys.d && players.player1.dx === 0) {
        players.player1.dx = 1;   // Start moving right (positive X is right)
        players.player1.dy = 0;   // Stop moving vertically
    }

    // PLAYER 2 CONTROLS (Arrow Keys)
    // -------------------------------
    // Same logic as Player 1, but using arrow keys

    // Up Arrow - Turn UP
    if (keys.ArrowUp && players.player2.dy === 0) {
        players.player2.dx = 0;
        players.player2.dy = -1;
    }
    // Down Arrow - Turn DOWN
    if (keys.ArrowDown && players.player2.dy === 0) {
        players.player2.dx = 0;
        players.player2.dy = 1;
    }
    // Left Arrow - Turn LEFT
    if (keys.ArrowLeft && players.player2.dx === 0) {
        players.player2.dx = -1;
        players.player2.dy = 0;
    }
    // Right Arrow - Turn RIGHT
    if (keys.ArrowRight && players.player2.dx === 0) {
        players.player2.dx = 1;
        players.player2.dy = 0;
    }
}

// UPDATE PLAYER POSITION - Move the player and check for crashes
// ===============================================================
function updatePlayer(player, isAres = false) {
    // If player already crashed, don't update them anymore
    if (!player.alive) return;

    // If this is Ares AI, make decision
    if (isAres && gameMode === 'ares' && aresBot) {
        const gameState = {
            x: player.x,
            y: player.y,
            dx: player.dx,
            dy: player.dy,
            grid: createGridFromTrails(),
            playerX: players.player1.x,
            playerY: players.player1.y,
            playerDx: players.player1.dx,
            playerDy: players.player1.dy
        };

        const decision = aresBot.makeDecision(gameState);

        // Apply decision
        if (decision === 'up' && player.dy === 0) {
            player.dx = 0;
            player.dy = -1;
        } else if (decision === 'down' && player.dy === 0) {
            player.dx = 0;
            player.dy = 1;
        } else if (decision === 'left' && player.dx === 0) {
            player.dx = -1;
            player.dy = 0;
        } else if (decision === 'right' && player.dx === 0) {
            player.dx = 1;
            player.dy = 0;
        }

        // Record frame for training
        if (gameRecording.startTime) {
            gameRecording.frames.push({
                timestamp: Date.now() - gameRecording.startTime,
                aresDecision: {
                    action: ['right', 'left', 'down', 'up'].indexOf(decision),
                    position: { x: player.x, y: player.y }
                },
                gameState: {
                    features: aresBot.extractFeatures(gameState)
                }
            });
        }
    }

    // Add current position to the trail (before moving)
    // This creates the "light wall" behind the player
    player.trail.push({ x: player.x, y: player.y });

    // Move the player in their current direction
    player.x += player.dx;  // Move horizontally (dx is the speed/direction)
    player.y += player.dy;  // Move vertically (dy is the speed/direction)

    // CHECK FOR CRASHES
    // -----------------

    // Check if player hit the walls (went outside the game area)
    if (player.x < 0 ||                    // Hit left wall
        player.x >= GRID_CELLS ||           // Hit right wall
        player.y < 0 ||                    // Hit top wall
        player.y >= GRID_CELLS) {          // Hit bottom wall
        player.alive = false;  // Player crashed!
        if (isAres) {
            gameRecording.deathCause = 'wall';
        }
    }

    // Check if player hit Player 1's trail (including their own if they are Player 1)
    // "for...of" loop goes through each segment of the trail
    for (let segment of players.player1.trail) {
        // If player's position matches any trail segment position
        if (player.x === segment.x && player.y === segment.y) {
            player.alive = false;  // Player crashed into the trail!
            if (isAres) {
                gameRecording.deathCause = 'enemy_trail';
            }
        }
    }

    // Check if player hit Player 2's trail
    for (let segment of players.player2.trail) {
        if (player.x === segment.x && player.y === segment.y) {
            player.alive = false;  // Player crashed into the trail!
            if (isAres) {
                gameRecording.deathCause = 'own_trail';
            }
        }
    }
}

// DRAW THE GAME GRID - Create the background and grid lines
// ==========================================================
function drawGrid() {
    // Fill the entire canvas with black color (clear previous frame)
    ctx.fillStyle = '#000';  // Set fill color to black
    ctx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);  // Draw a black rectangle covering whole canvas

    // Draw faint grid lines to show the game cells
    ctx.strokeStyle = '#111';  // Very dark gray color for grid lines
    ctx.lineWidth = 0.5;       // Thin lines

    // Draw all vertical and horizontal lines
    // "for" loop repeats code multiple times (from i=0 to i=GRID_CELLS)
    for (let i = 0; i <= GRID_CELLS; i++) {
        const pos = i * CELL_SIZE;  // Calculate position of this grid line

        // Draw vertical line
        ctx.beginPath();         // Start drawing a new line
        ctx.moveTo(pos, 0);      // Start at top of screen
        ctx.lineTo(pos, GRID_SIZE); // Draw to bottom of screen
        ctx.stroke();            // Actually draw the line

        // Draw horizontal line
        ctx.beginPath();         // Start drawing a new line
        ctx.moveTo(0, pos);      // Start at left of screen
        ctx.lineTo(GRID_SIZE, pos); // Draw to right of screen
        ctx.stroke();            // Actually draw the line
    }
}

// DRAW A PLAYER - Draw the light cycle and its trail
// ====================================================
function drawPlayer(player) {
    // Set up glowing effect for this player
    ctx.shadowBlur = 10;              // How blurry the glow is
    ctx.shadowColor = player.color;   // Glow color matches player color

    // Set up line drawing style for the trail
    ctx.strokeStyle = player.color;   // Trail color
    ctx.lineWidth = 3;                 // Trail thickness
    ctx.lineCap = 'round';            // Rounded ends on lines
    ctx.lineJoin = 'round';           // Smooth corners where lines meet

    // Draw the light trail (if it exists)
    if (player.trail.length > 1) {    // Need at least 2 points to draw a line
        ctx.beginPath();               // Start drawing a path

        // Move to the first point in the trail
        // Multiply by CELL_SIZE to convert grid coordinates to pixel coordinates
        ctx.moveTo(player.trail[0].x * CELL_SIZE, player.trail[0].y * CELL_SIZE);

        // Draw lines to each subsequent point in the trail
        for (let i = 1; i < player.trail.length; i++) {
            ctx.lineTo(player.trail[i].x * CELL_SIZE, player.trail[i].y * CELL_SIZE);
        }

        // Draw line to current player position
        ctx.lineTo(player.x * CELL_SIZE, player.y * CELL_SIZE);

        ctx.stroke();  // Actually draw all the lines
    }

    // Draw the player's light cycle (the "head" of the trail)
    if (player.alive) {  // Only draw if player hasn't crashed
        ctx.fillStyle = player.color;  // Set fill color

        // Draw a small square at the player's position
        // The math centers the square on the player's position
        ctx.fillRect(
            player.x * CELL_SIZE - CELL_SIZE/2,  // X position (centered)
            player.y * CELL_SIZE - CELL_SIZE/2,  // Y position (centered)
            CELL_SIZE,                           // Width
            CELL_SIZE                            // Height
        );
    }

    ctx.shadowBlur = 0;  // Turn off glow effect (clean up for next drawing)
}

// CREATE GRID FROM TRAILS - Helper function for AI
// =================================================
function createGridFromTrails() {
    const grid = [];
    for (let y = 0; y < GRID_CELLS; y++) {
        grid[y] = [];
        for (let x = 0; x < GRID_CELLS; x++) {
            grid[y][x] = false;
        }
    }

    // Mark all trail positions as occupied
    for (const segment of players.player1.trail) {
        if (segment.x >= 0 && segment.x < GRID_CELLS &&
            segment.y >= 0 && segment.y < GRID_CELLS) {
            grid[segment.y][segment.x] = true;
        }
    }
    for (const segment of players.player2.trail) {
        if (segment.x >= 0 && segment.x < GRID_CELLS &&
            segment.y >= 0 && segment.y < GRID_CELLS) {
            grid[segment.y][segment.x] = true;
        }
    }

    return grid;
}

// CHECK IF GAME IS OVER - See if someone crashed and handle ending
// =================================================================
function checkGameOver() {
    // Check if either player has crashed
    if (!players.player1.alive || !players.player2.alive) {
        gameRunning = false;  // Stop the game

        // Determine who won
        let winnerText = "It's a Draw!";  // Default message (both crashed simultaneously)

        // Player 1 wins if they're alive and Player 2 isn't
        if (players.player1.alive && !players.player2.alive) {
            winnerText = "Player 1 Wins!";
            players.player1.score++;  // Add 1 to Player 1's score
        }
        // Player 2 wins if they're alive and Player 1 isn't
        else if (!players.player1.alive && players.player2.alive) {
            winnerText = "Player 2 Wins!";
            players.player2.score++;  // Add 1 to Player 2's score
        }
        // If neither condition is true, it's a draw (both crashed)

        // Update the HTML page with new scores and winner
        document.getElementById('score1').textContent = players.player1.score;
        document.getElementById('score2').textContent = players.player2.score;
        document.getElementById('winnerText').textContent = winnerText;

        // Record game data for Ares AI training
        if (gameMode === 'ares' && aresBot) {
            gameRecording.winner = players.player1.alive ? 'player' : 'ares';
            gameRecording.duration = Date.now() - gameRecording.startTime;

            // Update Ares bot with game result
            aresBot.recordDeath(
                gameRecording.deathCause || 'unknown',
                {
                    winner: gameRecording.winner,
                    survivalTime: gameRecording.duration
                }
            );

            // Save game data and update model
            saveGameData();
        }

        // Show the game over popup (was hidden with display: none)
        document.getElementById('gameOver').style.display = 'block';

        return true;  // Return true to indicate game is over
    }
    return false;  // Return false if game should continue
}

// MAIN GAME LOOP - The heart of the game that runs continuously
// ==============================================================
// This function runs about 20 times per second to update and draw the game
function gameLoop() {
    // Stop if game is not running
    if (!gameRunning) {
        cancelAnimationFrame(animationId);  // Stop the animation loop
        return;  // Exit this function
    }

    // GAME UPDATE SEQUENCE (order matters!)
    // --------------------------------------

    // 1. Check what keys players are pressing
    handleInput();

    // 2. Move both players based on their direction
    updatePlayer(players.player1);
    updatePlayer(players.player2, gameMode === 'ares');

    // 3. DRAWING SEQUENCE (clear screen, then draw everything)
    drawGrid();                 // Draw background and grid
    drawPlayer(players.player1); // Draw Player 1 and their trail
    drawPlayer(players.player2); // Draw Player 2 and their trail

    // 4. Check if someone crashed
    if (!checkGameOver()) {
        // Game is still going - schedule the next frame
        // setTimeout waits 50 milliseconds (0.05 seconds) before next update
        // This makes the game run at about 20 frames per second
        setTimeout(() => {
            // requestAnimationFrame tells the browser to run gameLoop again
            // when it's ready to draw the next frame
            animationId = requestAnimationFrame(gameLoop);
        }, 50);  // 50ms delay = 20 updates per second
    }
    // If checkGameOver() returned true, the game stops here
}

// RESET GAME - Start a new round (keeps scores)
// ===============================================
function resetGame() {
    // RESET PLAYER 1 to starting position
    // ------------------------------------
    players.player1.x = 30;                  // Start 30 cells from left
    players.player1.y = GRID_CELLS / 2;      // Middle of screen vertically
    players.player1.dx = 1;                  // Moving right
    players.player1.dy = 0;                  // Not moving vertically
    players.player1.trail = [];              // Clear the light trail
    players.player1.alive = true;            // Bring back to life

    // RESET PLAYER 2 to starting position
    // ------------------------------------
    players.player2.x = GRID_CELLS - 30;     // Start 30 cells from right
    players.player2.y = GRID_CELLS / 2;      // Middle of screen vertically
    players.player2.dx = -1;                 // Moving left (toward Player 1)
    players.player2.dy = 0;                  // Not moving vertically
    players.player2.trail = [];              // Clear the light trail
    players.player2.alive = true;            // Bring back to life

    // Hide the "Game Over" popup
    document.getElementById('gameOver').style.display = 'none';

    // Reset game recording
    gameRecording = {
        frames: [],
        startTime: Date.now(),
        winner: null,
        deathCause: null
    };

    // Reset Ares bot if in Ares mode
    if (gameMode === 'ares' && aresBot) {
        aresBot.reset();
    }

    // Start the game
    gameRunning = true;  // Set game state to running
    gameLoop();          // Start the game loop
}

// UPDATE ARES STATISTICS DISPLAY
// ===============================
function updateAresStatsDisplay() {
    if (gameMode !== 'ares') return;

    const winRate = aresStats.gamesPlayed > 0 ?
        Math.round((aresStats.wins / aresStats.gamesPlayed) * 100) : 0;

    const avgSurvival = aresStats.gamesPlayed > 0 ?
        Math.round(aresStats.totalSurvivalTime / aresStats.gamesPlayed / 1000) : 0;

    // Update display elements
    document.getElementById('gamesPlayed').textContent = aresStats.gamesPlayed;
    document.getElementById('winRate').textContent = winRate + '%';
    document.getElementById('decisionsLearned').textContent = aresStats.totalDecisions;
    document.getElementById('avgSurvival').textContent = avgSurvival + 's';
    document.getElementById('modelVersion').textContent = aresStats.modelVersion;

    // Update exploration rate (decreases as AI learns)
    const epsilon = Math.max(0.05, 0.1 - (aresStats.gamesPlayed * 0.01));
    document.getElementById('explorationRate').textContent = Math.round(epsilon * 100) + '%';

    // Update last death cause
    const lastDeath = gameRecording.deathCause || '-';
    const deathDisplay = lastDeath.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    document.getElementById('lastDeath').textContent = deathDisplay;
}

// HIGHLIGHT STAT UPDATE
// =====================
function highlightStat(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('highlight');
        setTimeout(() => element.classList.remove('highlight'), 500);
    }
}

// LOAD ARES STATISTICS FROM SERVER
// =================================
async function loadAresStats() {
    try {
        const response = await fetch('http://localhost:3000/api/model');
        const modelData = await response.json();

        if (modelData.stats) {
            aresStats.gamesPlayed = modelData.stats.gamesPlayed || 0;
            aresStats.wins = modelData.stats.wins || 0;
            aresStats.totalSurvivalTime = modelData.stats.avgSurvivalTime * aresStats.gamesPlayed || 0;
            aresStats.modelVersion = modelData.version || 1;
        }

        // Also get actual file count to ensure accuracy
        try {
            const gamesResponse = await fetch('http://localhost:3000/api/games/recent/1000');
            const games = await gamesResponse.json();
            const actualGameCount = games.length;

            // Use the higher count (file count vs stored count) to handle any sync issues
            if (actualGameCount > aresStats.gamesPlayed) {
                aresStats.gamesPlayed = actualGameCount;
            }
        } catch (error) {
            console.log('Could not verify game count:', error);
        }

        // Count total decisions from all games (reuse the games data from above)
        let allGames = [];
        try {
            const allGamesResponse = await fetch('http://localhost:3000/api/games/recent/1000');
            allGames = await allGamesResponse.json();
        } catch (error) {
            console.log('Could not load all games for decision count:', error);
        }

        aresStats.totalDecisions = allGames.reduce((total, game) => {
            return total + (game.frames ? game.frames.length : 0);
        }, 0);

        updateAresStatsDisplay();
    } catch (error) {
        console.log('Could not load Ares stats:', error);
    }
}

// SAVE GAME DATA - Send training data to server
// ==============================================
async function saveGameData() {
    try {
        const gameData = {
            mode: gameMode,
            winner: gameRecording.winner,
            duration: gameRecording.duration,
            deathCause: gameRecording.deathCause,
            frames: gameRecording.frames,
            aresData: aresBot ? aresBot.getTrainingData() : null
        };

        const response = await fetch('http://localhost:3000/api/games', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gameData)
        });

        if (response.ok) {
            console.log('Game data saved successfully');

            // Update local stats to match server
            aresStats.gamesPlayed++; // Increment since we just played a game
            if (gameRecording.winner === 'ares') {
                aresStats.wins++;
            }
            aresStats.totalDecisions += aresBot.decisionHistory.length;
            aresStats.totalSurvivalTime += gameRecording.duration;

            // Highlight updated stats
            highlightStat('gamesPlayed');
            highlightStat('decisionsLearned');
            if (gameRecording.winner === 'ares') {
                highlightStat('winRate');
            }

            // Update display
            updateAresStatsDisplay();

            // Optionally update model with new training data
            await updateAresModel();
        }
    } catch (error) {
        console.log('Could not save game data:', error);
    }
}

// UPDATE ARES MODEL - Retrain with recent games
// ==============================================
async function updateAresModel() {
    try {
        if (!aresBot) return;

        // Train the bot with its decision history
        const trainingData = aresBot.decisionHistory;
        if (trainingData.length > 0) {
            aresBot.updateWeights(trainingData);
            console.log(`Ares learned from ${trainingData.length} decisions`);
        }

        // Save updated model weights to server
        const response = await fetch('http://localhost:3000/api/model', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                weights: aresBot.weights,
                stats: {
                    lastGameResult: gameRecording.winner,
                    lastGameDuration: gameRecording.duration,
                    gamesPlayed: (await getModelStats()).gamesPlayed + 1
                }
            })
        });

        if (response.ok) {
            console.log('Model weights updated and saved');
            aresStats.modelVersion++;
            highlightStat('modelVersion');
            updateAresStatsDisplay();
        }
    } catch (error) {
        console.log('Could not update model:', error);
    }
}

// GET MODEL STATS - Helper function
// ==================================
async function getModelStats() {
    try {
        const response = await fetch('http://localhost:3000/api/model');
        const model = await response.json();
        return model.stats || { gamesPlayed: 0 };
    } catch (error) {
        return { gamesPlayed: 0 };
    }
}

// START GAME FROM INTRO - Handles first game start
// ==================================================
function startGameFromIntro() {
    // Check if a game mode is selected
    if (!gameMode) {
        alert('Please select a game mode first!');
        return;
    }

    // Hide the intro screen
    document.getElementById('introScreen').style.display = 'none';

    // Mark that the game has been started
    gameStarted = true;

    // Initialize Ares bot if in Ares mode
    if (gameMode === 'ares') {
        aresBot = new AresBot();
        // Update UI for single player
        document.getElementById('score2').parentElement.innerHTML =
            '<div class="player2">Ares AI: <span id="score2">0</span></div>';

        // Show stats panel and load initial stats
        document.getElementById('aresStats').style.display = 'block';
        document.getElementById('gameContainer').classList.add('ares-mode');
        loadAresStats();
    }

    // Start the first game
    resetGame();
}

// INITIALIZE ON PAGE LOAD
// ========================
// Set up the start button click handler when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Add click handler to the start button
    const startButton = document.getElementById('startButton');
    if (startButton) {
        startButton.addEventListener('click', startGameFromIntro);
    }

    // Add mode selection handlers
    const modeButtons = document.querySelectorAll('.mode-button');
    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove selected class from all buttons
            modeButtons.forEach(btn => btn.classList.remove('selected'));
            // Add selected class to clicked button
            button.classList.add('selected');

            // Set game mode
            gameMode = button.dataset.mode;

            // Update UI based on mode
            const player2Controls = document.getElementById('player2Controls');
            const startBtn = document.getElementById('startButton');

            if (gameMode === 'ares') {
                player2Controls.innerHTML = `
                    <h3 class="player2">Ares AI (Magenta)</h3>
                    <p>🤖 Machine Learning</p>
                    <p>🎯 Real-time decisions</p>
                    <p>📈 Learns from games</p>
                `;
                startBtn.textContent = 'Challenge Ares';
            } else {
                player2Controls.innerHTML = `
                    <h3 class="player2">Player 2 (Magenta)</h3>
                    <p>↑ - Up</p>
                    <p>← - Left</p>
                    <p>↓ - Down</p>
                    <p>→ - Right</p>
                `;
                startBtn.textContent = 'Start Game';
                // Hide stats panel for 2-player mode
                document.getElementById('aresStats').style.display = 'none';
                document.getElementById('gameContainer').classList.remove('ares-mode');
            }

            startBtn.disabled = false;
        });
    });

    // Add export CSV button handler
    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            // Open CSV download in new tab
            window.open('http://localhost:3000/api/export/csv', '_blank');
        });
    }

    // Draw the initial grid (visible behind intro screen)
    drawGrid();
});