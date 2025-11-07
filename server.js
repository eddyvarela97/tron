// TRON ARES AI SERVER - Backend API for game data and AI model persistence
// ===========================================================================
// This server provides REST API endpoints for:
// - Loading and saving the AI model weights
// - Storing game recordings for training data
// - Retrieving training data for analysis
// - Exporting games data to CSV format

// DEPENDENCIES - Import required Node.js modules
// ===============================================

// Express: Fast, minimalist web framework for Node.js
const express = require('express');

// CORS: Cross-Origin Resource Sharing - allows browser to make requests to this server
const cors = require('cors');

// Body-parser: Middleware to parse incoming JSON request bodies
const bodyParser = require('body-parser');

// File System (Promises API): For reading/writing files asynchronously
const fs = require('fs').promises;

// Path: For working with file and directory paths
const path = require('path');

// SERVER SETUP
// =============

// Create Express application instance
const app = express();

// Port number the server will listen on
const PORT = 3000;

// MIDDLEWARE CONFIGURATION
// ========================
// Middleware runs before your routes and can modify the request/response

// Enable CORS - allows the game webpage to make API requests to this server
app.use(cors());

// Parse JSON bodies up to 50MB (game recordings can be large with many frames)
app.use(bodyParser.json({ limit: '50mb' }));

// Serve static files (HTML, JS, CSS) from current directory
// This makes the game accessible at http://localhost:3000/index.html
app.use(express.static('.'));

// DATA DIRECTORY PATHS
// ====================
// Define where we'll store all persistent data

// Main data directory: stores all game data and AI models
const DATA_DIR = path.join(__dirname, 'data');

// Games directory: stores individual game recordings as JSON files
const GAMES_DIR = path.join(DATA_DIR, 'games');

// Model directory: stores the AI neural network weights and config
const MODEL_DIR = path.join(DATA_DIR, 'model');

// INITIALIZE DATA DIRECTORIES
// ============================
// This function creates all required directories and initializes the model file if needed
// Runs once when the server starts
async function ensureDirectories() {
    try {
        // Create directories if they don't exist
        // { recursive: true } means it will create parent directories too (like mkdir -p)
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.mkdir(GAMES_DIR, { recursive: true });
        await fs.mkdir(MODEL_DIR, { recursive: true });

        // Check if model file exists, create initial model if not
        const modelPath = path.join(MODEL_DIR, 'ares_model.json');
        try {
            // Try to access the file (throws error if doesn't exist)
            await fs.access(modelPath);
        } catch {
            // File doesn't exist - create initial model structure
            const initialModel = {
                // Neural network weights (null = will be initialized randomly by AresBot)
                weights: null,

                // Neural network architecture configuration
                config: {
                    inputSize: 20,           // Number of input features
                    hiddenLayers: [64, 32],  // Two hidden layers with 64 and 32 neurons
                    outputSize: 4,           // Four outputs (up, down, left, right)
                    learningRate: 0.001      // How fast the AI learns from mistakes
                },

                // Training statistics
                stats: {
                    gamesPlayed: 0,      // Total games played
                    wins: 0,             // Games where Ares won
                    losses: 0,           // Games where Ares lost
                    avgSurvivalTime: 0   // Average time Ares survives (milliseconds)
                },

                // Model version (increments with each update)
                version: 1
            };

            // Write the initial model to disk as formatted JSON
            await fs.writeFile(modelPath, JSON.stringify(initialModel, null, 2));
        }
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

// ============================================================================
// API ROUTES - REST endpoints for the game frontend
// ============================================================================

// GET /api/model - Retrieve the current AI model
// ================================================
// Purpose: Load the saved neural network weights and configuration
// Used by: AresBot on initialization to load trained weights
// Returns: Complete model object with weights, config, stats, and version
app.get('/api/model', async (req, res) => {
    try {
        const modelPath = path.join(MODEL_DIR, 'ares_model.json');

        // Read the model file from disk
        const data = await fs.readFile(modelPath, 'utf8');

        // Parse JSON and send to client
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading model:', error);
        res.status(500).json({ error: 'Failed to load model' });
    }
});

// POST /api/model - Update the AI model
// =======================================
// Purpose: Save updated neural network weights after training
// Used by: Game after each match to save improved AI weights
// Request body: { weights: {...}, stats: {...}, etc. }
// Returns: { success: true, version: <new_version_number> }
app.post('/api/model', async (req, res) => {
    try {
        const modelPath = path.join(MODEL_DIR, 'ares_model.json');

        // Read current model from disk
        const currentModel = JSON.parse(await fs.readFile(modelPath, 'utf8'));

        // Merge incoming updates with current model
        // Spread operator (...) combines objects
        const updatedModel = {
            ...currentModel,      // Keep existing fields
            ...req.body,          // Override with new data from request
            version: currentModel.version + 1,  // Increment version number
            lastUpdated: new Date().toISOString()  // Add timestamp
        };

        // Write updated model back to disk
        await fs.writeFile(modelPath, JSON.stringify(updatedModel, null, 2));

        // Confirm success to client
        res.json({ success: true, version: updatedModel.version });
    } catch (error) {
        console.error('Error updating model:', error);
        res.status(500).json({ error: 'Failed to update model' });
    }
});

// POST /api/games - Save a game recording
// =========================================
// Purpose: Store complete game recording with all frame data for training
// Used by: Game after each match completes
// Request body: { mode, winner, duration, deathCause, frames[], aresData }
// Returns: { success: true, gameId: <unique_id>, stats: {...} }
app.post('/api/games', async (req, res) => {
    try {
        const gameData = req.body;

        // Generate unique game ID
        const timestamp = Date.now();
        // Create ID like: game_1234567890_abc123xyz
        const gameId = `game_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
        const filename = `${gameId}.json`;
        const filepath = path.join(GAMES_DIR, filename);

        // Add metadata to game data
        gameData.id = gameId;
        gameData.timestamp = timestamp;
        gameData.date = new Date().toISOString();

        // Write game recording to disk
        await fs.writeFile(filepath, JSON.stringify(gameData, null, 2));

        // Update model statistics based on game outcome
        const modelPath = path.join(MODEL_DIR, 'ares_model.json');
        const model = JSON.parse(await fs.readFile(modelPath, 'utf8'));

        // Increment games played counter
        model.stats.gamesPlayed++;

        // Update win/loss counters
        if (gameData.winner === 'ares') {
            model.stats.wins++;
        } else if (gameData.winner === 'player') {
            model.stats.losses++;
        }

        // Calculate new average survival time
        // Formula: (old_avg * old_count + new_value) / new_count
        const survivalTime = gameData.aresData?.survivalTime || 0;
        model.stats.avgSurvivalTime =
            (model.stats.avgSurvivalTime * (model.stats.gamesPlayed - 1) + survivalTime)
            / model.stats.gamesPlayed;

        // Save updated stats to model file
        await fs.writeFile(modelPath, JSON.stringify(model, null, 2));

        // Send confirmation back to client with updated stats
        res.json({
            success: true,
            gameId: gameId,
            stats: model.stats
        });
    } catch (error) {
        console.error('Error saving game:', error);
        res.status(500).json({ error: 'Failed to save game' });
    }
});

// GET /api/games/recent/:count - Retrieve recent games
// ======================================================
// Purpose: Get the N most recent game recordings for analysis
// Used by: Statistics display to calculate metrics across recent games
// URL parameter: count = number of games to retrieve (e.g., /api/games/recent/10)
// Returns: Array of game objects, sorted newest first
app.get('/api/games/recent/:count', async (req, res) => {
    try {
        // Parse count from URL parameter (default to 10 if invalid)
        const count = parseInt(req.params.count) || 10;

        // Read all filenames in games directory
        const files = await fs.readdir(GAMES_DIR);

        // Filter for JSON files, sort by name (which includes timestamp), take top N
        const gameFiles = files
            .filter(f => f.endsWith('.json'))            // Only JSON files
            .sort((a, b) => b.localeCompare(a))          // Sort descending (newest first)
            .slice(0, count);                            // Take only first N games

        // Load and parse each game file
        const games = [];
        for (const file of gameFiles) {
            const data = await fs.readFile(path.join(GAMES_DIR, file), 'utf8');
            games.push(JSON.parse(data));
        }

        // Return games array as JSON
        res.json(games);
    } catch (error) {
        console.error('Error reading games:', error);
        res.status(500).json({ error: 'Failed to load games' });
    }
});

// GET /api/training-data - Extract all training samples from games
// ==================================================================
// Purpose: Convert game recordings into training samples for ML analysis
// Used by: External training scripts or advanced analytics
// Returns: Array of training samples with { input: features[], output: action, reward }
app.get('/api/training-data', async (req, res) => {
    try {
        const files = await fs.readdir(GAMES_DIR);
        const trainingData = [];

        // Process each game file
        for (const file of files.filter(f => f.endsWith('.json'))) {
            const data = JSON.parse(await fs.readFile(path.join(GAMES_DIR, file), 'utf8'));

            // Extract training samples from game frames
            // Each frame contains a game state and the AI's decision
            if (data.frames && data.frames.length > 0) {
                data.frames.forEach(frame => {
                    // Only include frames with complete data
                    if (frame.aresDecision && frame.gameState) {
                        trainingData.push({
                            input: frame.gameState.features,      // 20-element feature vector
                            output: frame.aresDecision.action,    // Action taken (0-3)
                            reward: frame.aresDecision.reward || 0  // Reward received
                        });
                    }
                });
            }
        }

        // Return all training samples
        res.json(trainingData);
    } catch (error) {
        console.error('Error getting training data:', error);
        res.status(500).json({ error: 'Failed to get training data' });
    }
});

// Export games data as CSV
app.get('/api/export/csv', async (req, res) => {
    try {
        const files = await fs.readdir(GAMES_DIR);
        const games = [];

        // Load all games
        for (const file of files.filter(f => f.endsWith('.json'))) {
            const data = JSON.parse(await fs.readFile(path.join(GAMES_DIR, file), 'utf8'));
            games.push(data);
        }

        // Sort by timestamp
        games.sort((a, b) => a.timestamp - b.timestamp);

        // Create CSV content
        const csvHeader = [
            'Game_Number',
            'Game_ID',
            'Date',
            'Mode',
            'Winner',
            'Duration_ms',
            'Duration_seconds',
            'Death_Cause',
            'Ares_Decisions_Count',
            'Ares_Survival_Time_ms',
            'Ares_Survival_Time_seconds',
            'Frames_Count',
            'Avg_Decision_Time_ms',
            'Player_Won',
            'Ares_Won'
        ].join(',');

        const csvRows = games.map((game, index) => {
            const durationSeconds = Math.round(game.duration / 1000 * 100) / 100;
            const aresSurvivalSeconds = game.aresData?.survivalTime ?
                Math.round(game.aresData.survivalTime / 1000 * 100) / 100 : 0;
            const decisionsCount = game.aresData?.decisions?.length || 0;
            const avgDecisionTime = game.frames?.length > 0 ?
                Math.round(game.duration / game.frames.length * 100) / 100 : 0;

            return [
                index + 1,
                game.id || `game_${index}`,
                game.date || new Date(game.timestamp).toISOString(),
                game.mode || 'unknown',
                game.winner || 'unknown',
                game.duration || 0,
                durationSeconds,
                game.deathCause || 'unknown',
                decisionsCount,
                game.aresData?.survivalTime || 0,
                aresSurvivalSeconds,
                game.frames?.length || 0,
                avgDecisionTime,
                game.winner === 'player' ? 1 : 0,
                game.winner === 'ares' ? 1 : 0
            ].join(',');
        });

        const csvContent = [csvHeader, ...csvRows].join('\n');

        // Set CSV headers
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="ares_ai_games.csv"');
        res.send(csvContent);

    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ error: 'Failed to export CSV' });
    }
});

// Start server
ensureDirectories().then(() => {
    app.listen(PORT, () => {
        console.log(`Tron Ares server running on http://localhost:${PORT}`);
        console.log(`Open http://localhost:${PORT}/index.html to play`);
    });
});